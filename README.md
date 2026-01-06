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

## Demo Mode (Static Site)

Demo mode builds a static site that always uses sample data (no backend server needed).

```sh
cd ui24r-mini-mixer/client
VITE_DEMO=true npm run build
```

Deploy `client/dist` to any static host (Netlify, Vercel, GitHub Pages, etc.).

**Note**: Development mode (`npm run dev`) automatically uses sample data. Demo mode is specifically for production static builds without a backend.

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

## Troubleshooting

Can't connect:
- Verify the mixer and the machine are on the same LAN.
- Confirm `UI24R_HOST` is correct.
- Ensure the mixer is powered on and reachable.
- Check local firewall rules for port `3001`.
- If meters are not moving, enable Debug in the UI and check the console for `meter` messages.

Verify mixer state by hitting:

```sh
curl http://localhost:3001/api/state
```

## TODO

- (empty)
