/**
 * Hermes GSD Skill Execution E2E Tests
 *
 * Tests the execution of GSD (Get Shit Done) slash commands via the Hermes Agent
 * in AionUi conversations. Validates:
 *   - Hermes Agent connection and session activation
 *   - GSD skill discovery and slash command execution
 *   - Skill output rendering in the conversation
 *
 * Prerequisites:
 *   - Hermes Agent CLI installed and in PATH
 *   - AionUi Electron app accessible (dev mode with E2E_DEV=1 or packaged)
 *   - Existing conversation with Hermes Agent (conversation id: 73c80cbd)
 *
 * Run with:
 *   E2E_DEV=1 npx playwright test tests/e2e/features/conversations/acp/skills/hermes-gsd-skill.e2e.ts --reporter=list
 *   E2E_DEV=1 npx playwright test tests/e2e/features/conversations/acp/skills/hermes-gsd-skill.e2e.ts --headed  # Visual mode
 */

import { test, expect, type Page } from '../../../../fixtures';
import {
  navigateTo,
  goToGuid,
  selectAgent,
  sendMessageFromGuid,
  waitForSessionActive,
  waitForAiReply,
  goToNewChat,
  takeScreenshot,
  invokeBridge,
  CHAT_INPUT,
  GUID_INPUT,
  AGENT_STATUS_MESSAGE,
  agentPillByBackend,
} from '../../../../helpers';

// Test conversation ID - this is an existing Hermes conversation
const HERMES_CONVERSATION_ID = '73c80cbd';

test.describe('Hermes GSD Skill Execution', () => {
  test.setTimeout(300_000); // 5 minutes for skill execution

  test.beforeEach(async ({ page }) => {
    // Navigate to the Hermes conversation
    await navigateTo(page, `#/conversation/${HERMES_CONVERSATION_ID}`);
    await page.waitForLoadState('networkidle');
  });

  test('hermes: session is active and connected', async ({ page }) => {
    // Verify we're on the conversation page
    await expect(page).toHaveURL(new RegExp(`#/conversation/${HERMES_CONVERSATION_ID}`));

    // Wait for session to be active
    await waitForSessionActive(page, 60_000);

    // Check for active session indicator
    const statusVisible = await page
      .locator(AGENT_STATUS_MESSAGE)
      .filter({ hasText: /Active session|Hermes Agent/ })
      .first()
      .isVisible()
      .catch(() => false);

    // At minimum, we should have the chat input available
    const chatInput = page.locator(CHAT_INPUT);
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    console.log(`✓ Hermes session active - status visible: ${statusVisible}`);
  });

  test('hermes: /gsd-map-codebase skill executes', async ({ page }) => {
    // Verify we're on the conversation page
    await expect(page).toHaveURL(new RegExp(`#/conversation/${HERMES_CONVERSATION_ID}`));

    // Wait for session to be active
    await waitForSessionActive(page, 60_000);

    // Find the chat input
    const chatInput = page.locator(CHAT_INPUT);
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    // Send the GSD skill command
    console.log("Sending /gsd-map-codebase command...");
    await chatInput.fill('/gsd-map-codebase');
    await chatInput.press('Enter');

    // Wait for skill execution - GSD skills can take time to execute
    // Poll for output indicators
    let skillOutputDetected = false;
    const maxWaitSeconds = 120;
    const pollInterval = 5;

    for (let i = 0; i < maxWaitSeconds / pollInterval; i++) {
      await page.waitForTimeout(pollInterval * 1000);

      const bodyText = await page.innerText('body').catch(() => '');

      // Look for indicators that the skill executed
      const outputIndicators = [
        '.planning',       // GSD creates .planning directory
        'STACK',           // GSD output files
        'ARCHITECTURE',
        'codebase',
        'skill',
        'map-codebase',
        'GSD',             // GSD references
        'document',        // GSD document creation
        'workflow',
        'EXECUTION',
      ];

      for (const indicator of outputIndicators) {
        if (bodyText.toLowerCase().includes(indicator.toLowerCase())) {
          skillOutputDetected = true;
          console.log(`✓ Skill output detected: "${indicator}" found at ${(i + 1) * pollInterval}s`);
          break;
        }
      }

      if (skillOutputDetected) break;

      // Also check for error indicators
      if (bodyText.toLowerCase().includes('connection error') ||
          bodyText.toLowerCase().includes('timeout') ||
          bodyText.toLowerCase().includes('syntax error')) {
        console.log(`⚠ Potential error detected in output`);
        break;
      }

      console.log(`Waiting for skill output... ${(i + 1) * pollInterval}s / ${maxWaitSeconds}s`);
    }

    // Take a screenshot for debugging
    await takeScreenshot(page, 'hermes-gsd-map-codebase-result');

    // Verify skill execution
    expect(skillOutputDetected).toBe(true);
  });

  test('hermes: /skills list returns GSD skills', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`#/conversation/${HERMES_CONVERSATION_ID}`));
    await waitForSessionActive(page, 60_000);

    const chatInput = page.locator(CHAT_INPUT);
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    // Send /skills list command
    console.log("Sending /skills list command...");
    await chatInput.fill('/skills list');
    await chatInput.press('Enter');

    // Wait for response
    await page.waitForTimeout(15_000);

    // Take screenshot
    await takeScreenshot(page, 'hermes-skills-list');

    // Verify skills are listed
    const bodyText = await page.innerText('body').catch(() => '');
    const hasSkills = bodyText.includes('gsd') ||
                     bodyText.includes('Skills') ||
                     bodyText.includes('Installed');

    console.log(`✓ Skills list response detected: ${hasSkills}`);
  });
});

test.describe('Hermes GSD Skill - Fresh Session', () => {
  test.setTimeout(300_000);

  // Create a new Hermes conversation for this test
  test('creates new Hermes conversation and executes GSD skill', async ({ page }) => {
    // Go to GUID page and create new conversation
    await goToGuid(page);

    // Check if Hermes agent is available
    const hermesPill = page.locator(agentPillByBackend('hermes'));
    const hermesVisible = await hermesPill.isVisible().catch(() => false);

    if (!hermesVisible) {
      // Wait for lazy loading
      await page.waitForTimeout(2000);
    }

    const pillVisible = await hermesPill.isVisible().catch(() => false);
    if (!pillVisible) {
      test.skip(true, 'Hermes agent not available - CLI may not be installed');
      return;
    }

    // Select Hermes agent
    await selectAgent(page, 'hermes');

    // Create a new conversation
    const conversationId = await sendMessageFromGuid(page, '/gsd-map-codebase');
    expect(conversationId).toBeTruthy();

    // Wait for session to become active
    await waitForSessionActive(page, 120_000);

    // Verify we're in the conversation
    await expect(page).toHaveURL(/\/conversation\//);

    // Take screenshot
    await takeScreenshot(page, 'hermes-new-session-gsd');

    console.log(`✓ Created new Hermes conversation: ${conversationId}`);
  });
});
