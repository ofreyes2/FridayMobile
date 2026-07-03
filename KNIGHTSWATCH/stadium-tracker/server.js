#!/usr/bin/env node
/**
 * Tiny zero-dependency static server for the Stadium Trip Tracker.
 *
 * Runs the app on its own port, completely independent of the Friday app.
 *   node server.js            # serves on http://localhost:5280
 *   PORT=8080 node server.js  # custom port
 *   node server.js 8080       # custom port (positional)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Collect the machine's reachable IPv4 addresses, flagging any Tailscale
 * address (the 100.64.0.0/10 CGNAT range Tailscale hands out).
 */
function reachableAddresses() {
  const tailscale = [];
  const lan = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const [a, b] = net.address.split('.').map(Number);
      const isTailscale = a === 100 && b >= 64 && b <= 127; // 100.64.0.0/10
      (isTailscale ? tailscale : lan).push(net.address);
    }
  }
  return { tailscale, lan };
}

const ROOT = __dirname;
const PORT = Number(process.env.PORT || process.argv[2] || 5280);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let rel = urlPath === '/' ? '/index.html' : urlPath;

    // Resolve and guard against path traversal outside ROOT.
    const filePath = path.normalize(path.join(ROOT, rel));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403); return res.end('Forbidden');
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  } catch {
    res.writeHead(500); res.end('Server error');
  }
});

let announced = false;
function onListening() {
  if (announced) return;
  announced = true;
  const { tailscale, lan } = reachableAddresses();
  const addr = server.address();
  const family = addr && addr.family === 'IPv6' ? 'IPv4 + IPv6 (dual-stack)' : 'IPv4';
  console.log(`\n  🏟️  Stadium Trip Tracker running  [listening on all interfaces, ${family}]\n`);
  console.log(`      On this machine:  http://localhost:${PORT}`);
  for (const ip of lan) console.log(`      On your network:  http://${ip}:${PORT}`);
  if (tailscale.length) {
    console.log('');
    for (const ip of tailscale) console.log(`      🔒 Tailscale:      http://${ip}:${PORT}   ← reach this from your phone`);
  } else {
    console.log('');
    console.log('      🔒 Tailscale:      not detected on this machine.');
    console.log('                         Install Tailscale + run `tailscale up`, then restart.');
    console.log('                         (see README → "Reach it from your phone via Tailscale")');
  }
  console.log('\n      Press Ctrl+C to stop.\n');
}

/**
 * Bind to ALL interfaces on BOTH IP families so the app is reachable over the
 * Tailscale IPv4 (100.x) *and* IPv6 / MagicDNS name, plus the LAN. Binding to
 * '::' gives dual-stack on Linux (accepts IPv4-mapped connections too). If the
 * host has no IPv6, fall back to IPv4-only so it still starts.
 */
function start(host) {
  const onError = (err) => {
    server.removeListener('error', onError);
    if (host === '::' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL', 'EINVAL', 'EPROTONOSUPPORT'].includes(err.code)) {
      console.warn(`  IPv6 unavailable (${err.code}); falling back to IPv4-only.`);
      start('0.0.0.0');
      return;
    }
    console.error(`  Failed to start on port ${PORT}: ${err.code || err.message}`);
    if (err.code === 'EADDRINUSE') console.error(`  Port ${PORT} is already in use.`);
    process.exit(1);
  };
  server.once('error', onError);
  server.listen(PORT, host, () => {
    server.removeListener('error', onError);
    onListening();
  });
}

start('::');
