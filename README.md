# Atlas — Unified AI Assistant Web UI

Merge von **Hermes Chat PWA** (Nirlau) + **Atlas Web Dashboard** (Shinjur).
Eine Codebase, zwei Deployment-Modi. Beide Use Cases abgedeckt.

## 📁 Projektstruktur

```
MCanotherAIapp/
├── src/                         # React PWA (Vite + TypeScript + Tailwind)
│   ├── components/
│   │   ├── ChatView.tsx          # Chat mit WebSocket-Streaming (Hermes Mode)
│   │   ├── ChatInput.tsx         # Eingabezeile + File-Upload + Voice
│   │   ├── MessageBubble.tsx     # Einzelne Chat-Nachricht (Markdown, Media-Links)
│   │   ├── StreamingMessage.tsx  # Live-Streaming Assistant-Nachricht
│   │   ├── ThinkingBlock.tsx     # Collapsible "Denkprozess" (aus Atlas portiert)
│   │   ├── Markdown.tsx          # Markdown-Renderer (react-markdown + highlight.js)
│   │   ├── ToolCallBubble.tsx    # Tool-Call Anzeige (live + History)
│   │   ├── ToolPanel.tsx         # Seitenpanel für aktive Tools
│   │   ├── TokenBar.tsx          # Token-Usage Anzeige
│   │   ├── VoiceRecorder.tsx     # Sprachaufnahme
│   │   ├── PromptRequestBubble.tsx # Clarify/Approval/Sudo-Dialoge
│   │   ├── SearchBar.tsx         # Volltextsuche (Ctrl+K) via IndexedDB
│   │   ├── SessionList.tsx       # Session-Liste mit Suche + Gruppierung
│   │   ├── Shell.tsx             # App-Shell: Navigation, Layout, View-Switcher
│   │   ├── SystemMonitor.tsx     # System-Dashboard (CPU, RAM, Disks, Docker, NAS)
│   │   ├── WikiBrowser.tsx       # Wiki-Browser (Tree, Suche, Edit)
│   │   ├── ModelManager.tsx      # Model-Verwaltung (CRUD pro Provider)
│   │   ├── DocumentEditor.tsx    # Einzeldatei-Editor
│   │   ├── ArtifactPanel.tsx     # Artefakt-Vorschau
│   │   ├── LuxusFeatures.tsx     # DocumentsPanel, ComparePanel, ContextInfo, CompactButton
│   │   ├── OfflineBanner.tsx     # Offline-Status-Banner
│   │   ├── ToastContainer.tsx    # Toast-Notifications
│   │   └── FilePreview.tsx       # Datei-Vorschau (aktuell verwaist, siehe TODOs)
│   ├── hooks/
│   │   ├── useGateway.ts         # WebSocket-Verbindung, Session-Management
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useSwipe.ts           # Touch-Swipe für Session-Delete
│   ├── lib/
│   │   ├── gateway.ts            # GatewayClient (WebSocket JSON-RPC)
│   │   ├── store.ts              # Nanostores (State Management)
│   │   ├── api.ts                # HTTP API Helpers (fetchJSON, buildWsAuthParam)
│   │   ├── db.ts                 # IndexedDB für Volltextsuche
│   │   ├── export.ts             # Chat-Export (Markdown)
│   │   ├── toast.ts              # Toast-State
│   │   └── usage-cache.ts        # Token-Usage Caching
│   ├── App.tsx                   # Root-Komponente
│   ├── main.tsx                  # Entry Point
│   ├── sw-register.ts            # Service Worker Registration
│   └── index.css                 # Tailwind + Custom Styles
├── server/
│   ├── index.js                  # Pi-Kompatibilitätsserver (Express)
│   └── package.json
├── public/
│   ├── manifest.json             # PWA Manifest
│   ├── sw.js                     # Service Worker
│   └── favicon.svg, icon-*.png
├── index.html                    # Vite Entry HTML
├── vite.config.ts                # Vite Konfiguration
├── tsconfig.json                 # TypeScript Konfiguration
├── package.json                  # Frontend Dependencies
└── README.md                     # Diese Datei
```

## 🏗️ Architektur-Entscheidungen

### Warum Vite statt Next.js?
- Hermes PWA hat bessere PWA-Integration (Service Worker, Offline, Installable)
- Nanostores für State Management (kein Prop-Drilling)
- Tailwind statt Inline-Styles (wartbarer, konsistenter)
- WebSocket-First (nicht `spawn(pi)` pro Request)

### Warum zwei Backend-Modi?
- **Hermes Mode**: WebSocket zum Hermes Gateway (Session-Caching, Multi-Turn, Discord-Crosspost)
- **Pi Mode**: HTTP API via Express → `pi` CLI Subprozess (Standalone, kein Gateway nötig)

### Was aus Atlas übernommen wurde:
- System Monitor (CPU, RAM, Disks, Docker, NAS)
- Wiki Browser (Tree, Suche, Edit, Wiki-Links)
- Model Manager (CRUD UI)
- Thinking Blocks (Collapsible Denkprozess)
- Session-Suche (Debounced Filter)
- Dark-Only Design-Prinzip

### Was aus Hermes PWA erhalten blieb:
- WebSocket Gateway Architektur
- Nanostores State Management
- PWA Features (Service Worker, Offline, Installable)
- File Upload / Voice Recording
- Tool Panel + Artifact Panel
- IndexedDB Volltextsuche
- Session Compacting
- Discord Cross-Posting

## 🚀 Deployment

### Hermes Mode (Nirlau)

```bash
# Bauen
npm install
npm run build          # → dist/

# Ins Hermes-Monorepo kopieren
cp -r dist/* ~/.hermes/hermes-agent/hermes_cli/chat_pwa_dist/

# Dashboard neustarten
systemctl --user restart hermes-dashboard
# → http://localhost:9119/
```

### Pi Mode (Shinjur)

```bash
# Frontend bauen
npm install
npm run build          # → dist/

# Backend starten
cd server && npm install
HERMES_MODE=pi \
  PI_BIN=pi \
  VAULT_PATH=/home/shinjur/obsidian-vault/MainVault \
  ATLAS_CWD=/home/shinjur \
  NAS_IP=192.168.1.100 \
  node index.js
# → http://localhost:3000
```

## 🔧 Umgebungsvariablen

| Variable | Mode | Pflicht | Default | Beschreibung |
|----------|------|---------|---------|-------------|
| `HERMES_MODE` | Beide | Nein | — | `"pi"` aktiviert Pi-Mode (sonst Hermes) |
| `HERMES_DASHBOARD_URL` | Hermes | Nein | `http://127.0.0.1:9119` | Gateway/Dashboard URL |
| `PI_BIN` | Pi | Nein | `pi` | Pfad zum Pi-CLI-Binary |
| `PI_CONTEXT` | Pi | Nein | `~/.pi/agent/PI-CONTEXT.md` | System Prompt Datei |
| `ATLAS_CWD` | Pi | Nein | `$HOME` | Working Directory für pi |
| `VAULT_PATH` | Pi | Ja | `~/obsidian-vault/MainVault` | Pfad zum Obsidian Vault |
| `ATLAS_MODELS_PATH` | Pi | Nein | `~/.pi/agent/atlas-web-models.json` | Custom Models Store |
| `NAS_IP` | Pi | Nein | `192.168.1.100` | Synology NAS IP |
| `PORT` | Pi | Nein | `3000` | Server Port |

## ⚠️ Bekannte Probleme (Known Issues)

### 1. System Monitor: NAS-Daten sind Stubs
**Betrifft:** Pi Mode  
**Symptom:** NAS-Sektion zeigt "Offline", keine Plattendaten  
**Ursache:** Die SSH-Logik aus Atlas' `/api/monitor` (diskprediction.json parsen etc.) wurde noch nicht in `server/index.js` portiert. Der Express-Server hat nur einen Stub.  
**Fix:** SSH-Calls + diskprediction-Parsing aus `reference/atlas-web/app/api/monitor/route.ts` (Zeilen 147-235) nach `server/index.js` portieren.

### 2. Hermes Mode: Kein `system.monitor` Gateway RPC
**Betrifft:** Hermes Mode  
**Symptom:** SystemMonitor fragt `/api/monitor` per HTTP ab — das funktioniert nur wenn der Express-Server parallel läuft  
**Ursache:** Der Hermes Gateway hat keinen `system.monitor` RPC-Handler. Die PWA nutzt aktuell HTTP-Fallback.  
**Fix:** Python-Handler im Gateway (`tui_gateway/server.py`) registrieren, der die gleichen Daten liefert. Dann `SystemMonitor.tsx` umstellen: `gateway.request("system.monitor")` statt `fetch("/api/monitor")`.

### 3. `HERMES_MODE` Client-Detection fehlt
**Betrifft:** Beide Modes  
**Symptom:** Die PWA versucht immer, einen WebSocket zum Gateway aufzubauen — auch im Pi Mode  
**Ursache:** Kein Mechanismus, der dem Client sagt, in welchem Mode er läuft  
**Fix:** 
- In `server/index.js` das `index.html` mit `window.__HERMES_MODE__ = "pi"` injizieren
- In `vite.config.ts` den `hermesDevToken()` Plugin analog erweitern
- In `src/hooks/useGateway.ts`: Wenn `window.__HERMES_MODE__ === "pi"`, dann HTTP-Chat statt WebSocket nutzen

### 4. `FilePreview.tsx` ist verwaist
**Betrifft:** Beide Modes  
**Symptom:** Komponente existiert, wird nirgends importiert  
**Ursache:** Das `ChatMessage` Interface hat kein `attachments`-Feld  
**Fix:** Entweder `attachments` zu `ChatMessage` in `store.ts` hinzufügen, oder `[File: ...]`-Pattern der MEDIA-Links erweitern

### 5. Service Worker precache von index.html
**Betrifft:** Hermes Mode  
**Symptom:** Nach Dashboard-Neustart ist der Session-Token im SW-Cache ungültig  
**Ursache:** `/index.html` wird mit `window.__HERMES_SESSION_TOKEN__` ausgeliefert, der sich bei jedem Dashboard-Neustart ändert  
**Fix:** `public/sw.js` — `index.html` aus `PRECACHE_URLS` entfernen, nur Root precachen

### 6. Wiki-Link-Resolution unvollständig
**Betrifft:** Beide Modes  
**Symptom:** `[[Page Name]]` funktioniert, aber `[[path/to/Page|Display]]` nicht zuverlässig  
**Ursache:** `preprocessWikiLinks()` in `WikiBrowser.tsx` macht naive `wiki://<link>.md`-Konvertierung ohne Pfad-Auflösung gegen den tatsächlichen Tree  
**Fix:** Wiki-Link-Resolver mit Tree-Daten abgleichen (Pfad normalisieren, `.md`-Extension checken)

## 📋 TODOs (nach Priorität)

### 🔴 Hoch (blockiert Pi-Nutzung)
- [ ] **Pi Client-Detection** — `window.__HERMES_MODE__` Inject + HTTP-Chat-Client (Issue #3)
- [ ] **NAS SSH-Integration** — diskprediction-Parsing nach `server/index.js` portieren (Issue #1)
- [ ] **Server in `package.json` scripts** — `"dev:pi": "cd server && node index.js"` etc.

### 🟡 Mittel
- [ ] **Gateway `system.monitor` RPC** — Python-Handler für Hermes Mode (Issue #2)
- [ ] **FilePreview reaktivieren** — `attachments`-Feld oder MEDIA-Link-Erweiterung (Issue #4)
- [ ] **Wiki-Link-Resolver fixen** — Pfad-Normalisierung gegen Tree (Issue #6)
- [ ] **`HERMES_BASE_PATH` in WikiBrowser** — aktuell hart `/api/wiki`, sollte konfigurierbar sein
- [ ] **Session-Resume für Pi Mode** — `server/index.js` hat `/api/session` aber ChatView nutzt es nicht im Pi Mode

### 🟢 Niedrig
- [ ] **Service Worker precache fixen** — index.html aus PRECACHE_URLS (Issue #5)
- [ ] **Dark-Mode-Only Enforcement** — CSS-Variablen in `index.css` zentralisieren
- [ ] **Error Boundaries** — `ErrorBoundary.tsx` für Komponenten-Fehler
- [ ] **Tests** — `vitest` + `@testing-library/react` einrichten
- [ ] **Docker Deployment** — `Dockerfile` für Pi Mode
- [ ] **Media Downloader UI** — Atlas' MediaDl-Komponente portieren (bisher nicht gemacht)

## 🤖 Für Shinjurs KI-Agent

Wenn du (ein Coding-Agent) an diesem Projekt arbeitest, hier die wichtigsten Infos:

### Tech Stack
- **Sprache**: TypeScript (strict), React 19, Tailwind CSS 4
- **Build**: Vite 7 (`npx vite build` → `dist/`)
- **State**: Nanostores (`import { atom } from "nanostores"`)
- **Icons**: lucide-react (`import { Monitor, Cpu } from "lucide-react"`)
- **Markdown**: react-markdown + remark-gfm + rehype-highlight
- **Backend (Pi)**: Express.js, CommonJS (`require`, nicht `import`)

### Code-Konventionen
- `"use client"` in allen Komponenten (Client-Side-Rendering)
- `@/` Alias für `src/` (in `vite.config.ts` definiert)
- Default Exports für neue Komponenten, Named Exports für Utilities
- Tailwind-Klassen: `slate-950` (BG), `slate-900` (Surface), `slate-800` (Border), `slate-100` (Text)
- Akzentfarbe: `indigo-500`/`indigo-600` (nicht `#7c6af7` aus Atlas)
- Status-Farben: `emerald-500` (gut), `amber-500` (warnung), `red-500` (fehler)
- Keine Inline-Styles — alles über Tailwind-Klassen

### Was NICHT tun
- ❌ Keine `spawn(pi)` im Frontend — nur im `server/index.js`
- ❌ Keine Inline-Styles (`style={{}}`) — Tailwind nutzen
- ❌ Keine neuen `useState` für globalen State — Nanostores nutzen
- ❌ Keine Hardcoded Provider-Listen — aus API/Store lesen
- ❌ Keine Shell-Commands in API-Routen ohne Sanitization

### Wie testen?
```bash
# TypeScript
npx tsc -b                    # Type-Check

# Bauen
npx vite build                # Production Build

# Dev-Server (nur Frontend)
npx vite --host 0.0.0.0       # Hot-Reload auf :5173

# Pi Mode (mit Backend)
cd server && npm install && HERMES_MODE=pi PI_BIN=pi node index.js
```

### Wo finde ich was?
- **Chat-Logik**: `ChatView.tsx` (Streaming), `useGateway.ts` (WebSocket), `gateway.ts` (Client)
- **State**: `store.ts` (Atoms), `db.ts` (IndexedDB)
- **API**: `api.ts` (HTTP Helpers), `server/index.js` (Pi API)
- **Styles**: `index.css` (Custom + Tailwind), Tailwind-Klassen in Komponenten

### Git-Workflow
- Repo: `Nirlau64/MCanotherAIapp`
- Branch: `master`
- Commit-Style: `type: description` (z.B. `fix: wiki link resolution`, `feat: add nas ssh monitoring`)

## 📊 Stats

| Metrik | Wert |
|--------|------|
| Source Files | 53 |
| Lines of Code | ~10.800 |
| TypeScript/TSX | ~4.500 |
| Tailwind CSS | ~50 |
| JavaScript (Server) | ~380 |
| Komponenten | 22 |
| Hooks | 3 |
| Lib Modules | 7 |

---

*Merge-Datum: 2026-06-10*  
*Hermes-Agent: deepseek-v4-pro via opencode-go*  
*Atlas-Autor: Shinjur97*  
*PWA-Autor: Nirlau64*
