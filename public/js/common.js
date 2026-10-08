/* Gemeinsame Helfer für Fernseher und Handy */
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

  /* ---------- Sound (synthetisch, ohne Dateien) ---------- */
  const Sound = {
    enabled: true, ctx: null,
    init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.enabled = false; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    tone(freq, dur, { type = 'sine', vol = 0.15, delay = 0, slide = 0 } = {}) {
      if (!this.enabled || !this.ctx) return;
      const c = this.ctx, t0 = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    },
    noise(dur, { vol = 0.2, delay = 0, freq = 800 } = {}) {
      if (!this.enabled || !this.ctx) return;
      const c = this.ctx, t0 = c.currentTime + delay;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
      src.connect(f).connect(g).connect(c.destination); src.start(t0);
    },
    play(name) {
      switch (name) {
        case 'tick': this.tone(1200, 0.05, { type: 'square', vol: 0.04 }); break;
        case 'tock': this.tone(700, 0.08, { type: 'square', vol: 0.05 }); break;
        case 'pop': this.tone(520, 0.12, { type: 'triangle', vol: 0.12, slide: 400 }); break;
        case 'join': [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); break;
        case 'whoosh': this.noise(0.4, { vol: 0.25, freq: 1800 }); break;
        case 'stamp': this.noise(0.25, { vol: 0.6, freq: 300 }); this.tone(90, 0.3, { type: 'sine', vol: 0.4, slide: -40 }); break;
        case 'coin': this.tone(988, 0.08, { type: 'square', vol: 0.06 }); this.tone(1319, 0.25, { type: 'square', vol: 0.06, delay: 0.08 }); break;
        case 'lose': this.tone(330, 0.25, { type: 'sawtooth', vol: 0.07, slide: -150 }); break;
        case 'alarm': for (let i = 0; i < 6; i++) this.tone(i % 2 ? 660 : 880, 0.18, { type: 'square', vol: 0.08, delay: i * 0.18 }); break;
        case 'card': this.noise(0.12, { vol: 0.3, freq: 4000 }); this.tone(400, 0.1, { type: 'triangle', vol: 0.08, slide: 300 }); break;
        case 'ghost': this.tone(300, 1.2, { type: 'sine', vol: 0.12, slide: 200 }); this.tone(310, 1.2, { type: 'sine', vol: 0.08, slide: -120, delay: 0.2 }); break;
        case 'thunder': this.noise(1.6, { vol: 0.8, freq: 220 }); break;
        case 'drum': for (let i = 0; i < 16; i++) this.noise(0.06, { vol: 0.25 + i * 0.02, freq: 500, delay: i * 0.07 }); break;
        case 'fanfare': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i === 5 ? 0.6 : 0.16, { type: 'sawtooth', vol: 0.07, delay: i * 0.13 })); break;
        case 'win': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.12, delay: i * 0.08 })); break;
        case 'go': this.tone(880, 0.3, { type: 'square', vol: 0.12 }); break;
        case 'bell': this.tone(1568, 1.0, { type: 'sine', vol: 0.12 }); this.tone(2093, 0.8, { type: 'sine', vol: 0.06 }); break;
      }
    }
  };

  /* ---------- Notar-Stimme ---------- */
  const Voice = {
    enabled: true,
    say(text, lang) {
      if (!this.enabled || !window.speechSynthesis) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === 'tr' ? 'tr-TR' : 'de-DE';
        const v = speechSynthesis.getVoices().filter(x => x.lang && x.lang.toLowerCase().startsWith(lang));
        const male = v.find(x => /male|mann|erkek|stefan|markus|yannick|tolga|conrad|hans|google deutsch/i.test(x.name) && !/female/i.test(x.name));
        if (male || v[0]) u.voice = male || v[0];
        u.pitch = 0.55; u.rate = 0.92; u.volume = 1;
        speechSynthesis.speak(u);
      } catch (e) { /* egal */ }
    },
    stop() { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* egal */ } }
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

  // Countdown mit Serverzeit-Abgleich
  const Clock = {
    offset: 0,
    sync(serverNow) { if (serverNow) this.offset = serverNow - Date.now(); },
    left(endsAt) { return endsAt ? Math.max(0, endsAt - (Date.now() + this.offset)) : 0; }
  };

  function animateNumber(el, to, dur = 900, lang) {
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

  window.OTTO = { D, I, Connection, Sound, Voice, confetti, esc, $, $$, sleep, fmt, Clock, animateNumber };
})();
