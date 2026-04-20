# Quanta

Cost and productivity tracker for AI coding assistants — local, private, no external API, no server.

> Currently supports **Claude Code**. GitHub Copilot and Codex support is on the roadmap.

## How Data Is Collected

Quanta hooks into Claude Code's native hook system to collect session metadata passively and automatically. No manual steps are needed after installation.

| Hook | What it captures |
|---|---|
| `SessionStart` | New session ID, git branch, project path |
| `PreToolUse` | Tool name, file path (before execution) |
| `PostToolUse` | Tool result status, file path (after execution) |
| `Stop` | Session duration, token usage from transcript, cost in USD, assertiveness score |
| `Notification` | Session-level events |

**What is stored:** tool names, file paths, timestamps, token counts (input/output/cache), cost in USD, assertiveness score, exit reason, branch name, project name.

**What is never stored:** message content, diffs, prompt text, command outputs, or any conversational data.

All data lives in `~/.quanta/tracker.db` (SQLite, on your machine only).

## How to View Metrics

```bash
# Aggregated summary
quanta summary --period sprint     # current sprint (default)
quanta summary --period day        # last 24 hours
quanta summary --period week       # last 7 days
quanta summary --period month      # last 30 days
quanta summary --period all        # full history

# Session list with filters
quanta sessions --branch feat/ISSUE-123
quanta sessions --from 2026-04-01
quanta sessions --min-score 70
quanta sessions --from 2026-04-01 --min-score 70 --limit 20

# Export raw data
quanta export --period month --format csv > april.csv
quanta export --format json > all.json
quanta export --branch feat/ISSUE-123 --format json
```

Periods: `day | week | month | sprint | all`. Default sprint = 14 days (configurable).

## Installation

```bash
git clone https://github.com/sinkz/meteorai ~/.claude/plugins/quanta
cd ~/.claude/plugins/quanta
npm install

# Optional: make the CLI available outside Claude Code sessions
npm link
quanta --version
```

The plugin automatically activates `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, and `Notification` hooks on the next session.

## Configuration

Create `~/.quanta/config.json` to override defaults:

```json
{
  "ticket_pattern": "([A-Z]+-\\d+)",
  "sprint_start_day": "Monday",
  "sprint_duration_days": 14,
  "rerun_threshold_same_file": 3
}
```

Override the data directory with the `QUANTA_HOME` environment variable:

```bash
QUANTA_HOME=/custom/path quanta summary
```

## Pricing

Token prices are in `data/pricing.json` (USD per 1M tokens). Edit if Anthropic updates official pricing; unknown models fall back to Sonnet pricing.

## Privacy

- No data leaves your machine.
- Hooks record only metadata: tool name, file path, counts, timestamps. Message content and diffs are never persisted.
- The transcript parser discards everything except `usage` and `model` fields.

## MVP Limitations (v1.0)

- **No BRL conversion** — avoids an exchange rate API dependency.
- **No real-time loop detection** — only file rerun counting at session end.
- **User abort is indistinguishable from success** (Claude Code does not expose `reason=user` in hooks today).
- **No ClickUp/Linear/Slack integration**.
- **Multi-user**: each developer has their own `tracker.db`; no shared database.

## Development

```bash
npm test                  # unit tests (node:test)
npm run test:acceptance   # Gherkin acceptance scenarios
npm run test:all          # all tests
```

Read `CLAUDE.md` before contributing — the project enforces TDD, uses Gherkin for acceptance tests, and prefers real fixtures over mocks.

## License

MIT
