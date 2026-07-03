# CLAUDE.md — Stadium Trip Tracker (context handoff)

Claude Code auto-loads this file when started in this directory. It carries the
context from the cloud session that built this app into any session that runs
here — including one running **on KNIGHTSWATCH with real shell access**, which
can finish the live troubleshooting the cloud session could not.

## What this project is

A standalone, local-first web app to track visits to every MLB and NFL stadium
(bucket list, notes, photos, map, driving distance, hotels/flights links) with
optional Supabase cloud sync. Vanilla JS + a zero-dependency Node static server;
no build step. Layered so it can later become a native app.

- `index.html`, `css/styles.css`
- `js/data.js` — stadium dataset + geo helpers (data layer)
- `js/storage.js` — localStorage (trips) + IndexedDB (photos) (storage layer)
- `js/sync.js` — Supabase cloud sync, lazy-loaded (sync layer)
- `js/map.js` + `js/us-geo.js` — inline SVG US map, Albers projection
- `js/app.js` — UI (view layer)
- `js/vendor/supabase.js` — vendored SDK, only loaded when sync is on
- `server.js` — static server, binds dual-stack, prints reachable URLs
- `supabase-sync.sql` — sync tables + RLS
- `deploy/` — `stadium-tracker.service`, `install-service.sh`, `diagnose.sh`

## KNIGHTSWATCH deployment facts

- Host: KNIGHTSWATCH (Linux home server). LAN `192.168.1.219`, Tailscale
  `100.112.253.127` (see `../../services/knightswatch.ts`).
- Already runs Friday services: Ollama :11434, TTS :8082, memory :8081,
  ComfyUI :8188.
- This app serves on **:5280** (override with `PORT`).
- Tailnet ACL is **tightened** (not allow-all); user has added `tcp:5280` to the
  KNIGHTSWATCH grant.
- Auto-start: `./deploy/install-service.sh` installs a systemd unit
  (`stadium-tracker`) running as the login user, `Restart=always`.

## Current status / open issue

Built + pushed: full app (grid + map + sync), systemd installer, docs.

**Open problem:** from the iPhone and Mac (both on Tailscale, KNIGHTSWATCH too),
`http://100.112.253.127:5280` is not reachable, even though other tailnet
services are. Diagnosis so far:

1. **Fixed (likely cause):** `server.js` was binding IPv4-only (`0.0.0.0`), so
   Tailscale IPv6 / MagicDNS connections were refused. Now binds dual-stack
   (`::`) with an IPv4 fallback. **Requires `git pull` + service restart on
   KNIGHTSWATCH to take effect.**
2. Still to rule out on the box: service actually running; socket shows
   `:::5280` (not stale `0.0.0.0:5280`); host firewall (ufw/firewalld) blocking
   5280 on `tailscale0` — this is separate from the Tailscale ACL.

## Next steps for a session running ON KNIGHTSWATCH (has shell access)

```bash
cd <this repo>/KNIGHTSWATCH/stadium-tracker
git pull
sudo systemctl restart stadium-tracker    # load the dual-stack fix
./deploy/diagnose.sh                        # collects service/socket/firewall/tailscale state
```

Then act on the output:
- Socket must be `:::5280`. If `0.0.0.0:5280`, the old process is still up.
- If `curl localhost:5280` fails → the server/service is the problem (check
  `journalctl -u stadium-tracker -f`).
- If localhost works but the Tailscale IP doesn't → host firewall: e.g.
  `sudo ufw allow in on tailscale0 to any port 5280 proto tcp`.
- Verify from the Mac: `curl -v http://100.112.253.127:5280`.

## Constraints to remember

- The original build session ran in an ephemeral cloud sandbox with **no**
  network path to KNIGHTSWATCH/Mac/iPhone — hence this handoff. A session on
  KNIGHTSWATCH can run the commands above directly.
- Keep the app local-first and dependency-free; sync is opt-in and must never
  block first paint.
