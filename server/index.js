'use strict';
/* Onkel Ottos Testament – Server (ohne externe Abhängigkeiten) */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { WsServer } = require('./ws');
const QR = require('./qr');
const Game = require('./game');
const D = require('../shared/data');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json'
};
const ROUTES = { '/': 'public/index.html', '/host': 'public/host.html', '/play': 'public/play.html', '/regeln': 'public/rules.html', '/kurallar': 'public/rules.html' };

function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (ROUTES[url]) return serveFile(res, path.join(ROOT, ROUTES[url]));
  let base = path.join(ROOT, 'public');
  if (url.startsWith('/shared/')) { base = path.join(ROOT, 'shared'); url = url.slice('/shared'.length); }
  const file = path.normalize(path.join(base, url));
  if (!file.startsWith(base + path.sep)) { res.writeHead(403); return res.end(); }
  serveFile(res, file);
});

function lanIP() {
  const nets = os.networkInterfaces();
  const c = [];
  for (const name of Object.keys(nets)) for (const n of nets[name] || []) if (n.family === 'IPv4' && !n.internal) c.push(n.address);
  return c.find(a => /^192\.168\./.test(a)) || c.find(a => /^10\./.test(a)) || c.find(a => /^172\.(1[6-9]|2\d|3[01])\./.test(a)) || c[0] || 'localhost';
}

/* ---------------- Spielverwaltung ---------------- */
const games = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); } while (games.has(c));
  return c;
}
const clientsById = new Map();

function broadcast(g) {
  const pub = g.publicState();
  const pubText = JSON.stringify({ t: 'state', d: pub });
  for (const c of g.hosts) c.sendFrame(0x1, Buffer.from(pubText, 'utf8'));
  g.players.forEach(p => {
    const c = p.socketId && clientsById.get(p.socketId);
    if (c) c.send('state', { ...pub, me: g.privateState(p) });
  });
}
function wire(g) {
  g.hosts = new Set();
  g.onChange = () => {
    if (g._pending) return;
    g._pending = true;
    setImmediate(() => { g._pending = false; if (!g.destroyed) broadcast(g); });
  };
}

const wss = new WsServer(server, '/ws');
wss.on('connection', (client) => {
  clientsById.set(client.id, client);
  const game = () => games.get(client.data.code);
  const me = () => { const g = game(); return g && client.data.pid ? g.get(client.data.pid) : null; };
  const hostGame = () => (client.data.host ? game() : null);

  const handlers = {
    'host:create': (msg, ack) => {
      const code = newCode();
      const g = new Game(code, { lang: msg && msg.lang, timeScale: parseFloat(process.env.OTTO_TIME_SCALE) || 1 });
      let origin = msg && typeof msg.origin === 'string' ? msg.origin : '';
      if (!/^https?:\/\/[\w.\-:[\]]+$/.test(origin) || /localhost|127\.0\.0\.1|\[::1\]/.test(origin)) origin = `http://${lanIP()}:${PORT}`;
      g.joinUrl = `${origin}/play?code=${code}`;
      try { g.qr = QR.toDataUrl(g.joinUrl, { dark: '#14261f', light: '#f2e3c2' }); } catch (e) { g.qr = ''; }
      wire(g);
      games.set(code, g);
      client.data = { code, host: true };
      g.hosts.add(client);
      g.lastHostSeen = Date.now();
      ack({ code, hostToken: g.hostToken });
      broadcast(g);
    },
    'host:resume': (msg, ack) => {
      const g = games.get(String((msg && msg.code) || '').toUpperCase());
      if (!g || g.hostToken !== (msg && msg.hostToken)) return ack({ error: 'nogame' });
      client.data = { code: g.code, host: true };
      g.hosts.add(client);
      g.lastHostSeen = Date.now();
      ack({ code: g.code });
      broadcast(g);
    },
    'host:lang': (lang) => { const g = hostGame(); if (g) { g.lang = lang === 'tr' ? 'tr' : 'de'; g.changed(); } },
    'host:settings': (s) => { const g = hostGame(); if (g && s) g.updateSettings(s); },
    'host:addBot': () => { const g = hostGame(); if (g) g.addBot(); },
    'host:kick': (pid) => {
      const g = hostGame(); if (!g) return;
      const p = g.get(pid);
      const c = p && p.socketId && clientsById.get(p.socketId);
      if (c) c.send('kicked', {});
      g.kick(pid);
    },
    'host:start': () => { const g = hostGame(); if (g) g.start(); },
    'host:skip': () => { const g = hostGame(); if (g) g.skip(); },
    'host:restart': () => { const g = hostGame(); if (g) g.restart(); },

    'player:join': (msg, ack) => {
      msg = msg || {};
      const g = games.get(String(msg.code || '').trim().toUpperCase());
      if (!g) return ack({ error: 'nogame' });
      let p = msg.token ? g.players.find(x => x.token === msg.token) : null;
      if (!p) {
        if (msg.rejoinOnly) return ack({ error: 'notoken' });
        const r = g.addPlayer({ name: msg.name, avatar: msg.avatar, lang: msg.lang });
        if (r.error) return ack({ error: r.error });
        p = r.player;
      }
      if (p.socketId && p.socketId !== client.id) { const old = clientsById.get(p.socketId); if (old) old.send('replaced', {}); }
      p.socketId = client.id;
      p.connected = true;
      if (msg.lang) p.lang = msg.lang === 'tr' ? 'tr' : 'de';
      client.data = { code: g.code, pid: p.id };
      ack({ ok: true, token: p.token, pid: p.id, code: g.code });
      g.changed();
    },
    'player:lang': (lang) => { const p = me(); if (p) { p.lang = lang === 'tr' ? 'tr' : 'de'; game().changed(); } },
    'player:avatar': (av) => {
      const g = game(), p = me();
      if (!g || !p || g.phase !== 'lobby') return;
      if (D.AVATARS.includes(av) && !g.players.some(x => x !== p && x.avatar === av)) { p.avatar = av; g.changed(); }
    },
    'player:plan': (plan, ack) => { const g = game(), p = me(); ack(g && p ? (g.submitPlan(p, plan) || {}) : { error: 'nogame' }); },
    'player:duel': (score) => { const g = game(), p = me(); if (g && p) g.submitDuel(p, score); },
    'player:vote': (target) => { const g = game(), p = me(); if (g && p) g.submitVote(p, target); },
    'player:finalvote': (votes) => { const g = game(), p = me(); if (g && p) g.submitFinalVote(p, votes); },
    'player:leave': () => {
      const g = game(), p = me(); if (!g || !p) return;
      if (g.phase === 'lobby') g.kick(p.id); else { p.connected = false; p.socketId = null; g.changed(); }
      client.data = {};
    }
  };

  client.on('msg', (type, data, ack) => { const h = handlers[type]; if (h) h(data, ack); });
  client.on('close', () => {
    clientsById.delete(client.id);
    const g = game(); if (!g) return;
    if (client.data.host) { g.hosts && g.hosts.delete(client); g.lastHostSeen = Date.now(); return; }
    const p = me();
    if (p && p.socketId === client.id) {
      p.connected = false; p.socketId = null;
      g.changed();
      if (g.phase === 'plan') g.checkAllPlanned();
      if (g.phase === 'duel') g.checkDuelDone();
      if (g.phase === 'vote') g.checkVoteDone();
      if (g.phase === 'finalvote') g.checkFinalDone();
    }
  });
});

// Verwaiste Spiele aufräumen (2 Stunden ohne Fernseher)
setInterval(() => {
  const now = Date.now();
  for (const [code, g] of games) {
    if (g.hosts.size) g.lastHostSeen = now;
    else if (now - (g.lastHostSeen || now) > 2 * 3600 * 1000) { g.destroy(); games.delete(code); }
  }
}, 60 * 1000).unref();

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ⚠️  Port ${PORT} ist schon belegt. Starte mit einem anderen Port, z. B.:\n     PORT=3001 npm start   (Windows PowerShell: $env:PORT=3001; npm start)\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = lanIP();
  const line = '─'.repeat(60);
  console.log(`\n${line}\n  🏚️  ONKEL OTTOS TESTAMENT läuft!  ·  Otto Amca'nın Vasiyeti\n${line}`);
  console.log(`  📺  Fernseher / Laptop / TV:   http://localhost:${PORT}`);
  console.log(`  📱  Handys im selben WLAN:     http://${ip}:${PORT}/play`);
  console.log(`  📖  Regelwerk / Kurallar:      http://localhost:${PORT}/regeln`);
  console.log(`${line}\n  Beenden / Kapatmak: Strg + C\n`);
});

module.exports = { server, games };
