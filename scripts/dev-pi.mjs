#!/usr/bin/env node
/**
 * dev:pi — starts Vite dev server + Express API server concurrently.
 *
 * Vite (port 5173) proxies /api/* to Express (port 3001).
 * Express provides Pi-compatible HTTP API endpoints.
 *
 * Usage:
 *   npm run dev:pi                       # default ports
 *   PI_BIN=pi VAULT_PATH=/vault npm run dev:pi
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const VITE_PORT = process.env.VITE_PORT || "5173";
const API_PORT = process.env.API_PORT || "3001";
const PI_BIN = process.env.PI_BIN || "pi";
const VAULT_PATH = process.env.VAULT_PATH || `${process.env.HOME}/obsidian-vault/MainVault`;

console.log("╔══════════════════════════════════════╗");
console.log("║   Atlas — Pi Dev Mode               ║");
console.log("╠══════════════════════════════════════╣");
console.log(`║   Vite       → http://localhost:${VITE_PORT.padEnd(5)}  ║`);
console.log(`║   API Server → http://localhost:${API_PORT.padEnd(5)}  ║`);
console.log(`║   Pi binary  → ${PI_BIN.padEnd(20)} ║`);
console.log(`║   Vault      → ${VAULT_PATH.substring(0, 25).padEnd(25)} ║`);
console.log("╚══════════════════════════════════════╝");
console.log("");

// Start Express API server
const api = spawn("node", ["server/index.js"], {
  env: {
    ...process.env,
    PORT: API_PORT,
    PI_BIN,
    VAULT_PATH,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

api.stdout.on("data", (d) => {
  const lines = d.toString().trim().split("\n");
  for (const line of lines) {
    if (line) console.log(`[api]  ${line}`);
  }
});

api.stderr.on("data", (d) => {
  const lines = d.toString().trim().split("\n");
  for (const line of lines) {
    if (line) console.error(`[api]  ${line}`);
  }
});

// Start Vite dev server (proxies /api to Express)
const vite = spawn("npx", ["vite", "--host", "0.0.0.0", "--port", VITE_PORT], {
  env: {
    ...process.env,
    HERMES_DASHBOARD_URL: `http://127.0.0.1:${API_PORT}`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

vite.stdout.on("data", (d) => {
  const lines = d.toString().trim().split("\n");
  for (const line of lines) {
    if (line) console.log(`[vite] ${line}`);
  }
});

vite.stderr.on("data", (d) => {
  const lines = d.toString().trim().split("\n");
  for (const line of lines) {
    if (line) console.error(`[vite] ${line}`);
  }
});

// Shutdown handling
function cleanup() {
  console.log("\nShutting down...");
  api.kill("SIGTERM");
  vite.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

api.on("close", (code) => {
  if (code !== null && code !== 0) {
    console.error(`[api]  exited with code ${code}`);
  }
  vite.kill();
  process.exit(code || 0);
});

vite.on("close", (code) => {
  if (code !== null && code !== 0) {
    console.error(`[vite] exited with code ${code}`);
  }
  api.kill();
  process.exit(code || 0);
});
