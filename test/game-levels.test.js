import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../game/engine.js';
import {
  LEVELS,
  sealCells,
  starsFor,
  freshProgress,
  loadProgress,
  recordResult,
  jigsawEdges,
  pieceEdges,
  assignPieces,
} from '../game/levels.js';

describe('LEVELS', () => {
  it('each relic has exactly one seal per puzzle piece on an 8x8 board', () => {
    assert.ok(LEVELS.length >= 6);
    for (const level of LEVELS) {
      assert.equal(level.pattern.length, 8, level.name);
      for (const row of level.pattern) assert.equal(row.length, 8, level.name);
      assert.equal(sealCells(level).length, level.pieces.rows * level.pieces.cols, level.name);
    }
  });
});

describe('sealCells', () => {
  it('reads # marks as [row, col] pairs', () => {
    const level = { pattern: ['#.......', '.......#', '........', '........', '........', '........', '........', '........'] };
    assert.deepEqual(sealCells(level), [[0, 0], [1, 7]]);
  });
});

describe('starsFor', () => {
  it('rewards the moves left unspent', () => {
    assert.equal(starsFor(0, 20), 1);
    assert.equal(starsFor(3, 20), 2);
    assert.equal(starsFor(8, 20), 3);
  });
});

describe('progress', () => {
  it('starts with only the first relic open', () => {
    assert.deepEqual(freshProgress(), { unlocked: 1, stars: [], best: [] });
  });

  it('survives missing or corrupt saved data', () => {
    assert.deepEqual(loadProgress(null), freshProgress());
    assert.deepEqual(loadProgress('{not json'), freshProgress());
    assert.deepEqual(loadProgress('{"unlocked":"x"}'), freshProgress());
  });

  it('round-trips a valid save', () => {
    const saved = { unlocked: 3, stars: [3, 1], best: [900, 400] };
    assert.deepEqual(loadProgress(JSON.stringify(saved)), saved);
  });

  it('a win opens the next relic and keeps the best result', () => {
    let p = freshProgress();
    p = recordResult(p, 0, { stars: 2, score: 500 });
    assert.equal(p.unlocked, 2);
    p = recordResult(p, 0, { stars: 1, score: 300 });
    assert.equal(p.stars[0], 2);
    assert.equal(p.best[0], 500);
    p = recordResult(p, 0, { stars: 3, score: 800 });
    assert.equal(p.stars[0], 3);
    assert.equal(p.best[0], 800);
  });

  it('never unlocks past the last relic', () => {
    let p = { unlocked: LEVELS.length, stars: [], best: [] };
    p = recordResult(p, LEVELS.length - 1, { stars: 1, score: 1 });
    assert.equal(p.unlocked, LEVELS.length);
  });
});

describe('jigsaw', () => {
  it('neighbouring pieces interlock and borders stay flat', () => {
    const rows = 3;
    const cols = 4;
    const edges = jigsawEdges(rows, cols, createRng(5));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const e = pieceEdges(edges, r, c);
        if (r === 0) assert.equal(e.top, 0);
        if (c === 0) assert.equal(e.left, 0);
        if (r === rows - 1) assert.equal(e.bottom, 0);
        if (c === cols - 1) assert.equal(e.right, 0);
        if (c < cols - 1) {
          assert.ok(Math.abs(e.right) === 1);
          assert.equal(e.right, -pieceEdges(edges, r, c + 1).left);
        }
        if (r < rows - 1) {
          assert.ok(Math.abs(e.bottom) === 1);
          assert.equal(e.bottom, -pieceEdges(edges, r + 1, c).top);
        }
      }
    }
  });

  it('assigns every seal a distinct piece, deterministically', () => {
    const seals = [[0, 0], [0, 1], [2, 3], [4, 4], [7, 7]];
    const a = assignPieces(seals, createRng(9));
    const b = assignPieces(seals, createRng(9));
    assert.deepEqual(a, b);
    assert.deepEqual(Object.values(a).sort(), [0, 1, 2, 3, 4]);
    assert.deepEqual(Object.keys(a).sort(), ['0,0', '0,1', '2,3', '4,4', '7,7']);
  });
});
