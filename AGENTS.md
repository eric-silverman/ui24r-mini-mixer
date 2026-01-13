# Ui24R Mini Mixer - Project Documentation

A web-based control interface for the Soundcraft Ui24R professional audio mixer. Provides a simplified, mobile-friendly UI for controlling faders, auxiliary sends (AUX 1-10), and preamp gain over a local network.

---

## Quick Start

```bash
npm install
npm run install:all
npm run dev
```

Open `http://localhost:5173`

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | Node.js + Fastify + RxJS |
| Mixer Protocol | `soundcraft-ui-connection` (community library) |
| Real-time | WebSocket (bidirectional updates) |
| Validation | Zod schemas |
| Unit Testing | Vitest + Testing Library |
| E2E Testing | Playwright (Chromium + WebKit) |
| Legacy Support | @vitejs/plugin-legacy (iOS 12+, Safari 12+) |
| CI/CD | GitHub Actions |
| Deployment | Raspberry Pi + systemd |

---

## Directory Structure

```
ui24r-mini-mixer/
├── client/                          # React frontend
│   ├── src/
│   │   ├── App.tsx                 # Main app component (core logic)
│   │   ├── main.tsx                # Entry point, PWA service worker
│   │   ├── index.css               # Tailwind + custom mixer CSS
│   │   ├── components/
│   │   │   ├── ChannelStrip.tsx    # Individual channel fader UI
│   │   │   ├── VGroupStrip.tsx     # Virtual group display
│   │   │   └── ConnectionPill.tsx  # Connection status indicator
│   │   └── lib/
│   │       ├── api.ts              # Fetch-based API client
│   │       ├── ws.ts               # WebSocket with auto-reconnect
│   │       ├── types.ts            # Shared TypeScript types
│   │       ├── layout.ts           # Layout persistence
│   │       ├── debounce.ts         # Throttle utility
│   │       └── sampleData.ts       # Mock data for dev mode
│   ├── tests/                       # Client unit tests (Vitest)
│   │   ├── setup.ts                # Test setup with jest-dom
│   │   └── unit/
│   │       ├── ChannelStrip.test.tsx
│   │       ├── VGroupStrip.test.tsx
│   │       ├── ConnectionPill.test.tsx
│   │       ├── api.test.ts
│   │       ├── ws.test.ts
│   │       └── ...
│   ├── public/
│   │   ├── manifest.json           # PWA manifest
│   │   ├── sw.js                   # Service worker (network-first)
│   │   └── icon-*.png              # PWA icons
│   ├── vite.config.ts              # Vite config with legacy plugin
│   ├── vitest.config.ts            # Vitest configuration
│   └── package.json
│
├── server/                          # Node.js Fastify backend
│   ├── src/
│   │   ├── index.ts                # Main server, routes, WebSocket
│   │   ├── config.ts               # Environment config loading
│   │   ├── state.ts                # In-memory state cache (StateStore)
│   │   ├── ui24rClient.ts          # Mixer client adapter (RxJS)
│   │   ├── layout.ts               # Layout persistence (LayoutStore)
│   │   ├── ws.ts                   # WebSocket broadcast utility
│   │   └── test-fader.ts           # Quick connectivity test
│   ├── tests/                       # Server unit tests (Vitest)
│   │   ├── state.test.ts
│   │   ├── config.test.ts
│   │   └── layout.test.ts
│   ├── data/
│   │   └── layout.<hostname>.json  # Per-mixer layout persistence
│   ├── vitest.config.ts            # Vitest configuration
│   └── package.json
│
├── tests/                           # Playwright E2E tests
│   ├── fader-lcd-display.spec.ts   # LCD display updates
│   ├── mobile-layout.spec.ts       # Touch targets, responsive
│   ├── portrait-mode.spec.ts       # Portrait orientation
│   └── legacy-compatibility.spec.ts # Production build tests
│
├── test.sh                          # Test runner script
├── playwright.config.ts             # Playwright configuration
│
├── scripts/
│   ├── install-service.sh          # systemd installation
│   ├── install-reverse-proxy.sh    # Caddy setup
│   └── pi/
│       ├── bootstrap.sh            # Pi initial setup
│       ├── update.sh               # Auto-update script
│       └── systemd/                # Service files
│
└── .github/workflows/
    ├── release.yml                 # GitHub Actions release pipeline
    └── test.yml                    # CI test suite (778 tests)
```

---

## Architecture

```
┌─────────────────────────┐
│   Browser (React)       │
│  - Main Mix View        │
│  - Aux Sends (1-10)     │
│  - Gain View            │
│  - Layout Management    │
└────────┬────────────────┘
         │ HTTP + WebSocket
         ▼
┌─────────────────────────────────────────┐
│   Fastify Server (Node.js)              │
│  ┌─────────────────────────────────────┐│
│  │ StateStore (In-memory cache)        ││
│  │ - Channel state, aux buses, meters  ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ LayoutStore (JSON persistence)      ││
│  │ - V-Groups, favorites, order        ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ Ui24rClient (Mixer adapter)         ││
│  │ - RxJS subscriptions, auto-reconnect││
│  └─────────────────────────────────────┘│
└────────┬──────────────────────────────────┘
         │ TCP WebSocket
         ▼
┌──────────────────────────┐
│  Soundcraft Ui24R Mixer  │
└──────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/src/index.ts` | Main server entry, route handlers, WebSocket |
| `server/src/ui24rClient.ts` | Mixer connection adapter with RxJS subscriptions |
| `server/src/state.ts` | In-memory state cache (StateStore class) |
| `server/src/layout.ts` | JSON-based layout persistence (LayoutStore class) |
| `client/src/App.tsx` | Main React app with all view logic |
| `client/src/lib/ws.ts` | WebSocket client with auto-reconnect |
| `client/src/lib/types.ts` | Shared TypeScript types |

---

## API Reference

### State Endpoints

```
GET /api/state                    # Main mix state
GET /api/state?bus=aux&busId=1    # Aux bus state (1-10)
GET /api/state?bus=gain           # Gain view state
```

### Control Endpoints

```
POST /api/connect                 # { "host": "192.168.1.123" }
POST /api/channels/:id/fader      # { "value": 0.42 }  (0-1 normalized)
POST /api/channels/:id/fader?bus=aux&busId=1
POST /api/channels/:id/gain       # { "value": 0.42 }
POST /api/channels/:id/mute       # { "muted": true }
POST /api/channels/:id/mute?bus=aux&busId=1
POST /api/channels/:id/solo       # { "solo": true }  (master only)
```

### Layout Endpoints

```
GET  /api/layout?bus=master       # Get layout for view
GET  /api/layout?bus=aux&busId=1
PUT  /api/layout                  # Save layout changes
```

### WebSocket

```
/ws                               # Real-time updates
```

Message types: `state`, `channel`, `meter`, `aux`, `status`

---

## Configuration

### Environment Variables

```bash
UI24R_HOST=192.168.1.123    # Mixer IP address
UI24R_CHANNELS=1-24         # Channels to display (range: "1-24", list: "1,3,5,10-15")
PORT=3001                   # Server port
```

### Persistence

- **Server**: `server/data/layout.<hostname>.json` - Per-mixer layouts
- **Client**: localStorage - Device preferences, assigned aux

---

## Features

### Mixing Controls
- **Main Mix** - 24 channels with faders, mute, solo, VU meters
- **Aux Sends** - 10 aux buses for personal monitor mixes
- **Gain** - Preamp gain adjustment

### Layout Management
- **V-Groups** - Virtual groups with master fader, local or global scope
- **Favorites** - "My Channels" per-device marking
- **Drag-and-drop** - Reorder channels and groups
- **Assign to Me** - Mark your personal aux bus

### PWA Support
- Installable on iOS (Safari) and Android (Chrome)
- Fullscreen mode, network-first caching

### Development
- **Sample Data Mode** - Automatic in dev, toggle via status pill
- **Debug Mode** - Log raw mixer messages

### Browser Support
- **Legacy Browsers** - iOS 12+, Safari 12+, Chrome 64+, Firefox 60+
- **Modern Browsers** - Native ES modules with optimal bundle size
- **Auto-detection** - Serves legacy polyfills only to older browsers

---

## Commands

```bash
# Development
npm run dev          # Start dev server (client:5173, server:3001)
npm run build        # Production build
npm run start:prod   # Run production server
npm run prod:setup   # One-command production setup

# Testing
npm test             # Run all tests (unit + E2E)
npm run test:unit    # Run unit tests only
npm run test:e2e     # Run E2E tests only
npm run test:watch   # Run tests in watch mode
npm run test:fader   # Quick mixer connectivity test
```

---

## Data Flow

### Setting a Fader

```
User drags fader → React handler → POST /api/channels/:id/fader
    → Fastify validates → Ui24rClient.setFader() → Mixer
    → StateStore updated → WebSocket broadcast → All clients update
```

### Mixer Event (physical fader moved)

```
Physical fader → soundcraft-ui-connection Observable
    → Ui24rClient detects change → Emits MixerUpdate
    → StateStore.updateChannel() → WebSocket broadcast → All clients update
```

---

## Design Patterns

1. **Observer Pattern** - RxJS Observables for reactive mixer events
2. **Pub-Sub** - WebSocket broadcasts to all connected clients
3. **Adapter Pattern** - Ui24rClient wraps soundcraft-ui-connection
4. **State Store** - In-memory canonical state, single source of truth
5. **Change Detection** - Threshold-based updates to reduce noise

---

## Key Design Decisions

1. **No database** - In-memory state + JSON files (LAN-only simplicity)
2. **Per-mixer-IP layouts** - Different mixers can have different configurations
3. **Client-local preferences** - Each device tracks its own assigned aux
4. **Batched broadcasts** - Multiple updates queued and sent together
5. **TypeScript strict mode** - Full type safety with Zod runtime validation
6. **No authentication** - Assumes trusted LAN environment

---

## Deployment

### Raspberry Pi

```bash
# Bootstrap (one-time)
sudo mkdir -p /opt/ui24r-mini-mixer
# Download release from GitHub
sudo tar -xzf ui24r-mini-mixer-*.tar.gz -C /opt/ui24r-mini-mixer

# Install service
sudo cp scripts/pi/systemd/ui24r-mini-mixer.service /etc/systemd/system/
sudo systemctl enable --now ui24r-mini-mixer.service

# Auto-updates (optional)
sudo cp scripts/pi/systemd/ui24r-mini-mixer-update.* /etc/systemd/system/
sudo systemctl enable --now ui24r-mini-mixer-update.timer
```

### Demo Mode (Static)

```bash
cd client
VITE_DEMO=true npm run build
# Deploy client/dist to any static host
```

### Reverse Proxy (Pretty Hostnames)

```bash
sudo UI24R_HOST=192.168.6.85 ./scripts/install-reverse-proxy.sh
# Creates http://eslive.local → app
# Creates http://ui24r.local → mixer web UI
```

---

## Testing

The project includes 778 tests across unit, E2E, and legacy compatibility suites.

### Test Commands

```bash
# All tests (recommended)
./test.sh all                          # Run unit + E2E tests (769 tests)
./test.sh legacy                       # Run legacy compatibility tests (9 tests)

# Unit tests
./test.sh unit                         # All unit tests (529 tests)
./test.sh client                       # Client unit tests only (415 tests)
./test.sh server                       # Server unit tests only (114 tests)
./test.sh watch                        # Client tests in watch mode
./test.sh watch:server                 # Server tests in watch mode
./test.sh coverage                     # Client tests with coverage

# E2E tests
./test.sh e2e                          # Playwright E2E tests (240 tests)
./test.sh e2e:headed                   # Run in visible browser
./test.sh e2e:debug                    # Debug mode with inspector
./test.sh e2e:ui                       # Playwright interactive UI
./test.sh e2e:update                   # Update visual snapshots

# Other
npm run test:fader                     # Quick mixer connectivity test
```

### Test Structure

| Suite | Location | Framework | Count |
|-------|----------|-----------|-------|
| Client Unit | `client/tests/unit/` | Vitest + Testing Library | 415 |
| Server Unit | `server/tests/` | Vitest | 114 |
| E2E | `tests/*.spec.ts` | Playwright | 240 |
| Legacy | `tests/legacy-compatibility.spec.ts` | Playwright | 9 |

### CI/CD

GitHub Actions (`.github/workflows/test.yml`) runs on every push:

1. **Unit Tests** - Client and server unit tests
2. **E2E Tests** - Playwright with Chromium and WebKit
3. **Legacy Tests** - Production build verification

All jobs must pass for the workflow to succeed.

---

## Coding Conventions

- TypeScript strict mode everywhere
- Functional React with hooks (no class components)
- Zod schemas for all API input validation
- RxJS for async operations with proper cleanup
- Immutable state updates (spread/copy, no mutation)
- Debounce/throttle on fader changes

---

## Performance Optimizations

- Meter sampling at 50ms intervals (RxJS sampleTime)
- Change detection thresholds: faders 0.0001, dB 0.01, meters 0.005
- Batched WebSocket broadcasts (flush at next microtask)
- Lazy layout fetch on view switch
