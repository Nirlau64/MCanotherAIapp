/**
 * Pi Compatibility Server — provides HTTP API endpoints for Pi users.
 * 
 * Supports both deployment modes:
 * 1. Hermes mode: PWA connects to Hermes Gateway via WebSocket (default)
 * 2. Pi mode: PWA uses HTTP API endpoints proxying to pi CLI
 * 
 * Set HERMES_MODE=pi to enable Pi mode on the frontend.
 */

const express = require("express");
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
app.use(express.json());

const HOME = process.env.HOME || "/home/youruser";
const PI_BIN = process.env.PI_BIN || "pi";
const PI_CONTEXT = process.env.PI_CONTEXT || `${HOME}/.pi/agent/PI-CONTEXT.md`;
const WORK_DIR = process.env.ATLAS_CWD || HOME;
const VAULT_PATH = process.env.VAULT_PATH || path.join(HOME, "obsidian-vault/MainVault");
const AGENT_DIR = path.join(HOME, ".pi/agent");
const SESSIONS_DIR = path.join(AGENT_DIR, "sessions");
const LOGS_DIR = path.join(VAULT_PATH, "_SYSTEM/chat-logs");

// ── Chat (SSE streaming via pi CLI) ──────────────────────────────

app.post("/api/chat", (req, res) => {
  const { message, sessionId, sessionFile, provider, model } = req.body;

  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const args = [
    "-p", "--mode", "json",
    ...(sessionFile ? ["--session", sessionFile] : ["--session-id", sessionId]),
    "--provider", provider || "anthropic",
    "--model", model || "claude-sonnet-4-6",
    "--append-system-prompt", PI_CONTEXT,
  ];

  const child = spawn(PI_BIN, args, {
    cwd: WORK_DIR,
    env: { ...process.env, HOME: WORK_DIR },
  });

  child.stdin.write(message);
  child.stdin.end();

  let buffer = "";

  const emit = (obj) => res.write(JSON.stringify(obj) + "\n");

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let evt;
      try { evt = JSON.parse(line); } catch { continue; }

      const type = evt.type;
      if (type === "message_update") {
        const ame = evt.assistantMessageEvent;
        if (ame?.type === "text_delta") emit({ kind: "text", delta: ame.delta });
        else if (ame?.type === "thinking_delta") emit({ kind: "thinking", delta: ame.delta });
        else if (ame?.type === "thinking_start") emit({ kind: "thinking_start" });
      } else if (type === "tool_execution_start") {
        emit({ kind: "tool_start", tool: evt.toolName, args: evt.args });
      } else if (type === "tool_execution_end") {
        emit({ kind: "tool_end", tool: evt.toolName, isError: evt.isError });
      } else if (type === "message" && evt.message?.role === "assistant" && evt.message.usage) {
        emit({ kind: "usage", usage: evt.message.usage });
      } else if (type === "message_end" || type === "turn_end") {
        const msg = evt.message;
        if (msg?.role === "assistant" && Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === "thinking" && block.thinking) {
              emit({ kind: "thinking_full", content: block.thinking });
            }
          }
        }
      }
    }
  });

  child.on("close", (code) => {
    if (code !== 0) emit({ kind: "error", code });
    emit({ kind: "done" });
    res.end();
  });

  child.on("error", (err) => {
    emit({ kind: "error", message: err.message });
    res.end();
  });
});

// ── Sessions ─────────────────────────────────────────────────────

app.get("/api/sessions", (_req, res) => {
  if (!fs.existsSync(SESSIONS_DIR)) return res.json([]);
  const sessions = [];
  for (const project of fs.readdirSync(SESSIONS_DIR)) {
    const projectDir = path.join(SESSIONS_DIR, project);
    if (!fs.statSync(projectDir).isDirectory()) continue;
    for (const file of fs.readdirSync(projectDir)) {
      if (!file.endsWith(".jsonl")) continue;
      const full = path.join(projectDir, file);
      try {
        const lines = fs.readFileSync(full, "utf-8").split("\n").filter(Boolean);
        let id = file, created = "", cwd = "", model = "";
        let messageCount = 0, preview = "";
        for (const line of lines) {
          const evt = JSON.parse(line);
          if (evt.type === "session") { id = evt.id; created = evt.timestamp; cwd = evt.cwd; }
          else if (evt.type === "model_change") model = `${evt.provider}/${evt.modelId}`;
          else if (evt.type === "message" && evt.message?.role === "user") {
            messageCount++;
            if (!preview) {
              const c = evt.message.content;
              const txt = Array.isArray(c) ? c.find(x => x.type === "text")?.text : c;
              if (txt) preview = String(txt).slice(0, 100);
            }
          }
        }
        sessions.push({ file: full, project, id, created, cwd, model, messageCount, preview });
      } catch {}
    }
  }
  res.json(sessions.sort((a, b) => (b.created || "").localeCompare(a.created || "")));
});

app.get("/api/session", (req, res) => {
  const file = req.query.file;
  if (!file) return res.status(400).json({ error: "file required" });
  const safe = path.resolve(file);
  if (!safe.startsWith(SESSIONS_DIR) || !fs.existsSync(safe)) return res.status(404).json({ error: "Not found" });
  const messages = [];
  const lines = fs.readFileSync(safe, "utf-8").split("\n").filter(Boolean);
  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (evt.type !== "message" || !evt.message) continue;
      const text = typeof evt.message.content === "string"
        ? evt.message.content
        : (Array.isArray(evt.message.content) ? evt.message.content.filter(x => x.type === "text").map(x => x.text).join("") : "");
      if (text.trim()) messages.push({ role: evt.message.role, content: text });
    } catch {}
  }
  res.json({ messages });
});

// ── Status ─────────────────────────────────────────────────────

app.get("/api/status", (_req, res) => {
  let auth = {};
  try { auth = JSON.parse(fs.readFileSync(path.join(AGENT_DIR, "auth.json"), "utf-8")); } catch {}
  let models = {};
  try { models = JSON.parse(fs.readFileSync(path.join(AGENT_DIR, "models.json"), "utf-8")); } catch {}

  const providers = [];
  if (auth.anthropic) {
    const exp = auth.anthropic.expires || 0;
    providers.push({ name: "Anthropic", status: Date.now() < exp ? "ok" : "expired", detail: `OAuth, expires ${new Date(exp).toLocaleString("de-DE")}` });
  } else {
    providers.push({ name: "Anthropic", status: "missing", detail: "No auth" });
  }
  providers.push(auth.zai ? { name: "ZAI", status: "ok", detail: "API Key" } : { name: "ZAI", status: "missing", detail: "No auth" });
  providers.push(models.providers?.deepseek?.apiKey ? { name: "DeepSeek", status: "ok", detail: "API Key" } : { name: "DeepSeek", status: "missing", detail: "No key" });

  let piVersion = "unknown";
  try {
    const pkg = JSON.parse(fs.readFileSync("/usr/lib/node_modules/@earendil-works/pi-coding-agent/package.json", "utf-8"));
    piVersion = pkg.version;
  } catch {}

  res.json({
    piVersion,
    providers,
    defaultModel: "claude-sonnet-4-6",
  });
});

// ── Monitor (system stats) ──────────────────────────────────────

app.get("/api/monitor", (_req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  let swapTotal = 0, swapFree = 0;
  try {
    const mi = fs.readFileSync("/proc/meminfo", "utf-8");
    const st = mi.match(/SwapTotal:\s+(\d+)/);
    const sf = mi.match(/SwapFree:\s+(\d+)/);
    if (st) swapTotal = +st[1] * 1024;
    if (sf) swapFree = +sf[1] * 1024;
  } catch {}

  let ip = "";
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const n of ifaces || []) {
      if (n.family === "IPv4" && !n.internal) { ip = n.address; break; }
    }
    if (ip) break;
  }

  function exec(cmd, timeout = 5000) {
    try { return execSync(cmd, { timeout, encoding: "utf-8" }).trim(); } catch { return ""; }
  }

  // CPU temp
  let cpuTemp = null;
  try { cpuTemp = parseInt(fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf-8").trim(), 10) / 1000; } catch {}

  // CPU usage (short sample)
  let cpuUsage = -1;
  try {
    const read = () => fs.readFileSync("/proc/stat", "utf-8").split("\n")[0].split(/\s+/).slice(1).map(Number);
    const t1 = read();
    execSync("sleep 0.1");
    const t2 = read();
    const idle1 = t1[3] + t1[4], total1 = t1.reduce((a, b) => a + b, 0);
    const idle2 = t2[3] + t2[4], total2 = t2.reduce((a, b) => a + b, 0);
    cpuUsage = total2 - total1 > 0 ? Math.round(100 * (1 - (idle2 - idle1) / (total2 - total1))) : 0;
  } catch {}

  // Docker
  let docker = { available: false, containers: [], running: 0, stopped: 0 };
  try {
    const out = exec("docker ps -a --format '{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}|{{.Ports}}'", 10000);
    if (out) {
      const containers = out.split("\n").filter(Boolean).map(line => {
        const [name, image, state, status, ports] = line.split("|");
        return { name, image, state, status, ports: ports || "–" };
      });
      docker = { available: true, containers, running: containers.filter(c => c.state === "running").length, stopped: containers.length - containers.filter(c => c.state === "running").length };
    }
  } catch {}

  // Disks
  let disks = [];
  try {
    const out = exec("df -B1 --output=source,target,fstype,size,used,avail,pcent -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null");
    if (out) {
      disks = out.split("\n").slice(1).map(line => {
        const p = line.trim().split(/\s+/);
        if (p.length < 7) return null;
        return { device: p[0], mount: p[1], fstype: p[2], total: +p[3], used: +p[4], available: +p[5], percent: parseInt(p[6]) || 0 };
      }).filter(Boolean);
    }
  } catch {}

  // Top processes
  let topProcesses = [];
  try {
    const out = exec("ps aux --sort=-%mem | head -9");
    if (out) {
      topProcesses = out.split("\n").slice(1).map(line => {
        const p = line.trim().split(/\s+/);
        if (p.length < 11) return null;
        return { pid: +p[1], cpu: +p[2], mem: +p[3], rss: Math.round(+p[5] / 1024), command: p.slice(10).join(" ").slice(0, 80) };
      }).filter(Boolean);
    }
  } catch {}

  res.json({
    hostname: os.hostname(),
    ip,
    uptime: os.uptime(),
    loadAvg: os.loadavg(),
    cpu: { cores: cpus.length, model: cpus[0]?.model || "Unknown", temp: cpuTemp, usage: cpuUsage, throttled: null },
    memory: { total: totalMem, used: totalMem - freeMem, available: freeMem, percent: Math.round(((totalMem - freeMem) / totalMem) * 100), swapTotal, swapUsed: swapTotal - swapFree },
    disks,
    docker,
    nas: { host: process.env.NAS_IP || "192.168.1.100", cachedAt: null, reachable: false, model: null, uptime: null, raidType: null, disks: [], nasDisks: [], backup: { lastRun: null, status: "unknown", details: [] } },
    topProcesses,
  });
});

// ── Models ──────────────────────────────────────────────────────

const MODELS_PATH = process.env.ATLAS_MODELS_PATH || path.join(AGENT_DIR, "atlas-web-models.json");

app.get("/api/models", (_req, res) => {
  try { return res.json(JSON.parse(fs.readFileSync(MODELS_PATH, "utf-8"))); } catch {}
  res.json([
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" },
    { id: "claude-opus-4-7", name: "Claude Opus 4.7", provider: "anthropic" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "deepseek" },
  ]);
});

app.post("/api/models", (req, res) => {
  const { id, name, provider } = req.body;
  if (!id || !provider) return res.status(400).json({ ok: false, error: "id and provider required" });
  let models = [];
  try { models = JSON.parse(fs.readFileSync(MODELS_PATH, "utf-8")); } catch {}
  if (models.some(m => m.id === id && m.provider === provider)) return res.json({ ok: false, error: "Already exists" });
  models.push({ id, name: name || id, provider });
  fs.writeFileSync(MODELS_PATH, JSON.stringify(models, null, 2));
  res.json({ ok: true });
});

app.delete("/api/models", (req, res) => {
  const { provider, id } = req.query;
  let models = [];
  try { models = JSON.parse(fs.readFileSync(MODELS_PATH, "utf-8")); } catch {}
  models = models.filter(m => !(m.id === id && m.provider === provider));
  fs.writeFileSync(MODELS_PATH, JSON.stringify(models, null, 2));
  res.json({ ok: true });
});

// ── Wiki ────────────────────────────────────────────────────────

const ALLOWED_DIRS = ["WIKI", "_SOURCES/notes", "_SYSTEM"];

function isWikiAllowed(absPath) {
  const rel = path.relative(VAULT_PATH, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return ALLOWED_DIRS.some(d => rel === d || rel.startsWith(d + "/"));
}

app.get("/api/wiki", (req, res) => {
  const { tree, path: filePath, search } = req.query;

  if (search) {
    const q = search.toLowerCase();
    const hits = [];
    function walk(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const abs = path.join(dir, entry.name);
        if (!isWikiAllowed(abs)) continue;
        if (entry.isDirectory()) walk(abs);
        else if (entry.name.endsWith(".md")) {
          try {
            const content = fs.readFileSync(abs, "utf-8");
            const lower = content.toLowerCase();
            const count = lower.split(q).length - 1;
            if (count > 0 || entry.name.toLowerCase().includes(q)) {
              const idx = lower.indexOf(q);
              hits.push({
                path: path.relative(VAULT_PATH, abs),
                title: entry.name.replace(/\.md$/, ""),
                snippet: idx >= 0 ? content.slice(Math.max(0, idx - 60), idx + q.length + 80).replace(/\n/g, " ") : "",
                score: count + (entry.name.toLowerCase().includes(q) ? 15 : 0),
              });
            }
          } catch {}
        }
      }
    }
    for (const d of ALLOWED_DIRS) walk(path.join(VAULT_PATH, d));
    hits.sort((a, b) => b.score - a.score);
    return res.json({ hits: hits.slice(0, 50) });
  }

  if (tree !== undefined) {
    const base = path.resolve(VAULT_PATH, tree || "");
    if (!base.startsWith(VAULT_PATH)) return res.status(403).json({ error: "Forbidden" });
    if (!fs.existsSync(base)) return res.status(404).json({ error: "Not found" });
    const entries = [];
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = path.join(base, entry.name);
      if (!isWikiAllowed(abs)) continue;
      if (entry.isDirectory()) entries.push({ name: entry.name, type: "dir", path: path.relative(VAULT_PATH, abs) });
      else if (entry.name.endsWith(".md")) entries.push({ name: entry.name, type: "file", path: path.relative(VAULT_PATH, abs) });
    }
    entries.sort((a, b) => { if (a.type !== b.type) return a.type === "dir" ? -1 : 1; return a.name.localeCompare(b.name); });
    return res.json({ entries });
  }

  if (filePath) {
    const abs = path.resolve(VAULT_PATH, filePath);
    if (!abs.startsWith(VAULT_PATH) || !isWikiAllowed(abs)) return res.status(403).json({ error: "Forbidden" });
    if (!fs.existsSync(abs)) return res.status(404).json({ error: "Not found" });
    const content = fs.readFileSync(abs, "utf-8");
    const stat = fs.statSync(abs);
    return res.json({ content, mtime: stat.mtime.toISOString(), size: stat.size });
  }

  // Default: root tree
  const entries = [];
  if (fs.existsSync(VAULT_PATH)) {
    for (const entry of fs.readdirSync(VAULT_PATH, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = path.join(VAULT_PATH, entry.name);
      if (!isWikiAllowed(abs)) continue;
      if (entry.isDirectory()) entries.push({ name: entry.name, type: "dir", path: entry.name });
      else if (entry.name.endsWith(".md")) entries.push({ name: entry.name, type: "file", path: entry.name });
    }
  }
  entries.sort((a, b) => { if (a.type !== b.type) return a.type === "dir" ? -1 : 1; return a.name.localeCompare(b.name); });
  res.json({ entries });
});

app.put("/api/wiki", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: "path required" });
  const abs = path.resolve(VAULT_PATH, filePath);
  if (!abs.startsWith(VAULT_PATH) || !isWikiAllowed(abs)) return res.status(403).json({ error: "Forbidden" });
  if (!fs.existsSync(abs)) return res.status(404).json({ error: "Not found" });
  const { content } = req.body;
  if (typeof content !== "string") return res.status(400).json({ error: "content must be string" });
  fs.writeFileSync(abs, content, "utf-8");
  const stat = fs.statSync(abs);
  res.json({ ok: true, mtime: stat.mtime.toISOString(), size: stat.size });
});

// ── Static files (skipped in API_ONLY dev mode) ─────────────────

const API_ONLY = process.env.API_ONLY === "1" || process.env.NODE_ENV === "development";

if (!API_ONLY) {
  const distPath = path.join(__dirname, "..", "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
    console.log(`Static: serving ${distPath}`);
  } else {
    console.log("Static: dist/ not found — run 'npm run build' first for production mode");
    console.log("Static: API-only mode (use 'npm run dev:pi' for development)");
  }
} else {
  console.log("Static: skipped (API_ONLY / development mode)");
}

// ── Start ───────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Atlas server running on http://0.0.0.0:${PORT}`);
  console.log(`Pi binary: ${PI_BIN}`);
  console.log(`Work dir: ${WORK_DIR}`);
  console.log(`Vault:    ${VAULT_PATH}`);
  if (API_ONLY) console.log(`Mode:     API-only (dev)`);
});
