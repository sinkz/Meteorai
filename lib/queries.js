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

function whereClauses({ from, to, branch, project, minScore, maxScore }) {
  const w = [];
  const p = [];
  if (from != null) { w.push('started_at >= ?'); p.push(from); }
  if (to   != null) { w.push('started_at <= ?'); p.push(to); }
  if (branch)       { w.push('branch_name = ?'); p.push(branch); }
  if (project)      { w.push('project_name = ?'); p.push(project); }
  if (minScore != null) { w.push('assertiveness_score >= ?'); p.push(minScore); }
  if (maxScore != null) { w.push('assertiveness_score <= ?'); p.push(maxScore); }
  return { sql: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
}

export function summarize(db, filters) {
  const { sql, params } = whereClauses(filters);
  const row = db.prepare(`
    SELECT
      COUNT(*) AS session_count,
      COALESCE(SUM(tokens_input), 0)  AS tokens_input,
      COALESCE(SUM(tokens_output), 0) AS tokens_output,
      COALESCE(SUM(tokens_cache_read), 0) AS tokens_cache_read,
      COALESCE(SUM(cost_usd), 0) AS cost_usd,
      COALESCE(ROUND(AVG(assertiveness_score)), 0) AS avg_score
    FROM sessions
    ${sql}
  `).get(...params);
  return row;
}

export function topBranches(db, filters) {
  const { limit = 5 } = filters;
  const { sql, params } = whereClauses(filters);
  const extra = filters.branch ? '' : 'AND branch_name IS NOT NULL';
  const sqlWhere = sql
    ? `${sql} ${extra}`
    : (extra ? `WHERE ${extra.replace(/^AND /, '')}` : '');
  return db.prepare(`
    SELECT
      branch_name,
      COUNT(*) AS session_count,
      COALESCE(SUM(cost_usd), 0) AS cost_usd,
      COALESCE(ROUND(AVG(assertiveness_score)), 0) AS avg_score
    FROM sessions
    ${sqlWhere}
    GROUP BY branch_name
    ORDER BY cost_usd DESC
    LIMIT ?
  `).all(...params, limit);
}

export function listSessions(db, filters = {}) {
  const norm = {
    ...filters,
    minScore: filters.min_score ?? filters.minScore,
    maxScore: filters.max_score ?? filters.maxScore,
  };
  const { sql, params } = whereClauses(norm);
  return db.prepare(`
    SELECT * FROM sessions
    ${sql}
    ORDER BY started_at DESC
    ${filters.limit ? 'LIMIT ?' : ''}
  `).all(...params, ...(filters.limit ? [filters.limit] : []));
}

export function getAllSessionsForExport(db, filters = {}) {
  return listSessions(db, filters);
}
