# Quanta v2 — OpenTelemetry Refactor + Web UI Plan

> Language note: this plan is written in English per `CLAUDE.md` §0. Conversation
> with the author was in Portuguese; the artifact is not.

## Context

Quanta today parses Claude Code transcript JSONL files to derive token counts
and cost, maintains a local `data/pricing.json` table, and computes a heuristic
`assertiveness_score`. As of Claude Code v2.1.117 (April 2026) all of that
comes directly from the Claude Code runtime via OpenTelemetry:

- `claude_code.cost.usage` (USD), `claude_code.token.usage` (with `type` =
  input/output/cacheRead/cacheCreation), `claude_code.commit.count`,
  `claude_code.lines_of_code.count`, `claude_code.pull_request.count`,
  `claude_code.active_time.total`, `claude_code.session.count`,
  `claude_code.code_edit_tool.decision`.
- Events: `user_prompt`, `tool_result`, `tool_decision`, `api_request`,
  `api_error`, `hook_execution_start/complete`, `compaction`.
- Correlation key `prompt.id` on events, `session.id` on everything.

Claude Code's runtime is now a native binary (the npm package only downloads
it; `claude` does not invoke Node), but plugin hooks still run as external
processes, so our Node scripts keep working.

This refactor:

1. Replaces transcript parsing with an OTLP/HTTP receiver that ingests Claude
   Code's telemetry into SQLite.
2. Fixes the broken `.claude-plugin/plugin.json` manifest and auto-exports the
   OTel env vars.
3. Trims the CLI's backing data to what OTel emits (drops the subjective
   score) while keeping the user-facing commands unchanged.
4. Adds `quanta serve` — a loopback-only dashboard with a JSON API and a
   zero-dependency vanilla-JS UI — answering the web UI issue.

All changes follow the TDD discipline in `CLAUDE.md` §1: a `test:` commit
lands before the matching `feat:`/`refactor:`/`fix:` commit. Each numbered
task below is a single commit.

## Architecture

```
                    +---------------------------+
                    |  Claude Code (native bin) |
                    |  OTLP/HTTP JSON exporter  |
                    +-------------+-------------+
                                  |
                                  | POST /v1/metrics
                                  | POST /v1/logs
                                  v
      +-----------------------------------------------+
      |  Quanta OTLP receiver  (Node, 127.0.0.1)      |
      |  parses OTLP/HTTP JSON (stdlib http, no SDK)  |
      |  computes deltas for cumulative counters      |
      +-------------------+---------------------------+
                          |
                          v
      +-----------------------------------------------+
      |  ~/.quanta/tracker.db  (schema v2)            |
      |  sessions       (id + git context)            |
      |  otel_metrics   (delta-ized data points)      |
      |  otel_events    (log records)                 |
      |  session_metrics_view  (VIEW)                 |
      +-----+-------------------------+---------------+
            |                         |
            v                         v
   +------------------+      +------------------------+
   | quanta CLI       |      | quanta serve           |
   | summary/sessions |      | JSON API + web/        |
   | export           |      | http://127.0.0.1:7681  |
   +------------------+      +------------------------+

Remaining hooks:
  SessionStart -> git enrichment + ensureReceiverRunning()
  SessionEnd   -> UPDATE sessions SET ended_at, exit_reason
All other hooks removed.
```

## Decisions (confirmed)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Session boundary | Reinstate `SessionEnd` hook (one-liner that stamps `ended_at` + `exit_reason` from the hook's `reason` field). |
| 2 | Cumulative counters | Receiver computes per-`(session.id, metric, attrs_hash)` deltas in memory; only deltas are persisted. |
| 3 | `--min-score` / `--max-score` flags | Removed. `sessions.feature` is rewritten. |
| 4 | `engines.node` | Bumped to `>=20`. |
| 5 | OTLP transport | `http/json` only for MVP. Plugin exports `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`. Unsupported protocols return HTTP 415 with a clear message. |
| 6 | Pre-aggregation | SQL `VIEW`, no materialized table. Revisit only if profiling shows `summary` >50 ms on 100k sessions. |
| 7 | Dependencies | No new runtime deps. stdlib `http`, inline SVG for charts, existing `better-sqlite3` / `commander` / `cli-table3`. |
| 8 | `quanta serve` auth | Loopback-only; no token. README warns. |

## Target `.claude-plugin/plugin.json`

```json
{
  "name": "quanta",
  "version": "2.0.0",
  "description": "OTel-driven cost and productivity tracker for Claude Code",
  "author": "sinkz",
  "hooks": {
    "SessionStart": { "path": "hooks/session-start.js" },
    "SessionEnd":   { "path": "hooks/session-end.js" }
  },
  "commands": {
    "summary":  "bin/quanta summary",
    "sessions": "bin/quanta sessions",
    "export":   "bin/quanta export",
    "serve":    "bin/quanta serve",
    "receiver": "bin/quanta receiver"
  },
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER":        "otlp",
    "OTEL_LOGS_EXPORTER":           "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL":  "http/json",
    "OTEL_EXPORTER_OTLP_ENDPOINT":  "http://127.0.0.1:4318",
    "OTEL_METRIC_EXPORT_INTERVAL":  "10000"
  }
}
```

## Schema v2 (DDL — migration index 2)

```sql
CREATE TABLE sessions_v2 (
  id            TEXT PRIMARY KEY,
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  exit_reason   TEXT,            -- from SessionEnd hook: clear|logout|prompt_input_exit|other
  branch_name   TEXT,
  ticket_id     TEXT,
  project_name  TEXT,
  cwd           TEXT
);
CREATE INDEX idx_sessions_v2_branch  ON sessions_v2(branch_name);
CREATE INDEX idx_sessions_v2_started ON sessions_v2(started_at);
CREATE INDEX idx_sessions_v2_project ON sessions_v2(project_name);

-- migrate prior rows, drop old tables, rename
INSERT INTO sessions_v2 (id, started_at, ended_at, branch_name, ticket_id, project_name)
  SELECT id, started_at, ended_at, branch_name, ticket_id, project_name FROM sessions;
DROP TABLE tool_calls;
DROP TABLE notifications;
DROP TABLE sessions;
ALTER TABLE sessions_v2 RENAME TO sessions;

CREATE TABLE otel_metrics (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id      TEXT,
  metric_name     TEXT NOT NULL,
  value           REAL NOT NULL,      -- stored as delta, not cumulative
  unit            TEXT,
  attributes_json TEXT NOT NULL,
  recorded_at     INTEGER NOT NULL    -- unix seconds
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
```

## Commit plan (TDD-ordered)

Each row is one commit. Test commits precede the implementation commit they
unlock. After every commit, `npm test` must pass; after every `feat:` commit,
`npm run test:acceptance` must also pass.

### Phase 0 — Plugin manifest hotfix

| # | Message | Files |
|---|---------|-------|
| 0.1 | `test: assert plugin.json shape and hook paths exist on disk` | `test/plugin-manifest.test.js` (new) |
| 0.2 | `fix(plugin): rewrite manifest with valid shape and OTel env block` | `.claude-plugin/plugin.json` |
| 0.3 | `chore: bump engines.node to >=20` | `package.json` |

### Phase 1 — Schema v2

| # | Message | Files |
|---|---------|-------|
| 1.1 | `test: expect slim sessions + otel_metrics + otel_events at user_version=2` | `test/db.test.js` |
| 1.2 | `test: expect session_metrics_view to aggregate cost/tokens/commits/tool_calls` | `test/db.test.js` |
| 1.3 | `feat(db): add migration v2 with slim sessions, otel tables, and view` | `lib/db.js` |

### Phase 2 — OTLP receiver skeleton

| # | Message | Files |
|---|---------|-------|
| 2.1 | `test: receiver accepts POST /v1/metrics and /v1/logs and returns 200` | `test/otel-receiver.test.js` (new) |
| 2.2 | `test: receiver rejects non-JSON with 415 and logs to errors.log` | `test/otel-receiver.test.js` |
| 2.3 | `feat(otel): add OTLP/HTTP JSON receiver on 127.0.0.1:4318` | `lib/otel/server.js`, `lib/otel/receiver.js` (new) |

### Phase 3 — Normalization + delta accounting

| # | Message | Files |
|---|---------|-------|
| 3.1 | `test: normalizeMetrics extracts (session_id, metric, value, attrs, time)` | `test/otel-normalize.test.js` (new), `test/fixtures/otel/metrics-sample.json` (new) |
| 3.2 | `test: normalizeLogs extracts event.name, prompt.id, body, attrs` | `test/otel-normalize.test.js`, `test/fixtures/otel/logs-sample.json` (new) |
| 3.3 | `test: computeDelta(prev, curr) returns diff per (session, metric, attrs_hash)` | `test/otel-deltas.test.js` (new) |
| 3.4 | `feat(otel): normalize OTLP payloads and persist only counter deltas` | `lib/otel/normalize.js` (new), `lib/otel/deltas.js` (new), `lib/otel/receiver.js` |
| 3.5 | `test: end-to-end POST lands rows and session_metrics_view aggregates correctly` | `test/otel-receiver.test.js` |

### Phase 4 — Hooks + receiver lifecycle

| # | Message | Files |
|---|---------|-------|
| 4.1 | `test: SessionStart inserts only git context on slim v2 schema` | `test/hooks.test.js` |
| 4.2 | `test: SessionStart spawns receiver when pidfile absent; no-op when alive` | `test/hooks-receiver-autostart.test.js` (new) |
| 4.3 | `refactor(hook): trim session-start to git + ensureReceiverRunning` | `lib/hooks/session-start.js`, `lib/otel/lifecycle.js` (new) |
| 4.4 | `test: SessionEnd stamps ended_at and exit_reason from hook payload` | `test/hooks.test.js` |
| 4.5 | `feat(hook): add session-end handler` | `hooks/session-end.js` (new), `lib/hooks/session-end.js` (new) |
| 4.6 | `test: quanta receiver start|stop|status writes/reads pidfile cleanly` | `test/cli-receiver.test.js` (new) |
| 4.7 | `feat(cli): add quanta receiver start|stop|status` | `cli/commands/receiver.js` (new), `cli/index.js` |

### Phase 5 — Queries and CLI against v2

| # | Message | Files |
|---|---------|-------|
| 5.1 | `test: summarize reads from session_metrics_view (cost/tokens/sessions)` | `test/queries.test.js` |
| 5.2 | `test: topBranches sums view cost_usd per branch` | `test/queries.test.js` |
| 5.3 | `test: listSessions returns view rows, tolerates sessions with no metrics` | `test/queries.test.js` |
| 5.4 | `refactor(queries): rewrite against session_metrics_view; drop score filters` | `lib/queries.js`, `cli/commands/sessions.js` |
| 5.5 | `test: summary.feature passes on v2 schema with new step seeding` | `test/acceptance/steps.js`, `test/acceptance/features/summary.feature` |
| 5.6 | `test: sessions.feature rewritten without --min-score, export.feature updated` | `test/acceptance/features/sessions.feature`, `test/acceptance/features/export.feature`, `test/acceptance/steps.js` |
| 5.7 | `feat(cli): update summary/sessions/export printers to view columns` | `cli/commands/summary.js`, `cli/commands/sessions.js`, `cli/commands/export.js`, `cli/shared.js` |

### Phase 6 — Remove obsolete modules

| # | Message | Files |
|---|---------|-------|
| 6.1 | `test: drop transcript/cost/score unit tests` | delete `test/transcript.test.js`, `test/cost.test.js`, `test/score.test.js` |
| 6.2 | `chore: remove transcript parser, pricing table, heuristic score, obsolete hooks` | delete `lib/transcript.js`, `lib/cost.js`, `lib/score.js`, `data/pricing.json`, `hooks/{pre-tool-use,post-tool-use,stop,notification}.js`, `lib/hooks/{stop,pre-tool-use,post-tool-use,notification}.js`, `test/fixtures/transcripts/` |
| 6.3 | `test: hooks.test.js covers only SessionStart + SessionEnd + autostart` | `test/hooks.test.js` |

### Phase 7 — Web UI (`quanta serve`)

| # | Message | Files |
|---|---------|-------|
| 7.1 | `test: quanta serve binds 127.0.0.1 and refuses non-loopback hosts` | `test/serve-server.test.js` (new) |
| 7.2 | `feat(serve): add quanta serve command with /healthz` | `cli/commands/serve.js` (new), `lib/web/server.js` (new), `cli/index.js` |
| 7.3 | `test: GET /api/summary?period=sprint returns summarize + topBranches JSON` | `test/serve-api.test.js` (new) |
| 7.4 | `test: GET /api/sessions honors branch/project/from/to/limit` | `test/serve-api.test.js` |
| 7.5 | `test: GET /api/timeseries buckets cost per day across a range` | `test/serve-api.test.js` |
| 7.6 | `feat(serve): wire /api/summary, /api/sessions, /api/timeseries` | `lib/web/server.js`, `lib/queries.js` (adds `timeseriesByBucket`) |
| 7.7 | `test: static handler serves web/ with MIME allowlist and no traversal` | `test/serve-static.test.js` (new) |
| 7.8 | `feat(serve): static asset handler and initial UI` | `lib/web/server.js`, `web/index.html` (new), `web/app.js` (new), `web/styles.css` (new) |
| 7.9 | `test: renderLineChart emits SVG path matching fixture points` | `test/web-chart.test.js` (new) |
| 7.10 | `feat(web): hand-rolled SVG line chart wired to /api/timeseries` | `web/chart.js` (new), `web/app.js` |
| 7.11 | `test: acceptance scenario — dashboard endpoint returns JSON for seeded db` | `test/acceptance/features/web.feature` (new), `test/acceptance/steps.js` |
| 7.12 | `feat(web): close any gaps surfaced by web.feature` | `lib/web/server.js` (if needed) |
| 7.13 | `docs: update README and README.pt-BR for v2 architecture` | `README.md`, `README.pt-BR.md` |

**Total: 39 commits.** Each commit is small, focused, and paired with its
test commit. All deletions happen after dependents are rewritten.

## Critical files

- `lib/db.js` — migrations, schema, opens WAL-mode SQLite. Extended with
  migration v2.
- `lib/queries.js` — all aggregations. Rewritten to hit
  `session_metrics_view`. Gains `timeseriesByBucket`.
- `lib/hooks/session-start.js` — trimmed to git enrichment +
  `ensureReceiverRunning`.
- `lib/hook-runtime.js` — unchanged; `runHookAsCli` still fronts every hook.
- `.claude-plugin/plugin.json` — rewritten per §Target above.
- `cli/index.js` — register new `receiver` and `serve` subcommands.
- `test/acceptance/run.mjs` / `test/acceptance/steps.js` — new step to seed
  `otel_metrics` rows; new step for `I GET <path>`.

## New files

- `lib/otel/server.js`, `lib/otel/receiver.js` — HTTP listener + request
  dispatch.
- `lib/otel/normalize.js` — pure functions `normalizeMetrics`,
  `normalizeLogs`.
- `lib/otel/deltas.js` — in-memory prev-value table keyed by
  `(session_id, metric_name, attrs_hash)`; returns delta and updates state.
- `lib/otel/lifecycle.js` — `ensureReceiverRunning`, `startDetached`,
  `readPidfile`, `stopReceiver`.
- `lib/hooks/session-end.js`, `hooks/session-end.js` — SessionEnd handler.
- `cli/commands/receiver.js` — `start|stop|status` subcommands.
- `cli/commands/serve.js` + `lib/web/server.js` — HTTP API and static serving.
- `web/index.html`, `web/app.js`, `web/styles.css`, `web/chart.js` — vanilla
  JS dashboard.

## Reused utilities

- `runHookAsCli(handler)` in `lib/hook-runtime.js` fronts the new
  SessionEnd hook verbatim (§4.5).
- `openDb(file)` in `lib/db.js` is the single entry point; migration v2
  extends its existing `MIGRATIONS` array.
- `resolvePaths({env})` in `lib/paths.js` already gives us
  `{root, db, config, errorLog}`; we only add `pidfile: root/receiver.pid`.
- `resolvePeriod(period, cfg)` in `lib/queries.js` is reused by the new
  `/api/summary?period=` route (Phase 7.6).
- `dbHandle()` / `parseDate()` / `fmtUsd()` / `fmtTokens()` / `fmtDate()` /
  `fmtDuration()` in `cli/shared.js` stay unchanged.
- Test pattern from `test/queries.test.js` (tmpdir DB, real `better-sqlite3`,
  seed + assert) is the template for every new unit test.
- Acceptance runner `test/acceptance/run.mjs` and the Given/When/Then matcher
  need no changes; we only add steps in `steps.js`.

## Verification (end-to-end)

```bash
# 1. Unit + schema + receiver + queries + web API tests
npm test

# 2. Gherkin acceptance (summary.feature, sessions.feature, export.feature, web.feature)
npm run test:acceptance

# 3. Manually start the receiver (SessionStart would auto-start it too)
node bin/quanta receiver start
node bin/quanta receiver status          # prints pid + /healthz

# 4. Run a real Claude Code session — plugin.json's env auto-exports OTel vars
cd some/git/repo
claude                                   # interact briefly, exit
#    expected side effects:
#    - sessions row inserted with branch/ticket/project
#    - claude pushed OTLP/HTTP JSON to 127.0.0.1:4318
#    - otel_metrics / otel_events populated (deltas only for counters)
#    - SessionEnd hook stamped ended_at + exit_reason

# 5. CLI consumes the view
node bin/quanta summary --period day
node bin/quanta sessions --limit 5
node bin/quanta export --format json --period all | jq '.[0]'

# 6. Web dashboard
node bin/quanta serve --port 7681 &
curl -s http://127.0.0.1:7681/api/summary?period=sprint | jq
curl -s 'http://127.0.0.1:7681/api/timeseries?metric=cost&bucket=day&period=week' | jq
open http://127.0.0.1:7681               # chart + sessions table

# 7. Teardown
node bin/quanta receiver stop
kill %1
```

Every step above is covered by at least one committed test (unit or
acceptance). `npm test` stays green after every commit; `npm run
test:acceptance` stays green after every `feat:` commit in phases 5 and 7.

## Out of scope (deferred)

- OTLP protobuf transport (http/json only for MVP).
- Materialized aggregation table (VIEW first; revisit under profiled load).
- Auth for `quanta serve` (loopback-only in v2.0).
- Multi-user / shared-database mode.
- Real-time loop detection or rerun heuristics.
- BRL / non-USD currency conversion.
