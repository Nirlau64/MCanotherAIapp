import { memo, useState } from "react";
import { Markdown } from "./Markdown";
import { ThinkingBlock } from "./ThinkingBlock";
import { ArtifactButton } from "./ArtifactPanel";
import type { ChatMessage } from "@/lib/store";
import { FileText, Download, Terminal } from "lucide-react";
import { OutputActions } from "./LuxusFeatures";
import { $gateway } from "@/lib/store";

interface Props { message: ChatMessage; }

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Detect MEDIA:/path/file in text and split into segments for rendering. */
function parseMediaLinks(text: string): Array<{ type: "text" | "media"; content: string; filename?: string }> {
  const parts: Array<{ type: "text" | "media"; content: string; filename?: string }> = [];
  const regex = /MEDIA:(\/[^\s]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
    const path = m[1];
    const filename = path.split("/").pop() ?? "file";
    parts.push({ type: "media", content: path, filename });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
  return parts.length > 0 ? parts : [{ type: "text", content: text }];
}

/** Validate that a file path is safe: absolute path under /tmp/ or /home/ */
function isSafePath(path: string): boolean {
  // Must be an absolute path
  if (!path.startsWith("/")) return false;
  // No path traversal
  if (path.includes("..")) return false;
  // Only allow paths under /tmp/ and /home/
  if (!path.startsWith("/tmp/") && !path.startsWith("/home/")) return false;
  // No suspicious characters
  if (/[^a-zA-Z0-9_\-\.\/\s]/.test(path)) return false;
  return true;
}

export const MessageBubble = memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isTool = message.role === "tool";
  const hasUsage = message.usage && (message.usage.delta_input != null || message.usage.delta_output != null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isSystem || isTool) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} px-2`}
      onContextMenu={handleContextMenu}
    >
      {/* Bubble */}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-indigo-600 text-white rounded-br-md"
            : isSystem
              ? "bg-slate-800/50 text-slate-400 italic text-xs"
              : isTool
                ? "bg-slate-800/30 border border-slate-700/50 rounded-lg"
                : "bg-slate-800 text-slate-100 rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : isSystem ? (
          <p className="whitespace-pre-wrap">{message.text}</p>
        ) : isTool ? (
          <div className="flex items-center gap-2 text-xs">
            <Terminal size={12} className="text-slate-500 shrink-0" />
            <span className="text-slate-300 font-mono">{message.toolName ?? "tool"}</span>
            {message.toolContext && (
              <span className="text-slate-500 truncate">— {message.toolContext}</span>
            )}
          </div>
        ) : (
          <>
            {message.thinking && <ThinkingBlock thinking={message.thinking} />}
            <AssistantContent text={message.text} />
          </>
        )}
      </div>

      {/* Per-message token info (assistant only) */}
      {hasUsage && !isUser && !isSystem && (
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-600 font-mono tabular-nums select-none">
          {message.usage!.delta_input != null && message.usage!.delta_input > 0 && (
            <span title="Input tokens (this message)">
              ↑{fmtTokens(message.usage!.delta_input)}
            </span>
          )}
          {message.usage!.delta_output != null && message.usage!.delta_output > 0 && (
            <span title="Output tokens (this message)">
              ↓{fmtTokens(message.usage!.delta_output)}
            </span>
          )}
          {message.usage!.cost_usd != null && (
            <span title={`Cost: $${message.usage!.cost_usd.toFixed(6)}`} className="text-slate-700">
              ${message.usage!.cost_usd < 0.01 ? "<0.01" : message.usage!.cost_usd.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Artifact preview button (HTML/SVG/Mermaid in message) */}
      {!isUser && !isSystem && !isTool && (
        <ArtifactButton text={message.text} className="mt-1" />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 50 }}>
          <OutputActions
            message={message}
            gateway={$gateway.get()}
            onClose={() => setContextMenu(null)}
          />
        </div>
      )}
    </div>
  );
});

/** Render assistant content: markdown + MEDIA: file links. */
function AssistantContent({ text }: { text: string }) {
  const parts = parseMediaLinks(text);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  const handleDownload = async (path: string, filename: string) => {
    // Validate path before sending to backend
    if (!isSafePath(path)) {
      console.error("Download blocked: unsafe path", path);
      alert(`Download blocked: path not allowed (${path})`);
      return;
    }

    setDownloadingPath(path);
    try {
      const token = window.__HERMES_SESSION_TOKEN__;
      const headers: Record<string, string> = {};
      if (token) headers["X-Hermes-Session-Token"] = token;

      const res = await fetch(`/api/chat-pwa/file?path=${encodeURIComponent(path)}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDownloadingPath(null);
    }
  };

  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.type === "media") {
          const isLoading = downloadingPath === part.content;
          return (
            <button
              key={i}
              onClick={() => handleDownload(part.content, part.filename ?? "file")}
              disabled={isLoading}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg
                         bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-700/30
                         text-emerald-400 text-xs font-medium transition-colors
                         cursor-pointer disabled:opacity-50 disabled:cursor-wait`}
            >
              <FileText size={14} className={isLoading ? "animate-pulse" : ""} />
              <span className="truncate max-w-[200px]">{part.filename}</span>
              <Download size={12} className="ml-1 opacity-60" />
              {isLoading && <span className="text-[10px] opacity-60">…</span>}
            </button>
          );
        }
        return <Markdown key={i} text={part.content} />;
      })}
    </div>
  );
}
