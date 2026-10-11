/* Handy-Controller */
(function () {
  'use strict';
  const { D, I, Connection, Sound, confetti, esc, $, $$, fmt, Clock, animateNumber, rng, fmtScore } = window.OTTO;

  const params = new URLSearchParams(location.search);
  const storedLang = localStorage.getItem('otto.lang');
  let lang = storedLang || params.get('lang') || ((navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'de');
  if (lang !== 'tr') lang = 'de';

  let S = null, ME = null;
  let viewKey = '';
  let joined = false;
  let avatar = null;
  let draft = { room: null, cards: [] };
  let draftRound = -1;
  let editing = false;
  let fvDraft = {};
  let mini = null;
  let phaseTotal = 1;
  let showRank = false;

  const conn = new Connection();
  const t = (k, p) => I.t(lang, k, p);
  const P = (id) => (S && S.players.find(p => p.id === id)) || null;
  const medal = (p, cls = '') => window.OTTO.medal(p, S && S.code, cls);
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n), lang);
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* egal */ } };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* voll oder gesperrt */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* egal */ } }
  };
  const view = $('#view');

  /* ---------------- Sprache ---------------- */
  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i]').forEach(el => { el.textContent = t(el.dataset.i); });
    $$('[data-langswitch] button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    $('#chat-input').placeholder = t('c.placeholder');
    document.title = t('app.title');
    renderFilterRow();
  }
  document.addEventListener('click', (e) => {
    Sound.init();
    const lb = e.target.closest('[data-lang]');
    if (lb) {
      lang = lb.dataset.lang;
      store.set('otto.lang', lang);
      applyI18n();
      if (joined) conn.emit('player:lang', lang);
      viewKey = '';
      render();
      if (!$('#chat').classList.contains('hidden')) renderChat();
    }
    if (e.target.closest('[data-close]')) closeSheet();
  });

  function toast(msg, ms = 2600) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => el.classList.add('hidden'), ms);
  }

  /* ================= Porträt-Studio ================= */
  const FILTERS = ['normal', 'oil', 'ghost', 'noir', 'gold'];
  const Photo = {
    data: store.get('otto.photo') || null,   // fertiges JPEG (data URL)
    raw: null,                                // unbearbeitetes Quadrat (Canvas)
    filter: store.get('otto.filter') || 'oil',
    stream: null,
    onDone: null,
    mode: 'emoji'
  };
  Photo.mode = Photo.data ? 'photo' : (store.get('otto.mode') || 'photo');

  function renderFilterRow() {
    const row = $('#flt-row');
    if (!row) return;
    row.innerHTML = FILTERS.map(f => `<button type="button" class="flt ${f === Photo.filter ? 'on' : ''}" data-flt="${f}"><span class="fs fs-${f}"></span>${esc(t('flt.' + f))}</button>`).join('');
  }
  $('#flt-row').addEventListener('click', (e) => {
    const b = e.target.closest('[data-flt]'); if (!b) return;
    Photo.filter = b.dataset.flt;
    store.set('otto.filter', Photo.filter);
    renderFilterRow();
    $('#cam-video').className = 'flt-live-' + Photo.filter;
    if (Photo.raw) drawShot();
    Sound.play('pop');
  });

  // Bildbearbeitung pixelweise (funktioniert in jedem Browser)
  function applyFilter(ctx, size, f) {
    if (f === 'normal') return;
    const img = ctx.getImageData(0, 0, size, size), d = img.data;
    const cx = size / 2, cy = size / 2, maxR = Math.hypot(cx, cy);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        let r = d[i], g = d[i + 1], b = d[i + 2];
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        const v = 1 - Math.pow(Math.hypot(x - cx, y - cy) / maxR, 2.2) * 0.75;
        if (f === 'oil') { // warmes altes Gemälde
          const c = (l - 128) * 1.15 + 128;
          r = c * 1.08 + 28; g = c * 0.9 + 14; b = c * 0.62;
          r *= v; g *= v; b *= v;
        } else if (f === 'ghost') {
          const c = l * 1.15 + 20;
          r = c * 0.75; g = c * 1.02; b = c * 1.05;
        } else if (f === 'noir') {
          const c = Math.max(0, Math.min(255, (l - 128) * 1.6 + 118));
          r = g = b = c * (0.55 + 0.45 * v);
        } else if (f === 'gold') {
          r = r * 1.05 + 10; g = g * 1.0 + 4; b = b * 0.9;
          const ring = Math.hypot(x - cx, y - cy) / (size / 2);
          if (ring > 0.86) { const k = Math.min(1, (ring - 0.86) / 0.1); r = r * (1 - k) + 230 * k; g = g * (1 - k) + 180 * k; b = b * (1 - k) + 70 * k; }
        }
        d[i] = Math.max(0, Math.min(255, r)); d[i + 1] = Math.max(0, Math.min(255, g)); d[i + 2] = Math.max(0, Math.min(255, b));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function drawShot() {
    const cv = $('#cam-shot'), ctx = cv.getContext('2d');
    ctx.drawImage(Photo.raw, 0, 0, 256, 256);
    applyFilter(ctx, 256, Photo.filter);
  }

  // Quadrat aus Video/Bild schneiden; Selfies werden gespiegelt
  function captureSquare(src, w, h, mirror) {
    const s = Math.min(w, h), c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    if (mirror) { ctx.translate(256, 0); ctx.scale(-1, 1); }
    ctx.drawImage(src, (w - s) / 2, (h - s) / 2.4, s, s, 0, 0, 256, 256);
    return c;
  }

  function showShotState(hasShot) {
    $('#cam-shot').classList.toggle('hidden', !hasShot);
    $('#cam-video').classList.toggle('hidden', hasShot || !Photo.stream);
    $('#cam-ph').classList.toggle('hidden', hasShot || !!Photo.stream);
    $('#cam-shoot').classList.toggle('hidden', hasShot);
    $('#cam-retake').classList.toggle('hidden', !hasShot);
    $('#cam-ok').classList.toggle('hidden', !hasShot);
  }

  async function openPhoto(onDone) {
    Photo.onDone = onDone;
    Photo.raw = null;
    $('#photo').classList.remove('hidden');
    renderFilterRow();
    showShotState(false);
    $('#cam-video').className = 'flt-live-' + Photo.filter;
    const canLive = window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    $('#cam-note').classList.toggle('hidden', !!canLive);
    if (canLive) {
      try {
        Photo.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false });
        $('#cam-video').srcObject = Photo.stream;
        showShotState(false);
      } catch (e) {
        Photo.stream = null;
        $('#cam-note').classList.remove('hidden');
        showShotState(false);
      }
    }
  }
  function stopCamera() {
    if (Photo.stream) { Photo.stream.getTracks().forEach(tr => tr.stop()); Photo.stream = null; }
    $('#cam-video').srcObject = null;
  }
  function closePhoto() { stopCamera(); $('#photo').classList.add('hidden'); }

  $('#cam-shoot').addEventListener('click', async () => {
    Sound.init();
    if (!Photo.stream) { $('#cam-native').click(); return; }
    const btn = $('#cam-shoot'); btn.disabled = true;
    for (const n of [3, 2, 1]) {
      $('#cam-count').textContent = n; $('#cam-count').classList.remove('go'); void $('#cam-count').offsetWidth; $('#cam-count').classList.add('go');
      Sound.play('tick'); buzz(15);
      await new Promise(r => setTimeout(r, 700));
    }
    $('#cam-count').textContent = '';
    const v = $('#cam-video');
    Photo.raw = captureSquare(v, v.videoWidth || 640, v.videoHeight || 480, true);
    const fl = $('#cam-flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    Sound.play('shutter'); buzz(40);
    drawShot();
    showShotState(true);
    btn.disabled = false;
  });
  $('#cam-retake').addEventListener('click', () => { Photo.raw = null; showShotState(false); if (!Photo.stream) $('#cam-native').click(); });
  $('#cam-file-btn').addEventListener('click', () => $('#cam-file').click());
  $('#cam-cancel').addEventListener('click', closePhoto);
  ['#cam-file', '#cam-native'].forEach(sel => $(sel).addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      Photo.raw = captureSquare(img, img.naturalWidth, img.naturalHeight, false);
      URL.revokeObjectURL(url);
      drawShot(); showShotState(true); Sound.play('shutter');
    };
    img.onerror = () => { toast(t('p.cameraError')); URL.revokeObjectURL(url); };
    img.src = url;
  }));
  $('#cam-ok').addEventListener('click', () => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 224;
    cv.getContext('2d').drawImage($('#cam-shot'), 0, 0, 224, 224);
    let q = 0.82, data = cv.toDataURL('image/jpeg', q);
    while (data.length > 160000 && q > 0.4) { q -= 0.1; data = cv.toDataURL('image/jpeg', q); }
    Photo.data = data;
    Photo.mode = 'photo';
    store.set('otto.photo', data);
    store.set('otto.mode', 'photo');
    Sound.play('sparkle'); buzz([20, 30, 20]);
    closePhoto();
    if (Photo.onDone) Photo.onDone(data);
  });

  /* ================= Beitreten ================= */
  function buildAvatarGrid(box, taken = new Set(), onPick) {
    box.innerHTML = D.AVATARS.map(a => `<button type="button" data-av="${a}" class="${a === avatar ? 'on' : ''}" ${taken.has(a) && a !== avatar ? 'disabled' : ''}>${a}</button>`).join('');
    box.onclick = (e) => {
      const b = e.target.closest('[data-av]');
      if (!b || b.disabled) return;
      avatar = b.dataset.av;
      $$('[data-av]', box).forEach(x => x.classList.toggle('on', x === b));
      Sound.play('pop');
      if (onPick) onPick(avatar);
    };
  }
  avatar = store.get('otto.avatar') || D.AVATARS[Math.floor(Math.random() * D.AVATARS.length)];
  buildAvatarGrid($('#av-grid'));
  $('#in-code').value = (params.get('code') || '').toUpperCase();
  $('#in-name').value = store.get('otto.name') || '';

  function renderJoinPortrait() {
    $('#join-photo').classList.toggle('hidden', Photo.mode !== 'photo');
    $('#join-emoji').classList.toggle('hidden', Photo.mode === 'photo');
    $('#join-portrait').innerHTML = Photo.data ? `<img src="${Photo.data}" alt="">` : '<span class="portrait-ph">📸</span>';
    $('#join-cam').lastElementChild.textContent = Photo.data ? t('p.retake') : t('p.takePhoto');
  }
  $('#join-cam').addEventListener('click', () => openPhoto(renderJoinPortrait));
  $('#join-portrait').addEventListener('click', () => openPhoto(renderJoinPortrait));
  $('#join-to-emoji').addEventListener('click', () => { Photo.mode = 'emoji'; store.set('otto.mode', 'emoji'); renderJoinPortrait(); });
  $('#join-to-photo').addEventListener('click', () => { Photo.mode = 'photo'; store.set('otto.mode', 'photo'); renderJoinPortrait(); });

  $('#join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    Sound.init();
    const code = $('#in-code').value.trim().toUpperCase();
    const name = $('#in-name').value.trim();
    if (!name) { $('#join-err').textContent = t('err.name'); $('#in-name').focus(); return; }
    if (code.length !== 4) { $('#join-err').textContent = t('err.nogame'); $('#in-code').focus(); return; }
    if (Photo.mode === 'photo' && !Photo.data) { $('#join-err').textContent = t('p.photoNeeded'); openPhoto(renderJoinPortrait); return; }
    $('#join-err').textContent = '';
    $('#btn-join').disabled = true;
    $('#btn-join').textContent = t('p.joining');
    store.set('otto.name', name);
    store.set('otto.avatar', avatar);
    conn.emit('player:join', { code, name, avatar, lang }, (res) => {
      $('#btn-join').disabled = false;
      $('#btn-join').textContent = t('p.join');
      if (res.error) { $('#join-err').textContent = t('err.' + res.error); return; }
      store.set('otto.player', JSON.stringify({ code: res.code, token: res.token }));
      joined = true;
      if (Photo.mode === 'photo' && Photo.data) conn.emit('player:photo', Photo.data, () => {});
      Sound.play('join');
      buzz(30);
      showGame();
    });
  });

  function showGame() { $('#scr-join').classList.add('hidden'); $('#scr-game').classList.remove('hidden'); }
  function showJoin(err) {
    joined = false; S = null; ME = null; viewKey = '';
    Chat.msgs = []; Chat.unread = {}; closeChat();
    $('#scr-game').classList.add('hidden'); $('#scr-join').classList.remove('hidden');
    $('#join-err').textContent = err || '';
    renderJoinPortrait();
  }

  conn.on('open', () => {
    $('#conn').classList.add('hidden');
    let saved = null;
    try { saved = JSON.parse(store.get('otto.player') || 'null'); } catch (e) { saved = null; }
    const urlCode = (params.get('code') || '').toUpperCase();
    if (saved && (!urlCode || urlCode === saved.code)) {
      conn.emit('player:join', { code: saved.code, token: saved.token, lang, rejoinOnly: true }, (res) => {
        if (res.ok) { joined = true; showGame(); }
        else { store.del('otto.player'); if (joined) showJoin(t('err.' + (res.error === 'notoken' ? 'running' : res.error))); }
      });
    }
  });
  conn.on('close', () => { if (joined) $('#conn').classList.remove('hidden'); });
  conn.on('kicked', () => { store.del('otto.player'); showJoin(t('p.kicked')); });
  // Der Gastgeber hat die Sitzung beendet
  conn.on('ended', (msg) => {
    store.del('otto.player');
    if (mini && mini.cleanup) mini.cleanup();
    closeSheet(); closeChat(); closePhoto();
    const code = msg.code, myId = ME && ME.id;
    joined = false; S = null; ME = null; viewKey = 'ended';
    Chat.msgs = []; Chat.unread = {}; updateChatBadge();
    $('#pbar-fill').style.width = '0%';
    view.innerHTML = `<div class="ended-view">
        <div class="big-emoji">🏁</div>
        <div class="h2 center">${esc(t('p.ended'))}</div>
        <p class="sub center">${esc(t('p.endedSub'))}</p>
        ${msg.started ? `<div class="lines">${msg.ranking.map((p, i) => `<div class="rank-line ${p.id === myId ? 'me' : ''}">${i + 1}. ${window.OTTO.medal(p, code, 'tiny')} ${esc(p.name)} · ${fmt(p.money, lang)}</div>`).join('')}</div>` : ''}
        <p class="center" style="margin-top:1.4rem"><button class="btn big blood" id="btn-join-new">${esc(t('p.joinNew'))}</button></p>
      </div>`;
    $('#btn-join-new').onclick = () => { $('#in-code').value = ''; showJoin(''); };
    Sound.play('bell'); buzz([60, 60, 120]);
  });
  conn.on('replaced', () => { joined = false; $('#view').innerHTML = `<div class="summary"><div class="se">📱</div><p>${esc(t('p.replaced'))}</p></div>`; });
  conn.on('state', (d) => {
    if (!d.me) return;
    const first = !S;
    S = d; ME = d.me;
    Clock.sync(d.now);
    if (!joined) { joined = true; showGame(); }
    // Foto nach Neuverbindung erneut hochladen, falls der Server es nicht mehr hat
    if (first && Photo.mode === 'photo' && Photo.data && !ME.photo) conn.emit('player:photo', Photo.data, () => {});
    render();
    updateChatBadge();
  });

  /* ================= Chat ================= */
  const Chat = { msgs: [], unread: {}, thread: null, open: false };
  const threadOf = (m) => (m.fam != null ? 'fam' : (m.from === ME.id ? m.to : m.from));
  conn.on('chatHistory', (list) => { Chat.msgs = Array.isArray(list) ? list : []; if (Chat.open) renderChat(); });
  conn.on('chat', (m) => {
    if (!ME) return;
    if (Chat.msgs.some(x => x.id === m.id)) return;
    Chat.msgs.push(m);
    const th = threadOf(m);
    const mine = m.from === ME.id;
    if (!mine && !(Chat.open && Chat.thread === th)) {
      Chat.unread[th] = (Chat.unread[th] || 0) + 1;
      const from = P(m.from);
      toast(t('c.newFrom', { a: from ? from.name : '?', t: m.text.slice(0, 60) }), 3500);
      Sound.play('message'); buzz([20, 40, 20]);
    }
    updateChatBadge();
    if (Chat.open) renderChat();
  });
  function updateChatBadge() {
    const n = Object.values(Chat.unread).reduce((s, x) => s + x, 0);
    const b = $('#chat-badge');
    b.textContent = n > 9 ? '9+' : n;
    b.classList.toggle('hidden', !n);
  }
  function openChat(thread = null) {
    if (!ME) return;
    Chat.open = true; Chat.thread = thread;
    $('#chat').classList.remove('hidden');
    renderChat();
  }
  function closeChat() { Chat.open = false; $('#chat').classList.add('hidden'); $('#chat-input').blur(); }
  $('#chat-btn').addEventListener('click', () => openChat(null));
  $('#chat-close').addEventListener('click', closeChat);
  $('#chat-back').addEventListener('click', () => { if (Chat.thread) { Chat.thread = null; renderChat(); } else closeChat(); });

  function threadName(th) {
    if (th === 'fam') return t('c.family', { n: (ME.family || 0) + 1 });
    const p = P(th); return p ? p.name : '?';
  }
  function renderChat() {
    if (!ME || !S) return;
    const body = $('#chat-body');
    const form = $('#chat-form');
    if (!Chat.thread) {
      $('#chat-title').textContent = '💬 ' + t('c.title');
      form.classList.add('hidden');
      const threads = [];
      if (S.families && ME.family != null) threads.push('fam');
      S.players.filter(p => p.id !== ME.id).forEach(p => threads.push(p.id));
      const last = (th) => { const l = Chat.msgs.filter(m => threadOf(m) === th); return l[l.length - 1]; };
      threads.sort((a, b) => ((last(b) || {}).ts || 0) - ((last(a) || {}).ts || 0) || (a === 'fam' ? -1 : 0));
      body.innerHTML = `<div class="thread-list">${threads.map(th => {
        const lm = last(th), un = Chat.unread[th] || 0;
        const icon = th === 'fam' ? `<div class="medal fam-medal">👨‍👩‍👧</div>` : medal(P(th));
        return `<button class="thread" data-th="${th}">${icon}<span class="tt"><b>${esc(threadName(th))}</b><small>${lm ? esc((lm.from === ME.id ? t('c.you') + ': ' : '') + lm.text) : '&nbsp;'}</small></span>${un ? `<i class="badge">${un}</i>` : ''}</button>`;
      }).join('')}</div>`;
      $$('.thread', body).forEach(b => b.onclick = () => { Chat.thread = b.dataset.th; renderChat(); setTimeout(() => $('#chat-input').focus(), 50); });
      return;
    }
    const th = Chat.thread;
    Chat.unread[th] = 0; updateChatBadge();
    $('#chat-title').textContent = threadName(th);
    form.classList.remove('hidden');
    const msgs = Chat.msgs.filter(m => threadOf(m) === th);
    body.innerHTML = `<p class="chat-note">🔒 ${esc(th === 'fam' ? t('c.familyOnly') : t('c.private', { a: threadName(th) }))}</p>
      ${msgs.length ? msgs.map(m => {
        const mine = m.from === ME.id, who = P(m.from);
        return `<div class="bubble-row ${mine ? 'mine' : ''}">${mine ? '' : medal(who, 'tiny')}<div class="bubble">${th === 'fam' && !mine ? `<b>${esc(who ? who.name : '?')}</b>` : ''}${esc(m.text)}</div></div>`;
      }).join('') : `<p class="chat-empty">${esc(t('c.empty'))}</p>`}`;
    body.scrollTop = body.scrollHeight;
  }
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#chat-input');
    const text = inp.value.trim();
    if (!text || !Chat.thread) return;
    inp.value = '';
    conn.emit('player:chat', { to: Chat.thread, text }, (res) => {
      if (res && res.error === 'tooFast') { toast(t('c.tooFast')); inp.value = text; }
      else Sound.play('whisper');
    });
    inp.focus();
  });

  /* ================= Rendern ================= */
  function render() {
    if (!S || !ME) return;
    document.body.classList.toggle('is-ghost', !!ME.ghost);
    $('#me-medal').innerHTML = medal(P(ME.id) || ME);
    $('#me-name').textContent = ME.name;
    $('#me-money').classList.toggle('hidden', S.phase === 'lobby');
    animateNumber($('#me-money'), ME.money, 800, lang);

    const pd = S.pd || {};
    let extra = '';
    if (S.phase === 'lobby') extra = S.players.map(p => p.avatar + p.photo).join('');
    if (S.phase === 'plan') extra = (ME.plan && !editing ? 'S' : 'E') + (ME.ghost ? 'g' : '');
    if (S.phase === 'vote') extra = ME.vote ? 'v' : '';
    if (S.phase === 'finalvote') extra = ME.finalVote ? 'f' : '';
    if (S.phase === 'duel') extra = ME.duelScore !== undefined ? 'd' : '';
    if (S.phase === 'finale') extra = showRank ? 'r' : '';
    const key = [S.phase, S.round, pd.stage || '', extra, lang].join('|');
    if (key === viewKey) return;
    const phaseChanged = viewKey.split('|').slice(0, 3).join('|') !== key.split('|').slice(0, 3).join('|');
    viewKey = key;
    if (phaseChanged) {
      phaseTotal = Clock.left(S.endsAt) || 1; closeSheet();
      if (S.phase === 'duel' && pd.stage === 'play' && (pd.pids || []).includes(ME.id)) closeChat();
    }
    window.scrollTo(0, 0);
    switch (S.phase) {
      case 'lobby': return vLobby();
      case 'intro': return vIntro();
      case 'clause': return vClause();
      case 'plan': return vPlan();
      case 'reveal': return vLookTV('👀');
      case 'duel': return vDuel();
      case 'results': return vResults();
      case 'vote': return vVote();
      case 'finalvote': return vFinalVote();
      case 'finale': return vFinale();
    }
  }

  // Fortschrittsbalken
  (function loop() {
    requestAnimationFrame(loop);
    if (!S) return;
    const active = S.endsAt && (['plan', 'vote', 'finalvote'].includes(S.phase) || (S.phase === 'duel' && S.pd.stage === 'play'));
    const left = active ? Clock.left(S.endsAt) : 0;
    $('#pbar-fill').style.width = active ? (100 * left / phaseTotal).toFixed(1) + '%' : '0%';
    $('#pbar').classList.toggle('urgent', active && left < 5000);
  })();

  /* ================= Ansichten ================= */
  function vLobby() {
    const me = P(ME.id);
    const taken = new Set(S.players.filter(p => p.id !== ME.id).map(p => p.avatar));
    avatar = ME.avatar;
    view.innerHTML = `
      <div class="wait-hero">${medal(me, 'huge')}<div class="h2">${esc(ME.name)}</div><p class="sub">${esc(t('p.waiting'))}</p>
        <p class="center"><button class="btn" id="btn-newphoto">📸 ${esc(me && me.photo ? t('p.retake') : t('p.takePhoto'))}</button></p></div>
      <div class="card-box lobby-av ${me && me.photo ? 'hidden' : ''}"><div class="section-title">${esc(t('p.avatar'))}</div><div class="av-grid" id="lobby-av"></div></div>
      <p class="center"><button class="btn ghosty" id="btn-leave">${esc(t('p.leave'))}</button></p>`;
    buildAvatarGrid($('#lobby-av'), taken, (a) => { store.set('otto.avatar', a); conn.emit('player:avatar', a); });
    $('#btn-newphoto').onclick = () => openPhoto((data) => conn.emit('player:photo', data, (r) => { if (r && r.ok) toast(t('p.photoSaved')); }));
    $('#btn-leave').onclick = () => { conn.emit('player:leave'); store.del('otto.player'); showJoin(''); };
  }

  function roleCard() {
    const r = ME.role || 'relative';
    const fam = ME.family != null && S.families ? S.families.find(f => f.id === ME.family) : null;
    return `
      <div class="role-card" id="role-card">
        <div class="role-inner">
          <div class="role-face role-back"><div class="seal"><span>O</span></div><p>${esc(t('p.tapReveal'))}</p></div>
          <div class="role-face role-front parchment">
            <div class="re">${D.ROLES[r].emoji}</div>
            <h3>${esc(t('role.' + r))}</h3>
            <p>${esc(t('roled.' + r))}</p>
            ${fam ? `<p style="margin-top:.8rem"><b>${esc(t('p.family'))}:</b></p><div class="fam-row">${fam.members.map(id => medal(P(id), 'tiny')).join('')}</div>` : ''}
          </div>
        </div>
      </div>`;
  }
  function wireRoleCard() {
    const rc = $('#role-card');
    if (rc) rc.onclick = () => { rc.classList.toggle('open'); buzz(20); Sound.play('card'); };
  }

  function vIntro() {
    view.innerHTML = `<div class="h2 center">${esc(t('p.yourRole'))}</div>${roleCard()}<p class="sub center">${esc(t('p.tapHide'))}</p>`;
    wireRoleCard();
    buzz([40, 60, 40]);
  }

  function vClause() {
    const pd = S.pd;
    view.innerHTML = `
      <div class="clause-paper parchment"><b>${esc(t('g.clauseTitle', { n: S.round }))}</b><p>${esc(t('clause.' + pd.clause))}</p><div class="seal"><span>O</span></div></div>
      ${(pd.nowLines || []).length ? `<div class="now-list">${pd.nowLines.map(l => `<div>${esc(t(l.k, l.p))}</div>`).join('')}</div>` : ''}
      ${pd.vote ? `<p class="sub" style="margin-top:1rem">🗳️ ${esc(t('g.voteLater'))}</p>` : ''}
      <div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`;
    buzz(30);
  }

  function vLookTV(emoji, extraHtml = '') {
    const room = ME.plan ? ME.plan.room : null;
    view.innerHTML = `<div class="big-emoji">${emoji}</div><div class="h2 center">${esc(t('p.lookTV'))}</div>
      ${room && S.phase === 'reveal' ? `<p class="sub center">${D.ROOMS[room].emoji} ${esc(t('p.youGo', { r: room }))}</p>` : ''}${extraHtml}`;
  }

  /* --- Planung --- */
  function vPlan() {
    if (draftRound !== S.round) {
      draftRound = S.round; editing = false;
      draft = { room: null, cards: [] };
    }
    if (ME.plan && !editing) return vPlanSummary();
    if (ME.plan && editing && !draft.room) draft = { room: ME.plan.room, cards: (ME.plan.cards || []).map(c => ({ idx: c.idx, target: c.target })) };
    const open = new Set(S.pd.open || []);
    if (draft.room && !open.has(draft.room)) draft.room = null;
    const max = ME.ghost ? 0 : (S.pd.maxCards || 0);
    draft.cards = draft.cards.filter(c => c.idx < ME.hand.length).slice(0, max);

    const roomsHtml = S.rooms.map(r => `
      <button class="room-btn ${draft.room === r ? 'on' : ''}" data-room="${r}" style="--tone:${D.ROOMS[r].tone}" ${open.has(r) ? '' : 'disabled'}>
        <span class="re">${D.ROOMS[r].emoji}</span><span class="rn">${esc(t('room.' + r))}</span><span class="rd">${esc(open.has(r) ? t('roomd.' + r) : t('g.closed'))}</span>
      </button>`).join('');
    let cardsHtml = '';
    if (!ME.ghost) {
      let inner;
      if (max === 0) inner = `<p class="empty-note">🚫 ${esc(t('p.noCards'))}</p>`;
      else if (!ME.hand.length) inner = `<p class="empty-note">${esc(t('p.noHand'))}</p>`;
      else inner = `<div class="hand">${ME.hand.map((c, i) => {
        const sel = draft.cards.find(x => x.idx === i);
        const tgt = sel && sel.target ? (D.CARDS[c].target === 'room' ? t('room.' + sel.target) : (P(sel.target) || {}).name) : '';
        return `<button class="pcard ${sel ? 'on' : ''}" data-card="${i}"><span class="ce">${D.CARDS[c].emoji}</span><span class="cn">${esc(t('card.' + c))}</span><span class="cd">${esc(t('cardd.' + c))}</span>${tgt ? `<span class="ct">🎯 ${esc(tgt)}</span>` : ''}</button>`;
      }).join('')}</div>`;
      cardsHtml = `<div class="section-title"><span>${esc(t('p.cards'))}</span>${max > 0 ? `<small>${esc(t('p.cardsMax', { n: max }))}</small>` : ''}</div>${inner}`;
    }
    view.innerHTML = `
      ${ME.ghost ? `<div class="ghost-note">👻 ${esc(t('p.ghostInfo'))}</div>` : ''}
      <div class="section-title"><span>${esc(ME.ghost ? t('p.haunt') : t('p.chooseRoom'))}</span></div>
      <div class="rooms">${roomsHtml}</div>
      ${cardsHtml}
      <div class="sticky-cta"><button class="btn big blood" id="btn-submit">${esc(t('p.submit'))}</button></div>`;

    $$('.room-btn', view).forEach(b => b.onclick = () => {
      draft.room = b.dataset.room;
      $$('.room-btn', view).forEach(x => x.classList.toggle('on', x === b));
      Sound.play('pop'); buzz(12);
    });
    $$('.pcard', view).forEach(b => b.onclick = () => toggleCard(+b.dataset.card, max));
    $('#btn-submit').onclick = submitPlan;
  }

  function toggleCard(idx, max) {
    const existing = draft.cards.findIndex(c => c.idx === idx);
    if (existing >= 0) { draft.cards.splice(existing, 1); rerenderPlan(); return; }
    const cid = ME.hand[idx], def = D.CARDS[cid];
    if (def.needsHeirloom && !ME.heirlooms.length) { toast(t('p.needsHeirloom')); return; }
    const add = (target) => {
      if (draft.cards.length >= max) { if (max === 1) draft.cards = []; else draft.cards.shift(); }
      draft.cards.push({ idx, target: target || null });
      Sound.play('card'); buzz(15);
      rerenderPlan();
    };
    if (def.target === 'player') pickPlayer(t('p.chooseTarget'), S.players.filter(p => p.id !== ME.id && !p.ghost), add);
    else if (def.target === 'room') pickRoom(add);
    else add(null);
  }
  function rerenderPlan() { const y = window.scrollY; const hx = $('.hand') ? $('.hand').scrollLeft : 0; vPlan(); window.scrollTo(0, y); if ($('.hand')) $('.hand').scrollLeft = hx; }

  function submitPlan() {
    if (!draft.room) { toast(t('p.pickRoom')); buzz(80); return; }
    const btn = $('#btn-submit');
    btn.disabled = true;
    conn.emit('player:plan', { room: draft.room, cards: draft.cards }, (res) => {
      btn.disabled = false;
      if (res && res.error) { toast(res.error === 'room' ? t('p.pickRoom') : '⚠️'); return; }
      editing = false;
      draft = { room: null, cards: [] };
      Sound.play('stamp'); buzz([20, 40, 20]);
    });
  }

  function vPlanSummary() {
    const pl = ME.plan;
    const cardsTxt = (pl.cards || []).map(c => {
      const tg = c.target ? (D.CARDS[c.card].target === 'room' ? t('room.' + c.target) : (P(c.target) || {}).name) : '';
      return `<p>${D.CARDS[c.card].emoji} ${esc(t('p.withCard', { c: c.card }))}${tg ? ' · ' + esc(t('p.vs', { a: tg })) : ''}</p>`;
    }).join('');
    view.innerHTML = `<div class="summary card-box">
        <div class="se">${D.ROOMS[pl.room].emoji}</div>
        <div class="st">${esc(t('p.submitted'))}</div>
        <p>${esc(t('p.youGo', { r: pl.room }))}</p>${cardsTxt}
        <p style="margin-top:1rem">${esc(t('p.canChange'))}</p>
      </div>
      <p class="center"><button class="btn ghosty" id="btn-change">✏️ ${esc(t('p.change'))}</button>
        <button class="btn ghosty" id="btn-chat2">💬 ${esc(t('c.title'))}</button></p>`;
    $('#btn-change').onclick = () => { editing = true; draft = { room: null, cards: [] }; viewKey = ''; render(); };
    $('#btn-chat2').onclick = () => openChat(null);
  }

  /* --- Auswahlblätter --- */
  function openSheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').classList.remove('hidden'); }
  function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheet-body').innerHTML = ''; }
  function pickPlayer(title, list, cb) {
    openSheet(`<h3>${esc(title)}</h3><div class="pick-list">${list.map(p => `<button class="pick" data-pid="${p.id}">${medal(p)}<span class="pn">${esc(p.name)}</span></button>`).join('')}</div>
      <button class="btn ghosty" data-close style="color:var(--ink)">${esc(t('p.cancel'))}</button>`);
    $$('.pick', $('#sheet-body')).forEach(b => b.onclick = () => { closeSheet(); cb(b.dataset.pid); });
  }
  function pickRoom(cb) {
    const rooms = S.rooms.filter(r => r !== 'garden');
    openSheet(`<h3>${esc(t('p.chooseRoomTarget'))}</h3><div class="pick-list">${rooms.map(r => `<button class="pick" data-r="${r}"><span style="font-size:2rem">${D.ROOMS[r].emoji}</span><span class="pn">${esc(t('room.' + r))}</span></button>`).join('')}</div>
      <button class="btn ghosty" data-close style="color:var(--ink)">${esc(t('p.cancel'))}</button>`);
    $$('.pick', $('#sheet-body')).forEach(b => b.onclick = () => { closeSheet(); cb(b.dataset.r); });
  }

  $('#dossier-btn').onclick = openDossier;
  $('#me-btn').onclick = openDossier;
  function openDossier() {
    if (!ME || !S || S.phase === 'lobby') return;
    const r = ME.role || 'relative';
    const known = Object.entries(ME.known || {});
    const fam = ME.family != null && S.families ? S.families.find(f => f.id === ME.family) : null;
    openSheet(`<div class="dossier">
      <h3>📂 ${esc(t('p.dossier'))}</h3>
      <div class="role-big"><span class="e">${D.ROLES[r].emoji}</span><div><b>${esc(t('role.' + r))}</b><div>${esc(t('roled.' + r))}</div>
        ${ME.catLives != null ? `<small>🐾 ${esc(t('p.catLives', { n: ME.catLives }))}</small>` : ''}</div></div>
      ${fam ? `<h4>${esc(t('p.family'))}</h4>${fam.members.map(id => { const p = P(id); return p ? `<div class="row">${medal(p, 'tiny')}<div><b>${esc(p.name)}</b></div></div>` : ''; }).join('')}` : ''}
      <h4>${esc(t('p.known'))}</h4>
      ${known.length ? known.map(([pid, role]) => { const p = P(pid); return p ? `<div class="row">${medal(p, 'tiny')}<div><b>${esc(p.name)}</b><small>${D.ROLES[role].emoji} ${esc(t('role.' + role))}</small></div></div>` : ''; }).join('') : `<p>${esc(t('p.nothingKnown'))}</p>`}
      <h4>${esc(t('p.heirlooms'))}</h4>
      ${ME.heirlooms.length ? ME.heirlooms.map(h => `<div class="row"><span class="e">${D.HEIRLOOM_BY_ID[h].emoji}</span><div><b>${esc(t('h.' + h))}</b><small>${esc(t('p.valueHidden'))}</small></div></div>`).join('') : `<p>${esc(t('p.noHeirlooms'))}</p>`}
      <h4>${esc(t('p.cards'))}</h4>
      ${ME.hand.length ? ME.hand.map(c => `<div class="row"><span class="e">${D.CARDS[c].emoji}</span><div><b>${esc(t('card.' + c))}</b><small>${esc(t('cardd.' + c))}</small></div></div>`).join('') : `<p>${esc(t('p.noHand'))}</p>`}
      <button class="btn" data-close>${esc(t('p.close'))}</button>
    </div>`);
  }

  /* ================= Duell ================= */
  function vDuel() {
    const pd = S.pd;
    const inDuel = pd.pids.includes(ME.id);
    if (!inDuel) return vLookTV('⚔️', `<p class="sub center">${esc(t('p.duelWatch'))}</p>`);
    const head = `<div class="duel-head"><div class="dn">${D.DUELS[pd.type].emoji} ${esc(t('duel.' + pd.type))}</div><p>${esc(t('dueld.' + pd.type))}</p>${pd.reverse ? `<p>🙃 ${esc(t('g.duelReverse'))}</p>` : ''}</div>`;
    if (pd.stage === 'intro') {
      const g = pd.groups.find(x => x.pids.includes(ME.id));
      const opp = g ? g.pids.filter(id => id !== ME.id).map(id => P(id)).filter(Boolean) : [];
      view.innerHTML = `<div class="big-emoji">⚔️</div><div class="h2 center">${esc(t('p.duelYou'))}</div>${head}
        <div class="opp-row">${opp.map(p => `<div class="opp">${medal(p)}<span>${esc(p.name)}</span></div>`).join('')}</div>`;
      buzz([100, 80, 100]); Sound.play('clang');
      return;
    }
    if (pd.stage === 'play') {
      if (ME.duelScore !== undefined) {
        view.innerHTML = `${head}<div class="duel-res"><div class="e">⏳</div><p>${mini && mini.resultText ? esc(mini.resultText) + '<br>' : ''}${esc(t('p.sent'))}</p></div>`;
        return;
      }
      return startMini(pd, head);
    }
    if (pd.stage === 'result') {
      if (mini && mini.cleanup) mini.cleanup();
      const won = Object.values(pd.winners || {}).includes(ME.id);
      const sc = pd.scores ? pd.scores[ME.id] : undefined;
      const answer = pd.answer != null ? `<p>${esc(t('g.answer', { n: fmt(pd.answer, lang) }))}</p>` : (pd.secret ? `<p>${esc(t('g.answer', { n: pd.secret }))}</p>` : '');
      view.innerHTML = `${head}<div class="duel-res"><div class="e">${won ? '👑' : '💀'}</div><div class="t">${esc(won ? t('p.youWon') : t('p.youLost'))}</div>
        <p>${esc(fmtScore(t, pd.type, sc, lang))}</p>${answer}</div>`;
      if (won) { Sound.play('win'); confetti({ count: 80, duration: 2200 }); buzz([50, 50, 150]); } else { Sound.play('wahwah'); buzz(200); }
    }
  }
  function sendScore(v, text) {
    if (!mini || mini.sent) return;
    mini.sent = true;
    mini.resultText = text || '';
    conn.emit('player:duel', v);
  }

  // Gemeinsamer Countdown für Minispiele mit fester Spielzeit
  function miniTimer(sec, el, onEnd) {
    const end = performance.now() + sec * 1000;
    (function tick() {
      if (!mini || !mini.alive || mini.sent) return;
      const l = Math.max(0, end - performance.now());
      if (el) el.textContent = (l / 1000).toFixed(1) + ' s';
      if (l <= 0) { onEnd(); return; }
      requestAnimationFrame(tick);
    })();
  }

  function startMini(pd, head) {
    if (mini && mini.key === viewKey && mini.alive) return;
    if (mini && mini.cleanup) mini.cleanup();
    mini = { key: viewKey, alive: true, sent: false };
    const timers = [];
    const later = (fn, ms) => { const h = setTimeout(() => { if (mini.alive) fn(); }, ms); timers.push(h); return h; };
    mini.cleanup = () => { timers.forEach(clearTimeout); mini.alive = false; };
    buzz(80);
    const x = pd.extra || {};
    const R = rng(x.seed || 1);
    const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
    const playSec = D.DUELS[pd.type].play;

    switch (pd.type) {
      /* ---- Tipp-Wahnsinn ---- */
      case 'tap': {
        let n = 0, done = false;
        view.innerHTML = `${head}<button class="tap-zone" id="tap">${esc(t('p.tapHere'))}</button><div class="tap-count" id="tapc">0</div><p class="center sub" id="tapt"></p>`;
        const btn = $('#tap'), c = $('#tapc');
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (done) return; n++; c.textContent = n; Sound.play('tock'); buzz(6); });
        miniTimer(playSec, $('#tapt'), () => { done = true; btn.disabled = true; sendScore(n, t('p.taps', { n })); });
        break;
      }
      /* ---- Revolverheld ---- */
      case 'reaction': {
        let state = 'wait', t0 = 0;
        view.innerHTML = `${head}<button class="react-zone" id="rz">${esc(t('p.wait'))}</button>`;
        const z = $('#rz');
        later(() => {
          if (state !== 'wait') return;
          state = 'go'; t0 = performance.now(); z.classList.add('go'); z.textContent = t('p.now'); buzz(60); Sound.play('go');
          later(() => { if (state === 'go') { state = 'done'; z.classList.add('done'); z.textContent = t('sc.none'); sendScore(null, ''); } }, 3200);
        }, 1600 + Math.random() * 3400);
        z.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (state === 'wait') { state = 'done'; z.classList.add('done'); z.textContent = t('p.tooEarly'); buzz(300); Sound.play('wahwah'); sendScore(-1, t('p.tooEarly')); }
          else if (state === 'go') { const ms = Math.round(performance.now() - t0); state = 'done'; z.classList.add('done'); z.textContent = t('p.yourTime', { n: ms }); Sound.play('coin'); sendScore(ms, t('p.yourTime', { n: ms })); }
        });
        break;
      }
      /* ---- Schätzfrage ---- */
      case 'estimate': {
        view.innerHTML = `${head}<div class="estimate-q parchment">${esc(t('q.' + pd.q))}</div>
          <form id="est"><input class="estimate-in" id="estv" inputmode="numeric" pattern="[0-9]*" placeholder="${esc(t('p.estimate'))}" autocomplete="off">
          <div class="sticky-cta"><button class="btn big blood" type="submit">${esc(t('p.send'))}</button></div></form>`;
        const inp = $('#estv');
        setTimeout(() => inp.focus(), 200);
        $('#est').onsubmit = (e) => {
          e.preventDefault();
          const v = parseInt(String(inp.value).replace(/[^\d]/g, ''), 10);
          if (!Number.isFinite(v)) { buzz(80); inp.focus(); return; }
          inp.blur();
          sendScore(v, fmt(v, lang));
        };
        break;
      }
      /* ---- Ottos Taschenuhr ---- */
      case 'stopwatch': {
        let running = false, t0 = 0, stopped = false;
        view.innerHTML = `${head}<div class="watch" id="w">0.00</div><p class="center sub">${esc(t('p.watchHint'))}</p>
          <div class="sticky-cta"><button class="btn big blood" id="wb">${esc(t('p.startWatch'))}</button></div>`;
        const w = $('#w'), b = $('#wb');
        const loop = () => {
          if (!running || !mini.alive) return;
          const el = performance.now() - t0;
          if (el < 2000) w.textContent = (el / 1000).toFixed(2);
          else { w.textContent = '?.??'; w.classList.add('hidden-digits'); }
          requestAnimationFrame(loop);
        };
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (stopped) return;
          if (!running) { running = true; t0 = performance.now(); b.textContent = t('p.stop'); buzz(20); Sound.play('tock'); loop(); return; }
          stopped = true; running = false;
          const ms = Math.round(performance.now() - t0);
          w.classList.remove('hidden-digits'); w.textContent = (ms / 1000).toFixed(2);
          b.disabled = true; buzz(40); Sound.play('bell');
          sendScore(ms, t('p.yourStop', { n: (ms / 1000).toFixed(2) }));
        });
        break;
      }
      /* ---- Ottos Gedächtnis ---- */
      case 'memory': {
        const COLORS = ['red', 'blue', 'green', 'yellow'];
        const FREQ = [330, 440, 554, 659];
        const seqAll = Array.from({ length: 30 }, () => ri(0, 3));
        let len = 2, pos = 0, best = 0, input = false;
        view.innerHTML = `${head}<p class="center mini-status" id="ms">${esc(t('m.watch'))}</p>
          <div class="simon">${COLORS.map((c, i) => `<button class="pad pad-${c}" data-i="${i}"></button>`).join('')}</div>
          <p class="center sub" id="mt"></p>`;
        const pads = $$('.pad', view), st = $('#ms');
        const flash = (i, ms = 380) => { pads[i].classList.add('lit'); Sound.tone(FREQ[i], ms / 1000, { type: 'triangle', vol: 0.14 }); later(() => pads[i].classList.remove('lit'), ms); };
        const show = () => {
          input = false; st.textContent = t('m.watch') + ' · ' + t('m.length', { n: len });
          seqAll.slice(0, len).forEach((c, k) => later(() => flash(c), 600 + k * 560));
          later(() => { input = true; pos = 0; st.textContent = t('m.yourTurn'); buzz(20); }, 600 + len * 560);
        };
        const finish = () => { if (mini.sent) return; sendScore(best, t('sc.colors', { n: best })); };
        pads.forEach(b => b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (!input) return;
          const i = +b.dataset.i;
          flash(i, 200);
          if (i !== seqAll[pos]) { input = false; st.textContent = t('m.wrong'); Sound.play('wrong'); buzz(200); finish(); return; }
          pos++;
          if (pos === len) { best = len; len++; Sound.play('right'); input = false; later(show, 500); }
        }));
        show();
        miniTimer(playSec, $('#mt'), finish);
        break;
      }
      /* ---- Steuerberater ---- */
      case 'math': {
        let score = 0, lock = false;
        view.innerHTML = `${head}<div class="math-q" id="mq"></div><div class="choice-grid" id="mc"></div><p class="center mini-status" id="msc">${esc(t('m.score', { n: 0 }))}</p><p class="center sub" id="mt"></p>`;
        const next = () => {
          const op = ri(0, 2);
          let a, b, ans, txt;
          if (op === 0) { a = ri(5, 60); b = ri(5, 40); ans = a + b; txt = `${a} + ${b}`; }
          else if (op === 1) { a = ri(20, 90); b = ri(3, a - 1); ans = a - b; txt = `${a} − ${b}`; }
          else { a = ri(2, 12); b = ri(2, 9); ans = a * b; txt = `${a} × ${b}`; }
          const opts = new Set([ans]);
          while (opts.size < 4) opts.add(Math.max(0, ans + ri(-12, 12) || ans + 1));
          const list = [...opts].sort(() => R() - 0.5);
          $('#mq').textContent = txt + ' = ?';
          $('#mc').innerHTML = list.map(v => `<button class="choice" data-v="${v}">${v}</button>`).join('');
          $$('.choice', view).forEach(btn => btn.addEventListener('pointerdown', (e) => {
            e.preventDefault(); if (lock) return;
            if (+btn.dataset.v === ans) { score++; Sound.play('right'); buzz(10); $('#msc').textContent = t('m.score', { n: score }); next(); }
            else { lock = true; btn.classList.add('bad'); Sound.play('wrong'); buzz(120); later(() => { lock = false; next(); }, 600); }
          }));
        };
        next();
        miniTimer(playSec, $('#mt'), () => sendScore(score, t('sc.points', { n: score })));
        break;
      }
      /* ---- Luftballon ---- */
      case 'balloon': {
        let pumps = 0, over = false;
        view.innerHTML = `${head}<div class="balloon-stage"><div class="balloon" id="bal">🎈</div></div>
          <div class="tap-count" id="bc">0</div>
          <div class="two-btn"><button class="btn big blood" id="bp">${esc(t('m.pump'))}</button><button class="btn big" id="bk">${esc(t('m.cash'))}</button></div>
          <p class="center sub" id="mt"></p>`;
        const bal = $('#bal');
        const end = (popped) => {
          if (over) return; over = true;
          $('#bp').disabled = true; $('#bk').disabled = true;
          if (popped) { bal.textContent = '💥'; bal.classList.add('popped'); Sound.play('balloonPop'); buzz(400); sendScore(0, t('m.popped')); }
          else { Sound.play('kaching'); sendScore(pumps, t('m.cashed', { n: pumps })); }
        };
        $('#bp').addEventListener('pointerdown', (e) => {
          e.preventDefault(); if (over) return;
          pumps++; $('#bc').textContent = pumps;
          bal.style.transform = `scale(${1 + pumps * 0.07})`;
          bal.classList.toggle('wobble', pumps > (x.pop || 20) * 0.6);
          Sound.play('pump'); buzz(8);
          if (pumps >= (x.pop || 20)) end(true);
        });
        $('#bk').addEventListener('click', () => end(false));
        miniTimer(playSec, $('#mt'), () => end(false));
        break;
      }
      /* ---- Farbchaos ---- */
      case 'colorword': {
        const C = [['red', '#e0525a'], ['blue', '#4a90e2'], ['green', '#4fb25c'], ['yellow', '#f0c93b']];
        let score = 0, ink = 0;
        view.innerHTML = `${head}<div class="stroop" id="sw"></div><div class="color-grid">${C.map((c, i) => `<button class="cbtn" data-i="${i}" style="background:${c[1]}"></button>`).join('')}</div>
          <p class="center mini-status" id="msc">${esc(t('m.score', { n: 0 }))}</p><p class="center sub" id="mt"></p>`;
        const next = () => {
          const word = ri(0, 3); ink = ri(0, 3);
          if (R() < 0.75 && ink === word) ink = (ink + 1 + ri(0, 2)) % 4;
          const el = $('#sw'); el.textContent = t('col.' + C[word][0]); el.style.color = C[ink][1];
          el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        };
        $$('.cbtn', view).forEach(b => b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (+b.dataset.i === ink) { score++; Sound.play('right'); buzz(8); } else { score = Math.max(0, score - 1); Sound.play('wrong'); buzz(100); }
          $('#msc').textContent = t('m.score', { n: score });
          next();
        }));
        next();
        miniTimer(playSec, $('#mt'), () => sendScore(score, t('sc.points', { n: score })));
        break;
      }
      /* ---- Hau den Verwandten ---- */
      case 'mole': {
        const RELS = ['👴', '👵', '🧔', '👩‍🦳', '🤵', '👨‍🦲', '🧓'];
        let score = 0;
        view.innerHTML = `${head}<div class="mole-grid">${Array.from({ length: 9 }, (_, i) => `<button class="hole" data-i="${i}"><span class="mole"></span></button>`).join('')}</div>
          <p class="center mini-status" id="msc">${esc(t('m.score', { n: 0 }))}</p><p class="center sub" id="mt"></p>`;
        const holes = $$('.hole', view);
        const state = Array(9).fill(null);
        const spawn = () => {
          const free = state.map((s, i) => (s ? -1 : i)).filter(i => i >= 0);
          if (free.length) {
            const i = free[ri(0, free.length - 1)];
            const cat = R() < 0.22;
            state[i] = cat ? 'cat' : 'rel';
            const m = holes[i].querySelector('.mole');
            m.textContent = cat ? '🐈' : RELS[ri(0, RELS.length - 1)];
            holes[i].classList.add('up');
            const h = later(() => { state[i] = null; holes[i].classList.remove('up'); }, 850 + ri(0, 350));
            holes[i].dataset.h = h;
          }
          later(spawn, 420 + ri(0, 260));
        };
        holes.forEach((b, i) => b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (!state[i]) return;
          if (state[i] === 'cat') { score = Math.max(0, score - 2); Sound.play('meow'); buzz(150); }
          else { score++; Sound.play('bonk'); buzz(15); }
          state[i] = null; b.classList.remove('up'); b.classList.add('hit'); later(() => b.classList.remove('hit'), 200);
          $('#msc').textContent = t('m.score', { n: score });
        }));
        spawn();
        miniTimer(playSec, $('#mt'), () => sendScore(score, t('sc.points', { n: score })));
        break;
      }
      /* ---- Münzen zählen ---- */
      case 'count': {
        const n = x.target || 20;
        const coins = Array.from({ length: n }, () => `<span class="coin" style="left:${(ri(2, 90))}%;top:${ri(2, 86)}%;transform:rotate(${ri(-40, 40)}deg)">🪙</span>`).join('');
        view.innerHTML = `${head}<div class="coin-field" id="cf">${coins}</div><p class="center mini-status" id="ct">3</p>`;
        let k = 3;
        const tick = () => { k--; if (k > 0) { $('#ct').textContent = k; Sound.play('tick'); later(tick, 1000); } else ask(); };
        later(tick, 1000);
        const ask = () => {
          $('#cf').innerHTML = '<div class="coin-gone">❓</div>';
          $('#ct').textContent = t('m.howMany');
          const f = document.createElement('form');
          f.innerHTML = `<input class="estimate-in" id="cv" inputmode="numeric" pattern="[0-9]*" autocomplete="off"><div class="sticky-cta"><button class="btn big blood" type="submit">${esc(t('p.send'))}</button></div>`;
          view.appendChild(f);
          const inp = $('#cv'); inp.focus();
          f.onsubmit = (e) => { e.preventDefault(); const v = parseInt(inp.value.replace(/[^\d]/g, ''), 10); if (!Number.isFinite(v)) { buzz(80); return; } inp.blur(); sendScore(v, String(v)); };
        };
        break;
      }
      /* ---- Tresor knacken ---- */
      case 'safe': {
        const secret = x.secret || 50;
        let tries = 0, lo = 1, hi = 100;
        const t0 = performance.now();
        view.innerHTML = `${head}<div class="safe-dial" id="sd">🔐</div><p class="center mini-status" id="sh">1 – 100</p>
          <form id="sf" class="safe-form"><input class="estimate-in" id="sv" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="3"><button class="btn big blood" type="submit">${esc(t('m.guess'))}</button></form>
          <p class="center sub" id="stries">${esc(t('m.tries', { n: 0 }))}</p><p class="center sub" id="mt"></p>`;
        const inp = $('#sv'); setTimeout(() => inp.focus(), 150);
        $('#sf').onsubmit = (e) => {
          e.preventDefault();
          const v = parseInt(inp.value.replace(/[^\d]/g, ''), 10);
          if (!(v >= 1 && v <= 100)) { buzz(80); return; }
          tries++; inp.value = '';
          $('#stries').textContent = t('m.tries', { n: tries });
          const dial = $('#sd'); dial.classList.remove('spin'); void dial.offsetWidth; dial.classList.add('spin');
          if (v === secret) {
            const secs = Math.min(99, Math.round((performance.now() - t0) / 1000));
            dial.textContent = '🔓'; $('#sh').textContent = t('m.cracked', { n: tries });
            Sound.play('unlock'); Sound.play('coins'); buzz([30, 30, 80]); inp.blur();
            sendScore(tries * 100 + secs, t('m.cracked', { n: tries }));
          } else {
            if (v < secret) lo = Math.max(lo, v + 1); else hi = Math.min(hi, v - 1);
            $('#sh').textContent = `${v < secret ? '⬆️ ' + t('m.higher') : '⬇️ ' + t('m.lower')} (${lo} – ${hi})`;
            Sound.play('tock'); buzz(20);
          }
        };
        miniTimer(playSec, $('#mt'), () => { inp.blur(); $('#sh').textContent = t('m.timeUp'); sendScore(null, t('sc.unsolved')); });
        break;
      }
      /* ---- Finde den Unterschied ---- */
      case 'oddone': {
        const PAIRS = [['🙂', '🙃'], ['😀', '😃'], ['🐶', '🐱'], ['🍎', '🍅'], ['🕐', '🕑'], ['💰', '💵'], ['🔑', '🗝️'], ['🎩', '👒'], ['🦉', '🐧'], ['⌚', '⏰'], ['👴', '🧓'], ['🍐', '🍏'], ['🐸', '🐢'], ['🏚️', '🏠']];
        let score = 0, lock = false;
        view.innerHTML = `${head}<div class="odd-grid" id="og"></div><p class="center mini-status" id="msc">${esc(t('m.score', { n: 0 }))}</p><p class="center sub" id="mt"></p>`;
        const next = () => {
          const [a, b] = PAIRS[ri(0, PAIRS.length - 1)];
          const size = score < 3 ? 16 : 25;
          const odd = ri(0, size - 1);
          const swap = R() < 0.5;
          const g = $('#og'); g.style.gridTemplateColumns = `repeat(${size === 16 ? 4 : 5}, 1fr)`;
          g.innerHTML = Array.from({ length: size }, (_, i) => `<button class="odd" data-i="${i}">${i === odd ? (swap ? a : b) : (swap ? b : a)}</button>`).join('');
          $$('.odd', g).forEach(btn => btn.addEventListener('pointerdown', (e) => {
            e.preventDefault(); if (lock) return;
            if (+btn.dataset.i === odd) { score++; Sound.play('right'); buzz(10); $('#msc').textContent = t('m.score', { n: score }); next(); }
            else { lock = true; btn.classList.add('bad'); Sound.play('wrong'); buzz(120); later(() => { lock = false; btn.classList.remove('bad'); }, 700); }
          }));
        };
        next();
        miniTimer(playSec, $('#mt'), () => sendScore(score, t('sc.points', { n: score })));
        break;
      }
      /* ---- Pfeilregen ---- */
      case 'arrows': {
        const DIRS = ['⬆️', '➡️', '⬇️', '⬅️'];
        let score = 0, want = 0;
        view.innerHTML = `${head}<div class="arrow-big" id="ab"></div><p class="center sub" id="ah"></p>
          <div class="arrow-pad">${['', '0', '', '3', '', '1', '', '2', ''].map(v => v === '' ? '<span></span>' : `<button class="abtn" data-d="${v}">${DIRS[+v]}</button>`).join('')}</div>
          <p class="center mini-status" id="msc">${esc(t('m.score', { n: 0 }))}</p><p class="center sub" id="mt"></p>`;
        const next = () => {
          const d = ri(0, 3), rev = R() < 0.25;
          want = rev ? (d + 2) % 4 : d;
          const el = $('#ab'); el.textContent = DIRS[d]; el.classList.toggle('rev', rev);
          $('#ah').textContent = rev ? '🔄 ' + (lang === 'tr' ? 'TERS!' : 'UMGEKEHRT!') : '';
          el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        };
        $$('.abtn', view).forEach(b => b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (+b.dataset.d === want) { score++; Sound.play('right'); buzz(8); } else { score = Math.max(0, score - 1); Sound.play('wrong'); buzz(100); }
          $('#msc').textContent = t('m.score', { n: score });
          next();
        }));
        next();
        miniTimer(playSec, $('#mt'), () => sendScore(score, t('sc.points', { n: score })));
        break;
      }
      /* ---- Gierschlund ---- */
      case 'unique': {
        view.innerHTML = `${head}<p class="center mini-status">${esc(t('m.pick'))}</p>
          <div class="num-grid">${Array.from({ length: 10 }, (_, i) => `<button class="num" data-n="${i + 1}">${i + 1}</button>`).join('')}</div>`;
        $$('.num', view).forEach(b => b.addEventListener('click', () => {
          $$('.num', view).forEach(x => x.classList.toggle('on', x === b));
          Sound.play('kaching'); buzz(30);
          sendScore(+b.dataset.n, t('sc.pick', { n: b.dataset.n }));
        }));
        break;
      }
    }
  }

  /* ================= Ergebnis ================= */
  function vResults() {
    const pd = S.pd;
    const d = (pd.deltas && pd.deltas[ME.id]) || 0;
    const mine = [];
    (pd.rooms || []).forEach(r => r.lines.forEach(l => { if (l.pid === ME.id || (l.p && (l.p.a === ME.name || l.p.b === ME.name))) mine.push({ ...l, room: r.room }); }));
    (pd.extra || []).forEach(l => { if (l.pid === ME.id) mine.push(l); });
    const learned = (ME.learned || []).filter(l => P(l.pid));
    const becameGhost = (pd.newGhosts || []).includes(ME.id);
    const revived = (pd.revived || []).includes(ME.id);
    view.innerHTML = `
      <div class="h2 center">${esc(t('p.roundResult'))}</div>
      <div class="delta-big ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${signed(d)}</div>
      <div class="lines">${mine.map((l, i) => `<div class="${l.a > 0 ? 'pos' : l.a < 0 ? 'neg' : ''}" style="animation-delay:${i * 120}ms">${l.room ? D.ROOMS[l.room].emoji + ' ' : ''}${esc(t(l.k, l.p))}</div>`).join('')}</div>
      ${learned.map(l => { const k = l.src === 'seer' ? ['🔮 ', 'p.seerLearned'] : l.src === 'photo' ? ['📸 ', 'p.photoLearned'] : ['🕵️ ', 'p.learned']; return `<div class="secret parchment">${k[0]}${esc(t(k[1], { a: P(l.pid).name, r: t('role.' + l.role) }))}</div>`; }).join('')}
      ${becameGhost ? `<div class="secret parchment">👻 ${esc(t('p.youAreGhost'))}<br><small>${esc(t('p.ghostInfo'))}</small></div>` : ''}
      ${revived ? `<div class="secret parchment">✨ ${esc(t('g.revived', { a: ME.name }))}</div>` : ''}
      <div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`;
    if (d > 0) { Sound.play('coin'); buzz(30); } else if (d < 0) { Sound.play('lose'); buzz(120); }
    if (learned.length) { buzz([30, 30, 30, 30]); Sound.play('sparkle'); }
    if (becameGhost) Sound.play('ghost');
  }

  /* ================= Abstimmung ================= */
  function vVote() {
    const pd = S.pd;
    if (pd.stage === 'vote') {
      const list = S.players.filter(p => p.id !== ME.id);
      view.innerHTML = `<div class="h2 center">🗳️ ${esc(t('vq.' + pd.clause))}</div>
        <p class="sub center">${pd.amount > 0 ? '+' : '−'}${fmt(Math.abs(pd.amount), lang)} ${esc(t('cur'))}</p>
        <div class="vote-list">${list.map(p => `<button class="pick ${ME.vote === p.id ? 'on' : ''}" data-pid="${p.id}">${medal(p)}<span class="pn">${esc(p.name)}</span></button>`).join('')}</div>
        ${ME.vote ? `<p class="center sub" style="margin-top:1rem">✅ ${esc(t('p.voted'))}</p>` : ''}`;
      $$('.pick', view).forEach(b => b.onclick = () => {
        conn.emit('player:vote', b.dataset.pid);
        $$('.pick', view).forEach(x => x.classList.toggle('on', x === b));
        Sound.play('stamp'); buzz(25);
      });
      return;
    }
    const w = P(pd.winner);
    const isMe = pd.winner === ME.id;
    view.innerHTML = `<div class="h2 center">${esc(t('vq.' + pd.clause))}</div>
      ${w ? `<div class="wait-hero">${medal(w, 'huge')}<div class="h2">${esc(w.name)}</div><div class="delta-big ${pd.applied >= 0 ? 'pos' : 'neg'}">${signed(pd.applied)}</div>
        ${pd.clown ? `<p class="center">${esc(t('g.clownVote', { a: w.name }))}</p>` : ''}</div>` : `<p class="center sub">${esc(t('g.noVotes'))}</p>`}`;
    if (isMe) { buzz([60, 60, 200]); Sound.play(pd.applied >= 0 ? 'win' : 'wahwah'); }
  }

  function vFinalVote() {
    const qs = S.pd.qs || [];
    if (ME.finalVote) { view.innerHTML = `<div class="big-emoji">🔏</div><div class="h2 center">${esc(t('p.finalDone'))}</div><div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`; return; }
    const list = S.players.filter(p => p.id !== ME.id);
    view.innerHTML = `<div class="h2 center">🔍 ${esc(t('p.finalVote'))}</div>
      ${qs.map(q => `<div class="fv-q"><h3>${D.ROLES[q].emoji} ${esc(t('g.who.' + q))}</h3>
        <div class="vote-list" data-q="${q}">${list.map(p => `<button class="pick ${fvDraft[q] === p.id ? 'on' : ''}" data-pid="${p.id}">${medal(p)}<span class="pn">${esc(p.name)}</span></button>`).join('')}</div></div>`).join('')}
      <div class="sticky-cta"><button class="btn big blood" id="fv-send">${esc(t('p.send'))}</button></div>`;
    $$('.vote-list', view).forEach(box => box.onclick = (e) => {
      const b = e.target.closest('.pick'); if (!b) return;
      fvDraft[box.dataset.q] = b.dataset.pid;
      $$('.pick', box).forEach(x => x.classList.toggle('on', x === b));
      Sound.play('pop'); buzz(15);
    });
    $('#fv-send').onclick = () => {
      if (!qs.every(q => fvDraft[q])) { toast('☝️ ' + qs.filter(q => !fvDraft[q]).map(q => t('g.who.' + q)).join(' ')); buzz(80); return; }
      conn.emit('player:finalvote', fvDraft);
      Sound.play('stamp'); buzz([20, 40, 20]);
    };
  }

  function vFinale() {
    const rk = S.pd.ranking || [];
    const idx = rk.findIndex(r => r.pid === ME.id);
    if (!showRank) {
      view.innerHTML = `<div class="big-emoji">📜</div><div class="h2 center">${esc(t('f.title'))}</div><div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>
        <p class="center" style="margin-top:2rem"><button class="btn ghosty" id="show-rank">🏆 ${esc(t('p.end'))}</button></p>`;
      $('#show-rank').onclick = () => { showRank = true; viewKey = ''; render(); };
      return;
    }
    const me = rk[idx];
    view.innerHTML = `<div class="final-rank card-box">${medal(P(ME.id), 'huge')}<div class="sub">${esc(t('p.end'))}</div><div class="rn">${esc(t('p.rank', { n: idx + 1 }))}</div>
      <span class="money">${fmt(me ? me.money : 0, lang)}</span><p class="sub" style="margin-top:1rem">${D.ROLES[ME.role].emoji} ${esc(t('role.' + ME.role))}</p></div>
      <div class="lines">${rk.map((r, i) => { const p = P(r.pid); return p ? `<div class="rank-line">${i + 1}. ${medal(p, 'tiny')} ${esc(p.name)} · ${fmt(r.money, lang)}</div>` : ''; }).join('')}</div>
      <p class="center sub" style="margin-top:1.4rem">${esc(t('p.thanks'))}</p>`;
    if (idx === 0) { confetti({ count: 200 }); Sound.play('fanfare'); }
  }

  // Bei neuem Spiel zurücksetzen
  let prevPhase = null;
  conn.on('state', (d) => {
    if (d.phase === 'lobby') {
      showRank = false; fvDraft = {}; draftRound = -1;
      if (prevPhase && prevPhase !== 'lobby') { Chat.msgs = []; Chat.unread = {}; updateChatBadge(); }
    }
    prevPhase = d.phase;
  });

  window.__otto = () => ({ S, ME, Chat });
  applyI18n();
  renderJoinPortrait();
})();
