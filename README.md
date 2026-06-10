# Atlas — Unified AI Assistant Web UI

A merged codebase combining the best of **Hermes Chat PWA** and **Atlas Web Dashboard**.

## Architecture

```
src/                     # React PWA (Vite + Tailwind + TypeScript)
  components/
    ChatView.tsx          # Chat with WebSocket streaming
    SystemMonitor.tsx     # System health dashboard (CPU, RAM, disks, Docker, NAS)
    WikiBrowser.tsx       # Wiki vault browser with tree view, search, edit
    ModelManager.tsx      # AI model management UI
    ThinkingBlock.tsx     # Collapsible thinking/CoT display
    SessionList.tsx       # Session list with search/filter
    Shell.tsx             # App shell with multi-view navigation
    ...
server/                  # Pi-compatible HTTP API server (Express)
  index.js               # API routes + static file serving
```

## Two Deployment Modes

### 1. Hermes Mode (WebSocket Gateway)
The PWA connects to Hermes Gateway via WebSocket. Served by Hermes Dashboard on port 9119.
```bash
npm install && npm run build
# Deploy dist/ to Hermes Dashboard's chat_pwa_dist/
systemctl --user restart hermes-dashboard
```

### 2. Pi Mode (HTTP API)
Runs with the Express API server that proxies to `pi` CLI. Good for standalone use.
```bash
# Frontend
npm install && npm run build

# Backend
cd server && npm install
HERMES_MODE=pi PI_BIN=pi VAULT_PATH=/path/to/vault node index.js
# → http://localhost:3000
```

## Features

- **Chat**: Multi-model AI chat with WebSocket streaming, thinking blocks, tool visualization
- **System Monitor**: Real-time CPU, RAM, disk, Docker, NAS health dashboard
- **Wiki Browser**: Browse, search, and edit your Obsidian/SilverBullet vault
- **Model Manager**: Add/remove AI models per provider via web UI
- **Session Management**: Create, rename, delete, search, and resume chat sessions
- **PWA**: Installable, works offline, mobile-responsive
- **Dark-only theme**: Optimized for developers

## Views

| View | Description | Hermes Mode | Pi Mode |
|------|-------------|-------------|---------|
| Chat | AI conversation | ✅ WebSocket | ✅ HTTP SSE |
| Monitor | System dashboard | ✅ | ✅ |
| Wiki | Vault browser | ✅ | ✅ |
| Models | Model CRUD | ✅ | ✅ |

## Tech Stack

- React 19, TypeScript, Tailwind CSS 4
- Vite 7, Nanostores, lucide-react
- react-markdown + remark-gfm
- Express (Pi compatibility server)
