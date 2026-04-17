import { execFileSync } from 'node:child_process';
import path from 'node:path';

const DEFAULT_TICKET_PATTERN = '([A-Z]+-\\d+)';

function run(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

export function extractTicketId(branch, pattern = DEFAULT_TICKET_PATTERN) {
  if (!branch) return null;
  const re = new RegExp(pattern);
  const m = branch.match(re);
  return m ? m[1] : null;
}

export function readContext(cwd, { ticketPattern } = {}) {
  const branch = run(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return {
    branch_name: branch || null,
    ticket_id: extractTicketId(branch, ticketPattern),
    project_name: path.basename(cwd),
  };
}

export function hasNewCommitSince(cwd, unixTimestamp) {
  const out = run(cwd, [
    'log', '-1', '--format=%H', `--since=@${unixTimestamp}`,
  ]);
  return !!out;
}
