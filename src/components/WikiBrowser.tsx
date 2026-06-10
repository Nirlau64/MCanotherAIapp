"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Markdown } from "@/components/Markdown";
import { HERMES_BASE_PATH } from "@/lib/api";
import {
  Search,
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Edit3,
  Save,
  X,
  Menu,
  BookOpen,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface TreeEntry {
  name: string;
  type: "file" | "dir";
  path: string;
}

interface SearchHit {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

interface FileData {
  content: string;
  mtime: string;
  size: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Preprocess [[Wiki Links]] into clickable markdown links. */
function preprocessWikiLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_m, inner) => {
    const [link, display] = inner.includes("|")
      ? inner.split("|", 2)
      : [inner, inner];
    const clean = link.trim();
    const label = display.trim();
    // Encode as wiki:// so the onClick handler can intercept
    const path = clean.endsWith(".md") ? clean : `${clean}.md`;
    return `[${label}](wiki://${encodeURIComponent(path)})`;
  });
}

// ── TreeNode ─────────────────────────────────────────────────────────

interface TreeNodeProps {
  entry: TreeEntry;
  depth: number;
  currentPath: string | null;
  expandedDirs: Set<string>;
  onFileClick: (path: string) => void;
  onDirToggle: (path: string) => void;
}

function TreeNode({
  entry,
  depth,
  currentPath,
  expandedDirs,
  onFileClick,
  onDirToggle,
}: TreeNodeProps) {
  const isExpanded = expandedDirs.has(entry.path);
  const isActive = currentPath === entry.path;
  const indent = depth * 16;

  if (entry.type === "dir") {
    return (
      <button
        className={`w-full flex items-center gap-1.5 text-left rounded-md transition-colors text-slate-400 hover:bg-indigo-500/10 text-[13px] font-medium py-1 px-2`}
        style={{ paddingLeft: 8 + indent }}
        onClick={() => onDirToggle(entry.path)}
      >
        <span className="text-[10px] w-3.5 text-center">
          {isExpanded ? (
            <ChevronDown size={12} className="inline" />
          ) : (
            <ChevronRight size={12} className="inline" />
          )}
        </span>
        {isExpanded ? (
          <FolderOpen size={14} className="shrink-0 text-amber-500/70" />
        ) : (
          <Folder size={14} className="shrink-0 text-amber-500/70" />
        )}
        <span className="truncate">{entry.name}</span>
      </button>
    );
  }

  return (
    <button
      className={`w-full flex items-center gap-1.5 text-left rounded-md transition-colors text-[13px] py-1 px-2 ${
        isActive
          ? "bg-indigo-500/15 text-indigo-400"
          : "text-slate-300 hover:bg-indigo-500/10"
      }`}
      style={{ paddingLeft: 8 + indent + 14 }}
      onClick={() => onFileClick(entry.path)}
    >
      <FileText size={13} className="shrink-0 text-slate-500" />
      <span className="truncate">{entry.name.replace(/\.md$/, "")}</span>
    </button>
  );
}

// ── WikiBrowser ──────────────────────────────────────────────────────

export default function WikiBrowser() {
  // ── Tree state ──
  const [treeCache, setTreeCache] = useState<Map<string, TreeEntry[]>>(
    new Map(),
  );
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(
    new Set([""]),
  );
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set());
  void loadingDirs; // consumed by setLoadingDirs pattern

  // ── Current file ──
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // ── Edit mode ──
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Search ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);

  // ── Mobile sidebar ──
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Refs ──
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ── Load directory tree ───────────────────────────────────────────

  const loadTree = useCallback(
    async (dir: string) => {
      if (treeCache.has(dir)) return;
      setLoadingDirs((prev) => new Set(prev).add(dir));
      try {
        const r = await fetch(
          `${HERMES_BASE_PATH}/api/wiki?tree=${encodeURIComponent(dir)}`,
        );
        const j = await r.json();
        if (j.entries) {
          setTreeCache((prev) => new Map(prev).set(dir, j.entries));
        }
      } catch {
        /* network error — silently ignore */
      } finally {
        setLoadingDirs((prev) => {
          const next = new Set(prev);
          next.delete(dir);
          return next;
        });
      }
    },
    [treeCache],
  );

  // Load root and pre-defined top-level dirs on mount
  useEffect(() => {
    loadTree("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load file ─────────────────────────────────────────────────────

  const loadFile = useCallback(async (filePath: string) => {
    setLoading(true);
    setEditing(false);
    setDirty(false);
    setFileError(null);
    try {
      const r = await fetch(
        `${HERMES_BASE_PATH}/api/wiki?path=${encodeURIComponent(filePath)}`,
      );
      const j = await r.json();
      if (j.error) {
        setFileError(j.error);
        setFileData(null);
        setCurrentPath(null);
      } else {
        setFileData(j);
        setCurrentPath(filePath);
      }
    } catch {
      setFileError("Failed to load file");
      setFileData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Save file ─────────────────────────────────────────────────────

  const saveFile = async () => {
    if (!currentPath) return;
    setSaving(true);
    try {
      const r = await fetch(
        `${HERMES_BASE_PATH}/api/wiki?path=${encodeURIComponent(currentPath)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent }),
        },
      );
      const j = await r.json();
      if (j.ok) {
        setFileData({ content: editContent, mtime: j.mtime, size: j.size });
        setDirty(false);
        setEditing(false);
      }
    } catch {
      /* save error */
    } finally {
      setSaving(false);
    }
  };

  // ── Search (debounced) ────────────────────────────────────────────

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const r = await fetch(
        `${HERMES_BASE_PATH}/api/wiki?search=${encodeURIComponent(query)}`,
      );
      const j = await r.json();
      setSearchResults(j.hits || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) doSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  // ── Toggle directory expansion ───────────────────────────────────

  const toggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
    loadTree(dirPath);
  };

  // ── Navigate to file ─────────────────────────────────────────────

  const navigateToFile = (filePath: string) => {
    // Expand all parent directories
    const parts = filePath.split("/");
    const dirsToExpand: string[] = [];
    for (let i = 0; i < parts.length - 1; i++) {
      dirsToExpand.push(parts.slice(0, i + 1).join("/"));
    }
    if (dirsToExpand.length > 0) {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        dirsToExpand.forEach((d) => next.add(d));
        return next;
      });
      dirsToExpand.forEach((d) => loadTree(d));
    }
    // Clear search
    setSearchResults(null);
    setSearchQuery("");
    setSidebarOpen(false);
    loadFile(filePath);
  };

  // ── Wiki-link click handler ──────────────────────────────────────

  const handleWikiLinkClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (href && href.startsWith("wiki://")) {
        e.preventDefault();
        const path = decodeURIComponent(href.slice(7));
        navigateToFile(path);
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Start / cancel editing ───────────────────────────────────────

  const startEdit = () => {
    setEditContent(fileData?.content || "");
    setEditing(true);
    setDirty(false);
    // Focus textarea on next tick
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDirty(false);
  };

  // ── Breadcrumbs from current path ────────────────────────────────

  const breadcrumbs = currentPath ? currentPath.split("/") : [];

  const getTitle = (p: string) => {
    const name = p.split("/").pop() || "";
    return name.replace(/\.md$/, "");
  };

  // ── Recursive tree render ────────────────────────────────────────

  const renderTree = (
    entries: TreeEntry[],
    depth: number,
  ): React.ReactNode[] => {
    return entries.map((entry) => (
      <div key={entry.path}>
        <TreeNode
          entry={entry}
          depth={depth}
          currentPath={currentPath}
          expandedDirs={expandedDirs}
          onFileClick={navigateToFile}
          onDirToggle={toggleDir}
        />
        {entry.type === "dir" &&
          expandedDirs.has(entry.path) &&
          treeCache.has(entry.path) && (
            <div>{renderTree(treeCache.get(entry.path)!, depth + 1)}</div>
          )}
      </div>
    ));
  };

  const rootEntries = treeCache.get("") || [];
  const isSearchActive = searchResults !== null;

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden bg-slate-950">
      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          flex flex-col shrink-0 h-full bg-slate-950 border-r border-slate-800
          w-[280px] max-w-[85vw]
          lg:relative lg:translate-x-0 lg:z-auto
          ${
            sidebarOpen
              ? "fixed left-0 top-0 z-50 translate-x-0"
              : "fixed left-0 top-0 z-50 -translate-x-full"
          }
          transition-transform duration-200 ease-in-out
        `}
      >
        {/* Sidebar header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-800">
          <button
            className="lg:hidden text-slate-400 hover:text-slate-200 p-1"
            onClick={() => setSidebarOpen(false)}
          >
            <Menu size={18} />
          </button>
          <BookOpen size={16} className="text-indigo-400 shrink-0" />
          <span className="font-semibold text-sm text-indigo-400 flex-1">
            Wiki
          </span>
        </div>

        {/* Search input */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchQuery("");
                  setSearchResults(null);
                }
              }}
              placeholder="Search wiki..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm
                         text-slate-100 placeholder:text-slate-500 outline-none
                         focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults(null);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Search results or tree */}
        <div className="flex-1 overflow-y-auto">
          {isSearchActive ? (
            <div className="px-2 py-1">
              <div className="text-[11px] text-slate-500 px-2 py-1.5">
                {searching ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" />
                    Searching...
                  </span>
                ) : (
                  `${searchResults!.length} result${searchResults!.length !== 1 ? "s" : ""}`
                )}
              </div>

              {searchResults!.map((hit) => (
                <button
                  key={hit.path}
                  className={`w-full text-left px-2 py-2 rounded-md mb-0.5 transition-colors ${
                    currentPath === hit.path
                      ? "bg-indigo-500/15"
                      : "hover:bg-slate-800/50"
                  }`}
                  onClick={() => navigateToFile(hit.path)}
                >
                  <div className="text-[13px] font-semibold text-indigo-400 truncate">
                    {hit.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                    {hit.snippet.slice(0, 140)}
                  </div>
                </button>
              ))}

              {searchResults!.length === 0 && !searching && (
                <div className="text-center text-slate-500 text-sm py-8">
                  No results
                </div>
              )}
            </div>
          ) : (
            <div className="py-1">
              {rootEntries.length === 0 ? (
                <div className="text-center text-slate-500 text-sm py-8">
                  <Loader2
                    size={18}
                    className="mx-auto mb-2 animate-spin text-slate-600"
                  />
                  Loading tree...
                </div>
              ) : (
                renderTree(rootEntries, 0)
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Content area ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header bar */}
        <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-950">
          <button
            className="text-slate-400 hover:text-slate-200 p-1"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} />
          </button>
          <BookOpen size={15} className="text-indigo-400" />
          <span className="font-semibold text-sm text-slate-200">
            {currentPath ? getTitle(currentPath) : "Wiki"}
          </span>
        </div>

        {/* Scrollable content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          {currentPath && fileData ? (
            <div className="p-4 sm:p-6 max-w-3xl">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {breadcrumbs.map((part, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <span className="text-slate-600 text-xs">/</span>
                    )}
                    <span
                      className={`text-xs ${
                        i === breadcrumbs.length - 1
                          ? "text-indigo-400 font-semibold"
                          : "text-slate-400"
                      }`}
                    >
                      {part.replace(/\.md$/, "")}
                    </span>
                  </span>
                ))}
              </div>

              {/* Title + actions */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-xl font-bold text-slate-100">
                  {getTitle(currentPath)}
                </h1>
                <div className="flex items-center gap-2 shrink-0">
                  {editing ? (
                    <>
                      <button
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500
                                   text-white text-[13px] font-semibold rounded-lg px-3 py-1.5
                                   transition-colors disabled:opacity-50"
                        onClick={saveFile}
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save size={13} />
                            Save
                          </>
                        )}
                      </button>
                      <button
                        className="flex items-center gap-1.5 border border-slate-700
                                   text-slate-400 hover:text-slate-200 hover:border-slate-600
                                   text-[13px] rounded-lg px-3 py-1.5 transition-colors"
                        onClick={cancelEdit}
                      >
                        <X size={13} />
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="flex items-center gap-1.5 border border-slate-700
                                 text-slate-400 hover:text-slate-200 hover:border-slate-600
                                 text-[13px] rounded-lg px-3 py-1.5 transition-colors"
                      onClick={startEdit}
                    >
                      <Edit3 size={13} />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* File metadata */}
              <div className="text-[12px] text-slate-500 mb-6">
                {fmtSize(fileData.size)} &middot;{" "}
                {new Date(fileData.mtime).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>

              {/* Content */}
              {editing ? (
                <div>
                  <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => {
                      setEditContent(e.target.value);
                      setDirty(true);
                    }}
                    className="w-full min-h-[60vh] bg-slate-900 border border-slate-700 rounded-lg
                               p-4 text-slate-200 text-sm font-mono leading-relaxed resize-y
                               outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30
                               transition-colors"
                    style={{ tabSize: 2 }}
                    spellCheck={false}
                  />
                  {dirty && (
                    <div className="flex items-center gap-1.5 mt-2 text-amber-400 text-[12px]">
                      <AlertTriangle size={13} />
                      Unsaved changes
                    </div>
                  )}
                </div>
              ) : (
                <div onClick={handleWikiLinkClick}>
                  <Markdown text={preprocessWikiLinks(fileData.content)} />
                </div>
              )}
            </div>
          ) : currentPath && loading ? (
            <div className="flex items-center justify-center h-full text-slate-500 gap-2">
              <Loader2 size={18} className="animate-spin" />
              Loading...
            </div>
          ) : currentPath && fileError ? (
            <div className="flex items-center justify-center h-full text-red-400 gap-2">
              <AlertTriangle size={18} />
              {fileError}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-slate-500 pt-[15vh]">
              <BookOpen size={48} className="mb-4 text-slate-700" />
              <div className="text-lg font-medium text-slate-400 mb-1">
                Wiki Browser
              </div>
              <div className="text-sm">
                Select a file from the tree or search to get started
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
