import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readPidfile } from '../lib/otel/lifecycle.js';

// ── Phase 4.2 ────────────────────────────────────────────────────────────────

describe('ensureReceiverRunning', () => {
  it('readPidfile returns null when file absent', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pidtest-'));
    try {
      const pid = readPidfile(path.join(dir, 'receiver.pid'));
      assert.equal(pid, null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('readPidfile returns integer from file', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pidtest-'));
    const pidfile = path.join(dir, 'receiver.pid');
    try {
      writeFileSync(pidfile, '12345\n');
      assert.equal(readPidfile(pidfile), 12345);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ensureReceiverRunning is a no-op when receiver is already alive', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pidtest-'));
    const pidfile = path.join(dir, 'receiver.pid');
    try {
      // Write current process PID (guaranteed alive)
      writeFileSync(pidfile, String(process.pid));
      const { ensureReceiverRunning } = await import('../lib/otel/lifecycle.js');
      // Should not throw or spawn anything
      ensureReceiverRunning({
        paths: { root: dir, db: path.join(dir, 'tracker.db'), errorLog: path.join(dir, 'errors.log') },
      });
      // pidfile still holds the same PID (no new spawn overwrote it)
      assert.equal(readPidfile(pidfile), process.pid);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
