import { MessageSquare, Pencil, Trash2, Search, X as XIcon } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import type { SessionMeta } from "@/lib/store";
import { useSwipe } from "@/hooks/useSwipe";

interface Props {
  sessions: SessionMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

interface SessionGroup {
  label: string;
  sessions: SessionMeta[];
}

function groupSessions(sessions: SessionMeta[]): SessionGroup[] {
  const now = new Date();
  const today: SessionMeta[] = [];
  const yesterday: SessionMeta[] = [];
  const thisWeek: SessionMeta[] = [];
  const older: SessionMeta[] = [];

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 86400000);

  for (const s of sessions) {
    const activityTs = (s.last_active || s.started_at) * 1000;
    const d = new Date(activityTs);
    if (d >= startOfToday) today.push(s);
    else if (d >= startOfYesterday) yesterday.push(s);
    else if (d >= startOfWeek) thisWeek.push(s);
    else older.push(s);
  }

  return [
    { label: "Today", sessions: today },
    { label: "Yesterday", sessions: yesterday },
    { label: "This Week", sessions: thisWeek },
    { label: "Older", sessions: older },
  ].filter((g) => g.sessions.length > 0);
}

export function SessionList({ sessions, activeId, onSelect, onRename, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const q = debouncedQuery.toLowerCase();
  const filtered = q
    ? sessions.filter((s) =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.preview || "").toLowerCase().includes(q) ||
        (s.model || "").toLowerCase().includes(q) ||
        (s.source || "").toLowerCase().includes(q)
      )
    : sessions;

  const groups = groupSessions(filtered);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-7 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-500 transition-colors"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setDebouncedQuery(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">
            No sessions yet. Create one to start chatting.
          </div>
        )}
        {sessions.length > 0 && filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">
            No sessions matching "{debouncedQuery}"
          </div>
        )}
        {groups.map((group) => (
          <div key={group.label} className="mb-2">
            <div className="px-4 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {group.label}
            </div>
            {group.sessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                active={s.id === activeId}
                onSelect={() => onSelect(s.id)}
                onRename={(title) => onRename(s.id, title)}
                onDelete={() => onDelete(s.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Context Menu Portal ────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  sessionId: string;
  title: string;
}

function SessionItem({
  session,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  session: SessionMeta;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, sessionId: session.id, title: session.title || "" });
  }, [session]);

  const handleTouchStart = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      setMenu({ x: window.innerWidth / 2, y: window.innerHeight / 2, sessionId: session.id, title: session.title || "" });
    }, 600);
  }, [session]);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const handleRename = useCallback(() => {
    setEditing(true);
    setEditTitle(session.title || "");
    closeMenu();
  }, [session.title, closeMenu]);

  const submitRename = useCallback(() => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    }
    setEditing(false);
  }, [editTitle, session.title, onRename]);

  const swipe = useSwipe({
    onSwipeLeft: () => onDelete(),
  });

  const mergedTouchStart = useCallback((e: React.TouchEvent) => {
    handleTouchStart();
    swipe.handlers.onTouchStart?.(e);
  }, [handleTouchStart, swipe.handlers]);

  const mergedTouchEnd = useCallback((e: React.TouchEvent) => {
    handleTouchEnd();
    swipe.handlers.onTouchEnd?.(e);
  }, [handleTouchEnd, swipe.handlers]);

  const mergedTouchMove = useCallback((e: React.TouchEvent) => {
    handleTouchEnd();
    swipe.handlers.onTouchMove?.(e);
  }, [handleTouchEnd, swipe.handlers]);

  return (
    <>
      <div className="relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-900/60 text-red-400 text-xs">
            <Trash2 size={12} />
            Delete
          </div>
        </div>

        <button
          onClick={editing ? undefined : onSelect}
          onContextMenu={handleContextMenu}
          onTouchStart={mergedTouchStart}
          onTouchEnd={mergedTouchEnd}
          onTouchMove={mergedTouchMove}
          style={swipe.style}
          className={`w-full text-left px-4 py-2.5 transition-colors text-sm group relative bg-slate-900 ${
            active
              ? "bg-indigo-900/30 border-l-2 border-indigo-500"
              : "border-l-2 border-transparent hover:bg-slate-800/50"
          }`}
        >
        <div className="flex items-start gap-2">
          <MessageSquare
            size={14}
            className={`mt-0.5 shrink-0 ${active ? "text-indigo-400" : "text-slate-600"}`}
          />
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitRename();
                  if (e.key === "Escape") setEditing(false);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-slate-700 border border-indigo-500 rounded px-1.5 py-0.5 text-sm text-slate-100 outline-none"
              />
            ) : (
              <div className="truncate font-medium text-slate-200">
                {session.title || "Untitled"}
              </div>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500">
                {formatDate(session.last_active || session.started_at)}
              </span>
              {session.model && (
                <span className="text-xs text-slate-600 truncate">
                  {session.model}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-50" onClick={closeMenu} />
          <div
            className="fixed z-50 w-40 py-1 rounded-lg bg-slate-800 border border-slate-700 shadow-xl text-sm"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              onClick={handleRename}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <Pencil size={14} />
              Rename
            </button>
            <button
              onClick={() => { onDelete(); closeMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-900/30 text-red-400 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}
