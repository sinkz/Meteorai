import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runHook } from '../lib/hook-runtime.js';

function tmp() {
  return mkdtempSync(path.join(tmpdir(), 'cctracker-hook-'));
}

test('runHook: invokes handler with parsed payload and db handle', async () => {
  const dir = tmp();
  try {
    let seen = null;
    const payload = { session_id: 's1', hook_event_name: 'Stop' };
    const exit = await runHook({
      payloadStdin: JSON.stringify(payload),
      env: { QUANTA_HOME: dir },
      handler: (ctx) => {
        seen = ctx;
      },
    });
    assert.equal(exit, 0);
    assert.equal(seen.payload.session_id, 's1');
    assert.ok(seen.db);
    seen.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runHook: returns 0 and writes errors.log on handler throw', async () => {
  const dir = tmp();
  try {
    const exit = await runHook({
      payloadStdin: JSON.stringify({ session_id: 'sx' }),
      env: { QUANTA_HOME: dir },
      handler: () => { throw new Error('boom'); },
    });
    assert.equal(exit, 0);
    const logPath = path.join(dir, 'errors.log');
    assert.ok(existsSync(logPath));
    const log = readFileSync(logPath, 'utf8');
    assert.ok(log.includes('boom'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runHook: returns 0 on malformed stdin', async () => {
  const dir = tmp();
  try {
    const exit = await runHook({
      payloadStdin: 'not json at all',
      env: { QUANTA_HOME: dir },
      handler: () => { throw new Error('should not be called'); },
    });
    assert.equal(exit, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runHook: skips handler when payload has no session_id', async () => {
  const dir = tmp();
  try {
    let called = false;
    const exit = await runHook({
      payloadStdin: JSON.stringify({ hook_event_name: 'X' }),
      env: { QUANTA_HOME: dir },
      handler: () => { called = true; },
    });
    assert.equal(exit, 0);
    assert.equal(called, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
