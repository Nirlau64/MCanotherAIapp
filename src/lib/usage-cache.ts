/**
 * localStorage cache for session usage data.
 *
 * $sessionUsage is ephemeral (in-memory atom). When the page reloads
 * or the user switches sessions, we need durable storage so the
 * TokenBar can restore the stats for each chat.
 */

import type { UsageData } from "@/lib/store";

const PREFIX = "hermes:usage:";

export function cacheSessionUsage(sessionId: string, usage: UsageData): void {
  try {
    localStorage.setItem(PREFIX + sessionId, JSON.stringify(usage));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function getCachedUsage(sessionId: string): UsageData | null {
  try {
    const raw = localStorage.getItem(PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as UsageData) : null;
  } catch {
    return null;
  }
}
