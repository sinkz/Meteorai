import { readContext } from '../git.js';

export function sessionStartHandler({ payload, db }) {
  const now = Math.floor(Date.now() / 1000);
  const ctx = readContext(payload.cwd ?? process.cwd());
  db.prepare(`
    INSERT OR IGNORE INTO sessions
      (id, started_at, branch_name, ticket_id, project_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    payload.session_id,
    now,
    ctx.branch_name,
    ctx.ticket_id,
    ctx.project_name,
  );
}
