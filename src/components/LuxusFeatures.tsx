/**
 * LuxusFeatures — Output-Sammlung, Compare, Context Info, Manual Compact.
 *
 * All panels and actions that enhance the AI-First workflow:
 * - Documents panel: recently viewed/edited files
 * - Compare: side-by-side message output comparison
 * - Context Info: what files/wiki pages the agent sees
 * - Manual Compact: trigger context compaction
 */

import { useState } from "react";
import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
import {
  FileText, GitCompare, Eye, Cpu, ArrowLeftRight,
  X, FolderOpen, Maximize2, Check, AlertCircle
} from "lucide-react";
import type { ChatMessage } from "@/lib/store";
import { $sessions, $sessionUsage, $messages, $gwState } from "@/lib/store";
import type { GatewayClient } from "@/lib/gateway";
import { $recentDocuments, openDocument } from "./DocumentEditor";
import { exportConversation } from "@/lib/export";
import { addToast } from "@/lib/toast";

// ── Stores ─────────────────────────────────────────────

/** Compare panel: null or { left: message, right: message } */
export const $compare = atom<{ left: ChatMessage; right: ChatMessage } | null>(null);
/** Documents panel toggle */
export const $docsOpen = atom(false);
/** Context info panel toggle */
export const $contextInfoOpen = atom(false);

// ── Output Actions (Context Menu on Messages) ──────────

interface OutputActionsProps {
  message: ChatMessage;
  gateway: GatewayClient | null;
  sessionId?: string;
  onClose: () => void;
}

export function OutputActions({ message, onClose }: OutputActionsProps) {
  const actions = [
    {
      label: "Reuse as Prompt",
      icon: <ArrowLeftRight size={14} />,
      action: () => {
        // Pre-fill chat input — for now, copy to clipboard
        navigator.clipboard.writeText(message.text).then(() => {
          addToast("Copied to clipboard — paste as new prompt", "info");
        });
        onClose();
      },
    },
    {
      label: "Compare with...",
      icon: <GitCompare size={14} />,
      action: () => {
        onClose();
        addToast("Click 'Compare' on another message to see side-by-side", "info");
      },
    },
    {
      label: "Export as Markdown",
      icon: <FileText size={14} />,
      action: () => {
        exportConversation([message], "md");
        addToast("Exported as Markdown", "success");
        onClose();
      },
    },
    {
      label: "Copy Message",
      icon: <Eye size={14} />,
      action: () => {
        navigator.clipboard.writeText(message.text).then(() => {
          addToast("Copied", "success");
        });
        onClose();
      },
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div className="absolute z-50 w-48 py-1 rounded-lg bg-slate-800 border border-slate-700 shadow-xl text-sm">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.action}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ── Documents Panel ────────────────────────────────────

export function DocumentsPanel() {
  const docs = useStore($recentDocuments);
  const open = useStore($docsOpen);

  if (!open) return null;

  return (
    <div className="w-full lg:w-[45%] border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <FolderOpen size={14} className="text-amber-400" />
        <span className="text-sm font-medium text-slate-300 flex-1">Documents</span>
        <span className="text-xs text-slate-600">{docs.length} files</span>
        <button
          onClick={() => $docsOpen.set(false)}
          className="p-1 rounded hover:bg-slate-700 text-slate-500 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {docs.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            No documents yet. Files the agent edits will appear here.
          </div>
        ) : (
          docs.map((doc) => (
            <button
              key={doc.path}
              onClick={() => { openDocument(doc); $docsOpen.set(false); }}
              className="w-full text-left px-3 py-2.5 border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors flex items-center gap-2"
            >
              <FileText size={14} className="text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-300 truncate font-mono">{doc.path}</div>
                <div className="text-[10px] text-slate-500">
                  {doc.language} · {doc.content.length} chars · {doc.source}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Context Info Panel ─────────────────────────────────

interface ContextInfoProps {
  sessionId: string | null;
}

export function ContextInfo({ sessionId }: ContextInfoProps) {
  const open = useStore($contextInfoOpen);
  const sessions = useStore($sessions);
  const usage = useStore($sessionUsage);
  const messages = useStore($messages);
  const gwState = useStore($gwState);

  if (!open) return null;

  const activeSession = sessions.find(s => s.id === sessionId);

  return (
    <div className="w-full lg:w-[45%] border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <Cpu size={14} className="text-purple-400" />
        <span className="text-sm font-medium text-slate-300 flex-1">Context Info</span>
        <button
          onClick={() => $contextInfoOpen.set(false)}
          className="p-1 rounded hover:bg-slate-700 text-slate-500 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
        <div className="text-xs text-slate-500">Active context the agent sees:</div>
        <div className="bg-slate-900/50 rounded p-3 space-y-2 font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500">Gateway</span>
            <span className={gwState === "open" ? "text-emerald-400" : "text-amber-400"}>{gwState}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Session</span>
            <span className="text-slate-300 truncate max-w-[180px]">{activeSession?.title || sessionId || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Model</span>
            <span className="text-slate-300">{activeSession?.model || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Messages</span>
            <span className="text-slate-300">{messages.length}</span>
          </div>
          {usage && (<>
            <hr className="border-slate-800" />
            <div className="flex justify-between">
              <span className="text-slate-500">Tokens</span>
              <span className="text-slate-300">{(usage.total || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Input</span>
              <span className="text-slate-300">{(usage.input || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Output</span>
              <span className="text-slate-300">{(usage.output || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cache</span>
              <span className="text-slate-300">{(usage.cache_read || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Context</span>
              <span className="text-slate-300">{usage.context_percent?.toFixed(1)}% ({usage.context_used?.toLocaleString()}/{usage.context_max?.toLocaleString()})</span>
            </div>
            {usage.cost_usd != null && (
              <div className="flex justify-between">
                <span className="text-slate-500">Cost</span>
                <span className="text-slate-300">${usage.cost_usd.toFixed(4)}</span>
              </div>
            )}
          </>)}
        </div>
      </div>
    </div>
  );
}

// ── Compare Panel ──────────────────────────────────────

export function ComparePanel() {
  const compare = useStore($compare);

  if (!compare) return null;

  return (
    <div className="w-full lg:w-[45%] border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <GitCompare size={14} className="text-cyan-400" />
        <span className="text-sm font-medium text-slate-300 flex-1">Compare</span>
        <button
          onClick={() => $compare.set(null)}
          className="p-1 rounded hover:bg-slate-700 text-slate-500 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 flex divide-x divide-slate-800 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-[10px] text-slate-600 mb-1 uppercase">Original</div>
          <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
            {compare.left.text}
          </pre>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-[10px] text-slate-600 mb-1 uppercase">Compare</div>
          <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
            {compare.right.text}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Manual Compact Button ──────────────────────────────

interface CompactButtonProps {
  gateway: GatewayClient | null;
  sessionId: string | null;
}

type CompactState = "idle" | "compacting" | "done" | "error";

export function CompactButton({ gateway, sessionId }: CompactButtonProps) {
  const [state, setState] = useState<CompactState>("idle");

  const compact = async () => {
    if (!gateway) {
      addToast("Not connected", "error");
      return;
    }
    if (!sessionId) {
      addToast("No active session", "error");
      return;
    }
    setState("compacting");
    try {
      await gateway.request("session.compress", { session_id: sessionId });
      setState("done");
      addToast("Context compacted", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState("error");
      addToast(`Compaction failed: ${msg}`, "error");
    }
    // Reset icon after a few seconds
    setTimeout(() => setState("idle"), 4000);
  };

  return (
    <button
      onClick={compact}
      disabled={state === "compacting"}
      className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 disabled:opacity-50 transition-colors"
      title="Compact conversation context"
    >
      {state === "done" ? (
        <Check size={18} className="text-green-400" />
      ) : state === "error" ? (
        <AlertCircle size={18} className="text-red-400" />
      ) : (
        <Maximize2 size={18} className={state === "compacting" ? "animate-pulse" : ""} />
      )}
    </button>
  );
}
