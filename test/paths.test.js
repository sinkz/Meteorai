import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolvePaths } from '../lib/paths.js';

test('resolvePaths: uses $HOME/.cc-tracker by default', () => {
  const p = resolvePaths({ env: { HOME: '/home/alice' } });
  assert.equal(p.root, '/home/alice/.cc-tracker');
  assert.equal(p.db, '/home/alice/.cc-tracker/tracker.db');
  assert.equal(p.config, '/home/alice/.cc-tracker/config.json');
  assert.equal(p.errorLog, '/home/alice/.cc-tracker/errors.log');
});

test('resolvePaths: honors CC_TRACKER_HOME override', () => {
  const p = resolvePaths({
    env: { HOME: '/home/alice', CC_TRACKER_HOME: '/tmp/test-123' },
  });
  assert.equal(p.root, '/tmp/test-123');
  assert.equal(p.db, path.join('/tmp/test-123', 'tracker.db'));
});

test('resolvePaths: throws when HOME is missing and no override', () => {
  assert.throws(
    () => resolvePaths({ env: {} }),
    /HOME/,
  );
});
