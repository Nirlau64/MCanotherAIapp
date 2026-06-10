import { useStore } from "@nanostores/react";
import { $activeTools } from "@/lib/store";
import { Wrench, CheckCircle, Loader, XCircle } from "lucide-react";

export function ToolPanel() {
  const tools = useStore($activeTools);

  if (tools.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          <Wrench size={14} /><span className="font-semibold uppercase tracking-wider">Tools</span>
        </div>
        <p className="text-xs text-slate-600 text-center mt-8">No active tools.<br />Tool execution will appear here.</p>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
        <Wrench size={14} /><span className="font-semibold uppercase tracking-wider">Tools</span>
        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-xs text-slate-400">{tools.filter((t) => t.status === "running").length} active</span>
      </div>
      <div className="space-y-2">
        {tools.map((tool) => (
          <div key={tool.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              {tool.status === "running" ? <Loader size={14} className="text-amber-400 animate-spin" />
                : tool.status === "error" ? <XCircle size={14} className="text-red-400" />
                : <CheckCircle size={14} className="text-emerald-400" />}
              <span className="text-sm font-medium text-slate-200">{tool.tool}</span>
              {tool.durationMs && <span className="text-xs text-slate-500 ml-auto">{tool.durationMs < 1000 ? `${tool.durationMs}ms` : `${(tool.durationMs / 1000).toFixed(1)}s`}</span>}
              {tool.tokens != null && <span className="text-xs text-slate-600 tabular-nums ml-1">{tool.tokens} tok</span>}
            </div>
            {tool.output && <pre className="text-xs text-slate-400 bg-slate-900/50 rounded p-2 mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-all font-mono">{tool.output.slice(-2000)}</pre>}
            {tool.status === "running" && !tool.output && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1"><span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />Running...</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
