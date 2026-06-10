/**
 * Hermes Chat PWA — API helpers
 *
 * Thin wrapper around fetch() for the Hermes Dashboard API.
 * The PWA is served by the same origin as the dashboard, so
 * relative URLs work in production; in dev, Vite proxies /api.
 */

// Injected by the server into index.html
declare global {
  interface Window {
    __HERMES_SESSION_TOKEN__?: string;
    __HERMES_BASE_PATH__?: string;
    __HERMES_AUTH_REQUIRED__?: boolean;
  }
}

function readBasePath(): string {
  if (typeof window === "undefined") return "";
  const raw = window.__HERMES_BASE_PATH__ ?? "";
  if (!raw) return "";
  const withLead = raw.startsWith("/") ? raw : `/${raw}`;
  return withLead.replace(/\/+$/, "");
}

export const HERMES_BASE_PATH = readBasePath();
const BASE = HERMES_BASE_PATH;

interface FetchJSONOptions {
  allowUnauthorized?: boolean;
}

export async function fetchJSON<T>(
  url: string,
  init?: RequestInit,
  options?: FetchJSONOptions,
): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = window.__HERMES_SESSION_TOKEN__;
  if (token && !headers.has("X-Hermes-Session-Token")) {
    headers.set("X-Hermes-Session-Token", token);
  }

  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers,
    credentials: init?.credentials ?? "include",
  });

  if (!res.ok) {
    // Auto-reload on stale token (loopback mode only)
    if (
      res.status === 401 &&
      !window.__HERMES_AUTH_REQUIRED__ &&
      !options?.allowUnauthorized
    ) {
      let alreadyReloaded = false;
      try {
        alreadyReloaded =
          sessionStorage.getItem("hermes.tokenReloadAttempted") === "1";
      } catch { /* ignore */ }
      if (!alreadyReloaded) {
        try {
          sessionStorage.setItem("hermes.tokenReloadAttempted", "1");
        } catch { /* ignore */ }
        window.location.reload();
        return new Promise<T>(() => {});
      }
    }

    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }

  // Clear stale-token guard on success
  try {
    sessionStorage.removeItem("hermes.tokenReloadAttempted");
  } catch { /* ignore */ }

  return res.json();
}

/** Fetch a single-use ticket for WebSocket upgrade in gated mode. */
export async function getWsTicket(): Promise<{
  ticket: string;
  ttl_seconds: number;
}> {
  const res = await fetch(`${BASE}/api/auth/ws-ticket`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`/api/auth/ws-ticket: HTTP ${res.status}`);
  }
  return res.json();
}

/** Build the auth query param for a WebSocket connect. */
export async function buildWsAuthParam(): Promise<[string, string]> {
  if (window.__HERMES_AUTH_REQUIRED__) {
    const { ticket } = await getWsTicket();
    return ["ticket", ticket];
  }
  const token = window.__HERMES_SESSION_TOKEN__ ?? "";
  return ["token", token];
}

/** Build an absolute ws(s):// URL for a dashboard WebSocket endpoint. */
export async function buildWsUrl(
  path: string,
  params?: Record<string, string>,
): Promise<string> {
  const [authName, authValue] = await buildWsAuthParam();
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const qs = new URLSearchParams(params ?? {});
  qs.set(authName, authValue);
  return `${proto}//${window.location.host}${BASE}${path}?${qs}`;
}
