import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db.js';
import { resolvePeriod, summarize, listSessions, topBranches } from '../lib/queries.js';

function seed() {
  const dir = mkdtempSync(path.join(tmpdir(), 'q-'));
  const db = openDb(path.join(dir, 'tracker.db'));
  const now = Math.floor(Date.now() / 1000);
  const hoursAgo = (h) => now - h * 3600;

  const insSess = db.prepare('INSERT INTO sessions (id, started_at, ended_at, branch_name, ticket_id, project_name) VALUES (?, ?, ?, ?, ?, ?)');
  insSess.run('s1', hoursAgo(2),  hoursAgo(1), 'feat/a', 'A-1', 'proj');
  insSess.run('s2', hoursAgo(3),  hoursAgo(2), 'feat/a', 'A-1', 'proj');
  insSess.run('s3', hoursAgo(37), hoursAgo(36), 'feat/b', 'B-2', 'proj');

  const insM = db.prepare('INSERT INTO otel_metrics (session_id, metric_name, value, unit, attributes_json, recorded_at) VALUES (?, ?, ?, ?, ?, ?)');
  // s1: cost 0.50, tokens_input 1000, tokens_output 500
  insM.run('s1', 'claude_code.cost.usage',   0.50, 'USD',   '{}',             hoursAgo(1));
  insM.run('s1', 'claude_code.token.usage',  1000, 'token', '{"type":"input"}', hoursAgo(1));
  insM.run('s1', 'claude_code.token.usage',  500,  'token', '{"type":"output"}', hoursAgo(1));
  // s2: cost 1.20, tokens_input 2000
  insM.run('s2', 'claude_code.cost.usage',   1.20, 'USD',   '{}',             hoursAgo(2));
  insM.run('s2', 'claude_code.token.usage',  2000, 'token', '{"type":"input"}', hoursAgo(2));
  insM.run('s2', 'claude_code.token.usage',  800,  'token', '{"type":"output"}', hoursAgo(2));
  // s3: cost 0.10 (older than 24h)
  insM.run('s3', 'claude_code.cost.usage',   0.10, 'USD',   '{}',             hoursAgo(36));

  return { dir, db, now };
}

// ── resolvePeriod (unchanged) ─────────────────────────────────────────────────

describe('resolvePeriod', () => {
  it('all returns null bounds', () => {
    const p = resolvePeriod('all', { now: 1000, config: {} });
    assert.equal(p.from, null);
    assert.equal(p.to, null);
  });

  it('week returns 7-day window', () => {
    const now = 1_000_000;
    const p = resolvePeriod('week', { now, config: {} });
    assert.equal(p.to, now);
    assert.equal(p.from, now - 7 * 86400);
  });

  it('sprint uses config sprint_duration_days', () => {
    const now = 1_000_000;
    const p = resolvePeriod('sprint', { now, config: { sprint_duration_days: 14 } });
    assert.equal(p.from, now - 14 * 86400);
  });
});

// ── Phase 5.1 — summarize reads from session_metrics_view ────────────────────

describe('summarize', () => {
  it('counts sessions and sums cost/tokens in period', () => {
    const { dir, db, now } = seed();
    try {
      const s = summarize(db, { from: now - 24 * 3600, to: now });
      assert.equal(s.session_count, 2);
      assert.ok(Math.abs(s.cost_usd - 1.70) < 0.01, `cost_usd: ${s.cost_usd}`);
      assert.equal(s.tokens_input, 3000);
      assert.equal(s.tokens_output, 1300);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  it('all-time includes every session', () => {
    const { dir, db } = seed();
    try {
      const s = summarize(db, { from: null, to: null });
      assert.equal(s.session_count, 3);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  it('sessions with no metrics still appear (cost=0)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'q-empty-'));
    const db = openDb(path.join(dir, 'tracker.db'));
    try {
      db.prepare('INSERT INTO sessions (id, started_at) VALUES (?, ?)').run('empty', Math.floor(Date.now()/1000));
      const s = summarize(db, {});
      assert.equal(s.session_count, 1);
      assert.equal(s.cost_usd, 0);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});

// ── Phase 5.2 — topBranches sums view cost_usd per branch ────────────────────

describe('topBranches', () => {
  it('ordered by cost desc', () => {
    const { dir, db } = seed();
    try {
      const top = topBranches(db, { from: null, to: null, limit: 5 });
      assert.equal(top[0].branch_name, 'feat/a');
      assert.ok(Math.abs(top[0].cost_usd - 1.70) < 0.01);
      assert.equal(top[1].branch_name, 'feat/b');
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});

// ── Phase 5.3 — listSessions returns view rows ────────────────────────────────

describe('listSessions', () => {
  it('filters by branch', () => {
    const { dir, db } = seed();
    try {
      const rows = listSessions(db, { branch: 'feat/b' });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].session_id, 's3');
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  it('tolerates sessions with no metrics (cost=0)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'q-nometa-'));
    const db = openDb(path.join(dir, 'tracker.db'));
    try {
      db.prepare('INSERT INTO sessions (id, started_at) VALUES (?, ?)').run('nometa', Math.floor(Date.now()/1000));
      const rows = listSessions(db, {});
      assert.equal(rows.length, 1);
      assert.equal(rows[0].cost_usd, 0);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});
