import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { computeDelta, applyDeltas, resetDeltas } from '../lib/otel/deltas.js';

// ── Phase 3.3 ────────────────────────────────────────────────────────────────

describe('computeDelta', () => {
  it('returns difference between current and previous value', () => {
    assert.equal(computeDelta(10, 15), 5);
    assert.equal(computeDelta(0, 42), 42);
    assert.equal(computeDelta(100, 100), 0);
  });

  it('handles first observation (prev=0)', () => {
    assert.equal(computeDelta(0, 7.5), 7.5);
  });
});

describe('applyDeltas', () => {
  beforeEach(() => resetDeltas());

  it('returns first observation as-is (delta from 0)', () => {
    const rows = [
      { session_id: 's1', metric_name: 'claude_code.cost.usage', value: 0.05, attributes_json: '{}', unit: 'USD', recorded_at: 1 },
    ];
    const result = applyDeltas(rows);
    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0].value - 0.05) < 0.0001);
  });

  it('returns delta on second call for same (session, metric, attrs)', () => {
    const row = (v) => ({ session_id: 's1', metric_name: 'claude_code.cost.usage', value: v, attributes_json: '{}', unit: 'USD', recorded_at: 1 });
    applyDeltas([row(0.10)]);
    const result = applyDeltas([row(0.17)]);
    assert.ok(Math.abs(result[0].value - 0.07) < 0.0001, `expected 0.07 got ${result[0].value}`);
  });

  it('tracks different (session, metric, attrs) keys independently', () => {
    const r1 = { session_id: 's1', metric_name: 'claude_code.token.usage', value: 100, attributes_json: '{"type":"input"}', unit: 'token', recorded_at: 1 };
    const r2 = { session_id: 's1', metric_name: 'claude_code.token.usage', value: 50,  attributes_json: '{"type":"output"}', unit: 'token', recorded_at: 1 };
    applyDeltas([r1, r2]);

    const r1b = { ...r1, value: 150 };
    const r2b = { ...r2, value: 80 };
    const result = applyDeltas([r1b, r2b]);

    const inp = result.find(r => JSON.parse(r.attributes_json).type === 'input');
    const out = result.find(r => JSON.parse(r.attributes_json).type === 'output');
    assert.equal(inp.value, 50);
    assert.equal(out.value, 30);
  });

  it('filters out zero-delta rows', () => {
    const row = (v) => ({ session_id: 's1', metric_name: 'claude_code.commit.count', value: v, attributes_json: '{}', unit: '1', recorded_at: 1 });
    applyDeltas([row(5)]);
    const result = applyDeltas([row(5)]);
    assert.equal(result.length, 0, 'zero-delta rows should be dropped');
  });
});
