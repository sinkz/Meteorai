import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRng,
  createGame,
  fromLayout,
  findMatches,
  findHint,
  resolveSwap,
  resolveBoard,
  shuffle,
  requiem,
  sealsRemaining,
} from '../game/engine.js';

const types = (state) => state.board.map((row) => row.map((t) => (t ? t.type : null)));
const key = ({ r, c }) => `${r},${c}`;
const noHoles = (state) => state.board.every((row) => row.every((t) => t !== null));

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    assert.deepEqual(seqA, seqB);
    for (const v of seqA) assert.ok(v >= 0 && v < 1);
  });

  it('differs across seeds', () => {
    assert.notEqual(createRng(1)(), createRng(2)());
  });
});

describe('createGame', () => {
  it('builds a full board with no pre-made matches and at least one move', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = createGame({ rows: 8, cols: 8, types: 6, seed, seals: [[0, 0], [7, 7]] });
      assert.equal(state.board.length, 8);
      assert.equal(state.board[0].length, 8);
      assert.ok(noHoles(state));
      assert.deepEqual(findMatches(state.board), []);
      assert.ok(findHint(state.board), `seed ${seed} has no move`);
      assert.equal(sealsRemaining(state), 2);
    }
  });
});

describe('fromLayout', () => {
  it('parses letters, specials and void tokens', () => {
    const state = fromLayout(['A B- C|', 'D* @ F'], { seed: 1, seals: [[1, 2]] });
    assert.deepEqual(types(state), [[0, 1, 2], [3, -1, 5]]);
    assert.equal(state.board[0][1].special, 'row');
    assert.equal(state.board[0][2].special, 'col');
    assert.equal(state.board[1][0].special, 'bomb');
    assert.equal(state.board[1][1].special, 'void');
    assert.equal(state.board[0][0].special, null);
    assert.equal(sealsRemaining(state), 1);
  });
});

describe('findMatches', () => {
  it('finds a plain horizontal run of three', () => {
    const { board } = fromLayout(['A A A', 'B C D']);
    const groups = findMatches(board);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].type, 0);
    assert.equal(groups[0].special, null);
    assert.deepEqual(groups[0].cells.map(key).sort(), ['0,0', '0,1', '0,2']);
  });

  it('turns a horizontal four into a row blaster', () => {
    const { board } = fromLayout(['A A A A', 'B C D E']);
    assert.equal(findMatches(board)[0].special, 'row');
  });

  it('turns a vertical four into a column blaster', () => {
    const { board } = fromLayout(['A B', 'A C', 'A D', 'A E']);
    assert.equal(findMatches(board)[0].special, 'col');
  });

  it('turns five in a line into a void eye', () => {
    const { board } = fromLayout(['A A A A A', 'B C D E F']);
    assert.equal(findMatches(board)[0].special, 'void');
  });

  it('merges crossing runs into one bomb group', () => {
    const { board } = fromLayout(['A B C', 'A C B', 'A A A']);
    const groups = findMatches(board);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].special, 'bomb');
    assert.equal(groups[0].cells.length, 5);
  });

  it('never matches void tiles', () => {
    const { board } = fromLayout(['@ @ @', 'A B C']);
    assert.deepEqual(findMatches(board), []);
  });
});

describe('resolveSwap', () => {
  it('rejects a swap that makes no match and leaves the board untouched', () => {
    const state = fromLayout(['A B C', 'D E F', 'A B C']);
    const before = types(state);
    const result = resolveSwap(state, { r: 0, c: 0 }, { r: 0, c: 1 });
    assert.equal(result.valid, false);
    assert.deepEqual(result.steps, []);
    assert.deepEqual(types(state), before);
  });

  it('rejects non-adjacent swaps', () => {
    const state = fromLayout(['A A B A', 'C D A E']);
    const result = resolveSwap(state, { r: 1, c: 2 }, { r: 0, c: 0 });
    assert.equal(result.valid, false);
  });

  it('clears the match, breaks seals under it and leaves a stable full board', () => {
    const state = fromLayout(['A A B A', 'C D A E'], { seed: 7, seals: [[0, 0], [1, 0]] });
    const result = resolveSwap(state, { r: 1, c: 2 }, { r: 0, c: 2 });
    assert.equal(result.valid, true);
    const first = result.steps[0];
    assert.ok(first.cleared.some((c) => c.r === 0 && c.c === 0));
    assert.deepEqual(first.sealsBroken.map(key), ['0,0']);
    assert.equal(sealsRemaining(state), 1);
    assert.ok(noHoles(state));
    assert.deepEqual(findMatches(state.board), []);
  });

  it('spawns the special where the moved tile landed', () => {
    const state = fromLayout(['A A B A', 'C D A E'], { seed: 3 });
    const { steps } = resolveSwap(state, { r: 1, c: 2 }, { r: 0, c: 2 });
    assert.equal(steps[0].created.length, 1);
    assert.equal(steps[0].created[0].r, 0);
    assert.equal(steps[0].created[0].c, 2);
    assert.equal(steps[0].created[0].tile.special, 'row');
    assert.equal(steps[0].created[0].tile.type, 0);
  });

  it('void eye swapped with a gem erases every gem of that color', () => {
    const state = fromLayout(['@ A B', 'C D A', 'A E F'], { seed: 5 });
    const { valid, steps } = resolveSwap(state, { r: 0, c: 0 }, { r: 0, c: 1 });
    assert.equal(valid, true);
    const cleared = steps[0].cleared.map((c) => c.tile);
    assert.equal(cleared.length, 4);
    assert.equal(cleared.filter((t) => t.type === 0).length, 3);
    assert.equal(cleared.filter((t) => t.special === 'void').length, 1);
    assert.ok(steps[0].blasts.some((b) => b.kind === 'void' && b.type === 0));
  });

  it('two void eyes wipe the whole board', () => {
    const state = fromLayout(['@ @ B', 'C D E'], { seed: 9 });
    const { valid, steps } = resolveSwap(state, { r: 0, c: 0 }, { r: 0, c: 1 });
    assert.equal(valid, true);
    assert.equal(steps[0].cleared.length, 6);
  });

  it('two line blasters fire a cross at the target cell', () => {
    const state = fromLayout(['B C D E', 'C A- B| F', 'D E F C', 'E F C D'], { seed: 2 });
    const { valid, steps } = resolveSwap(state, { r: 1, c: 1 }, { r: 1, c: 2 });
    assert.equal(valid, true);
    const cleared = new Set(steps[0].cleared.map(key));
    for (let c = 0; c < 4; c++) assert.ok(cleared.has(`1,${c}`));
    for (let r = 0; r < 4; r++) assert.ok(cleared.has(`${r},2`));
    assert.ok(!cleared.has('0,0'));
  });
});

describe('resolveBoard', () => {
  it('a row blaster caught in a match clears its whole row', () => {
    const state = fromLayout(['B C D B C', 'A- A A D E', 'C D E C D'], { seed: 4 });
    const steps = resolveBoard(state);
    const cleared = new Set(steps[0].cleared.map(key));
    for (let c = 0; c < 5; c++) assert.ok(cleared.has(`1,${c}`));
    assert.ok(steps[0].blasts.some((b) => b.kind === 'row' && b.r === 1));
  });

  it('a bomb caught in a match clears its 3x3 neighbourhood', () => {
    const state = fromLayout(
      ['B C D E B', 'C D E B C', 'A A A* D E', 'D E B C D', 'E B C D E'],
      { seed: 4 },
    );
    const steps = resolveBoard(state);
    const cleared = new Set(steps[0].cleared.map(key));
    for (const cell of ['1,1', '1,2', '1,3', '2,3', '3,1', '3,2', '3,3']) assert.ok(cleared.has(cell), cell);
    assert.ok(!cleared.has('0,0'));
    assert.ok(!cleared.has('4,4'));
  });

  it('numbers cascades with a rising combo', () => {
    const state = fromLayout(['A D E', 'B E F', 'B F D', 'B A A'], { seed: 11 });
    const steps = resolveBoard(state);
    assert.ok(steps.length >= 2);
    assert.equal(steps[0].combo, 1);
    assert.equal(steps[1].combo, 2);
    assert.ok(steps[1].score > 0);
  });

  it('records falls and spawns so every tile can be animated', () => {
    const state = fromLayout(['A D E', 'B E F', 'B F D', 'B A A'], { seed: 11 });
    const [first] = resolveBoard(state);
    assert.ok(first.falls.some((f) => f.c === 0 && f.fromR === 0 && f.toR === 3));
    assert.equal(first.spawns.length, 3);
    for (const s of first.spawns) assert.ok(s.fromR < 0);
  });
});

describe('findHint', () => {
  it('returns a swap that produces a match', () => {
    const state = fromLayout(['A A B A', 'C D A E']);
    const hint = findHint(state.board);
    assert.ok(hint);
    const result = resolveSwap(state, hint[0], hint[1]);
    assert.equal(result.valid, true);
  });

  it('returns null on a dead board', () => {
    const { board } = fromLayout(['A B C', 'D E F', 'A B C']);
    assert.equal(findHint(board), null);
  });
});

describe('shuffle', () => {
  it('rearranges a dead board into a playable one without matches', () => {
    const state = createGame({ rows: 6, cols: 6, types: 6, seed: 21 });
    const idsBefore = state.board.flat().map((t) => t.id).sort();
    const moves = shuffle(state);
    assert.ok(Array.isArray(moves));
    assert.deepEqual(findMatches(state.board), []);
    assert.ok(findHint(state.board));
    assert.deepEqual(state.board.flat().map((t) => t.id).sort(), idsBefore);
  });
});

describe('requiem', () => {
  it('turns leftover moves into blasters that detonate', () => {
    const state = createGame({ rows: 8, cols: 8, types: 6, seed: 33 });
    const { transforms, steps } = requiem(state, 3);
    assert.equal(transforms.length, 3);
    for (const t of transforms) assert.ok(['row', 'col'].includes(t.special));
    assert.ok(steps.length >= 1);
    assert.ok(noHoles(state));
    assert.deepEqual(findMatches(state.board), []);
  });
});
