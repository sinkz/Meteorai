import { createServer } from 'node:net';
import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { resolvePaths } from '../../lib/paths.js';
import { readPidfile, stopReceiver } from '../../lib/otel/lifecycle.js';
import { createReceiver } from '../../lib/otel/receiver.js';

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (_) { return false; }
}

export function receiverCmd(program) {
  const cmd = program
    .command('receiver')
    .description('Manage the OTLP receiver process');

  cmd
    .command('start')
    .description('Start the OTLP receiver on 127.0.0.1:4318')
    .option('--detached', 'run in background (used internally by hook)', false)
    .action(async (opts) => {
      const paths = resolvePaths();
      const pid = readPidfile(paths.pidfile);
      if (pid && isAlive(pid)) {
        process.stdout.write(`Receiver already running (pid ${pid})\n`);
        return;
      }
      const server = createReceiver({
        dbFile: paths.db,
        errorLog: paths.errorLog,
        host: '127.0.0.1',
        port: 4318,
      });
      server.listen(4318, '127.0.0.1', () => {
        writeFileSync(paths.pidfile, String(process.pid));
        if (!opts.detached) {
          process.stdout.write(`Receiver listening on http://127.0.0.1:4318 (pid ${process.pid})\n`);
        }
      });
      process.on('SIGTERM', () => { server.close(); process.exit(0); });
      process.on('SIGINT',  () => { server.close(); process.exit(0); });
    });

  cmd
    .command('stop')
    .description('Stop the running receiver')
    .action(() => {
      const paths = resolvePaths();
      const stopped = stopReceiver(paths.pidfile);
      process.stdout.write(stopped ? 'Receiver stopped.\n' : 'No receiver running.\n');
    });

  cmd
    .command('status')
    .description('Show receiver status')
    .action(() => {
      const paths = resolvePaths();
      const pid = readPidfile(paths.pidfile);
      if (pid && isAlive(pid)) {
        process.stdout.write(`Receiver running (pid ${pid}) — http://127.0.0.1:4318\n`);
      } else {
        process.stdout.write('No receiver running.\n');
      }
    });
}
