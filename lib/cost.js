import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PRICING_PATH = path.join(here, '..', 'data', 'pricing.json');

let _cached = null;
export function loadPricing() {
  if (_cached) return _cached;
  const raw = JSON.parse(readFileSync(PRICING_PATH, 'utf8'));
  _cached = raw;
  return raw;
}

export function calculateCost(usage, model, pricingData) {
  const pricing = pricingData ?? loadPricing();
  const table = pricing.models ?? pricing;
  const fallback = pricing.fallback_model ?? 'claude-sonnet-4-6';
  const rates = table[model] ?? table[fallback];
  if (!rates) return 0;

  const input = (usage.tokens_input ?? 0) / 1_000_000;
  const output = (usage.tokens_output ?? 0) / 1_000_000;
  const cacheRead = (usage.tokens_cache_read ?? 0) / 1_000_000;
  const cacheCreate = (usage.tokens_cache_creation ?? 0) / 1_000_000;

  return (
    input * (rates.input ?? 0) +
    output * (rates.output ?? 0) +
    cacheRead * (rates.cache_read ?? 0) +
    cacheCreate * (rates.cache_creation ?? 0)
  );
}
