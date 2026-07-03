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

server.listen(PORT, () => {
  console.log(`\n  🏟️  Stadium Trip Tracker running`);
  console.log(`      http://localhost:${PORT}\n`);
  console.log('      Press Ctrl+C to stop.\n');
});
