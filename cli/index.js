import { Command } from 'commander';
import { summary } from './commands/summary.js';
import { sessions } from './commands/sessions.js';
import { exportCmd } from './commands/export.js';
import { receiverCmd } from './commands/receiver.js';

export function run(argv) {
  const program = new Command();
  program
    .name('quanta')
    .description('Cost and productivity tracker for Claude Code sessions')
    .version('1.0.0');

  program
    .command('summary')
    .description('Show aggregated summary for a period')
    .option('-p, --period <period>', 'day|week|month|sprint|all', 'sprint')
    .action((opts) => summary(opts));

  program
    .command('sessions')
    .description('List sessions with optional filters')
    .option('-b, --branch <name>', 'filter by branch')
    .option('--project <name>', 'filter by project')
    .option('--from <date>', 'YYYY-MM-DD lower bound')
    .option('--to <date>', 'YYYY-MM-DD upper bound')
    .option('--min-score <n>', 'minimum assertiveness score', (v) => parseInt(v, 10))
    .option('--max-score <n>', 'maximum assertiveness score', (v) => parseInt(v, 10))
    .option('-l, --limit <n>', 'limit number of rows', (v) => parseInt(v, 10), 50)
    .action((opts) => sessions(opts));

  program
    .command('export')
    .description('Export raw session data')
    .option('-p, --period <period>', 'day|week|month|sprint|all', 'all')
    .option('-f, --format <format>', 'json|csv', 'json')
    .option('-b, --branch <name>', 'filter by branch')
    .option('--project <name>', 'filter by project')
    .action((opts) => exportCmd(opts));

  receiverCmd(program);

  program.parseAsync(argv);
}
