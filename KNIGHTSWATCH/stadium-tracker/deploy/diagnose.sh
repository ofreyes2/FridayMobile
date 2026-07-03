#!/usr/bin/env bash
#
# One-shot diagnostics for the Stadium Trip Tracker on KNIGHTSWATCH.
# Run it on the server, then paste the whole output back.
#
#   cd ~/…/KNIGHTSWATCH/stadium-tracker && ./deploy/diagnose.sh
#
PORT="${PORT:-5280}"
echo "===================  stadium-tracker diagnose  ==================="
echo "date:      $(date)"
echo "host:      $(hostname)"
echo "port:      ${PORT}"
echo

echo "--- 1. is the code up to date? ---"
git -C "$(dirname "${BASH_SOURCE[0]}")/.." log --oneline -1 2>/dev/null || echo "(not a git checkout here)"
echo

echo "--- 2. systemd service state ---"
systemctl is-active stadium-tracker 2>/dev/null && systemctl status stadium-tracker --no-pager -l 2>/dev/null | head -n 6 \
  || echo "(service 'stadium-tracker' not installed — are you running it by hand?)"
echo

echo "--- 3. what is listening on ${PORT}? (want :::${PORT} = dual-stack) ---"
if command -v ss >/dev/null; then sudo ss -ltnp | grep ":${PORT}" || echo "NOTHING is listening on ${PORT}";
elif command -v netstat >/dev/null; then sudo netstat -ltnp | grep ":${PORT}" || echo "NOTHING is listening on ${PORT}";
else echo "(no ss/netstat)"; fi
echo

echo "--- 4. serve locally ---"
curl -s -o /dev/null -w "localhost IPv4: %{http_code}\n" "http://127.0.0.1:${PORT}/" || echo "localhost IPv4: FAILED"
curl -s -o /dev/null -w "localhost IPv6: %{http_code}\n" "http://[::1]:${PORT}/" || echo "localhost IPv6: FAILED"
echo

echo "--- 5. tailscale ---"
if command -v tailscale >/dev/null; then
  echo "IPv4: $(tailscale ip -4 2>/dev/null)"
  echo "IPv6: $(tailscale ip -6 2>/dev/null)"
  TS4="$(tailscale ip -4 2>/dev/null | head -n1)"
  [ -n "${TS4}" ] && curl -s -o /dev/null -w "self via tailscale IPv4: %{http_code}\n" "http://${TS4}:${PORT}/" || true
else
  echo "(tailscale CLI not found)"
fi
echo

echo "--- 6. host firewall ---"
if command -v ufw >/dev/null; then sudo ufw status 2>/dev/null | head -n 12;
elif command -v firewall-cmd >/dev/null; then sudo firewall-cmd --list-all 2>/dev/null | head -n 12;
else echo "(no ufw/firewalld — probably fine)"; fi
echo "===================  end  ==================="
