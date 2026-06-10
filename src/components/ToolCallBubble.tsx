import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Loader, CheckCircle, XCircle, Wrench, Clock, Terminal, FileText, Globe, Search, Braces, Eye } from "lucide-react";
import { detectArtifact, $artifact } from "./ArtifactPanel";
import { detectFileOperation, openDocument } from "./DocumentEditor";

export interface ToolCallData { id: string; tool: string; status: "running" | "done" | "error"; output?: string; durationMs?: number; args?: unknown; tokens?: number; }

interface ToolCallGroupProps { tools: ToolCallData[]; }

function toolIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("terminal")||n.includes("bash")||n.includes("shell")) return <Terminal size={14} />;
  if (n.includes("read")||n.includes("write")||n.includes("file")||n.includes("patch")) return <FileText size={14} />;
  if (n.includes("web")||n.includes("browser")||n.includes("fetch")||n.includes("http")) return <Globe size={14} />;
  if (n.includes("search")||n.includes("grep")||n.includes("find")) return <Search size={14} />;
  return <Braces size={14} />;
}

export function ToolCallGroup({ tools }: ToolCallGroupProps) {
  const anyRunning = tools.some((t) => t.status === "running");
  const [groupOpen, setGroupOpen] = useState(anyRunning);
  const runningCount = tools.filter((t) => t.status === "running").length;

  useEffect(() => {
    if (anyRunning) { setGroupOpen(true); }
    else if (tools.length > 0 && tools.every((t) => t.status !== "running")) {
      const timer = setTimeout(() => setGroupOpen(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [anyRunning, tools.length]);

  if (tools.length === 0) return null;

  const statusIcon = anyRunning ? <Loader size={14} className="text-amber-400 animate-spin shrink-0" />
    : tools.some((t) => t.status === "error") ? <XCircle size={14} className="text-red-400 shrink-0" />
    : <CheckCircle size={14} className="text-emerald-400 shrink-0" />;

  const totalDuration = tools.reduce((s, t) => s + (t.durationMs ?? 0), 0);
  const durationStr = totalDuration > 0 ? (totalDuration < 1000 ? `${totalDuration}ms` : `${(totalDuration / 1000).toFixed(1)}s`) : null;

  return (
    <div className="flex justify-start px-4">
      <div className={`max-w-[90%] min-w-[220px] rounded-xl overflow-hidden text-sm border transition-colors cursor-pointer
        ${anyRunning ? "border-amber-700/50 bg-amber-900/10" : tools.some((t) => t.status === "error") ? "border-red-800/50 bg-red-900/10" : "border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/50"}`}
        onClick={() => setGroupOpen(!groupOpen)}>
        {/* Level 1: Group Header */}
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={(e) => { e.stopPropagation(); setGroupOpen(!groupOpen); }} className="p-0.5 rounded hover:bg-slate-700/50 text-slate-500">{groupOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
          <Wrench size={14} className="text-slate-500 shrink-0" />
          <span className="font-medium text-slate-200">Tool Calls</span>
          <span className="text-xs text-slate-500 tabular-nums">({tools.length})</span>
          {runningCount > 0 && <span className="text-xs text-amber-400 font-medium">{runningCount} running</span>}
          <span className="flex-1" />
          {durationStr && <span className="flex items-center gap-1 text-xs text-slate-500"><Clock size={11} />{durationStr}</span>}
          {statusIcon}
        </div>
        {/* Level 2+3: Individual Tools */}
        {groupOpen && (
          <div className="border-t border-slate-700/50 divide-y divide-slate-700/30">
            {tools.map((tool) => <ToolCallItem key={tool.id} tool={tool} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallItem({ tool }: { tool: ToolCallData }) {
  const [open, setOpen] = useState(tool.status === "running");

  useEffect(() => {
    if (tool.status !== "running") { const t = setTimeout(() => setOpen(false), 1500); return () => clearTimeout(t); }
    else { setOpen(true); }
  }, [tool.status]);

  const statusIcon = tool.status === "running" ? <Loader size={12} className="text-amber-400 animate-spin shrink-0" />
    : tool.status === "error" ? <XCircle size={12} className="text-red-400 shrink-0" />
    : <CheckCircle size={12} className="text-emerald-400 shrink-0" />;

  const durStr = tool.durationMs ? (tool.durationMs < 1000 ? `${tool.durationMs}ms` : `${(tool.durationMs / 1000).toFixed(1)}s`) : null;

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800/30 cursor-pointer" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-0.5 rounded hover:bg-slate-700/50 text-slate-500">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
        <span className="text-slate-500 shrink-0">{toolIcon(tool.tool)}</span>
        <span className="text-sm text-slate-300 font-mono truncate flex-1">{tool.tool}</span>
        {durStr && <span className="flex items-center gap-1 text-xs text-slate-500"><Clock size={10} />{durStr}</span>}
        {tool.tokens != null && <span className="text-xs text-slate-600 tabular-nums">{tool.tokens} tok</span>}
        {statusIcon}
      </div>
      {open && (
        <div className="px-4 pb-3 pt-1 space-y-2 border-t border-slate-800/50">
          {tool.args != null && (
            <div><div className="text-xs text-slate-600 mb-1 font-medium">Input</div>
              <pre className="text-xs text-slate-400 bg-slate-900/50 rounded p-2 overflow-x-auto font-mono max-h-32 overflow-y-auto">{typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args, null, 2)}</pre></div>
          )}
          {tool.output ? (
            <div><div className="text-xs text-slate-600 mb-1 font-medium">Output</div>
              <pre className="text-xs text-slate-400 bg-slate-900/50 rounded p-2 overflow-x-auto font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-all">{tool.output}</pre>
              {/* Artifact detection */}
              {tool.output && detectArtifact(tool.output) && (
                <button
                  onClick={() => {
                    const a = detectArtifact(tool.output!);
                    if (a) $artifact.set(a);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                             bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-700/30
                             text-indigo-400 text-xs font-medium transition-colors"
                >
                  <Eye size={12} />
                  View Artifact
                </button>
              )}
              {/* File operation: Open in Editor */}
              {tool.status === "done" && detectFileOperation(tool.tool, tool.args, tool.output) && (
                <button
                  onClick={() => {
                    const doc = detectFileOperation(tool.tool, tool.args, tool.output);
                    if (doc) openDocument(doc);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                             bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-700/30
                             text-emerald-400 text-xs font-medium transition-colors"
                >
                  <FileText size={12} />
                  Open in Editor
                </button>
              )}
            </div>
          ) : tool.status === "running" ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-1"><Loader size={10} className="animate-spin text-amber-400" /><span>Waiting for output...</span></div>
          ) : <div className="text-xs text-slate-600 italic py-1">No output</div>}
          {tool.tokens != null && <div className="text-xs text-slate-500">Tokens: <span className="text-slate-400 tabular-nums">{tool.tokens}</span></div>}
        </div>
      )}
    </div>
  );
}
