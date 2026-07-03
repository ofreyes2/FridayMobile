#!/usr/bin/env bash
#
# Install the Stadium Trip Tracker as a systemd service on KNIGHTSWATCH (or any
# Linux box), so it auto-starts on boot and restarts if it ever crashes.
#
# Usage:
#   ./deploy/install-service.sh            # detect + install (asks for sudo)
#   PORT=8080 ./deploy/install-service.sh  # custom port
#   ./deploy/install-service.sh --dry-run  # just print the unit it would write
#   ./deploy/install-service.sh --uninstall
#
set -euo pipefail

SERVICE=stadium-tracker
UNIT_PATH="/etc/systemd/system/${SERVICE}.service"

# Resolve the app directory = parent of this script's directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TEMPLATE="${SCRIPT_DIR}/${SERVICE}.service"
PORT="${PORT:-5280}"

# Run privileged commands with sudo only when we aren't already root.
SUDO=""
if [[ "${EUID}" -ne 0 ]]; then SUDO="sudo"; fi

# The account the service should run as: the human who invoked us, not root.
RUN_USER="${SUDO_USER:-${USER:-$(id -un)}}"

# Find an absolute node path. Under sudo, root's PATH often lacks a user-level
# (nvm/fnm/volta) node, so fall back to asking the invoking user's login shell.
find_node() {
  local n
  n="$(command -v node 2>/dev/null || true)"
  if [[ -z "${n}" && -n "${SUDO_USER:-}" ]]; then
    n="$(sudo -u "${SUDO_USER}" bash -lc 'command -v node' 2>/dev/null || true)"
  fi
  printf '%s' "${n}"
}

uninstall() {
  echo "Removing ${SERVICE}…"
  ${SUDO} systemctl disable --now "${SERVICE}" 2>/dev/null || true
  ${SUDO} rm -f "${UNIT_PATH}"
  ${SUDO} systemctl daemon-reload
  echo "Done. ${SERVICE} removed."
}

if [[ "${1:-}" == "--uninstall" ]]; then uninstall; exit 0; fi

NODE_BIN="$(find_node)"
if [[ -z "${NODE_BIN}" ]]; then
  echo "ERROR: could not find 'node' on PATH." >&2
  echo "Install Node.js (https://nodejs.org) and re-run." >&2
  exit 1
fi

if [[ ! -f "${TEMPLATE}" ]]; then
  echo "ERROR: unit template not found at ${TEMPLATE}" >&2
  exit 1
fi

# Render the unit from the template.
render() {
  sed \
    -e "s|__USER__|${RUN_USER}|g" \
    -e "s|__DIR__|${APP_DIR}|g" \
    -e "s|__PORT__|${PORT}|g" \
    -e "s|__NODE__|${NODE_BIN}|g" \
    "${TEMPLATE}"
}

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "# Would write to ${UNIT_PATH}:"
  echo "# ---------------------------------------------"
  render
  exit 0
fi

echo "Installing ${SERVICE} systemd service"
echo "  user:    ${RUN_USER}"
echo "  dir:     ${APP_DIR}"
echo "  node:    ${NODE_BIN}"
echo "  port:    ${PORT}"
echo

render | ${SUDO} tee "${UNIT_PATH}" >/dev/null
${SUDO} systemctl daemon-reload
${SUDO} systemctl enable --now "${SERVICE}"

echo
echo "✅ Installed and started."
echo
${SUDO} systemctl --no-pager --full status "${SERVICE}" | head -n 8 || true
echo
echo "Reach it at:"
echo "  http://localhost:${PORT}"
# Show a Tailscale URL if this host is on a tailnet.
if command -v tailscale >/dev/null 2>&1; then
  TS_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
  [[ -n "${TS_IP}" ]] && echo "  http://${TS_IP}:${PORT}   (Tailscale — remember tcp:${PORT} in your ACL)"
fi
echo
echo "Manage it with:"
echo "  sudo systemctl status ${SERVICE}"
echo "  sudo systemctl restart ${SERVICE}"
echo "  journalctl -u ${SERVICE} -f          # live logs"
echo "  ./deploy/install-service.sh --uninstall"
