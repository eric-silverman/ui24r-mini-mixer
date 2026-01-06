# Ui24R Mini Mixer - Project Notes

## Current State

- Backend uses Fastify + WebSocket and `soundcraft-ui-connection`.
- Frontend is React + Vite + Tailwind with a mixer-style UI.
- Views supported: Main Mix, Aux Sends (AUX 1-10), Gain (preamp gain).
- All views display 24 channels; aux names are pulled from the mixer.
- Mixer IP can be set via `.env` or through the in-app Connect panel.

## How to Run

```sh
cd ui24r-mini-mixer
npm install
npm run install:all
npm run dev
```

Open `http://localhost:5173`.

## Key Paths

- Server entry: `ui24r-mini-mixer/server/src/index.ts`
- Mixer adapter: `ui24r-mini-mixer/server/src/ui24rClient.ts`
- State cache: `ui24r-mini-mixer/server/src/state.ts`
- Client app: `ui24r-mini-mixer/client/src/App.tsx`

## API Summary

- `GET /api/state` (master)
- `GET /api/state?bus=aux&busId=1`
- `GET /api/state?bus=gain`
- `POST /api/connect` body `{ "host": "192.168.1.123" }`
- `POST /api/channels/:id/fader?bus=aux&busId=1` body `{ "value": 0.42 }`
- `POST /api/channels/:id/gain` body `{ "value": 0.42 }`
- `POST /api/channels/:id/mute?bus=aux&busId=1` body `{ "muted": true }`
- WebSocket at `/ws` sends snapshots and incremental updates.
