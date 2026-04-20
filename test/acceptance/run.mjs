#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { steps, freshWorld } from './steps.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FEATURES_DIR = path.join(here, 'features');

// Minimal Gherkin parser — supports English keywords only.
const KW = {
  feature:  /^Feature:/,
  scenario: /^\s*Scenario:/,
  step:     /^\s*(Given|When|Then|And|But)\s+(.+)$/,
  comment:  /^\s*#/,
  blank:    /^\s*$/,
};

function parseFeature(src) {
  const lines = src.split(/\r?\n/);
  const scenarios = [];
  let current = null;
  for (const raw of lines) {
    if (KW.comment.test(raw) || KW.blank.test(raw)) continue;
    if (KW.feature.test(raw)) continue;
    if (KW.scenario.test(raw)) {
      if (current) scenarios.push(current);
      current = { title: raw.replace(KW.scenario, '').trim(), steps: [] };
      continue;
    }
    const m = raw.match(KW.step);
    if (m) {
      current?.steps.push({ keyword: m[1], text: m[2].trim() });
    }
  }
  if (current) scenarios.push(current);
  return scenarios;
}

function runStep(world, stepText) {
  for (const s of steps) {
    const m = stepText.match(s.re);
    if (m) return s.run(world, m.slice(1), assert);
  }
  throw new Error(`Undefined step: "${stepText}"`);
}

let total = 0, passed = 0, failed = 0;
const failures = [];

for (const file of readdirSync(FEATURES_DIR).filter(f => f.endsWith('.feature'))) {
  const src = readFileSync(path.join(FEATURES_DIR, file), 'utf8');
  const scenarios = parseFeature(src);
  console.log(`\n${file}`);
  for (const sc of scenarios) {
    total++;
    const world = freshWorld();
    try {
      for (const step of sc.steps) {
        runStep(world, step.text);
      }
      passed++;
      console.log(`  \u2713 ${sc.title}`);
    } catch (err) {
      failed++;
      failures.push({ file, scenario: sc.title, err });
      console.log(`  \u2717 ${sc.title}`);
    } finally {
      world.cleanup();
    }
  }
}

console.log(`\n${passed}/${total} scenarios passed`);
for (const f of failures) {
  console.log(`\n--- ${f.file} :: ${f.scenario} ---`);
  console.log(f.err.message);
}
process.exit(failed > 0 ? 1 : 0);
