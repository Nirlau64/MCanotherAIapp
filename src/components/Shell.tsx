import { useStore } from "@nanostores/react";
import { $sidebarOpen, $toolPanelOpen, $messages, $gateway, $activePersistentId } from "@/lib/store";
import { useGateway, useSessions, useActiveSession } from "@/hooks/useGateway";
import { SessionList } from "./SessionList";
import { ChatView } from "./ChatView";
import { ToolPanel } from "./ToolPanel";
import { ToastContainer } from "./ToastContainer";
import { SearchBar, $searchOpen } from "./SearchBar";
import { ArtifactPanel } from "./ArtifactPanel";
import { DocumentEditor } from "./DocumentEditor";
import { OfflineBanner } from "./OfflineBanner";
import {
  DocumentsPanel,
  ComparePanel,
  ContextInfo,
  CompactButton,
  $docsOpen,
  $contextInfoOpen,
} from "./LuxusFeatures";
import SystemMonitor from "./SystemMonitor";
import WikiBrowser from "./WikiBrowser";
import ModelManager from "./ModelManager";
import {
  Menu, X, MessageSquarePlus, Wrench, Zap, Download,
  BookOpen, FolderOpen, Monitor, Cpu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { exportConversation } from "@/lib/export";
import { addToast } from "@/lib/toast";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

type View = "chat" | "monitor" | "wiki" | "models";

const VIEWS: { id: View; label: string; icon: typeof MessageSquarePlus }[] = [
  { id: "chat", label: "Chat", icon: MessageSquarePlus },
  { id: "monitor", label: "Monitor", icon: Monitor },
  { id: "wiki", label: "Wiki", icon: BookOpen },
  { id: "models", label: "Models", icon: Cpu },
];

export function Shell() {
  const { gwState } = useGateway();
  const { sessions, refresh } = useSessions();
  const { activeId, activate, create, rename, remove } = useActiveSession();
  const sidebarOpen = useStore($sidebarOpen);
  const toolPanelOpen = useStore($toolPanelOpen);
  const docsOpen = useStore($docsOpen);
  const contextInfoOpen = useStore($contextInfoOpen);
  const gateway = useStore($gateway);
  const persistentId = useStore($activePersistentId);
  const [view, setView] = useState<View>("chat");

  useEffect(() => {
    if (gwState === "open" && sessions.length > 0 && !activeId) {
      activate(sessions[0].id);
    }
  }, [gwState, sessions, activeId]);

  useEffect(() => {
    if (gwState === "open") refresh();
  }, [gwState]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => $searchOpen.set(true),
    onNewSession: () => void create(),
    onExport: () => {
      const msgs = $messages.get();
      const session = sessions.find((s) => s.id === activeId);
      exportConversation(msgs, "md", session?.title);
      addToast("Exported as Markdown", "success");
    },
    onEscape: () => {
      $sidebarOpen.set(false);
      $toolPanelOpen.set(false);
      $searchOpen.set(false);
    },
  });

  const statusColor =
    gwState === "open"
      ? "bg-emerald-500"
      : gwState === "connecting"
        ? "bg-amber-500 animate-pulse"
        : gwState === "error"
          ? "bg-red-500"
          : "bg-slate-600";

  return (
    <div className="flex h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => $sidebarOpen.set(false)}
        />
      )}

      {/* Desktop View Icon Bar */}
      <nav className="hidden lg:flex flex-col items-center gap-1 py-3 px-1.5 bg-slate-900/70 border-r border-slate-800 shrink-0">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`p-2 rounded-lg transition-colors flex flex-col items-center gap-0.5 w-14 ${
                active
                  ? "bg-indigo-900/30 text-indigo-400"
                  : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
              }`}
              title={v.label}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{v.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Session Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800
          transform transition-transform duration-200 lg:relative lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="font-semibold text-sm">Atlas</span>
          </div>
          <div className="flex items-center gap-1">
            {view === "chat" && (
              <button
                onClick={() => void create()}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="New Session"
              >
                <MessageSquarePlus size={18} />
              </button>
            )}
            <button
              onClick={() => $sidebarOpen.set(false)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 lg:hidden transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <SessionList
          sessions={sessions}
          activeId={persistentId}
          onSelect={(id) => {
            void activate(id);
            $sidebarOpen.set(false);
            setView("chat");
          }}
          onRename={(id, title) => void rename(id, title)}
          onDelete={(id) => void remove(id)}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/50 shrink-0">
          <button
            onClick={() => $sidebarOpen.set(true)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 lg:hidden transition-colors"
          >
            <Menu size={20} />
          </button>

          {/* Mobile View Tabs */}
          <div className="flex lg:hidden items-center gap-1 flex-1">
            {VIEWS.map((v) => {
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    active
                      ? "bg-indigo-900/30 text-indigo-400"
                      : "text-slate-500 hover:bg-slate-800"
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 hidden lg:block" />

          {/* Chat-only toolbar buttons */}
          {view === "chat" && (
            <>
              <CompactButton gateway={gateway} sessionId={activeId} />
              <button
                onClick={() => $contextInfoOpen.set(!contextInfoOpen)}
                className={`p-1.5 rounded-lg transition-colors ${
                  contextInfoOpen
                    ? "bg-purple-900/50 text-purple-400"
                    : "hover:bg-slate-800 text-slate-400"
                }`}
                title="Context Info"
              >
                <BookOpen size={18} />
              </button>
              <button
                onClick={() => $docsOpen.set(!docsOpen)}
                className={`p-1.5 rounded-lg transition-colors ${
                  docsOpen
                    ? "bg-amber-900/50 text-amber-400"
                    : "hover:bg-slate-800 text-slate-400"
                }`}
                title="Documents"
              >
                <FolderOpen size={18} />
              </button>
              <button
                onClick={() => {
                  const msgs = $messages.get();
                  const session = sessions.find((s) => s.id === activeId);
                  exportConversation(msgs, "md", session?.title);
                  addToast("Exported as Markdown", "success");
                }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors"
                title="Export conversation (Ctrl+E)"
              >
                <Download size={18} />
              </button>
              <button
                onClick={() => $toolPanelOpen.set(!toolPanelOpen)}
                className={`p-1.5 rounded-lg transition-colors ${
                  toolPanelOpen
                    ? "bg-indigo-900/50 text-indigo-400"
                    : "hover:bg-slate-800 text-slate-400"
                }`}
                title="Tool Panel"
              >
                <Wrench size={18} />
              </button>
            </>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Zap size={12} />
            <span>{gwState}</span>
          </div>
        </header>

        <OfflineBanner />

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            {view === "chat" && (
              activeId ? (
                <ChatView sessionId={activeId} persistentId={persistentId ?? undefined} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Zap size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="text-lg">No session selected</p>
                    <button
                      onClick={() => void create()}
                      className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
                    >
                      New Session
                    </button>
                  </div>
                </div>
              )
            )}
            {view === "monitor" && <SystemMonitor />}
            {view === "wiki" && <WikiBrowser />}
            {view === "models" && <ModelManager />}
          </div>
          {view === "chat" && toolPanelOpen && (
            <div className="w-72 border-l border-slate-800 bg-slate-900/50 shrink-0 hidden lg:block">
              <ToolPanel />
            </div>
          )}
          {view === "chat" && (
            <>
              <ArtifactPanel />
              <DocumentEditor />
              <DocumentsPanel />
              <ComparePanel />
              <ContextInfo sessionId={activeId} />
            </>
          )}
        </div>
      </main>

      <ToastContainer />
      <SearchBar />
    </div>
  );
}
