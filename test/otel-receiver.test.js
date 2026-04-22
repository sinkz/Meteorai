import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';

// Helper: perform an HTTP request and return { status, body }
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('otel-receiver', () => {
  let server;
  let port;
  let tmpDir;

  before(async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'otel-recv-'));
    const dbFile = path.join(tmpDir, 'tracker.db');
    const errorLog = path.join(tmpDir, 'errors.log');
    const { createReceiver } = await import('../lib/otel/receiver.js');
    server = createReceiver({ dbFile, errorLog, host: '127.0.0.1', port: 0 });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(() => {
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Phase 2.1 ────────────────────────────────────────────────────────────

  it('POST /v1/metrics with valid JSON returns 200', async () => {
    const payload = JSON.stringify({ resourceMetrics: [] });
    const res = await request({
      hostname: '127.0.0.1', port,
      path: '/v1/metrics', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);
    assert.equal(res.status, 200);
  });

  it('POST /v1/logs with valid JSON returns 200', async () => {
    const payload = JSON.stringify({ resourceLogs: [] });
    const res = await request({
      hostname: '127.0.0.1', port,
      path: '/v1/logs', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);
    assert.equal(res.status, 200);
  });

  // ── Phase 2.2 ────────────────────────────────────────────────────────────

  it('POST /v1/metrics with non-JSON Content-Type returns 415', async () => {
    const payload = 'not json';
    const res = await request({
      hostname: '127.0.0.1', port,
      path: '/v1/metrics', method: 'POST',
      headers: { 'Content-Type': 'application/x-protobuf', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);
    assert.equal(res.status, 415);
    assert.ok(res.body.includes('http/json'), 'error body should mention http/json');
  });

  it('unknown path returns 404', async () => {
    const res = await request({ hostname: '127.0.0.1', port, path: '/unknown', method: 'GET' });
    assert.equal(res.status, 404);
  });

  // ── Phase 3.5 — end-to-end POST lands rows and view aggregates correctly ──

  it('POST /v1/metrics persists rows and session_metrics_view aggregates cost', async () => {
    const { openDb } = await import('../lib/db.js');
    const db = openDb(path.join(tmpDir, 'tracker.db'));
    const now = Math.floor(Date.now() / 1000);
    db.prepare('INSERT OR IGNORE INTO sessions (id, started_at) VALUES (?, ?)').run('e2e-sess', now - 60);

    const payload = JSON.stringify({
      resourceMetrics: [{
        resource: { attributes: [{ key: 'session.id', value: { stringValue: 'e2e-sess' } }] },
        scopeMetrics: [{
          scope: { name: 'claude_code' },
          metrics: [{
            name: 'claude_code.cost.usage', unit: 'USD',
            sum: { dataPoints: [{ asDouble: 0.10, timeUnixNano: String(BigInt(now) * 1000000000n), attributes: [] }], isMonotonic: true }
          }]
        }]
      }]
    });

    const res = await request({
      hostname: '127.0.0.1', port,
      path: '/v1/metrics', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, payload);
    assert.equal(res.status, 200);

    // Allow async insert to complete
    await new Promise(r => setTimeout(r, 50));

    const row = db.prepare('SELECT * FROM session_metrics_view WHERE session_id = ?').get('e2e-sess');
    assert.ok(row, 'session must appear in view');
    assert.ok(Math.abs(row.cost_usd - 0.10) < 0.001, `cost_usd expected ~0.10, got ${row.cost_usd}`);
    db.close();
  });
});
