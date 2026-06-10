import { useState, useCallback } from "react";
import { X, Download, Maximize2, Minimize2, FileText, Music } from "lucide-react";

export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface Props {
  attachment: FileAttachment;
  onClose?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreview({ attachment, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isImage = attachment.type.startsWith("image/");
  const isPdf = attachment.type === "application/pdf";
  const isAudio = attachment.type.startsWith("audio/");

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = attachment.dataUrl;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [attachment.dataUrl, attachment.name]);

  return (
    <>
      <div className="inline-block max-w-full rounded-lg overflow-hidden border border-slate-700 bg-slate-800/50">
        {isImage && (
          <div className="relative group cursor-pointer" onClick={() => !imgError && setLightboxOpen(true)}>
            {imgError ? (
              <div className="flex items-center justify-center w-[300px] h-[200px] bg-slate-800/80 text-slate-500 text-xs">
                <div className="text-center">
                  <FileText size={24} className="mx-auto mb-1 opacity-50" />
                  Failed to load image
                </div>
              </div>
            ) : (
              <img
                src={attachment.dataUrl}
                alt={attachment.name}
                className={`object-cover ${expanded ? "max-w-full" : "max-w-[300px] max-h-[200px]"}`}
                loading="lazy"
                onError={() => setImgError(true)}
              />
            )}
            {!imgError && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Maximize2 size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        )}
        {isPdf && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={18} className="text-red-400" />
              <span className="text-sm font-medium text-slate-200 truncate flex-1">{attachment.name}</span>
              <span className="text-xs text-slate-500">{formatSize(attachment.size)}</span>
              <button onClick={handleDownload} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200" title="Download PDF">
                <Download size={14} />
              </button>
            </div>
            {expanded ? (
              <div className="relative">
                <iframe src={attachment.dataUrl} className="w-full h-[400px] rounded border border-slate-700 bg-white" title={attachment.name} />
                <button onClick={() => setExpanded(false)} className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded hover:bg-slate-800"><Minimize2 size={16} className="text-slate-300" /></button>
              </div>
            ) : <button onClick={() => setExpanded(true)} className="text-xs text-indigo-400 hover:text-indigo-300">Click to preview</button>}
          </div>
        )}
        {isAudio && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Music size={18} className="text-emerald-400" />
              <span className="text-sm font-medium text-slate-200 truncate flex-1">{attachment.name}</span>
              <span className="text-xs text-slate-500">{formatSize(attachment.size)}</span>
              <button onClick={handleDownload} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200" title="Download Audio">
                <Download size={14} />
              </button>
            </div>
            <audio controls className="w-full h-8" src={attachment.dataUrl} />
          </div>
        )}
        {!isImage && !isPdf && !isAudio && (
          <div className="p-3 flex items-center gap-3">
            <FileText size={24} className="text-slate-500" />
            <div className="min-w-0 flex-1"><div className="text-sm font-medium text-slate-200 truncate">{attachment.name}</div><div className="text-xs text-slate-500">{formatSize(attachment.size)}</div></div>
            <button onClick={handleDownload} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200"><Download size={18} /></button>
          </div>
        )}
        {isImage && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-700/50">
            <span className="text-xs text-slate-400 truncate flex-1">{attachment.name}</span>
            <span className="text-xs text-slate-500">{formatSize(attachment.size)}</span>
            <button onClick={handleDownload} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"><Download size={14} /></button>
            {onClose && <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"><X size={14} /></button>}
          </div>
        )}
      </div>
      {lightboxOpen && isImage && !imgError && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer" onClick={() => setLightboxOpen(false)}>
          <button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white"><X size={24} /></button>
          <img src={attachment.dataUrl} alt={attachment.name} className="max-w-full max-h-full object-contain rounded" onClick={(e) => e.stopPropagation()} />
          <button onClick={handleDownload} className="absolute bottom-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white"><Download size={20} /></button>
        </div>
      )}
    </>
  );
}
