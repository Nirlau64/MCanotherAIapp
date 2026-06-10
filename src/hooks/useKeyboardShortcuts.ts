/**
 * Global keyboard shortcuts for the Chat PWA.
 *
 * Usage in Shell:
 *   useKeyboardShortcuts({
 *     onSearch: () => $searchOpen.set(true),
 *     onNewSession: () => void create(),
 *     onExport: () => exportSession(),
 *   })
 */

import { useEffect } from "react";

export interface ShortcutHandlers {
  /** Ctrl+K / Cmd+K */
  onSearch?: () => void;
  /** Ctrl+N / Cmd+N */
  onNewSession?: () => void;
  /** Ctrl+E / Cmd+E */
  onExport?: () => void;
  /** Escape — close panels / dialogs */
  onEscape?: () => void;
  /** Ctrl+Shift+N — new session (alternative) */
  onNewSessionAlt?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Don't capture when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (mod && e.key === "k") {
        e.preventDefault();
        handlers.onSearch?.();
      } else if (mod && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        handlers.onNewSession?.();
      } else if (mod && e.key === "e") {
        e.preventDefault();
        handlers.onExport?.();
      } else if (e.key === "Escape") {
        handlers.onEscape?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
