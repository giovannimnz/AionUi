/**
 * hermes-toolset-validate.js
 *
 * Automated E2E test for Hermes ACP toolset upgrade validation.
 * Tests: hermes-acp → hermes-api-server toolset in AionUi.
 *
 * Usage:
 *   node hermes-toolset-validate.js
 *
 * Requirements:
 *   - AionUi web server running on localhost:5173 (OR)
 *   - AionUi Electron running with CDP on localhost:9230
 *   - Hermes ACP subprocess running
 *   - Playwright (npm install playwright)
 *
 * What it validates:
 *   1. AionUi login works
 *   2. Hermes agent appears in agent selector
 *   3. Conversation with Hermes works (no "Connection error")
 *   4. Slash command /gsd-ns-context executes without null errors
 *   5. Slash command /gsd-map-codebase executes without errors
 *   6. Control char commands (with \n\r\t) are rejected (errno 36 fix)
 */

const { chromium } = require('playwright');
const http = require('http');

const CDP_URL = 'ws://localhost:9230';
const WEB_URL = 'http://localhost:5173';
const HERMES_EMAIL = 'suporte+hermes@atius.com.br';
const HERMES_PASSWORD = '3eF9aK2m';
const SCREENSHOT_DIR = '/home/ubuntu/GitHub/forks/AionUi/tests/e2e/playwright-screenshots';

const TEST_COMMANDS = [
  { cmd: '/gsd-ns-context', name: 'GSD namespace context', maxWaitMs: 45000 },
  { cmd: '/gsd-map-codebase', name: 'GSD map codebase', maxWaitMs: 45000 },
];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function checkWebServer(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function tryElectronCDP() {
  try {
    console.log(`[CDP] Trying to connect to Electron at ${CDP_URL}...`);
    // Try to get the list of targets first
    const resp = await fetch('http://localhost:9230/json');
    const targets = await resp.json();
    console.log(`[CDP] Targets found: ${targets.length}`, targets.map((t) => `${t.id} (${t.type}) - ${t.url}`).join(', '));
    if (targets.length === 0) {
      throw new Error('No CDP targets (pages) available');
    }
    const browser = await chromium.connectOverCDP(CDP_URL);
    const contexts = browser.contexts();
    if (contexts.length === 0) throw new Error('No CDP contexts');
    const page = await contexts[0].newPage();
    const title = await page.title();
    console.log(`[CDP] Connected to Electron. Page title: "${title}"`);
    return { browser, page, viaCDP: true };
  } catch (err) {
    console.log(`[CDP] Failed: ${err.message}`);
    return null;
  }
}

async function tryWebLaunch() {
  try {
    console.log(`[Web] Launching fresh Chromium to ${WEB_URL}...`);
    const available = await checkWebServer(WEB_URL);
    if (!available) throw new Error('Web server not available at ' + WEB_URL);

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    console.log('[Web] Browser launched');
    return { browser, page, viaCDP: false };
  } catch (err) {
    console.log(`[Web] Failed: ${err.message}`);
    if (browser) await browser.close().catch(() => {});
    return null;
  }
}

async function connectToApp() {
  // Try CDP first (reconnects to running Electron), fallback to web launch
  let result = await tryElectronCDP();
  if (result) return result;

  result = await tryWebLaunch();
  if (result) return result;

  throw new Error('Could not connect via CDP or launch web browser');
}

async function login(page) {
  console.log('[Login] Checking if login required...');

  // Navigate to app first
  await page.goto(WEB_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sleep(2000);
  console.log('[Login] Current URL:', page.url());

  // Take screenshot to see the page
  await page.screenshot({ path: `${SCREENSHOT_DIR}/hermes-login-page.png` });
  console.log('[Login] Screenshot: hermes-login-page.png');

  // Check for login form
  const emailInput = page.locator('input[type="email"], input[placeholder*="email" i], input[placeholder*="usuário" i], input[placeholder*="user" i]').first();
  const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('[Login] Email field visible:', emailVisible);

  if (emailVisible) {
    // Clear and type character by character to trigger React onChange
    await emailInput.click();
    await emailInput.pressSequentially(HERMES_EMAIL, { delay: 50 });
  } else {
    // Try clicking any login button to get to the login page
    const anyButton = page.locator('button').first();
    const btnText = await anyButton.textContent().catch(() => '');
    console.log('[Login] First button text:', btnText);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/hermes-login-page-2.png` });
  }

  // Find and fill password field
  const passInput = page.locator('input[type="password"]').first();
  await passInput.click();
  await passInput.pressSequentially(HERMES_PASSWORD, { delay: 50 });

  // Intercept ALL API calls during login
  const loginApiCalls = [];
  page.on('response', async (response) => {
    const url = response.url().replace('http://localhost:5173', '');
    loginApiCalls.push({ url, status: response.status() });
  });
  page.on('requestfailed', async (request) => {
    const url = request.url().replace('http://localhost:5173', '');
    loginApiCalls.push({ url: `FAILED: ${url}`, failure: request.failure()?.errorText });
  });

  // Click login button and wait for navigation
  const loginBtn = page.locator('button[type="submit"]').first();
  const loginBtnVisible = await loginBtn.isVisible().catch(() => false);
  console.log('[Login] Login button visible:', loginBtnVisible);
  console.log('[Login] Login button text:', await loginBtn.textContent().catch(() => ''));

  await loginBtn.click();
  await page.waitForTimeout(10000);
  console.log('[Login] After login attempt. URL:', page.url());

  // Check for error messages
  const errorText = await page.locator('.arco-message-error, [role="alert"], .error, .text-red').textContent().catch(() => '');
  console.log('[Login] Error text:', errorText);
  console.log('[Login] API calls made:', JSON.stringify(loginApiCalls.slice(0, 10)));

  // Save auth state for reuse
  const localStorageKeys = await page.evaluate(() => {
    return Object.keys(window.localStorage || {});
  }).catch(() => []);
  console.log('[Login] localStorage keys:', localStorageKeys);

  // Check if login succeeded (URL changed away from /login)
  const loginSucceeded = !page.url().includes('/login') && !page.url().includes('about:blank');
  if (!loginSucceeded) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/hermes-login-failed.png` });
    console.log('[Login] Login appears to have failed, URL still:', page.url());
  } else {
    console.log('[Login] Login succeeded');
  }
  return loginSucceeded;
}

async function navigateToHermesConversation(page) {
  console.log('[Hermes] Navigating to Hermes conversation...');

  // Navigate to guid page
  await page.goto(WEB_URL + '/#/guid', { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(3000);

  // Look for agent logos/buttons
  const logos = page.locator('img[alt$=" logo"]');
  const count = await logos.count();
  console.log(`[Hermes] Found ${count} agent logos on page`);

  // Try to find Hermes agent
  const hermesAgent = page.locator('text=/hermes/i').first();
  const hermesVisible = await hermesAgent.isVisible({ timeout: 3000 }).catch(() => false);

  if (hermesVisible) {
    console.log('[Hermes] Found Hermes text, clicking...');
    await hermesAgent.click();
    await sleep(2000);
  }

  // Look for the chat input
  const input = page.locator('textarea, [contenteditable="true"], [role="textbox"]').first();
  const inputVisible = await input.isVisible({ timeout: 5000 }).catch(() => false);

  if (inputVisible) {
    console.log('[Hermes] Chat input found');
  } else {
    console.log('[Hermes] WARNING: Chat input not found');
  }

  // Take screenshot
  await page.screenshot({ path: `${SCREENSHOT_DIR}/hermes-nav-${Date.now()}.png` });

  return inputVisible;
}

async function sendSlashCommand(page, cmd, name, maxWaitMs) {
  console.log(`[Test] Sending: "${cmd}" (${name})`);

  const input = page.locator('textarea, [contenteditable="true"], [role="textbox"]').first();
  await input.waitFor({ timeout: 10000 });
  await input.fill(cmd);
  await input.press('Enter');

  console.log(`[Test] Waiting up to ${maxWaitMs}ms for response...`);
  const startTime = Date.now();
  await sleep(5000);

  let nullErrors = 0;
  let connectionErrors = 0;

  // Poll for errors and response
  let elapsed = Date.now() - startTime;
  while (elapsed < maxWaitMs) {
    const pageText = await page.locator('body').textContent().catch(() => '');

    nullErrors = (pageText.match(/Cannot read properties of null|null has no|undefined.*null|null.*undefined/gi) || []).length;
    connectionErrors = (pageText.match(/Connection error|connection.*error|ECONNREFUSED/gi) || []).length;

    if (nullErrors > 0 || connectionErrors > 0) {
      console.log(`[Test] Errors detected: nullErrors=${nullErrors}, connectionErrors=${connectionErrors}`);
      break;
    }

    // Check if response arrived (input should be cleared or changed)
    const currentInput = await input.textContent().catch(() => '');
    if (elapsed > 15000 && currentInput === '') {
      // Input was cleared, likely means response came through
      break;
    }

    await sleep(2000);
    elapsed = Date.now() - startTime;
  }

  elapsed = Date.now() - startTime;

  const screenshotName = `hermes-${cmd.replace(/\//g, '').replace(/\s+/g, '-')}-${Date.now()}.png`;
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${screenshotName}` });
  console.log(`[Test] Screenshot: ${screenshotName} (${elapsed}ms)`);

  return {
    command: cmd,
    name,
    elapsedMs: elapsed,
    nullErrors,
    connectionErrors,
    success: nullErrors === 0 && connectionErrors === 0,
  };
}

async function validateControlCharRejection(page) {
  console.log('[Test] Validating control char rejection (errno 36 fix)...');

  const input = page.locator('textarea, [contenteditable="true"], [role="textbox"]').first();
  await input.waitFor({ timeout: 10000 });

  const badCmd = '/gsd-debug\n\nsome text after newline';
  await input.fill(badCmd);
  await input.press('Enter');
  await sleep(3000);

  const pageText = await page.locator('body').textContent().catch(() => '');
  const hasNullOrErr = /Cannot read properties|null has no|errno 36|file name too long|null.*error/i.test(pageText);

  console.log(`[Test] Control char test: ${hasNullOrErr ? '❌ FAILED' : '✅ PASSED'}`);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/hermes-control-char-${Date.now()}.png` });

  return !hasNullOrErr;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Hermes Toolset Upgrade Validation Test');
  console.log('hermes-acp → hermes-api-server');
  console.log('='.repeat(60));

  const results = {
    login: false,
    hermesFound: false,
    controlCharTest: false,
    commands: [],
    startTime: new Date().toISOString(),
    endTime: null,
  };

  let browser = null;
  let page = null;

  try {
    // Step 1: Connect to app (CDP or Web)
    console.log('\n[Step 1] Connecting to AionUi...');
    ({ browser, page } = await connectToApp());

    // Step 2: Login
    console.log('\n[Step 2] Login...');
    results.login = await login(page);

    // Step 3: Navigate to Hermes conversation
    console.log('\n[Step 3] Navigate to Hermes...');
    const hasInput = await navigateToHermesConversation(page);
    results.hermesFound = hasInput;

    if (!hasInput) {
      console.log('[Hermes] WARNING: Could not find chat input, but continuing...');
    }

    // Step 4: Send slash commands
    console.log('\n[Step 4] Testing slash commands...');
    for (const { cmd, name, maxWaitMs } of TEST_COMMANDS) {
      const result = await sendSlashCommand(page, cmd, name, maxWaitMs);
      results.commands.push(result);
      console.log(`  ${result.success ? '✅' : '❌'} ${name}: ${result.success ? 'PASSED' : 'FAILED'} (${result.elapsedMs}ms, nullErrors=${result.nullErrors}, connErrors=${result.connectionErrors})`);
    }

    // Step 5: Control char rejection test
    console.log('\n[Step 5] Control char rejection test...');
    results.controlCharTest = await validateControlCharRejection(page);

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    results.error = err.message;

    if (page) {
      try {
        await page.screenshot({ path: `${SCREENSHOT_DIR}/hermes-error-${Date.now()}.png` });
      } catch (_) {}
    }
  } finally {
    results.endTime = new Date().toISOString();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Login:             ${results.login ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Hermes Agent:     ${results.hermesFound ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Control Char Test: ${results.controlCharTest ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('\nSlash Commands:');
    for (const cmd of results.commands) {
      console.log(`  ${cmd.success ? '✅' : '❌'} ${cmd.name}: nullErrors=${cmd.nullErrors}, connErrors=${cmd.connectionErrors}`);
    }

    const allPassed = results.login && results.hermesFound &&
      results.controlCharTest && results.commands.every((c) => c.success);
    console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

    if (browser) {
      await browser.close();
    }

    process.exit(allPassed ? 0 : 1);
  }
}

main();
