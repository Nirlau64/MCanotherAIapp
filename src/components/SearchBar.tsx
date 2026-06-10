import { useState, useEffect, useRef, useCallback } from "react";
import { atom } from "nanostores";
import { useStore } from "@nanostores/react";
import { searchMessages, type SearchResult } from "@/lib/db";
import { Search, MessageSquare, Clock } from "lucide-react";

/** Global atom for search dialog visibility. */
export const $searchOpen = atom(false);

export function SearchBar() {
  const open = useStore($searchOpen);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open, reset on close
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchMessages(query, 20);
        setResults(r);
        setSelectedIdx(0);
      } catch {
        // IndexedDB error — ignore
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        $searchOpen.set(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIdx]) {
        // Scroll to message — for now just show a toast-like highlight
        // In a full implementation, this would activate the session and scroll
      }
    },
    [results, selectedIdx],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60" onClick={() => $searchOpen.set(false)} />

      {/* Search Modal */}
      <div className="fixed inset-x-0 top-[15%] z-50 mx-auto max-w-lg px-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800">
            <Search size={16} className="text-slate-500 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search messages..."
              className="flex-1 bg-transparent text-slate-100 text-sm outline-none placeholder:text-slate-600"
            />
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {!query.trim() && (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Type to search across all conversations
              </div>
            )}

            {searching && (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Searching...
              </div>
            )}

            {!searching && query.trim() && results.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                No results for "{query}"
              </div>
            )}

            {results.map((r, i) => (
              <button
                key={r.message.id}
                className={`w-full text-left px-3 py-2.5 border-b border-slate-800/50 last:border-0 transition-colors ${
                  i === selectedIdx ? "bg-indigo-900/30" : "hover:bg-slate-800/50"
                }`}
                onClick={() => {
                  // Could activate session + scroll to message
                  $searchOpen.set(false);
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <MessageSquare size={12} className="text-slate-600 shrink-0" />
                  <span className="text-xs text-slate-500 font-mono">
                    {r.message.role}
                  </span>
                  <Clock size={10} className="text-slate-700" />
                  <span className="text-[10px] text-slate-600">
                    {new Date(r.message.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-300 line-clamp-2">{r.snippet}</p>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-slate-800 flex items-center gap-3 text-[10px] text-slate-600">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </>
  );
}
