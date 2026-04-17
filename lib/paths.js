import path from 'node:path';

export function resolvePaths({ env = process.env } = {}) {
  const root = env.CC_TRACKER_HOME
    ?? (env.HOME ? path.join(env.HOME, '.cc-tracker') : null);
  if (!root) throw new Error('HOME env var is required to resolve cc-tracker paths');
  return {
    root,
    db: path.join(root, 'tracker.db'),
    config: path.join(root, 'config.json'),
    errorLog: path.join(root, 'errors.log'),
  };
}
