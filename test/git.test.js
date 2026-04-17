import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readContext, extractTicketId } from '../lib/git.js';

function repo(branch = 'feat/FABLEE-123-demo') {
  const dir = mkdtempSync(path.join(tmpdir(), 'cctracker-git-'));
  const sh = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' });
  sh('git init -q');
  sh('git config user.email test@test.test');
  sh('git config user.name Test');
  sh('git config commit.gpgsign false');
  sh('git config tag.gpgsign false');
  sh(`git checkout -b ${branch}`);
  writeFileSync(path.join(dir, 'file.txt'), 'x');
  sh('git add file.txt');
  sh('git commit -q -m "chore: init"');
  return dir;
}

test('readContext: reads branch, project name and ticket id', () => {
  const dir = repo('feat/FABLEE-87-story');
  try {
    const ctx = readContext(dir);
    assert.equal(ctx.branch_name, 'feat/FABLEE-87-story');
    assert.equal(ctx.ticket_id, 'FABLEE-87');
    assert.equal(ctx.project_name, path.basename(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readContext: returns nulls when cwd is not a git repo', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'cctracker-nogit-'));
  try {
    const ctx = readContext(dir);
    assert.equal(ctx.branch_name, null);
    assert.equal(ctx.ticket_id, null);
    assert.equal(ctx.project_name, path.basename(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('extractTicketId: matches default pattern FABLEE-123', () => {
  assert.equal(extractTicketId('feat/FABLEE-123-thing'), 'FABLEE-123');
  assert.equal(extractTicketId('fix/ABC-9'), 'ABC-9');
  assert.equal(extractTicketId('main'), null);
  assert.equal(extractTicketId('feat/no-ticket-here'), null);
});

test('extractTicketId: custom pattern overrides default', () => {
  assert.equal(
    extractTicketId('spike-42-foo', '(spike-\\d+)'),
    'spike-42',
  );
});

test('readContext: does NOT read file diffs', () => {
  const dir = repo('feat/x');
  try {
    const ctx = readContext(dir);
    const serialized = JSON.stringify(ctx);
    assert.ok(!serialized.includes('file.txt'));
    assert.ok(!serialized.includes('chore: init'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
