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
      min_score: opts.minScore,
      max_score: opts.maxScore,
      limit: opts.limit ?? 50,
    };
    const rows = listSessions(db, filters);
    if (rows.length === 0) {
      console.log('Nenhuma sessão encontrada.');
      return;
    }
    const t = new Table({
      head: ['ID', 'Data', 'Duração', 'Tokens', 'Custo', 'Score', 'Resultado'],
      style: { head: [], border: [] },
    });
    for (const r of rows) {
      t.push([
        r.id.slice(0, 8),
        fmtDate(r.started_at),
        fmtDuration(r.duration_seconds),
        `${fmtTokens(r.tokens_input)}/${fmtTokens(r.tokens_output)}`,
        fmtUsd(r.cost_usd),
        r.assertiveness_score ?? '-',
        r.exit_reason ?? '-',
      ]);
    }
    console.log(t.toString());
  } finally {
    db.close();
  }
}
