import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('plugin-manifest', () => {
  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')
  );

  it('has required top-level fields', () => {
    assert.ok(manifest.name, 'name required');
    assert.ok(manifest.version, 'version required');
    assert.ok(manifest.hooks, 'hooks required');
    assert.ok(manifest.commands, 'commands required');
    assert.ok(manifest.env, 'env block required');
  });

  it('declares SessionStart and SessionEnd hooks', () => {
    assert.ok(manifest.hooks.SessionStart, 'SessionStart required');
    assert.ok(manifest.hooks.SessionEnd, 'SessionEnd required');
    assert.ok(typeof manifest.hooks.SessionStart.path === 'string');
    assert.ok(typeof manifest.hooks.SessionEnd.path === 'string');
  });

  it('hook paths exist on disk', () => {
    for (const [name, hook] of Object.entries(manifest.hooks)) {
      const fullPath = path.join(ROOT, hook.path);
      assert.ok(existsSync(fullPath), `hook ${name} path not found: ${hook.path}`);
    }
  });

  it('declares required commands', () => {
    for (const cmd of ['summary', 'sessions', 'export', 'serve', 'receiver']) {
      assert.ok(manifest.commands[cmd], `command "${cmd}" missing`);
    }
  });

  it('env block sets OTel variables', () => {
    assert.equal(manifest.env.CLAUDE_CODE_ENABLE_TELEMETRY, '1');
    assert.equal(manifest.env.OTEL_METRICS_EXPORTER, 'otlp');
    assert.equal(manifest.env.OTEL_LOGS_EXPORTER, 'otlp');
    assert.equal(manifest.env.OTEL_EXPORTER_OTLP_PROTOCOL, 'http/json');
    assert.ok(manifest.env.OTEL_EXPORTER_OTLP_ENDPOINT, 'OTLP endpoint required');
  });
});
