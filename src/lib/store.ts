/**
 * Hermes Chat PWA — Nanostores state
 */

import { atom, computed } from "nanostores";
import type { GatewayClient, ConnectionState } from "@/lib/gateway";

export const $gateway = atom<GatewayClient | null>(null);
export const $gwState = atom<ConnectionState>("idle");

export interface SessionMeta {
  id: string;
  title: string;
  started_at: number;
  updated_at?: string;
  last_active?: number;
  model?: string;
  message_count?: number;
  preview?: string;
  source?: string;
}

export const $sessions = atom<SessionMeta[]>([]);
export const $activeSessionId = atom<string | null>(null);
/** Persistent (storage) session ID — stable across resumes. Used for localStorage keys. */
export const $activePersistentId = atom<string | null>(null);

export const $sessionGroups = computed($sessions, (sessions) => {
  const now = new Date();
  const today: SessionMeta[] = [];
  const yesterday: SessionMeta[] = [];
  const thisWeek: SessionMeta[] = [];
  const older: SessionMeta[] = [];

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 86400000);

  for (const s of sessions) {
    // Group by last_active (or fall back to started_at if unavailable/zero)
    const activityTs = (s.last_active || s.started_at) * 1000;
    const d = new Date(activityTs);
    if (d >= startOfToday) today.push(s);
    else if (d >= startOfYesterday) yesterday.push(s);
    else if (d >= startOfWeek) thisWeek.push(s);
    else older.push(s);
  }

  return [
    { label: "Today", sessions: today },
    { label: "Yesterday", sessions: yesterday },
    { label: "This Week", sessions: thisWeek },
    { label: "Older", sessions: older },
  ].filter((g) => g.sessions.length > 0);
});

/** Token usage + cost as reported by the gateway per message.complete */
export interface UsageData {
  model: string;
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  reasoning: number;
  total: number;
  /** Number of API calls this turn */
  calls: number;
  /** Context window: used / max / percent */
  context_used: number;
  context_max: number;
  context_percent: number;
  /** Cost estimation (USD). Only present when gateway has pricing data. */
  cost_status?: string;
  cost_usd?: number;
  /** Per-message delta (computed client-side, not from gateway) */
  delta_input?: number;
  delta_output?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  timestamp: string;
  streaming?: boolean;
  toolCalls?: ToolCall[];
  /** For tool messages: the tool name and context (summary) */
  toolName?: string;
  toolContext?: string;
  usage?: UsageData;
  /** Thinking/reasoning text from the model (collapsible in UI) */
  thinking?: string;
}

export interface ToolCall {
  id: string;
  tool: string;
  status: "running" | "done" | "error";
  output?: string;
  durationMs?: number;
  tokens?: number;
}

export const $messages = atom<ChatMessage[]>([]);
export const $sidebarOpen = atom(false);
export const $toolPanelOpen = atom(false);
export const $activeTools = atom<ToolCall[]>([]);

/** Cumulative session token usage — updated on each message.complete.
 *  Used by TokenBar for session-level display and by ChatView for deltas. */
export const $sessionUsage = atom<UsageData | null>(null);

export const $activeSession = computed(
  [$sessions, $activeSessionId],
  (sessions, id) => sessions.find((s) => s.id === id) ?? null,
);
