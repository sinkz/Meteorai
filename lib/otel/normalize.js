function getAttr(attrs, key) {
  const a = attrs.find(a => a.key === key);
  if (!a) return null;
  const v = a.value;
  return v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? null;
}

function attrsToObject(attrs) {
  const obj = {};
  for (const a of attrs) {
    const v = a.value;
    obj[a.key] = v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue ?? null;
  }
  return obj;
}

function nanoToSeconds(nanoStr) {
  return Math.floor(Number(BigInt(nanoStr) / 1000000000n));
}

function extractValue(dp) {
  if (dp.asDouble !== undefined) return Number(dp.asDouble);
  if (dp.asInt !== undefined) return Number(dp.asInt);
  return 0;
}

export function normalizeMetrics(payload) {
  const rows = [];
  for (const rm of (payload.resourceMetrics ?? [])) {
    const resAttrs = rm.resource?.attributes ?? [];
    const sessionId = getAttr(resAttrs, 'session.id');

    for (const sm of (rm.scopeMetrics ?? [])) {
      for (const metric of (sm.metrics ?? [])) {
        const name = metric.name;
        const unit = metric.unit ?? '';
        const dataPoints = metric.sum?.dataPoints ?? metric.gauge?.dataPoints ?? [];

        for (const dp of dataPoints) {
          const dpAttrs = dp.attributes ?? [];
          rows.push({
            session_id: sessionId,
            metric_name: name,
            value: extractValue(dp),
            unit,
            attributes_json: JSON.stringify(attrsToObject(dpAttrs)),
            recorded_at: nanoToSeconds(dp.timeUnixNano ?? '0'),
          });
        }
      }
    }
  }
  return rows;
}

export function normalizeLogs(payload) {
  const rows = [];
  for (const rl of (payload.resourceLogs ?? [])) {
    const resAttrs = rl.resource?.attributes ?? [];
    const sessionId = getAttr(resAttrs, 'session.id');

    for (const sl of (rl.scopeLogs ?? [])) {
      for (const lr of (sl.logRecords ?? [])) {
        const lrAttrs = lr.attributes ?? [];
        const attrsObj = attrsToObject(lrAttrs);
        const eventName = attrsObj['event.name'] ?? 'unknown';
        const promptId = attrsObj['prompt.id'] ?? null;
        const bodyJson = lr.body ? JSON.stringify(lr.body) : null;
        rows.push({
          session_id: sessionId,
          event_name: eventName,
          prompt_id: promptId,
          attributes_json: JSON.stringify(attrsObj),
          body_json: bodyJson,
          recorded_at: nanoToSeconds(lr.timeUnixNano ?? '0'),
        });
      }
    }
  }
  return rows;
}
