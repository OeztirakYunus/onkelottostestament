'use strict';
/*
 * Zusatz-Features für Onkel Ottos Testament:
 * Zuschauer-Wetten & Sabotage, Foto-Streiche & Gesucht-Plakat, Selfie-Abstimmungen,
 * Handel & Verträge, Erbstück-Auktion, Plot-Twists, Preisverleihung.
 */
const D = require('../shared/data');

const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

module.exports = function install(Game) {
  const G = Game.prototype;

  G.resetFeatures = function () {
    this.deals = [];
    this.dealId = 1;
    this.twistsDone = 0;
    this.twistDeck = shuffle(Object.keys(D.TWISTS));
    if (process.env.OTTO_TWISTS) { // nur zum Testen: bestimmte Twists erzwingen
      const list = process.env.OTTO_TWISTS.split(',').filter(t => D.TWISTS[t]);
      this.twistDeck = [...list, ...this.twistDeck.filter(t => !list.includes(t))];
      this.forceTwists = true;
    }
    this.selfies = new Map();
    if (!this.onSabotage) this.onSabotage = () => {};
    if (!this.onDeal) this.onDeal = () => {};
    if (!this.onDealEvent) this.onDealEvent = () => {};
  };

  /* ================= Foto-Streiche & Gesucht-Plakat ================= */
  G.prank = function (pid, kind) {
    const p = this.get(pid);
    if (!p) return null;
    p.prank = { kind: kind || pick(D.PRANKS), until: this.round + 1 };
    return p.prank.kind;
  };
  G.markWanted = function () {
    this.rd.wanted = null;
    const liv = this.living();
    if (this.round < 2 || liv.length < 3) return;
    const r = this.ranked();
    if (r[0] && r[1] && r[0].money > r[1].money) this.rd.wanted = r[0].id;
  };
  // Opfer zählen und Kopfgeld auf den Gesuchten auszahlen
  G.robbed = function (fromId, toId, ev) {
    const to = this.get(toId);
    if (to) to.stats.robbed++;
    if (this.rd.wanted && toId === this.rd.wanted && !this.rd.bountyPaid) {
      this.rd.bountyPaid = true;
      const n = this.give(this.get(fromId), 50);
      ev.push({ k: 'rv.bounty', card: 'bounty', from: fromId, to: toId, n });
    }
  };

  /* ================= Zuschauer-Wetten ================= */
  G.submitBet = function (p, on, amount) {
    if (this.phase !== 'duel' || !['intro', 'play'].includes(this.pd.stage) || !p || p.ghost) return { error: 'phase' };
    if (this.pd.pids.includes(p.id) || !this.pd.pids.includes(on)) return { error: 'target' };
    const a = Math.floor(Number(amount) / 10) * 10;
    if (!(a >= 10 && a <= Math.min(200, p.money))) return { error: 'amount' };
    this.rd.bets[p.id] = { on, amount: a };
    this.changed();
    return { ok: true };
  };
  G.botBets = function () {
    this.players.filter(p => p.isBot && !p.ghost && !this.pd.pids.includes(p.id) && p.money >= 20 && Math.random() < 0.5)
      .forEach(p => { this.rd.bets[p.id] = { on: pick(this.pd.pids), amount: randInt(1, Math.min(5, Math.floor(p.money / 10))) * 10 }; });
  };
  G.settleBets = function (winners) {
    const out = [];
    Object.entries(this.rd.bets || {}).forEach(([pid, b]) => {
      const p = this.get(pid);
      const g = this.rd.groups.find(x => x.pids.includes(b.on));
      if (!p || !g) return;
      const won = winners[g.room] === b.on;
      const delta = won ? this.give(p, b.amount * (g.pids.length - 1)) : this.give(p, -b.amount);
      p.stats.betProfit += delta;
      out.push({ pid, on: b.on, amount: b.amount, delta });
    });
    return out.sort((a, b) => b.delta - a.delta);
  };

  /* ================= Sabotage ================= */
  G.submitSabotage = function (p, to, kind) {
    if (this.phase !== 'duel' || this.pd.stage !== 'play' || !p) return { error: 'phase' };
    if (this.pd.pids.includes(p.id) || !this.pd.pids.includes(to) || !D.SABOTAGE[kind]) return { error: 'target' };
    const used = this.rd.sab[p.id] || 0;
    if (used >= D.SABOTAGE_MAX) return { error: 'empty' };
    this.rd.sab[p.id] = used + 1;
    p.stats.sabThrown++;
    this.get(to).stats.sabGot++;
    this.onSabotage({ from: p.id, to, kind });
    this.changed();
    return { ok: true };
  };
  G.botSabotage = function (time) {
    const bots = this.players.filter(p => p.isBot && !this.pd.pids.includes(p.id));
    bots.forEach(b => {
      if (Math.random() < 0.5) return;
      const n = randInt(1, 2);
      for (let i = 0; i < n; i++) {
        this.later(randInt(1500, Math.max(2000, (time - 2) * 1000)), () => {
          if (this.phase === 'duel' && this.pd.stage === 'play') this.submitSabotage(b, pick(this.pd.pids), pick(Object.keys(D.SABOTAGE)));
        });
      }
    });
  };

  /* ================= Selfie-Abstimmung ================= */
  G.startSelfie = function () {
    this.rd.selfies = {};
    this.selfies = new Map();
    this.setPhase('vote', { stage: 'selfie', clause: this.clause.id, amount: this.fx.vote });
    this.after(30, () => this.finishSelfie());
    this.checkSelfieDone();
  };
  G.submitSelfie = function (p, dataUrl) {
    if (this.phase !== 'vote' || this.pd.stage !== 'selfie' || !p) return { error: 'phase' };
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) return { error: 'photo' };
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < 200 || buf.length > 180 * 1024) return { error: 'photo' };
    this.selfies.set(p.id, { buf, type: 'image/' + m[1] });
    this.rd.selfies[p.id] = true;
    this.changed();
    this.checkSelfieDone();
    return { ok: true };
  };
  G.checkSelfieDone = function () {
    if (this.phase !== 'vote' || this.pd.stage !== 'selfie') return;
    const need = this.players.filter(p => !p.isBot && p.connected);
    if (need.every(p => this.rd.selfies[p.id])) this.after(1, () => this.finishSelfie());
  };
  G.finishSelfie = function () {
    if (this.phase !== 'vote' || this.pd.stage !== 'selfie') return;
    this.rd.selfieDone = true;
    this.rd.selfieCands = Object.keys(this.rd.selfies);
    this.startVote();
  };

  /* ================= Handel & Verträge ================= */
  G.dealsFor = function (p) { return this.deals.filter(d => d.from === p.id || d.to === p.id); };
  G.pushDeal = function (d) { this.onDeal(d, [d.from, d.to]); };
  G.proposeDeal = function (p, o) {
    if (!p || ['lobby', 'finale'].includes(this.phase) || !o) return { error: 'phase' };
    const to = this.get(o.to);
    if (!to || to === p) return { error: 'target' };
    if (this.deals.filter(d => d.from === p.id && d.status === 'open').length >= 3) return { error: 'tooMany' };
    const giveMoney = Math.max(0, Math.floor(Number(o.giveMoney) || 0));
    const wantMoney = Math.max(0, Math.floor(Number(o.wantMoney) || 0));
    const giveCard = o.giveCard != null && p.hand[o.giveCard] ? p.hand[o.giveCard] : null;
    let promise = null;
    if (D.PROMISES.includes(o.promise)) promise = { key: o.promise };
    else if (typeof o.promise === 'string' && o.promise.trim()) promise = { text: o.promise.replace(/\s+/g, ' ').trim().slice(0, 80) };
    if (giveMoney > p.money) return { error: 'money' };
    if (!giveMoney && !wantMoney && !giveCard && !promise) return { error: 'empty' };
    const d = { id: this.dealId++, from: p.id, to: to.id, giveMoney, wantMoney, giveCard, promise, status: 'open', ts: Date.now() };
    this.deals.push(d);
    this.pushDeal(d);
    if (to.isBot) this.later(randInt(1500, 4000), () => {
      if (d.status !== 'open') return;
      const fair = giveMoney + (giveCard ? 30 : 0) + 10 >= wantMoney;
      this.respondDeal(to, d.id, fair && Math.random() < 0.75);
    });
    return { ok: true, deal: d };
  };
  G.respondDeal = function (p, id, accept) {
    const d = this.deals.find(x => x.id === id);
    if (!p || !d || d.to !== p.id || d.status !== 'open') return { error: 'deal' };
    const from = this.get(d.from);
    if (!accept) { d.status = 'declined'; this.pushDeal(d); return { ok: true }; }
    if (!from || from.money < d.giveMoney) { d.status = 'failed'; this.pushDeal(d); return { error: 'money' }; }
    if (p.money < d.wantMoney) return { error: 'money' };
    if (d.giveCard) {
      const idx = from.hand.indexOf(d.giveCard);
      if (idx < 0) { d.status = 'failed'; this.pushDeal(d); return { error: 'card' }; }
      from.hand.splice(idx, 1);
      p.hand.push(d.giveCard);
      if (p.hand.length > D.HAND_MAX) p.hand.shift();
    }
    if (d.giveMoney) this.transfer(from, p, d.giveMoney);
    if (d.wantMoney) this.transfer(p, from, d.wantMoney);
    d.status = 'accepted';
    this.pushDeal(d);
    this.onDealEvent({ type: 'signed', a: d.from, b: d.to });
    this.changed();
    return { ok: true };
  };
  G.cancelDeal = function (p, id) {
    const d = this.deals.find(x => x.id === id);
    if (!p || !d || d.from !== p.id || d.status !== 'open') return { error: 'deal' };
    d.status = 'cancelled';
    this.pushDeal(d);
    return { ok: true };
  };
  // Vertragsbruch melden: der andere wird öffentlich als Schlange gebrandmarkt
  G.accuseDeal = function (p, id) {
    const d = this.deals.find(x => x.id === id);
    if (!p || !d || d.status !== 'accepted' || (d.from !== p.id && d.to !== p.id)) return { error: 'deal' };
    const accusedId = d.from === p.id ? d.to : d.from;
    d.status = 'broken'; d.brokenBy = accusedId; d.accuser = p.id;
    const accused = this.get(accusedId);
    accused.stats.broken++;
    this.prank(accusedId, 'snake');
    this.pushDeal(d);
    this.onDealEvent({ type: 'broken', a: p.id, b: accusedId, promise: d.promise });
    this.changed();
    return { ok: true };
  };

  /* ================= Erbstück-Auktion ================= */
  G.maybeAuction = function (next) {
    const due = this.round % 3 === 0 && this.round < this.totalRounds && this.heirloomDeck.length && this.living().length >= 2;
    if (!due && !process.env.OTTO_AUCTION_EVERY) return next();
    if (!this.heirloomDeck.length) return next();
    this.afterAuction = next;
    const h = this.heirloomDeck.shift();
    this.rd.auction = { h, bids: {} };
    this.setPhase('auction', { stage: 'bid', h });
    this.players.filter(p => p.isBot).forEach(p => {
      this.rd.auction.bids[p.id] = p.ghost || Math.random() < 0.3 ? 0 : Math.min(p.money, randInt(1, 14) * 10);
    });
    this.after(22, () => this.auctionResult());
    this.checkAuctionDone();
  };
  G.submitBid = function (p, amount) {
    if (this.phase !== 'auction' || this.pd.stage !== 'bid' || !p) return { error: 'phase' };
    const a = Math.max(0, Math.floor(Number(amount) || 0));
    if (a > p.money || (p.ghost && a > 0)) return { error: 'money' };
    this.rd.auction.bids[p.id] = a;
    this.changed();
    this.checkAuctionDone();
    return { ok: true };
  };
  G.checkAuctionDone = function () {
    if (this.phase !== 'auction' || this.pd.stage !== 'bid') return;
    const need = this.players.filter(p => this.active(p));
    if (need.every(p => this.rd.auction.bids[p.id] !== undefined)) this.after(1, () => this.auctionResult());
  };
  G.auctionResult = function () {
    if (this.phase !== 'auction' || this.pd.stage !== 'bid') return;
    const a = this.rd.auction;
    const bids = Object.entries(a.bids).map(([pid, amount]) => ({ pid, amount })).filter(b => b.amount > 0 && this.get(b.pid))
      .sort((x, y) => y.amount - x.amount || Math.random() - 0.5);
    let winner = null, price = 0;
    if (bids.length) {
      winner = bids[0].pid; price = bids[0].amount;
      const w = this.get(winner);
      price = -this.give(w, -price);
      w.heirlooms.push(a.h);
      w.stats.auctionSpent += price;
    } else this.heirloomDeck.push(a.h);
    this.setPhase('auction', { stage: 'result', h: a.h, bids, winner, price });
    this.after(9, () => { const n = this.afterAuction; this.afterAuction = null; n(); });
  };

  /* ================= Plot-Twists ================= */
  G.maybeTwist = function (next) {
    const r = this.round; // die nächste Runde ist r + 1
    const allowed = r >= 1 && r + 1 < this.totalRounds && this.twistsDone < 3;
    const chance = this.forceTwists ? 1 : 0.3;
    if (!allowed || Math.random() > chance) return next();
    let type = null;
    while (this.twistDeck.length && !type) {
      const t = this.twistDeck.shift();
      if (this.twistOk(t)) type = t;
    }
    if (!type) return next();
    this.twistsDone++;
    this.afterTwist = next;
    this.rd = this.rd || { deltas: {}, plans: {}, closed: new Set(), learned: {} };
    this.rd.twistIn = {};
    this.players.forEach(p => { p.lastDelta = 0; });
    const meta = D.TWISTS[type];
    if (meta.interactive === 'hide') {
      this.setPhase('twist', { type, stage: 'act', rooms: this.rooms });
      this.players.filter(p => p.isBot).forEach(p => { this.rd.twistIn[p.id] = pick(this.rooms); });
      this.after(18, () => this.twistResolve());
    } else if (meta.interactive === 'tap') {
      this.setPhase('twist', { type, stage: 'intro' });
      this.after(7, () => {
        this.setPhase('twist', { type, stage: 'act' });
        this.players.filter(p => p.isBot && !p.ghost).forEach(p => { this.rd.twistIn[p.id] = randInt(8, 32); });
        this.after(9, () => this.twistResolve());
        this.checkTwistDone();
      });
      return;
    } else {
      const lines = this.applyTwist(type);
      this.setPhase('twist', { type, stage: 'result', lines });
      this.after(12, () => this.endTwist());
      return;
    }
    this.checkTwistDone();
  };
  G.twistOk = function (t) {
    if (t === 'earthquake') return this.players.filter(p => p.heirlooms.length).length >= 1;
    if (t === 'role_swap') return this.players.length >= 3 && this.players.some(p => p.role !== 'relative');
    return true;
  };
  G.submitTwist = function (p, value) {
    if (this.phase !== 'twist' || this.pd.stage !== 'act' || !p) return { error: 'phase' };
    if (this.pd.type === 'tax_raid') { if (!this.rooms.includes(value)) return { error: 'room' }; this.rd.twistIn[p.id] = value; }
    else if (this.pd.type === 'treasure_hunt') { if (p.ghost) return { error: 'ghost' }; const n = Math.max(0, Math.min(200, Math.floor(Number(value) || 0))); this.rd.twistIn[p.id] = n; }
    this.changed();
    this.checkTwistDone();
    return { ok: true };
  };
  G.checkTwistDone = function () {
    if (this.phase !== 'twist' || this.pd.stage !== 'act') return;
    const need = this.players.filter(p => this.active(p) && !(this.pd.type === 'treasure_hunt' && p.ghost));
    if (need.every(p => this.rd.twistIn[p.id] !== undefined)) this.after(1, () => this.twistResolve());
  };
  G.twistResolve = function () {
    if (this.phase !== 'twist' || this.pd.stage !== 'act') return;
    const type = this.pd.type;
    const lines = [];
    const L = (k, p = {}, pid = null, a = null) => lines.push({ k, p, pid, a });
    let extra = {};
    if (type === 'tax_raid') {
      const hidden = {};
      this.players.forEach(p => { hidden[p.id] = this.rd.twistIn[p.id] || pick(this.rooms); });
      const raid = pick(this.rooms);
      const caught = this.players.filter(p => !p.ghost && hidden[p.id] === raid);
      caught.forEach(p => { const n = -this.give(p, -Math.floor(p.money * 0.3)); L('tw.caught', { a: p.name, n }, p.id, -n); });
      if (!caught.length) L('tw.nobodyCaught', { r: raid });
      extra = { raid, hidden };
    }
    if (type === 'treasure_hunt') {
      const res = this.players.filter(p => !p.ghost).map(p => ({ p, n: this.rd.twistIn[p.id] || 0 })).sort((a, b) => b.n - a.n || Math.random() - 0.5);
      [150, 100, 50].forEach((prize, i) => { const r = res[i]; if (r && r.n > 0) { this.give(r.p, prize); L('tw.treasure', { a: r.p.name, n: prize, t: r.n }, r.p.id, prize); } });
      extra = { taps: Object.fromEntries(res.map(r => [r.p.id, r.n])) };
    }
    this.setPhase('twist', { type, stage: 'result', lines, ...extra });
    this.after(10, () => this.endTwist());
  };
  G.endTwist = function () {
    this.ghostCheck();
    const n = this.afterTwist; this.afterTwist = null;
    n();
  };
  G.applyTwist = function (type) {
    const lines = [];
    const L = (k, p = {}, pid = null, a = null) => lines.push({ k, p, pid, a });
    const liv = this.living();
    switch (type) {
      case 'otto_alive': { // Otto sammelt 20 % ein und verteilt alles gleichmäßig
        let pot = 0;
        liv.forEach(p => { pot += -this.give(p, -Math.floor(p.money * 0.2)); });
        const each = Math.floor(pot / Math.max(1, liv.length));
        liv.forEach(p => this.give(p, each));
        L('tw.otto', { n: pot, m: each });
        break;
      }
      case 'second_will': {
        const r = this.ranked();
        const rich = r[0];
        const poor = r.slice(-Math.min(3, Math.max(1, r.length - 1))).filter(p => p !== rich);
        if (rich && r.length >= 3) { const n = -this.give(rich, -150); L('tw.richLoses', { a: rich.name, n }, rich.id, -n); }
        poor.forEach(p => { this.give(p, 150); L('tw.poorGets', { a: p.name, n: 150 }, p.id, 150); });
        break;
      }
      case 'earthquake': {
        const all = shuffle(this.players.flatMap(p => p.heirlooms));
        const holders = this.players.map(p => p.heirlooms.length);
        const targets = shuffle(this.players);
        this.players.forEach(p => { p.heirlooms = []; });
        all.forEach((h, i) => targets[i % targets.length].heirlooms.push(h));
        L('tw.quake', { n: all.length });
        void holders;
        break;
      }
      case 'role_swap': {
        const special = this.players.filter(p => p.role !== 'relative');
        const a = pick(special);
        const b = pick(this.players.filter(p => p !== a));
        const ra = a.role, rb = b.role;
        a.role = rb; b.role = ra;
        [a, b].forEach(p => { p.catLives = p.role === 'cat' ? 3 : 0; p.roleChanged = this.round + 1; });
        L('tw.swapped');
        break;
      }
      case 'vultures':
        liv.forEach(p => { p.hand = []; this.drawCard(p, 2); });
        L('tw.vultures');
        break;
      case 'cousin_america': {
        let sum = 0;
        liv.forEach(p => { sum += -this.give(p, -Math.floor(p.money * 0.1)); });
        L('tw.cousin', { n: sum });
        break;
      }
    }
    return lines;
  };

  /* ================= Preisverleihung ================= */
  G.computeAwards = function () {
    const out = [];
    D.AWARDS.forEach(a => {
      let best = null, val = 0;
      shuffle(this.players).forEach(p => { const v = p.stats ? p.stats[a.id] : 0; if (v > val) { val = v; best = p; } });
      if (best && val > 0) out.push({ id: a.id, pid: best.id, n: val });
    });
    return shuffle(out).slice(0, 8);
  };
};
