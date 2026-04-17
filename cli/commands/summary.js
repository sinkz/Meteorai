import Table from 'cli-table3';
import { dbHandle, fmtUsd, fmtTokens } from '../shared.js';
import { resolvePeriod, summarize, topBranches } from '../../lib/queries.js';

function periodLabel(period) {
  return {
    day: 'Últimas 24h',
    week: 'Últimos 7 dias',
    month: 'Últimos 30 dias',
    sprint: 'Sprint atual',
    all: 'Histórico completo',
  }[period] ?? period;
}

export function summary({ period = 'sprint' }) {
  const { db, config } = dbHandle();
  try {
    const range = resolvePeriod(period, { config });
    const s = summarize(db, range);
    const top = topBranches(db, { ...range, limit: 5 });

    console.log(`\n${periodLabel(period)}`);
    console.log('-'.repeat(39));
    console.log(`Sessões:          ${s.session_count}`);
    console.log(`Custo total:      ${fmtUsd(s.cost_usd)}`);
    console.log(
      `Tokens totais:    ${fmtTokens(s.tokens_input)} input / ${fmtTokens(s.tokens_output)} output`,
    );
    console.log(`Score médio:      ${s.avg_score} / 100`);

    if (top.length > 0) {
      console.log('\nTop branches por custo:');
      const t = new Table({
        head: ['Branch', 'Sessões', 'Custo', 'Score'],
        style: { head: [], border: [] },
      });
      for (const b of top) {
        t.push([
          b.branch_name ?? '(sem branch)',
          b.session_count,
          fmtUsd(b.cost_usd),
          b.avg_score,
        ]);
      }
      console.log(t.toString());
    }
  } finally {
    db.close();
  }
}
