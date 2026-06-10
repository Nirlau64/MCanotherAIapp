import { useState, useRef, useEffect, useCallback } from "react";
import { useStore } from "@nanostores/react";
import { $gateway, $messages, type ChatMessage } from "@/lib/store";
import { Send, Slash, Paperclip, Upload } from "lucide-react";
import { indexMessage } from "@/lib/db";
import { VoiceRecorder } from "./VoiceRecorder";
import { addToast } from "@/lib/toast";

interface Props { sessionId: string; persistentId?: string; disabled?: boolean; }

const SLASH_COMMANDS = [
  { name: "/new", category: "Session", description: "Create a new session" },
  { name: "/title", category: "Session", description: "Rename current session", args: "<title>" },
  { name: "/model", category: "Config", description: "Show/change model" },
  { name: "/compact", category: "Session", description: "Compact conversation context" },
  { name: "/resume", category: "Session", description: "Resume a session", args: "<id>" },
  { name: "/research", category: "Research", description: "Deep research on a topic", args: "<topic>" },
  { name: "/help", category: "Meta", description: "Show available commands" },
  { name: "/clear", category: "Session", description: "Clear current messages" },
  { name: "/retry", category: "Session", description: "Retry last prompt" },
];

/** Read a File as a base64 data URL */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** Format file size for display */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function ChatInput({ sessionId, persistentId, disabled }: Props) {
  const [text, setText] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gw = useStore($gateway);

  const filteredCommands = SLASH_COMMANDS.filter((c) => !slashFilter || c.name.includes(slashFilter));

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [text]);

  useEffect(() => {
    if (text.startsWith("/") && !text.includes(" ")) {
      setShowSlash(true);
      setSlashFilter(text);
      setSlashIndex(0);
    } else {
      setShowSlash(false);
    }
  }, [text]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !gw || gw.state !== "open" || disabled) return;

    if (trimmed.startsWith("/")) {
      try {
        await gw.request("slash.exec", { command: trimmed.slice(1), session_id: sessionId });
      } catch {
        await sendAsMessage(trimmed);
      }
    } else {
      await sendAsMessage(trimmed);
    }

    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [text, gw, sessionId, disabled]);

  async function sendAsMessage(content: string) {
    if (!gw) return;

    // Read attached files as base64 data URIs
    let fileContent = "";
    if (attachedFiles.length > 0) {
      const fileInfos: string[] = [];
      for (const file of attachedFiles) {
        try {
          const dataUrl = await readFileAsDataURL(file);
          fileInfos.push(`[File: ${file.name} (${formatFileSize(file.size)})]\n${dataUrl}`);
        } catch (err) {
          console.error("[ChatInput] Failed to read file:", file.name, err);
        }
      }
      if (fileInfos.length > 0) {
        fileContent = fileInfos.join("\n\n") + (content ? "\n\n" : "");
      }
    }

    const fullContent = fileContent + content;
    const msgId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = { id: msgId, role: "user", text: fullContent, timestamp: new Date().toISOString() };
    $messages.set([...$messages.get(), userMsg]);
    // Index for search
    void indexMessage({ id: msgId, sessionId: persistentId || sessionId, role: "user", text: fullContent, timestamp: new Date().toISOString() });
    try {
      await gw.request("prompt.submit", { session_id: sessionId, text: fullContent });
    } catch (err) {
      console.error("[ChatInput] prompt.submit failed:", err);
    }

    // Clear attachments after sending
    setAttachedFiles([]);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlash) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((i) => Math.min(i + 1, filteredCommands.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredCommands[slashIndex]) { setText(filteredCommands[slashIndex].name + " "); setShowSlash(false); }
        return;
      }
      if (e.key === "Escape") { setShowSlash(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  // ── File Handling ───────────────────────────────────

  const handleFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).filter((f) => {
      // Accept common types
      const validTypes = /^(image\/|audio\/|video\/|text\/|application\/(pdf|json|xml|yaml|yml))/;
      return validTypes.test(f.type) || f.name.match(/\.(md|txt|csv|log|py|js|ts|tsx|jsx|html|css|json|yaml|yml|toml|xml)$/i);
    });
    setAttachedFiles((prev) => [...prev, ...newFiles].slice(0, 10));
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const file = items[i].getAsFile();
      if (file) files.push(file);
    }
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  }, [handleFiles]);

  // ── Voice Recording ──────────────────────────────────

  const handleRecordingComplete = useCallback((blob: Blob, durationMs: number) => {
    // Attach the voice recording as a file
    const file = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
    setAttachedFiles((prev) => [...prev, file].slice(0, 10));
    const secs = (durationMs / 1000).toFixed(1);
    addToast(`Voice recording attached (${secs}s)`, "info");
  }, []);

  return (
    <div
      className={`shrink-0 border-t border-slate-800 bg-slate-900/80 backdrop-blur safe-bottom ${isDragOver ? "ring-2 ring-indigo-500" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        accept="image/*,audio/*,video/*,text/*,application/pdf,application/json,.md,.txt,.csv,.log,.py,.js,.ts,.tsx,.jsx,.html,.css,.yaml,.yml,.toml,.xml"
      />

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-slate-800 border border-indigo-500/30 rounded-xl px-4 py-2 text-sm text-indigo-300">
            <Upload size={18} className="inline mr-2" />
            Drop files to attach
          </div>
        </div>
      )}

      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-2">
          {attachedFiles.map((file, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-300">
              <Paperclip size={12} className="text-slate-500" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <span className="text-slate-600">({(file.size / 1024).toFixed(0)}KB)</span>
              <button
                onClick={() => removeFile(i)}
                className="ml-1 text-slate-500 hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {showSlash && filteredCommands.length > 0 && (
        <div className="px-4 pb-1">
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
            {filteredCommands.map((cmd, i) => (
              <button key={cmd.name} onClick={() => { setText(cmd.name + " "); setShowSlash(false); }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition-colors ${i === slashIndex ? "bg-indigo-900/50 text-indigo-300" : "text-slate-300 hover:bg-slate-700"}`}>
                <Slash size={14} className="text-slate-500 shrink-0" />
                <span className="font-mono font-medium">{cmd.name}</span>
                {cmd.args && <span className="text-slate-500 text-xs">{cmd.args}</span>}
                <span className="flex-1" />
                <span className="text-xs text-slate-600">{cmd.category}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-end gap-2 px-4 py-3">
        <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={disabled ? "Waiting for response..." : "Message Hermes... (Shift+Enter for newline)"} disabled={disabled} rows={1}
          className="flex-1 bg-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-sm placeholder:text-slate-500 resize-none outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed max-h-[200px]" />
        <button
          onClick={handleFilePicker}
          disabled={disabled}
          className="p-2.5 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          title="Attach files"
        >
          <Paperclip size={18} />
        </button>
        <VoiceRecorder
          onRecordingComplete={handleRecordingComplete}
          disabled={disabled}
        />
        <button onClick={() => void handleSend()} disabled={!text.trim() || disabled}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
          <Send size={18} className="text-white" />
        </button>
      </div>
    </div>
  );
}
