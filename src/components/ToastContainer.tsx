import { useStore } from "@nanostores/react";
import { $toasts, dismissToast } from "@/lib/toast";
import { X, Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const colorMap = {
  info: "border-slate-700 bg-slate-800 text-slate-200",
  success: "border-emerald-800 bg-emerald-900/80 text-emerald-200",
  warning: "border-amber-800 bg-amber-900/80 text-amber-200",
  error: "border-red-800 bg-red-900/80 text-red-200",
};

const iconColorMap = {
  info: "text-slate-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

export function ToastContainer() {
  const toasts = useStore($toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const Icon = iconMap[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 px-3 py-2.5 rounded-lg border shadow-lg text-sm animate-in slide-in-from-right ${colorMap[t.type]}`}
          >
            <Icon size={16} className={`shrink-0 mt-0.5 ${iconColorMap[t.type]}`} />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
