import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const COMMIT_RE = /\bgit\s+commit\b[^\n]*?-m\s+['"]([^'"]+)['"]/;

export async function parseTranscript(filePath) {
  const result = {
    tokens_input: 0,
    tokens_output: 0,
    tokens_cache_read: 0,
    tokens_cache_creation: 0,
    model: null,
    commit_generated: 0,
    last_commit_message: null,
  };

  let stream;
  try {
    stream = createReadStream(filePath, { encoding: 'utf8' });
  } catch {
    return result;
  }

  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      if (!line) continue;
      let evt;
      try { evt = JSON.parse(line); } catch { continue; }
      if (evt?.type !== 'assistant') continue;

      const msg = evt.message ?? {};
      const usage = msg.usage ?? {};
      result.tokens_input += usage.input_tokens ?? 0;
      result.tokens_output += usage.output_tokens ?? 0;
      result.tokens_cache_read += usage.cache_read_input_tokens ?? 0;
      result.tokens_cache_creation += usage.cache_creation_input_tokens ?? 0;
      if (msg.model) result.model = msg.model;

      const content = Array.isArray(msg.content) ? msg.content : [];
      for (const block of content) {
        if (block?.type !== 'tool_use') continue;
        if (block.name !== 'Bash') continue;
        const cmd = block.input?.command ?? '';
        const m = cmd.match(COMMIT_RE);
        if (m) {
          result.commit_generated = 1;
          result.last_commit_message = m[1];
        }
      }
    }
  } catch {
    // return whatever we accumulated
  }

  return result;
}
