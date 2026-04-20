import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDb } from '../../lib/db.js';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, '..', '..', 'bin', 'quanta');

export function freshWorld() {
  const dir = mkdtempSync(path.join(tmpdir(), 'quanta-acc-'));
  return {
    trackerHome: dir,
    lastStdout: '',
    lastStderr: '',
    lastExit: 0,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function withDb(world, fn) {
  const db = openDb(path.join(world.trackerHome, 'tracker.db'));
  try { return fn(db); } finally { db.close(); }
}

export const steps = [
  {
    re: /^a clean quanta database$/,
    run: (world) => {
      rmSync(world.trackerHome, { recursive: true, force: true });
      withDb(world, () => {});
    },
  },
  {
    re: /^a session "([^"]+)" on branch "([^"]+)" with cost ([\d.]+) and score (\d+) from (\d+) hours ago$/,
    run: (world, [id, branch, cost, score, hoursAgo]) => {
      withDb(world, (db) => {
        const now = Math.floor(Date.now() / 1000);
        const startedAt = now - Number(hoursAgo) * 3600;
        db.prepare(`
          INSERT INTO sessions (id, started_at, ended_at, duration_seconds,
            branch_name, project_name, tokens_input, tokens_output, cost_usd,
            assertiveness_score, exit_reason, commit_generated, tool_call_count)
          VALUES (?, ?, ?, 600, ?, 'p', 1000, 200, ?, ?, 'success', 1, 5)
        `).run(id, startedAt, startedAt + 600, branch, Number(cost), Number(score));
      });
    },
  },
  {
    re: /^I run "([^"]+)"$/,
    run: (world, [argv]) => {
      const args = argv.split(/\s+/);
      try {
        world.lastStdout = execFileSync('node', [CLI, ...args], {
          env: { ...process.env, QUANTA_HOME: world.trackerHome, NO_COLOR: '1' },
          encoding: 'utf8',
        });
        world.lastExit = 0;
      } catch (err) {
        world.lastStdout = err.stdout?.toString() ?? '';
        world.lastStderr = err.stderr?.toString() ?? '';
        world.lastExit = err.status ?? 1;
      }
    },
  },
  {
    re: /^the output contains "([^"]+)"$/,
    run: (world, [needle], assert) => {
      assert.ok(
        world.lastStdout.includes(needle),
        `expected output to contain:\n  "${needle}"\n\ngot:\n${world.lastStdout}`,
      );
    },
  },
  {
    re: /^the output does not contain "([^"]+)"$/,
    run: (world, [needle], assert) => {
      assert.ok(
        !world.lastStdout.includes(needle),
        `output should NOT contain "${needle}" — got:\n${world.lastStdout}`,
      );
    },
  },
  {
    re: /^the output is a JSON array with (\d+) elements$/,
    run: (world, [n], assert) => {
      world._json = JSON.parse(world.lastStdout);
      assert.ok(Array.isArray(world._json), 'output is not a JSON array');
      assert.equal(world._json.length, Number(n));
    },
  },
  {
    re: /^the JSON contains an item with "([^"]+)" equal to "([^"]+)"$/,
    run: (world, [field, val], assert) => {
      const found = world._json.some(r => String(r[field]) === val);
      assert.ok(found, `no item with ${field}="${val}"`);
    },
  },
  {
    re: /^the JSON contains an item with "([^"]+)" equal to ([\d.]+)$/,
    run: (world, [field, val], assert) => {
      const found = world._json.some(r => Number(r[field]) === Number(val));
      assert.ok(found, `no item with ${field}=${val}`);
    },
  },
];
