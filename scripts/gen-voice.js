'use strict';
/*
 * Erzeugt die Sprachaufnahmen des Notars als MP3 (public/voice/de, public/voice/tr).
 * Nutzt neuronale Piper-Stimmen über sherpa-onnx – komplett offline.
 *
 * Nur nötig, wenn du neue Klauseln oder Texte hinzufügst. Vorbereitung (einmalig):
 *   1. sherpa-onnx herunterladen: https://github.com/k2-fsa/sherpa-onnx/releases
 *      (z. B. sherpa-onnx-v1.12.40-linux-x64-static.tar.bz2, für Windows ...-win-x64-static.tar.bz2)
 *   2. Stimmen herunterladen (gleiche Seite, Tag "tts-models"):
 *      vits-piper-de_DE-thorsten-high.tar.bz2 und vits-piper-tr_TR-fahrettin-medium.tar.bz2
 *   3. ffmpeg installieren (https://ffmpeg.org)
 *   4. Starten:
 *      SHERPA_BIN=/pfad/sherpa-onnx-offline-tts VOICE_DE=/pfad/vits-piper-de_DE-thorsten-high \
 *      VOICE_TR=/pfad/vits-piper-tr_TR-fahrettin-medium npm run voice
 *
 * Es werden nur Texte neu erzeugt, die sich geändert haben.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const I = require('../shared/i18n');
const D = require('../shared/data');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'voice');
const BIN = process.env.SHERPA_BIN;
const VOICES = { de: process.env.VOICE_DE, tr: process.env.VOICE_TR };
const SPEED = { de: '1.02', tr: '1.0' };
const THREADS = String(Math.max(1, Math.min(4, os.cpus().length)));

if (!BIN || !VOICES.de || !VOICES.tr) {
  console.error('Bitte SHERPA_BIN, VOICE_DE und VOICE_TR setzen (siehe Kommentar oben in scripts/gen-voice.js).');
  process.exit(1);
}

// Welche Texte gesprochen werden
function voiceKeys() {
  const keys = Object.keys(I.de).filter(k => /^(clause\.|vq\.|v\.)/.test(k));
  D.DUEL_TYPES.forEach(t => keys.push('duel.' + t));
  keys.push('g.duelReverse');
  return keys;
}

// Text für die Sprachausgabe vorbereiten
function speakable(text, lang) {
  let s = String(text)
    .replace(/\s*\([+−-]\d+\)/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/…/g, '...')
    .replace(/−/g, 'minus ');
  if (lang === 'de') s = s.replace(/(\d+)\s*%/g, '$1 Prozent').replace(/\bNr\./g, 'Nummer');
  if (lang === 'tr') s = s.replace(/%\s*(\d+)/g, 'yüzde $1');
  return s.replace(/\s+/g, ' ').trim();
}

function findModel(dir) {
  const f = fs.readdirSync(dir).find(x => x.endsWith('.onnx'));
  if (!f) throw new Error('Kein .onnx-Modell in ' + dir);
  return path.join(dir, f);
}

const manifestFile = path.join(OUT, 'manifest.json');
let manifest = { de: {}, tr: {} };
try { const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); if (m.hash) manifest = m.hash; } catch (e) { /* neu */ }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'otto-voice-'));
let made = 0, kept = 0;
for (const lang of ['de', 'tr']) {
  const dir = VOICES[lang];
  const model = findModel(dir);
  fs.mkdirSync(path.join(OUT, lang), { recursive: true });
  for (const key of voiceKeys()) {
    const text = speakable(I.t(lang, key), lang);
    const hash = crypto.createHash('sha1').update(text + '|' + path.basename(model) + '|' + SPEED[lang]).digest('hex').slice(0, 12);
    const mp3 = path.join(OUT, lang, key + '.mp3');
    if (manifest[lang][key] === hash && fs.existsSync(mp3)) { kept++; continue; }
    const wav = path.join(tmp, 'x.wav');
    execFileSync(BIN, [
      '--vits-model=' + model, '--vits-tokens=' + path.join(dir, 'tokens.txt'),
      '--vits-data-dir=' + path.join(dir, 'espeak-ng-data'), '--vits-length-scale=' + SPEED[lang],
      '--num-threads=' + THREADS, '--output-filename=' + wav, text
    ], { stdio: 'pipe' });
    // Etwas Wärme und Raum für den Notar, gleichmäßige Lautstärke
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav,
      '-af', 'highpass=f=70,equalizer=f=180:t=q:w=1:g=2,aecho=0.85:0.5:28:0.08,loudnorm=I=-16:TP=-1.5:LRA=7,apad=pad_dur=0.15',
      '-ac', '1', '-ar', '22050', '-c:a', 'libmp3lame', '-b:a', '40k', mp3]);
    manifest[lang][key] = hash;
    made++;
    process.stdout.write(`\r${lang}: ${made} erzeugt, ${kept} unverändert   `);
  }
}
// Verwaiste Dateien entfernen
for (const lang of ['de', 'tr']) {
  const valid = new Set(voiceKeys());
  for (const f of fs.readdirSync(path.join(OUT, lang))) {
    const k = f.replace(/\.mp3$/, '');
    if (!valid.has(k)) { fs.unlinkSync(path.join(OUT, lang, f)); delete manifest[lang][k]; }
  }
}
const out = { de: Object.keys(manifest.de).sort(), tr: Object.keys(manifest.tr).sort(), hash: manifest };
fs.writeFileSync(manifestFile, JSON.stringify(out));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nFertig: ${made} neu, ${kept} unverändert. Manifest: public/voice/manifest.json`);
