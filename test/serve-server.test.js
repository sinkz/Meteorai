import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
  });
}

// ── Phase 7.1 ────────────────────────────────────────────────────────────────

describe('quanta serve', () => {
  let server;
  let port;
  let tmpDir;

  before(async () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'serve-'));
    const { createWebServer } = await import('../lib/web/server.js');
    server = createWebServer({ dbFile: path.join(tmpDir, 'tracker.db'), webDir: null });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => {
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /healthz returns 200 on loopback', async () => {
    const res = await get(`http://127.0.0.1:${port}/healthz`);
    assert.equal(res.status, 200);
  });

  it('binds only to 127.0.0.1 (loopback)', () => {
    const addr = server.address();
    assert.equal(addr.address, '127.0.0.1');
  });

  // ── Phase 7.3 ──────────────────────────────────────────────────────────────

  it('GET /api/summary returns JSON with session_count', async () => {
    const res = await get(`http://127.0.0.1:${port}/api/summary?period=all`);
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type']?.includes('application/json'));
    const body = JSON.parse(res.body);
    assert.ok('session_count' in body.summary, 'summary.session_count required');
    assert.ok(Array.isArray(body.topBranches), 'topBranches required');
  });

  // ── Phase 7.4 ──────────────────────────────────────────────────────────────

  it('GET /api/sessions returns JSON array', async () => {
    const res = await get(`http://127.0.0.1:${port}/api/sessions?limit=10`);
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body), 'should return an array');
  });

  // ── Phase 7.5 ──────────────────────────────────────────────────────────────

  it('GET /api/timeseries returns JSON array with bucket/value', async () => {
    const res = await get(`http://127.0.0.1:${port}/api/timeseries?metric=cost&bucket=day`);
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body), 'timeseries should be an array');
  });

  // ── Phase 7.7 ──────────────────────────────────────────────────────────────

  it('unknown path returns 404', async () => {
    const res = await get(`http://127.0.0.1:${port}/nonexistent`);
    assert.equal(res.status, 404);
  });
});
