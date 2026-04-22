import Table from 'cli-table3';
import { dbHandle, fmtUsd, fmtTokens } from '../shared.js';
import { resolvePeriod, summarize, topBranches } from '../../lib/queries.js';

function periodLabel(period) {
  return {
    day: 'Last 24h',
    week: 'Last 7 days',
    month: 'Last 30 days',
    sprint: 'Current sprint',
    all: 'Full history',
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
    console.log(`Sessions:         ${s.session_count}`);
    console.log(`Total cost:       ${fmtUsd(s.cost_usd)}`);
    console.log(
      `Total tokens:     ${fmtTokens(s.tokens_input)} input / ${fmtTokens(s.tokens_output)} output`,
    );
    console.log(`Commits:          ${s.commit_count}`);

    if (top.length > 0) {
      console.log('\nTop branches by cost:');
      const t = new Table({
        head: ['Branch', 'Sessions', 'Cost'],
        style: { head: [], border: [] },
      });
      for (const b of top) {
        t.push([b.branch_name ?? '(no branch)', b.session_count, fmtUsd(b.cost_usd)]);
      }
      console.log(t.toString());
    }
  } finally {
    db.close();
  }
}
