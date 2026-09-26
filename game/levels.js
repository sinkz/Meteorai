// Relic definitions, progress and jigsaw geometry for Hollow Reliquary.
// Everything here is pure data or pure functions so it can run under node:test.

// Each "#" is a cursed seal. Breaking a seal frees one fragment of the relic,
// so every pattern holds exactly pieces.rows * pieces.cols seals.
export const LEVELS = [
  {
    name: 'The Hollow Moon',
    lore: 'It watched over the graves for a thousand nights, until someone broke it.',
    moves: 22,
    types: 5,
    seed: 1101,
    pieces: { rows: 3, cols: 3 },
    pattern: [
      '........',
      '........',
      '....#...',
      '....#...',
      '..#####.',
      '....#...',
      '....#...',
      '........',
    ],
  },
  {
    name: 'The Weeping Eye',
    lore: 'Its tears were kept in glass vials. None of them has ever run dry.',
    moves: 24,
    types: 5,
    seed: 2202,
    pieces: { rows: 3, cols: 4 },
    pattern: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '##....##',
      '##....##',
      '##....##',
    ],
  },
  {
    name: 'Crown of Thorns',
    lore: 'Whoever wore it could never take it off again.',
    moves: 24,
    types: 6,
    seed: 3303,
    pieces: { rows: 3, cols: 4 },
    pattern: [
      '........',
      '........',
      '..####..',
      '..#..#..',
      '..#..#..',
      '..####..',
      '........',
      '........',
    ],
  },
  {
    name: 'The Drowned Bell',
    lore: 'It still rings beneath the black lake, for anyone who listens.',
    moves: 26,
    types: 6,
    seed: 4404,
    pieces: { rows: 4, cols: 4 },
    pattern: [
      '........',
      '........',
      '#.#.#.#.',
      '.#.#.#.#',
      '#.#.#.#.',
      '.#.#.#.#',
      '........',
      '........',
    ],
  },
  {
    name: 'Heart of Ash',
    lore: 'Burned twice. Still beating once.',
    moves: 25,
    types: 6,
    seed: 5505,
    pieces: { rows: 4, cols: 4 },
    pattern: [
      '........',
      '.##..##.',
      '#..##..#',
      '#......#',
      '.#....#.',
      '..#..#..',
      '...##...',
      '........',
    ],
  },
  {
    name: 'The Last Door',
    lore: 'Behind it waits whoever broke the other relics.',
    moves: 28,
    types: 6,
    seed: 6606,
    pieces: { rows: 4, cols: 5 },
    pattern: [
      '........',
      '..####..',
      '.#....#.',
      '.#....#.',
      '.#....#.',
      '.#.##.#.',
      '.#....#.',
      '.#.##.#.',
    ],
  },
];

export function sealCells(level) {
  const cells = [];
  level.pattern.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '#') cells.push([r, c]);
    });
  });
  return cells;
}

export function starsFor(movesLeft, totalMoves) {
  const ratio = movesLeft / totalMoves;
  if (ratio >= 0.35) return 3;
  if (ratio >= 0.1) return 2;
  return 1;
}

export function freshProgress() {
  return { unlocked: 1, stars: [], best: [] };
}

const isCount = (n) => Number.isInteger(n) && n >= 0;

export function loadProgress(raw) {
  try {
    const data = JSON.parse(raw);
    if (
      data &&
      Number.isInteger(data.unlocked) &&
      data.unlocked >= 1 &&
      Array.isArray(data.stars) &&
      Array.isArray(data.best) &&
      data.stars.every((s) => s === null || isCount(s)) &&
      data.best.every((s) => s === null || isCount(s))
    ) {
      return { unlocked: Math.min(data.unlocked, LEVELS.length), stars: data.stars, best: data.best };
    }
  } catch {
    // fall through to a fresh save
  }
  return freshProgress();
}

export function recordResult(progress, index, { stars, score }) {
  const next = { unlocked: progress.unlocked, stars: [...progress.stars], best: [...progress.best] };
  next.stars[index] = Math.max(next.stars[index] ?? 0, stars);
  next.best[index] = Math.max(next.best[index] ?? 0, score);
  next.unlocked = Math.max(next.unlocked, Math.min(index + 2, LEVELS.length));
  return next;
}

const coin = (rng) => (rng() < 0.5 ? 1 : -1);

// h[r][c]: edge under piece (r, c); +1 means its knob points down.
// v[r][c]: edge right of piece (r, c); +1 means its knob points right.
export function jigsawEdges(rows, cols, rng) {
  return {
    h: Array.from({ length: rows - 1 }, () => Array.from({ length: cols }, () => coin(rng))),
    v: Array.from({ length: rows }, () => Array.from({ length: cols - 1 }, () => coin(rng))),
  };
}

// Knob direction for each side of a piece: +1 sticks out, -1 cuts in, 0 is a flat border.
export function pieceEdges(edges, r, c) {
  const rows = edges.v.length;
  const cols = edges.h[0]?.length ?? edges.v[0].length + 1;
  return {
    top: r > 0 ? -edges.h[r - 1][c] : 0,
    bottom: r < rows - 1 ? edges.h[r][c] : 0,
    left: c > 0 ? -edges.v[r][c - 1] : 0,
    right: c < cols - 1 ? edges.v[r][c] : 0,
  };
}

// Maps each seal ("r,c") to the relic piece it releases.
export function assignPieces(seals, rng) {
  const order = seals.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const map = {};
  seals.forEach(([r, c], i) => {
    map[`${r},${c}`] = order[i];
  });
  return map;
}
