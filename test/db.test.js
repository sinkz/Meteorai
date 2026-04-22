import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db.js';

function fresh() {
  const dir = mkdtempSync(path.join(tmpdir(), 'cctracker-db-'));
  return { dir, file: path.join(dir, 'tracker.db') };
}

test('openDb: creates schema on fresh file', () => {
  const { dir, file } = fresh();
  try {
    const db = openDb(file);
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
    ).all().map(r => r.name);
    assert.ok(tables.includes('sessions'), 'sessions table required');
    assert.ok(tables.includes('otel_metrics'), 'otel_metrics table required');
    assert.ok(tables.includes('otel_events'), 'otel_events table required');
    assert.ok(!tables.includes('tool_calls'), 'tool_calls must not exist in v2');
    assert.ok(!tables.includes('notifications'), 'notifications must not exist in v2');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('openDb: enables WAL journaling', () => {
  const { dir, file } = fresh();
  try {
    const db = openDb(file);
    const mode = db.prepare('PRAGMA journal_mode').get();
    assert.equal(mode.journal_mode, 'wal');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('openDb: migrations are idempotent', () => {
  const { dir, file } = fresh();
  try {
    const db1 = openDb(file);
    const v1 = db1.prepare('PRAGMA user_version').get().user_version;
    db1.close();

    const db2 = openDb(file);
    const v2 = db2.prepare('PRAGMA user_version').get().user_version;
    assert.equal(v1, v2);
    assert.ok(v1 >= 1, 'user_version should advance past 0');
    db2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test('sessions: can insert and read a row', () => {
  const { dir, file } = fresh();
  try {
    const db = openDb(file);
    db.prepare(`
      INSERT INTO sessions (id, started_at, branch_name, project_name)
      VALUES (?, ?, ?, ?)
    `).run('sess-1', 1700000000, 'feat/x', 'proj');
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('sess-1');
    assert.equal(row.branch_name, 'feat/x');
    assert.equal(row.started_at, 1700000000);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Phase 1.1 ────────────────────────────────────────────────────────────────

describe('schema v2', () => {
  it('openDb: user_version reaches 2 after migration', () => {
    const { dir, file } = fresh();
    try {
      const db = openDb(file);
      const v = db.pragma('user_version', { simple: true });
      assert.equal(v, 2);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sessions table: has slim v2 columns (no tool_call_count / assertiveness_score)', () => {
    const { dir, file } = fresh();
    try {
      const db = openDb(file);
      const cols = db.prepare('PRAGMA table_info(sessions)').all().map(c => c.name);
      for (const name of ['id', 'started_at', 'ended_at', 'exit_reason', 'branch_name', 'ticket_id', 'project_name', 'cwd']) {
        assert.ok(cols.includes(name), `missing column sessions.${name}`);
      }
      assert.ok(!cols.includes('assertiveness_score'), 'assertiveness_score must be removed in v2');
      assert.ok(!cols.includes('tool_call_count'), 'tool_call_count must be removed in v2');
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('otel_metrics table: exists with expected columns', () => {
    const { dir, file } = fresh();
    try {
      const db = openDb(file);
      const cols = db.prepare('PRAGMA table_info(otel_metrics)').all().map(c => c.name);
      for (const name of ['id', 'session_id', 'metric_name', 'value', 'unit', 'attributes_json', 'recorded_at']) {
        assert.ok(cols.includes(name), `missing column otel_metrics.${name}`);
      }
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('otel_events table: exists with expected columns', () => {
    const { dir, file } = fresh();
    try {
      const db = openDb(file);
      const cols = db.prepare('PRAGMA table_info(otel_events)').all().map(c => c.name);
      for (const name of ['id', 'session_id', 'event_name', 'prompt_id', 'attributes_json', 'body_json', 'recorded_at']) {
        assert.ok(cols.includes(name), `missing column otel_events.${name}`);
      }
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // ── Phase 1.2 ──────────────────────────────────────────────────────────────

  it('session_metrics_view: aggregates cost_usd, tokens, commit_count, tool_call_count', () => {
    const { dir, file } = fresh();
    try {
      const db = openDb(file);
      const now = Math.floor(Date.now() / 1000);
      db.prepare('INSERT INTO sessions (id, started_at, branch_name) VALUES (?, ?, ?)').run('s1', now - 60, 'main');

      const insMetric = db.prepare(
        'INSERT INTO otel_metrics (session_id, metric_name, value, unit, attributes_json, recorded_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      insMetric.run('s1', 'claude_code.cost.usage',   0.05, 'USD', '{}', now);
      insMetric.run('s1', 'claude_code.cost.usage',   0.03, 'USD', '{}', now + 1);
      insMetric.run('s1', 'claude_code.token.usage',  100,  'token', '{"type":"input"}',  now);
      insMetric.run('s1', 'claude_code.token.usage',  200,  'token', '{"type":"output"}', now);
      insMetric.run('s1', 'claude_code.token.usage',  50,   'token', '{"type":"cacheRead"}', now);
      insMetric.run('s1', 'claude_code.commit.count', 2,    '1',     '{}', now);

      const insEvent = db.prepare(
        'INSERT INTO otel_events (session_id, event_name, prompt_id, attributes_json, recorded_at) VALUES (?, ?, ?, ?, ?)'
      );
      insEvent.run('s1', 'claude_code.tool_result', 'p1', '{}', now);
      insEvent.run('s1', 'claude_code.tool_result', 'p2', '{}', now);
      insEvent.run('s1', 'claude_code.tool_result', 'p3', '{}', now);

      const row = db.prepare('SELECT * FROM session_metrics_view WHERE session_id = ?').get('s1');
      assert.ok(Math.abs(row.cost_usd - 0.08) < 0.0001, `cost_usd expected 0.08, got ${row.cost_usd}`);
      assert.equal(row.tokens_input,      100);
      assert.equal(row.tokens_output,     200);
      assert.equal(row.tokens_cache_read, 50);
      assert.equal(row.commit_count,      2);
      assert.equal(row.tool_call_count,   3);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
