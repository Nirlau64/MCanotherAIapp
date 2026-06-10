/**
 * Export conversation as Markdown or JSON download.
 */

import type { ChatMessage } from "@/lib/store";

/** Export messages as a Markdown string. */
export function toMarkdown(messages: ChatMessage[], title?: string): string {
  const lines: string[] = [];

  if (title) {
    lines.push(`# ${title}`);
    lines.push("");
  }

  lines.push(`> Exported ${new Date().toLocaleString()}`);
  lines.push("");

  for (const msg of messages) {
    const roleLabel = msg.role === "user" ? "**You**" : msg.role === "assistant" ? "**Hermes**" : "**System**";
    lines.push(`### ${roleLabel}`);
    lines.push("");
    lines.push(msg.text);
    lines.push("");
  }

  return lines.join("\n");
}

/** Export messages as a JSON string. */
export function toJSON(messages: ChatMessage[], title?: string): string {
  return JSON.stringify(
    {
      title: title ?? "Untitled",
      exported_at: new Date().toISOString(),
      message_count: messages.length,
      messages: messages.map((m) => ({
        role: m.role,
        text: m.text,
        timestamp: m.timestamp,
        ...(m.usage ? { usage: m.usage } : {}),
      })),
    },
    null,
    2,
  );
}

/** Trigger a file download in the browser. */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export the given messages and trigger download. */
export function exportConversation(
  messages: ChatMessage[],
  format: "md" | "json",
  title?: string,
) {
  const safeTitle = (title || "hermes-chat").replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

  if (format === "md") {
    const md = toMarkdown(messages, title);
    downloadFile(md, `${safeTitle}_${timestamp}.md`, "text/markdown");
  } else {
    const json = toJSON(messages, title);
    downloadFile(json, `${safeTitle}_${timestamp}.json`, "application/json");
  }
}
