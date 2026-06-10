/**
 * ArtifactPanel — live-renders HTML/SVG/Mermaid from agent output.
 *
 * Detects executable content in messages and tool calls, then renders
 * it in a sandboxed iframe side panel (Source/Preview tabs).
 *
 * Pattern adapted from assistant-ui's artifacts example:
 *   github.com/assistant-ui/assistant-ui/tree/main/examples/with-artifacts
 */

import { useState, useMemo } from "react";
import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
import { Code, Eye, X, Copy, Check } from "lucide-react";

// ── Store ─────────────────────────────────────────────

export interface Artifact {
  id: string;
  title: string;
  code: string;
  language: "html" | "svg" | "mermaid";
  source: string; // which message/tool produced this
}

export const $artifact = atom<Artifact | null>(null);

// ── Detection ─────────────────────────────────────────

/** Detect HTML/SVG/Mermaid content from a text block. */
function detectContent(text: string): { code: string; language: Artifact["language"] } | null {
  // Check for fenced code blocks: ```html ... ```
  const fenced = text.match(/```(html|svg|mermaid)\s*\n([\s\S]*?)```/i);
  if (fenced) {
    return { code: fenced[2].trim(), language: fenced[1].toLowerCase() as Artifact["language"] };
  }

  // Check for raw HTML documents
  if (/<!DOCTYPE html>/i.test(text) || /<html[\s>]/i.test(text)) {
    return { code: text.trim(), language: "html" };
  }

  // Check for inline SVG
  if (/<svg[\s>]/i.test(text) && /<\/svg>/i.test(text)) {
    const match = text.match(/(<svg[\s\S]*?<\/svg>)/i);
    if (match) return { code: match[1].trim(), language: "svg" };
  }

  return null;
}

/** Scan tool call output for renderable content. */
export function detectArtifact(output: string): Artifact | null {
  const detected = detectContent(output);
  if (!detected) return null;
  return {
    id: `artifact-${Date.now()}`,
    title: detected.language === "html" ? "HTML Preview" :
           detected.language === "svg" ? "SVG Preview" : "Mermaid Diagram",
    code: detected.code,
    language: detected.language,
    source: "tool-output",
  };
}

// ── Panel Component ───────────────────────────────────

export function ArtifactPanel() {
  const artifact = useStore($artifact);
  const [tab, setTab] = useState<"source" | "preview">("preview");
  const [copied, setCopied] = useState(false);

  // Mermaid rendering: inject mermaid.js into the iframe
  const srcdoc = useMemo(() => {
    if (!artifact) return "";

    if (artifact.language === "mermaid") {
      return `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"><\/script>
  <style>
    body { margin: 0; padding: 16px; background: #0f172a; display: flex; justify-content: center; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <pre class="mermaid">${artifact.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
  <script>mermaid.initialize({ theme: 'dark', startOnLoad: true });<\/script>
</body>
</html>`;
    }

    return artifact.code;
  }, [artifact]);

  if (!artifact) return null;

  const copyCode = () => {
    navigator.clipboard.writeText(artifact.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-full lg:w-[45%] border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <Eye size={14} className="text-indigo-400" />
        <span className="text-sm font-medium text-slate-300 truncate flex-1">
          {artifact.title}
        </span>
        <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded font-mono uppercase">
          {artifact.language}
        </span>
        <button
          onClick={copyCode}
          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>
        <button
          onClick={() => $artifact.set(null)}
          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
          title="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/30 shrink-0">
        <button
          onClick={() => setTab("preview")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
            tab === "preview"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-400"
          }`}
        >
          <Eye size={12} />
          Preview
        </button>
        <button
          onClick={() => setTab("source")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
            tab === "source"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-400"
          }`}
        >
          <Code size={12} />
          Source
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {tab === "preview" ? (
          <iframe
            srcDoc={srcdoc}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-0 bg-white"
            title={artifact.title}
          />
        ) : (
          <pre className="p-4 text-xs text-slate-400 font-mono leading-relaxed overflow-auto h-full whitespace-pre-wrap">
            {artifact.code}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Inline "View Artifact" Button ─────────────────────

interface ArtifactButtonProps {
  text: string;
  className?: string;
}

/** Button to open an artifact from inline content. */
export function ArtifactButton({ text, className }: ArtifactButtonProps) {
  const detected = detectContent(text);
  if (!detected) return null;

  return (
    <button
      onClick={() =>
        $artifact.set({
          id: `artifact-${Date.now()}`,
          title: detected.language === "html" ? "HTML Preview" :
                 detected.language === "svg" ? "SVG Preview" : "Mermaid Diagram",
          code: detected.code,
          language: detected.language,
          source: "message",
        })
      }
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                  bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-700/30
                  text-indigo-400 text-xs font-medium transition-colors ${className ?? ""}`}
    >
      <Eye size={12} />
      View Artifact
    </button>
  );
}
