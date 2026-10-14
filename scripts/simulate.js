'use strict';
/*
 * Simuliert komplette Partien mit Bots (2–15 Spieler), prüft Regeln & Übersetzungen.
 * Aufruf: npm test
 */
const Game = require('../server/game');
const D = require('../shared/data');
const I18N = require('../shared/i18n');

let errors = 0;
const fail = (m) => { errors++; console.error('  ✗', m); };

// 1) Übersetzungen vollständig?
const keysDe = Object.keys(I18N.de), keysTr = Object.keys(I18N.tr);
keysDe.filter(k => !(k in I18N.tr)).forEach(k => fail('TR fehlt: ' + k));
keysTr.filter(k => !(k in I18N.de)).forEach(k => fail('DE fehlt: ' + k));
const needed = [];
D.CLAUSES.forEach(c => { needed.push('clause.' + c.id); if (c.fx.vote != null) needed.push('vq.' + c.id); });
Object.keys(D.ROOMS).forEach(r => needed.push('room.' + r, 'roomd.' + r));
Object.keys(D.CARDS).forEach(c => needed.push('card.' + c, 'cardd.' + c));
Object.keys(D.ROLES).forEach(r => needed.push('role.' + r, 'roled.' + r));
D.HEIRLOOMS.forEach(h => needed.push('h.' + h.id));
D.QUESTIONS.forEach(q => needed.push('q.' + q.id));
D.DUEL_TYPES.forEach(t => needed.push('duel.' + t, 'dueld.' + t));
Object.keys(D.TWISTS).forEach(t => needed.push('twist.' + t, 'twistd.' + t, 'v.tw.' + t));
D.AWARDS.forEach(a => needed.push('award.' + a.id, 'awardd.' + a.id));
[...D.PRANKS, 'snake'].forEach(k => needed.push('prank.' + k));
Object.keys(D.SABOTAGE).forEach(k => needed.push('sab.' + k));
D.PROMISES.forEach(k => needed.push('promise.' + k));
['open', 'accepted', 'declined', 'cancelled', 'failed', 'broken'].forEach(k => needed.push('deal.' + k));
['trio', 'pair', 'not', 'photoSecret', 'photoPlain', 'none', 'swapped', 'src.lib', 'src.seer', 'src.photo', 'src.twist'].forEach(k => needed.push('clue.' + k));
if (Object.keys(D.TWISTS).length < 5) fail('Es müssen mindestens 5 Plot-Twists sein');
['de', 'tr'].forEach(l => needed.forEach(k => { if (!(k in I18N[l])) fail(`${l} fehlt: ${k}`); }));
if (D.CLAUSES.length < 100) fail('Es müssen mindestens 100 Klauseln sein, sind ' + D.CLAUSES.length);
if (D.DUEL_TYPES.length < 14) fail('Es müssen 14 Minispiele sein');
console.log(`Übersetzungen: ${keysDe.length} Schlüssel pro Sprache, ${D.CLAUSES.length} Klauseln`);

// Notar-Stimme: gibt es für jede Klausel und jede Abstimmungsfrage eine Aufnahme?
try {
  const fs = require('fs'), path = require('path');
  const man = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'voice', 'manifest.json'), 'utf8'));
  let missing = 0;
  ['de', 'tr'].forEach(l => Object.keys(I18N[l]).filter(k => /^(clause\.|vq\.|v\.)/.test(k)).forEach(k => {
    if (!man[l].includes(k) || !fs.existsSync(path.join(__dirname, '..', 'public', 'voice', l, k + '.mp3'))) missing++;
  }));
  if (missing) console.warn(`  ⚠ ${missing} Texte ohne Sprachaufnahme (npm run voice)`);
  else console.log(`Notar-Stimme: ${man.de.length} + ${man.tr.length} Aufnahmen vollständig`);
} catch (e) { console.warn('  ⚠ Keine Sprachaufnahmen gefunden'); }

// Chat & Fotos
{
  const g = new Game('CHAT', { timeScale: 0.001 });
  const a = g.addPlayer({ name: 'A' }).player, b = g.addPlayer({ name: 'B' }).player;
  const bot = g.addBot().player;
  const got = [];
  g.onChat = (m, rec) => got.push({ m, rec });
  let r = g.sendChat(a, b.id, 'Hallo');
  if (!r.ok || got.length !== 1 || got[0].rec.sort().join() !== [a.id, b.id].sort().join()) fail('Privatchat falsch zugestellt');
  if (g.chatFor(bot).length !== 0) fail('Bot sieht fremde Privatnachricht');
  if (!g.sendChat(a, 'fam', 'x').error) fail('Familienchat ohne Familien möglich');
  for (let i = 0; i < 7; i++) r = g.sendChat(a, b.id, 'spam' + i);
  if (r.error !== 'tooFast') fail('Chat-Bremse greift nicht');
  if (!g.setPhoto(a, 'data:image/jpeg;base64,' + Buffer.alloc(3000, 7).toString('base64')).ok) fail('Foto wird nicht angenommen');
  if (!g.setPhoto(a, 'data:text/html;base64,AAAA').error) fail('Ungültiges Foto angenommen');
  if (g.publicState().players[0].photo !== 1) fail('Foto-Version fehlt');
  g.destroy();
  // Familienchat (Familien gehen bei jeder Spielerzahl)
  const f = new Game('FAMS', { timeScale: 0.0005 });
  for (let i = 0; i < 4; i++) f.addBot();
  f.updateSettings({ famMode: 'random', famCount: 2 });
  f.start();
  const p0 = f.players[0];
  const rec = [];
  f.onChat = (m, list) => rec.push(list);
  if (!f.sendChat(p0, 'fam', 'Plan!').ok) fail('Familienchat geht nicht');
  const fam = f.players.filter(p => p.family === p0.family).map(p => p.id).sort().join();
  if (rec[0].sort().join() !== fam) fail('Familienchat erreicht falsche Leute');
  f.destroy();
  console.log('Chat und Fotos geprüft');
}

// Wetten, Sabotage, Verträge, Selfies, Auktion
{
  const g = new Game('FEAT', { timeScale: 0.001 });
  const a = g.addPlayer({ name: 'A' }).player, b = g.addPlayer({ name: 'B' }).player, c = g.addPlayer({ name: 'C' }).player;
  [a, b, c].forEach(p => { p.connected = true; });
  g.start();
  [a, b, c].forEach(p => { p.money = 500; });
  // Verträge
  const sab = [], deals = [], evs = [];
  g.onSabotage = (s) => sab.push(s); g.onDeal = (d) => deals.push(d.status); g.onDealEvent = (e) => evs.push(e.type);
  if (!g.proposeDeal(a, { to: b.id, giveMoney: 1000 }).error) fail('Vertrag mit zu viel Geld möglich');
  const r = g.proposeDeal(a, { to: b.id, giveMoney: 100, promise: 'noVault' });
  if (!r.ok) fail('Vertrag kann nicht angeboten werden');
  if (g.respondDeal(c, r.deal.id, true).ok) fail('Fremder kann Vertrag annehmen');
  g.respondDeal(b, r.deal.id, true);
  if (a.money !== 400 || b.money !== 600) fail('Vertragsgeld falsch: ' + a.money + '/' + b.money);
  g.accuseDeal(a, r.deal.id);
  if (!b.prank || b.prank.kind !== 'snake' || b.stats.broken !== 1) fail('Vertragsbruch ohne Schlange');
  if (evs.join() !== 'signed,broken') fail('Vertrags-Ereignisse fehlen: ' + evs.join());
  const big = g.proposeDeal(a, { to: c.id, promise: 'Ich verrate nichts '.repeat(20) });
  if (!big.ok || big.deal.promise.text.length > 80) fail('Eigenes Versprechen nicht gekürzt');
  // Wetten & Sabotage in einem künstlichen Duell
  clearTimeout(g.timer);
  g.rd = { deltas: {}, plans: {}, closed: new Set(), learned: {}, bets: {}, sab: {}, groups: [{ room: 'vault', pids: [a.id, b.id] }], duel: { scores: {} } };
  g.phase = 'duel'; g.pd = { stage: 'intro', pids: [a.id, b.id], groups: g.rd.groups };
  if (g.submitBet(a, b.id, 50).ok) fail('Duellant darf wetten');
  if (!g.submitBet(c, b.id, 55).ok || g.rd.bets[c.id].amount !== 50) fail('Wette falsch');
  if (g.submitSabotage(c, a.id, 'tomato').ok) fail('Sabotage im Intro möglich');
  g.pd.stage = 'play';
  for (let i = 0; i < 4; i++) g.submitSabotage(c, a.id, 'tomato');
  if (sab.length !== D.SABOTAGE_MAX) fail('Sabotage-Limit falsch: ' + sab.length);
  const before = c.money;
  const res = g.settleBets({ vault: b.id });
  if (c.money !== before + 50 || res[0].delta !== 50) fail('Wettgewinn falsch');
  // Selfie
  g.phase = 'vote'; g.pd = { stage: 'selfie' }; g.rd.selfies = {};
  if (g.submitSelfie(a, 'data:image/png;base64,AAAA').ok) fail('Kaputtes Selfie angenommen');
  if (!g.submitSelfie(a, 'data:image/jpeg;base64,' + Buffer.alloc(3000, 9).toString('base64')).ok) fail('Selfie nicht angenommen');
  // Auktion
  g.phase = 'results';
  g.heirloomDeck = ['goldwatch']; process.env.OTTO_AUCTION_EVERY = '1';
  let next = false;
  g.maybeAuction(() => { next = true; });
  delete process.env.OTTO_AUCTION_EVERY;
  if (g.phase !== 'auction') fail('Auktion startet nicht');
  if (!g.submitBid(a, 9999).error) fail('Gebot über Vermögen möglich');
  const moneyB = b.money;
  g.submitBid(a, 30); g.submitBid(b, 120); g.submitBid(c, 0);
  g.auctionResult();
  if (g.pd.winner !== b.id || b.money !== moneyB - 120 || !b.heirlooms.includes('goldwatch')) fail('Auktion falsch entschieden');
  g.destroy();
  console.log('Wetten, Sabotage, Verträge, Selfies und Auktion geprüft');
}

// 2) Partien simulieren
const usedKeys = new Set();
function collectKeys(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) return obj.forEach(collectKeys);
  if (typeof obj.k === 'string') usedKeys.add(obj.k);
  Object.values(obj).forEach(collectKeys);
}

function runGame(n, rounds) {
  return new Promise((resolve) => {
    const g = new Game('TEST', { timeScale: 0.0005 });
    g.settings.rounds = rounds;
    for (let i = 0; i < n; i++) g.addBot();
    // Familien in allen Varianten testen
    const mode = ['off', 'random', 'choose'][(n + rounds) % 3];
    g.updateSettings({ famMode: mode, famCount: 2 + (n % 5) });
    if (mode === 'choose') g.players.forEach((p, i) => { if (i % 3) g.setFamilyPick(p, i % g.settings.famCount); });
    const seen = new Set();
    let maxClause = 0;
    const clauses = new Set();
    const duels = new Set();
    const cards = new Set();
    if (n % 3 === 0) g.forceTwists = true; // Plot-Twists häufiger testen
    g.onChange = () => {
      if (g.phase === 'twist') seen.add('twist:' + g.pd.type);
      g.players.forEach(p => (p.notes || []).forEach(c => { usedKeys.add(c.k); if (c.k === 'clue.trio' || c.k === 'clue.pair') { const real = g.players.find(q => q.role === c.p.rk.split('.')[0]); if (real && !g.players.some(q => q.roleChanged) && ![c.p.a, c.p.b, c.p.c].includes(real.name)) fail('Falsche Spur: ' + JSON.stringify(c)); } if (c.k === 'clue.not') { const real = g.players.find(q => q.role === c.p.rk.split('.')[0]); if (real && real.name === c.p.a && !g.players.some(q => q.roleChanged)) fail('Falsche Nicht-Spur'); } }));
      if (g.players.some(p => Object.keys(p.known || {}).length)) fail('Rolle wird direkt verraten');
      seen.add(g.phase);
      collectKeys(g.pd);
      if (g.clause) clauses.add(g.clause.id);
      if (g.phase === 'duel') duels.add(g.pd.type);
      if (g.phase === 'reveal') (g.pd.events || []).forEach(e => { if (D.CARDS[e.card]) cards.add(e.card); });
      maxClause = Math.max(maxClause, g.round);
      g.players.forEach(p => {
        if (p.money < 0) fail('Negatives Geld bei ' + p.name);
        if (p.hand.length > D.HAND_MAX) fail('Zu viele Karten bei ' + p.name);
        if (!Number.isFinite(p.money)) fail('Geld ungültig');
      });
      // Öffentlicher Zustand darf keine Rollen verraten (außer im Finale)
      if (g.phase !== 'finale') {
        const s = JSON.stringify(g.publicState());
        if (/"role"\s*:/.test(s)) fail('Rolle im öffentlichen Zustand in Phase ' + g.phase);
      }
      if (g.phase === 'finale' && !g._done) {
        g._done = true;
        const rk = g.pd.ranking;
        if (rk.length !== n) fail('Rangliste unvollständig');
        g.destroy();
        if (g.pd.steps.some(st => st.t === 'awards')) seen.add('awards');
        resolve({ seen, clauses, duels, cards, ranking: rk, g });
      }
    };
    if (!g.start()) { fail('Start fehlgeschlagen'); resolve({ seen }); }
    if (mode !== 'off' && n >= 2) {
      if (!g.families || g.families.length < 2) fail(`Familien fehlen (${mode}, ${n} Spieler)`);
      else if (g.players.some(p => p.family == null)) fail('Spieler ohne Familie');
    }
    if (mode === 'off' && g.families) fail('Familien obwohl aus');
    setTimeout(() => { if (!g._done) { fail(`Partie mit ${n} Spielern hängt in Phase ${g.phase}`); g.destroy(); resolve({ seen }); } }, 20000);
  });
}

(async () => {
  const allClauses = new Set();
  const allDuels = new Set();
  const allCards = new Set();
  const phases = new Set();
  const t0 = Date.now();
  let games = 0;
  for (let rep = 0; rep < 10; rep++) {
    for (let n = 2; n <= 15; n++) {
      const r = await runGame(n, n % 2 ? 8 : 10);
      games++;
      r.seen && r.seen.forEach(p => phases.add(p));
      r.clauses && r.clauses.forEach(c => allClauses.add(c));
      r.duels && r.duels.forEach(c => allDuels.add(c));
      r.cards && r.cards.forEach(c => allCards.add(c));
      if (rep === 0 && (n === 2 || n === 7 || n === 15)) {
        const top = r.ranking.slice(0, 3).map(x => `${r.g.get(x.pid).name} (${x.money})`).join(', ');
        console.log(`  ${n} Spieler → Sieger: ${top}`);
      }
    }
  }
  ['intro', 'clause', 'plan', 'reveal', 'duel', 'results', 'vote', 'finalvote', 'finale', 'twist', 'auction', 'awards'].forEach(p => { if (!phases.has(p)) fail('Phase nie erreicht: ' + p); });
  Object.keys(D.TWISTS).forEach(tw => { if (!phases.has('twist:' + tw)) fail('Plot-Twist nie passiert: ' + tw); });
  console.log(`Plot-Twists erlebt: ${Object.keys(D.TWISTS).filter(tw => phases.has('twist:' + tw)).length}/${Object.keys(D.TWISTS).length}`);
  console.log(`${games} Partien simuliert in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${allClauses.size}/${D.CLAUSES.length} Klauseln gezogen, ${allDuels.size}/${D.DUEL_TYPES.length} Minispiele, ${allCards.size}/${Object.keys(D.CARDS).length} Karten gespielt`);
  Object.keys(D.CARDS).forEach(c => { if (!allCards.has(c)) fail('Karte nie gespielt: ' + c); });
  ['de', 'tr'].forEach(l => usedKeys.forEach(k => { if (!(k in I18N[l])) fail(`${l}: Text für Ereignis fehlt: ${k}`); }));
  console.log(`Ereignis-Texte geprüft: ${usedKeys.size}`);
  if (errors) { console.error(`\n❌ ${errors} Fehler`); process.exit(1); }
  console.log('\n✅ Alles in Ordnung');
  process.exit(0);
})();
