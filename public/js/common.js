/* Gemeinsame Helfer für Fernseher und Handy: Verbindung, Sound, Musik, Notar-Stimme, Konfetti */
(function () {
  'use strict';
  const D = window.OTTO_DATA, I = window.OTTO_I18N;

  /* ---------- Verbindung (eigenes WebSocket-Protokoll) ---------- */
  function Connection() {
    this.handlers = {};
    this.acks = {};
    this.nextId = 1;
    this.queue = [];
    this.retry = 0;
    this.connected = false;
    this.open();
  }
  Connection.prototype.open = function () {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(proto + '//' + location.host + '/ws');
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true; this.retry = 0;
      this.fire('open');
      const q = this.queue; this.queue = [];
      q.forEach(m => ws.send(m));
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'ack') { const cb = this.acks[m.id]; delete this.acks[m.id]; if (cb) cb(m.d); return; }
      this.fire(m.t, m.d);
    };
    ws.onclose = () => {
      const was = this.connected;
      this.connected = false;
      if (was) this.fire('close');
      this.retry++;
      setTimeout(() => this.open(), Math.min(4000, 400 * this.retry));
    };
    ws.onerror = () => { try { ws.close(); } catch (e) { /* egal */ } };
  };
  Connection.prototype.on = function (t, fn) { (this.handlers[t] = this.handlers[t] || []).push(fn); };
  Connection.prototype.fire = function (t, d) { (this.handlers[t] || []).forEach(fn => fn(d)); };
  Connection.prototype.emit = function (t, d, cb) {
    const m = { t, d };
    if (cb) { m.id = this.nextId++; this.acks[m.id] = cb; }
    const s = JSON.stringify(m);
    if (this.connected && this.ws.readyState === 1) this.ws.send(s); else this.queue.push(s);
  };

  /* ---------- Soundeffekte (synthetisch, ohne Dateien) ---------- */
  const Sound = {
    enabled: true, ctx: null, out: null,
    init() {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.out = this.ctx.createGain(); this.out.gain.value = 0.9; this.out.connect(this.ctx.destination);
        } catch (e) { this.enabled = false; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, { type = 'sine', vol = 0.15, delay = 0, slide = 0, attack = 0.012, dest } = {}) {
      if (!this.enabled || !this.ctx) return;
      const c = this.ctx, t0 = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(dest || this.out);
      o.start(t0); o.stop(t0 + dur + 0.05);
    },
    noise(dur, { vol = 0.2, delay = 0, freq = 800, type = 'lowpass', q = 1, sweep = 0, dest } = {}) {
      if (!this.enabled || !this.ctx) return;
      const c = this.ctx, t0 = c.currentTime + delay;
      const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
      if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t0 + dur);
      g.gain.value = vol;
      src.connect(f).connect(g).connect(dest || this.out); src.start(t0);
    },
    play(name) {
      if (!this.enabled || !this.ctx) return;
      const T = (f, d, o) => this.tone(f, d, o), N = (d, o) => this.noise(d, o);
      switch (name) {
        case 'tick': T(1200, 0.05, { type: 'square', vol: 0.04 }); break;
        case 'tock': T(700, 0.08, { type: 'square', vol: 0.05 }); break;
        case 'pop': T(520, 0.12, { type: 'triangle', vol: 0.12, slide: 400 }); break;
        case 'join': [523, 659, 784].forEach((f, i) => T(f, 0.18, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); break;
        case 'whoosh': N(0.4, { vol: 0.25, freq: 600, type: 'bandpass', sweep: 2400 }); break;
        case 'stamp': N(0.25, { vol: 0.6, freq: 300 }); T(90, 0.3, { vol: 0.4, slide: -40 }); break;
        case 'coin': T(988, 0.08, { type: 'square', vol: 0.06 }); T(1319, 0.25, { type: 'square', vol: 0.06, delay: 0.08 }); break;
        case 'coins': for (let i = 0; i < 7; i++) { T(1200 + Math.random() * 900, 0.12, { type: 'square', vol: 0.035, delay: i * 0.06 }); } break;
        case 'lose': T(330, 0.25, { type: 'sawtooth', vol: 0.07, slide: -150 }); break;
        case 'alarm': for (let i = 0; i < 6; i++) T(i % 2 ? 660 : 880, 0.18, { type: 'square', vol: 0.08, delay: i * 0.18 }); break;
        case 'card': N(0.12, { vol: 0.3, freq: 4000 }); T(400, 0.1, { type: 'triangle', vol: 0.08, slide: 300 }); break;
        case 'shuffle': for (let i = 0; i < 8; i++) N(0.05, { vol: 0.2, freq: 5000, type: 'highpass', delay: i * 0.045 }); break;
        case 'ghost': T(300, 1.2, { vol: 0.12, slide: 200, attack: 0.3 }); T(310, 1.2, { vol: 0.08, slide: -120, delay: 0.2, attack: 0.3 }); T(620, 1.4, { vol: 0.03, slide: 300, delay: 0.1, attack: 0.4 }); break;
        case 'thunder': N(1.8, { vol: 0.9, freq: 260, sweep: -180 }); N(0.3, { vol: 0.5, freq: 3000, type: 'highpass' }); break;
        case 'drum': for (let i = 0; i < 18; i++) N(0.06, { vol: 0.2 + i * 0.02, freq: 600, type: 'bandpass', delay: i * 0.065 }); break;
        case 'crash': N(1.4, { vol: 0.35, freq: 6000, type: 'highpass' }); T(80, 0.4, { vol: 0.4, slide: -40 }); break;
        case 'fanfare': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => { T(f, i === 5 ? 0.7 : 0.16, { type: 'sawtooth', vol: 0.06, delay: i * 0.13 }); T(f / 2, i === 5 ? 0.7 : 0.16, { type: 'square', vol: 0.03, delay: i * 0.13 }); }); break;
        case 'win': [784, 988, 1175, 1568].forEach((f, i) => T(f, 0.2, { type: 'triangle', vol: 0.12, delay: i * 0.08 })); break;
        case 'go': T(880, 0.3, { type: 'square', vol: 0.12 }); break;
        case 'bell': T(1568, 1.0, { vol: 0.12 }); T(2093, 0.8, { vol: 0.06 }); T(784, 1.4, { vol: 0.05 }); break;
        // Karten-Effekte
        case 'slip': // Bananenschale: Rutschpfeife nach oben, dann Plumps
          T(400, 0.45, { type: 'sine', vol: 0.16, slide: 1400 }); T(1800, 0.35, { type: 'sine', vol: 0.12, slide: -1500, delay: 0.42 });
          N(0.25, { vol: 0.7, freq: 180, delay: 0.8 }); T(70, 0.3, { vol: 0.5, slide: -30, delay: 0.8 }); break;
        case 'thief': // auf Zehenspitzen, dann Klimpern
          [196, 0, 233, 0, 196, 0, 262].forEach((f, i) => f && T(f, 0.09, { type: 'triangle', vol: 0.12, delay: i * 0.11 }));
          setTimeout(() => this.play('coins'), 800); break;
        case 'gavel': for (let i = 0; i < 3; i++) { N(0.12, { vol: 0.8, freq: 900, type: 'bandpass', q: 2, delay: i * 0.22 }); T(160, 0.14, { vol: 0.35, slide: -60, delay: i * 0.22 }); } break;
        case 'scribble': for (let i = 0; i < 10; i++) N(0.07, { vol: 0.18, freq: 2500 + Math.random() * 2500, type: 'bandpass', q: 6, delay: i * 0.06 }); break;
        case 'powerdown': T(440, 1.1, { type: 'sawtooth', vol: 0.1, slide: -400 }); N(0.08, { vol: 0.5, freq: 3000, type: 'highpass' }); break;
        case 'whistle': T(1200, 0.18, { vol: 0.13, slide: 500 }); T(1700, 0.32, { vol: 0.13, slide: -900, delay: 0.24 }); break;
        case 'tape': N(0.55, { vol: 0.35, freq: 1800, type: 'bandpass', q: 0.8, sweep: 2500 }); for (let i = 0; i < 10; i++) N(0.02, { vol: 0.3, freq: 4000, type: 'highpass', delay: 0.04 * i }); break;
        case 'gift': [659, 784, 988, 1319].forEach((f, i) => T(f, 0.18, { type: 'triangle', vol: 0.1, delay: i * 0.08 })); T(110, 1.2, { type: 'sawtooth', vol: 0.06, delay: 0.5, slide: -40, attack: 0.2 }); break;
        case 'kaching': T(2093, 0.05, { type: 'square', vol: 0.07 }); N(0.1, { vol: 0.4, freq: 5000, type: 'highpass', delay: 0.05 }); T(2637, 0.6, { type: 'triangle', vol: 0.14, delay: 0.1 }); T(3136, 0.6, { type: 'triangle', vol: 0.08, delay: 0.1 }); break;
        case 'boing': T(180, 0.45, { type: 'sine', vol: 0.25, slide: 500 }); T(400, 0.3, { type: 'triangle', vol: 0.1, slide: -200, delay: 0.1 }); break;
        case 'meow': this.meow(); break;
        case 'birds': for (let i = 0; i < 6; i++) T(2400 + Math.random() * 1200, 0.08, { vol: 0.06, slide: 900, delay: i * 0.13 + Math.random() * 0.05 }); break;
        case 'jackpot': for (let i = 0; i < 12; i++) T(800 + i * 110, 0.1, { type: 'square', vol: 0.05, delay: i * 0.05 }); setTimeout(() => this.play('coins'), 600); break;
        case 'stairs': for (let i = 0; i < 6; i++) { N(0.1, { vol: 0.6, freq: 260 - i * 20, delay: i * 0.13 }); T(140 - i * 12, 0.1, { vol: 0.3, delay: i * 0.13 }); } T(330, 0.6, { type: 'sawtooth', vol: 0.06, slide: -200, delay: 0.85 }); break;
        case 'rats': for (let i = 0; i < 5; i++) T(3000 + Math.random() * 800, 0.06, { type: 'square', vol: 0.04, slide: 600, delay: i * 0.09 }); break;
        case 'burp': N(0.5, { vol: 0.5, freq: 160, type: 'bandpass', q: 4 }); T(95, 0.5, { type: 'sawtooth', vol: 0.12, slide: -20 }); break;
        case 'sparkle': for (let i = 0; i < 9; i++) T(1800 + Math.random() * 2400, 0.25, { vol: 0.05, delay: i * 0.05 }); break;
        case 'clang': T(1046, 0.6, { type: 'square', vol: 0.05 }); T(1567, 0.5, { type: 'square', vol: 0.04 }); N(0.2, { vol: 0.4, freq: 5000, type: 'highpass' }); break;
        case 'wahwah': [392, 370, 349, 330].forEach((f, i) => T(f, i === 3 ? 0.8 : 0.3, { type: 'sawtooth', vol: 0.08, delay: i * 0.32, slide: i === 3 ? -40 : 0 })); break;
        case 'applause': for (let i = 0; i < 40; i++) N(0.03, { vol: 0.25, freq: 2000 + Math.random() * 3000, type: 'bandpass', delay: Math.random() * 1.6 }); break;
        case 'balloonPop': N(0.3, { vol: 0.9, freq: 2000, type: 'highpass' }); T(120, 0.2, { vol: 0.4, slide: -60 }); break;
        case 'pump': N(0.15, { vol: 0.25, freq: 900, type: 'bandpass', sweep: 600 }); break;
        case 'bonk': T(220, 0.12, { type: 'square', vol: 0.12, slide: -120 }); N(0.06, { vol: 0.4, freq: 1200 }); break;
        case 'wrong': T(150, 0.3, { type: 'square', vol: 0.09 }); break;
        case 'right': T(880, 0.07, { type: 'triangle', vol: 0.1 }); T(1320, 0.12, { type: 'triangle', vol: 0.1, delay: 0.06 }); break;
        case 'unlock': T(600, 0.06, { type: 'square', vol: 0.08 }); N(0.08, { vol: 0.5, freq: 1500, type: 'bandpass', delay: 0.06 }); T(900, 0.4, { type: 'triangle', vol: 0.1, delay: 0.12 }); break;
        case 'message': T(1046, 0.08, { type: 'triangle', vol: 0.08 }); T(1568, 0.15, { type: 'triangle', vol: 0.08, delay: 0.07 }); break;
        case 'whisper': N(0.6, { vol: 0.12, freq: 3500, type: 'bandpass', q: 3 }); break;
        case 'shutter': N(0.04, { vol: 0.5, freq: 3000, type: 'highpass' }); N(0.06, { vol: 0.4, freq: 2000, type: 'highpass', delay: 0.08 }); break;
        case 'typewriter': N(0.03, { vol: 0.25, freq: 3500, type: 'bandpass', q: 2 }); break;
        case 'snore': T(110, 0.9, { type: 'sawtooth', vol: 0.06, slide: 40, attack: 0.3 }); N(0.9, { vol: 0.12, freq: 400, type: 'bandpass', q: 3, delay: 0.05 }); T(900, 0.5, { vol: 0.05, slide: 600, delay: 1.0 }); break;
        case 'dice': for (let i = 0; i < 7; i++) N(0.04, { vol: 0.5, freq: 2200 + Math.random() * 1500, type: 'bandpass', q: 4, delay: i * 0.07 + Math.random() * 0.03 }); break;
        case 'hic': T(500, 0.12, { type: 'triangle', vol: 0.16, slide: 500 }); T(650, 0.1, { type: 'triangle', vol: 0.12, slide: 400, delay: 0.5 }); break;
        case 'stink': N(0.7, { vol: 0.45, freq: 120, type: 'bandpass', q: 6, sweep: 60 }); T(70, 0.7, { type: 'sawtooth', vol: 0.06, slide: -20 }); break;
        case 'party': T(600, 0.45, { type: 'sawtooth', vol: 0.08, slide: 250 }); for (let i = 0; i < 12; i++) N(0.03, { vol: 0.2, freq: 3000 + Math.random() * 3000, type: 'highpass', delay: 0.3 + Math.random() * 0.6 }); break;
        case 'magnet': T(200, 0.8, { type: 'sine', vol: 0.12, slide: 600 }); setTimeout(() => this.play('coins'), 500); break;
        case 'heartbeat': T(60, 0.12, { vol: 0.5 }); T(55, 0.15, { vol: 0.4, delay: 0.18 }); break;
      }
    },
    meow() {
      // Formant-ähnliches "Miau": Sägezahn durch wandernden Bandpass
      if (!this.ctx) return;
      const c = this.ctx, t0 = c.currentTime;
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t0); o.frequency.linearRampToValueAtTime(720, t0 + 0.25); o.frequency.linearRampToValueAtTime(480, t0 + 0.6);
      f.type = 'bandpass'; f.Q.value = 5; f.frequency.setValueAtTime(700, t0); f.frequency.linearRampToValueAtTime(1800, t0 + 0.25); f.frequency.linearRampToValueAtTime(900, t0 + 0.6);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
      o.connect(f).connect(g).connect(this.out); o.start(t0); o.stop(t0 + 0.7);
    }
  };

  /* ---------- Musik: kleiner Sequenzer mit eigenen Stücken ---------- */
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const midi = (n) => { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); return m ? 12 * (+m[2] + 1) + NOTE[m[1]] : null; };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // "D3 . A2 -" → Liste je Schritt; "." = Pause, "-" = Pause, "D3+F3+A3" = Akkord
  const seq = (str) => str.trim().split(/\s+/).map(tok => (tok === '.' || tok === '-') ? null : tok.split('+').map(midi));

  const TRACKS = {
    // Unheimlicher Walzer in d-Moll (Lobby, Abrechnung)
    lobby: {
      bpm: 168, swing: 0, parts: [
        { inst: 'bass', vol: 0.18, steps: seq('D2 . . . . . A1 . . . . . D2 . . . . . G1 . . . . . D2 . . . . . Bb1 . . . . . A1 . . . . . D2 . . . A1 .') },
        { inst: 'pluck', vol: 0.07, steps: seq('. . D4+F4+A4 . D4+F4+A4 . . . C#4+E4+G4 . C#4+E4+G4 . . . D4+F4+A4 . D4+F4+A4 . . . D4+G4+Bb4 . D4+G4+Bb4 . . . D4+F4+A4 . D4+F4+A4 . . . D4+F4+Bb4 . D4+F4+Bb4 . . . C#4+E4+G4 . C#4+E4+A4 . . . D4+F4+A4 . . .') },
        { inst: 'lead', vol: 0.06, steps: seq('A4 . D5 . F5 E5 C#5 . E5 . G5 . F5 E5 D5 . A4 . Bb4 . D5 . G5 . A5 . F5 . D5 . F5 E5 D5 . Bb4 . E5 . C#5 . A4 . D5 . . . . .') }
      ]
    },
    // Schleichende Pizzicato-Spannung (Planung, Abstimmung)
    plan: {
      bpm: 236, parts: [
        { inst: 'pizz', vol: 0.2, steps: seq('E2 . G2 . A2 . A#2 . B2 . A#2 . A2 . G2 . E2 . G2 . A2 . C3 . B2 . . . B1 . . .') },
        { inst: 'pizz', vol: 0.09, steps: seq('. . . . B4 . . . . . A#4 . A4 . . . . . . . E5 . D5 . B4 . . . . . . .') },
        { inst: 'hat', vol: 0.05, steps: seq('. C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6 . C6') },
        { inst: 'pluck', vol: 0.04, steps: seq('E3+G3+B3 . . . . . . . . . . . . . . . E3+G3+C4 . . . . . . . D#3+F#3+B3 . . . . . . .') }
      ]
    },
    // Treibender Duell-Galopp in a-Moll
    duel: {
      bpm: 300, parts: [
        { inst: 'kick', vol: 0.35, steps: seq('C2 . . . C2 . . . C2 . . . C2 . . . C2 . . . C2 . . . C2 . . . C2 . C2 .') },
        { inst: 'snare', vol: 0.12, steps: seq('. . C4 . . . C4 . . . C4 . . . C4 . . . C4 . . . C4 . . . C4 . C4 C4 C4 C4') },
        { inst: 'hat', vol: 0.04, steps: seq('C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6 C6') },
        { inst: 'bass', vol: 0.17, steps: seq('A1 A1 A2 A1 A1 A1 A2 A1 F1 F1 F2 F1 F1 F1 F2 F1 G1 G1 G2 G1 G1 G1 G2 G1 E1 E1 E2 E1 E1 E1 G#1 E1') },
        { inst: 'lead', vol: 0.055, steps: seq('A4 . C5 . E5 . A5 . F5 . E5 . C5 . . . G4 . B4 . D5 . G5 . G#5 . . . B4 . E5 .') }
      ]
    },
    // Feierliches Finale in C-Dur
    finale: {
      bpm: 120, parts: [
        { inst: 'pad', vol: 0.06, steps: seq('C4+E4+G4 . . . B3+D4+G4 . . . A3+C4+E4 . . . F3+A3+C4 . . . C4+E4+G4 . . . F3+A3+C4 . . . G3+B3+D4 . . . C4+E4+G4 . . .') },
        { inst: 'bass', vol: 0.16, steps: seq('C2 . . . B1 . . . A1 . . . F1 . . . C2 . . . F1 . . . G1 . . . C2 . . .') },
        { inst: 'lead', vol: 0.05, steps: seq('C5 . E5 G5 D5 . . . E5 . C5 . A4 . . . G4 . C5 E5 F5 . A5 . G5 . F5 D5 C5 . . .') }
      ]
    }
  };

  const Music = {
    enabled: true, track: null, step: 0, nextTime: 0, timer: null, gain: null, duckLevel: 1, base: 0.55,
    ensure() {
      Sound.init();
      if (!Sound.ctx) return false;
      if (!this.gain) { this.gain = Sound.ctx.createGain(); this.gain.gain.value = this.base; this.gain.connect(Sound.ctx.destination); }
      return true;
    },
    play(name) {
      if (this.track === name) return;
      this.track = name;
      if (!this.enabled || !name || !this.ensure()) { this.stopLoop(); return; }
      this.step = 0;
      this.nextTime = Sound.ctx.currentTime + 0.15;
      this.fadeTo(this.base * this.duckLevel, 0.6);
      if (!this.timer) this.timer = setInterval(() => this.schedule(), 40);
    },
    stopLoop() { clearInterval(this.timer); this.timer = null; },
    stop() { this.track = null; this.stopLoop(); },
    setEnabled(on) {
      this.enabled = on;
      if (!on) { this.stopLoop(); return; }
      const t = this.track; this.track = null; this.play(t || 'lobby');
    },
    duck(on) { this.duckLevel = on ? 0.3 : 1; this.fadeTo(this.base * this.duckLevel, on ? 0.25 : 0.8); },
    fadeTo(v, sec) {
      if (!this.gain) return;
      const t = Sound.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(v, t + sec);
    },
    schedule() {
      const tr = TRACKS[this.track];
      if (!tr || !Sound.ctx) return;
      const stepDur = 60 / tr.bpm;
      const len = Math.max(...tr.parts.map(p => p.steps.length));
      while (this.nextTime < Sound.ctx.currentTime + 0.15) {
        tr.parts.forEach(p => {
          const n = p.steps[this.step % p.steps.length];
          if (n) n.forEach(m => m != null && this.voice(p.inst, m, this.nextTime, stepDur, p.vol));
        });
        this.step = (this.step + 1) % len;
        this.nextTime += stepDur;
      }
    },
    voice(inst, m, t, stepDur, vol) {
      const c = Sound.ctx, g = c.createGain(), f = hz(m);
      g.connect(this.gain);
      const env = (a, d, peak) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
      const osc = (type, freq, det = 0, dest = g) => { const o = c.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det; o.connect(dest); o.start(t); o.stop(t + 3); return o; };
      switch (inst) {
        case 'bass': env(0.01, stepDur * 2.5, vol); osc('triangle', f); osc('sine', f / 2); break;
        case 'pluck': {
          const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.3); lp.connect(g);
          env(0.004, 0.32, vol); osc('sawtooth', f, -6, lp); osc('square', f, 6, lp); break;
        }
        case 'pizz': env(0.003, 0.16, vol); osc('triangle', f); break;
        case 'lead': {
          env(0.02, stepDur * 1.6, vol);
          const o = osc('square', f); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 4; lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + 3);
          break;
        }
        case 'pad': {
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 4);
          const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(g);
          osc('sawtooth', f, -8, lp); osc('sawtooth', f, 8, lp); break;
        }
        case 'kick': { env(0.002, 0.25, vol); const o = osc('sine', 150); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.2); break; }
        case 'snare': case 'hat': {
          const dur = inst === 'hat' ? 0.04 : 0.15;
          const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = buf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
          const s = c.createBufferSource(), hp = c.createBiquadFilter();
          s.buffer = buf; hp.type = 'highpass'; hp.frequency.value = inst === 'hat' ? 7000 : 1500;
          g.gain.value = vol; s.connect(hp).connect(g); s.start(t);
          break;
        }
      }
    }
  };

  /* ---------- Notar-Stimme: vorab erzeugte Aufnahmen (funktioniert in jedem Browser) ---------- */
  const Voice = {
    enabled: true, manifest: null, audio: null, queue: [], playing: false, token: 0,
    async load() {
      try { const r = await fetch('/voice/manifest.json'); this.manifest = await r.json(); } catch (e) { this.manifest = { de: [], tr: [] }; }
      this.sets = { de: new Set(this.manifest.de || []), tr: new Set(this.manifest.tr || []) };
    },
    has(key, lang) { return !!(this.sets && this.sets[lang] && this.sets[lang].has(key)); },
    // keys: ein Schlüssel oder eine Liste; spielt nacheinander ab
    say(keys, lang, { queue = false } = {}) {
      if (!this.enabled) return Promise.resolve();
      const list = (Array.isArray(keys) ? keys : [keys]).filter(k => this.has(k, lang)).map(k => '/voice/' + lang + '/' + k + '.mp3');
      if (!list.length) return Promise.resolve();
      if (!queue) this.stop();
      return new Promise(resolve => { this.queue.push(...list.map((src, i) => ({ src, done: i === list.length - 1 ? resolve : null }))); this.next(); });
    },
    next() {
      if (this.playing) return;
      const item = this.queue.shift();
      if (!item) { Music.duck(false); return; }
      if (!this.audio) this.audio = new Audio();
      const a = this.audio, my = ++this.token;
      this.playing = true;
      Music.duck(true);
      const end = () => { if (my !== this.token) return; this.playing = false; if (item.done) item.done(); setTimeout(() => this.next(), 120); };
      a.onended = end; a.onerror = end;
      a.src = item.src;
      const p = a.play();
      if (p && p.catch) p.catch(end);
    },
    stop() {
      this.token++;
      this.queue.forEach(q => q.done && q.done());
      this.queue = [];
      this.playing = false;
      if (this.audio) { try { this.audio.pause(); } catch (e) { /* egal */ } }
      Music.duck(false);
    },
    // Für den ersten Klick: Audio-Element freischalten (iOS/Safari)
    unlock() {
      if (!this.audio) this.audio = new Audio();
      try { this.audio.muted = true; const p = this.audio.play(); if (p && p.catch) p.catch(() => {}); this.audio.pause(); this.audio.muted = false; } catch (e) { /* egal */ }
    }
  };

  /* ---------- Konfetti ---------- */
  function confetti(opts = {}) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti-canvas';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const W = cv.width = innerWidth * devicePixelRatio, H = cv.height = innerHeight * devicePixelRatio;
    const colors = opts.colors || ['#d9a441', '#f2e3c2', '#8c2331', '#5fbf8f', '#e8c46a', '#ffffff'];
    const coins = !!opts.coins;
    const parts = Array.from({ length: opts.count || 160 }, () => ({
      x: (opts.x != null ? opts.x * W : Math.random() * W), y: opts.y != null ? opts.y * H : -20 * devicePixelRatio,
      vx: (Math.random() - 0.5) * 14 * devicePixelRatio, vy: (opts.y != null ? -Math.random() * 18 - 6 : Math.random() * 4 + 2) * devicePixelRatio,
      s: (Math.random() * 8 + 6) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, W, H);
      parts.forEach(p => {
        p.vy += 0.35 * devicePixelRatio; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        if (coins) { ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.ellipse(0, 0, p.s * 0.7, p.s * 0.7 * Math.abs(Math.cos(p.r * 2)) + 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#9c6f22'; ctx.lineWidth = 2; ctx.stroke(); }
        else { ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
        ctx.restore();
      });
      if (t - t0 < (opts.duration || 3500)) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  /* ---------- Hilfen ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  function fmt(n, lang) { return Number(n || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'de-DE'); }

  // Porträt-Medaillon: Foto, falls vorhanden, sonst Tiergesicht
  function medal(p, code, cls = '') {
    if (!p) return '';
    const inner = p.photo && code ? `<img src="/photo/${code}/${p.id}?v=${p.photo}" alt="" draggable="false">` : esc(p.avatar);
    return `<div class="medal ${p.ghost ? 'ghost' : ''} ${p.photo ? 'has-photo' : ''} ${cls}" style="--c:${p.color}">${inner}</div>`;
  }

  // Deterministischer Zufall (gleiche Aufgaben für alle Duellanten)
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // Countdown mit Serverzeit-Abgleich
  const Clock = {
    offset: 0,
    sync(serverNow) { if (serverNow) this.offset = serverNow - Date.now(); },
    left(endsAt) { return endsAt ? Math.max(0, endsAt - (Date.now() + this.offset)) : 0; }
  };

  function animateNumber(el, to, dur = 900, lang) {
    if (!el) return;
    const from = Number(el.dataset.value || 0);
    el.dataset.value = to;
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to, lang); return; }
    const t0 = performance.now();
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e), lang);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  // Punktestand eines Minispiels als Text
  function fmtScore(t, type, s, lang) {
    if (s === undefined || s === null || !Number.isFinite(s)) return type === 'safe' ? t('sc.unsolved') : t('sc.none');
    switch (type) {
      case 'tap': return t('sc.tap', { n: s });
      case 'reaction': return s < 0 ? t('sc.early') : t('sc.ms', { n: Math.round(s) });
      case 'stopwatch': return t('sc.sec', { n: (s / 1000).toFixed(2) });
      case 'memory': return t('sc.colors', { n: s });
      case 'balloon': return s === 0 ? t('sc.popped') : t('sc.pumps', { n: s });
      case 'safe': return t('sc.tries', { n: Math.floor(s / 100) });
      case 'unique': return t('sc.pick', { n: s });
      case 'math': case 'colorword': case 'mole': case 'oddone': case 'arrows': return t('sc.points', { n: s });
      default: return fmt(s, lang);
    }
  }

  window.OTTO = { D, I, Connection, Sound, Music, Voice, confetti, esc, $, $$, sleep, fmt, Clock, animateNumber, medal, rng, fmtScore };
})();
