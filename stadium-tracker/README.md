# 🏟️ Ballpark & Gridiron — Stadium Trip Tracker

A standalone web app to document your dream of visiting **every MLB and NFL
stadium**. Runs on its own port, independent of the Friday app, and is
structured so the "bones" convert cleanly into a native mobile app later.

## What it does

- **Two leagues, two tabs** — all 30 MLB ballparks (AL + NL, grouped by
  division) and all NFL stadiums (AFC + NFC). Shared NFL venues (MetLife, SoFi)
  are listed once so a visit counts a stadium a single time.
- **Track progress** — mark stadiums visited vs. still-to-go, with an overall
  completion ring and per-division progress bars. Filter by All / To visit /
  Visited, or search any team, stadium, or city.
- **Document each trip** — date visited, a 1–5★ rating, free-form notes, the
  **hotel/resort** you stayed at, and **flight/travel** details.
- **Upload photos** — attach as many photos as you like per stadium; they're
  downscaled and stored privately in your browser (IndexedDB). The first photo
  becomes the card's cover.
- **Travel help** — set a **home base** (pick a city or use your current GPS
  location) to see straight-line **distance and an estimated drive time** on
  every card, plus one-tap links to **Google Maps driving directions**,
  **hotels & resorts nearby**, and **flight search** for each destination.
- **Backup & restore** — export everything (trips + photos) to a JSON file and
  restore it on any device. Your data never leaves your browser otherwise.

## Run it

Requires Node.js (no npm install — zero dependencies).

```bash
cd stadium-tracker
node server.js            # → http://localhost:5280
# or choose a port:
PORT=8080 node server.js
```

Then open the printed URL. Everything is client-side; the server only serves
static files.

## Reach it from your phone via Tailscale

Tailscale gives every **device** on your tailnet a stable `100.x.x.x` address.
Run this server on a machine that's on your tailnet, and you can open the app
from your phone (or any other device on the tailnet) at that machine's address
— no port forwarding, no public exposure.

One-time setup on the host machine (laptop, mini-PC, Raspberry Pi, etc.):

1. Install Node.js and copy this `stadium-tracker/` folder onto the machine
   (e.g. `git clone` this repo).
2. Install Tailscale and sign in:
   ```bash
   # macOS: brew install --cask tailscale     Linux: https://tailscale.com/download
   tailscale up
   tailscale ip -4        # shows this machine's 100.x.x.x address
   ```
3. Start the server (it binds to all interfaces automatically):
   ```bash
   node server.js
   ```
   On startup it prints the exact Tailscale URL, e.g.:
   ```
   🔒 Tailscale:  http://100.101.102.103:5280   ← reach this from your phone
   ```
4. On your phone (with the Tailscale app installed and logged into the **same**
   account), open that `http://100.x.x.x:5280` URL. Done.

### Nicer: a hostname + HTTPS instead of an IP

Tailscale can proxy the app over HTTPS at your machine's MagicDNS name, so you
get a clean URL and a valid certificate:

```bash
tailscale serve --bg 5280
# → https://<your-machine-name>.<your-tailnet>.ts.net
```

Open that URL from any device on the tailnet. Run `tailscale serve status` to
see it, and `tailscale serve --https=443 off` to stop.

> Note: your trips, notes, and photos are stored **per browser/device** (in
> localStorage + IndexedDB). Reaching the same server from your phone and your
> laptop gives each its own local data — use **Backup** on one and **Restore**
> on the other to copy everything across. (Cross-device sync is a natural next
> step — see below.)

## Project structure

```
stadium-tracker/
├── index.html          # app shell
├── css/styles.css      # theme (light/dark), responsive layout
├── js/
│   ├── data.js         # stadium dataset + geo/distance helpers  (data layer)
│   ├── storage.js      # localStorage + IndexedDB persistence     (storage layer)
│   └── app.js          # rendering & interactions                 (view layer)
├── server.js           # zero-dep static server on its own port
└── README.md
```

## Turning this into an app (the "bones")

The three layers are deliberately separated so this ports to React / React
Native (or Expo — like the Friday app) with minimal rework:

1. **`data.js`** is pure data + pure functions. Reuse as-is, or fetch the same
   shape from an API.
2. **`storage.js`** is the single seam that touches persistence. It exposes an
   async interface (`getTrip`, `saveTrip`, `getPhotos`, `addPhoto`,
   `exportAll`, …). Swap its body for your backend REST calls or native device
   storage and nothing else changes.
3. **`app.js`** render functions map 1:1 onto components: the card, the
   progress ring, the trip modal, the photo grid. The external Maps/hotels/
   flights links become deep links or in-app screens.

Suggested next steps for the app version:
- Cloud sync + login so trips follow you across devices (the Friday app already
  uses Supabase — the same pattern fits here).
- Real driving distances/times and autocomplete via a Maps/Directions API
  (today's distances are great-circle estimates; the Directions button already
  opens turn-by-turn routing).
- Push reminders for stadiums near an upcoming trip.
- A shareable "stadiums visited" map/passport.
