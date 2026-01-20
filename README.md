# Ui24R Mini Mixer

Small, LAN-only prototype for controlling Soundcraft Ui24R faders, aux sends, and preamp gain with a polished React UI.

This uses the community-maintained `soundcraft-ui-connection` library. It is unofficial and reverse-engineered.

## Setup (Dev)

1. Install dependencies

```sh
cd ui24r-mini-mixer
npm install
npm run install:all
```

2. Start the server + client

```sh
npm run dev
```

Open `http://localhost:5173`.

**Development mode automatically loads sample data** so you can work on the UI without a physical mixer. The status indicator will show "Sample Data (Dev Mode)".

### Connecting to Real Mixer in Dev

If you want to test with a real mixer during development, configure the server:

```sh
cp server/.env.example server/.env
```

Edit `server/.env` with your mixer IP:

```
UI24R_HOST=192.168.1.123
UI24R_CHANNELS=1-24
```

Then disable sample mode by clicking the status pill in the UI.

## Features

- Main Mix, Aux Sends (AUX 1–10), and Gain views.
- Live VU meters (pre-fader for Aux/Gain, post-fader preferred for Main).
- V-Groups (local per-aux and global), with spill/hide and master control.
- Favorites ("My Channels") + Other, drag-and-drop ordering with interleaved channels/groups.
- Reset Layout button (Aux view) to clear local V-Groups, disable global groups, and reset My Channels.
- Per-view simple controls (step buttons) and fixed-height channel strips.
- Assign-to-Me per device for AUX mixes.
- Server-side persistence for layout/view settings + global groups.
- Optional sample data mode for UI testing.
- Progressive Web App (PWA) support for "Add to Home Screen" on iOS and Android.
- Legacy browser support (iOS 12+, Safari 12+, Chrome 64+, Firefox 60+).

## Demo Mode (Static Site)

A live demo is automatically deployed to GitHub Pages on every push to main:

**[Live Demo](https://eric-silverman.github.io/ui24r-mini-mixer/)**

Demo mode uses sample data (no real mixer required) so you can explore the UI.

### Building Demo Locally

```sh
cd ui24r-mini-mixer/client
VITE_DEMO=true npm run build
```

Deploy `client/dist` to any static host (Netlify, Vercel, GitHub Pages, etc.).

**Note**: Development mode (`npm run dev`) automatically uses sample data. Demo mode is specifically for production static builds without a backend.

## PWA (Add to Home Screen)

This app is a Progressive Web App and can be installed on iOS and Android devices for a more app-like experience.

### iOS Installation

1. Open the app in Safari (Chrome/Firefox don't support PWA installation on iOS)
2. Tap the Share button (square with arrow pointing up)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" in the top right

The app will now appear on your home screen with a custom icon and run in fullscreen mode without browser UI.

### Android Installation

1. Open the app in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home screen" or "Install app"
4. Confirm by tapping "Add" or "Install"

### Custom App Icon

The default icon is generated from `/client/public/icon.svg`. To customize it:

1. Edit `client/public/icon.svg` or replace it with your own design
2. Regenerate PNG icons:

```sh
cd client
./generate-icons.sh
```

This creates `icon-192.png` and `icon-512.png` from the SVG. You can also create these manually using any image editor.

## Production (Raspberry Pi)

Build once (internet required on your dev machine):

```sh
npm run install:all
npm run build
```

Or do it all in one command:

```sh
npm run prod:setup
```

Copy the repo to the Pi, then run:

```sh
npm run start:prod
```

This serves the built UI from the same server (default `http://<pi-ip>:3001/`).

## Production (Raspberry Pi) via GitHub Releases

This path avoids building on the Pi. GitHub Actions builds a release artifact, and the Pi periodically checks for updates via `systemd`.

### 1) Create a release artifact (dev machine)

Tag and push to GitHub (the workflow runs on `v*` tags):

```sh
git tag v0.1.0
git push origin v0.1.0
```

### 2) Bootstrap the Pi (one-time)

Download the latest release and extract it to `/opt/ui24r-mini-mixer`:

```sh
REPO=your-org/ui24r-mini-mixer
ASSET_URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | python3 - <<'PY'
import json
import sys

data = json.load(sys.stdin)
for asset in data.get("assets", []):
    name = asset.get("name", "")
    if name.startswith("ui24r-mini-mixer") and name.endswith(".tar.gz"):
        print(asset.get("browser_download_url", ""))
        break
PY
)

sudo mkdir -p /opt/ui24r-mini-mixer
curl -fsSL "$ASSET_URL" -o /tmp/ui24r-mini-mixer.tar.gz
sudo tar -xzf /tmp/ui24r-mini-mixer.tar.gz -C /opt/ui24r-mini-mixer
sudo chmod +x /opt/ui24r-mini-mixer/scripts/pi/update.sh
```

Configure the environment (includes mixer IP and update settings):

```sh
sudo cp /opt/ui24r-mini-mixer/scripts/pi/ui24r-mini-mixer.env.example /etc/default/ui24r-mini-mixer
sudo nano /etc/default/ui24r-mini-mixer
```

Install systemd units and enable the service + timer:

```sh
sudo cp /opt/ui24r-mini-mixer/scripts/pi/systemd/ui24r-mini-mixer.service /etc/systemd/system/
sudo cp /opt/ui24r-mini-mixer/scripts/pi/systemd/ui24r-mini-mixer-update.service /etc/systemd/system/
sudo cp /opt/ui24r-mini-mixer/scripts/pi/systemd/ui24r-mini-mixer-update.timer /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now ui24r-mini-mixer.service
sudo systemctl enable --now ui24r-mini-mixer-update.timer
```

The update timer checks every 30 minutes and restarts the app when a newer GitHub Release is available.

### 3) Manual updates

**Online (Pi has internet access):**

```sh
sudo /opt/ui24r-mini-mixer/scripts/pi/update.sh
```

Add `--force` to reinstall the current version.

**From a direct URL (Pi has internet, you have the URL):**

```sh
sudo /opt/ui24r-mini-mixer/scripts/pi/update.sh --url "https://github.com/.../ui24r-mini-mixer-v1.0.0.tar.gz"
```

This is useful when SSHing from a phone—just copy the release URL and paste it.

**Offline (no internet on Pi):**

1. Download the release tarball from GitHub Releases on your dev machine
2. Transfer it to the Pi (e.g., via USB drive or `scp`)
3. Extract and run the update script from the tarball:

```sh
tar -xzf ui24r-mini-mixer-v1.0.0.tar.gz
sudo ./ui24r-mini-mixer/scripts/pi/update.sh --file ui24r-mini-mixer-v1.0.0.tar.gz
```

Running the update script from the extracted tarball ensures you're using the latest update logic, which is useful if the update script itself has changed.

### Creating a release

Releases are built automatically by GitHub Actions when you push a version tag:

```sh
git tag v1.0.0
git push origin v1.0.0
```

The workflow (`.github/workflows/release.yml`) builds the client and server, bundles `node_modules` for offline Pi updates, and uploads the tarball as a release asset.

### Raspberry Pi setup (new SD card to running app)

1. Flash the SD card (recommended: Raspberry Pi OS Lite 64-bit)
   - Install Raspberry Pi Imager: https://www.raspberrypi.com/software/
   - Choose OS: "Raspberry Pi OS (64-bit) Lite"
   - Choose Storage: your SD card
   - Advanced settings (gear icon):
     - Set hostname (e.g., `ui24r-pi`)
     - Enable SSH
     - Set username/password
     - Configure Wi-Fi (SSID/password/country) if needed
     - Set locale/timezone
   - Click "Write"

2. First boot + SSH in
   - Insert SD card into Pi, power on, wait 1–2 minutes
   - SSH in (replace hostname if you changed it):

```sh
ssh pi@ui24r-pi.local
```

3. Update OS and install prerequisites

```sh
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y git ca-certificates
```

4. Install Node.js (recommended: Node 20 LTS)

```sh
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

5. Get the code on the Pi
   - Option A: copy the repo from your dev machine (fastest for no-build on Pi)
   - Option B: clone directly on the Pi (requires network access to Git)

```sh
git clone <your-repo-url> ui24r-mini-mixer
cd ui24r-mini-mixer
```

6. Install dependencies and build (on the Pi)

```sh
npm install
npm run install:all
npm run build
```

Or do it all in one command:

```sh
npm run prod:setup
```

7. Configure mixer IP (optional)

```sh
cp .env.example .env
sudo nano .env
# set UI24R_HOST=192.168.1.123
```

8. Run the app

```sh
npm run start:prod
```

Open `http://<pi-ip>:3001/`.

9. (Optional) Install as a service

```sh
sudo scripts/install-service.sh
```

10. (Optional) Friendly hostname via mDNS

```sh
sudo hostnamectl set-hostname myui
sudo apt-get install -y avahi-daemon
sudo systemctl enable --now avahi-daemon
```

Then open `http://myui.local:3001/`.

### Raspberry Pi Wi-Fi switching (Lite)

Raspberry Pi OS Lite uses either NetworkManager (bookworm) or wpa_supplicant (bullseye). Check which is running:

```sh
ps -ef | rg -i "NetworkManager|wpa_supplicant"
```

If NetworkManager is active:

```sh
nmcli dev wifi list
nmcli dev wifi connect "SSID_NAME" password "PASSWORD"
```

If wpa_supplicant is active:

```sh
sudo nano /etc/wpa_supplicant/wpa_supplicant.conf
# add:
# network={
#   ssid="SSID_NAME"
#   psk="PASSWORD"
# }
sudo wpa_cli -i wlan0 reconfigure
```

### Systemd service

Install the service:

```sh
sudo scripts/install-service.sh
```

Optional mixer IP configuration:

```sh
sudo nano /etc/ui24r-mini-mixer.env
# set MIXER_HOST=192.168.1.123
sudo systemctl restart ui24r-mini-mixer
```

## Friendly hostname (mDNS)

The Ui24R itself can’t be assigned a `.local` hostname. Use mDNS on the Pi:

```sh
sudo hostnamectl set-hostname myui
sudo apt-get install avahi-daemon
sudo systemctl enable --now avahi-daemon
```

Then open `http://myui.local:3001/`.

## Reverse proxy (no port needed)

If you want `http://eslive.local` without `:3001`, run the helper script on the Pi. It installs Caddy + Avahi and creates two hostnames:

- `http://eslive.local` -> this app
- `http://ui24r.local` -> the mixer’s built-in UI (`UI24R_HOST`)

```sh
cd ui24r-mini-mixer
sudo UI24R_HOST=192.168.6.85 ./scripts/install-reverse-proxy.sh
```

Optional overrides:

```sh
sudo UI24R_HOST=192.168.6.85 \
  APP_HOSTNAME=eslive.local \
  UI24R_HOSTNAME=ui24r.local \
  APP_TARGET=127.0.0.1:3001 \
  ./scripts/install-reverse-proxy.sh
```

## Optional connectivity check

This runs a simple fader set on channel 1:

```sh
cd ui24r-mini-mixer/server
UI24R_HOST=192.168.1.123 npm run test:fader
```

## API

- `GET /api/state` (master)
- `GET /api/state?bus=aux&busId=1`
- `GET /api/state?bus=gain`
- `GET /api/layout?bus=aux&busId=1`
- `GET /api/layout?bus=master`
- `GET /api/layout?bus=gain`
- `PUT /api/layout?bus=aux&busId=1`
- `PUT /api/layout?bus=master`
- `PUT /api/layout?bus=gain`
- `POST /api/connect` body `{ "host": "192.168.1.123" }`
- `POST /api/channels/:id/fader?bus=aux&busId=1` body `{ "value": 0.42 }`
- `POST /api/channels/:id/gain` body `{ "value": 0.42 }`
- `POST /api/channels/:id/mute?bus=aux&busId=1` body `{ "muted": true }`
- `POST /api/channels/:id/solo?bus=master` body `{ "solo": true }`
- `POST /api/debug` body `{ "enabled": true }`
- WebSocket at `/ws` sends full state on connect and incremental updates.

## Testing

The project includes a comprehensive test suite with 778 tests.

### Running Tests

```sh
# Run all tests (unit + E2E)
./test.sh all

# Run only unit tests
./test.sh unit

# Run only client unit tests
./test.sh client

# Run only server unit tests
./test.sh server

# Run E2E tests
./test.sh e2e

# Run E2E tests in headed mode
./test.sh e2e:headed

# Run legacy compatibility tests
./test.sh legacy

# Run tests in watch mode
./test.sh watch

# Run with coverage
./test.sh coverage

# See all available commands
./test.sh help
```

### Test Structure

- **Client unit tests** (415 tests): `client/tests/unit/` - Components, API, WebSocket, utilities
- **Server unit tests** (114 tests): `server/tests/` - State management, config, layout persistence
- **E2E tests** (240 tests): `tests/` - Fader LCD display, mobile layout, portrait mode
- **Legacy compatibility tests** (9 tests): Production build verification for older browsers

### Continuous Integration

GitHub Actions runs all tests automatically on every push:
- Unit tests (client + server)
- E2E tests (Chromium + WebKit)
- Legacy compatibility tests

See `.github/workflows/test.yml` for the CI configuration.

## Troubleshooting

Can't connect:
- Verify the mixer and the machine are on the same LAN.
- Confirm `UI24R_HOST` is correct.
- Ensure the mixer is powered on and reachable.
- Check local firewall rules for port `3001`.
- If meters are not moving, enable Debug in the UI and check the console for `meter` messages.

### iOS slow page load (TODO)

**Issue:** On iOS, initial page load takes ~30 seconds on networks without internet access, while macOS Safari and the mixer's own web interface load instantly.

**Investigation needed:**
- The delay occurs before the request even reaches the Pi (iOS-side)
- Likely related to iOS captive portal detection or mDNS resolution
- Test: Does accessing the Pi by IP (`http://192.168.1.X`) instead of hostname (`http://mix.local`) load faster?
- If IP is fast, the issue is mDNS resolution on iOS, not captive portal
- The `scripts/install-reverse-proxy.sh` includes experimental captive portal interception via dnsmasq, but requires the mixer/router DHCP to use the Pi as DNS server

Verify mixer state by hitting:

```sh
curl http://localhost:3001/api/state
```

## Browser Support

The app supports modern browsers and legacy devices:

| Browser | Minimum Version |
|---------|-----------------|
| iOS Safari | 12+ |
| Safari | 12+ |
| Chrome | 64+ |
| Firefox | 60+ |

Legacy browsers receive a transpiled bundle with polyfills via `@vitejs/plugin-legacy`.

## Performance Optimizations

The app includes several optimizations for fast load times, especially on resource-constrained devices like Raspberry Pi:

### Self-hosted Fonts

Google Fonts (Rajdhani, Share Tech Mono) are bundled locally in `/fonts/` rather than loaded from external CDN. This eliminates blocking network requests on networks without internet access.

### Server Compression

The server uses `@fastify/compress` to gzip all responses over 1KB, reducing transfer sizes by ~70%:
- JS bundle: ~200KB → ~61KB gzipped
- CSS: ~44KB → ~9KB gzipped

### Cache Headers

Static assets include appropriate cache headers:
- Versioned assets (hashed filenames): `Cache-Control: public, max-age=31536000, immutable`
- Other assets: 24-hour cache with ETag validation

### Parallel API Calls

Initial page load fetches state and layout data in parallel using `Promise.all`, reducing startup latency by ~40% compared to sequential requests.

### Service Worker Caching

The service worker pre-caches critical assets (fonts, icons, manifest) on install and uses a cache-first strategy for static files. This makes repeat visits nearly instant:
- First visit: Assets downloaded and cached
- Repeat visits: Assets served from cache, only API calls hit the network
