# Quanta v2

Cost and productivity tracker for Claude Code — local, private, zero setup, OpenTelemetry-native.

> Data never leaves your machine. No external API, no server, no cloud.

## How it works

```
Claude Code (native binary)
  └─ OTel exporter ──POST /v1/metrics──► quanta receiver (127.0.0.1:4318)
                                                │
                                                ▼
                                      ~/.quanta/tracker.db
                                                │
                              ┌─────────────────┴──────────────┐
                              ▼                                 ▼
                         quanta CLI                       quanta serve
                   (summary / sessions / export)     (web dashboard :7681)
```

### The three moving parts

| Part | How it starts | Port |
|------|--------------|------|
| **Plugin hooks** (`SessionStart`, `SessionEnd`) | Automatic — Claude Code triggers them | — |
| **OTLP receiver** | Auto-started by `SessionStart`; or run manually | `127.0.0.1:4318` |
| **Web dashboard** | Manual — run `quanta serve` when you want it | `127.0.0.1:7681` |

The plugin and receiver work **automatically in the background**. You never need to think about them.  
The web dashboard is **optional** — start it when you want a visual view of your metrics.

---

## Quick start

```bash
# 1. Clone as a Claude Code plugin
git clone https://github.com/sinkz/meteorai ~/.claude/plugins/quanta
cd ~/.claude/plugins/quanta
npm install

# 2. (Optional) make the CLI available globally
npm link

# 3. Start a Claude Code session — hooks activate automatically
claude

# 4. View metrics in the terminal
quanta summary --period sprint

# 5. Or open the web dashboard
quanta serve          # → http://127.0.0.1:7681
quanta serve --open   # opens browser automatically
quanta serve --port 8080  # custom port
```

---

## CLI reference

### `quanta summary`

```bash
quanta summary                    # current sprint (default 14 days)
quanta summary --period day       # last 24 hours
quanta summary --period week      # last 7 days
quanta summary --period month     # last 30 days
quanta summary --period all       # full history
```

### `quanta sessions`

```bash
quanta sessions                          # last 50 sessions
quanta sessions --branch feat/ISSUE-42   # filter by branch
quanta sessions --project my-app         # filter by project
quanta sessions --from 2026-04-01        # from date (YYYY-MM-DD)
quanta sessions --limit 20
```

### `quanta export`

```bash
quanta export --format json              # JSON (default)
quanta export --format csv               # CSV
quanta export --period month > april.csv
quanta export --branch feat/ISSUE-42 --format json
```

### `quanta receiver` (advanced)

The receiver is started automatically by the `SessionStart` hook. You can also manage it manually:

```bash
quanta receiver start    # start in foreground
quanta receiver stop     # stop the background receiver
quanta receiver status   # show pid and port
```

### `quanta serve`

```bash
quanta serve             # start dashboard on http://127.0.0.1:7681
quanta serve --port 8080 # custom port
quanta serve --open      # open browser automatically
```

Stop with `Ctrl-C`. The server is loopback-only (`127.0.0.1`) — never exposed on the network.

---

## What is collected

| Captured | Not captured |
|----------|-------------|
| Session ID, start/end time, exit reason | Message content or prompt text |
| Git branch name, project path, working directory | Diffs or file content |
| Token counts (input / output / cache read) | Command outputs |
| Cost in USD (from Claude Code OTel) | Any conversational data |
| Commit count, lines of code changed | |

All data lives in `~/.quanta/tracker.db` (SQLite, your machine only).

---

## Configuration

Create `~/.quanta/config.json` to override defaults:

```json
{
  "ticket_pattern": "([A-Z]+-\\d+)",
  "sprint_duration_days": 14
}
```

Override the data directory:

```bash
QUANTA_HOME=/custom/path quanta summary
```

---

## Privacy

- No data leaves your machine.
- Hooks capture only metadata (tool names, file paths, timestamps, token counts). Message content and diffs are never persisted.
- The receiver binds to `127.0.0.1` only — never reachable from the network.
- The web dashboard also binds to `127.0.0.1` only.

---

## Development

```bash
npm test                  # unit tests (node:test)
npm run test:acceptance   # Gherkin acceptance scenarios
npm run test:all          # everything
```

Read `CLAUDE.md` before contributing — TDD is mandatory, real fixtures over mocks, English only.

## License

MIT
