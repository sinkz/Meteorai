import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RECEIVER_PORT = 4318;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const RECEIVER_BIN = path.resolve(HERE, '../../bin/quanta');

export function readPidfile(pidfile) {
  try {
    return parseInt(readFileSync(pidfile, 'utf8').trim(), 10);
  } catch (_) {
    return null;
  }
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (_) { return false; }
}

export function startDetached({ dbFile, errorLog, pidfile }) {
  const child = spawn(process.execPath, [RECEIVER_BIN, 'receiver', 'start', '--detached'],
    { env: { ...process.env, QUANTA_DB: dbFile, QUANTA_ERROR_LOG: errorLog }, detached: true, stdio: 'ignore' });
  child.unref();
}

export function ensureReceiverRunning({ paths }) {
  const pidfile = path.join(paths.root, 'receiver.pid');
  const pid = readPidfile(pidfile);
  if (pid && isAlive(pid)) return;
  startDetached({ dbFile: paths.db, errorLog: paths.errorLog, pidfile });
}

export function stopReceiver(pidfile) {
  const pid = readPidfile(pidfile);
  if (!pid) return false;
  try { process.kill(pid, 'SIGTERM'); return true; } catch (_) { return false; }
}
