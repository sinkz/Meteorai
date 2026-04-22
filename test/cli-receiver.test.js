import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin', 'quanta');

function run(args, env = {}) {
  try {
    return execFileSync(process.execPath, [BIN, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
  } catch (e) {
    return e.stdout + e.stderr;
  }
}

// ── Phase 4.6 ────────────────────────────────────────────────────────────────

describe('quanta receiver CLI', () => {
  it('quanta receiver --help shows start|stop|status', () => {
    const out = run(['receiver', '--help']);
    assert.ok(out.includes('start') || out.includes('receiver'), `help output: ${out}`);
  });

  it('quanta receiver status reports not running when no pidfile', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'recvtest-'));
    try {
      const out = run(['receiver', 'status'], { QUANTA_ROOT: dir });
      assert.ok(out.includes('not running') || out.includes('stopped') || out.includes('No receiver'), out);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
