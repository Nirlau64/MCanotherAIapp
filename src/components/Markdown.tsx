import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps { text: string; }

/** Renders markdown text using react-markdown with GFM (tables, lists, links, etc). */
export const Markdown = memo(function Markdown({ text }: MarkdownProps) {
  return (
    <div className="
      max-w-none break-words text-sm leading-relaxed text-slate-200
      [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-100 [&_h1]:mt-3 [&_h1]:mb-1
      [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-100 [&_h2]:mt-2 [&_h2]:mb-1
      [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-200 [&_h3]:mt-2 [&_h3]:mb-0.5
      [&_p]:my-0.5
      [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc
      [&_ol]:my-1 [&_ol]:pl-4 [&_ol]:list-decimal
      [&_li]:my-0
      [&_code]:bg-slate-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-indigo-300
      [&_pre]:bg-slate-900 [&_pre]:border [&_pre]:border-slate-700/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:font-mono
      [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_table]:text-xs
      [&_th]:border [&_th]:border-slate-600 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-slate-400 [&_th]:font-medium [&_th]:bg-slate-800/50
      [&_td]:border [&_td]:border-slate-700/50 [&_td]:px-2 [&_td]:py-1
      [&_a]:text-indigo-400 [&_a]:underline [&_a]:hover:text-indigo-300
      [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-600 [&_blockquote]:pl-3 [&_blockquote]:text-slate-400 [&_blockquote]:italic [&_blockquote]:my-2
      [&_hr]:border-slate-700 [&_hr]:my-2
      [&_strong]:text-slate-100 [&_strong]:font-semibold
      [&_em]:italic
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
