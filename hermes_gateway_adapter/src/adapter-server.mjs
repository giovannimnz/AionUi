/**
 * Hermes Gateway Adapter — HTTP Server
 *
 * Exposes Hermes Agent CLI as an HTTP API for AionUi integration.
 * Based on the hermes-paperclip-adapter architecture but as a standalone gateway.
 *
 * Endpoints:
 *   POST /execute     — Execute a Hermes chat prompt (returns structured result)
 *   GET  /health      — Liveness check
 *   GET  /ready       — Readiness check (Hermes CLI available)
 *   GET  /skills      — List available Hermes skills
 *   GET  /model       — Detect current model from config.yaml
 *   POST /session     — Create a new session or resume existing one
 *   GET  /sessions    — List recent sessions
 *
 * Architecture:
 *   HTTP Server (Node.js) → hermes chat -q (subprocess) → Hermes Agent
 */

import http from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import YAML from "yaml";

const PORT = Number(process.env.ADAPTER_PORT || 8200);
const HERMES_HOME = process.env.HERMES_HOME || join(homedir(), ".hermes");
const HERMES_CLI = process.env.HERMES_CLI || "hermes";
const DEFAULT_TIMEOUT_SEC = 1800;
const DEFAULT_GRACE_SEC = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function cfgString(v) {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function cfgNumber(v) {
  return typeof v === "number" ? v : undefined;
}

function cfgBoolean(v) {
  return typeof v === "boolean" ? v : undefined;
}

function cfgStringArray(v) {
  return Array.isArray(v) && v.every((i) => typeof i === "string") ? v : undefined;
}

function redactEnv(env) {
  const redacted = { ...env };
  for (const key of Object.keys(redacted)) {
    if (/key|token|secret|password|authorization/i.test(key)) {
      redacted[key] = "***REDACTED***";
    }
  }
  return redacted;
}

// ---------------------------------------------------------------------------
// Model Detection (from config.yaml)
// ---------------------------------------------------------------------------

async function detectModel(configPath) {
  const filePath = configPath || join(HERMES_HOME, "config.yaml");
  let content;
  try {
    content = await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
  return parseModelFromConfig(content);
}

function parseModelFromConfig(content) {
  const doc = YAML.parse(content);
  if (!doc || !doc.model) return null;

  const modelSection = doc.model;
  return {
    model: cfgString(modelSection.default) || null,
    provider: cfgString(modelSection.provider) || "auto",
    baseUrl: cfgString(modelSection.base_url) || null,
    apiMode: cfgString(modelSection.api_mode) || null,
    source: "config",
  };
}

// ---------------------------------------------------------------------------
// Skills Listing
// ---------------------------------------------------------------------------

async function listSkills() {
  const skillsHome = join(HERMES_HOME, "skills");
  const entries = [];

  try {
    const { readdir, stat, readFile: fsReadFile } = await import("node:fs/promises");
    const categories = await readdir(skillsHome, { withFileTypes: true });

    for (const cat of categories) {
      if (!cat.isDirectory()) continue;
      const catPath = join(skillsHome, cat.name);

      // Top-level skill in category dir
      const topLevelSkillMd = join(catPath, "SKILL.md");
      if (await stat(topLevelSkillMd).catch(() => null)) {
        entries.push(await buildSkillEntry(cat.name, topLevelSkillMd, cat.name));
      }

      // Sub-skills
      const items = await readdir(catPath, { withFileTypes: true }).catch(() => []);
      for (const item of items) {
        if (!item.isDirectory()) continue;
        const skillMd = join(catPath, item.name, "SKILL.md");
        if (await stat(skillMd).catch(() => null)) {
          entries.push(await buildSkillEntry(item.name, skillMd, `${cat.name}/${item.name}`));
        }
      }
    }
  } catch {
    // ~/.hermes/skills/ doesn't exist
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

function parseSkillFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    fm[key] = val;
  }
  return fm;
}

async function buildSkillEntry(key, skillMdPath, categoryPath) {
  let description = null;
  try {
    const content = await fsReadFile(skillMdPath, "utf8");
    const fm = parseSkillFrontmatter(content);
    description = fm.description ?? null;
  } catch {}

  return {
    key,
    category: categoryPath,
    description,
    location: `~/.hermes/skills/${categoryPath}`,
  };
}

// ---------------------------------------------------------------------------
// Hermes CLI Execution
// ---------------------------------------------------------------------------

const SESSION_ID_REGEX = /^session_id:\s*(\S+)/m;
const TOKEN_USAGE_REGEX = /token...b/i;
const COST_REGEX = /(?:cost|spent)[:\s]*\$?([\d.]+)/i;

function cleanResponse(raw) {
  return raw
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t.startsWith("[tool]") || t.startsWith("[hermes]")) return false;
      if (t.startsWith("session_id:")) return false;
      if (/^\[\d{4}-\d{2}-\d{2}T/.test(t)) return false;
      if (/^\[done\]\s*┊/.test(t)) return false;
      if (/^┊\s*[\p{Emoji_Presentation}]/u.test(t) && !/^┊\s*💬/.test(t)) return false;
      if (/^\p{Emoji_Presentation}\s*(Completed|Running|Error)?\s*$/u.test(t)) return false;
      return true;
    })
    .map((line) => {
      let t = line.replace(/^[\s]*┊\s*💬\s*/, "").trim();
      t = t.replace(/^\[done\]\s*/, "").trim();
      return t;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseHermesOutput(stdout, stderr) {
  const combined = stdout + "\n" + stderr;
  const result = {};

  const sessionMatch = stdout.match(SESSION_ID_REGEX);
  if (sessionMatch?.[1]) {
    result.sessionId = sessionMatch[1];
    const sessionLineIdx = stdout.lastIndexOf("\nsession_id:");
    if (sessionLineIdx > 0) {
      result.response = cleanResponse(stdout.slice(0, sessionLineIdx));
    }
  }

  if (!result.response) {
    const cleaned = cleanResponse(stdout);
    if (cleaned.length > 0) result.response = cleaned;
  }

  const usageMatch = combined.match(TOKEN_USAGE_REGEX);
  if (usageMatch) {
    result.usage = {
      inputTokens: parseInt(usageMatch[1], 10) || 0,
      outputTokens: parseInt(usageMatch[2], 10) || 0,
    };
  }

  const costMatch = combined.match(COST_REGEX);
  if (costMatch?.[1]) {
    result.costUsd = parseFloat(costMatch[1]);
  }

  if (stderr.trim()) {
    const errorLines = stderr
      .split("\n")
      .filter((line) => /error|exception|traceback|failed/i.test(line))
      .filter((line) => !/INFO|DEBUG|warn/i.test(line));
    if (errorLines.length > 0) {
      result.errorMessage = errorLines.slice(0, 5).join("\n");
    }
  }

  return result;
}

function buildEnv(config) {
  const env = { ...process.env };
  // Ensure hermes CLI is found
  if (process.env.HERMES_HOME) {
    env.HERMES_HOME = process.env.HERMES_HOME;
  }
  // Inject any custom env vars from config
  if (config.env && typeof config.env === "object") {
    Object.assign(env, config.env);
  }
  return env;
}

async function runHermesChat(args, config = {}) {
  const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
  const graceSec = cfgNumber(config.graceSec) || DEFAULT_GRACE_SEC;
  const cwd = cfgString(config.cwd) || ".";

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const proc = spawn(HERMES_CLI, args, {
      cwd,
      env: buildEnv(config),
      timeout: timeoutSec * 1000,
    });

    proc.stdout?.on("data", (d) => (stdout += d));
    proc.stderr?.on("data", (d) => (stderr += d));

    proc.on("close", (code, signal) => {
      resolve({ stdout, stderr, exitCode: code, signal, timedOut });
    });

    proc.on("error", (err) => {
      resolve({ stdout, stderr, exitCode: 1, signal: null, timedOut: false, error: err.message });
    });

    // Grace period timeout
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, graceSec * 1000);
    }, timeoutSec * 1000);

    proc.on("close", () => clearTimeout(timer));
  });
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

async function handleExecute(req, res, body) {
  if (req.method !== "POST") {
    return jsonResponse(res, 405, { error: "Method not allowed" });
  }

  let ctx;
  try {
    ctx = await readJson(req);
  } catch {
    return jsonResponse(res, 400, { error: "Invalid JSON body" });
  }

  // Extract configuration
  const prompt = cfgString(ctx.prompt) || cfgString(ctx.message);
  if (!prompt) {
    return jsonResponse(res, 400, { error: "Missing required field: prompt or message" });
  }

  const model = cfgString(ctx.model);
  const provider = cfgString(ctx.provider);
  const toolsets = cfgString(ctx.toolsets) || cfgStringArray(ctx.enabledToolsets)?.join(",");
  const sessionId = cfgString(ctx.sessionId) || cfgString(ctx.session_id);
  const maxTurns = cfgNumber(ctx.maxTurns);
  const timeoutSec = cfgNumber(ctx.timeoutSec);
  const verbose = cfgBoolean(ctx.verbose);
  const cwd = cfgString(ctx.cwd);

  // Build hermes chat args
  const args = ["chat", "-q", prompt, "-Q"]; // -q = query, -Q = quiet (no banner)
  if (model) args.push("-m", model);
  if (provider && provider !== "auto") args.push("--provider", provider);
  if (toolsets) args.push("-t", toolsets);
  if (maxTurns && maxTurns > 0) args.push("--max-turns", String(maxTurns));
  if (sessionId) args.push("-r", sessionId);
  if (verbose) args.push("-v");
  args.push("--yolo"); // Bypass approval prompts (non-interactive)
  args.push("--source", "gateway");

  try {
    const result = await runHermesChat(args, { timeoutSec, cwd });

    const parsed = parseHermesOutput(result.stdout || "", result.stderr || "");

    jsonResponse(res, 200, {
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      provider: provider || "auto",
      model: model || null,
      response: parsed.response || null,
      sessionId: parsed.sessionId || sessionId || null,
      usage: parsed.usage || null,
      costUsd: parsed.costUsd ?? null,
      errorMessage: parsed.errorMessage || (result.error ? result.error : null),
      resultJson: {
        result: parsed.response || "",
        session_id: parsed.sessionId || sessionId || null,
        usage: parsed.usage || null,
        cost_usd: parsed.costUsd ?? null,
      },
    });
  } catch (err) {
    jsonResponse(res, 500, {
      error: err.message || "Hermes execution failed",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
}

async function handleHealth(req, res) {
  jsonResponse(res, 200, { status: "ok", adapter: "hermes-gateway-adapter", version: "1.0.0" });
}

async function handleReady(req, res) {
  try {
    const proc = await runHermesChat(["--version"], {});
    if (proc.exitCode === 0 || proc.stdout.includes("Hermes")) {
      const modelConfig = await detectModel();
      jsonResponse(res, 200, {
        status: "ready",
        hermes: "ok",
        version: proc.stdout.trim() || proc.stderr.trim(),
        model: modelConfig,
      });
    } else {
      jsonResponse(res, 503, { status: "not ready", error: "Hermes CLI not available" });
    }
  } catch (err) {
    jsonResponse(res, 503, { status: "not ready", error: err.message });
  }
}

async function handleSkills(req, res) {
  try {
    const skills = await listSkills();
    jsonResponse(res, 200, {
      skills,
      total: skills.length,
      location: "~/.hermes/skills/",
    });
  } catch (err) {
    jsonResponse(res, 500, { error: err.message });
  }
}

async function handleModel(req, res) {
  try {
    const modelConfig = await detectModel();
    if (modelConfig) {
      jsonResponse(res, 200, modelConfig);
    } else {
      jsonResponse(res, 404, { error: "No model configuration found in config.yaml" });
    }
  } catch (err) {
    jsonResponse(res, 500, { error: err.message });
  }
}

async function handleSession(req, res) {
  // POST /session — create new or resume
  if (req.method === "POST") {
    let body;
    try {
      body = await readJson(req);
    } catch {
      return jsonResponse(res, 400, { error: "Invalid JSON" });
    }

    const sessionId = cfgString(body.sessionId) || cfgString(body.session_id);
    if (sessionId) {
      jsonResponse(res, 200, { sessionId, action: "resume" });
    } else {
      jsonResponse(res, 200, { action: "create", sessionId: null });
    }
    return;
  }

  jsonResponse(res, 405, { error: "Method not allowed. Use POST /session" });
}

// ---------------------------------------------------------------------------
// CORS preflight
// ---------------------------------------------------------------------------

async function handleCors(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const routes = {
  "/execute": handleExecute,
  "/health": handleHealth,
  "/ready": handleReady,
  "/skills": handleSkills,
  "/model": handleModel,
  "/session": handleSession,
};

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (await handleCors(req, res)) return;

  const url = new URL(req.url, `http://localhost`);
  const handler = routes[url.pathname];

  if (handler) {
    try {
      await handler(req, res, null);
    } catch (err) {
      console.error(`[${req.method} ${url.pathname}] Unhandled error:`, err);
      if (!res.headersSent) {
        jsonResponse(res, 500, { error: "Internal server error" });
      }
    }
  } else {
    jsonResponse(res, 404, {
      error: "Not found",
      available: Object.keys(routes),
      adapter: "hermes-gateway-adapter",
      version: "1.0.0",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[hermes-gateway-adapter] Listening on port ${PORT}`);
  console.log(`[hermes-gateway-adapter] HERMES_HOME=${HERMES_HOME}`);
  console.log(`[hermes-gateway-adapter] HERMES_CLI=${HERMES_CLI}`);
  console.log(`[hermes-gateway-adapter] Endpoints:`);
  console.log(`  POST /execute — Execute Hermes chat prompt`);
  console.log(`  GET  /health  — Liveness check`);
  console.log(`  GET  /ready   — Readiness check`);
  console.log(`  GET  /skills  — List Hermes skills`);
  console.log(`  GET  /model   — Detect model config`);
  console.log(`  POST /session — Session management`);
});

server.on("error", (err) => {
  console.error("[hermes-gateway-adapter] Server error:", err);
  process.exit(1);
});
