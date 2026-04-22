import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { openDb } from '../db.js';
import { summarize, topBranches, listSessions, resolvePeriod, timeseriesByBucket } from '../queries.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
};

function parseQS(url) {
  const q = new URL(url, 'http://localhost').searchParams;
  return Object.fromEntries(q.entries());
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function serveStatic(res, webDir, urlPath) {
  if (!webDir) { res.writeHead(404); res.end('Not Found'); return; }
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(webDir, safe === '/' ? 'index.html' : safe);
  const ext = path.extname(filePath);
  if (!MIME[ext] || !existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404); res.end('Not Found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[ext] });
  res.end(readFileSync(filePath));
}

export function createWebServer({ dbFile, webDir }) {
  return http.createServer((req, res) => {
    const urlPath = req.url?.split('?')[0] ?? '/';
    const qs = parseQS(req.url ?? '/');

    if (urlPath === '/healthz') {
      return json(res, { ok: true });
    }

    if (urlPath === '/api/summary') {
      const db = openDb(dbFile);
      try {
        const range = resolvePeriod(qs.period ?? 'all');
        return json(res, {
          summary: summarize(db, range),
          topBranches: topBranches(db, { ...range, limit: 5 }),
        });
      } finally { db.close(); }
    }

    if (urlPath === '/api/sessions') {
      const db = openDb(dbFile);
      try {
        return json(res, listSessions(db, {
          branch: qs.branch,
          project: qs.project,
          from: qs.from ? Number(qs.from) : undefined,
          to: qs.to ? Number(qs.to) : undefined,
          limit: qs.limit ? Number(qs.limit) : 50,
        }));
      } finally { db.close(); }
    }

    if (urlPath === '/api/timeseries') {
      const db = openDb(dbFile);
      try {
        return json(res, timeseriesByBucket(db, {
          metric: qs.metric ?? 'cost',
          bucket: qs.bucket ?? 'day',
          from: qs.from ? Number(qs.from) : undefined,
          to: qs.to ? Number(qs.to) : undefined,
        }));
      } finally { db.close(); }
    }

    if (urlPath === '/' || (webDir && MIME[path.extname(urlPath)])) {
      return serveStatic(res, webDir, urlPath);
    }

    res.writeHead(404); res.end('Not Found');
  });
}
