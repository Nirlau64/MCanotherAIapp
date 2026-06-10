import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import {
  $gateway,
  $gwState,
  $sessions,
  $messages,
  $activeSessionId,
  $activeTools,
  $sessionUsage,
  $activePersistentId,
  type SessionMeta,
  type ChatMessage,
  type UsageData,
} from "@/lib/store";
import { GatewayClient } from "@/lib/gateway";
import type { GatewayEvent } from "@/lib/gateway";
import { getCachedUsage } from "@/lib/usage-cache";
import { indexMessage, deleteSessionMessages } from "@/lib/db";

let _gw: GatewayClient | null = null;

function getOrCreateGw(): GatewayClient {
  if (!_gw) {
    _gw = new GatewayClient();
    _gw.onState((s) => $gwState.set(s));
    _gw.on("status.update", (_ev: GatewayEvent) => {});
    _gw.on("error", (ev: GatewayEvent) => {
      console.error("[Gateway]", ev.payload);
    });
  }
  return _gw;
}

/** Hook: initialise gateway connection on mount. */
export function useGateway() {
  const gwState = useStore($gwState);

  useEffect(() => {
    const gw = getOrCreateGw();
    $gateway.set(gw);

    if (gw.state === "idle" || gw.state === "closed") {
      gw.connect().catch((err) => {
        console.error("[Gateway] connect failed:", err);
      });
    }
  }, []);

  return { gwState };
}

/** Hook: fetch sessions list from gateway. */
export function useSessions() {
  const sessions = useStore($sessions);
  const gwState = useStore($gwState);

  const refresh = async () => {
    const gw = $gateway.get();
    if (!gw || gw.state !== "open") return;
    try {
      const res = await gw.request<{ sessions: SessionMeta[] }>(
        "session.list",
        { limit: 100 },
      );
      const raw = res.sessions ?? [];
      $sessions.set(raw);
    } catch (err) {
      console.error("[Sessions] fetch failed:", err);
    }
  };

  useEffect(() => {
    if (gwState === "open") refresh();
  }, [gwState]);

  return { sessions, refresh };
}

/** Hook: active session ID + resume with history loading. */
export function useActiveSession() {
  const activeId = useStore($activeSessionId);
  const sessions = useStore($sessions);

  const activate = async (id: string) => {
    const gw = $gateway.get();
    if (!gw || gw.state !== "open") return;
    try {
      // Reset tool state before switching
      $activeTools.set([]);
      $activePersistentId.set(id);

      const res = await gw.request<{ session_id: string; messages?: unknown[] }>(
        "session.resume",
        { session_id: id },
      );
      const runtimeId = res.session_id;
      $activeSessionId.set(runtimeId);
      
      if (res.messages && Array.isArray(res.messages)) {
        let lastUsage: UsageData | null = null;
        const msgs = (res.messages as Record<string, unknown>[])
          .filter((m: Record<string, unknown>) => {
            // Skip empty assistant messages (tool call placeholders without text)
            const role = m.role as string;
            if (role === "assistant" && !(m.text as string)?.trim() && !(m.toolCalls)) return false;
            return true;
          })
          .map(
          (m: Record<string, unknown>, i: number) => {
            const role = (m.role as string) ?? "system";
            const rawUsage = m.usage as UsageData | undefined;
            const msg: ChatMessage = {
              id: `hist-${i}`,
              role: (role === "tool" ? "tool" : role as "user" | "assistant" | "system"),
              text: (m.text as string) ?? (m.context as string) ?? "",
              timestamp: new Date().toISOString(),
              usage: rawUsage, // Preserve per-message usage from history
            };
            // Track last cumulative usage for session stats
            if (rawUsage?.total) lastUsage = rawUsage;
            // Map tool-specific fields
            if (role === "tool") {
              msg.toolName = (m.name as string) ?? "unknown";
              msg.toolContext = (m.context as string) ?? "";
              msg.text = ""; // Tool messages don't have display text
            }
            return msg;
          },
        );
        $messages.set(msgs);
        // Index history messages for full-text search
        for (const m of msgs) {
          // Skip tool messages with empty text
          if (m.text) {
            void indexMessage({
              id: m.id,
              sessionId: id, // Use persistent ID so deleteSessionMessages can find them
              role: m.role,
              text: m.text,
              timestamp: m.timestamp,
            });
          }
        }
        // Restore session usage: last history message first, localStorage fallback
        $sessionUsage.set(lastUsage ?? getCachedUsage(id));
      } else {
        $messages.set([]);
        $sessionUsage.set(getCachedUsage(id));
      }
    } catch (err) {
      console.error("[Session] resume failed:", err);
    }
  };

  const create = async () => {
    const gw = $gateway.get();
    if (!gw || gw.state !== "open") return;
    try {
      const res = await gw.request<{ session_id: string }>("session.create");
      $activeSessionId.set(res.session_id);
      $activePersistentId.set(res.session_id);
      $messages.set([]);
      $activeTools.set([]);
      $sessionUsage.set(null);
      const list = await gw.request<{ sessions: SessionMeta[] }>(
        "session.list",
        { limit: 100 },
      );
      $sessions.set(list.sessions ?? []);
    } catch (err) {
      console.error("[Session] create failed:", err);
    }
  };

  const rename = async (id: string, title: string) => {
    const gw = $gateway.get();
    if (!gw || gw.state !== "open") return;
    try {
      await gw.request("session.rename", { session_id: id, title });
      $sessions.set(
        $sessions.get().map((s) => (s.id === id ? { ...s, title } : s)),
      );
    } catch (err) {
      console.error("[Session] rename failed:", err);
    }
  };

  const remove = async (id: string) => {
    const gw = $gateway.get();
    if (!gw || gw.state !== "open") return;
    try {
      await gw.request("session.delete", { session_id: id });
      $sessions.set($sessions.get().filter((s) => s.id !== id));
      // Clean up IndexedDB search index
      void deleteSessionMessages(id);
      if ($activeSessionId.get() === id) {
        $activeSessionId.set(null);
        $messages.set([]);
        $activeTools.set([]);
        $sessionUsage.set(null);
      }
    } catch (err) {
      console.error("[Session] delete failed:", err);
    }
  };

  return { activeId, activate, create, rename, remove, sessions };
}
