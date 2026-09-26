// Procedural sound for Hollow Reliquary: every effect is synthesized with WebAudio,
// routed through a generated cathedral reverb. Nothing is loaded from disk.

// D phrygian: the dark mode the match chimes climb through as combos grow.
const SCALE = [0, 1, 3, 5, 7, 8, 10];
const D4 = 293.66;
const note = (step) => D4 * 2 ** ((SCALE[((step % 7) + 7) % 7] + 12 * Math.floor(step / 7)) / 12);

export function createAudio() {
  let ctx = null;
  let master;
  let dry;
  let wet;
  let droneGain;
  let muted = false;

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  function noiseBuffer() {
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  let noise;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    wet = ctx.createGain();
    wet.gain.value = 0.32;
    dry = ctx.createGain();
    dry.gain.value = 0.9;
    wet.connect(reverb).connect(master);
    dry.connect(master);
    noise = noiseBuffer();
    startDrone();
  }

  function out(node, send = 0.5) {
    node.connect(dry);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      node.connect(s).connect(wet);
    }
  }

  function tone(freq, dur, { type = 'sine', gain = 0.2, attack = 0.005, when = 0, glide = 0, send = 0.5, detune = 0 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.value = detune;
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    out(g, send);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function hiss(dur, { freq = 800, to = freq, q = 1.5, gain = 0.2, when = 0, type = 'bandpass', send = 0.4 } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g);
    out(g, send);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // Inharmonic partials make a sine sound like a small cast bell.
  function bell(freq, { gain = 0.14, when = 0, dur = 1.4 } = {}) {
    tone(freq, dur, { gain, when, send: 0.7 });
    tone(freq * 2.76, dur * 0.4, { gain: gain * 0.35, when, send: 0.7 });
    tone(freq * 5.4, dur * 0.18, { gain: gain * 0.15, when, send: 0.8 });
  }

  function startDrone() {
    droneGain = ctx.createGain();
    droneGain.gain.value = 0.0001;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(lp.frequency);
    for (const [f, d] of [[73.42, -7], [73.42, 7], [110, 3], [87.31, -4]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start();
    }
    lp.connect(droneGain);
    out(droneGain, 0.9);
    lfo.start();
    droneGain.gain.exponentialRampToValueAtTime(0.028, ctx.currentTime + 4);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
    },
    select() {
      tone(880, 0.08, { type: 'triangle', gain: 0.05, send: 0.3 });
    },
    swap() {
      hiss(0.18, { freq: 500, to: 1800, gain: 0.08 });
    },
    invalid() {
      tone(90, 0.3, { gain: 0.3, glide: 55, send: 0.2 });
      tone(97, 0.3, { type: 'square', gain: 0.03, glide: 60, send: 0.1 });
    },
    match(combo, size) {
      const base = 2 + combo * 2;
      bell(note(base), { gain: 0.12 });
      bell(note(base + 2), { gain: 0.08, when: 0.05 });
      if (size >= 4) bell(note(base + 4), { gain: 0.07, when: 0.1 });
      hiss(0.12, { freq: 3000, to: 6000, gain: 0.03, type: 'highpass' });
    },
    pop(i) {
      tone(620 + (i % 6) * 70, 0.06, { type: 'triangle', gain: 0.025, when: i * 0.012, send: 0.2 });
    },
    create() {
      [0, 2, 4, 7].forEach((s, i) => bell(note(7 + s), { gain: 0.07, when: i * 0.06, dur: 1 }));
    },
    line() {
      hiss(0.45, { freq: 4000, to: 300, gain: 0.18, q: 4 });
      tone(1400, 0.35, { type: 'sawtooth', gain: 0.05, glide: 120, send: 0.5 });
    },
    bomb() {
      tone(140, 0.7, { gain: 0.5, glide: 32, send: 0.3 });
      hiss(0.8, { freq: 900, to: 60, gain: 0.35, type: 'lowpass', q: 0.7 });
    },
    void() {
      hiss(1.1, { freq: 120, to: 5000, gain: 0.2, q: 6 });
      tone(55, 1.6, { type: 'sawtooth', gain: 0.12, glide: 36, send: 0.9 });
      tone(58.3, 1.6, { type: 'sawtooth', gain: 0.1, glide: 38, send: 0.9 });
      [0, 1, 3].forEach((s, i) => bell(note(-7 + s), { gain: 0.1, when: 0.4 + i * 0.03, dur: 2.4 }));
    },
    zap(i) {
      tone(2400 - (i % 8) * 180, 0.09, { type: 'square', gain: 0.018, when: i * 0.02, glide: 300, send: 0.3 });
    },
    seal() {
      hiss(0.25, { freq: 2600, to: 1200, gain: 0.08, q: 8 });
      tone(1318, 0.5, { type: 'triangle', gain: 0.04, send: 0.8 });
    },
    snap(n) {
      bell(note(14 + n), { gain: 0.1, dur: 1.2 });
      tone(3520, 0.05, { type: 'square', gain: 0.02, send: 0.2 });
      tone(160, 0.12, { gain: 0.12, glide: 70, send: 0.1 });
    },
    whoosh() {
      hiss(0.5, { freq: 300, to: 2400, gain: 0.05, q: 1 });
    },
    // Minor chord that resolves to major: the relic comes back to life.
    restore() {
      if (!ctx) return;
      const chord = (notes, when, dur) =>
        notes.forEach((f) => {
          tone(f, dur, { type: 'sawtooth', gain: 0.035, attack: 0.4, when, send: 1 });
          tone(f * 1.003, dur, { type: 'sawtooth', gain: 0.03, attack: 0.4, when, send: 1 });
        });
      chord([146.83, 174.61, 220, 293.66], 0, 1.6);
      chord([146.83, 185, 220, 293.66, 369.99], 1.2, 3.2);
      [0, 2, 4, 7, 9].forEach((s, i) => bell(note(7 + s) * 1.0, { gain: 0.08, when: 1.2 + i * 0.09, dur: 2.5 }));
    },
    requiem(i) {
      bell(note(7 + i), { gain: 0.08, dur: 0.8 });
    },
    heartbeat() {
      tone(62, 0.18, { gain: 0.45, glide: 40, send: 0.1 });
      tone(58, 0.2, { gain: 0.35, glide: 38, send: 0.1, when: 0.22 });
    },
    lose() {
      [0, -1, -3, -5].forEach((s, i) => tone(note(s), 1.4, { type: 'triangle', gain: 0.09, when: i * 0.35, send: 0.9 }));
      tone(49, 2.5, { type: 'sawtooth', gain: 0.07, glide: 30, send: 0.9 });
    },
    thunder() {
      hiss(2.5, { freq: 400, to: 40, gain: 0.25, type: 'lowpass', q: 0.5 });
      hiss(0.15, { freq: 4000, to: 800, gain: 0.08, type: 'highpass', send: 0.8 });
    },
    shuffle() {
      hiss(0.9, { freq: 200, to: 3000, gain: 0.1, q: 2 });
    },
    ui() {
      bell(note(9), { gain: 0.06, dur: 0.8 });
    },
  };
}
