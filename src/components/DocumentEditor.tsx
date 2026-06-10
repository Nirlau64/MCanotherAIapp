/**
 * DocumentEditor — basic file preview/editor with line numbers + syntax highlighting.
 *
 * Opens when tools (write_file, patch) modify files. Shows content in a
 * textarea with monospace font, line numbers, and regex-based highlighting.
 * AI-First approach: the agent writes, you review and optionally tweak.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
import { X, Copy, Check, Pencil, Eye, FileText } from "lucide-react";

// ── Store ─────────────────────────────────────────────

export interface OpenDocument {
  /** File path (relative or absolute) */
  path: string;
  /** File content */
  content: string;
  /** Detected language for highlighting */
  language: string;
  /** Source: which tool created this */
  source: string;
}

export const $openDocument = atom<OpenDocument | null>(null);

/** Recently viewed/edited documents (persistent list for Output-Sammlung) */
export const $recentDocuments = atom<OpenDocument[]>([]);

export function openDocument(doc: OpenDocument) {
  $openDocument.set(doc);
  // Add to recent list, deduplicate by path
  const recent = $recentDocuments.get();
  const filtered = recent.filter((d) => d.path !== doc.path);
  $recentDocuments.set([doc, ...filtered].slice(0, 20));
}

// ── Language Detection ─────────────────────────────────

function detectLanguage(path: string, content: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", java: "java",
    html: "html", htm: "html", svg: "xml", xml: "xml",
    css: "css", scss: "scss", less: "less",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    md: "markdown", mdx: "markdown",
    sh: "bash", bash: "bash", zsh: "bash",
    sql: "sql", graphql: "graphql", gql: "graphql",
    dockerfile: "dockerfile", env: "plaintext",
  };
  if (ext && map[ext]) return map[ext];
  // Content-based detection
  if (content.startsWith("#!/")) return "bash";
  if (/^<\?xml|^<svg|^<!DOCTYPE html|<html/i.test(content)) return "html";
  return "plaintext";
}

// ── Syntax Highlighting (lightweight regex) ────────────

interface Token { text: string; className: string; }

function tokenizeLine(line: string, lang: string): Token[] {
  if (lang === "plaintext") return [{ text: line, className: "text-slate-300" }];

  const tokens: Token[] = [];
  let remaining = line;

  // Patterns ordered by priority
  const patterns: [RegExp, string][] = [
    // Comments
    [/(\/\/.*$|#.*$)/, "text-slate-600 italic"],
    // Strings
    [/(["'`])(?:(?!\1)[^\\]|\\.)*\1/, "text-emerald-400"],
    [/(`[^`]*`)/, "text-emerald-400"],
    // Keywords
    [/\b(function|const|let|var|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|this|typeof|instanceof|def|self|print|lambda|yield|raise|except|finally|with|as|pass|break|continue|in|not|and|or|is|None|True|False)\b/g, "text-purple-400"],
    // Types
    [/\b(string|number|boolean|void|never|any|unknown|undefined|null|int|float|bool|str|list|dict|tuple|set|Optional|Union)\b/g, "text-cyan-400"],
    // Numbers
    [/\b\d+(\.\d+)?\b/g, "text-amber-400"],
    // JSX/HTML tags
    [/<\/?[A-Za-z][\w-]*(\s[^>]*)?\/?>/g, "text-indigo-400"],
    // Function calls
    [/\b([a-zA-Z_]\w*)(?=\()/g, "text-blue-400"],
  ];

  let pos = 0;
  while (pos < remaining.length) {
    let bestMatch: { idx: number; len: number; cls: string } | null = null;

    for (const [regex, cls] of patterns) {
      regex.lastIndex = pos;
      const match = regex.exec(remaining);
      if (match && match.index === pos) {
        if (!bestMatch || match[0].length > bestMatch.len) {
          bestMatch = { idx: match.index, len: match[0].length, cls };
        }
      }
    }

    if (bestMatch) {
      tokens.push({ text: remaining.slice(pos, bestMatch.idx + bestMatch.len), className: bestMatch.cls });
      pos = bestMatch.idx + bestMatch.len;
    } else {
      // Take one char and move on
      tokens.push({ text: remaining[pos], className: "text-slate-300" });
      pos++;
    }
  }

  return tokens;
}

// ── Editor Component ───────────────────────────────────

export function DocumentEditor() {
  const doc = useStore($openDocument);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);

  // Init content when doc opens
  useEffect(() => {
    if (doc) setContent(doc.content);
  }, [doc?.path]);

  const lines = useMemo(() => content.split("\n"), [content]);
  const lang = doc?.language ?? "plaintext";

  const copyAll = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  if (!doc) return null;

  return (
    <div className="w-full lg:w-[45%] border-l border-slate-800 bg-slate-950 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
        <FileText size={14} className="text-indigo-400" />
        <span className="text-sm font-medium text-slate-300 truncate flex-1 font-mono">
          {doc.path}
        </span>
        <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded uppercase">
          {lang}
        </span>

        <button
          onClick={() => setEditing(!editing)}
          className={`p-1 rounded transition-colors ${
            editing ? "bg-amber-900/30 text-amber-400" : "hover:bg-slate-700 text-slate-500 hover:text-slate-300"
          }`}
          title={editing ? "Preview mode" : "Edit mode"}
        >
          {editing ? <Eye size={14} /> : <Pencil size={14} />}
        </button>

        <button
          onClick={copyAll}
          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
          title="Copy all"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
        </button>

        <button
          onClick={() => { $openDocument.set(null); setEditing(false); }}
          className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Editor / Viewer */}
      <div className="flex-1 overflow-auto flex">
        {/* Line numbers */}
        <div className="shrink-0 bg-slate-900/50 border-r border-slate-800 py-2 select-none text-right">
          {lines.map((_, i) => (
            <div
              key={i}
              className="px-2 text-[11px] leading-5 text-slate-700 font-mono tabular-nums"
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Content */}
        {editing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 bg-transparent text-slate-300 text-xs font-mono leading-5 p-2 outline-none resize-none border-0"
            spellCheck={false}
          />
        ) : (
          <pre className="flex-1 text-xs font-mono leading-5 p-2 overflow-auto whitespace-pre-wrap">
            {lines.map((line, i) => (
              <div key={i} className="flex">
                {tokenizeLine(line, lang).map((token, j) => (
                  <span key={j} className={token.className}>
                    {token.text}
                  </span>
                ))}
                {i < lines.length - 1 && "\n"}
              </div>
            ))}
          </pre>
        )}
      </div>

      {/* Footer with stats */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-slate-800 bg-slate-900/30 text-[10px] text-slate-600 font-mono shrink-0">
        <span>{lines.length} lines</span>
        <span>{content.length} chars</span>
        <span className="flex-1" />
        <span>{doc.source}</span>
      </div>
    </div>
  );
}

// ── Utility: extract file path from tool args ──────────

/** Detect file operations from tool call args. Returns path + content. */
export function detectFileOperation(
  tool: string,
  args: unknown,
  output?: string,
): OpenDocument | null {
  const a = args as Record<string, unknown> | undefined;
  if (!a) return null;

  const fileTools = ["write_file", "write", "patch", "read_file", "file_edit"];
  if (!fileTools.some((t) => tool.includes(t))) return null;

  const path = (a.path as string) || (a.file as string) || (a.file_path as string);
  if (!path) return null;

  // For writes: content is in args; for reads: content is in output
  let content = (a.content as string) || (output ?? "");
  if (!content) return null;

  const language = detectLanguage(path, content);

  return { path, content, language, source: tool };
}
