import test from 'node:test';
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
    assert.deepEqual(
      tables.filter(t => !t.startsWith('sqlite_')),
      ['notifications', 'sessions', 'tool_calls'],
    );
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

test('sessions table: has all expected columns', () => {
  const { dir, file } = fresh();
  try {
    const db = openDb(file);
    const cols = db.prepare('PRAGMA table_info(sessions)').all().map(c => c.name);
    for (const name of [
      'id', 'started_at', 'ended_at', 'duration_seconds',
      'branch_name', 'ticket_id', 'project_name',
      'tokens_input', 'tokens_output', 'tokens_cache_read',
      'cost_usd', 'model_used', 'exit_reason',
      'commit_generated', 'assertiveness_score',
      'tool_call_count', 'rerun_count',
    ]) {
      assert.ok(cols.includes(name), `missing column sessions.${name}`);
    }
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tool_calls table: has expected columns', () => {
  const { dir, file } = fresh();
  try {
    const db = openDb(file);
    const cols = db.prepare('PRAGMA table_info(tool_calls)').all().map(c => c.name);
    for (const name of [
      'id', 'session_id', 'tool_name', 'target_file', 'called_at', 'success',
    ]) {
      assert.ok(cols.includes(name), `missing column tool_calls.${name}`);
    }
    db.close();
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
