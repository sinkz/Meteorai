import Table from 'cli-table3';
import { dbHandle, parseDate, fmtUsd, fmtTokens, fmtDate, fmtDuration } from '../shared.js';
import { listSessions } from '../../lib/queries.js';

export function sessions(opts) {
  const { db } = dbHandle();
  try {
    const filters = {
      branch: opts.branch,
      project: opts.project,
      from: parseDate(opts.from),
      to: parseDate(opts.to),
      limit: opts.limit ?? 50,
    };
    const rows = listSessions(db, filters);
    if (rows.length === 0) {
      console.log('No sessions found.');
      return;
    }
    const t = new Table({
      head: ['ID', 'Date', 'Duration', 'Tokens in/out', 'Cost', 'Commits', 'Exit'],
      style: { head: [], border: [] },
    });
    for (const r of rows) {
      t.push([
        r.session_id.slice(0, 8),
        fmtDate(r.started_at),
        fmtDuration(r.duration_seconds),
        `${fmtTokens(r.tokens_input)}/${fmtTokens(r.tokens_output)}`,
        fmtUsd(r.cost_usd),
        r.commit_count ?? 0,
        r.exit_reason ?? '-',
      ]);
    }
    console.log(t.toString());
  } finally {
    db.close();
  }
}
