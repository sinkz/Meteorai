import { appendFileSync } from 'node:fs';
import { createHttpServer } from './server.js';
import { openDb } from '../db.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function requireJson(req, res, errorLog) {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('application/json')) {
    res.writeHead(415, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Only http/json OTLP is supported. Set OTEL_EXPORTER_OTLP_PROTOCOL=http/json.' }));
    return false;
  }
  return true;
}

function logError(errorLog, err) {
  try {
    appendFileSync(errorLog, `[${new Date().toISOString()}] ${err}\n`);
  } catch (_) { /* never block */ }
}

export function createReceiver({ dbFile, errorLog, host = '127.0.0.1', port = 4318 }) {
  let db;
  try { db = openDb(dbFile); } catch (e) { logError(errorLog, e); }

  async function handleMetrics(req, res) {
    if (!requireJson(req, res, errorLog)) return;
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw);
      if (db) {
        const { normalizeMetrics } = await import('./normalize.js');
        const { applyDeltas } = await import('./deltas.js');
        const rows = applyDeltas(normalizeMetrics(payload));
        const ins = db.prepare(
          'INSERT INTO otel_metrics (session_id, metric_name, value, unit, attributes_json, recorded_at) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const insertAll = db.transaction((rows) => {
          for (const r of rows) ins.run(r.session_id, r.metric_name, r.value, r.unit, r.attributes_json, r.recorded_at);
        });
        insertAll(rows);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    } catch (e) {
      logError(errorLog, e);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    }
  }

  async function handleLogs(req, res) {
    if (!requireJson(req, res, errorLog)) return;
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw);
      if (db) {
        const { normalizeLogs } = await import('./normalize.js');
        const rows = normalizeLogs(payload);
        const ins = db.prepare(
          'INSERT INTO otel_events (session_id, event_name, prompt_id, attributes_json, body_json, recorded_at) VALUES (?, ?, ?, ?, ?, ?)'
        );
        const insertAll = db.transaction((rows) => {
          for (const r of rows) ins.run(r.session_id, r.event_name, r.prompt_id, r.attributes_json, r.body_json, r.recorded_at);
        });
        insertAll(rows);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    } catch (e) {
      logError(errorLog, e);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{}');
    }
  }

  return createHttpServer({
    'POST /v1/metrics': handleMetrics,
    'POST /v1/logs': handleLogs,
  });
}
