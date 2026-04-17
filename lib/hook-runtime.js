import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { resolvePaths } from './paths.js';
import { openDb } from './db.js';

export async function readStdin(stream = process.stdin) {
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function logError(errorLogPath, err) {
  try {
    mkdirSync(path.dirname(errorLogPath), { recursive: true });
    const stamp = new Date().toISOString();
    appendFileSync(errorLogPath, `[${stamp}] ${err.stack ?? err.message ?? err}\n`);
  } catch {
    // swallow — never block the Claude Code session
  }
}

export async function runHook({ payloadStdin, env, handler }) {
  let paths;
  try {
    paths = resolvePaths({ env });
  } catch (err) {
    // No HOME, nothing we can do. Never block.
    return 0;
  }

  let payload;
  try {
    payload = JSON.parse(payloadStdin);
  } catch (err) {
    logError(paths.errorLog, err);
    return 0;
  }

  if (!payload?.session_id) return 0;

  let db;
  try {
    db = openDb(paths.db);
    await handler({ payload, db, paths, env });
  } catch (err) {
    logError(paths.errorLog, err);
  } finally {
    try { db?.close(); } catch {}
  }
  return 0;
}

export async function runHookAsCli(handler) {
  const stdin = await readStdin();
  const exit = await runHook({
    payloadStdin: stdin,
    env: process.env,
    handler,
  });
  process.exit(exit);
}
