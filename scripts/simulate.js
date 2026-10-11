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
  // Familienchat mit 12 Spielern
  const f = new Game('FAMS', { timeScale: 0.0005 });
  for (let i = 0; i < 12; i++) f.addBot();
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
    const seen = new Set();
    let maxClause = 0;
    const clauses = new Set();
    const duels = new Set();
    const cards = new Set();
    g.onChange = () => {
      seen.add(g.phase);
      collectKeys(g.pd);
      if (g.clause) clauses.add(g.clause.id);
      if (g.phase === 'duel') duels.add(g.pd.type);
      if (g.phase === 'reveal') (g.pd.events || []).forEach(e => cards.add(e.card));
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
        resolve({ seen, clauses, duels, cards, ranking: rk, g });
      }
    };
    if (!g.start()) { fail('Start fehlgeschlagen'); resolve({ seen }); }
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
  ['intro', 'clause', 'plan', 'reveal', 'duel', 'results', 'vote', 'finalvote', 'finale'].forEach(p => { if (!phases.has(p)) fail('Phase nie erreicht: ' + p); });
  console.log(`${games} Partien simuliert in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${allClauses.size}/${D.CLAUSES.length} Klauseln gezogen, ${allDuels.size}/${D.DUEL_TYPES.length} Minispiele, ${allCards.size}/${Object.keys(D.CARDS).length} Karten gespielt`);
  Object.keys(D.CARDS).forEach(c => { if (!allCards.has(c)) fail('Karte nie gespielt: ' + c); });
  ['de', 'tr'].forEach(l => usedKeys.forEach(k => { if (!(k in I18N[l])) fail(`${l}: Text für Ereignis fehlt: ${k}`); }));
  console.log(`Ereignis-Texte geprüft: ${usedKeys.size}`);
  if (errors) { console.error(`\n❌ ${errors} Fehler`); process.exit(1); }
  console.log('\n✅ Alles in Ordnung');
  process.exit(0);
})();
