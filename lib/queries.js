const DAY = 86400;

export function resolvePeriod(period, { now = Math.floor(Date.now() / 1000), config = {} } = {}) {
  if (!period || period === 'all') return { from: null, to: null };
  const map = {
    day: 1,
    week: 7,
    month: 30,
    sprint: config.sprint_duration_days ?? 14,
  };
  const days = map[period];
  if (days == null) return { from: null, to: null };
  return { from: now - days * DAY, to: now };
}

function whereClauses({ from, to, branch, project }) {
  const w = [];
  const p = [];
  if (from    != null) { w.push('started_at >= ?'); p.push(from); }
  if (to      != null) { w.push('started_at <= ?'); p.push(to); }
  if (branch)          { w.push('branch_name = ?'); p.push(branch); }
  if (project)         { w.push('project_name = ?'); p.push(project); }
  return { sql: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
}

export function summarize(db, filters = {}) {
  const { sql, params } = whereClauses(filters);
  return db.prepare(`
    SELECT
      COUNT(*)                          AS session_count,
      COALESCE(SUM(cost_usd), 0)        AS cost_usd,
      COALESCE(SUM(tokens_input), 0)    AS tokens_input,
      COALESCE(SUM(tokens_output), 0)   AS tokens_output,
      COALESCE(SUM(tokens_cache_read), 0) AS tokens_cache_read,
      COALESCE(SUM(commit_count), 0)    AS commit_count
    FROM session_metrics_view
    ${sql}
  `).get(...params);
}

export function topBranches(db, filters = {}) {
  const { limit = 5 } = filters;
  const { sql, params } = whereClauses(filters);
  const extra = filters.branch ? '' : 'AND branch_name IS NOT NULL';
  const sqlWhere = sql
    ? `${sql} ${extra}`
    : (extra ? `WHERE ${extra.replace(/^AND /, '')}` : '');
  return db.prepare(`
    SELECT
      branch_name,
      COUNT(*)               AS session_count,
      COALESCE(SUM(cost_usd), 0) AS cost_usd
    FROM session_metrics_view
    ${sqlWhere}
    GROUP BY branch_name
    ORDER BY cost_usd DESC
    LIMIT ?
  `).all(...params, limit);
}

export function listSessions(db, filters = {}) {
  const { sql, params } = whereClauses(filters);
  return db.prepare(`
    SELECT * FROM session_metrics_view
    ${sql}
    ORDER BY started_at DESC
    ${filters.limit ? 'LIMIT ?' : ''}
  `).all(...params, ...(filters.limit ? [filters.limit] : []));
}

export function getAllSessionsForExport(db, filters = {}) {
  return listSessions(db, filters);
}

export function timeseriesByBucket(db, { metric = 'cost', bucket = 'day', from, to } = {}) {
  const metricName = metric === 'cost' ? 'claude_code.cost.usage' : `claude_code.${metric}`;
  const bucketSecs = bucket === 'day' ? DAY : bucket === 'week' ? 7 * DAY : DAY;
  const params = [];
  const w = [];
  if (from != null) { w.push('recorded_at >= ?'); params.push(from); }
  if (to   != null) { w.push('recorded_at <= ?'); params.push(to); }
  const sql = w.length ? 'WHERE metric_name = ? AND ' + w.join(' AND ') : 'WHERE metric_name = ?';
  params.unshift(metricName);
  return db.prepare(`
    SELECT
      (recorded_at / ${bucketSecs}) * ${bucketSecs} AS bucket,
      SUM(value) AS value
    FROM otel_metrics
    ${sql}
    GROUP BY bucket
    ORDER BY bucket ASC
  `).all(...params);
}
