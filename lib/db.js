import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const MIGRATIONS = [
  // v1 — original schema
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

  // v2 — OTel-driven schema: slim sessions, otel_metrics, otel_events, view
  (db) => {
    db.exec(`
      CREATE TABLE sessions_v2 (
        id           TEXT PRIMARY KEY,
        started_at   INTEGER NOT NULL,
        ended_at     INTEGER,
        exit_reason  TEXT,
        branch_name  TEXT,
        ticket_id    TEXT,
        project_name TEXT,
        cwd          TEXT
      );
      CREATE INDEX idx_sessions_v2_branch  ON sessions_v2(branch_name);
      CREATE INDEX idx_sessions_v2_started ON sessions_v2(started_at);
      CREATE INDEX idx_sessions_v2_project ON sessions_v2(project_name);

      INSERT INTO sessions_v2 (id, started_at, ended_at, exit_reason, branch_name, ticket_id, project_name)
        SELECT id, started_at, ended_at, exit_reason, branch_name, ticket_id, project_name FROM sessions;

      DROP INDEX IF EXISTS idx_tool_calls_target;
      DROP INDEX IF EXISTS idx_tool_calls_session;
      DROP TABLE tool_calls;
      DROP INDEX IF EXISTS idx_notifications_session;
      DROP TABLE notifications;
      DROP INDEX IF EXISTS idx_sessions_project;
      DROP INDEX IF EXISTS idx_sessions_started;
      DROP INDEX IF EXISTS idx_sessions_branch;
      DROP TABLE sessions;

      ALTER TABLE sessions_v2 RENAME TO sessions;

      CREATE TABLE otel_metrics (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT,
        metric_name     TEXT NOT NULL,
        value           REAL NOT NULL,
        unit            TEXT,
        attributes_json TEXT NOT NULL,
        recorded_at     INTEGER NOT NULL
      );
      CREATE INDEX idx_otel_metrics_session ON otel_metrics(session_id);
      CREATE INDEX idx_otel_metrics_name    ON otel_metrics(metric_name);
      CREATE INDEX idx_otel_metrics_time    ON otel_metrics(recorded_at);

      CREATE TABLE otel_events (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT,
        event_name      TEXT NOT NULL,
        prompt_id       TEXT,
        attributes_json TEXT NOT NULL,
        body_json       TEXT,
        recorded_at     INTEGER NOT NULL
      );
      CREATE INDEX idx_otel_events_session ON otel_events(session_id);
      CREATE INDEX idx_otel_events_name    ON otel_events(event_name);
      CREATE INDEX idx_otel_events_prompt  ON otel_events(prompt_id);

      CREATE VIEW session_metrics_view AS
      SELECT
        s.id AS session_id,
        s.started_at,
        s.ended_at,
        s.exit_reason,
        s.branch_name,
        s.ticket_id,
        s.project_name,
        (COALESCE(s.ended_at, (SELECT MAX(recorded_at) FROM otel_metrics m WHERE m.session_id = s.id))
            - s.started_at) AS duration_seconds,
        COALESCE((SELECT SUM(value) FROM otel_metrics m
                   WHERE m.session_id = s.id AND m.metric_name = 'claude_code.cost.usage'), 0) AS cost_usd,
        COALESCE((SELECT SUM(value) FROM otel_metrics m
                   WHERE m.session_id = s.id AND m.metric_name = 'claude_code.token.usage'
                     AND json_extract(m.attributes_json, '$.type') = 'input'), 0)  AS tokens_input,
        COALESCE((SELECT SUM(value) FROM otel_metrics m
                   WHERE m.session_id = s.id AND m.metric_name = 'claude_code.token.usage'
                     AND json_extract(m.attributes_json, '$.type') = 'output'), 0) AS tokens_output,
        COALESCE((SELECT SUM(value) FROM otel_metrics m
                   WHERE m.session_id = s.id AND m.metric_name = 'claude_code.token.usage'
                     AND json_extract(m.attributes_json, '$.type') = 'cacheRead'), 0) AS tokens_cache_read,
        COALESCE((SELECT SUM(value) FROM otel_metrics m
                   WHERE m.session_id = s.id AND m.metric_name = 'claude_code.commit.count'), 0) AS commit_count,
        COALESCE((SELECT SUM(value) FROM otel_metrics m
                   WHERE m.session_id = s.id AND m.metric_name = 'claude_code.lines_of_code.count'), 0) AS lines_of_code,
        (SELECT COUNT(*) FROM otel_events e
            WHERE e.session_id = s.id AND e.event_name = 'claude_code.tool_result') AS tool_call_count,
        (SELECT json_extract(m.attributes_json, '$.model')
           FROM otel_metrics m
           WHERE m.session_id = s.id AND m.metric_name = 'claude_code.token.usage'
           ORDER BY m.recorded_at DESC LIMIT 1) AS model_used
      FROM sessions s;
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
