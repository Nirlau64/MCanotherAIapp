import { Markdown } from "./Markdown";
import { ThinkingBlock } from "./ThinkingBlock";

interface Props { text: string; thinkingText?: string; }

export function StreamingMessage({ text, thinkingText }: Props) {
  if (!text) {
    return (
      <div className="flex justify-start">
        <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
          <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse rounded-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] bg-slate-800 text-slate-100 rounded-2xl rounded-bl-md px-4 py-3 text-sm">
        {thinkingText && <ThinkingBlock thinking={thinkingText} defaultOpen />}
        <Markdown text={text} />
        <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse rounded-sm ml-0.5 align-middle" />
      </div>
    </div>
  );
}
