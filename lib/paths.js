import path from 'node:path';

export function resolvePaths({ env = process.env } = {}) {
  const root = env.QUANTA_HOME
    ?? (env.HOME ? path.join(env.HOME, '.quanta') : null);
  if (!root) throw new Error('HOME env var is required to resolve quanta paths');
  return {
    root,
    db: path.join(root, 'tracker.db'),
    config: path.join(root, 'config.json'),
    errorLog: path.join(root, 'errors.log'),
    pidfile: path.join(root, 'receiver.pid'),
  };
}
