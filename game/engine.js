// Pure match-3 engine for Hollow Reliquary.
// No DOM, no clock: every function works on a plain state object so the
// renderer can animate the returned step descriptions however it likes.

export const VOID = -1;
const LETTERS = 'ABCDEF';
const SPECIAL_SUFFIX = { '-': 'row', '|': 'col', '*': 'bomb' };

export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTile(state, type, special = null) {
  return { id: state.nextId++, type, special };
}

function emptyGrid(rows, cols, fill) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
}

function baseState({ rows, cols, types = 6, seed = 1, seals = [] }) {
  const state = {
    rows,
    cols,
    types,
    rng: createRng(seed),
    nextId: 1,
    board: emptyGrid(rows, cols, null),
    seals: emptyGrid(rows, cols, false),
  };
  for (const [r, c] of seals) state.seals[r][c] = true;
  return state;
}

const randType = (state) => Math.floor(state.rng() * state.types);

function fillWithoutMatches(state) {
  const { board } = state;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      let type;
      do {
        type = randType(state);
      } while (
        (c >= 2 && board[r][c - 1].type === type && board[r][c - 2].type === type) ||
        (r >= 2 && board[r - 1][c].type === type && board[r - 2][c].type === type)
      );
      board[r][c] = makeTile(state, type);
    }
  }
}

export function createGame(opts) {
  const state = baseState(opts);
  do {
    fillWithoutMatches(state);
  } while (!findHint(state.board));
  return state;
}

// Build a state from rows of space-separated tokens: A-F are gem colors,
// a trailing "-", "|" or "*" makes a row, column or bomb special, "@" is a void eye.
export function fromLayout(layout, opts = {}) {
  const grid = layout.map((line) => line.trim().split(/\s+/));
  const state = baseState({ rows: grid.length, cols: grid[0].length, ...opts });
  grid.forEach((row, r) =>
    row.forEach((token, c) => {
      if (token === '@') {
        state.board[r][c] = makeTile(state, VOID, 'void');
        return;
      }
      const type = LETTERS.indexOf(token[0]);
      state.board[r][c] = makeTile(state, type, SPECIAL_SUFFIX[token[1]] ?? null);
    }),
  );
  return state;
}

export function sealsRemaining(state) {
  return state.seals.flat().filter(Boolean).length;
}

const matchable = (tile) => tile && tile.type !== VOID;

export function findMatches(board) {
  const rows = board.length;
  const cols = board[0].length;
  const runs = [];

  const scan = (outer, inner, at, dir) => {
    for (let o = 0; o < outer; o++) {
      let start = 0;
      for (let i = 1; i <= inner; i++) {
        const cur = i < inner ? at(o, i) : null;
        const first = at(o, start);
        if (i < inner && matchable(cur) && matchable(first) && cur.type === first.type) continue;
        if (i - start >= 3 && matchable(first)) {
          const cells = [];
          for (let k = start; k < i; k++) cells.push(dir === 'h' ? { r: o, c: k } : { r: k, c: o });
          runs.push({ dir, type: first.type, cells });
        }
        start = i;
      }
    }
  };
  scan(rows, cols, (r, c) => board[r][c], 'h');
  scan(cols, rows, (c, r) => board[r][c], 'v');

  // Union runs that share a cell (L, T and + shapes).
  const parent = runs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map();
  runs.forEach((run, i) => {
    for (const { r, c } of run.cells) {
      const k = r * cols + c;
      if (owner.has(k)) parent[find(i)] = find(owner.get(k));
      else owner.set(k, i);
    }
  });

  const byRoot = new Map();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(run);
  });

  const groups = [];
  for (const members of byRoot.values()) {
    const seen = new Map();
    const hits = new Map();
    for (const run of members) {
      for (const cell of run.cells) {
        const k = cell.r * cols + cell.c;
        seen.set(k, cell);
        hits.set(k, (hits.get(k) ?? 0) + 1);
      }
    }
    const longest = members.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
    const hasH = members.some((m) => m.dir === 'h');
    const hasV = members.some((m) => m.dir === 'v');
    let special = null;
    if (longest.cells.length >= 5) special = 'void';
    else if (hasH && hasV) special = 'bomb';
    else if (longest.cells.length === 4) special = longest.dir === 'h' ? 'row' : 'col';

    const crossing = [...hits.entries()].find(([, n]) => n > 1);
    const pivot = crossing
      ? seen.get(crossing[0])
      : longest.cells[Math.floor((longest.cells.length - 1) / 2)];
    groups.push({ type: longest.type, special, cells: [...seen.values()], pivot });
  }
  return groups;
}

const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
const inside = (state, r, c) => r >= 0 && c >= 0 && r < state.rows && c < state.cols;

function swapCells(board, a, b) {
  const t = board[a.r][a.c];
  board[a.r][a.c] = board[b.r][b.c];
  board[b.r][b.c] = t;
}

function swapIsLive(board, a, b) {
  const ta = board[a.r][a.c];
  const tb = board[b.r][b.c];
  if (!ta || !tb) return false;
  if (ta.special === 'void' || tb.special === 'void') return true;
  if (ta.special && tb.special) return true;
  swapCells(board, a, b);
  const live = findMatches(board).length > 0;
  swapCells(board, a, b);
  return live;
}

export function findHint(board) {
  const rows = board.length;
  const cols = board[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = { r, c };
      if (c + 1 < cols && swapIsLive(board, a, { r, c: c + 1 })) return [a, { r, c: c + 1 }];
      if (r + 1 < rows && swapIsLive(board, a, { r: r + 1, c })) return [a, { r: r + 1, c }];
    }
  }
  return null;
}

function cellsOfType(state, type) {
  const out = [];
  state.board.forEach((row, r) =>
    row.forEach((t, c) => {
      if (t && t.type === type) out.push({ r, c });
    }),
  );
  return out;
}

function mostCommonType(state) {
  const counts = new Array(state.types).fill(0);
  for (const t of state.board.flat()) if (matchable(t)) counts[t.type]++;
  let best = 0;
  for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
  return best;
}

function blastArea(state, blast) {
  const out = [];
  const { r, c } = blast;
  const rowsOf = (rr) => {
    if (rr < 0 || rr >= state.rows) return;
    for (let cc = 0; cc < state.cols; cc++) out.push({ r: rr, c: cc });
  };
  const colsOf = (cc) => {
    if (cc < 0 || cc >= state.cols) return;
    for (let rr = 0; rr < state.rows; rr++) out.push({ r: rr, c: cc });
  };
  const square = (radius) => {
    for (let dr = -radius; dr <= radius; dr++)
      for (let dc = -radius; dc <= radius; dc++)
        if (inside(state, r + dr, c + dc)) out.push({ r: r + dr, c: c + dc });
  };
  switch (blast.kind) {
    case 'row': rowsOf(r); break;
    case 'col': colsOf(c); break;
    case 'bomb': square(1); break;
    case 'bigbomb': square(2); break;
    case 'cross': rowsOf(r); colsOf(c); break;
    case 'bigcross':
      for (let d = -1; d <= 1; d++) { rowsOf(r + d); colsOf(c + d); }
      break;
    case 'void': out.push(...cellsOfType(state, blast.type)); break;
    case 'voidall':
      for (let rr = 0; rr < state.rows; rr++) for (let cc = 0; cc < state.cols; cc++) out.push({ r: rr, c: cc });
      break;
  }
  return out;
}

const SCORE_PER_TILE = 20;

function runStep(state, combo, matches, preset) {
  const cols = state.cols;
  const k = (r, c) => r * cols + c;
  const clear = new Map();
  const add = (r, c) => {
    if (inside(state, r, c) && state.board[r][c] && !clear.has(k(r, c))) clear.set(k(r, c), { r, c });
  };
  const detonated = new Set(preset.detonated);
  const blasts = [...preset.blasts];
  const created = [];

  for (const cell of preset.cells) add(cell.r, cell.c);
  for (const blast of preset.blasts) for (const cell of blastArea(state, blast)) add(cell.r, cell.c);

  const hints = preset.pivotHints ?? [];
  for (const g of matches) {
    for (const cell of g.cells) add(cell.r, cell.c);
    if (!g.special) continue;
    const at = hints.find((h) => g.cells.some((cell) => cell.r === h.r && cell.c === h.c)) ?? g.pivot;
    created.push({ r: at.r, c: at.c, type: g.special === 'void' ? VOID : g.type, special: g.special });
  }

  // Chain reaction: any special tile caught in the blast fires too.
  const queue = [...clear.values()];
  while (queue.length) {
    const { r, c } = queue.shift();
    const tile = state.board[r][c];
    if (!tile || !tile.special || detonated.has(tile.id)) continue;
    detonated.add(tile.id);
    const blast =
      tile.special === 'void'
        ? { kind: 'void', r, c, type: mostCommonType(state) }
        : { kind: tile.special, r, c, type: tile.type };
    blasts.push(blast);
    for (const cell of blastArea(state, blast)) {
      if (!clear.has(k(cell.r, cell.c)) && state.board[cell.r][cell.c]) {
        add(cell.r, cell.c);
        queue.push(cell);
      }
    }
  }

  const step = {
    combo,
    matches: matches.map((g) => ({ type: g.type, special: g.special, cells: g.cells })),
    transforms: preset.transforms ?? [],
    blasts,
    cleared: [],
    created: [],
    sealsBroken: [],
    falls: [],
    spawns: [],
    score: 0,
  };

  for (const { r, c } of clear.values()) {
    step.cleared.push({ r, c, tile: state.board[r][c] });
    state.board[r][c] = null;
    if (state.seals[r][c]) {
      state.seals[r][c] = false;
      step.sealsBroken.push({ r, c });
    }
  }
  for (const spec of created) {
    const tile = makeTile(state, spec.type, spec.special);
    state.board[spec.r][spec.c] = tile;
    step.created.push({ r: spec.r, c: spec.c, tile });
  }

  // Gravity, then refill from above.
  for (let c = 0; c < state.cols; c++) {
    let write = state.rows - 1;
    for (let r = state.rows - 1; r >= 0; r--) {
      const tile = state.board[r][c];
      if (!tile) continue;
      if (write !== r) {
        state.board[write][c] = tile;
        state.board[r][c] = null;
        step.falls.push({ id: tile.id, c, fromR: r, toR: write });
      }
      write--;
    }
    const missing = write + 1;
    for (let r = write; r >= 0; r--) {
      const tile = makeTile(state, randType(state));
      state.board[r][c] = tile;
      step.spawns.push({ tile, c, r, fromR: r - missing });
    }
  }

  step.score =
    step.cleared.length * SCORE_PER_TILE * combo +
    step.created.length * 60 +
    step.blasts.length * 40 * combo;
  return step;
}

const EMPTY_PRESET = { cells: [], blasts: [], detonated: [] };

export function resolveBoard(state, preset = EMPTY_PRESET, startCombo = 1) {
  const steps = [];
  let next = preset;
  let combo = startCombo;
  for (;;) {
    const matches = findMatches(state.board);
    const forced = next.cells.length || next.blasts.length || (next.transforms ?? []).length;
    if (!matches.length && !forced) break;
    steps.push(runStep(state, combo++, matches, next));
    next = EMPTY_PRESET;
  }
  return steps;
}

function specialSwapPreset(state, from, to) {
  const a = state.board[to.r][to.c]; // moved tile, now at `to`
  const b = state.board[from.r][from.c];
  const cells = [to, from];
  const detonated = [a.id, b.id];
  const kinds = [a.special, b.special];
  const has = (s) => kinds.includes(s);
  const at = { r: to.r, c: to.c };

  if (has('void')) {
    if (a.special === 'void' && b.special === 'void') {
      return { cells, detonated, blasts: [{ kind: 'voidall', ...at, type: VOID }] };
    }
    const other = a.special === 'void' ? b : a;
    const voidAt = a.special === 'void' ? to : from;
    if (!other.special) {
      return { cells, detonated: [a.id, b.id], blasts: [{ kind: 'void', ...voidAt, type: other.type }] };
    }
    // Void + blaster: every gem of that color becomes a blaster, then all fire.
    const transforms = [];
    for (const cell of cellsOfType(state, other.type)) {
      const tile = state.board[cell.r][cell.c];
      if (tile === other) continue;
      const special =
        other.special === 'bomb' ? 'bomb' : state.rng() < 0.5 ? 'row' : 'col';
      tile.special = special;
      transforms.push({ r: cell.r, c: cell.c, id: tile.id, special });
    }
    return {
      cells: [...cells, ...transforms],
      detonated: [a.id, b.id],
      transforms,
      blasts: [{ kind: 'void', ...voidAt, type: other.type }, { kind: other.special, ...at, type: other.type }],
    };
  }
  if (has('bomb') && (has('row') || has('col'))) return { cells, detonated, blasts: [{ kind: 'bigcross', ...at, type: a.type }] };
  if (a.special === 'bomb' && b.special === 'bomb') return { cells, detonated, blasts: [{ kind: 'bigbomb', ...at, type: a.type }] };
  return { cells, detonated, blasts: [{ kind: 'cross', ...at, type: a.type }] };
}

// `from` is the tile the player dragged; it lands on `to`.
export function resolveSwap(state, from, to) {
  if (!adjacent(from, to) || !inside(state, from.r, from.c) || !inside(state, to.r, to.c)) {
    return { valid: false, steps: [] };
  }
  if (!swapIsLive(state.board, from, to)) return { valid: false, steps: [] };

  const moved = state.board[from.r][from.c];
  const other = state.board[to.r][to.c];
  swapCells(state.board, from, to);

  const specialSwap =
    moved.special === 'void' || other.special === 'void' || (moved.special && other.special);
  const preset = specialSwap
    ? specialSwapPreset(state, from, to)
    : { ...EMPTY_PRESET, pivotHints: [to, from] };
  return { valid: true, steps: resolveBoard(state, preset) };
}

export function shuffle(state) {
  const positions = [];
  for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) positions.push({ r, c });
  const tiles = positions.map(({ r, c }) => state.board[r][c]);
  const from = new Map();
  positions.forEach(({ r, c }) => from.set(state.board[r][c].id, { r, c }));

  for (let attempt = 0; ; attempt++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(state.rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    positions.forEach(({ r, c }, i) => (state.board[r][c] = tiles[i]));
    if (!findMatches(state.board).length && findHint(state.board)) break;
    if (attempt > 200) {
      // The color mix itself is hopeless: recolor the plain gems in place.
      for (const t of tiles) if (!t.special) t.type = randType(state);
    }
  }
  return positions.map(({ r, c }) => {
    const tile = state.board[r][c];
    const src = from.get(tile.id);
    return { id: tile.id, fromR: src.r, fromC: src.c, toR: r, toC: c };
  });
}

// End-of-level bonus: each leftover move becomes a blaster that goes off.
export function requiem(state, count) {
  const candidates = [];
  state.board.forEach((row, r) =>
    row.forEach((t, c) => {
      if (t && !t.special) candidates.push({ r, c });
    }),
  );
  const transforms = [];
  for (let i = 0; i < count && candidates.length; i++) {
    const [cell] = candidates.splice(Math.floor(state.rng() * candidates.length), 1);
    const tile = state.board[cell.r][cell.c];
    tile.special = state.rng() < 0.5 ? 'row' : 'col';
    transforms.push({ r: cell.r, c: cell.c, id: tile.id, special: tile.special });
  }
  const steps = resolveBoard(state, { cells: transforms, blasts: [], detonated: [], transforms });
  return { transforms, steps };
}
