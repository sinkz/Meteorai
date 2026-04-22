import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db.js';
import { sessionStartHandler } from '../lib/hooks/session-start.js';
import { sessionEndHandler } from '../lib/hooks/session-end.js';

function gitRepo(branch) {
  const dir = mkdtempSync(path.join(tmpdir(), 'hookrepo-'));
  const sh = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' });
  sh('git init -q');
  sh('git config user.email t@t.t');
  sh('git config user.name t');
  sh('git config commit.gpgsign false');
  sh(`git checkout -b ${branch}`);
  writeFileSync(path.join(dir, 'x'), '1');
  sh('git add x && git commit -q -m init');
  return dir;
}

function tmpDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'hookdb-'));
  const db = openDb(path.join(dir, 'tracker.db'));
  return { dir, db };
}

// ── Phase 4.1 ────────────────────────────────────────────────────────────────

describe('SessionStart (v2 schema)', () => {
  it('inserts session row with git context into slim sessions table', () => {
    const repo = gitRepo('feat/TICK-99-my-feature');
    const { dir, db } = tmpDb();
    try {
      sessionStartHandler({ payload: { session_id: 's1', cwd: repo }, db });
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('s1');
      assert.equal(row.branch_name, 'feat/TICK-99-my-feature');
      assert.equal(row.ticket_id, 'TICK-99');
      assert.ok(row.started_at > 0);
      assert.equal(row.cwd, repo);
    } finally {
      db.close();
      rmSync(repo, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not insert v1-only columns (tokens_input, cost_usd, assertiveness_score)', () => {
    const repo = gitRepo('main');
    const { dir, db } = tmpDb();
    try {
      sessionStartHandler({ payload: { session_id: 's2', cwd: repo }, db });
      const cols = db.prepare('PRAGMA table_info(sessions)').all().map(c => c.name);
      assert.ok(!cols.includes('tokens_input'), 'tokens_input must not exist in v2');
      assert.ok(!cols.includes('cost_usd'), 'cost_usd must not exist in v2 sessions table');
      assert.ok(!cols.includes('assertiveness_score'), 'assertiveness_score must not exist in v2');
    } finally {
      db.close();
      rmSync(repo, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── Phase 4.4 ────────────────────────────────────────────────────────────────

describe('SessionEnd (v2 schema)', () => {
  it('stamps ended_at and exit_reason on existing session', async () => {
    const { dir, db } = tmpDb();
    const now = Math.floor(Date.now() / 1000);
    try {
      db.prepare('INSERT INTO sessions (id, started_at) VALUES (?, ?)').run('e1', now - 30);
      await sessionEndHandler({ payload: { session_id: 'e1', reason: 'clear' }, db });
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('e1');
      assert.ok(row.ended_at >= now, `ended_at should be set: ${row.ended_at}`);
      assert.equal(row.exit_reason, 'clear');
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('inserts session row if missing (session_id not in sessions)', async () => {
    const { dir, db } = tmpDb();
    try {
      await sessionEndHandler({ payload: { session_id: 'e2', reason: 'logout' }, db });
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('e2');
      assert.ok(row, 'session row must exist after SessionEnd');
      assert.equal(row.exit_reason, 'logout');
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
