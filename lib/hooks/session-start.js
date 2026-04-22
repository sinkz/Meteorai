import { readContext } from '../git.js';

export function sessionStartHandler({ payload, db, paths }) {
  const now = Math.floor(Date.now() / 1000);
  const cwd = payload.cwd ?? process.cwd();
  const ctx = readContext(cwd);
  db.prepare(`
    INSERT OR IGNORE INTO sessions
      (id, started_at, branch_name, ticket_id, project_name, cwd)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(payload.session_id, now, ctx.branch_name, ctx.ticket_id, ctx.project_name, cwd);

  if (paths) {
    import('../otel/lifecycle.js').then(({ ensureReceiverRunning }) => {
      try { ensureReceiverRunning({ paths }); } catch (_) { /* never block hook */ }
    }).catch(() => {});
  }
}
