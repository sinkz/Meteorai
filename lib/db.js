import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const MIGRATIONS = [
  (db) => {
    db.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        duration_seconds INTEGER,
        branch_name TEXT,
        ticket_id TEXT,
        project_name TEXT,
        tokens_input INTEGER DEFAULT 0,
        tokens_output INTEGER DEFAULT 0,
        tokens_cache_read INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        model_used TEXT,
        exit_reason TEXT,
        commit_generated INTEGER DEFAULT 0,
        assertiveness_score INTEGER,
        tool_call_count INTEGER DEFAULT 0,
        rerun_count INTEGER DEFAULT 0
      );
      CREATE INDEX idx_sessions_branch ON sessions(branch_name);
      CREATE INDEX idx_sessions_started ON sessions(started_at);
      CREATE INDEX idx_sessions_project ON sessions(project_name);

      CREATE TABLE tool_calls (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        tool_name TEXT NOT NULL,
        target_file TEXT,
        called_at INTEGER NOT NULL,
        success INTEGER
      );
      CREATE INDEX idx_tool_calls_session ON tool_calls(session_id);
      CREATE INDEX idx_tool_calls_target ON tool_calls(session_id, target_file);

      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        message TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_notifications_session ON notifications(session_id);
    `);
  },
];

export function openDb(filePath) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      MIGRATIONS[i](db);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
