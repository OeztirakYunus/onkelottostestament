'use strict';
/*
 * Minimaler WebSocket-Server (RFC 6455) ohne Abhängigkeiten.
 * Nachrichten sind JSON: { t: 'event', d: daten, id?: ackId }  →  Antwort { t: 'ack', id, d }
 */
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 512 * 1024;
let nextId = 1;

class Client extends EventEmitter {
  constructor(socket) {
    super();
    this.id = 'c' + (nextId++) + crypto.randomBytes(3).toString('hex');
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.alive = true;
    this.open = true;
    this.data = {};
    socket.setNoDelay(true);
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => this.close());
    socket.on('error', () => this.close());
  }

  onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_PAYLOAD) return this.close();
      const maskLen = masked ? 4 : 0;
      if (this.buf.length < off + maskLen + len) return;
      const mask = masked ? this.buf.subarray(off, off + 4) : null;
      const payload = Buffer.from(this.buf.subarray(off + maskLen, off + maskLen + len));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + maskLen + len);

      if (op === 0x8) { this.sendFrame(0x8, Buffer.alloc(0)); return this.close(); }
      if (op === 0x9) { this.sendFrame(0xA, payload); continue; }
      if (op === 0xA) { this.alive = true; continue; }
      if (op === 0x1 || op === 0x2 || op === 0x0) {
        this.frags.push(payload);
        if (fin) {
          const msg = Buffer.concat(this.frags).toString('utf8');
          this.frags = [];
          this.alive = true;
          this.onMessage(msg);
        }
      }
    }
  }

  onMessage(text) {
    let m;
    try { m = JSON.parse(text); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hb') { this.alive = true; return; }
    const ack = m.id != null ? (d) => this.raw({ t: 'ack', id: m.id, d }) : () => {};
    try { this.emit('msg', m.t, m.d, ack); } catch (e) { console.error('Fehler bei', m.t, e); }
  }

  sendFrame(op, payload) {
    if (!this.open) return;
    const len = payload.length;
    let header;
    if (len < 126) { header = Buffer.from([0x80 | op, len]); }
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | op; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | op; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    try { this.socket.write(Buffer.concat([header, payload])); } catch (e) { this.close(); }
  }
  raw(obj) { this.sendFrame(0x1, Buffer.from(JSON.stringify(obj), 'utf8')); }
  send(t, d) { this.raw({ t, d }); }
  close() {
    if (!this.open) return;
    this.open = false;
    try { this.socket.destroy(); } catch (e) { /* egal */ }
    this.emit('close');
  }
}

class WsServer extends EventEmitter {
  constructor(httpServer, path = '/ws') {
    super();
    this.clients = new Set();
    httpServer.on('upgrade', (req, socket) => {
      const url = (req.url || '').split('?')[0];
      const key = req.headers['sec-websocket-key'];
      if (url !== path || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
      const c = new Client(socket);
      this.clients.add(c);
      c.on('close', () => this.clients.delete(c));
      this.emit('connection', c);
    });
    this.heartbeat = setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) { c.close(); continue; }
        c.alive = false;
        c.sendFrame(0x9, Buffer.alloc(0));
      }
    }, 20000);
    this.heartbeat.unref();
  }
}

module.exports = { WsServer };
