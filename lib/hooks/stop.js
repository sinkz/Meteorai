import { parseTranscript } from '../transcript.js';
import { calculateCost, loadPricing } from '../cost.js';
import { computeScore } from '../score.js';

export async function stopHandler({ payload, db }) {
  const now = Math.floor(Date.now() / 1000);
  const exit_reason = payload.hook_event_name === 'StopFailure' ? 'error' : 'success';

  // Ensure session row exists (Stop might arrive before SessionStart in unusual cases)
  db.prepare(`
    INSERT OR IGNORE INTO sessions (id, started_at) VALUES (?, ?)
  `).run(payload.session_id, now);

  const parsed = payload.transcript_path
    ? await parseTranscript(payload.transcript_path)
    : { tokens_input: 0, tokens_output: 0, tokens_cache_read: 0, model: null,
        commit_generated: 0, last_commit_message: null };

  const cost = calculateCost(parsed, parsed.model, loadPricing());

  const row = db.prepare('SELECT started_at, rerun_count FROM sessions WHERE id = ?')
    .get(payload.session_id);
  const duration = row?.started_at ? now - row.started_at : 0;

  const { toolCallCount } = db.prepare(
    `SELECT COUNT(*) AS toolCallCount FROM tool_calls WHERE session_id = ?`,
  ).get(payload.session_id);

  const score = computeScore({
    duration_seconds: duration,
    rerun_count: row?.rerun_count ?? 0,
    exit_reason,
    commit_generated: parsed.commit_generated,
    last_commit_message: parsed.last_commit_message,
    tokens_input: parsed.tokens_input,
    tokens_output: parsed.tokens_output,
  });

  db.prepare(`
    UPDATE sessions SET
      ended_at = ?,
      duration_seconds = ?,
      tokens_input = ?,
      tokens_output = ?,
      tokens_cache_read = ?,
      cost_usd = ?,
      model_used = COALESCE(?, model_used),
      exit_reason = ?,
      commit_generated = ?,
      tool_call_count = ?,
      assertiveness_score = ?
    WHERE id = ?
  `).run(
    now,
    duration,
    parsed.tokens_input,
    parsed.tokens_output,
    parsed.tokens_cache_read,
    cost,
    parsed.model,
    exit_reason,
    parsed.commit_generated,
    toolCallCount,
    score,
    payload.session_id,
  );
}
