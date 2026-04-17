const CONVENTIONAL_RE = /^(feat|fix|chore|docs|refactor|test|style|perf|build|ci|revert)(\(.+\))?!?:\s/;
const LONG_SESSION_SECONDS = 10 * 60;

export function computeScore(s) {
  let score = 100;

  if ((s.rerun_count ?? 0) > 3) score -= 15;
  if (s.exit_reason === 'error') score -= 20;
  if ((s.duration_seconds ?? 0) > LONG_SESSION_SECONDS && !s.commit_generated) {
    score -= 10;
  }

  if (s.commit_generated && s.last_commit_message
      && CONVENTIONAL_RE.test(s.last_commit_message)) {
    score += 10;
  }

  const input = s.tokens_input ?? 0;
  const output = s.tokens_output ?? 0;
  if (input > 0 && output / input > 0.3) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}
