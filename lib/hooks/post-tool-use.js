const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);

export function postToolUseHandler({ payload, db }) {
  // Update latest matching tool_call for this session/tool/target as success
  const target = payload.tool_input?.file_path
    ?? payload.tool_input?.notebook_path
    ?? payload.tool_input?.path
    ?? null;

  const success = payload.tool_response?.error ? 0 : 1;

  db.prepare(`
    UPDATE tool_calls SET success = ?
    WHERE id = (
      SELECT id FROM tool_calls
      WHERE session_id = ? AND tool_name = ? AND success IS NULL
        AND (target_file IS ? OR target_file = ?)
      ORDER BY called_at DESC LIMIT 1
    )
  `).run(success, payload.session_id, payload.tool_name ?? 'unknown', target, target);

  // rerun detection: same file edited > 3x
  if (target && WRITE_TOOLS.has(payload.tool_name)) {
    const { cnt } = db.prepare(`
      SELECT COUNT(*) AS cnt FROM tool_calls
      WHERE session_id = ? AND target_file = ? AND tool_name IN ('Write','Edit','NotebookEdit')
    `).get(payload.session_id, target);
    if (cnt > 3) {
      db.prepare(`UPDATE sessions SET rerun_count = rerun_count + 1 WHERE id = ?`)
        .run(payload.session_id);
    }
  }
}
