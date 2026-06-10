"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";

// ---------- Types ----------
interface MonitorData {
  hostname: string;
  ip: string;
  uptime: number;
  loadAvg: [number, number, number];
  cpu: {
    cores: number;
    model: string;
    temp: number | null;
    usage: number;
    throttled: {
      undervoltage: boolean;
      freqCapped: boolean;
      throttled: boolean;
      tempLimit: boolean;
    } | null;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    percent: number;
    swapTotal: number;
    swapUsed: number;
  };
  disks: Array<{
    device: string;
    mount: string;
    fstype: string;
    total: number;
    used: number;
    available: number;
    percent: number;
  }>;
  docker: {
    available: boolean;
    containers: Array<{
      name: string;
      image: string;
      state: string;
      status: string;
      ports: string;
    }>;
    running: number;
    stopped: number;
  };
  nas: {
    host: string;
    cachedAt: string | null;
    reachable: boolean;
    model: string | null;
    uptime: string | null;
    raidType: string | null;
    disks: Array<{
      name: string;
      total: number;
      used: number;
      available: number;
      percent: number;
    }>;
    nasDisks: Array<{
      slot: string;
      model: string;
      vendor: string;
      serial: string;
      type: string;
      capacity: number;
      temperature: number;
      smart: string;
      badSectors: number;
    }>;
    backup: {
      lastRun: string | null;
      status: "success" | "error" | "unknown";
      details: string[];
    };
  };
  topProcesses: Array<{
    pid: number;
    cpu: number;
    mem: number;
    rss: number;
    command: string;
  }>;
}

// ---------- Helpers ----------
function fmtBytes(b: number): string {
  if (b === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${u[i]}`;
}

function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function usageColor(pct: number): string {
  if (pct < 60) return "text-emerald-400";
  if (pct < 80) return "text-amber-400";
  return "text-red-400";
}

function usageBgBar(pct: number): string {
  if (pct < 60) return "bg-emerald-500";
  if (pct < 80) return "bg-amber-500";
  return "bg-red-500";
}

function tempColor(t: number): string {
  if (t < 35) return "text-blue-400";
  if (t < 45) return "text-emerald-400";
  if (t < 55) return "text-amber-400";
  return "text-red-400";
}

function raidLabel(type: string | null): string {
  if (!type) return "\u2013";
  const map: Record<string, string> = {
    raid_1: "RAID 1 (Mirror)",
    raid_0: "RAID 0 (Stripe)",
    raid_5: "RAID 5",
    raid_6: "RAID 6",
    raid_10: "RAID 10",
    basic: "Basic (ohne Redundanz)",
    jbod: "JBOD",
  };
  return map[type] || type;
}

// ---------- Progress Bar ----------
function Bar({ percent, className }: { percent: number; className?: string }) {
  const barColor = className || usageBgBar(percent);
  return (
    <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
      <div
        className={clsx("h-full rounded-full transition-all duration-500 ease-out", barColor)}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

// ---------- Component ----------
export default function SystemMonitor() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nasLoading, setNasLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/monitor");
      setData(await r.json());
    } catch {
      // silently ignore fetch errors
    }
    setLoading(false);
  }, []);

  // Forces a fresh SSH query to the NAS (spins disks up) – only on user demand.
  const refreshNas = useCallback(async () => {
    setNasLoading(true);
    try {
      const r = await fetch("/api/monitor?refreshNas=1");
      setData(await r.json());
    } catch {
      // silently ignore
    }
    setNasLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30000);
    return () => clearInterval(iv);
  }, [refresh]);

  if (!data) {
    return (
      <div className="overflow-y-auto h-full p-6 bg-slate-950 text-slate-100">
        <div className="text-2xl font-bold mb-1">Monitor</div>
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  const th = data.cpu.throttled;
  const hasThrottle =
    th && (th.undervoltage || th.freqCapped || th.throttled || th.tempLimit);
  const hasSwap = data.memory.swapTotal > 0;
  const swapPct = hasSwap
    ? Math.round((data.memory.swapUsed / data.memory.swapTotal) * 100)
    : 0;
  const sortedContainers = [...data.docker.containers].sort((a, b) => {
    if (a.state === "running" && b.state !== "running") return -1;
    if (a.state !== "running" && b.state === "running") return 1;
    return a.name.localeCompare(b.name);
  });

  const backupStatusColor =
    data.nas.backup.status === "success"
      ? "text-emerald-400"
      : data.nas.backup.status === "error"
        ? "text-red-400"
        : "text-slate-500";
  const backupStatusDot =
    data.nas.backup.status === "success"
      ? "bg-emerald-500"
      : data.nas.backup.status === "error"
        ? "bg-red-500"
        : "bg-slate-500";
  const backupStatusText =
    data.nas.backup.status === "success"
      ? "OK"
      : data.nas.backup.status === "error"
        ? "Error"
        : "Unknown";

  return (
    <div className="overflow-y-auto h-full p-6 bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="text-2xl font-bold">Monitor</div>
          <div className="text-slate-400 text-sm">
            {data.hostname} · {data.ip} · Uptime {fmtUptime(data.uptime)}
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className={clsx(
            "rounded-lg px-3.5 py-1.5 text-sm font-medium border border-slate-700 transition-colors",
            loading
              ? "bg-slate-800 text-slate-500 cursor-wait"
              : "text-slate-300 hover:bg-slate-800 hover:border-slate-600 cursor-pointer"
          )}
        >
          {loading ? "…" : "↻ Refresh"}
        </button>
      </div>

      {/* Throttle Warning */}
      {hasThrottle && (
        <div className="mb-4 rounded-xl border border-red-800 bg-red-950/40 p-4">
          <div className="text-red-400 font-bold mb-1.5">⚠ Pi Throttled</div>
          <div className="flex gap-4 flex-wrap text-sm">
            {th!.undervoltage && (
              <span className="text-amber-400">Undervoltage</span>
            )}
            {th!.freqCapped && (
              <span className="text-amber-400">Freq Capped</span>
            )}
            {th!.throttled && (
              <span className="text-red-400">Throttled</span>
            )}
            {th!.tempLimit && (
              <span className="text-red-400">Temp Limit</span>
            )}
          </div>
        </div>
      )}

      {/* CPU + Memory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* CPU */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
            CPU
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <span
              className={clsx(
                "text-2xl font-bold",
                data.cpu.temp != null
                  ? tempColor(data.cpu.temp)
                  : "text-slate-200"
              )}
            >
              {data.cpu.temp != null ? `${data.cpu.temp.toFixed(1)}°C` : "\u2013"}
            </span>
            <span
              className={clsx(
                "text-base font-semibold",
                usageColor(data.cpu.usage)
              )}
            >
              {data.cpu.usage >= 0 ? `${data.cpu.usage}%` : "\u2013"}
            </span>
          </div>
          <Bar percent={data.cpu.usage >= 0 ? data.cpu.usage : 0} />
          <div className="mt-2.5 text-slate-400 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span>Load (1/5/15)</span>
              <span>{data.loadAvg.map((l) => l.toFixed(2)).join(" / ")}</span>
            </div>
            <div className="flex justify-between">
              <span>Cores</span>
              <span>{data.cpu.cores}</span>
            </div>
            <div className="flex justify-between">
              <span>Model</span>
              <span
                className="text-xs text-right max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap"
                title={data.cpu.model}
              >
                {data.cpu.model}
              </span>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
            Memory
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <span
              className={clsx("text-2xl font-bold", usageColor(data.memory.percent))}
            >
              {data.memory.percent}%
            </span>
            <span className="text-base font-semibold">
              {fmtBytes(data.memory.used)} / {fmtBytes(data.memory.total)}
            </span>
          </div>
          <Bar percent={data.memory.percent} />
          <div className="mt-2.5 text-slate-400 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span>Available</span>
              <span>{fmtBytes(data.memory.available)}</span>
            </div>
            {hasSwap && (
              <div className="flex justify-between">
                <span>Swap</span>
                <span className={usageColor(swapPct)}>
                  {fmtBytes(data.memory.swapUsed)} / {fmtBytes(data.memory.swapTotal)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disks */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 mb-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
          Storage
        </div>
        <div className="flex flex-col gap-3.5">
          {data.disks.map((d) => (
            <div key={d.mount}>
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="font-mono text-sm text-slate-300">{d.mount}</span>
                <span className="text-slate-400 text-xs">
                  {fmtBytes(d.used)} / {fmtBytes(d.total)}{" "}
                  <span className={clsx("font-semibold", usageColor(d.percent))}>
                    {d.percent}%
                  </span>
                </span>
              </div>
              <Bar percent={d.percent} />
              <div className="text-slate-500 text-[11px] mt-0.5">
                {d.device} · {d.fstype}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Docker */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 mb-4">
        <div className="flex justify-between items-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
            Docker
          </div>
          {data.docker.available ? (
            <div className="text-xs text-slate-300 -mt-2.5">
              <span className="text-emerald-400">{data.docker.running} running</span>
              {data.docker.stopped > 0 && (
                <span className="text-red-400">
                  {" "}· {data.docker.stopped} stopped
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 -mt-2.5">Unavailable</div>
          )}
        </div>
        {!data.docker.available ? (
          <div className="text-slate-400 text-sm">
            Docker not reachable (check permissions)
          </div>
        ) : data.docker.containers.length === 0 ? (
          <div className="text-slate-400 text-sm">No containers</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sortedContainers.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800"
              >
                <span
                  className={clsx(
                    "text-[10px]",
                    c.state === "running" ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  ●
                </span>
                <span className="font-mono text-sm font-semibold min-w-[120px] shrink-0">
                  {c.name}
                </span>
                <span className="text-slate-400 text-xs flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {c.image}
                </span>
                <span className="text-slate-400 text-xs whitespace-nowrap">
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NAS */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 mb-4">
        <div className="flex justify-between items-center flex-wrap gap-2 mb-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            NAS ({data.nas.host})
          </div>
          <div className="flex items-center gap-3">
            {data.nas.cachedAt && (
              <span className="text-slate-500 text-[11px]">
                Cached:{" "}
                {new Date(data.nas.cachedAt).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
            <button
              onClick={refreshNas}
              disabled={nasLoading}
              title="Wake NAS disks from sleep"
              className={clsx(
                "rounded-lg px-2.5 py-1 text-xs border border-slate-700 transition-colors",
                nasLoading
                  ? "bg-slate-800 text-slate-500 cursor-wait"
                  : "text-slate-300 hover:bg-slate-800 hover:border-slate-600 cursor-pointer"
              )}
            >
              {nasLoading ? "…" : "↻ NAS"}
            </button>
            <span
              className={clsx(
                "text-xs",
                data.nas.reachable ? "text-emerald-400" : "text-red-400"
              )}
            >
              {data.nas.reachable ? "● Online" : "○ Offline"}
            </span>
          </div>
        </div>
        {!data.nas.reachable ? (
          <div className="text-slate-400 text-sm">NAS not reachable</div>
        ) : (
          <>
            {/* NAS Info */}
            <div className="text-slate-400 text-sm mb-3 flex gap-4 flex-wrap">
              {data.nas.model && <span>{data.nas.model}</span>}
              {data.nas.raidType && <span>{raidLabel(data.nas.raidType)}</span>}
              {data.nas.uptime && <span>Uptime: {data.nas.uptime}</span>}
            </div>

            {/* NAS Physical Disks */}
            {data.nas.nasDisks.length > 0 && (
              <div className="flex flex-col gap-2 mb-3.5">
                {data.nas.nasDisks.map((d) => (
                  <div
                    key={d.slot}
                    className="rounded-lg bg-slate-950 border border-slate-800 p-2.5"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "text-[10px]",
                            d.smart === "normal"
                              ? "text-emerald-400"
                              : "text-red-400"
                          )}
                        >
                          ●
                        </span>
                        <span className="font-semibold text-sm">
                          Slot {d.slot}
                        </span>
                        <span className="text-slate-400 text-xs">
                          {d.vendor} {d.model}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-xs font-mono">
                          {fmtBytes(d.capacity)}
                        </span>
                        <span
                          className={clsx(
                            "text-xs font-semibold",
                            tempColor(d.temperature)
                          )}
                        >
                          {d.temperature}°C
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-4 text-slate-500 text-[11px]">
                      <span>
                        SMART:{" "}
                        <span
                          className={
                            d.smart === "normal"
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }
                        >
                          {d.smart}
                        </span>
                      </span>
                      <span>
                        Bad Sectors:{" "}
                        <span
                          className={
                            d.badSectors > 0
                              ? "text-red-400"
                              : "text-slate-500"
                          }
                        >
                          {d.badSectors}
                        </span>
                      </span>
                      <span>S/N: {d.serial}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* NAS Volumes */}
            {data.nas.disks.length > 0 && (
              <div className="flex flex-col gap-2.5 mb-3.5">
                {data.nas.disks.map((d) => (
                  <div key={d.name}>
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-mono text-sm text-slate-300">
                        {d.name}
                      </span>
                      <span className="text-slate-400 text-xs">
                        {fmtBytes(d.used)} / {fmtBytes(d.total)}{" "}
                        <span
                          className={clsx("font-semibold", usageColor(d.percent))}
                        >
                          {d.percent}%
                        </span>
                      </span>
                    </div>
                    <Bar percent={d.percent} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Backup Status */}
        <div className="rounded-lg bg-slate-950 border border-slate-800 p-3">
          <div
            className={clsx(
              "flex justify-between items-center",
              data.nas.backup.details.length > 0 && "mb-2"
            )}
          >
            <span className="text-xs font-semibold">Last Backup</span>
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  "text-xs font-semibold flex items-center gap-1",
                  backupStatusColor
                )}
              >
                <span className={clsx("inline-block w-1.5 h-1.5 rounded-full", backupStatusDot)} />
                {backupStatusText}
              </span>
              {data.nas.backup.lastRun && (
                <span className="text-slate-500 text-xs">
                  {data.nas.backup.lastRun}
                </span>
              )}
            </div>
          </div>
          {data.nas.backup.details.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {data.nas.backup.details.map((d, i) => (
                <div
                  key={i}
                  className={clsx(
                    "font-mono text-[11px]",
                    d.includes("error") ? "text-red-400" : "text-slate-500"
                  )}
                >
                  {d}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Processes */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
          Top Processes (by RAM)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-slate-500 text-left px-2 py-1 font-semibold text-xs">
                  Process
                </th>
                <th className="text-slate-500 text-right px-2 py-1 font-semibold text-xs">
                  PID
                </th>
                <th className="text-slate-500 text-right px-2 py-1 font-semibold text-xs">
                  CPU%
                </th>
                <th className="text-slate-500 text-right px-2 py-1 font-semibold text-xs">
                  MEM%
                </th>
                <th className="text-slate-500 text-right px-2 py-1 font-semibold text-xs">
                  RAM
                </th>
              </tr>
            </thead>
            <tbody>
              {data.topProcesses.map((p) => (
                <tr
                  key={p.pid}
                  className="border-b border-slate-800/50"
                >
                  <td
                    className="px-2 py-1.5 font-mono text-xs max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap"
                    title={p.command}
                  >
                    {p.command}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-500 font-mono text-xs">
                    {p.pid}
                  </td>
                  <td
                    className={clsx(
                      "px-2 py-1.5 text-right font-mono text-xs",
                      usageColor(p.cpu * 5)
                    )}
                  >
                    {p.cpu.toFixed(1)}
                  </td>
                  <td
                    className={clsx(
                      "px-2 py-1.5 text-right font-mono text-xs",
                      usageColor(p.mem * 3)
                    )}
                  >
                    {p.mem.toFixed(1)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-300 font-mono text-xs">
                    {p.rss} MB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
