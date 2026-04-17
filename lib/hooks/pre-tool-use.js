import { randomUUID } from 'node:crypto';

function targetFileFromInput(toolName, input) {
  if (!input || typeof input !== 'object') return null;
  if (toolName === 'Bash') return null;
  return input.file_path ?? input.notebook_path ?? input.path ?? null;
}

export function preToolUseHandler({ payload, db }) {
  const now = Math.floor(Date.now() / 1000);
  // Guarantee session row exists — SessionStart may not have fired yet
  db.prepare(`
    INSERT OR IGNORE INTO sessions (id, started_at) VALUES (?, ?)
  `).run(payload.session_id, now);

  const target = targetFileFromInput(payload.tool_name, payload.tool_input);
  db.prepare(`
    INSERT INTO tool_calls (id, session_id, tool_name, target_file, called_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    payload.session_id,
    payload.tool_name ?? 'unknown',
    target,
    now,
  );
}
