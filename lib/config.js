import { readFileSync, existsSync } from 'node:fs';

const DEFAULTS = {
  ticket_pattern: '([A-Z]+-\\d+)',
  sprint_start_day: 'Monday',
  sprint_duration_days: 14,
  loop_threshold_tool_calls: 20,
  rerun_threshold_same_file: 3,
};

export function loadConfig(configPath) {
  if (!configPath || !existsSync(configPath)) return { ...DEFAULTS };
  try {
    const user = JSON.parse(readFileSync(configPath, 'utf8'));
    return { ...DEFAULTS, ...user };
  } catch {
    return { ...DEFAULTS };
  }
}
