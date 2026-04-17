import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCost } from '../lib/cost.js';

const pricing = {
  'claude-sonnet-4-6': { input: 3, output: 15, cache_read: 0.30, cache_creation: 3.75 },
  'claude-opus-4-7':   { input: 15, output: 75, cache_read: 1.50, cache_creation: 18.75 },
};

test('calculateCost: simple input+output for known model', () => {
  const cost = calculateCost(
    { tokens_input: 1_000_000, tokens_output: 1_000_000 },
    'claude-sonnet-4-6',
    pricing,
  );
  assert.equal(cost, 18); // 3 + 15
});

test('calculateCost: includes cache_read with its own rate', () => {
  const cost = calculateCost(
    { tokens_input: 1_000_000, tokens_output: 0, tokens_cache_read: 1_000_000 },
    'claude-sonnet-4-6',
    pricing,
  );
  assert.equal(Number(cost.toFixed(2)), 3.30);
});

test('calculateCost: scales proportionally for partial millions', () => {
  const cost = calculateCost(
    { tokens_input: 500_000, tokens_output: 100_000 },
    'claude-sonnet-4-6',
    pricing,
  );
  // 0.5 * 3 + 0.1 * 15 = 1.5 + 1.5 = 3.0
  assert.equal(Number(cost.toFixed(2)), 3.00);
});

test('calculateCost: unknown model falls back to sonnet rate', () => {
  const cost = calculateCost(
    { tokens_input: 1_000_000, tokens_output: 1_000_000 },
    'claude-unknown-99',
    pricing,
  );
  assert.equal(cost, 18);
});

test('calculateCost: returns 0 when usage is empty', () => {
  const cost = calculateCost({}, 'claude-sonnet-4-6', pricing);
  assert.equal(cost, 0);
});

test('calculateCost: opus is more expensive', () => {
  const u = { tokens_input: 1_000_000, tokens_output: 1_000_000 };
  const sonnet = calculateCost(u, 'claude-sonnet-4-6', pricing);
  const opus = calculateCost(u, 'claude-opus-4-7', pricing);
  assert.ok(opus > sonnet);
});
