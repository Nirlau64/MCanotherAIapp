import { useEffect, useRef, useState, useCallback } from "react";
import { $gateway, $messages, $activeTools, $sessionUsage, type ChatMessage, type UsageData } from "@/lib/store";
import type { GatewayEvent } from "@/lib/gateway";
import { MessageBubble } from "./MessageBubble";
import { StreamingMessage } from "./StreamingMessage";
import { ToolCallGroup, type ToolCallData } from "./ToolCallBubble";
import { ChatInput } from "./ChatInput";
import { ThinkingBlock } from "./ThinkingBlock";
import { TokenBar } from "./TokenBar";
import { indexMessage } from "@/lib/db";
import { cacheSessionUsage } from "@/lib/usage-cache";
import { PromptRequestBubble, type PromptRequest } from "./PromptRequestBubble";

interface Props { sessionId: string; persistentId?: string; }

export function ChatView({ sessionId, persistentId }: Props) {
  const [allMsgs, setAllMsgs] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [inlineTools, setInlineTools] = useState<ToolCallData[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track previous usage for per-message delta computation
  const prevUsageRef = useRef<UsageData | null>(null);
  // Ref for streamingText to avoid stale closures without re-subscribing
  const streamingTextRef = useRef("");
  // Ref for thinkingText to capture final value in message.complete
  const thinkingTextRef = useRef("");

  // Active prompt request (clarify / approval / sudo / secret)
  const [promptRequest, setPromptRequest] = useState<PromptRequest | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const unsub = $messages.subscribe((msgs) => setAllMsgs([...msgs]));
    return unsub;
  }, []);

  useEffect(() => { scrollToBottom(); }, [allMsgs, streamingText, inlineTools, scrollToBottom]);

  // ── Reset streaming state on session change ──────────

  useEffect(() => {
    setIsStreaming(false);
    setStreamingText("");
    streamingTextRef.current = "";
    setThinkingText("");
    thinkingTextRef.current = "";
    setInlineTools([]);
    $activeTools.set([]);
    setPromptRequest(null);
  }, [sessionId]);

  // ── Gateway event subscriptions ────────────────────

  useEffect(() => {
    const gw = $gateway.get();
    if (!gw) return;
    const unsubs: (() => void)[] = [];

    // Reset on new message
    unsubs.push(gw.on("message.start", (ev: GatewayEvent) => {
      if (ev.session_id !== sessionId) return;
      setIsStreaming(true);
      setStreamingText("");
      streamingTextRef.current = "";
      setThinkingText("");
      thinkingTextRef.current = "";
      setInlineTools([]);
      $activeTools.set([]);
      // Snapshot current usage for next delta computation
      prevUsageRef.current = $sessionUsage.get();
    }));

    // Streaming deltas
    unsubs.push(gw.on("message.delta", (ev: GatewayEvent) => {
      if (ev.session_id !== sessionId) return;
      setStreamingText((prev) => {
        const next = prev + ((ev.payload as { text?: string })?.text ?? "");
        streamingTextRef.current = next;
        return next;
      });
    }));

    unsubs.push(gw.on("thinking.delta", (ev: GatewayEvent) => {
      if (ev.session_id !== sessionId) return;
      setThinkingText((prev) => {
        const next = prev + ((ev.payload as { text?: string })?.text ?? "");
        thinkingTextRef.current = next;
        return next;
      });
    }));

    // Message complete — capture usage for token tracking
    unsubs.push(gw.on("message.complete", (ev: GatewayEvent) => {
      if (ev.session_id !== sessionId) return;
      const text = (ev.payload as { text?: string })?.text ?? streamingTextRef.current;
      const rawUsage = (ev.payload as { usage?: UsageData })?.usage;

      // Compute per-message delta from cumulative session totals
      const prev = prevUsageRef.current;
      const usage: UsageData | undefined = rawUsage
        ? {
            ...rawUsage,
            delta_input: prev ? Math.max(0, rawUsage.input - prev.input) : rawUsage.input,
            delta_output: prev ? Math.max(0, rawUsage.output - prev.output) : rawUsage.output,
          }
        : undefined;

      prevUsageRef.current = rawUsage ?? null;
      if (rawUsage) {
        $sessionUsage.set(rawUsage);
        cacheSessionUsage(persistentId ?? sessionId, rawUsage);
      }

      const msgId = `msg-${Date.now()}`;
      // Capture thinking text before resetting
      const finalThinking = thinkingTextRef.current;

      $messages.set([...$messages.get(), {
        id: msgId,
        role: "assistant",
        text,
        timestamp: new Date().toISOString(),
        usage,
        thinking: finalThinking || undefined,
      }]);
      // Index for full-text search
      indexMessage({ id: msgId, sessionId: persistentId || sessionId, role: "assistant", text, timestamp: new Date().toISOString() });
      setIsStreaming(false);
      setStreamingText("");
      streamingTextRef.current = "";
      setThinkingText("");
    }));

    // ── Inline Tool Calls ──────────────────────────────

    unsubs.push(gw.on("tool.start", (ev: GatewayEvent) => {
      if (ev.session_id !== sessionId) return;
      const p = ev.payload as { tool_id?: string; name?: string; args?: unknown };
      const toolEntry: ToolCallData = {
        id: p?.tool_id ?? `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tool: p?.name ?? "unknown",
        status: "running",
        args: p?.args,
      };
      setInlineTools((prev) => [...prev, toolEntry]);
      // Also update side panel
      $activeTools.set([...$activeTools.get(), { id: toolEntry.id, tool: p?.name ?? "unknown", status: "running" }]);
    }));

    unsubs.push(gw.on("tool.generating", (ev: GatewayEvent) => {
      if (ev.session_id !== sessionId) return;
      // tool.generating is a progress heartbeat — tool remains running
    }));

    unsubs.push(gw.on("tool.complete", (ev: GatewayEvent) => {
      if (ev.session_id !== sessionId) return;
      const p = ev.payload as {
        tool_id?: string; name?: string; result?: unknown;
        duration_s?: number; tokens?: number;
      };
      setInlineTools((prev) =>
        prev.map((t) =>
          (p?.tool_id ? t.id === p.tool_id : t.tool === p?.name && t.status === "running")
            ? {
                ...t,
                status: "done" as const,
                output: p?.result != null ? (typeof p.result === "string" ? p.result : JSON.stringify(p.result, null, 2)) : undefined,
                durationMs: (p?.duration_s ?? 0) * 1000,
                tokens: p?.tokens,
              }
            : t,
        ),
      );
      $activeTools.set($activeTools.get().map((t) =>
        (p?.tool_id ? t.id === p.tool_id : t.tool === p?.name && t.status === "running")
          ? { ...t, status: "done", output: p?.result != null ? (typeof p.result === "string" ? p.result : JSON.stringify(p.result, null, 2)) : undefined, durationMs: (p?.duration_s ?? 0) * 1000, tokens: p?.tokens }
          : t,
      ));
    }));

    // ── Tool Error ──────────────────────────────────

    unsubs.push(gw.on("tool.error", (ev: GatewayEvent) => {
      if (ev.session_id !== sessionId) return;
      const p = ev.payload as {
        tool_id?: string; name?: string; error?: string;
        duration_s?: number;
      };
      setInlineTools((prev) =>
        prev.map((t) =>
          (p?.tool_id ? t.id === p.tool_id : t.tool === p?.name && t.status === "running")
            ? {
                ...t,
                status: "error" as const,
                output: p?.error ?? "Unknown error",
                durationMs: (p?.duration_s ?? 0) * 1000,
              }
            : t,
        ),
      );
      $activeTools.set($activeTools.get().map((t) =>
        (p?.tool_id ? t.id === p.tool_id : t.tool === p?.name && t.status === "running")
          ? { ...t, status: "error", output: p?.error ?? "Unknown error", durationMs: (p?.duration_s ?? 0) * 1000 }
          : t,
      ));
    }));

    // ── Prompt Requests (clarify / approval / sudo / secret) ──

    const promptTypes = ["clarify", "approval", "sudo", "secret"] as const;
    for (const type of promptTypes) {
      unsubs.push(gw.on(`${type}.request` as never, (ev: GatewayEvent) => {
        if (ev.session_id !== sessionId) return;
        const p = ev.payload as {
          question?: string;
          prompt?: string;
          choices?: string[];
          env_var?: string;
          request_id?: string;
        };
        setPromptRequest({
          id: `pr-${Date.now()}`,
          type,
          question: p?.question,
          prompt: p?.prompt,
          choices: p?.choices,
          envVar: p?.env_var,
          requestId: p?.request_id ?? "",
        });
      }));
    }

    return () => unsubs.forEach((u) => u());
  }, [sessionId]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages + Inline Tool Calls */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {allMsgs.length === 0 && !isStreaming && inlineTools.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            <div className="text-center">
              <p>Send a message to start.</p>
              <p className="text-xs mt-1 text-slate-600">
                Markdown supported — try tables, code blocks, lists.
              </p>
            </div>
          </div>
        )}

        {allMsgs.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Inline tool calls grouped */}
        <ToolCallGroup tools={inlineTools} />

        {/* Thinking block — collapsible during streaming */}
        {thinkingText && (
          <div className="px-4">
            <ThinkingBlock thinking={thinkingText} defaultOpen />
          </div>
        )}

        {/* Streaming message */}
        {isStreaming && <StreamingMessage text={streamingText} thinkingText={thinkingText} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Active prompt request (clarify / approval / sudo / secret) */}
      {promptRequest && (
        <div className="shrink-0 border-t border-indigo-800/30 bg-indigo-950/20">
          <PromptRequestBubble
            request={promptRequest}
            gateway={$gateway.get()!}
            onResolve={() => setPromptRequest(null)}
          />
        </div>
      )}

      <TokenBar />

      <ChatInput sessionId={sessionId} persistentId={persistentId} disabled={isStreaming} />
    </div>
  );
}
