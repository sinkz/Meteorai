# quanta — Development Rules

This file defines how to work in this repository. Re-read it before opening
any PR. These rules take precedence over default habits.

---

## 0. Language: English only

All code, comments, commit messages, Gherkin feature files, and documentation
must be written in English. The only exception is `README.pt-BR.md`.

## 1. TDD is mandatory

Non-negotiable order for any production code:

1. **Red** — write the test before the code. The test must fail for the right
   reason (missing functionality, not a syntax or import error).
2. **Green** — write the minimum code to make it pass.
3. **Refactor** — clean up with the test green. Without changing behavior.

Practical rules:

- One new test per commit when possible. Small commits > large commits.
- If a PR adds code without a test that exercises it, it is incomplete.
- Bug fix starts with a **test that reproduces the bug** (red). Only then the fix.
- Do not comment out a broken test. Fix it or delete it.
- Coverage is not a goal — **observable behavior is**. Test the public
  contract, not internal implementation.

Allowed exceptions (must be justified in the PR):

- Disposable build/scaffold scripts.
- Pure types/interfaces with no logic.
- `README.md`, `README.pt-BR.md`, `CLAUDE.md`, and static configs.

## 2. Gherkin for acceptance tests

End-to-end flows (CLI, hooks running against real SQLite, user scenarios
from the PRD §2.2) go in `.feature` files using Gherkin.

- Directory: `test/acceptance/features/*.feature` + runner at `test/acceptance/run.mjs`.
- Language: **English** — no `# language:` directive needed.
- One `Scenario` = one observable user path. No scenario "tests that
  function X returns Y" — that is a unit test.
- Reusable steps live in `test/acceptance/steps.js`.
- Use `Scenario Outline` with `Examples` for input variations.

Minimum example:

```gherkin
Feature: Cost summary by sprint
  As a Tech Lead
  I want to see the total cost for the current sprint
  So I can justify the ROI of Claude Code

  Scenario: Sprint with recorded sessions
    Given a clean quanta database
    And 3 sessions in the current sprint totalling $2.40
    When I run "summary --period sprint"
    Then the output contains "Total cost:       $2.40"
    And the output contains "Sessions:         3"
```

Unit tests remain in `test/*.test.js` using `node:test` — Gherkin does not
replace unit tests.

## 3. Avoid unnecessary mocks

Mocks are a smell, not a standard tool.

**Do not mock**:

- SQLite. Use a real database in a temp file (`tmpdir()`/UUID) and delete
  it in `afterEach`. `better-sqlite3` in WAL mode is fast enough for
  thousands of tests.
- `fs` — write/read real files in `os.tmpdir()`.
- Git — initialize a real fixture repo (`git init` in tmpdir, dummy commit).
  Faster and more faithful than mocking `child_process`.
- Transcript parser — use real JSONL fixtures in
  `test/fixtures/transcripts/`.
- Clock — for deterministic time, **pass `now` as a parameter** instead of
  mocking `Date.now()`. Pure function > mock.

**Mock only when**:

- The dependency is an uncontrolled external network resource (none in the MVP).
- The operation is destructive outside the test sandbox (e.g., sending email).
- Reproducing the real scenario is impossible (e.g., kernel failure).

If you must mock, justify it with a one-line comment above the mock.

**Simple dependency injection**: prefer pure functions that receive what they
need. A `calculateCost(usage, pricing)` is always better than a
`calculateCost(usage)` that reads `pricing.json` internally.

## 4. Code

- Node.js >= 18, ES modules (`"type": "module"` in `package.json`).
- Plain JavaScript in the MVP (no TypeScript).
- No external test frameworks — use `node:test` + `node:assert/strict`.
- No mock libraries (`sinon`, `jest.mock`, etc.). If you think you need one,
  re-read section 3.
- Basic lints: no unused variables, no `console.log` in production code (use
  `process.stderr.write` in hooks if you need to diagnose).
- Hooks must be **idempotent and fault-tolerant**: never block Claude Code.
  Any error goes to `~/.quanta/errors.log` and the hook exits with code 0.

## 5. Privacy

- Hooks **never** persist message content, diffs, or command outputs. Only
  metadata: tool name, file path, timestamps, counts.
- `lib/transcript.js` discards everything except `usage` and `model`.
  Explicit test in `test/transcript.test.js` guarantees this.
- `git.js` reads only `branch`, `HEAD`, `log -1 --format=%s`. Never reads
  diffs.

## 6. Commits

- Conventional messages: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`,
  `chore:`.
- One commit = one cohesive change. `test: add transcript parser fixtures`
  followed by `feat: add transcript parser` is ideal.
- Test commits (red) before implementation commits (green) when practical —
  makes the history auditable.

## 7. Definition of Done

A feature is only ready when:

1. Unit tests cover the new behavior.
2. If it is a user flow from PRD §2.2, a passing Gherkin scenario exists.
3. `npm test` is green locally.
4. No new TODOs in code without an associated issue.
5. README updated if the change is user-visible.
