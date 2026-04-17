import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../lib/db.js';
import { sessionStartHandler } from '../lib/hooks/session-start.js';
import { preToolUseHandler } from '../lib/hooks/pre-tool-use.js';
import { postToolUseHandler } from '../lib/hooks/post-tool-use.js';
import { stopHandler } from '../lib/hooks/stop.js';
import { notificationHandler } from '../lib/hooks/notification.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (n) => path.join(here, 'fixtures', 'transcripts', n);

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
  return { dir, db: openDb(path.join(dir, 'tracker.db')) };
}

test('SessionStart: inserts session row with git context', () => {
  const repo = gitRepo('feat/FABLEE-42-x');
  const { dir, db } = tmpDb();
  try {
    sessionStartHandler({
      payload: { session_id: 's1', cwd: repo },
      db,
    });
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('s1');
    assert.equal(row.branch_name, 'feat/FABLEE-42-x');
    assert.equal(row.ticket_id, 'FABLEE-42');
    assert.ok(row.started_at > 0);
  } finally {
    db.close();
    rmSync(repo, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PreToolUse: records tool_call with target_file', () => {
  const { dir, db } = tmpDb();
  try {
    preToolUseHandler({
      payload: {
        session_id: 's2',
        tool_name: 'Edit',
        tool_input: { file_path: '/a/b.js' },
      },
      db,
    });
    const row = db.prepare('SELECT * FROM tool_calls WHERE session_id = ?').get('s2');
    assert.equal(row.tool_name, 'Edit');
    assert.equal(row.target_file, '/a/b.js');
    assert.equal(row.success, null);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PostToolUse: marks success and detects rerun after 4 edits on same file', () => {
  const { dir, db } = tmpDb();
  try {
    for (let i = 0; i < 4; i++) {
      preToolUseHandler({
        payload: { session_id: 's3', tool_name: 'Edit', tool_input: { file_path: '/x.js' } },
        db,
      });
      postToolUseHandler({
        payload: {
          session_id: 's3',
          tool_name: 'Edit',
          tool_input: { file_path: '/x.js' },
          tool_response: {},
        },
        db,
      });
    }
    const sess = db.prepare('SELECT rerun_count FROM sessions WHERE id = ?').get('s3');
    assert.equal(sess.rerun_count, 1);
    const calls = db.prepare('SELECT COUNT(*) AS c FROM tool_calls WHERE success = 1').get();
    assert.equal(calls.c, 4);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PostToolUse: marks failure when tool_response has error', () => {
  const { dir, db } = tmpDb();
  try {
    preToolUseHandler({
      payload: { session_id: 's4', tool_name: 'Bash', tool_input: { command: 'ls' } },
      db,
    });
    postToolUseHandler({
      payload: {
        session_id: 's4',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
        tool_response: { error: 'nope' },
      },
      db,
    });
    const row = db.prepare('SELECT success FROM tool_calls WHERE session_id = ?').get('s4');
    assert.equal(row.success, 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Stop: aggregates tokens, cost, score from transcript', async () => {
  const { dir, db } = tmpDb();
  try {
    db.prepare(`INSERT INTO sessions (id, started_at) VALUES ('s5', ?)`).run(
      Math.floor(Date.now() / 1000) - 60,
    );
    await stopHandler({
      payload: {
        session_id: 's5',
        hook_event_name: 'Stop',
        transcript_path: fixture('simple.jsonl'),
      },
      db,
    });
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get('s5');
    assert.equal(row.tokens_input, 300);
    assert.equal(row.tokens_output, 80);
    assert.equal(row.tokens_cache_read, 60);
    assert.equal(row.model_used, 'claude-sonnet-4-6');
    assert.equal(row.exit_reason, 'success');
    assert.equal(row.commit_generated, 1);
    assert.ok(row.cost_usd > 0);
    assert.ok(row.assertiveness_score >= 0 && row.assertiveness_score <= 100);
    assert.ok(row.duration_seconds >= 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Stop: marks exit_reason=error on StopFailure event', async () => {
  const { dir, db } = tmpDb();
  try {
    await stopHandler({
      payload: {
        session_id: 's6',
        hook_event_name: 'StopFailure',
        transcript_path: fixture('no-commit.jsonl'),
      },
      db,
    });
    const row = db.prepare('SELECT exit_reason FROM sessions WHERE id = ?').get('s6');
    assert.equal(row.exit_reason, 'error');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Notification: inserts row', () => {
  const { dir, db } = tmpDb();
  try {
    notificationHandler({
      payload: { session_id: 's7', message: 'Permission needed' },
      db,
    });
    const n = db.prepare('SELECT * FROM notifications WHERE session_id = ?').get('s7');
    assert.equal(n.message, 'Permission needed');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
