'use strict';
/* Erzeugt public/docs/KLAUSELN.md aus den Spieldaten (immer synchron mit dem Spiel). Aufruf: npm run docs */
const fs = require('fs');
const path = require('path');
const D = require('../shared/data');
const I = require('../shared/i18n');

function kind(fx, lang) {
  const k = {
    de: { vote: 'Abstimmung', now: 'Sofort', room: 'Räume', duel: 'Duelle', card: 'Karten', after: 'Nach der Runde', final: 'Finale' },
    tr: { vote: 'Oylama', now: 'Anında', room: 'Odalar', duel: 'Düellolar', card: 'Kartlar', after: 'Tur sonunda', final: 'Final' }
  }[lang];
  if (fx.final) return k.final;
  if (fx.vote != null) return k.vote;
  if (fx.now) return k.now;
  if (fx.after) return k.after;
  if (fx.game || fx.duelAll || fx.reverseDuel || fx.bedroomTwo) return k.duel;
  if (fx.noCards || fx.maxCards || fx.thiefMult) return k.card;
  return k.room;
}

let md = '# Die 50 Testamentsklauseln · 50 Vasiyet Maddesi\n\n';
md += '*Diese Datei wird automatisch aus dem Spiel erzeugt (`npm run docs`). · Bu dosya oyundan otomatik olarak üretilir.*\n\n';
md += 'Jede Runde zieht der Notar eine zufällige Klausel. Die letzte Runde hat immer die Klausel Nr. 50. Manche Klauseln kommen nur, wenn sie Sinn ergeben (z. B. „Séance“ nur, wenn es Geister gibt).\n\n';
md += 'Noter her tur rastgele bir madde çeker. Son turda her zaman 50 numaralı madde okunur. Bazı maddeler yalnızca anlamlı olduklarında gelir (örneğin „Ruh çağırma seansı“ sadece hayalet varsa).\n\n';
md += '| Nr. | Art | Klausel (Deutsch) | Tür | Madde (Türkçe) |\n|---|---|---|---|---|\n';
D.CLAUSES.forEach((c, i) => {
  const de = I.t('de', 'clause.' + c.id), tr = I.t('tr', 'clause.' + c.id);
  md += `| ${i + 1} | ${kind(c.fx, 'de')} | ${de} | ${kind(c.fx, 'tr')} | ${tr} |\n`;
});
const out = path.join(__dirname, '..', 'public', 'docs', 'KLAUSELN.md');
fs.writeFileSync(out, md);
console.log('Geschrieben:', path.relative(process.cwd(), out), `(${D.CLAUSES.length} Klauseln)`);
