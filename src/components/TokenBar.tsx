import { useStore } from "@nanostores/react";
import { $sessionUsage } from "@/lib/store";
import { ArrowDownToLine, ArrowUpFromLine, Coins, Database, Cpu } from "lucide-react";

/** Compact token usage + cost bar shown between messages and input. */
export function TokenBar() {
  const usage = useStore($sessionUsage);

  if (!usage || usage.total === 0) return null;

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
    n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` :
    String(n);

  const costStr = usage.cost_usd != null
    ? usage.cost_usd < 0.01
      ? `< $0.01`
      : `$${usage.cost_usd.toFixed(2)}`
    : null;

  const cacheHits = usage.cache_read > 0;

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 text-xs text-slate-500 bg-slate-900/50 border-t border-slate-800/50 select-none font-mono tabular-nums">
      {/* Input */}
      <span className="flex items-center gap-1" title="Input tokens">
        <ArrowUpFromLine size={11} className="text-slate-600" />
        <span className="text-slate-400">{fmt(usage.input)}</span>
      </span>

      {/* Output */}
      <span className="flex items-center gap-1" title="Output tokens">
        <ArrowDownToLine size={11} className="text-slate-600" />
        <span className="text-slate-400">{fmt(usage.output)}</span>
      </span>

      {/* Total */}
      <span className="text-slate-600">·</span>
      <span className="text-slate-500" title="Total tokens">
        {fmt(usage.total)} tok
      </span>

      {/* API calls */}
      {usage.calls > 0 && (
        <>
          <span className="text-slate-700">·</span>
          <span className="text-slate-500">{usage.calls} call{usage.calls !== 1 ? "s" : ""}</span>
        </>
      )}

      {/* Cache hits */}
      {cacheHits && (
        <span className="flex items-center gap-1 text-emerald-600" title={`${fmt(usage.cache_read)} cache read · ${fmt(usage.cache_write)} cache write`}>
          <Database size={11} />
          <span>{fmt(usage.cache_read)} cache</span>
        </span>
      )}

      {/* Context window */}
      {usage.context_max > 0 && (
        <>
          <span className="text-slate-700">·</span>
          <span className="flex items-center gap-1" title={`${fmt(usage.context_used)} / ${fmt(usage.context_max)} tokens`}>
            <Cpu size={11} className="text-slate-600" />
            <span className={usage.context_percent > 80 ? "text-amber-400" : "text-slate-500"}>
              {usage.context_percent}%
            </span>
          </span>
        </>
      )}

      {/* Cost */}
      {costStr && (
        <>
          <span className="text-slate-700">·</span>
          <span className="flex items-center gap-1" title={`Cost status: ${usage.cost_status ?? "estimated"}`}>
            <Coins size={11} className="text-slate-600" />
            <span className="text-slate-400">{costStr}</span>
          </span>
        </>
      )}

      {/* Spacer */}
      <span className="flex-1" />

      {/* Model */}
      {usage.model && (
        <span className="text-slate-600 text-[10px] truncate max-w-[140px]" title={usage.model}>
          {usage.model}
        </span>
      )}
    </div>
  );
}
