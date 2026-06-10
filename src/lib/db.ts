/**
 * IndexedDB layer for full-text search of chat messages.
 * Uses the `idb` library for ergonomic async access.
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "hermes-chat-pwa";
const DB_VERSION = 1;

export interface IndexedMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  timestamp: string;
  /** Set automatically by indexMessage — don't pass manually */
  textLower?: string;
}

let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;

  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("messages", { keyPath: "id" });
      store.createIndex("by-session", "sessionId");
      store.createIndex("by-text", "textLower");
    },
  });

  return _db;
}

/** Index a message in the search DB. Safe to call multiple times (put = upsert). */
export async function indexMessage(msg: IndexedMessage) {
  const db = await getDB();
  await db.put("messages", { ...msg, textLower: msg.text.toLowerCase() });
}

/** Delete all messages for a session (e.g. when session is deleted). */
export async function deleteSessionMessages(sessionId: string) {
  const db = await getDB();
  const tx = db.transaction("messages", "readwrite");
  const index = tx.store.index("by-session");
  let cursor = await index.openCursor(IDBKeyRange.only(sessionId));
  while (cursor) {
    cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

// ── Search ────────────────────────────────────────────

export interface SearchResult {
  message: IndexedMessage;
  /** Snippet of matching text with context */
  snippet: string;
}

/** Full-text search across all indexed messages. */
export async function searchMessages(
  query: string,
  limit = 20,
): Promise<SearchResult[]> {
  const db = await getDB();
  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // Walk all messages, filter client-side (IndexedDB doesn't have FTS)
  const tx = db.transaction("messages", "readonly");
  let cursor = await tx.store.openCursor();

  while (cursor) {
    const msg = cursor.value as IndexedMessage;
    const idx = (msg.textLower ?? "").indexOf(q);
    if (idx >= 0 && !seen.has(msg.id)) {
      seen.add(msg.id);

      // Extract snippet (±40 chars around match)
      const start = Math.max(0, idx - 40);
      const end = Math.min(msg.text.length, idx + q.length + 40);
      let snippet = msg.text.slice(start, end);
      if (start > 0) snippet = "…" + snippet;
      if (end < msg.text.length) snippet = snippet + "…";

      results.push({ message: msg, snippet });
      if (results.length >= limit) break;
    }
    cursor = await cursor.continue();
  }

  await tx.done;
  return results;
}

/** Get total indexed message count. */
export async function getMessageCount(): Promise<number> {
  const db = await getDB();
  return db.count("messages");
}
