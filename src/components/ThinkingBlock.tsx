import { useState } from "react";

interface Props {
  thinking: string;
  /** When true, the block starts expanded (used during streaming). Defaults to false (collapsed for past messages). */
  defaultOpen?: boolean;
}

/**
 * Collapsible "Denkprozess" (thinking) block.
 * Shows line count, toggle arrow, preview when collapsed, full text when expanded.
 * Ported from Atlas Chat.tsx — Tailwind styled.
 */
export function ThinkingBlock({ thinking, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const preview =
    thinking.length > 140 ? thinking.slice(0, 140) + "…" : thinking;
  const lineCount = thinking.split("\n").length;

  if (!thinking) return null;

  return (
    <div className="mb-2 border border-slate-700 rounded-lg overflow-hidden bg-slate-900/60">
      <button
        type="button"
        className="flex items-center gap-2 w-full bg-slate-900 text-slate-400 px-3 py-1.5 cursor-pointer text-xs hover:bg-slate-800 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[10px] leading-none">
          {open ? "▼" : "▶"}
        </span>
        <span className="font-medium">Denkprozess</span>
        <span className="text-slate-600 ml-auto text-[10px]">
          {lineCount} Zeile{lineCount !== 1 ? "n" : ""}
        </span>
      </button>

      {open && (
        <div className="px-3 py-2 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap break-words max-h-96 overflow-y-auto bg-slate-950/60 border-t border-slate-700">
          {thinking}
        </div>
      )}

      {!open && (
        <div className="px-3 py-1.5 text-[11px] text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis border-t border-slate-700/50 bg-slate-950/60">
          {preview}
        </div>
      )}
    </div>
  );
}
