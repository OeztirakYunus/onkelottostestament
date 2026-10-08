'use strict';
/* Onkel Ottos Testament – Spiel-Engine */
const crypto = require('crypto');
const D = require('../shared/data');

const tok = () => crypto.randomBytes(12).toString('hex');
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const BOT_NAMES = ['Cousin Bernd', 'Tante Gerda', 'Onkel Kemal', 'Oma Hilde', 'Neffe Emre', 'Cousine Ayşe',
  'Opa Friedl', 'Tante Fatma', 'Schwager Kurt', 'Nichte Elif', 'Onkel Heinz', 'Cousin Murat', 'Tante Rosi', 'Opa Mehmet'];

const ROOM_WEIGHT = { vault: 2.2, kitchen: 1.4, library: 1.1, bedroom: 2, cellar: 1.8, garden: 0.9, attic: 1, ballroom: 1.6 };

class Game {
  constructor(code, { lang = 'de', timeScale = 1 } = {}) {
    this.code = code;
    this.lang = lang === 'tr' ? 'tr' : 'de';
    this.timeScale = timeScale;
    this.hostToken = tok();
    this.players = [];
    this.settings = { rounds: 8, planTime: 35 };
    this.phase = 'lobby';
    this.pd = {};
    this.round = 0;
    this.totalRounds = 0;
    this.rooms = [...D.BASE_ROOMS];
    this.rd = null;
    this.onChange = () => {};
    this.timer = null; this.timerFn = null; this.endsAt = null;
    this.joinUrl = ''; this.qr = '';
    this.batch = false;
  }

  /* ---------------- Timer ---------------- */
  changed() { if (!this.destroyed) this.onChange(); }
  after(sec, fn) {
    clearTimeout(this.timer);
    const ms = Math.max(1, sec * 1000 * this.timeScale);
    this.timerFn = fn;
    this.endsAt = Date.now() + ms;
    this.timer = setTimeout(() => { this.timer = null; this.timerFn = null; this.endsAt = null; fn(); }, ms);
    this.changed();
  }
  skip() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    const fn = this.timerFn;
    this.timer = null; this.timerFn = null; this.endsAt = null;
    if (fn) fn();
  }
  destroy() { this.destroyed = true; clearTimeout(this.timer); }
  setPhase(phase, data) { this.phase = phase; this.pd = data || {}; this.changed(); }

  /* ---------------- Spieler ---------------- */
  get(pid) { return this.players.find(p => p.id === pid); }
  living() { return this.players.filter(p => !p.ghost); }
  active(p) { return p.isBot || p.connected; }

  resetPlayer(p) {
    Object.assign(p, { money: 0, hand: [], heirlooms: [], role: 'relative', ghost: false, known: {}, catLives: 0, family: null, lastDelta: 0 });
  }

  addPlayer({ name, avatar, lang, bot = false }) {
    if (this.phase !== 'lobby') return { error: 'running' };
    if (this.players.length >= 15) return { error: 'full' };
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Erbe';
    if (this.players.some(p => p.name.toLowerCase() === name.toLowerCase())) name = (name.slice(0, 11) + ' ' + (this.players.length + 1));
    const usedC = new Set(this.players.map(p => p.color));
    const color = D.COLORS.find(c => !usedC.has(c)) || pick(D.COLORS);
    const usedA = new Set(this.players.map(p => p.avatar));
    if (!D.AVATARS.includes(avatar) || usedA.has(avatar)) avatar = D.AVATARS.find(a => !usedA.has(a)) || pick(D.AVATARS);
    const p = { id: 'p' + tok().slice(0, 8), token: tok(), name, avatar, color, lang: lang === 'tr' ? 'tr' : 'de', isBot: bot, connected: bot, socketId: null };
    this.resetPlayer(p);
    this.players.push(p);
    this.changed();
    return { player: p };
  }
  addBot() {
    const used = new Set(this.players.map(p => p.name));
    const name = BOT_NAMES.find(n => !used.has(n)) || ('Bot ' + (this.players.length + 1));
    return this.addPlayer({ name, avatar: null, lang: this.lang, bot: true });
  }
  kick(pid) {
    if (this.phase !== 'lobby') return;
    this.players = this.players.filter(p => p.id !== pid);
    this.changed();
  }
  updateSettings(s) {
    if (this.phase !== 'lobby') return;
    const r = parseInt(s.rounds, 10), t = parseInt(s.planTime, 10);
    if ([5, 6, 8, 10, 12].includes(r)) this.settings.rounds = r;
    if ([20, 25, 35, 45, 60].includes(t)) this.settings.planTime = t;
    this.changed();
  }

  /* ---------------- Spielstart ---------------- */
  start() {
    if (this.phase !== 'lobby' || this.players.length < 2) return false;
    const n = this.players.length;
    this.rooms = n >= 9 ? [...D.BASE_ROOMS, ...D.BIG_ROOMS] : [...D.BASE_ROOMS];
    this.players.forEach(p => { this.resetPlayer(p); p.money = D.START_MONEY; });

    const roles = [];
    if (n >= 5) roles.push('butler');
    if (n >= 4) roles.push('kid');
    if (n >= 6) roles.push('cat');
    shuffle(this.players).forEach((p, i) => { if (roles[i]) { p.role = roles[i]; if (p.role === 'cat') p.catLives = 3; } });

    this.families = null;
    if (n >= 10) {
      const k = Math.round(n / 3);
      this.families = Array.from({ length: k }, (_, i) => ({ id: i, members: [] }));
      shuffle(this.players).forEach((p, i) => { const f = this.families[i % k]; f.members.push(p.id); p.family = f.id; });
    }

    this.players.forEach(p => this.drawCard(p, 2));
    this.heirloomDeck = shuffle(D.HEIRLOOMS.map(h => h.id));
    this.clauseDeck = shuffle(D.CLAUSES.filter(c => !c.fx.final).map(c => c.id));
    if (process.env.OTTO_CLAUSES) { // nur zum Testen: bestimmte Klauseln zuerst ziehen
      const first = process.env.OTTO_CLAUSES.split(',').filter(id => D.CLAUSE_BY_ID[id]);
      this.clauseDeck = [...first, ...this.clauseDeck.filter(id => !first.includes(id))];
    }
    this.questionDeck = shuffle(D.QUESTIONS.map(q => q.id));
    this.round = 0;
    this.totalRounds = this.settings.rounds;
    this.fv = null;
    this.rd = null;
    this.setPhase('intro', {});
    this.after(10, () => this.startRound());
    return true;
  }

  restart() {
    clearTimeout(this.timer); this.timer = null; this.endsAt = null;
    this.players = this.players.filter(p => p.isBot || p.connected);
    this.players.forEach(p => this.resetPlayer(p));
    this.round = 0; this.rd = null; this.fv = null; this.families = null;
    this.rooms = [...D.BASE_ROOMS];
    this.setPhase('lobby', {});
  }

  drawCard(p, n = 1) {
    for (let i = 0; i < n; i++) {
      p.hand.push(pick(D.CARD_POOL));
      if (p.hand.length > D.HAND_MAX) p.hand.shift();
    }
  }

  /* ---------------- Geld ---------------- */
  give(p, amount) {
    if (!p || !amount) return 0;
    const before = p.money;
    p.money = Math.max(0, Math.round(p.money + amount));
    const real = p.money - before;
    if (this.rd) this.rd.deltas[p.id] = (this.rd.deltas[p.id] || 0) + real;
    p.lastDelta += real;
    return real;
  }
  transfer(from, to, amount) {
    const taken = -this.give(from, -amount);
    this.give(to, taken);
    return taken;
  }
  ranked() { return [...this.living()].sort((a, b) => b.money - a.money); }
  richest() { return this.ranked()[0]; }
  poorest() { const r = this.ranked(); return r[r.length - 1]; }
  mult(room) { const m = this.fx.mult || {}; return m[room] || m.all || 1; }

  /* ---------------- Runde ---------------- */
  clauseOk(c) {
    const r = c.fx.req;
    if (!r) return true;
    if (r === 'butler') return this.players.some(p => p.role === 'butler');
    if (r === 'ghosts') return this.players.some(p => p.ghost);
    if (r === 'heirlooms') return this.players.some(p => p.heirlooms.length);
    return true;
  }

  startRound() {
    this.round++;
    let clause = null;
    if (this.round === this.totalRounds) clause = D.CLAUSES.find(c => c.fx.final);
    for (let tries = 0; tries < 80 && !clause; tries++) {
      if (!this.clauseDeck.length) this.clauseDeck = shuffle(D.CLAUSES.filter(c => !c.fx.final).map(c => c.id));
      const c = D.CLAUSE_BY_ID[this.clauseDeck.shift()];
      if (this.clauseOk(c)) clause = c;
    }
    this.clause = clause;
    this.fx = clause.fx;
    this.rd = { deltas: {}, plans: {}, closed: new Set((this.fx.closed || []).filter(r => this.rooms.includes(r))), learned: {} };
    this.players.forEach(p => { p.lastDelta = 0; });
    const nowLines = this.fx.now ? this.applyNow(this.fx.now) : [];
    this.setPhase('clause', { clause: clause.id, nowLines, vote: clause.fx.vote != null, final: !!clause.fx.final });
    this.after(nowLines.length ? 14 : 11, () => this.startPlan());
  }

  applyNow(name) {
    const n = this.fx.n;
    const L = [];
    const line = (k, p = {}, pid = null, a = null) => L.push({ k, p, pid, a });
    const liv = this.living();
    switch (name) {
      case 'tax': liv.forEach(p => this.give(p, -n)); line('now.tax', { n }); break;
      case 'robin': {
        const r = this.richest(), q = this.poorest();
        if (r && q && r !== q) { const t = this.transfer(r, q, n); line('now.robin', { a: r.name, b: q.name, n: t }); }
        break;
      }
      case 'pity': { const q = this.poorest(); if (q) { this.give(q, n); line('now.got', { a: q.name, n }, q.id, n); } break; }
      case 'everyoneCard': liv.forEach(p => this.drawCard(p)); line('now.everyoneCard'); break;
      case 'passHands': {
        const hands = liv.map(p => p.hand);
        liv.forEach((p, i) => { p.hand = hands[(i - 1 + liv.length) % liv.length]; });
        line('now.passHands');
        break;
      }
      case 'richTax': this.ranked().slice(0, Math.min(3, liv.length - 1)).forEach(p => { const t = -this.give(p, -n); line('now.paid', { a: p.name, n: t }, p.id, -t); }); break;
      case 'heirloomShuffle': {
        const holders = this.players.filter(p => p.heirlooms.length);
        if (!holders.length) break;
        const from = pick(holders);
        const h = from.heirlooms.splice(Math.floor(Math.random() * from.heirlooms.length), 1)[0];
        const others = this.living().filter(p => p !== from);
        const to = others.length ? pick(others) : from;
        to.heirlooms.push(h);
        line('now.heirloomShuffle', { a: from.name, b: to.name, h });
        break;
      }
      case 'butlerHint': {
        const b = this.players.find(p => p.role === 'butler');
        const others = shuffle(this.players.filter(p => p !== b)).slice(0, 2);
        const names = shuffle([b, ...others]).map(p => p.name);
        line('now.butlerHint', { a: names[0], b: names[1] || '?', c: names[2] || '?' });
        break;
      }
      case 'seance':
        this.players.filter(p => p.ghost).forEach(p => { p.ghost = false; p.money = 0; this.give(p, n); line('now.revived', { a: p.name, n }, p.id, n); });
        break;
      case 'allPlus': liv.forEach(p => this.give(p, n)); line('now.allPlus', { n }); break;
      case 'swapRichPoor': {
        const r = this.richest(), q = this.poorest();
        if (r && q && r !== q && r.money !== q.money) { const a = r.money, b = q.money; this.give(r, b - a); this.give(q, a - b); line('now.swap', { a: r.name, b: q.name }); }
        else line('now.nothing');
        break;
      }
      case 'payLeft': {
        const amounts = liv.map(p => Math.floor(p.money * n / 100));
        liv.forEach((p, i) => this.transfer(p, liv[(i + 1) % liv.length], amounts[i]));
        line('now.payLeft', { n });
        break;
      }
      case 'heirloomTax':
        this.living().filter(p => p.heirlooms.length).forEach(p => { const t = -this.give(p, -n * p.heirlooms.length); line('now.paid', { a: p.name, n: t }, p.id, -t); });
        break;
      case 'evenMoney': {
        const lucky = liv.filter(p => p.money % 20 === 0);
        lucky.forEach(p => { this.give(p, n); line('now.got', { a: p.name, n }, p.id, n); });
        if (!lucky.length) line('now.nothing');
        break;
      }
      case 'poorCards': this.ranked().slice(-2).forEach(p => { this.drawCard(p, 2); line('now.cards', { a: p.name, n: 2 }, p.id); }); break;
    }
    return L;
  }

  openRooms() { return this.rooms.filter(r => !this.rd.closed.has(r)); }

  /* ---------------- Planung ---------------- */
  startPlan() {
    this.rd.plans = {};
    this.setPhase('plan', { open: this.openRooms(), maxCards: this.fx.noCards ? 0 : (this.fx.maxCards || 1) });
    this.after(this.settings.planTime, () => this.doReveal());
    this.batch = true;
    this.players.filter(p => p.isBot).forEach(p => this.botPlan(p));
    this.batch = false;
    this.checkAllPlanned();
  }

  submitPlan(p, plan) {
    if (this.phase !== 'plan' || !p || !plan) return { error: 'phase' };
    const open = this.openRooms();
    const room = plan.room;
    if (!open.includes(room)) return { error: 'room' };
    const max = p.ghost ? 0 : this.pd.maxCards;
    const played = []; const used = new Set();
    (Array.isArray(plan.cards) ? plan.cards : []).slice(0, max).forEach(c => {
      const idx = parseInt(c && c.idx, 10);
      if (!(idx >= 0 && idx < p.hand.length) || used.has(idx)) return;
      const cid = p.hand[idx]; const def = D.CARDS[cid];
      let target = null;
      if (def.target === 'player') { const t = this.get(c.target); if (!t || t === p || t.ghost) return; target = t.id; }
      if (def.target === 'room') { if (!this.rooms.includes(c.target) || c.target === 'garden') return; target = c.target; }
      if (def.needsHeirloom && !p.heirlooms.length) return;
      used.add(idx);
      played.push({ card: cid, idx, target });
    });
    this.rd.plans[p.id] = { room, cards: played };
    this.changed();
    if (!this.batch) this.checkAllPlanned();
    return { ok: true };
  }

  checkAllPlanned() {
    if (this.phase !== 'plan') return;
    const need = this.players.filter(p => this.active(p));
    if (need.length && need.every(p => this.rd.plans[p.id])) this.after(1.2, () => this.doReveal());
  }

  botPlan(p) {
    const open = this.openRooms();
    let room;
    if (p.ghost) room = pick(open);
    else {
      const total = open.reduce((s, r) => s + (ROOM_WEIGHT[r] || 1), 0);
      let x = Math.random() * total;
      room = open[open.length - 1];
      for (const r of open) { x -= ROOM_WEIGHT[r] || 1; if (x <= 0) { room = r; break; } }
    }
    const cards = [];
    if (!p.ghost && this.pd.maxCards > 0 && p.hand.length && Math.random() < 0.65) {
      const idx = Math.floor(Math.random() * p.hand.length);
      const def = D.CARDS[p.hand[idx]];
      let target = null;
      if (def.target === 'player') { const o = this.players.filter(q => q !== p && !q.ghost); target = o.length ? pick(o).id : null; }
      if (def.target === 'room') target = pick(this.rooms.filter(r => r !== 'garden'));
      if (!(def.needsHeirloom && !p.heirlooms.length) && (!def.target || target)) cards.push({ idx, target });
    }
    this.submitPlan(p, { room, cards });
  }

  /* ---------------- Enthüllung ---------------- */
  doReveal() {
    if (this.phase !== 'plan') return;
    const fx = this.fx, rd = this.rd;
    const ev = [];
    const pos = {}, planned = {};
    const startOpen = this.openRooms();
    this.players.forEach(p => {
      let pl = rd.plans[p.id];
      if (!pl) { pl = rd.plans[p.id] = { room: p.ghost ? pick(startOpen) : 'garden', cards: [], afk: true }; }
      const r = startOpen.includes(pl.room) ? pl.room : 'garden';
      pos[p.id] = r; planned[p.id] = r;
    });
    const plays = [];
    this.players.forEach(p => (rd.plans[p.id].cards || []).forEach(c => plays.push({ ...c, from: p.id })));
    this.players.forEach(p => {
      (rd.plans[p.id].cards || []).map(c => c.idx).sort((a, b) => b - a).forEach(i => p.hand.splice(i, 1));
    });
    const liv = () => this.players.filter(p => !p.ghost);
    const of = (k) => plays.filter(c => c.card === k);
    const prot = new Set(of('lawyer').map(c => c.from));
    const openNow = () => this.openRooms();

    const shield = (c, tid) => {
      const t = this.get(tid);
      if (prot.has(tid)) { ev.push({ k: 'ev.blocked', card: c.card, from: c.from, to: tid }); return true; }
      if (t.role === 'cat' && t.catLives > 0) { t.catLives--; ev.push({ k: 'ev.bounced', card: c.card, from: c.from, to: tid }); return true; }
      return false;
    };

    of('lawyer').forEach(c => ev.push({ k: 'rv.lawyer', card: 'lawyer', from: c.from }));
    of('forgery').forEach(c => ev.push({ k: 'rv.forgery', card: 'forgery', from: c.from }));
    rd.forgery = new Set(of('forgery').map(c => c.from));

    of('tape').forEach(c => {
      if (rd.closed.has(c.target)) return;
      rd.closed.add(c.target);
      const moved = {};
      liv().filter(p => pos[p.id] === c.target).forEach(p => { pos[p.id] = 'garden'; moved[p.id] = 'garden'; });
      ev.push({ k: 'rv.tape', card: 'tape', from: c.from, room: c.target, moved });
    });

    const blackouts = of('blackout');
    if (blackouts.length || fx.forceBlackout) {
      const moved = {};
      liv().forEach(p => { if (prot.has(p.id)) return; const r = pick(openNow()); pos[p.id] = r; moved[p.id] = r; });
      ev.push({ k: blackouts.length ? 'rv.blackout' : 'ev.storm', card: 'blackout', from: blackouts.length ? blackouts[0].from : null, moved });
    }
    of('lure').forEach(c => {
      if (pos[c.target] === 'garden') { ev.push({ k: 'ev.gardenSafe', card: 'lure', from: c.from, to: c.target }); return; }
      if (shield(c, c.target)) return;
      const r = pos[c.from]; pos[c.target] = r;
      ev.push({ k: 'rv.lure', card: 'lure', from: c.from, to: c.target, room: r, moved: { [c.target]: r } });
    });
    of('banana').forEach(c => {
      if (pos[c.target] === 'garden') { ev.push({ k: 'ev.gardenSafe', card: 'banana', from: c.from, to: c.target }); return; }
      if (shield(c, c.target)) return;
      const others = openNow().filter(r => r !== pos[c.target]);
      const r = pick(others.length ? others : openNow()); pos[c.target] = r;
      ev.push({ k: 'rv.banana', card: 'banana', from: c.from, to: c.target, room: r, moved: { [c.target]: r } });
    });

    const inGarden = id => pos[id] === 'garden';
    of('thief').forEach(c => {
      if (inGarden(c.target)) { ev.push({ k: 'ev.gardenSafe', card: 'thief', from: c.from, to: c.target }); return; }
      if (shield(c, c.target)) return;
      const t = this.transfer(this.get(c.target), this.get(c.from), 60 * (fx.thiefMult || 1));
      ev.push({ k: 'rv.thief', card: 'thief', from: c.from, to: c.target, n: t });
    });
    of('extortion').forEach(c => {
      const room = pos[c.from];
      let total = 0;
      if (room !== 'garden') {
        liv().filter(p => p.id !== c.from && pos[p.id] === room && !prot.has(p.id)).forEach(v => {
          if (v.role === 'cat' && v.catLives > 0) { v.catLives--; return; }
          total += this.transfer(v, this.get(c.from), 30);
        });
      }
      ev.push({ k: 'rv.extortion', card: 'extortion', from: c.from, room, n: total });
    });
    of('gift').forEach(c => {
      const from = this.get(c.from);
      if (!from.heirlooms.length) return;
      if (inGarden(c.target)) { ev.push({ k: 'ev.gardenSafe', card: 'gift', from: c.from, to: c.target }); return; }
      if (shield(c, c.target)) return;
      const h = from.heirlooms.splice(Math.floor(Math.random() * from.heirlooms.length), 1)[0];
      this.get(c.target).heirlooms.push(h);
      ev.push({ k: 'rv.gift', card: 'gift', from: c.from, to: c.target, h });
    });

    rd.pos = pos;
    // Duelle bestimmen
    const occ = r => this.players.filter(p => !p.ghost && pos[p.id] === r);
    const groups = [];
    const alarmAt = fx.vaultAlarmAt || 3;
    if (this.rooms.includes('vault') && !fx.vaultShare && !rd.closed.has('vault')) {
      const v = occ('vault');
      if (v.length === 2 && alarmAt > 2) groups.push({ room: 'vault', pids: v.map(p => p.id) });
    }
    if (!rd.closed.has('bedroom') && occ('bedroom').length >= 2) groups.push({ room: 'bedroom', pids: occ('bedroom').map(p => p.id) });
    if (fx.duelAll) {
      this.rooms.forEach(r => {
        if (groups.some(g => g.room === r) || rd.closed.has(r)) return;
        const o = occ(r);
        if (o.length >= 2 && !(r === 'vault' && o.length >= alarmAt && !fx.vaultShare)) groups.push({ room: r, pids: o.map(p => p.id) });
      });
    }
    rd.groups = groups;
    this.setPhase('reveal', { planned, final: pos, events: ev, closed: [...rd.closed] });
    const dur = 4 + ev.length * 2.4 + 1.5;
    this.after(dur, () => (groups.length ? this.startDuel() : this.settle({})));
  }

  /* ---------------- Duell ---------------- */
  startDuel() {
    const type = this.fx.game || pick(D.DUEL_TYPES);
    let q = null;
    if (type === 'estimate') {
      if (!this.questionDeck.length) this.questionDeck = shuffle(D.QUESTIONS.map(x => x.id));
      q = this.questionDeck.shift();
    }
    const pids = this.rd.groups.flatMap(g => g.pids);
    this.rd.duel = { type, q, scores: {} };
    this.setPhase('duel', { stage: 'intro', type, q, groups: this.rd.groups, pids, reverse: !!this.fx.reverseDuel });
    this.after(6, () => this.duelPlay());
  }
  duelPlay() {
    const d = this.rd.duel;
    const time = { tap: 7, reaction: 10, estimate: 20, stopwatch: 13 }[d.type];
    this.setPhase('duel', { ...this.pd, stage: 'play', playTime: time });
    this.pd.pids.forEach(id => { const p = this.get(id); if (p.isBot) d.scores[id] = this.botScore(d.type, d.q); });
    this.after(time + 1, () => this.duelResult());
    this.checkDuelDone();
  }
  botScore(type, q) {
    switch (type) {
      case 'tap': return randInt(18, 52);
      case 'reaction': return Math.random() < 0.12 ? -1 : randInt(230, 520);
      case 'estimate': { const a = D.QUESTION_BY_ID[q].answer; return Math.max(0, Math.round(a * (0.5 + Math.random()))); }
      case 'stopwatch': return randInt(4300, 5800);
    }
    return 0;
  }
  submitDuel(p, score) {
    if (this.phase !== 'duel' || this.pd.stage !== 'play' || !p || !this.pd.pids.includes(p.id)) return;
    const d = this.rd.duel;
    if (d.scores[p.id] !== undefined) return;
    const s = Number(score);
    d.scores[p.id] = Number.isFinite(s) ? s : null;
    this.changed();
    this.checkDuelDone();
  }
  checkDuelDone() {
    if (this.phase !== 'duel' || this.pd.stage !== 'play') return;
    const need = this.pd.pids.filter(id => this.active(this.get(id)));
    if (need.every(id => this.rd.duel.scores[id] !== undefined)) this.after(1, () => this.duelResult());
  }
  badness(type, s, q) {
    if (s == null || !Number.isFinite(s)) return Infinity;
    switch (type) {
      case 'tap': return -s;
      case 'reaction': return s < 0 ? Infinity : s;
      case 'estimate': return Math.abs(s - D.QUESTION_BY_ID[q].answer);
      case 'stopwatch': return Math.abs(s - 5000);
    }
    return Infinity;
  }
  duelResult() {
    if (this.phase !== 'duel') return;
    const d = this.rd.duel;
    const ranking = {}, winners = {};
    this.rd.groups.forEach(g => {
      const arr = g.pids.map(id => ({ id, b: this.badness(d.type, d.scores[id], d.q), r: Math.random() }));
      arr.forEach(x => { if (Number.isFinite(x.b) && this.fx.reverseDuel) x.b = -x.b; });
      arr.sort((a, b) => (a.b === b.b ? a.r - b.r : (a.b < b.b ? -1 : 1)));
      ranking[g.room] = arr.map(x => x.id);
      winners[g.room] = arr[0].id;
    });
    this.setPhase('duel', { ...this.pd, stage: 'result', scores: { ...d.scores }, ranking, winners, answer: d.q ? D.QUESTION_BY_ID[d.q].answer : null });
    this.after(8, () => this.settle(ranking));
  }

  /* ---------------- Abrechnung ---------------- */
  settle(ranking) {
    const fx = this.fx, rd = this.rd, pos = rd.pos;
    const R = {};
    const line = (room, k, p = {}, pid = null, a = null) => { (R[room] = R[room] || []).push({ k, p, pid, a }); };
    const neighbour = (p) => { const i = this.players.indexOf(p); const L = this.players.length; return this.players[(i - 1 + L) % L]; };
    const income = (p, room, amount, k) => {
      let a = amount;
      if (a > 0) a = Math.round(a * this.mult(room) * (rd.forgery.has(p.id) ? 2 : 1));
      else if (room === 'cellar') a = Math.round(a * this.mult(room));
      if (a > 0 && fx.mirror) {
        const to = neighbour(p);
        this.give(to, a);
        line(room, 'ev.mirror', { a: p.name, b: to.name, n: a }, to.id, a);
        return;
      }
      const real = this.give(p, a);
      line(room, k, { a: p.name, n: Math.abs(real) }, p.id, real);
    };
    const occ = r => this.players.filter(p => !p.ghost && pos[p.id] === r);

    for (const room of this.rooms) {
      if (rd.closed.has(room) && room !== 'garden') continue;
      const o = occ(room);
      if (!o.length) continue;
      switch (room) {
        case 'vault': {
          const alarmAt = fx.vaultAlarmAt || 3;
          if (fx.vaultShare) { const each = Math.floor(fx.vaultShare / o.length); o.forEach(p => income(p, room, each, 'ev.share')); }
          else if (o.length >= alarmAt) { line(room, 'ev.alarm'); o.forEach(p => income(p, room, -50, 'ev.lost')); }
          else if (o.length === 1) income(o[0], room, 150, 'ev.vaultSolo');
          else {
            const rk = ranking.vault || shuffle(o.map(p => p.id));
            income(this.get(rk[0]), room, 150, 'ev.duelWin');
            rk.slice(1).forEach(id => income(this.get(id), room, 40, 'ev.duelLose'));
          }
          break;
        }
        case 'kitchen':
          o.forEach(p => {
            if (fx.kitchenPoison) { income(p, room, -60, 'ev.poison'); this.drawCard(p, 2); line(room, 'ev.cards', { a: p.name, n: 2 }, p.id); }
            else { this.drawCard(p); line(room, 'ev.cards', { a: p.name, n: 1 }, p.id); }
          });
          break;
        case 'library':
          o.forEach(p => {
            income(p, room, 40 + ((fx.bonus && fx.bonus.library) || 0), 'ev.read');
            const unknown = this.players.filter(q => q !== p && !(q.id in p.known));
            if (unknown.length) { const q = pick(unknown); p.known[q.id] = q.role; rd.learned[p.id] = q.id; }
          });
          break;
        case 'bedroom': {
          const rk = o.length === 1 ? [o[0].id] : (ranking.bedroom || shuffle(o.map(p => p.id)));
          const n = fx.bedroomTwo ? 2 : 1;
          rk.slice(0, n).forEach(id => {
            const p = this.get(id);
            const h = this.heirloomDeck.shift();
            if (h) { p.heirlooms.push(h); line(room, 'ev.heirloom', { a: p.name, h }, id); }
            else income(p, room, 100, 'ev.noHeirloom');
          });
          rk.slice(n).forEach(id => line(room, 'ev.empty', { a: this.get(id).name }, id));
          break;
        }
        case 'cellar':
          o.forEach(p => {
            const r = Math.random();
            if (r < 0.45) income(p, room, 180, 'ev.jackpot');
            else if (r < 0.8) income(p, room, -90, 'ev.cellarLoss');
            else line(room, 'ev.rats', { a: p.name }, p.id);
          });
          break;
        case 'garden':
          if (fx.gardenPot) { const each = Math.floor(fx.gardenPot / o.length); o.forEach(p => income(p, room, each, 'ev.share')); }
          else o.forEach(p => income(p, room, 20, 'ev.garden'));
          break;
        case 'attic': o.forEach(p => { income(p, room, 30, 'ev.attic'); this.drawCard(p); }); break;
        case 'ballroom': { const each = Math.floor(300 / o.length); o.forEach(p => income(p, room, each, 'ev.share')); break; }
      }
      if (fx.duelAll && ranking[room] && o.length >= 2) income(this.get(ranking[room][0]), room, fx.duelAll, 'ev.feud');
    }

    // Geister spuken
    this.players.filter(p => p.ghost).forEach(g => {
      const room = pos[g.id];
      const victims = this.players.filter(p => !p.ghost && pos[p.id] === room);
      let total = 0;
      victims.forEach(v => { total += this.transfer(v, g, 25); });
      if (victims.length) line(room, 'ev.haunt', { a: g.name, n: total }, g.id, total);
    });

    // Nachwirkungen der Klausel
    const extra = [];
    const xl = (k, p = {}, pid = null, a = null) => extra.push({ k, p, pid, a });
    const n = fx.n;
    switch (fx.after) {
      case 'alone': this.rooms.forEach(r => { const o = occ(r); if (o.length === 1) { this.give(o[0], n); xl('x.got', { a: o[0].name, n }, o[0].id, n); } }); break;
      case 'crowd': this.rooms.forEach(r => { const o = occ(r); if (o.length >= 3) o.forEach(p => { const t = -this.give(p, -n); xl('x.paid', { a: p.name, n: t }, p.id, -t); }); }); break;
      case 'sticky': {
        const rich = this.richest();
        if (rich) occ(pos[rich.id]).filter(p => p !== rich).forEach(p => { const t = this.transfer(rich, p, n); xl('x.sticky', { a: p.name, b: rich.name, n: t }, p.id, t); });
        break;
      }
      case 'mostCrowded': {
        let max = 0; this.rooms.forEach(r => { max = Math.max(max, occ(r).length); });
        if (max >= 2) this.rooms.filter(r => occ(r).length === max).forEach(r => occ(r).forEach(p => { const t = -this.give(p, -n); xl('x.paid', { a: p.name, n: t }, p.id, -t); }));
        break;
      }
      case 'leastCrowded': {
        let min = 99; this.rooms.forEach(r => { const c = occ(r).length; if (c > 0) min = Math.min(min, c); });
        this.rooms.filter(r => occ(r).length === min).forEach(r => occ(r).forEach(p => { this.give(p, n); xl('x.got', { a: p.name, n }, p.id, n); }));
        break;
      }
      case 'noCardBonus':
        this.living().filter(p => !(rd.plans[p.id].cards || []).length).forEach(p => { this.give(p, n); xl('x.got', { a: p.name, n }, p.id, n); });
        break;
    }
    if (!extra.length && fx.after) xl('x.none');

    const { newGhosts, revived } = this.ghostCheck();
    const rooms = this.rooms.filter(r => R[r]).map(r => ({ room: r, lines: R[r] }));
    this.setPhase('results', { rooms, extra, deltas: { ...rd.deltas }, newGhosts, revived, final: pos });
    this.after(Math.min(16, 7 + rooms.length * 1.2), () => (fx.vote != null ? this.startVote() : this.endRound()));
  }

  ghostCheck() {
    const newGhosts = [], revived = [];
    this.players.forEach(p => {
      if (!p.ghost && p.money <= 0) { p.ghost = true; p.money = 0; newGhosts.push(p.id); }
      else if (p.ghost && p.money >= 100) { p.ghost = false; revived.push(p.id); }
    });
    return { newGhosts, revived };
  }

  /* ---------------- Abstimmung ---------------- */
  startVote() {
    this.rd.votes = {};
    this.setPhase('vote', { stage: 'vote', clause: this.clause.id, amount: this.fx.vote });
    this.players.filter(p => p.isBot).forEach(p => { this.rd.votes[p.id] = pick(this.players.filter(q => q !== p)).id; });
    this.after(30, () => this.voteResult());
    this.checkVoteDone();
  }
  submitVote(p, target) {
    if (this.phase !== 'vote' || this.pd.stage !== 'vote' || !p) return;
    if (!this.get(target) || target === p.id) return;
    this.rd.votes[p.id] = target;
    this.changed();
    this.checkVoteDone();
  }
  checkVoteDone() {
    if (this.phase !== 'vote' || this.pd.stage !== 'vote') return;
    const need = this.players.filter(p => this.active(p));
    if (need.every(p => this.rd.votes[p.id])) this.after(1, () => this.voteResult());
  }
  voteResult() {
    if (this.phase !== 'vote') return;
    const counts = {};
    Object.values(this.rd.votes).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    let max = 0; Object.values(counts).forEach(c => { max = Math.max(max, c); });
    const top = Object.keys(counts).filter(k => counts[k] === max && max > 0);
    let winner = null, applied = 0;
    if (top.length) {
      winner = pick(top);
      applied = this.give(this.get(winner), this.fx.vote);
    }
    const { newGhosts, revived } = this.ghostCheck();
    this.setPhase('vote', { ...this.pd, stage: 'result', counts, winner, applied, tie: top.length > 1, newGhosts, revived });
    this.after(8, () => this.endRound());
  }

  endRound() {
    if (this.round >= this.totalRounds) this.startFinalVote();
    else this.startRound();
  }

  /* ---------------- Finale ---------------- */
  startFinalVote() {
    const qs = ['butler', 'kid'].filter(r => this.players.some(p => p.role === r));
    if (!qs.length) return this.startFinale();
    this.fv = { qs, votes: {} };
    this.setPhase('finalvote', { qs });
    this.players.filter(p => p.isBot).forEach(p => {
      const v = {}; qs.forEach(q => { v[q] = pick(this.players.filter(x => x !== p)).id; });
      this.fv.votes[p.id] = v;
    });
    this.after(45, () => this.startFinale());
    this.checkFinalDone();
  }
  submitFinalVote(p, votes) {
    if (this.phase !== 'finalvote' || !p || !votes) return;
    const v = {};
    for (const q of this.fv.qs) {
      const t = votes[q];
      if (!this.get(t) || t === p.id) return;
      v[q] = t;
    }
    this.fv.votes[p.id] = v;
    this.changed();
    this.checkFinalDone();
  }
  checkFinalDone() {
    if (this.phase !== 'finalvote') return;
    const need = this.players.filter(p => this.active(p));
    if (need.every(p => this.fv.votes[p.id])) this.after(1, () => this.startFinale());
  }

  startFinale() {
    clearTimeout(this.timer); this.timer = null; this.endsAt = null;
    const P = this.players;
    const steps = [];
    const before = Object.fromEntries(P.map(p => [p.id, p.money]));

    P.forEach(p => {
      if (!p.heirlooms.length) return;
      const items = p.heirlooms.map(h => ({ h, v: D.HEIRLOOM_BY_ID[h].value }));
      const total = items.reduce((s, i) => s + i.v, 0);
      p.money = Math.max(0, p.money + total);
      steps.push({ t: 'heirlooms', pid: p.id, items, total });
    });

    const fv = this.fv || { qs: [], votes: {} };
    fv.qs.forEach(role => {
      const real = P.find(p => p.role === role);
      const counts = {};
      Object.values(fv.votes).forEach(v => { if (v[role]) counts[v[role]] = (counts[v[role]] || 0) + 1; });
      let max = 0; Object.values(counts).forEach(c => { max = Math.max(max, c); });
      const top = Object.keys(counts).filter(k => counts[k] === max && max > 0);
      const caught = top.includes(real.id);
      const correct = Object.entries(fv.votes).filter(([pid, v]) => v[role] === real.id && pid !== real.id).map(([pid]) => pid);
      correct.forEach(pid => { this.get(pid).money += 80; });
      let effect = null;
      if (!caught) {
        if (role === 'butler') {
          let sum = 0;
          P.forEach(p => { if (p !== real) { const t = Math.floor(p.money * 0.15); p.money -= t; sum += t; } });
          real.money += sum; effect = { stole: sum };
        } else {
          const b = Math.floor(real.money * 0.5); real.money += b; effect = { bonus: b };
        }
      }
      steps.push({ t: 'role', role, real: real.id, accused: top, counts, caught, correct, effect });
    });

    const cat = P.find(p => p.role === 'cat');
    if (cat) {
      const min = Math.min(...P.map(p => p.money));
      const isPoorest = cat.money === min;
      if (isPoorest) cat.money += 400;
      steps.push({ t: 'cat', pid: cat.id, poorest: isPoorest });
    }

    if (this.families) {
      const sums = this.families.map(f => ({ id: f.id, members: f.members, sum: f.members.reduce((s, id) => s + this.get(id).money, 0) }));
      sums.sort((a, b) => b.sum - a.sum);
      sums[0].members.forEach(id => { this.get(id).money += 100; });
      steps.push({ t: 'family', ranking: sums });
    }

    steps.push({ t: 'roles', roles: Object.fromEntries(P.map(p => [p.id, p.role])) });
    const ranking = [...P].sort((a, b) => b.money - a.money).map(p => ({ pid: p.id, money: p.money, before: before[p.id] }));
    steps.push({ t: 'podium', ranking });
    this.setPhase('finale', { steps, ranking });
  }

  /* ---------------- Sichten ---------------- */
  isDone(p) {
    switch (this.phase) {
      case 'plan': return !!(this.rd && this.rd.plans[p.id]);
      case 'duel': return this.pd.stage === 'play' && this.rd.duel.scores[p.id] !== undefined;
      case 'vote': return !!(this.rd && this.rd.votes && this.rd.votes[p.id]);
      case 'finalvote': return !!(this.fv && this.fv.votes[p.id]);
    }
    return false;
  }

  publicState() {
    return {
      code: this.code, phase: this.phase, pd: this.pd, round: this.round, totalRounds: this.totalRounds,
      endsAt: this.endsAt, now: Date.now(), lang: this.lang, settings: this.settings,
      joinUrl: this.joinUrl, qr: this.qr, rooms: this.rooms,
      closed: this.rd ? [...this.rd.closed] : [],
      clause: this.clause ? this.clause.id : null,
      families: this.families ? this.families.map(f => ({ id: f.id, members: f.members })) : null,
      players: this.players.map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, color: p.color, money: p.money, ghost: p.ghost,
        connected: p.connected, isBot: p.isBot, family: p.family, heirlooms: p.heirlooms,
        cards: p.hand.length, lastDelta: p.lastDelta, done: this.isDone(p)
      }))
    };
  }

  privateState(p) {
    const rd = this.rd;
    return {
      id: p.id, name: p.name, avatar: p.avatar, color: p.color, lang: p.lang, money: p.money,
      role: this.phase === 'lobby' ? null : p.role, hand: p.hand, heirlooms: p.heirlooms, known: p.known,
      ghost: p.ghost, catLives: p.role === 'cat' ? p.catLives : null, family: p.family,
      plan: rd && rd.plans ? rd.plans[p.id] || null : null,
      duelScore: rd && rd.duel ? rd.duel.scores[p.id] : undefined,
      vote: rd && rd.votes ? rd.votes[p.id] || null : null,
      finalVote: this.fv ? this.fv.votes[p.id] || null : null,
      learned: rd && rd.learned && rd.learned[p.id] ? { pid: rd.learned[p.id], role: p.known[rd.learned[p.id]] } : null
    };
  }
}

module.exports = Game;
