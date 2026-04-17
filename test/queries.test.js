import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db.js';
import {
  resolvePeriod,
  summarize,
  listSessions,
  topBranches,
} from '../lib/queries.js';

function seed() {
  const dir = mkdtempSync(path.join(tmpdir(), 'q-'));
  const db = openDb(path.join(dir, 'tracker.db'));
  const ins = db.prepare(`
    INSERT INTO sessions
      (id, started_at, ended_at, duration_seconds, branch_name, ticket_id,
       project_name, tokens_input, tokens_output, cost_usd, model_used,
       exit_reason, commit_generated, assertiveness_score, tool_call_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Epoch: all timestamps below are anchored to the test now.
  const now = Math.floor(Date.now() / 1000);
  const hoursAgo = (h) => now - h * 3600;
  const rows = [
    ['s1', hoursAgo(1),  hoursAgo(0), 3600, 'feat/a', 'A-1', 'proj', 1000, 500, 0.50, 'claude-sonnet-4-6', 'success', 1, 80, 5],
    ['s2', hoursAgo(2),  hoursAgo(1), 3600, 'feat/a', 'A-1', 'proj', 2000, 800, 1.20, 'claude-sonnet-4-6', 'success', 1, 75, 8],
    ['s3', hoursAgo(36), hoursAgo(35), 3600,'feat/b', 'B-2', 'proj', 500,  100, 0.10, 'claude-sonnet-4-6', 'error',   0, 40, 3],
  ];
  for (const r of rows) ins.run(...r);
  return { dir, db, now };
}

test('resolvePeriod: all returns null bounds', () => {
  const p = resolvePeriod('all', { now: 1000, config: {} });
  assert.equal(p.from, null);
  assert.equal(p.to, null);
});

test('resolvePeriod: week returns 7-day window', () => {
  const now = 1_000_000;
  const p = resolvePeriod('week', { now, config: {} });
  assert.equal(p.to, now);
  assert.equal(p.from, now - 7 * 86400);
});

test('resolvePeriod: sprint uses config duration_days', () => {
  const now = 1_000_000;
  const p = resolvePeriod('sprint', {
    now,
    config: { sprint_duration_days: 14 },
  });
  assert.equal(p.to, now);
  assert.equal(p.from, now - 14 * 86400);
});

test('summarize: counts sessions and totals in period', () => {
  const { dir, db, now } = seed();
  try {
    const s = summarize(db, { from: now - 24 * 3600, to: now });
    assert.equal(s.session_count, 2);
    assert.equal(s.tokens_input, 3000);
    assert.equal(s.tokens_output, 1300);
    assert.equal(Number(s.cost_usd.toFixed(2)), 1.70);
    assert.equal(s.avg_score, Math.round((80 + 75) / 2));
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('summarize: all-time includes every session', () => {
  const { dir, db } = seed();
  try {
    const s = summarize(db, { from: null, to: null });
    assert.equal(s.session_count, 3);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('topBranches: ordered by cost desc', () => {
  const { dir, db } = seed();
  try {
    const top = topBranches(db, { from: null, to: null, limit: 5 });
    assert.equal(top[0].branch_name, 'feat/a');
    assert.equal(Number(top[0].cost_usd.toFixed(2)), 1.70);
    assert.equal(top[1].branch_name, 'feat/b');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('listSessions: filters by branch', () => {
  const { dir, db } = seed();
  try {
    const rows = listSessions(db, { branch: 'feat/b' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 's3');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('listSessions: filters by min_score and max_score', () => {
  const { dir, db } = seed();
  try {
    const ok = listSessions(db, { min_score: 70 });
    assert.equal(ok.length, 2);
    const bad = listSessions(db, { max_score: 50 });
    assert.equal(bad.length, 1);
    assert.equal(bad[0].id, 's3');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
