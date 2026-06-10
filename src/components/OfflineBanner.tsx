import { useState, useEffect } from "react";
import { onConnectivityChange, isOnline } from "@/sw-register";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => { return onConnectivityChange(setOnline); }, []);
  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-900/60 border-b border-amber-800/50 text-amber-200 text-xs">
      <WifiOff size={14} /><span>You are offline. Messages will be sent when you reconnect.</span>
    </div>
  );
}
