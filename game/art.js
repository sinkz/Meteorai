// Procedural art for Hollow Reliquary: gem sprites, the six relic paintings,
// and the jigsaw cutter that slices a painting into interlocking fragments.
import { createRng } from './engine.js';
import { pieceEdges } from './levels.js';

export const GEMS = [
  { name: 'Blood', light: '#ff7a92', mid: '#c8123f', dark: '#3a0212', glow: '#ff2d5f' },
  { name: 'Amethyst', light: '#e1b8ff', mid: '#8a3cf0', dark: '#1e0542', glow: '#b061ff' },
  { name: 'Venom', light: '#d6ff9c', mid: '#52c22a', dark: '#0a3006', glow: '#84ff4f' },
  { name: 'Soul', light: '#c4f6ff', mid: '#2aa6e2', dark: '#04253f', glow: '#4fdcff' },
  { name: 'Bone', light: '#fffbf1', mid: '#d5c7a7', dark: '#4a4031', glow: '#fff0c4' },
  { name: 'Ember', light: '#ffe7a3', mid: '#f27a10', dark: '#461400', glow: '#ff8c21' },
];

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function gemPath(ctx, type, R) {
  ctx.beginPath();
  switch (type) {
    case 0: // blood drop
      ctx.moveTo(0, -R * 1.12);
      ctx.bezierCurveTo(R * 0.4, -R * 0.55, R * 0.92, -R * 0.12, R * 0.92, R * 0.3);
      ctx.arc(0, R * 0.3, R * 0.92, 0, Math.PI);
      ctx.bezierCurveTo(-R * 0.92, -R * 0.12, -R * 0.4, -R * 0.55, 0, -R * 1.12);
      break;
    case 1: // cut amethyst
      ctx.moveTo(-R * 0.55, -R * 0.85);
      ctx.lineTo(R * 0.55, -R * 0.85);
      ctx.lineTo(R * 1.02, -R * 0.25);
      ctx.lineTo(0, R * 1.05);
      ctx.lineTo(-R * 1.02, -R * 0.25);
      ctx.closePath();
      break;
    case 2: // venom hexagon
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      ctx.closePath();
      break;
    case 3: // soul orb
      ctx.arc(0, 0, R * 0.95, 0, Math.PI * 2);
      break;
    case 4: // bone skull
      ctx.arc(0, -R * 0.14, R * 0.86, 0, Math.PI * 2);
      ctx.moveTo(-R * 0.5, R * 0.3);
      ctx.roundRect(-R * 0.52, R * 0.3, R * 1.04, R * 0.72, R * 0.22);
      break;
    case 5: // ember star
      for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 8;
        const rr = i % 2 ? R * 0.52 : R * 1.05;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      break;
  }
}

function gemDetails(ctx, type, R, g) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (type) {
    case 1: {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = R * 0.05;
      ctx.beginPath();
      ctx.moveTo(-R * 1.02, -R * 0.25);
      ctx.lineTo(R * 1.02, -R * 0.25);
      ctx.moveTo(-R * 0.55, -R * 0.85);
      ctx.lineTo(-R * 0.25, -R * 0.25);
      ctx.lineTo(0, R * 1.05);
      ctx.lineTo(R * 0.25, -R * 0.25);
      ctx.lineTo(R * 0.55, -R * 0.85);
      ctx.stroke();
      break;
    }
    case 2: {
      ctx.strokeStyle = 'rgba(230,255,200,0.3)';
      ctx.lineWidth = R * 0.05;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        ctx.lineTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55);
      }
      ctx.closePath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        ctx.moveTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55);
        ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      ctx.stroke();
      break;
    }
    case 3: {
      // a trapped wisp spiralling inside the orb
      ctx.strokeStyle = 'rgba(225,250,255,0.75)';
      ctx.lineWidth = R * 0.1;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = i * 0.32;
        const rr = R * 0.08 + i * R * 0.0145;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case 4: {
      ctx.fillStyle = g.dark;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * R * 0.34, -R * 0.08, R * 0.24, R * 0.28, s * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(0, R * 0.2);
      ctx.lineTo(-R * 0.11, R * 0.42);
      ctx.lineTo(R * 0.11, R * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = g.dark;
      ctx.lineWidth = R * 0.07;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(i * R * 0.16, R * 0.66);
        ctx.lineTo(i * R * 0.16, R * 0.95);
      }
      ctx.stroke();
      // a faint red light inside the sockets
      ctx.fillStyle = 'rgba(255,40,70,0.55)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * R * 0.34, -R * 0.04, R * 0.07, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 5: {
      ctx.fillStyle = 'rgba(255,245,200,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 0: {
      ctx.strokeStyle = 'rgba(255,200,210,0.25)';
      ctx.lineWidth = R * 0.06;
      ctx.beginPath();
      ctx.arc(0, R * 0.3, R * 0.62, 0.3, Math.PI - 0.3);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// A gem sprite is drawn once per type and cell size, then blitted every frame.
export function makeGemSprite(type, size) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = GEMS[type];
  const R = size * 0.33;
  ctx.translate(size / 2, size / 2 + (type === 0 ? -R * 0.06 : 0));

  ctx.save();
  ctx.shadowColor = g.glow;
  ctx.shadowBlur = R * 0.55;
  gemPath(ctx, type, R);
  ctx.fillStyle = g.mid;
  ctx.fill();
  ctx.restore();

  gemPath(ctx, type, R);
  ctx.lineWidth = R * 0.16;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = g.dark;
  ctx.stroke();

  const body = ctx.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.05, 0, 0, R * 1.35);
  body.addColorStop(0, g.light);
  body.addColorStop(0.45, g.mid);
  body.addColorStop(1, g.dark);
  gemPath(ctx, type, R);
  ctx.fillStyle = body;
  ctx.fill();

  gemDetails(ctx, type, R, g);

  ctx.save();
  gemPath(ctx, type, R);
  ctx.clip();
  const spec = ctx.createRadialGradient(-R * 0.35, -R * 0.5, 0, -R * 0.35, -R * 0.5, R * 0.55);
  spec.addColorStop(0, 'rgba(255,255,255,0.75)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(-R * 0.38, -R * 0.5, R * 0.12, R * 0.06, -0.6, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// The void eye's body: a black orb with a violet rim. The eye itself is drawn live.
export function makeVoidOrb(size) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const R = size * 0.36;
  ctx.translate(size / 2, size / 2);
  ctx.save();
  ctx.shadowColor = '#a24bff';
  ctx.shadowBlur = R * 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
  g.addColorStop(0, '#000000');
  g.addColorStop(0.7, '#12031f');
  g.addColorStop(1, '#6a22c9');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(210,160,255,0.6)';
  ctx.lineWidth = R * 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.97, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

export function makeGlow(color, size = 64) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// ---------------------------------------------------------------------------
// Relic paintings. Each painter fills a w x h canvas; composition scales with min(w, h).

function backdrop(ctx, w, h, inner, outer, rng) {
  const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // grain
  for (let i = 0; i < (w * h) / 90; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(rng() * w, rng() * h, 1.5, 1.5);
  }
}

function vignette(ctx, w, h, strength = 0.75) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.58);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function glowDot(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function paintMoon(ctx, w, h, rng) {
  backdrop(ctx, w, h, '#2a2352', '#07061a', rng);
  const m = Math.min(w, h);
  for (let i = 0; i < 140; i++) {
    const x = rng() * w;
    const y = rng() * h * 0.75;
    const r = rng() * m * 0.006 + 0.4;
    ctx.fillStyle = `rgba(235,230,255,${0.3 + rng() * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const cx = w / 2;
  const cy = h * 0.44;
  const R = m * 0.3;
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, cy, R * 2.1, 'rgba(160,150,255,0.35)');
  ctx.globalCompositeOperation = 'source-over';

  const moon = makeCanvas(R * 2.4, R * 2.4);
  const mc = moon.getContext('2d');
  mc.translate(R * 1.2, R * 1.2);
  const body = mc.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
  body.addColorStop(0, '#fbf5e4');
  body.addColorStop(1, '#a89878');
  mc.fillStyle = body;
  mc.beginPath();
  mc.arc(0, 0, R, 0, Math.PI * 2);
  mc.fill();
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * R * 0.8;
    mc.fillStyle = 'rgba(90,75,60,0.28)';
    mc.beginPath();
    mc.arc(Math.cos(a) * d, Math.sin(a) * d, R * (0.04 + rng() * 0.12), 0, Math.PI * 2);
    mc.fill();
  }
  mc.globalCompositeOperation = 'destination-out';
  mc.beginPath();
  mc.arc(R * 0.42, -R * 0.16, R * 0.86, 0, Math.PI * 2);
  mc.fill();
  ctx.drawImage(moon, cx - R * 1.2, cy - R * 1.2);

  // the watcher inside the hollow
  const ex = cx + R * 0.34;
  const ey = cy - R * 0.1;
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, ex, ey, R * 0.45, 'rgba(255,40,70,0.45)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ff3355';
  ctx.beginPath();
  ctx.ellipse(ex, ey, R * 0.22, R * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0006';
  ctx.beginPath();
  ctx.ellipse(ex, ey, R * 0.03, R * 0.032, 0, 0, Math.PI * 2);
  ctx.fill();

  // graveyard
  ctx.fillStyle = '#05040c';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.8);
  ctx.quadraticCurveTo(w * 0.3, h * 0.7, w * 0.55, h * 0.8);
  ctx.quadraticCurveTo(w * 0.8, h * 0.88, w, h * 0.76);
  ctx.lineTo(w, h);
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.3 + rng() * 0.4) * (w / 9);
    const base = h * (0.8 + rng() * 0.08);
    const s = m * (0.03 + rng() * 0.025);
    if (rng() < 0.5) {
      ctx.fillRect(x - s * 0.15, base - s * 1.6, s * 0.3, s * 1.6);
      ctx.fillRect(x - s * 0.6, base - s * 1.2, s * 1.2, s * 0.28);
    } else {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.5, base);
      ctx.lineTo(x - s * 0.5, base - s);
      ctx.arc(x, base - s, s * 0.5, Math.PI, 0);
      ctx.lineTo(x + s * 0.5, base);
      ctx.fill();
    }
  }
  const mist = ctx.createLinearGradient(0, h * 0.7, 0, h);
  mist.addColorStop(0, 'rgba(120,110,180,0)');
  mist.addColorStop(0.6, 'rgba(120,110,180,0.18)');
  mist.addColorStop(1, 'rgba(120,110,180,0.05)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
}

function paintEye(ctx, w, h, rng) {
  backdrop(ctx, w, h, '#4a0b1c', '#0a0206', rng);
  const m = Math.min(w, h);
  const cx = w / 2;
  const cy = h * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255,190,120,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * m * 0.3, Math.sin(a) * m * 0.3);
    ctx.lineTo(Math.cos(a) * m, Math.sin(a) * m);
    ctx.stroke();
  }
  const ew = m * 0.42;
  const eh = m * 0.24;
  const almond = () => {
    ctx.beginPath();
    ctx.moveTo(-ew, 0);
    ctx.quadraticCurveTo(0, -eh * 1.6, ew, 0);
    ctx.quadraticCurveTo(0, eh * 1.6, -ew, 0);
  };
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, 0, 0, ew * 1.4, 'rgba(255,60,60,0.25)');
  ctx.globalCompositeOperation = 'source-over';
  almond();
  const sclera = ctx.createRadialGradient(0, 0, eh * 0.3, 0, 0, ew);
  sclera.addColorStop(0, '#f1e6d2');
  sclera.addColorStop(1, '#b86a6a');
  ctx.fillStyle = sclera;
  ctx.fill();
  ctx.save();
  almond();
  ctx.clip();
  ctx.strokeStyle = 'rgba(170,10,30,0.55)';
  for (let i = 0; i < 18; i++) {
    const side = rng() < 0.5 ? -1 : 1;
    let x = side * ew;
    let y = (rng() - 0.5) * eh;
    ctx.lineWidth = 0.6 + rng() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x -= side * ew * (0.06 + rng() * 0.06);
      y += (rng() - 0.5) * eh * 0.25;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const ir = eh * 0.95;
  const iris = ctx.createRadialGradient(0, 0, ir * 0.2, 0, 0, ir);
  iris.addColorStop(0, '#ffd66b');
  iris.addColorStop(0.5, '#c2410c');
  iris.addColorStop(1, '#3b0508');
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(0, 0, ir, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,0,0,0.5)';
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * ir * 0.3, Math.sin(a) * ir * 0.3);
    ctx.lineTo(Math.cos(a) * ir, Math.sin(a) * ir);
    ctx.stroke();
  }
  ctx.fillStyle = '#050000';
  ctx.beginPath();
  ctx.ellipse(0, 0, ir * 0.18, ir * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-ir * 0.35, -ir * 0.4, ir * 0.16, ir * 0.1, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  almond();
  ctx.lineWidth = m * 0.022;
  ctx.strokeStyle = '#1b0206';
  ctx.stroke();
  ctx.lineWidth = m * 0.008;
  ctx.lineCap = 'round';
  for (let i = 0; i < 13; i++) {
    const t = (i + 0.5) / 13;
    const x = -ew + t * ew * 2;
    const y = -(1 - (2 * t - 1) ** 2) * eh * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x * 1.12, y - eh * 0.35);
    ctx.stroke();
  }
  // tears of blood
  for (const [tx, len] of [[-ew * 0.35, 0.9], [ew * 0.05, 1.3], [ew * 0.4, 0.7]]) {
    const ty = eh * 0.65;
    const streak = ctx.createLinearGradient(0, ty, 0, ty + m * 0.3 * len);
    streak.addColorStop(0, 'rgba(160,0,20,0.9)');
    streak.addColorStop(1, 'rgba(160,0,20,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(tx - m * 0.006, ty, m * 0.012, m * 0.3 * len);
    ctx.fillStyle = '#b3001f';
    ctx.beginPath();
    const dy = ty + m * 0.3 * len;
    ctx.moveTo(tx, dy - m * 0.03);
    ctx.quadraticCurveTo(tx + m * 0.02, dy, tx, dy + m * 0.018);
    ctx.quadraticCurveTo(tx - m * 0.02, dy, tx, dy - m * 0.03);
    ctx.fill();
  }
  ctx.restore();
}

function paintCrown(ctx, w, h, rng) {
  backdrop(ctx, w, h, '#1b3326', '#020604', rng);
  const m = Math.min(w, h);
  const cx = w / 2;
  const cy = h * 0.52;
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, cy - m * 0.12, m * 0.55, 'rgba(255,200,90,0.22)');
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255,220,140,0.35)';
  ctx.lineWidth = m * 0.01;
  ctx.beginPath();
  ctx.ellipse(cx, cy - m * 0.3, m * 0.3, m * 0.07, 0, 0, Math.PI * 2);
  ctx.stroke();

  const bw = m * 0.34;
  const gold = ctx.createLinearGradient(0, cy - m * 0.3, 0, cy + m * 0.15);
  gold.addColorStop(0, '#fff0b0');
  gold.addColorStop(0.45, '#d59a2a');
  gold.addColorStop(1, '#4a2805');
  ctx.fillStyle = gold;
  ctx.strokeStyle = '#2a1402';
  ctx.lineWidth = m * 0.012;
  ctx.beginPath();
  ctx.moveTo(cx - bw, cy + m * 0.1);
  const spikes = 5;
  for (let i = 0; i <= spikes * 2; i++) {
    const x = cx - bw + (i / (spikes * 2)) * bw * 2;
    const tall = i % 2 === 1;
    const lift = tall ? (i === spikes ? m * 0.3 : m * 0.22) : m * 0.06;
    ctx.lineTo(x, cy - lift);
  }
  ctx.lineTo(cx + bw, cy + m * 0.1);
  ctx.quadraticCurveTo(cx, cy + m * 0.18, cx - bw, cy + m * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(40,20,0,0.45)';
  ctx.beginPath();
  ctx.moveTo(cx - bw, cy + m * 0.02);
  ctx.quadraticCurveTo(cx, cy + m * 0.1, cx + bw, cy + m * 0.02);
  ctx.lineTo(cx + bw, cy + m * 0.1);
  ctx.quadraticCurveTo(cx, cy + m * 0.18, cx - bw, cy + m * 0.1);
  ctx.fill();
  const jewels = ['#c8123f', '#8a3cf0', '#2aa6e2', '#8a3cf0', '#c8123f'];
  jewels.forEach((color, i) => {
    const x = cx - bw + ((i * 2 + 1) / (spikes * 2)) * bw * 2;
    const y = cy - (i === 2 ? m * 0.3 : m * 0.22) + m * 0.035;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, m * 0.022, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(x - m * 0.007, y - m * 0.007, m * 0.006, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#6b0019';
  ctx.beginPath();
  ctx.arc(cx, cy + m * 0.07, m * 0.04, 0, Math.PI * 2);
  ctx.fill();

  // thorn vines
  ctx.strokeStyle = '#0b1a0c';
  ctx.fillStyle = '#0b1a0c';
  ctx.lineCap = 'round';
  for (let v = 0; v < 3; v++) {
    ctx.lineWidth = m * (0.012 + v * 0.003);
    const pts = [];
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const x = cx - bw * 1.35 + t * bw * 2.7;
      const y = cy + Math.sin(t * Math.PI * 3 + v * 2.1) * m * 0.12 - m * 0.02 * v;
      pts.push([x, y]);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    for (let i = 2; i < pts.length - 1; i += 3) {
      const [x, y] = pts[i];
      const dir = rng() < 0.5 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x - m * 0.01, y);
      ctx.lineTo(x + m * 0.01, y);
      ctx.lineTo(x + dir * m * 0.006, y + dir * m * 0.04);
      ctx.fill();
      if (rng() < 0.25) {
        ctx.save();
        ctx.fillStyle = '#9b0022';
        ctx.beginPath();
        ctx.arc(x, y + m * 0.05, m * 0.008, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

function paintBell(ctx, w, h, rng) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1a6b70');
  bg.addColorStop(0.5, '#08303a');
  bg.addColorStop(1, '#010608');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const m = Math.min(w, h);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = w * (0.1 + rng() * 0.8);
    const spread = m * (0.05 + rng() * 0.1);
    const ray = ctx.createLinearGradient(0, 0, 0, h);
    ray.addColorStop(0, 'rgba(160,255,240,0.14)');
    ray.addColorStop(1, 'rgba(160,255,240,0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x - spread * 0.3, 0);
    ctx.lineTo(x + spread * 0.3, 0);
    ctx.lineTo(x + spread * 2 - m * 0.2, h);
    ctx.lineTo(x - spread * 2 - m * 0.2, h);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  const cx = w / 2;
  const top = h * 0.2;
  const bh = m * 0.5;
  const bw = m * 0.3;
  ctx.strokeStyle = '#0b1e20';
  ctx.lineWidth = m * 0.012;
  for (let y = 0; y < top; y += m * 0.035) {
    ctx.beginPath();
    ctx.ellipse(cx, y + m * 0.017, m * 0.012, m * 0.02, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const bronze = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
  bronze.addColorStop(0, '#2c1a0a');
  bronze.addColorStop(0.35, '#b98a4a');
  bronze.addColorStop(0.55, '#e7c287');
  bronze.addColorStop(1, '#3a220c');
  ctx.fillStyle = bronze;
  ctx.beginPath();
  ctx.moveTo(cx - bw * 0.45, top + bh * 0.08);
  ctx.bezierCurveTo(cx - bw * 0.5, top - bh * 0.06, cx + bw * 0.5, top - bh * 0.06, cx + bw * 0.45, top + bh * 0.08);
  ctx.bezierCurveTo(cx + bw * 0.6, top + bh * 0.5, cx + bw * 0.7, top + bh * 0.8, cx + bw * 1.05, top + bh);
  ctx.quadraticCurveTo(cx, top + bh * 1.12, cx - bw * 1.05, top + bh);
  ctx.bezierCurveTo(cx - bw * 0.7, top + bh * 0.8, cx - bw * 0.6, top + bh * 0.5, cx - bw * 0.45, top + bh * 0.08);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(70,190,160,${0.15 + rng() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(cx + (rng() - 0.5) * bw * 2, top + rng() * bh, m * (0.02 + rng() * 0.05), m * (0.01 + rng() * 0.03), rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40,20,5,0.6)';
  ctx.lineWidth = m * 0.008;
  for (const f of [0.3, 0.75, 0.85]) {
    ctx.beginPath();
    ctx.moveTo(cx - bw * 1.2, top + bh * f);
    ctx.quadraticCurveTo(cx, top + bh * (f + 0.05), cx + bw * 1.2, top + bh * f);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#1a0f05';
  ctx.beginPath();
  ctx.ellipse(cx, top + bh * 1.02, bw * 0.9, bh * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6d4b22';
  ctx.beginPath();
  ctx.arc(cx + bw * 0.1, top + bh * 1.1, m * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,255,250,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = m * (0.004 + rng() * 0.012);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#020a0a';
  for (let i = 0; i < 14; i++) {
    const x = rng() * w;
    const hh = h * (0.12 + rng() * 0.2);
    ctx.beginPath();
    ctx.moveTo(x - m * 0.015, h);
    ctx.quadraticCurveTo(x + (rng() - 0.5) * m * 0.2, h - hh * 0.6, x + (rng() - 0.5) * m * 0.08, h - hh);
    ctx.quadraticCurveTo(x + (rng() - 0.5) * m * 0.2, h - hh * 0.4, x + m * 0.015, h);
    ctx.fill();
  }
}

function paintHeart(ctx, w, h, rng) {
  backdrop(ctx, w, h, '#3a1106', '#050101', rng);
  const m = Math.min(w, h);
  const cx = w / 2;
  const cy = h * 0.47;
  const s = m * 0.36;
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, cy, s * 1.9, 'rgba(255,110,20,0.35)');
  ctx.globalCompositeOperation = 'source-over';
  const heart = () => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.95);
    ctx.bezierCurveTo(cx - s * 1.25, cy + s * 0.1, cx - s * 1.05, cy - s * 0.95, cx, cy - s * 0.45);
    ctx.bezierCurveTo(cx + s * 1.05, cy - s * 0.95, cx + s * 1.25, cy + s * 0.1, cx, cy + s * 0.95);
  };
  heart();
  const coal = ctx.createRadialGradient(cx - s * 0.3, cy - s * 0.3, s * 0.1, cx, cy, s * 1.2);
  coal.addColorStop(0, '#3b2a24');
  coal.addColorStop(1, '#080404');
  ctx.fillStyle = coal;
  ctx.fill();
  ctx.save();
  heart();
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  const crack = (x, y, a, len, depth) => {
    if (depth <= 0 || len < 2) return;
    const nx = x + Math.cos(a) * len;
    const ny = y + Math.sin(a) * len;
    ctx.lineWidth = depth * m * 0.004;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    crack(nx, ny, a + (rng() - 0.5) * 1.1, len * 0.78, depth - 1);
    if (rng() < 0.45) crack(nx, ny, a + (rng() - 0.5) * 2.2, len * 0.6, depth - 1);
  };
  ctx.shadowColor = '#ff7a00';
  ctx.shadowBlur = m * 0.03;
  ctx.strokeStyle = '#ffb347';
  for (let i = 0; i < 7; i++) crack(cx, cy, (i / 7) * Math.PI * 2 + rng(), s * 0.26, 6);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, cy, s * 0.3, 'rgba(255,200,80,0.8)');
  ctx.restore();
  ctx.strokeStyle = '#140806';
  ctx.lineWidth = m * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, cy - s * 0.5);
  ctx.quadraticCurveTo(cx - s * 0.3, cy - s * 0.95, cx - s * 0.05, cy - s * 1.05);
  ctx.moveTo(cx + s * 0.25, cy - s * 0.55);
  ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 1.0, cx + s * 0.6, cy - s * 0.95);
  ctx.stroke();
  for (let i = 0; i < 90; i++) {
    const hot = rng() < 0.3;
    ctx.fillStyle = hot ? `rgba(255,${120 + rng() * 100},40,${0.5 + rng() * 0.5})` : `rgba(150,140,135,${0.2 + rng() * 0.3})`;
    ctx.beginPath();
    ctx.arc(rng() * w, rng() * h, m * (hot ? 0.004 : 0.006) * (0.5 + rng()), 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintDoor(ctx, w, h, rng) {
  backdrop(ctx, w, h, '#2a1745', '#030108', rng);
  const m = Math.min(w, h);
  const cx = w / 2;
  const base = h * 0.84;
  const dw = m * 0.2;
  const dh = m * 0.55;
  const arch = (hw, top, bottom) => {
    ctx.beginPath();
    ctx.moveTo(cx - hw, bottom);
    ctx.lineTo(cx - hw, top + hw);
    ctx.quadraticCurveTo(cx - hw, top, cx, top - hw * 0.6);
    ctx.quadraticCurveTo(cx + hw, top, cx + hw, top + hw);
    ctx.lineTo(cx + hw, bottom);
    ctx.closePath();
  };
  arch(dw * 1.55, base - dh - dw * 0.3, base);
  const stone = ctx.createLinearGradient(0, base - dh, 0, base);
  stone.addColorStop(0, '#5b4f6e');
  stone.addColorStop(1, '#1d1726');
  ctx.fillStyle = stone;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.2;
  for (let y = base; y > base - dh; y -= m * 0.05) {
    ctx.beginPath();
    ctx.moveTo(cx - dw * 1.55, y);
    ctx.lineTo(cx - dw, y);
    ctx.moveTo(cx + dw, y);
    ctx.lineTo(cx + dw * 1.55, y);
    ctx.stroke();
  }
  arch(dw, base - dh, base);
  const wood = ctx.createLinearGradient(cx - dw, 0, cx + dw, 0);
  wood.addColorStop(0, '#1a0d08');
  wood.addColorStop(0.5, '#3b2012');
  wood.addColorStop(1, '#150a06');
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.save();
  arch(dw, base - dh, base);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let x = cx - dw; x < cx + dw; x += dw / 3) {
    ctx.beginPath();
    ctx.moveTo(x, base - dh - dw);
    ctx.lineTo(x, base);
    ctx.stroke();
  }
  ctx.fillStyle = '#26222c';
  for (const f of [0.25, 0.7]) ctx.fillRect(cx - dw, base - dh * f, dw * 2, m * 0.018);
  ctx.restore();
  ctx.strokeStyle = '#6d6378';
  ctx.lineWidth = m * 0.008;
  ctx.beginPath();
  ctx.arc(cx - dw * 0.5, base - dh * 0.45, m * 0.025, 0, Math.PI * 2);
  ctx.stroke();

  // light escaping through the gap
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gx = cx + dw * 0.92;
  const crack = ctx.createLinearGradient(gx - m * 0.02, 0, gx + m * 0.02, 0);
  crack.addColorStop(0, 'rgba(255,240,200,0)');
  crack.addColorStop(0.5, 'rgba(255,245,215,1)');
  crack.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = crack;
  ctx.fillRect(gx - m * 0.02, base - dh + dw * 0.4, m * 0.04, dh - dw * 0.4);
  glowDot(ctx, gx, base - dh * 0.5, m * 0.25, 'rgba(255,220,160,0.35)');
  const spill = ctx.createLinearGradient(0, base, 0, h);
  spill.addColorStop(0, 'rgba(255,225,170,0.55)');
  spill.addColorStop(1, 'rgba(255,225,170,0)');
  ctx.fillStyle = spill;
  ctx.beginPath();
  ctx.moveTo(gx - m * 0.01, base);
  ctx.lineTo(gx + m * 0.01, base);
  ctx.lineTo(gx + m * 0.35, h);
  ctx.lineTo(gx - m * 0.05, h);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#0c0914';
  for (let i = 0; i < 3; i++) {
    const y = base + i * (h - base) * 0.34;
    ctx.fillRect(cx - dw * (1.7 + i * 0.35), y, dw * (3.4 + i * 0.7), (h - base) * 0.3);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(190,120,255,0.8)';
  ctx.shadowColor = '#b061ff';
  ctx.shadowBlur = m * 0.02;
  ctx.lineWidth = m * 0.006;
  const runes = 11;
  for (let i = 0; i < runes; i++) {
    const a = Math.PI + (i / (runes - 1)) * Math.PI;
    const r = dw * 2.05;
    const x = cx + Math.cos(a) * r;
    const y = base - dh + dw * 0.3 + Math.sin(a) * r * 0.9;
    const s = m * 0.018;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x, y + s);
    const k = Math.floor(rng() * 3);
    if (k === 0) { ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.7, y - s * 0.3); }
    if (k === 1) { ctx.moveTo(x - s * 0.7, y); ctx.lineTo(x + s * 0.7, y - s * 0.6); }
    if (k === 2) { ctx.moveTo(x, y); ctx.lineTo(x - s * 0.7, y + s * 0.6); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.7, y + s * 0.6); }
    ctx.stroke();
  }
  ctx.restore();
}

const PAINTERS = [paintMoon, paintEye, paintCrown, paintBell, paintHeart, paintDoor];

export function drawRelic(index, w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  PAINTERS[index](ctx, c.width, c.height, createRng(9000 + index * 77));
  vignette(ctx, c.width, c.height);
  return c;
}

// Desaturated, darkened copy shown behind empty jigsaw slots.
export function makeGhost(art) {
  const c = makeCanvas(art.width, art.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(art, 0, 0);
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#3a3448';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---------------------------------------------------------------------------
// Jigsaw geometry. Edges run clockwise; the outward normal of a clockwise edge
// in canvas space (y down) is (dy, -dx).

function tabEdge(ctx, ax, ay, bx, by, dir, k) {
  if (!dir) {
    ctx.lineTo(bx, by);
    return;
  }
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const nx = (dy / len) * k * dir;
  const ny = (-dx / len) * k * dir;
  const P = (u, v) => [ax + dx * u + nx * v, ay + dy * u + ny * v];
  ctx.lineTo(...P(0.36, 0));
  ctx.bezierCurveTo(...P(0.42, 0.04), ...P(0.3, 0.27), ...P(0.5, 0.27));
  ctx.bezierCurveTo(...P(0.7, 0.27), ...P(0.58, 0.04), ...P(0.64, 0));
  ctx.lineTo(bx, by);
}

export function piecePath(ctx, x, y, pw, ph, e) {
  const k = Math.min(pw, ph);
  ctx.beginPath();
  ctx.moveTo(x, y);
  tabEdge(ctx, x, y, x + pw, y, e.top, k);
  tabEdge(ctx, x + pw, y, x + pw, y + ph, e.right, k);
  tabEdge(ctx, x + pw, y + ph, x, y + ph, e.bottom, k);
  tabEdge(ctx, x, y + ph, x, y, e.left, k);
  ctx.closePath();
}

export function makePieces(art, rows, cols, edges) {
  const pw = art.width / cols;
  const ph = art.height / rows;
  const margin = Math.ceil(Math.min(pw, ph) * 0.32) + 2;
  const pieces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e = pieceEdges(edges, r, c);
      const canvas = makeCanvas(pw + margin * 2, ph + margin * 2);
      const ctx = canvas.getContext('2d');
      ctx.translate(margin - c * pw, margin - r * ph);
      ctx.save();
      piecePath(ctx, c * pw, r * ph, pw, ph, e);
      ctx.clip();
      ctx.drawImage(art, 0, 0);
      ctx.restore();
      piecePath(ctx, c * pw, r * ph, pw, ph, e);
      ctx.lineWidth = Math.max(1.5, pw * 0.02);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.stroke();
      ctx.lineWidth = Math.max(1, pw * 0.008);
      ctx.strokeStyle = 'rgba(255,230,180,0.45)';
      ctx.stroke();
      pieces.push({ canvas, r, c, margin, pw, ph, edges: e });
    }
  }
  return pieces;
}
