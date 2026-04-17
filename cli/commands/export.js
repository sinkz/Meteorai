import { dbHandle } from '../shared.js';
import { resolvePeriod, getAllSessionsForExport } from '../../lib/queries.js';

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => csvEscape(r[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

export function exportCmd(opts) {
  const { db, config } = dbHandle();
  try {
    const range = resolvePeriod(opts.period ?? 'all', { config });
    const filters = {
      ...range,
      branch: opts.branch,
      project: opts.project,
    };
    const rows = getAllSessionsForExport(db, filters);
    if ((opts.format ?? 'json') === 'csv') {
      process.stdout.write(toCsv(rows));
    } else {
      process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    }
  } finally {
    db.close();
  }
}
