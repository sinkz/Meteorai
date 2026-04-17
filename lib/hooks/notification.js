export function notificationHandler({ payload, db }) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT OR IGNORE INTO sessions (id, started_at) VALUES (?, ?)
  `).run(payload.session_id, now);
  db.prepare(`
    INSERT INTO notifications (session_id, message, created_at) VALUES (?, ?, ?)
  `).run(payload.session_id, payload.message ?? null, now);
}
