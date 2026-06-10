/**
 * PromptRequest — renders clarify/approval/sudo/secret prompts from the agent.
 *
 * The gateway emits these events while the agent is waiting for user input:
 *   clarify.request  → { question, choices?, request_id }
 *   approval.request → { prompt, request_id }
 *   sudo.request     → { request_id }
 *   secret.request   → { prompt, env_var, request_id }
 *
 * Response: gw.request("{type}.respond", { request_id, answer/choice/password/value })
 */

import { useState, useCallback } from "react";
import type { GatewayClient } from "@/lib/gateway";
import { HelpCircle, Shield, Key, CheckCircle, X } from "lucide-react";

// ── Types ────────────────────────────────────────────

export interface PromptRequest {
  id: string;
  type: "clarify" | "approval" | "sudo" | "secret";
  question?: string;
  prompt?: string;
  choices?: string[];
  envVar?: string;
  requestId: string;
}

// ── Main Component ────────────────────────────────────

interface Props {
  request: PromptRequest;
  gateway: GatewayClient;
  onResolve: () => void;
}

export function PromptRequestBubble({ request, gateway, onResolve }: Props) {
  const [customAnswer, setCustomAnswer] = useState("");
  const [sending, setSending] = useState(false);

  const respond = useCallback(
    async (answer: string) => {
      setSending(true);
      try {
        const method = `${request.type}.respond` as const;
        const key =
          request.type === "clarify" ? "answer" :
          request.type === "sudo" ? "password" :
          request.type === "secret" ? "value" :
          "choice"; // approval
        await gateway.request(method, {
          request_id: request.requestId,
          [key]: answer,
        });
      } catch (err) {
        console.error(`[PromptRequest] ${request.type}.respond failed:`, err);
      } finally {
        setSending(false);
        onResolve();
      }
    },
    [request, gateway, onResolve],
  );

  const handleCustomSubmit = () => {
    const trimmed = customAnswer.trim();
    if (trimmed) respond(trimmed);
  };

  const icon = request.type === "clarify"
    ? <HelpCircle size={16} className="text-indigo-400" />
    : request.type === "approval"
      ? <CheckCircle size={16} className="text-emerald-400" />
      : request.type === "sudo"
        ? <Shield size={16} className="text-amber-400" />
        : <Key size={16} className="text-red-400" />;

  const label = request.type === "clarify"
    ? "Clarification needed"
    : request.type === "approval"
      ? "Approval required"
      : request.type === "sudo"
        ? "Sudo password required"
        : "Secret required";

  return (
    <div className="flex justify-start px-4">
      <div className="max-w-[85%] rounded-2xl bg-slate-800/80 border border-slate-700 overflow-hidden text-sm">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/50 bg-slate-800/50">
          {icon}
          <span className="font-medium text-slate-300">{label}</span>
          <span className="flex-1" />
          <button
            onClick={() => respond("")}
            className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-2">
          {/* Question text */}
          {(request.question || request.prompt) && (
            <p className="text-slate-200 text-sm leading-relaxed">
              {request.question || request.prompt}
            </p>
          )}

          {/* Choices (clarify with options) */}
          {request.choices && request.choices.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {request.choices.map((choice) => (
                <button
                  key={choice}
                  onClick={() => respond(choice)}
                  disabled={sending}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40
                             border border-indigo-700/50 text-indigo-300 text-xs font-medium
                             transition-colors disabled:opacity-50"
                >
                  {choice}
                </button>
              ))}
            </div>
          )}

          {/* Custom answer input (always shown for open-ended clarify, optional for others) */}
          {request.type === "clarify" && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customAnswer}
                onChange={(e) => setCustomAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                placeholder={request.choices?.length ? "Or type a custom answer..." : "Type your answer..."}
                disabled={sending}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5
                           text-sm text-slate-200 placeholder:text-slate-600 outline-none
                           focus:border-indigo-600 disabled:opacity-50"
                autoFocus={!request.choices?.length}
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customAnswer.trim() || sending}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500
                           text-white text-xs font-medium transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                Send
              </button>
            </div>
          )}

          {/* Sudo password input */}
          {request.type === "sudo" && (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={customAnswer}
                onChange={(e) => setCustomAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                placeholder="Enter sudo password..."
                disabled={sending}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5
                           text-sm text-slate-200 placeholder:text-slate-600 outline-none
                           focus:border-amber-600 disabled:opacity-50"
                autoFocus
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customAnswer.trim() || sending}
                className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500
                           text-white text-xs font-medium transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                Submit
              </button>
            </div>
          )}

          {/* Secret input */}
          {request.type === "secret" && (
            <div className="space-y-2">
              {request.envVar && (
                <div className="text-xs text-slate-500 font-mono">
                  → {request.envVar}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={customAnswer}
                  onChange={(e) => setCustomAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                  placeholder="Enter secret value..."
                  disabled={sending}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5
                             text-sm text-slate-200 placeholder:text-slate-600 outline-none
                             focus:border-red-600 disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleCustomSubmit}
                  disabled={!customAnswer.trim() || sending}
                  className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500
                             text-white text-xs font-medium transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {/* Approval buttons */}
          {request.type === "approval" && (
            <div className="flex gap-2">
              <button
                onClick={() => respond("approve")}
                disabled={sending}
                className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40
                           border border-emerald-700/50 text-emerald-300 text-sm font-medium
                           transition-colors disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => respond("deny")}
                disabled={sending}
                className="flex-1 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40
                           border border-red-700/50 text-red-300 text-sm font-medium
                           transition-colors disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
