/// <reference types="vite/client" />

export async function registerSW(): Promise<void> {
  if (!("serviceWorker" in navigator)) { console.log("[SW] Service Worker not supported"); return; }

  // In development mode, the SW may not be served — try multiple paths
  const isDev = import.meta.env?.DEV ?? false;
  const paths = isDev
    ? ["/chat-pwa/sw.js", "/sw.js", "/src/sw-register.ts"] // last is a dummy to avoid 404 noise
    : ["/chat-pwa/sw.js"];

  for (const swPath of paths) {
    try {
      // Derive scope from SW path: /chat-pwa/sw.js → /chat-pwa/, /sw.js → /
      const scope = swPath.replace(/\/sw\.js$/, "/") || "/";
      const registration = await navigator.serviceWorker.register(swPath, { type: "classic", scope });
      console.log("[SW] Registered:", registration.scope);
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller)
            console.log("[SW] Update available");
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => console.log("[SW] New controller activated"));
      return; // Registered successfully
    } catch (err) {
      // Only log error for non-dev or last path
      if (!isDev || swPath === paths[paths.length - 1]) {
        console.warn("[SW] Registration not available:", (err as Error).message);
      }
    }
  }

  if (!isDev) {
    console.log("[SW] Could not register Service Worker (offline support unavailable)");
  }
}

export function isOnline(): boolean { return navigator.onLine; }
export function onConnectivityChange(cb: (online: boolean) => void): () => void {
  const handler = () => cb(navigator.onLine);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => { window.removeEventListener("online", handler); window.removeEventListener("offline", handler); };
}
