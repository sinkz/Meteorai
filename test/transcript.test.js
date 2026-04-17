import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseTranscript } from '../lib/transcript.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(here, 'fixtures', 'transcripts', name);

test('parseTranscript: sums usage across assistant events', async () => {
  const r = await parseTranscript(fixture('simple.jsonl'));
  assert.equal(r.tokens_input, 300);
  assert.equal(r.tokens_output, 80);
  assert.equal(r.tokens_cache_read, 60);
  assert.equal(r.tokens_cache_creation, 20);
});

test('parseTranscript: captures model from last assistant event', async () => {
  const r = await parseTranscript(fixture('simple.jsonl'));
  assert.equal(r.model, 'claude-sonnet-4-6');
});

test('parseTranscript: detects git commit in Bash tool_use', async () => {
  const r = await parseTranscript(fixture('simple.jsonl'));
  assert.equal(r.commit_generated, 1);
  assert.equal(r.last_commit_message, "feat: x");
});

test('parseTranscript: no commit_generated when no git commit ran', async () => {
  const r = await parseTranscript(fixture('no-commit.jsonl'));
  assert.equal(r.commit_generated, 0);
  assert.equal(r.model, 'claude-opus-4-7');
});

test('parseTranscript: tolerates malformed lines (skip, not throw)', async () => {
  const r = await parseTranscript(fixture('malformed.jsonl'));
  assert.equal(r.tokens_input, 30);
  assert.equal(r.tokens_output, 13);
});

test('parseTranscript: returns zeros for missing file', async () => {
  const r = await parseTranscript('/no/such/file.jsonl');
  assert.equal(r.tokens_input, 0);
  assert.equal(r.tokens_output, 0);
  assert.equal(r.model, null);
});

test('parseTranscript: does NOT persist message text content', async () => {
  const r = await parseTranscript(fixture('simple.jsonl'));
  const serialized = JSON.stringify(r);
  assert.ok(!serialized.includes('olá'), 'assistant text must not leak');
  assert.ok(!serialized.includes('oi'), 'user text must not leak');
});
