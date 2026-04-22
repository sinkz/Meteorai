const prevValues = new Map();

export function applyDeltas(rows) {
  return rows;
}

export function computeDelta(prev, curr) {
  return curr - prev;
}

export function resetDeltas() {
  prevValues.clear();
}
