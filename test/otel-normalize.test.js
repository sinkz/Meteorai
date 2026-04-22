import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeMetrics, normalizeLogs } from '../lib/otel/normalize.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'otel');

function loadFixture(name) {
  return JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf8'));
}

// ── Phase 3.1 ────────────────────────────────────────────────────────────────

describe('normalizeMetrics', () => {
  it('extracts session_id, metric_name, value, attributes_json, recorded_at from fixture', () => {
    const payload = loadFixture('metrics-sample.json');
    const rows = normalizeMetrics(payload);

    assert.ok(rows.length > 0, 'should return at least one row');

    const costRow = rows.find(r => r.metric_name === 'claude_code.cost.usage');
    assert.ok(costRow, 'should have cost row');
    assert.equal(costRow.session_id, 'sess-abc');
    assert.ok(Math.abs(costRow.value - 0.042) < 0.0001, `value mismatch: ${costRow.value}`);
    assert.equal(costRow.unit, 'USD');
    assert.ok(typeof costRow.attributes_json === 'string', 'attributes_json must be a string');
    assert.ok(typeof costRow.recorded_at === 'number', 'recorded_at must be unix seconds number');
    assert.equal(costRow.recorded_at, 1700000010);

    const inputRow = rows.find(r => r.metric_name === 'claude_code.token.usage' && JSON.parse(r.attributes_json).type === 'input');
    assert.ok(inputRow, 'should have token input row');
    assert.equal(inputRow.value, 1500);
    assert.equal(inputRow.session_id, 'sess-abc');
  });

  it('returns empty array for empty resourceMetrics', () => {
    const rows = normalizeMetrics({ resourceMetrics: [] });
    assert.deepEqual(rows, []);
  });

  it('handles asInt string values as numbers', () => {
    const payload = loadFixture('metrics-sample.json');
    const rows = normalizeMetrics(payload);
    const commitRow = rows.find(r => r.metric_name === 'claude_code.commit.count');
    assert.ok(commitRow, 'commit row must exist');
    assert.equal(typeof commitRow.value, 'number');
    assert.equal(commitRow.value, 3);
  });
});

// ── Phase 3.2 ────────────────────────────────────────────────────────────────

describe('normalizeLogs', () => {
  it('extracts event_name, prompt_id, body, attributes from fixture', () => {
    const payload = loadFixture('logs-sample.json');
    const rows = normalizeLogs(payload);

    assert.equal(rows.length, 2);

    const toolRow = rows.find(r => r.event_name === 'claude_code.tool_result');
    assert.ok(toolRow, 'tool_result event required');
    assert.equal(toolRow.session_id, 'sess-abc');
    assert.equal(toolRow.prompt_id, 'prompt-xyz');
    assert.equal(toolRow.recorded_at, 1700000015);
    assert.ok(typeof toolRow.attributes_json === 'string');
    const attrs = JSON.parse(toolRow.attributes_json);
    assert.equal(attrs['tool.name'], 'Bash');
  });

  it('returns empty array for empty resourceLogs', () => {
    const rows = normalizeLogs({ resourceLogs: [] });
    assert.deepEqual(rows, []);
  });
});
