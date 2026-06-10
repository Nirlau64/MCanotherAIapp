"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchJSON } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface ModelItem {
  id: string;
  name: string;
  provider: "anthropic" | "deepseek" | "zai";
}

type Provider = ModelItem["provider"];

const PROVIDERS: Provider[] = ["anthropic", "deepseek", "zai"];

// ── Component ──────────────────────────────────────────────────────────────

export default function ModelManager() {
  const [models, setModels] = useState<ModelItem[] | null>(null);
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // ── Load ──

  const load = useCallback(async () => {
    try {
      const data = await fetchJSON<ModelItem[]>("/api/models");
      setModels(data);
    } catch {
      setModels([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Add ──

  const add = async () => {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.trim(),
          name: name.trim() || id.trim(),
          provider,
        }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.error || "Unknown error");
      } else {
        setId("");
        setName("");
        await load();
      }
    } catch {
      setErr("Network error — could not add model");
    } finally {
      setBusy(false);
    }
  };

  // ── Remove ──

  const remove = async (p: string, mid: string) => {
    try {
      await fetch(
        `/api/models?provider=${p}&id=${encodeURIComponent(mid)}`,
        { method: "DELETE" },
      );
      await load();
    } catch {
      // silently fail; list stays as-is
    }
  };

  // ── Render ──

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto p-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100">Models</h2>
        <p className="text-sm text-slate-500 mt-1">
          {models === null
            ? "Loading…"
            : `${models.length} model${models.length !== 1 ? "s" : ""} available`}
        </p>
      </div>

      {/* Add form */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Add model
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {/* Provider dropdown */}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Model ID */}
          <input
            type="text"
            placeholder="Model ID (e.g. claude-opus-4-7)"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />

          {/* Display name */}
          <input
            type="text"
            placeholder="Display name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-[180px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />

          {/* Add button */}
          <button
            onClick={add}
            disabled={busy || !id.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Validating…" : "Add"}
          </button>
        </div>

        {/* Error message */}
        {err && (
          <p className="mt-2 text-sm text-red-400">{err}</p>
        )}

        <p className="mt-2 text-xs text-slate-600">
          Validated against the model registry. Only registered models are accepted.
        </p>
      </div>

      {/* Model list */}
      {models === null ? (
        <p className="text-sm text-slate-500 text-center py-4">Loading…</p>
      ) : models.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">
          No models configured. Add one above.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {PROVIDERS.map((prov) => {
            const list = models.filter((m) => m.provider === prov);
            if (list.length === 0) return null;

            return (
              <div
                key={prov}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-indigo-400">
                  {prov}
                </h4>

                <div className="flex flex-col gap-2">
                  {list.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-slate-200 truncate">
                        {m.name}
                      </span>

                      <span className="flex items-center gap-3 shrink-0">
                        <code className="text-xs text-slate-500">
                          {m.id}
                        </code>
                        <button
                          onClick={() => remove(m.provider, m.id)}
                          title="Remove model"
                          className="text-lg leading-none text-red-400 hover:text-red-300 transition"
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
