export async function sessionEndHandler({ payload, db }) {
  const now = Math.floor(Date.now() / 1000);
  const id = payload.session_id;
  const reason = payload.reason ?? 'other';

  db.prepare(`
    INSERT OR IGNORE INTO sessions (id, started_at) VALUES (?, ?)
  `).run(id, now);

  db.prepare(`
    UPDATE sessions SET ended_at = ?, exit_reason = ? WHERE id = ?
  `).run(now, reason, id);
}
