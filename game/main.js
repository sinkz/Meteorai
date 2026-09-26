// Hollow Reliquary: rendering, juice, input and game flow.
// Rules live in engine.js; this file only animates what the engine reports.
import { createGame, createRng, resolveSwap, findHint, shuffle, requiem, sealsRemaining } from './engine.js';
import { LEVELS, sealCells, starsFor, loadProgress, recordResult, jigsawEdges, assignPieces } from './levels.js';
import { createAudio } from './audio.js';
import { GEMS, makeGemSprite, makeVoidOrb, makeGlow, drawRelic, makeGhost, makePieces, piecePath } from './art.js';

const SIZE = 8;
const SAVE_KEY = 'hollow-reliquary-progress';
const MUTE_KEY = 'hollow-reliquary-muted';
const DISPLAY = '"Pirata One", "UnifrakturCook", Georgia, serif';
const SMALLCAPS = '"IM Fell English SC", Georgia, serif';
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const COMBO_WORDS = ['', '', 'Grim', 'Wicked', 'Unholy', 'Damned', 'Abyssal', 'Apocalyptic'];

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const audio = createAudio();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage is a convenience; the game runs without it
  }
}
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let progress = loadProgress(read(SAVE_KEY));
audio.setMuted(read(MUTE_KEY) === '1');

// ---------------------------------------------------------------------------
// Viewport and layout

let W = 0;
let H = 0;
let DPR = 1;
let cell = 40;
const L = { board: { x: 0, y: 0, size: 0 }, relic: { x: 0, y: 0, w: 0, h: 0 } };
let gemSprites = [];
let voidOrb = null;
const glows = {};

function glow(color) {
  if (!glows[color]) glows[color] = makeGlow(color, 64);
  return glows[color];
}

function measure() {
  W = window.innerWidth;
  H = window.innerHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  layout();
}

function layout() {
  const hud = $('hud');
  const top = hud.hidden ? 12 : hud.getBoundingClientRect().bottom + 8;
  const bottom = H - $('safe-bottom').offsetHeight - 12;
  const aspect = game ? game.level.pieces.cols / game.level.pieces.rows : 1;
  const landscape = W > (bottom - top) * 1.2;
  const plate = 30;
  const pad = 12;
  let areaTop;
  let areaBottom;
  let centerX;
  let maxW;
  if (landscape) {
    const half = W * 0.48;
    cell = Math.floor(Math.min((bottom - top - 16) / SIZE, (W - half - 40) / SIZE, 84));
    const size = cell * SIZE;
    L.board = { x: half + (W - half - size) / 2, y: top + (bottom - top - size) / 2, size };
    centerX = L.board.x / 2;
    areaTop = top + 8;
    areaBottom = bottom - plate;
    maxW = L.board.x - 72;
  } else {
    cell = Math.floor(Math.min((W - 20) / SIZE, (bottom - top - 170) / SIZE, 76));
    const size = cell * SIZE;
    L.board = { x: (W - size) / 2, y: bottom - size, size };
    centerX = W / 2;
    areaTop = top;
    areaBottom = L.board.y - 14 - plate;
    maxW = W - 56;
  }
  const availH = Math.max(40, areaBottom - areaTop - pad * 2);
  let fh = availH;
  let fw = fh * aspect;
  if (fw > maxW) {
    fw = maxW;
    fh = fw / aspect;
  }
  L.relic = { x: centerX - fw / 2, y: areaTop + pad + (availH - fh) / 2, w: fw, h: fh };

  const px = Math.round(cell * DPR);
  gemSprites = GEMS.map((_, i) => makeGemSprite(i, px));
  voidOrb = makeVoidOrb(px);
  if (game) buildRelic();
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(measure, 120);
});

// ---------------------------------------------------------------------------
// Time, tweens and effects

let realTime = 0;
let freezeUntil = 0;
let shakeAmp = 0;
let flash = { a: 0, color: '#fff' };
const tweens = [];
const parts = [];
const fx = [];
const texts = [];

const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t * t * t,
  inQuad: (t) => t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

function tween(obj, to, dur, fn = ease.outCubic, delay = 0) {
  return new Promise((resolve) => {
    tweens.push({ obj, to, from: null, dur: Math.max(1, dur), fn, t: -delay, resolve });
  });
}
const wait = (ms) => tween({}, {}, ms);

function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    if (!tw.from) {
      tw.from = {};
      for (const k in tw.to) tw.from[k] = tw.obj[k];
    }
    const p = Math.min(1, tw.t / tw.dur);
    const e = tw.fn(p);
    for (const k in tw.to) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
    if (p >= 1) {
      tweens.splice(i, 1);
      tw.resolve();
    }
  }
}

function shake(amount) {
  if (reduceMotion) return;
  shakeAmp = Math.min(22, shakeAmp + amount);
}
function hitstop(ms) {
  if (reduceMotion) return;
  freezeUntil = Math.max(freezeUntil, realTime + ms);
}
function screenFlash(color, a) {
  flash = { color, a: Math.max(flash.a, reduceMotion ? a * 0.4 : a) };
}
function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // haptics are optional
  }
}

function spark(x, y, color, n, { speed = 0.35, size = 16, life = 600, gravity = 0.0006, spread = Math.PI * 2, angle = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = speed * (0.3 + Math.random());
    parts.push({ kind: 'glow', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity, drag: 0.992, life, max: life, size: size * (0.5 + Math.random()), img: glow(color) });
  }
}
function shards(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 0.15 + Math.random() * 0.35;
    const life = 500 + Math.random() * 400;
    parts.push({ kind: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.2, g: 0.0012, drag: 0.99, life, max: life, size: cell * (0.08 + Math.random() * 0.1), color, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.02 });
  }
}
function ring(x, y, color, radius, life = 500, width = 4) {
  fx.push({ kind: 'ring', x, y, color, radius, life, max: life, width });
}
function floatText(text, x, y, { size = 18, color = '#eadfc8', life = 900, font = DISPLAY, rise = 40, pop = 1.6, glowColor = null } = {}) {
  texts.push({ text, x, y, size, color, life, max: life, font, rise, pop, glowColor });
}

function boltPath(x1, y1, x2, y2) {
  const pts = [[x1, y1]];
  const n = 8;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / (len || 1);
  const ny = (x2 - x1) / (len || 1);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const off = (Math.random() - 0.5) * len * 0.18 * Math.sin(t * Math.PI);
    pts.push([x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off]);
  }
  pts.push([x2, y2]);
  return pts;
}
function bolt(x1, y1, x2, y2, color, life = 260) {
  fx.push({ kind: 'bolt', x1, y1, x2, y2, pts: boltPath(x1, y1, x2, y2), color, life, max: life });
}

function updateEffects(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      parts.splice(i, 1);
      continue;
    }
    p.vy += p.g * dt;
    p.vx *= p.drag;
    p.vy *= p.drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.rot !== undefined) p.rot += p.vr * dt;
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    f.life -= dt;
    if (f.life <= 0) fx.splice(i, 1);
    else if (f.kind === 'bolt' && Math.random() < 0.35) f.pts = boltPath(f.x1, f.y1, f.x2, f.y2);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    texts[i].life -= dt;
    if (texts[i].life <= 0) texts.splice(i, 1);
  }
  if (parts.length > 900) parts.splice(0, parts.length - 900);
}

// ---------------------------------------------------------------------------
// Ambient atmosphere

const embers = Array.from({ length: 46 }, () => newEmber(true));
function newEmber(anywhere) {
  return {
    x: Math.random(),
    y: anywhere ? Math.random() : 1.05,
    v: 0.00002 + Math.random() * 0.00005,
    drift: Math.random() * Math.PI * 2,
    size: 3 + Math.random() * 7,
    hue: Math.random() < 0.8 ? '#ff7a2a' : '#b061ff',
  };
}
const fog = Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: 0.2 + i * 0.17, s: 0.6 + Math.random() * 0.5, v: (Math.random() - 0.5) * 0.00002 }));
let fogSprite = null;
let nextThunder = 18000 + Math.random() * 20000;

function drawBackground(dt) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d0914');
  g.addColorStop(0.55, '#08060c');
  g.addColorStop(1, '#040306');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (!fogSprite) fogSprite = makeGlow('rgba(92,60,140,0.16)', 256);
  for (const f of fog) {
    f.x += f.v * dt;
    if (f.x < -0.5) f.x = 1.5;
    if (f.x > 1.5) f.x = -0.5;
    const s = Math.max(W, H) * f.s;
    ctx.drawImage(fogSprite, f.x * W - s / 2, f.y * H - s / 2, s, s);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < embers.length; i++) {
    const e = embers[i];
    e.y -= e.v * dt;
    e.drift += dt * 0.001;
    if (e.y < -0.05) embers[i] = newEmber(false);
    const flick = 0.5 + 0.5 * Math.sin(realTime * 0.006 + i);
    ctx.globalAlpha = 0.25 + flick * 0.45;
    const x = e.x * W + Math.sin(e.drift) * 18;
    ctx.drawImage(glow(e.hue), x - e.size / 2, e.y * H - e.size / 2, e.size, e.size);
  }
  ctx.restore();

  nextThunder -= dt;
  if (nextThunder < 0 && !reduceMotion) {
    nextThunder = 25000 + Math.random() * 30000;
    screenFlash('#c9c2ff', 0.18);
    setTimeout(() => audio.thunder(), 300);
  }
}

// ---------------------------------------------------------------------------
// Game state

let screen = 'title';
let game = null;
const pointer = { x: -1, y: -1, t: 0 };

const cx = (c) => L.board.x + (c + 0.5) * cell;
const cy = (r) => L.board.y + (r + 0.5) * cell;

function makeSprite(tile, c, r) {
  const s = { id: tile.id, type: tile.type, special: tile.special, x: c, y: r, s: 1, sx: 1, sy: 1, a: 1, rot: 0, flash: 0 };
  game.sprites.set(tile.id, s);
  return s;
}

function buildRelic() {
  const { level } = game;
  const art = drawRelic(game.index, L.relic.w * DPR, L.relic.h * DPR);
  game.art = art;
  game.ghost = makeGhost(art);
  game.pieces = makePieces(art, level.pieces.rows, level.pieces.cols, game.edges);
}

function startLevel(index) {
  const level = LEVELS[index];
  const seals = sealCells(level);
  const runSeed = level.seed + Math.floor(Math.random() * 100000);
  const state = createGame({ rows: SIZE, cols: SIZE, types: level.types, seed: runSeed, seals });
  const rng = createRng(level.seed);
  game = {
    index,
    level,
    state,
    moves: level.moves,
    score: 0,
    shownScore: 0,
    total: seals.length,
    edges: jigsawEdges(level.pieces.rows, level.pieces.cols, rng),
    pieceMap: assignPieces(seals, rng),
    placed: new Set(),
    snaps: new Map(),
    sprites: new Map(),
    flights: [],
    pending: [],
    busy: true,
    selected: null,
    hint: null,
    idle: 0,
    restore: 0,
    sweep: -1,
    over: false,
  };
  showScreen('play');
  state.board.forEach((row, r) =>
    row.forEach((tile, c) => {
      const s = makeSprite(tile, c, r - SIZE - 1);
      tween(s, { y: r }, 520, ease.outBack, (SIZE - r) * 45 + c * 18);
    }),
  );
  updateHud();
  showIntro();
}

function spriteAtCell(r, c) {
  const tile = game.state.board[r]?.[c];
  return tile ? game.sprites.get(tile.id) : null;
}

// ---------------------------------------------------------------------------
// Turn resolution

function specialSwapName(a, b) {
  const kinds = [a.special, b.special];
  if (kinds[0] === 'void' && kinds[1] === 'void') return 'Oblivion';
  if (kinds.includes('void')) return kinds[0] && kinds[1] ? 'Contagion' : 'Eclipse';
  if (!a.special || !b.special) return null;
  if (kinds.includes('bomb') && (kinds.includes('row') || kinds.includes('col'))) return 'Pentacle';
  if (kinds[0] === 'bomb' && kinds[1] === 'bomb') return 'Cataclysm';
  return 'Crucifix';
}

async function trySwap(from, to) {
  if (!game || game.busy || game.over) return;
  if (to.r < 0 || to.c < 0 || to.r >= SIZE || to.c >= SIZE) return;
  game.busy = true;
  game.selected = null;
  game.hint = null;
  game.idle = 0;
  const A = spriteAtCell(from.r, from.c);
  const B = spriteAtCell(to.r, to.c);
  const named = specialSwapName(A, B);
  const result = resolveSwap(game.state, from, to);
  audio.swap();
  await Promise.all([
    tween(A, { x: to.c, y: to.r }, 170, ease.inOutCubic),
    tween(B, { x: from.c, y: from.r }, 170, ease.inOutCubic),
  ]);
  if (!result.valid) {
    audio.invalid();
    shake(5);
    buzz(25);
    await Promise.all([
      tween(A, { x: from.c, y: from.r }, 260, ease.outBack),
      tween(B, { x: to.c, y: to.r }, 260, ease.outBack),
    ]);
    game.busy = false;
    return;
  }
  game.moves--;
  updateHud();
  if (named) {
    bigWord(named, '#c9a0ff');
    shake(8);
  }
  await playSteps(result.steps);
  await afterMove();
}

function blastCovers(b, r, c, tile) {
  switch (b.kind) {
    case 'row': return r === b.r ? Math.abs(c - b.c) : -1;
    case 'col': return c === b.c ? Math.abs(r - b.r) : -1;
    case 'cross': return r === b.r || c === b.c ? Math.abs(c - b.c) + Math.abs(r - b.r) : -1;
    case 'bigcross': return Math.abs(r - b.r) <= 1 || Math.abs(c - b.c) <= 1 ? Math.abs(c - b.c) + Math.abs(r - b.r) : -1;
    case 'bomb': return Math.abs(r - b.r) <= 1 && Math.abs(c - b.c) <= 1 ? 1 : -1;
    case 'bigbomb': return Math.abs(r - b.r) <= 2 && Math.abs(c - b.c) <= 2 ? Math.max(Math.abs(r - b.r), Math.abs(c - b.c)) : -1;
    case 'void': return tile.type === b.type ? 4 + Math.hypot(r - b.r, c - b.c) * 0.6 : -1;
    case 'voidall': return 3 + Math.hypot(r - b.r, c - b.c);
    default: return -1;
  }
}

function blastFx(b, cleared) {
  const x = cx(b.c);
  const y = cy(b.r);
  const color = b.type >= 0 ? GEMS[b.type].glow : '#b061ff';
  const beam = (horizontal, index) => {
    fx.push({ kind: 'beam', horizontal, index, color, life: 480, max: 480 });
    const n = SIZE;
    for (let i = 0; i < n; i++) {
      const px = horizontal ? cx(i) : cx(index);
      const py = horizontal ? cy(index) : cy(i);
      spark(px, py, color, 2, { speed: 0.25, size: 20, life: 500 });
    }
  };
  switch (b.kind) {
    case 'row':
      beam(true, b.r);
      audio.line();
      shake(6);
      break;
    case 'col':
      beam(false, b.c);
      audio.line();
      shake(6);
      break;
    case 'cross':
      beam(true, b.r);
      beam(false, b.c);
      audio.line();
      shake(10);
      hitstop(70);
      break;
    case 'bigcross':
      for (let d = -1; d <= 1; d++) {
        if (b.r + d >= 0 && b.r + d < SIZE) beam(true, b.r + d);
        if (b.c + d >= 0 && b.c + d < SIZE) beam(false, b.c + d);
      }
      audio.line();
      audio.bomb();
      shake(16);
      hitstop(110);
      screenFlash(color, 0.35);
      break;
    case 'bomb':
    case 'bigbomb': {
      const big = b.kind === 'bigbomb';
      ring(x, y, color, cell * (big ? 3.2 : 1.9), 520, big ? 10 : 6);
      ring(x, y, '#fff3d6', cell * (big ? 2.4 : 1.3), 360, 3);
      spark(x, y, color, big ? 60 : 30, { speed: 0.55, size: 26, life: 700 });
      shards(x, y, color, big ? 24 : 12);
      audio.bomb();
      shake(big ? 18 : 11);
      hitstop(big ? 130 : 70);
      screenFlash(color, big ? 0.4 : 0.18);
      buzz(big ? [30, 30, 60] : 35);
      break;
    }
    case 'void':
    case 'voidall': {
      const all = b.kind === 'voidall';
      audio.void();
      shake(all ? 20 : 12);
      hitstop(all ? 180 : 120);
      screenFlash(all ? '#ffffff' : '#9b4dff', all ? 0.7 : 0.35);
      buzz(all ? [60, 40, 90] : [40, 30, 40]);
      ring(x, y, '#b061ff', cell * (all ? 9 : 4), 800, 8);
      let i = 0;
      for (const hit of cleared) {
        if (!all && hit.tile.type !== b.type) continue;
        const k = i++;
        wait(k * 22).then(() => {
          bolt(x, y, cx(hit.c), cy(hit.r), all ? '#e6d4ff' : GEMS[b.type]?.glow ?? '#b061ff');
          audio.zap(k);
        });
      }
      if (all) setTimeout(() => audio.thunder(), 200);
      break;
    }
  }
}

function popTile(sprite, r, c, i) {
  if (!sprite) return;
  const color = sprite.type >= 0 ? GEMS[sprite.type].glow : '#b061ff';
  const x = cx(c);
  const y = cy(r);
  sprite.flash = 1;
  spark(x, y, color, 7, { speed: 0.28, size: cell * 0.5, life: 520 });
  shards(x, y, sprite.type >= 0 ? GEMS[sprite.type].mid : '#6a22c9', 3);
  if (i < 12) audio.pop(i);
  tween(sprite, { s: 1.28 }, 70, ease.outCubic).then(() =>
    tween(sprite, { s: 0, a: 0 }, 150, ease.inCubic).then(() => game?.sprites.delete(sprite.id)),
  );
}

function breakSeal(r, c) {
  const x = cx(c);
  const y = cy(r);
  audio.seal();
  ring(x, y, '#63e6c9', cell * 0.9, 420, 3);
  spark(x, y, '#63e6c9', 14, { speed: 0.3, size: cell * 0.35, life: 600 });
  const index = game.pieceMap[`${r},${c}`];
  const piece = game.pieces[index];
  const scale = L.relic.w / game.art.width;
  const homeW = piece.pw * scale;
  const flight = {
    index,
    x,
    y,
    sx: x,
    sy: y,
    p: 0,
    s: 0,
    rot: (Math.random() - 0.5) * 2.4,
    startScale: (cell * 0.95) / homeW,
    bend: (Math.random() - 0.5) * W * 0.5,
  };
  game.flights.push(flight);
  const done = (async () => {
    await tween(flight, { s: 1.3, y: y - cell * 0.5 }, 280, ease.outBack);
    flight.sy = flight.y;
    audio.whoosh();
    await tween(flight, { p: 1 }, 760 + Math.random() * 200, ease.inOutCubic);
    game.flights.splice(game.flights.indexOf(flight), 1);
    game.placed.add(index);
    game.snaps.set(index, realTime);
    const hx = L.relic.x + (piece.c + 0.5) * (L.relic.w / game.level.pieces.cols);
    const hy = L.relic.y + (piece.r + 0.5) * (L.relic.h / game.level.pieces.rows);
    ring(hx, hy, '#ffd98a', homeW * 0.9, 460, 3);
    spark(hx, hy, '#ffd98a', 16, { speed: 0.3, size: 22, life: 700 });
    audio.snap(game.placed.size);
    buzz(12);
    shake(2);
    updateHud();
  })();
  game.pending.push(done);
}

function flightPos(f) {
  const piece = game.pieces[f.index];
  const hx = L.relic.x + (piece.c + 0.5) * (L.relic.w / game.level.pieces.cols);
  const hy = L.relic.y + (piece.r + 0.5) * (L.relic.h / game.level.pieces.rows);
  const t = f.p;
  const mx = (f.sx + hx) / 2 + f.bend;
  const my = Math.min(f.sy, hy) - 60;
  const x = (1 - t) ** 2 * f.sx + 2 * (1 - t) * t * mx + t * t * hx;
  const y = (1 - t) ** 2 * f.sy + 2 * (1 - t) * t * my + t * t * hy;
  const scale = f.startScale * f.s * (1 - t) + t;
  return { x: f.p > 0 ? x : f.x, y: f.p > 0 ? y : f.y, scale: f.p > 0 ? scale : f.startScale * f.s, rot: f.rot * (1 - t) };
}

async function playSteps(steps, { skipTransforms = false } = {}) {
  for (const step of steps) {
    if (step.combo >= 2) comboWord(step.combo);

    if (!skipTransforms && step.transforms.length) {
      for (const [i, tr] of step.transforms.entries()) {
        const s = game.sprites.get(tr.id);
        if (s) {
          s.special = tr.special;
          s.flash = 1;
          spark(cx(tr.c), cy(tr.r), '#b061ff', 6, { speed: 0.2, size: 24 });
        }
        if (i < 16) audio.zap(i);
        await wait(28);
      }
      await wait(220);
    }

    const matchCells = new Set();
    for (const m of step.matches) for (const cl of m.cells) matchCells.add(`${cl.r},${cl.c}`);
    const delays = new Map();
    let maxDelay = 0;
    for (const hit of step.cleared) {
      const k = `${hit.r},${hit.c}`;
      let d = matchCells.has(k) ? 0 : Infinity;
      step.blasts.forEach((b, j) => {
        const dist = blastCovers(b, hit.r, hit.c, hit.tile);
        if (dist >= 0) d = Math.min(d, j * 90 + dist * 22);
      });
      if (!Number.isFinite(d)) d = 0;
      delays.set(k, d);
      maxDelay = Math.max(maxDelay, d);
    }

    if (step.matches.length) {
      const biggest = Math.max(...step.matches.map((m) => m.cells.length));
      audio.match(step.combo, biggest);
      buzz(8);
    }
    step.blasts.forEach((b, j) => wait(j * 90).then(() => blastFx(b, step.cleared)));

    step.cleared.forEach((hit, i) => {
      const s = game.sprites.get(hit.tile.id);
      wait(delays.get(`${hit.r},${hit.c}`)).then(() => popTile(s, hit.r, hit.c, i));
    });
    for (const seal of step.sealsBroken) {
      wait(delays.get(`${seal.r},${seal.c}`) + 60).then(() => breakSeal(seal.r, seal.c));
    }
    for (const m of step.matches) {
      const mx = m.cells.reduce((a, cl) => a + cx(cl.c), 0) / m.cells.length;
      const my = m.cells.reduce((a, cl) => a + cy(cl.r), 0) / m.cells.length;
      const pts = m.cells.length * 20 * step.combo;
      floatText(`+${pts}`, mx, my, { size: cell * 0.42, color: GEMS[m.type]?.light ?? '#eadfc8', life: 800, font: SMALLCAPS, pop: 1.3 });
    }
    game.score += step.score;
    if (step.cleared.length >= 16) {
      screenFlash('#ffffff', 0.25);
      audio.thunder();
    }

    await wait(maxDelay + 230);

    for (const made of step.created) {
      const s = makeSprite(made.tile, made.c, made.r);
      s.s = 0;
      s.flash = 1;
      tween(s, { s: 1 }, 380, ease.outElastic);
      const color = made.tile.type >= 0 ? GEMS[made.tile.type].glow : '#b061ff';
      ring(cx(made.c), cy(made.r), color, cell * 1.2, 420, 4);
      spark(cx(made.c), cy(made.r), color, 18, { speed: 0.3, size: 26 });
      audio.create();
    }

    const falls = [];
    for (const f of step.falls) {
      const s = game.sprites.get(f.id);
      if (s) falls.push(drop(s, f.toR, f.c * 10));
    }
    for (const sp of step.spawns) {
      const s = makeSprite(sp.tile, sp.c, sp.fromR);
      falls.push(drop(s, sp.r, sp.c * 10));
    }
    await Promise.all(falls);
  }
}

async function drop(sprite, toR, delay) {
  const dist = Math.max(0.5, toR - sprite.y);
  await tween(sprite, { y: toR }, 110 + Math.sqrt(dist) * 95, ease.inQuad, delay);
  sprite.sx = 1.18;
  sprite.sy = 0.82;
  await tween(sprite, { sx: 1, sy: 1 }, 200, ease.outBack);
}

async function afterMove() {
  if (sealsRemaining(game.state) === 0) return win();
  if (game.moves <= 0) {
    await Promise.all(game.pending);
    return lose();
  }
  if (game.moves <= 3) audio.heartbeat();
  if (!findHint(game.state.board)) await reshuffle();
  game.busy = false;
}

async function reshuffle() {
  bigWord('The crypt shifts', '#63e6c9', 0.55);
  audio.shuffle();
  await wait(300);
  const moves = shuffle(game.state);
  const all = [...game.sprites.values()];
  await Promise.all(all.map((s) => tween(s, { x: 3.5 + (s.x - 3.5) * 0.12, y: 3.5 + (s.y - 3.5) * 0.12, rot: 4 }, 380, ease.inCubic)));
  shake(8);
  spark(cx(3.5), cy(3.5), '#63e6c9', 40, { speed: 0.5, size: 26 });
  await Promise.all(
    moves.map((m) => {
      const s = game.sprites.get(m.id);
      return tween(s, { x: m.toC, y: m.toR, rot: 0 }, 520, ease.outBack);
    }),
  );
}

// ---------------------------------------------------------------------------
// Words on screen

function comboWord(combo) {
  const word = COMBO_WORDS[Math.min(combo, COMBO_WORDS.length - 1)];
  const hue = combo >= 5 ? '#ff2d5f' : combo >= 4 ? '#ff8c21' : '#eadfc8';
  bigWord(word, hue, 0.9 + Math.min(combo, 6) * 0.08);
  if (combo >= 4) {
    shake(combo * 2);
    screenFlash('#ff2d5f', 0.12);
  }
}

function bigWord(word, color, scale = 1) {
  floatText(word, L.board.x + L.board.size / 2, L.board.y + L.board.size * 0.42, {
    size: cell * 1.25 * scale,
    color,
    life: 1100,
    rise: 26,
    pop: 2.3,
    glowColor: color,
  });
}

// ---------------------------------------------------------------------------
// Level end

async function win() {
  game.over = true;
  await Promise.all(game.pending);
  const left = game.moves;
  const stars = starsFor(left, game.level.moves);
  audio.restore();
  buzz([20, 40, 20, 40, 80]);
  shake(10);
  screenFlash('#ffd98a', 0.45);
  const { x, y, w, h } = L.relic;
  for (let i = 0; i < 70; i++) {
    const edge = Math.random() * 4;
    const px = edge < 1 ? x + Math.random() * w : edge < 2 ? x + w : edge < 3 ? x + Math.random() * w : x;
    const py = edge < 1 ? y : edge < 2 ? y + Math.random() * h : edge < 3 ? y + h : y + Math.random() * h;
    spark(px, py, '#ffd98a', 1, { speed: 0.35, size: 26, life: 1200, gravity: -0.0002 });
  }
  tween(game, { restore: 1 }, 1400, ease.inOutCubic);
  game.sweep = 0;
  tween(game, { sweep: 1 }, 1600, ease.inOutCubic, 500);
  floatText('Relic restored', x + w / 2, y + h / 2, { size: Math.min(w * 0.14, 48), color: '#ffe7b0', life: 2400, rise: 10, pop: 1.8, glowColor: '#ff9d2e' });
  await wait(2300);

  if (left > 0) {
    bigWord('Requiem', '#c9a0ff', 1.1);
    await wait(500);
    const { transforms, steps } = requiem(game.state, left);
    const hud = $('hud-moves').getBoundingClientRect();
    for (const [i, tr] of transforms.entries()) {
      const s = game.sprites.get(tr.id);
      if (s) {
        s.special = tr.special;
        s.flash = 1;
        bolt(hud.left + hud.width / 2, hud.top + hud.height / 2, cx(tr.c), cy(tr.r), '#c9a0ff', 300);
        spark(cx(tr.c), cy(tr.r), '#c9a0ff', 10, { speed: 0.3, size: 24 });
      }
      audio.requiem(i);
      game.moves--;
      game.score += 150;
      updateHud();
      await wait(Math.max(60, 180 - i * 12));
    }
    await wait(250);
    await playSteps(steps, { skipTransforms: true });
  }
  await wait(500);
  const firstClear = !(progress.stars[game.index] > 0);
  progress = recordResult(progress, game.index, { stars, score: game.score });
  store(SAVE_KEY, JSON.stringify(progress));
  showResult(true, stars, firstClear);
}

function lose() {
  game.over = true;
  audio.lose();
  screenFlash('#c4163f', 0.4);
  shake(6);
  showResult(false, 0, false);
}

// ---------------------------------------------------------------------------
// Drawing

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawRelicFrame() {
  if (!game?.art) return;
  const { x, y, w, h } = L.relic;
  const level = game.level;
  const pad = 10;
  // frame
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 30;
  roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
  ctx.fillStyle = '#120d18';
  ctx.fill();
  ctx.restore();
  const gold = ctx.createLinearGradient(x, y - pad, x + w, y + h + pad);
  gold.addColorStop(0, '#8a6424');
  gold.addColorStop(0.5, '#e3ab4f');
  gold.addColorStop(1, '#5a3b10');
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 8);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(227,171,79,0.35)';
  roundRect(x - pad + 4, y - pad + 4, w + pad * 2 - 8, h + pad * 2 - 8, 5);
  ctx.stroke();
  for (const [px, py] of [[x - pad, y - pad], [x + w + pad, y - pad], [x - pad, y + h + pad], [x + w + pad, y + h + pad]]) {
    ctx.fillStyle = '#e3ab4f';
    ctx.beginPath();
    ctx.moveTo(px, py - 6);
    ctx.lineTo(px + 6, py);
    ctx.lineTo(px, py + 6);
    ctx.lineTo(px - 6, py);
    ctx.fill();
  }

  // ghost of the missing relic
  ctx.globalAlpha = 0.5;
  ctx.drawImage(game.ghost, x, y, w, h);
  ctx.globalAlpha = 1;

  const scale = w / game.art.width;
  const rows = level.pieces.rows;
  const cols = level.pieces.cols;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineWidth = 1.2 / scale;
  const breathe = 0.2 + 0.1 * Math.sin(realTime * 0.003);
  ctx.strokeStyle = `rgba(234,223,200,${breathe})`;
  ctx.setLineDash([4 / scale, 4 / scale]);
  for (const p of game.pieces) {
    if (game.placed.has(p.r * cols + p.c)) continue;
    piecePath(ctx, p.c * p.pw, p.r * p.ph, p.pw, p.ph, p.edges);
    ctx.stroke();
  }
  ctx.restore();

  for (const index of game.placed) {
    const p = game.pieces[index];
    ctx.drawImage(p.canvas, x + (p.c * p.pw - p.margin) * scale, y + (p.r * p.ph - p.margin) * scale, p.canvas.width * scale, p.canvas.height * scale);
    const since = realTime - (game.snaps.get(index) ?? -9999);
    if (since < 700) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - since / 700;
      const gx = x + (p.c + 0.5) * p.pw * scale;
      const gy = y + (p.r + 0.5) * p.ph * scale;
      const gs = p.pw * scale * 2.2;
      ctx.drawImage(glow('#ffd98a'), gx - gs / 2, gy - gs / 2, gs, gs);
      ctx.restore();
    }
  }

  if (game.restore > 0) {
    // the seams heal as the full painting fades in over the fragments
    ctx.globalAlpha = game.restore;
    ctx.drawImage(game.art, x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(realTime * 0.004);
    ctx.drawImage(glow('#ffb347'), x - w * 0.3, y - h * 0.3, w * 1.6, h * 1.6);
    ctx.restore();
  }
  if (game.sweep >= 0 && game.sweep < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const sx = x - w * 0.5 + game.sweep * w * 2;
    const band = ctx.createLinearGradient(sx - w * 0.25, y, sx + w * 0.25, y + h * 0.3);
    band.addColorStop(0, 'rgba(255,240,200,0)');
    band.addColorStop(0.5, 'rgba(255,240,200,0.55)');
    band.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // engraved plate
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `15px ${SMALLCAPS}`;
  ctx.fillStyle = '#b9a98e';
  const plateY = y + h + pad + 15;
  ctx.fillText(`${NUMERALS[game.index]} · ${level.name}`, x + w / 2, plateY);
}

function drawBoard() {
  const { x, y, size } = L.board;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 40;
  roundRect(x - 8, y - 8, size + 16, size + 16, 12);
  ctx.fillStyle = '#100b15';
  ctx.fill();
  ctx.restore();
  roundRect(x - 8, y - 8, size + 16, size + 16, 12);
  ctx.strokeStyle = 'rgba(227,171,79,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      ctx.fillStyle = (r + c) % 2 ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
    }
  }
  const seals = game.state.seals;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!seals[r][c]) continue;
      const pulse = 0.5 + 0.5 * Math.sin(realTime * 0.004 + r * 0.7 + c * 0.9);
      const px = x + c * cell;
      const py = y + r * cell;
      ctx.fillStyle = `rgba(40,150,130,${0.14 + pulse * 0.1})`;
      ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      ctx.save();
      const inset = cell * 0.2;
      piecePath(ctx, px + inset, py + inset, cell - inset * 2, cell - inset * 2, { top: 1, right: 1, bottom: -1, left: -1 });
      ctx.strokeStyle = `rgba(99,230,201,${0.45 + pulse * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = `rgba(99,230,201,${0.5 + pulse * 0.3})`;
      for (const [dx, dy] of [[3, 3], [cell - 3, 3], [3, cell - 3], [cell - 3, cell - 3]]) {
        ctx.beginPath();
        ctx.arc(px + dx, py + dy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawSpecialOverlay(s, px, py, size) {
  const t = realTime;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const color = s.type >= 0 ? GEMS[s.type].glow : '#b061ff';
  if (s.special === 'row' || s.special === 'col') {
    ctx.translate(px, py);
    if (s.special === 'col') ctx.rotate(Math.PI / 2);
    const shimmer = 0.6 + 0.4 * Math.sin(t * 0.012);
    for (const off of [-0.13, 0.13]) {
      const g = ctx.createLinearGradient(-size * 0.48, 0, size * 0.48, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${0.75 * shimmer})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-size * 0.48, off * size - size * 0.03, size * 0.96, size * 0.06);
    }
    ctx.fillStyle = color;
    for (const dir of [-1, 1]) {
      const ax = dir * (size * 0.4 + Math.sin(t * 0.01) * size * 0.03);
      ctx.beginPath();
      ctx.moveTo(ax + dir * size * 0.08, 0);
      ctx.lineTo(ax, -size * 0.07);
      ctx.lineTo(ax, size * 0.07);
      ctx.fill();
    }
  } else if (s.special === 'bomb') {
    // a crown of thorns turning slowly around the gem
    ctx.translate(px, py);
    ctx.rotate(t * 0.0015);
    ctx.fillStyle = color;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(size * 0.34, -size * 0.06);
      ctx.lineTo(size * 0.5, 0);
      ctx.lineTo(size * 0.34, size * 0.06);
      ctx.fill();
      ctx.restore();
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.008);
    ctx.globalAlpha = 0.35 + pulse * 0.4;
    ctx.drawImage(glow(color), -size * 0.5, -size * 0.5, size, size);
  }
  ctx.restore();
}

function drawVoidEye(s, px, py, size) {
  ctx.drawImage(voidOrb, px - size / 2, py - size / 2, size, size);
  const t = realTime;
  ctx.save();
  ctx.translate(px, py);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(176,97,255,0.8)';
  ctx.lineWidth = size * 0.035;
  for (let i = 0; i < 3; i++) {
    const a = t * 0.002 * (i % 2 ? -1 : 1) + i * 2.1;
    ctx.beginPath();
    ctx.arc(0, 0, size * (0.4 + i * 0.03), a, a + 1.4);
    ctx.stroke();
  }
  ctx.restore();
  // the eye: it looks at your finger, and sometimes blinks
  const blinkPhase = (t + s.id * 997) % 4200;
  const open = blinkPhase < 140 ? Math.abs(blinkPhase - 70) / 70 : 1;
  const ew = size * 0.26;
  const eh = size * 0.15 * open;
  ctx.save();
  ctx.translate(px, py);
  ctx.beginPath();
  ctx.moveTo(-ew, 0);
  ctx.quadraticCurveTo(0, -eh * 1.6, ew, 0);
  ctx.quadraticCurveTo(0, eh * 1.6, -ew, 0);
  ctx.fillStyle = '#efe4cf';
  ctx.fill();
  ctx.clip();
  let lx = 0;
  let ly = 0;
  if (pointer.x >= 0) {
    const dx = pointer.x - px;
    const dy = pointer.y - py;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / (size * 2));
    lx = (dx / d) * ew * 0.45 * k;
    ly = (dy / d) * eh * 0.4 * k;
  } else {
    lx = Math.sin(t * 0.0013 + s.id) * ew * 0.4;
  }
  ctx.fillStyle = '#c4163f';
  ctx.beginPath();
  ctx.arc(lx, ly, size * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#050000';
  ctx.beginPath();
  ctx.ellipse(lx, ly, size * 0.025, size * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGems() {
  const { x, y, size } = L.board;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y - 2, size + 8, size + 6);
  ctx.clip();
  const hintIds = new Set();
  if (game.hint) for (const h of game.hint) {
    const tile = game.state.board[h.r][h.c];
    if (tile) hintIds.add(tile.id);
  }
  const sel = game.selected ? game.state.board[game.selected.r][game.selected.c]?.id : null;
  for (const s of game.sprites.values()) {
    if (s.y < -1.2 || s.a <= 0) continue;
    const px = x + (s.x + 0.5) * cell;
    const py = y + (s.y + 0.5) * cell;
    let scale = s.s;
    let rot = s.rot;
    if (s.id === sel) scale *= 1.1 + Math.sin(realTime * 0.012) * 0.04;
    if (hintIds.has(s.id)) rot += Math.sin(realTime * 0.02) * 0.18;
    const size = cell * scale;
    ctx.save();
    ctx.globalAlpha = s.a;
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.scale(s.sx, s.sy);
    if (s.special === 'void') {
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = s.a;
      drawVoidEye(s, px, py, size);
    } else {
      ctx.drawImage(gemSprites[s.type], -size / 2, -size / 2, size, size);
      ctx.restore();
      ctx.save();
      if (s.special) drawSpecialOverlay(s, px, py, size);
    }
    ctx.restore();
    if (s.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = s.flash;
      ctx.drawImage(glow('#ffffff'), px - size * 0.6, py - size * 0.6, size * 1.2, size * 1.2);
      ctx.restore();
    }
    if (hintIds.has(s.id)) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(realTime * 0.01);
      ctx.drawImage(glow('#ffd98a'), px - cell * 0.7, py - cell * 0.7, cell * 1.4, cell * 1.4);
      ctx.restore();
    }
  }
  ctx.restore();

  if (game.selected) {
    const { r, c } = game.selected;
    const pulse = 0.6 + 0.4 * Math.sin(realTime * 0.01);
    ctx.strokeStyle = `rgba(227,171,79,${pulse})`;
    ctx.lineWidth = 2;
    roundRect(x + c * cell + 2, y + r * cell + 2, cell - 4, cell - 4, 8);
    ctx.stroke();
  }
}

function drawEffects() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of fx) {
    const k = f.life / f.max;
    if (f.kind === 'ring') {
      ctx.globalAlpha = k;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = f.width * k + 0.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius * (1 - k * k), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.kind === 'beam') {
      const { x, y, size } = L.board;
      const thick = cell * (0.2 + 0.9 * k * k);
      ctx.globalAlpha = k;
      const pos = (f.horizontal ? y : x) + (f.index + 0.5) * cell;
      const g = f.horizontal
        ? ctx.createLinearGradient(0, pos - thick, 0, pos + thick)
        : ctx.createLinearGradient(pos - thick, 0, pos + thick, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, f.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      if (f.horizontal) ctx.fillRect(x - cell, pos - thick, size + cell * 2, thick * 2);
      else ctx.fillRect(pos - thick, y - cell, thick * 2, size + cell * 2);
      ctx.fillStyle = '#ffffff';
      const core = Math.max(1, thick * 0.12);
      if (f.horizontal) ctx.fillRect(x - cell, pos - core, size + cell * 2, core * 2);
      else ctx.fillRect(pos - core, y - cell, core * 2, size + cell * 2);
    } else if (f.kind === 'bolt') {
      ctx.globalAlpha = k;
      ctx.lineJoin = 'round';
      for (const [width, color] of [[7, f.color], [2, '#ffffff']]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        f.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }
    }
  }
  for (const p of parts) {
    if (p.kind !== 'glow') continue;
    const k = p.life / p.max;
    ctx.globalAlpha = k;
    const s = p.size * (0.4 + k * 0.6);
    ctx.drawImage(p.img, p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.restore();
  for (const p of parts) {
    if (p.kind !== 'shard') continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.lineTo(p.size * 0.6, p.size * 0.5);
    ctx.lineTo(-p.size * 0.5, p.size * 0.4);
    ctx.fill();
    ctx.restore();
  }
}

function drawFlights() {
  if (!game?.pieces) return;
  const scale = L.relic.w / game.art.width;
  for (const f of game.flights) {
    const piece = game.pieces[f.index];
    const pos = flightPos(f);
    const w = piece.canvas.width * scale * pos.scale;
    const h = piece.canvas.height * scale * pos.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    const gs = Math.max(w, h) * 1.5;
    ctx.drawImage(glow('#63e6c9'), pos.x - gs / 2, pos.y - gs / 2, gs, gs);
    ctx.restore();
    if (f.p > 0 && Math.random() < 0.6) spark(pos.x, pos.y, '#63e6c9', 1, { speed: 0.05, size: 18, life: 450, gravity: 0 });
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(pos.rot);
    ctx.drawImage(piece.canvas, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

function drawTexts() {
  for (const t of texts) {
    const age = t.max - t.life;
    const k = t.life / t.max;
    const popIn = Math.min(1, age / 180);
    const scale = 1 + (t.pop - 1) * (1 - ease.outBack(popIn));
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2.5) * Math.min(1, popIn * 2);
    ctx.translate(t.x, t.y - (1 - k) * t.rise);
    ctx.scale(scale, scale);
    ctx.font = `${Math.round(t.size)}px ${t.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (t.glowColor) {
      ctx.shadowColor = t.glowColor;
      ctx.shadowBlur = t.size * 0.5;
    }
    ctx.lineWidth = Math.max(2, t.size * 0.08);
    ctx.strokeStyle = 'rgba(8,4,10,0.85)';
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
}

function drawTitleEye() {
  const R = Math.min(W, H) * 0.2;
  const px = W / 2;
  const py = H * 0.3;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 + 0.1 * Math.sin(realTime * 0.002);
  ctx.drawImage(glow('#6a22c9'), px - R * 2, py - R * 2, R * 4, R * 4);
  ctx.restore();
  drawVoidEye({ id: 7 }, px, py, R * 2.2);
}

function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (screen === 'play' && game && !game.over && game.moves <= 3) {
    const beat = Math.max(0, Math.sin(realTime * 0.0065)) ** 6;
    const red = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    red.addColorStop(0, 'rgba(196,22,63,0)');
    red.addColorStop(1, `rgba(196,22,63,${0.15 + beat * 0.35})`);
    ctx.fillStyle = red;
    ctx.fillRect(0, 0, W, H);
  }
  if (flash.a > 0.001) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = flash.a;
    ctx.fillStyle = flash.color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

let last = performance.now();
function frame(now) {
  const raw = Math.min(50, now - last);
  last = now;
  realTime += raw;
  const frozen = realTime < freezeUntil;
  const dt = frozen ? raw * 0.04 : raw;
  updateTweens(dt);
  updateEffects(dt);
  flash.a *= Math.pow(0.9, raw / 16);
  shakeAmp *= Math.pow(0.86, raw / 16);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackground(raw);
  const sx = (Math.random() - 0.5) * shakeAmp;
  const sy = (Math.random() - 0.5) * shakeAmp;
  ctx.save();
  ctx.translate(sx, sy);
  if (screen === 'title') drawTitleEye();
  if (screen === 'play' && game) {
    for (const s of game.sprites.values()) if (s.flash > 0) s.flash = Math.max(0, s.flash - dt / 220);
    drawRelicFrame();
    drawBoard();
    drawGems();
    drawEffects();
    drawFlights();
    drawTexts();
    tickPlay(raw);
  } else {
    drawEffects();
    drawTexts();
  }
  ctx.restore();
  drawVignette();
  requestAnimationFrame(frame);
}

function tickPlay(dt) {
  if (game.shownScore !== game.score) {
    const diff = game.score - game.shownScore;
    game.shownScore += Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * 0.12));
    if (Math.abs(game.score - game.shownScore) < 1) game.shownScore = game.score;
    $('hud-score').textContent = game.shownScore.toLocaleString('en-US');
  }
  if (!game.busy && !game.over) {
    game.idle += dt;
    if (game.idle > 5500 && !game.hint) game.hint = findHint(game.state.board);
  }
}

// ---------------------------------------------------------------------------
// Input

function cellAt(e) {
  const c = Math.floor((e.clientX - L.board.x) / cell);
  const r = Math.floor((e.clientY - L.board.y) / cell);
  if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) return null;
  return { r, c };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  if (screen !== 'play' || !game || game.busy || game.over) return;
  const at = cellAt(e);
  if (!at) {
    game.selected = null;
    return;
  }
  game.idle = 0;
  game.hint = null;
  drag = { at, x: e.clientX, y: e.clientY, moved: false };
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // capture is best-effort
  }
});
window.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  if (!drag || drag.moved || !game) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) < cell * 0.32) return;
  drag.moved = true;
  const to = Math.abs(dx) > Math.abs(dy)
    ? { r: drag.at.r, c: drag.at.c + Math.sign(dx) }
    : { r: drag.at.r + Math.sign(dy), c: drag.at.c };
  trySwap(drag.at, to);
});
window.addEventListener('pointerup', () => {
  if (!drag || !game) {
    drag = null;
    return;
  }
  if (!drag.moved) {
    const at = drag.at;
    const sel = game.selected;
    if (sel && Math.abs(sel.r - at.r) + Math.abs(sel.c - at.c) === 1) {
      trySwap(sel, at);
    } else if (sel && sel.r === at.r && sel.c === at.c) {
      game.selected = null;
    } else {
      game.selected = at;
      audio.select();
    }
  }
  drag = null;
});

// ---------------------------------------------------------------------------
// Screens and HUD

function showScreen(name) {
  screen = name;
  // Dropping in-flight tweens strands any async turn from the previous level:
  // its promises never resolve, so it can never touch the next game.
  tweens.length = 0;
  parts.length = 0;
  fx.length = 0;
  texts.length = 0;
  $('title').hidden = name !== 'title';
  $('map').hidden = name !== 'map';
  $('hud').hidden = name !== 'play';
  $('intro').hidden = true;
  $('result').hidden = true;
  if (name === 'map') renderMap();
  if (name !== 'play') game = null;
  measure();
}

function updateHud() {
  if (!game) return;
  const moves = $('hud-moves');
  moves.textContent = game.moves;
  moves.classList.toggle('low', game.moves <= 3);
  moves.classList.remove('bump');
  void moves.offsetWidth;
  moves.classList.add('bump');
  $('hud-frags').textContent = `${game.placed.size}/${game.total}`;
}

function showIntro() {
  const { level, index } = game;
  $('intro-chapter').textContent = `Relic ${NUMERALS[index]} of ${NUMERALS[LEVELS.length - 1]}`;
  $('intro-name').textContent = level.name;
  $('intro-lore').textContent = level.lore;
  $('intro-goal').textContent = `Break ${game.total} seals in ${level.moves} moves to free every fragment.`;
  $('intro').hidden = false;
  $('intro-start').focus({ preventScroll: true });
}

$('intro-start').addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  $('intro').hidden = true;
  if (game) game.busy = false;
});

function showResult(won, stars, firstClear) {
  const finale = won && game.index === LEVELS.length - 1;
  $('result-kicker').textContent = won ? `Relic ${NUMERALS[game.index]} restored` : 'The seals held';
  $('result-title').textContent = won ? (finale ? 'The door is open' : game.level.name) : 'The dark keeps it';
  $('result-body').textContent = won
    ? finale
      ? 'Every relic is whole again. Something on the other side of the door knocks back.'
      : game.level.lore
    : `You freed ${game.placed.size} of ${game.total} fragments before your moves ran out.`;
  const starEls = $('result-stars').children;
  for (let i = 0; i < 3; i++) {
    starEls[i].classList.toggle('lit', i < stars);
    starEls[i].style.animationDelay = `${200 + i * 260}ms`;
  }
  $('result-stars').hidden = !won;
  $('result-score').textContent = game.score.toLocaleString('en-US');
  const next = $('result-next');
  next.hidden = !won || finale;
  $('result-retry').textContent = won ? 'Play again' : 'Try again';
  $('result').hidden = false;
  (won && !finale ? next : $('result-retry')).focus({ preventScroll: true });
  if (won) for (let i = 0; i < stars; i++) setTimeout(() => audio.snap(i * 2), 300 + i * 260);
  if (finale && firstClear) [0, 450, 900].forEach((ms) => setTimeout(() => audio.heartbeat(), 1600 + ms));
}

$('result-next').addEventListener('click', () => {
  audio.ui();
  startLevel(Math.min(game.index + 1, LEVELS.length - 1));
});
$('result-retry').addEventListener('click', () => {
  audio.ui();
  startLevel(game.index);
});
$('result-map').addEventListener('click', () => {
  audio.ui();
  showScreen('map');
});
$('btn-back').addEventListener('click', () => {
  audio.ui();
  showScreen('map');
});
$('btn-enter').addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  showScreen('map');
});

function syncSoundButton() {
  const btn = $('btn-sound');
  btn.setAttribute('aria-pressed', String(!audio.muted));
  btn.setAttribute('aria-label', audio.muted ? 'Turn sound on' : 'Turn sound off');
  btn.classList.toggle('off', audio.muted);
}
$('btn-sound').addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  store(MUTE_KEY, audio.muted ? '1' : '0');
  syncSoundButton();
});
syncSoundButton();

const thumbs = new Map();
function renderMap() {
  const list = $('relic-list');
  list.textContent = '';
  const restored = progress.stars.filter((s) => s > 0).length;
  $('map-progress').textContent = `${restored} of ${LEVELS.length} relics restored`;
  LEVELS.forEach((level, i) => {
    const open = i < progress.unlocked;
    const done = progress.stars[i] > 0;
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'relic';
    btn.disabled = !open;
    btn.dataset.state = done ? 'restored' : open ? 'open' : 'locked';
    const key = `${i}`;
    if (!thumbs.has(key)) {
      const art = drawRelic(i, 176, 132);
      thumbs.set(key, { art, ghost: makeGhost(art) });
    }
    const t = thumbs.get(key);
    const img = document.createElement('canvas');
    img.width = 176;
    img.height = 132;
    img.className = 'thumb';
    img.getContext('2d').drawImage(done ? t.art : t.ghost, 0, 0);
    const meta = document.createElement('span');
    meta.className = 'meta';
    const num = document.createElement('span');
    num.className = 'numeral';
    num.textContent = NUMERALS[i];
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = open ? level.name : 'Sealed';
    const status = document.createElement('span');
    status.className = 'status';
    if (done) {
      status.textContent = `${'★'.repeat(progress.stars[i])}${'☆'.repeat(3 - progress.stars[i])}  ·  best ${progress.best[i].toLocaleString('en-US')}`;
    } else {
      status.textContent = open ? `${level.pieces.rows * level.pieces.cols} fragments · ${level.moves} moves` : 'Restore the previous relic';
    }
    meta.append(num, name, status);
    btn.append(img, meta);
    btn.addEventListener('click', () => {
      audio.unlock();
      audio.ui();
      startLevel(i);
    });
    li.append(btn);
    list.append(li);
  });
}

// ---------------------------------------------------------------------------
// Boot

measure();
document.fonts?.ready.then(() => measure());
requestAnimationFrame(frame);
