import { createHash } from 'node:crypto';

const prevValues = new Map();

function stateKey(session_id, metric_name, attributes_json) {
  return createHash('sha1').update(`${session_id}|${metric_name}|${attributes_json}`).digest('hex');
}

export function computeDelta(prev, curr) {
  return curr - prev;
}

export function applyDeltas(rows) {
  const result = [];
  for (const row of rows) {
    const key = stateKey(row.session_id, row.metric_name, row.attributes_json);
    const prev = prevValues.get(key) ?? 0;
    const delta = computeDelta(prev, row.value);
    prevValues.set(key, row.value);
    if (delta !== 0) {
      result.push({ ...row, value: delta });
    }
  }
  return result;
}

export function resetDeltas() {
  prevValues.clear();
}
