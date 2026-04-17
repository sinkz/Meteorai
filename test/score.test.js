import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore } from '../lib/score.js';

const BASE = {
  duration_seconds: 300,
  rerun_count: 0,
  exit_reason: 'success',
  commit_generated: 0,
  last_commit_message: null,
  tokens_input: 1000,
  tokens_output: 200,
};

test('computeScore: perfect success, no penalties, no bonuses', () => {
  // output/input = 0.2 < 0.3, no commit → no bonuses
  // no penalties triggered
  assert.equal(computeScore(BASE), 100);
});

test('computeScore: penalizes rerun_count > 3 by 15', () => {
  const s = computeScore({ ...BASE, rerun_count: 4 });
  assert.equal(s, 85);
});

test('computeScore: penalizes error exit_reason by 20', () => {
  const s = computeScore({ ...BASE, exit_reason: 'error' });
  assert.equal(s, 80);
});

test('computeScore: penalizes no commit in long session by 10', () => {
  const s = computeScore({ ...BASE, duration_seconds: 11 * 60 });
  assert.equal(s, 90);
});

test('computeScore: NO penalty for no commit in short session', () => {
  const s = computeScore({ ...BASE, duration_seconds: 5 * 60 });
  assert.equal(s, 100);
});

test('computeScore: NO penalty when commit was generated in long session', () => {
  const s = computeScore({
    ...BASE,
    duration_seconds: 30 * 60,
    commit_generated: 1,
    last_commit_message: 'chore: something',
  });
  assert.equal(s, 100);
});

test('computeScore: bonus +10 for conventional commit message', () => {
  const s = computeScore({
    ...BASE,
    commit_generated: 1,
    last_commit_message: 'feat(auth): add login',
  });
  assert.equal(s, 100); // already at 100, clamped
});

test('computeScore: conventional commit bonus pushes past penalties', () => {
  const s = computeScore({
    ...BASE,
    rerun_count: 4,
    commit_generated: 1,
    last_commit_message: 'fix: bug',
  });
  // 100 - 15 + 10 = 95
  assert.equal(s, 95);
});

test('computeScore: non-conventional commit message gives no bonus', () => {
  const s = computeScore({
    ...BASE,
    rerun_count: 4,
    commit_generated: 1,
    last_commit_message: 'updated stuff',
  });
  assert.equal(s, 85);
});

test('computeScore: bonus +5 for output/input ratio > 0.3', () => {
  const s = computeScore({
    ...BASE,
    rerun_count: 4,
    tokens_input: 1000,
    tokens_output: 400,
  });
  // -15 + 5 = -10 → 90
  assert.equal(s, 90);
});

test('computeScore: clamps to 0 minimum', () => {
  const s = computeScore({
    ...BASE,
    exit_reason: 'error',
    rerun_count: 10,
    duration_seconds: 60 * 60,
  });
  assert.ok(s >= 0);
  assert.ok(s <= 100);
});

test('computeScore: clamps to 100 maximum', () => {
  const s = computeScore({
    ...BASE,
    commit_generated: 1,
    last_commit_message: 'feat: big',
    tokens_input: 1000,
    tokens_output: 500,
  });
  assert.equal(s, 100);
});
