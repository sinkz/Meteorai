import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePaths } from '../../lib/paths.js';
import { createWebServer } from '../../lib/web/server.js';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web');

export function serveCmd(program) {
  program
    .command('serve')
    .description('Start the local web dashboard on 127.0.0.1')
    .option('-p, --port <n>', 'port number', (v) => parseInt(v, 10), 7681)
    .option('--open', 'open browser after start', false)
    .action(async (opts) => {
      const paths = resolvePaths();
      const server = createWebServer({ dbFile: paths.db, webDir: WEB_DIR });
      server.listen(opts.port, '127.0.0.1', () => {
        process.stdout.write(`quanta UI → http://127.0.0.1:${opts.port}\n`);
        if (opts.open) {
          import('node:child_process').then(({ exec }) => exec(`xdg-open http://127.0.0.1:${opts.port} 2>/dev/null || open http://127.0.0.1:${opts.port} 2>/dev/null`));
        }
      });
      process.on('SIGTERM', () => { server.close(); process.exit(0); });
      process.on('SIGINT',  () => { server.close(); process.exit(0); });
    });
}
