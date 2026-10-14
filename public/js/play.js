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

  async function openPhoto(onDone, opts = {}) {
    Photo.onDone = onDone;
    Photo.profile = opts.profile !== false;
    $('#photo-title').textContent = t(opts.title || 'p.photoTitle');
    $('#photo-hint').textContent = t(opts.hint || 'p.photoHint');
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
    if (Photo.profile) { // Selfies für Abstimmungen ersetzen nicht das Profilbild
      Photo.data = data;
      Photo.mode = 'photo';
      store.set('otto.photo', data);
      store.set('otto.mode', 'photo');
    }
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
    if (th === 'fam') return famLabel(ME.family || 0);
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
        const icon = th === 'fam' ? `<div class="medal fam-medal" style="--c:${D.FAMILIES[ME.family || 0].color}">${D.FAMILIES[ME.family || 0].emoji}</div>` : medal(P(th));
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
    if (S.phase === 'lobby') extra = S.players.map(p => p.avatar + p.photo + p.famPick).join('') + S.settings.famMode + S.settings.famCount;
    if (S.phase === 'plan') extra = (ME.plan && !editing ? 'S' : 'E') + (ME.ghost ? 'g' : '');
    if (S.phase === 'vote') extra = (ME.vote ? 'v' : '') + (ME.selfie ? 's' : '');
    if (S.phase === 'twist') extra = (ME.twistIn !== undefined ? 't' : '') + (ME.roleChanged ? 'r' : '');
    if (S.phase === 'auction') extra = ME.bid !== undefined ? 'b' + ME.bid : '';
    if (S.phase === 'finalvote') extra = ME.finalVote ? 'f' : '';
    if (S.phase === 'duel') extra = (ME.duelScore !== undefined ? 'd' : '') + (ME.bet ? 'b' : '');
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
      case 'twist': return vTwist();
      case 'auction': return vAuction();
    }
  }

  // Fortschrittsbalken
  (function loop() {
    requestAnimationFrame(loop);
    if (!S) return;
    const active = S.endsAt && (['plan', 'vote', 'finalvote'].includes(S.phase) || (S.phase === 'duel' && S.pd.stage === 'play') || (S.phase === 'twist' && S.pd.stage === 'act') || (S.phase === 'auction' && S.pd.stage === 'bid'));
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
      ${famPicker(me)}
      <div class="card-box lobby-av ${me && me.photo ? 'hidden' : ''}"><div class="section-title">${esc(t('p.avatar'))}</div><div class="av-grid" id="lobby-av"></div></div>
      <p class="center"><button class="btn ghosty" id="btn-leave">${esc(t('p.leave'))}</button></p>`;
    buildAvatarGrid($('#lobby-av'), taken, (a) => { store.set('otto.avatar', a); conn.emit('player:avatar', a); });
    $('#btn-newphoto').onclick = () => openPhoto((data) => conn.emit('player:photo', data, (r) => { if (r && r.ok) toast(t('p.photoSaved')); }));
    $('#btn-leave').onclick = () => { conn.emit('player:leave'); store.del('otto.player'); showJoin(''); };
    $$('[data-fam]', view).forEach(b => b.onclick = () => {
      const f = +b.dataset.fam;
      conn.emit('player:family', me && me.famPick === f ? null : f);
      Sound.play('stamp'); buzz(20);
    });
  }

  // Familienwahl in der Lobby
  function famPicker(me) {
    const { famMode, famCount } = S.settings;
    if (famMode === 'random') return `<div class="card-box fam-box"><div class="section-title"><span>👨‍👩‍👧 ${esc(t('h.families'))}</span></div><p class="sub" style="margin:0">${esc(t('p.famRandom'))}</p></div>`;
    if (famMode !== 'choose') return '';
    return `<div class="card-box fam-box"><div class="section-title"><span>👨‍👩‍👧 ${esc(t('p.famChoose'))}</span></div>
      <div class="fam-pick">${D.FAMILIES.slice(0, famCount).map(f => {
        const n = S.players.filter(p => p.famPick === f.id).length;
        return `<button class="fam-opt ${me && me.famPick === f.id ? 'on' : ''}" data-fam="${f.id}" style="--fc:${f.color}">
          <span class="fam-crest">${f.emoji}</span><span class="fn">${esc(t('fam.' + f.id))}</span><small>${esc(t('p.famMembers', { n }))}</small></button>`;
      }).join('')}</div></div>`;
  }
  const famLabel = (id) => D.FAMILIES[id].emoji + ' ' + t('fam.' + id);

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
            ${fam ? `<p style="margin-top:.8rem"><b>${esc(t('p.family'))}:</b> ${esc(famLabel(fam.id))}</p><div class="fam-row">${fam.members.map(id => medal(P(id), 'tiny')).join('')}</div>` : ''}
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
      ${wantedNote()}
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
  function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheet-body').innerHTML = ''; Deals.open = false; }
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
    const notes = [...(ME.notes || [])].reverse();
    const fam = ME.family != null && S.families ? S.families.find(f => f.id === ME.family) : null;
    openSheet(`<div class="dossier">
      <h3>📂 ${esc(t('p.dossier'))}</h3>
      <div class="role-big"><span class="e">${D.ROLES[r].emoji}</span><div><b>${esc(t('role.' + r))}</b><div>${esc(t('roled.' + r))}</div>
        ${ME.catLives != null ? `<small>🐾 ${esc(t('p.catLives', { n: ME.catLives }))}</small>` : ''}</div></div>
      ${fam ? `<h4>${esc(t('p.family'))}: ${esc(famLabel(fam.id))}</h4>${fam.members.map(id => { const p = P(id); return p ? `<div class="row">${medal(p, 'tiny')}<div><b>${esc(p.name)}</b></div></div>` : ''; }).join('')}` : ''}
      <h4>${esc(t('p.known'))}</h4>
      ${notes.length ? notes.map(c => `<div class="row"><span class="e">${CLUE_ICON[c.src] || '🕵️'}</span><div><b>${esc(t(c.k, c.p))}</b><small>${esc(t('p.clueRound', { n: c.round }))} · ${esc(t('clue.src.' + c.src))}</small></div></div>`).join('') : `<p>${esc(t('p.nothingKnown'))}</p>`}
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
    if (!inDuel) return vSpectate(pd);
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
      const pr = (pd.pranked || []).find(x => x.pid === ME.id);
      if (pr) view.insertAdjacentHTML('beforeend', `<div class="secret parchment prank-note">🤡 ${esc(t('p.prankMe', { x: t('prank.' + pr.kind) }))}</div>`);
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
    const learned = (ME.learned || []).filter(l => l.k);
    const becameGhost = (pd.newGhosts || []).includes(ME.id);
    const revived = (pd.revived || []).includes(ME.id);
    view.innerHTML = `
      <div class="h2 center">${esc(t('p.roundResult'))}</div>
      <div class="delta-big ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${signed(d)}</div>
      <div class="lines">${mine.map((l, i) => `<div class="${l.a > 0 ? 'pos' : l.a < 0 ? 'neg' : ''}" style="animation-delay:${i * 120}ms">${l.room ? D.ROOMS[l.room].emoji + ' ' : ''}${esc(t(l.k, l.p))}</div>`).join('')}</div>
      ${learned.map(l => `<div class="secret parchment clue"><small>${CLUE_ICON[l.src] || '🕵️'} ${esc(t('clue.src.' + l.src))}</small>${esc(t(l.k, l.p))}</div>`).join('')}
      ${becameGhost ? `<div class="secret parchment">👻 ${esc(t('p.youAreGhost'))}<br><small>${esc(t('p.ghostInfo'))}</small></div>` : ''}
      ${revived ? `<div class="secret parchment">✨ ${esc(t('g.revived', { a: ME.name }))}</div>` : ''}
      <div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`;
    if (d > 0) { Sound.play('coin'); buzz(30); } else if (d < 0) { Sound.play('lose'); buzz(120); }
    if (learned.length) { buzz([30, 30, 30, 30]); Sound.play('sparkle'); }
    if (becameGhost) Sound.play('ghost');
  }

  const CLUE_ICON = { lib: '🕵️', seer: '🔮', photo: '📸', twist: '🎭' };

  /* ================= Abstimmung ================= */
  function vVote() {
    const pd = S.pd;
    if (pd.stage === 'selfie') return vSelfie(pd);
    if (pd.stage === 'vote') {
      const cands = pd.candidates;
      const list = S.players.filter(p => p.id !== ME.id && (!cands || cands.includes(p.id)));
      const face = (p) => cands ? `<img class="selfie-img" src="/selfie/${S.code}/${p.id}?r=${pd.selfieRound}" alt="">` : medal(p);
      view.innerHTML = `<div class="h2 center">${cands ? '📸' : '🗳️'} ${esc(t('vq.' + pd.clause))}</div>
        <p class="sub center">${pd.amount > 0 ? '+' : '−'}${fmt(Math.abs(pd.amount), lang)} ${esc(t('cur'))}</p>
        <div class="vote-list ${cands ? 'selfie-list' : ''}">${list.map(p => `<button class="pick ${ME.vote === p.id ? 'on' : ''}" data-pid="${p.id}">${face(p)}<span class="pn">${esc(p.name)}</span></button>`).join('')}</div>

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
      ${myAwards()}
      <div class="lines">${rk.map((r, i) => { const p = P(r.pid); return p ? `<div class="rank-line">${i + 1}. ${medal(p, 'tiny')} ${esc(p.name)} · ${fmt(r.money, lang)}</div>` : ''; }).join('')}</div>
      <p class="center sub" style="margin-top:1.4rem">${esc(t('p.thanks'))}</p>`;
    if (idx === 0) { confetti({ count: 200 }); Sound.play('fanfare'); }
  }

  /* ================= Gesucht & Streiche ================= */
  function wantedNote() {
    const w = S.pd && S.pd.wanted;
    if (!w || !P(w)) return '';
    if (w === ME.id) return `<div class="wanted-note me">${esc(t('p.wantedMe'))}</div>`;
    return `<div class="wanted-note">${medal(P(w), 'tiny')}<span>${esc(t('p.wantedOther', { a: P(w).name }))}</span></div>`;
  }
  let lastPrank = null;
  conn.on('state', (d) => {
    const me = d.me && d.players.find(p => p.id === d.me.id);
    const pr = me ? me.prank : null;
    if (pr && pr !== lastPrank && d.phase !== 'lobby') { toast('🤡 ' + t('p.prankMe', { x: t('prank.' + pr) }), 4000); Sound.play('boing'); buzz([30, 60, 30]); }
    lastPrank = pr;
  });

  /* ================= Zuschauer: Wetten & Sabotage ================= */
  let betDraft = { on: null, amount: 20 };
  let sabTarget = null;
  function vSpectate(pd) {
    const duelists = pd.pids.map(P).filter(Boolean);
    const head = `<div class="duel-head"><div class="dn">${D.DUELS[pd.type].emoji} ${esc(t('duel.' + pd.type))}</div><p>${esc(t('p.spectator'))}</p></div>`;
    if (pd.stage === 'result') {
      const br = (pd.betResults || []).find(b => b.pid === ME.id);
      view.innerHTML = `${head}${br ? `<div class="duel-res"><div class="e">${br.delta > 0 ? '🎰' : '💸'}</div><div class="t ${br.delta > 0 ? 'pos' : 'neg'}">${esc(br.delta > 0 ? t('p.betWon', { n: br.delta }) : t('p.betLost', { n: -br.delta }))}</div></div>` : ''}<div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`;
      if (br) { if (br.delta > 0) { Sound.play('jackpot'); confetti({ count: 60 }); buzz([40, 40, 100]); } else { Sound.play('wahwah'); buzz(150); } }
      return;
    }
    let betHtml = '';
    if (ME.ghost) betHtml = '';
    else if (ME.bet) {
      const on = P(ME.bet.on);
      betHtml = `<div class="bet-box card-box placed"><div class="section-title"><span>${esc(t('p.betTitle'))}</span></div><div class="bet-placed">${on ? medal(on, 'tiny') : ''} ${esc(t('p.betPlaced', { n: fmt(ME.bet.amount, lang), a: on ? on.name : '?' }))}</div></div>`;
    } else if (ME.money < 10) betHtml = `<p class="sub center">${esc(t('p.betNoMoney'))}</p>`;
    else {
      if (!pd.pids.includes(betDraft.on)) betDraft.on = null;
      const amounts = [10, 20, 50, 100, 200].filter(a => a <= ME.money);
      if (!amounts.includes(betDraft.amount)) betDraft.amount = amounts[Math.min(1, amounts.length - 1)];
      betHtml = `<div class="bet-box card-box"><div class="section-title"><span>${esc(t('p.betTitle'))}</span><small>${esc(t('p.betOn'))}</small></div>
        <div class="bet-who">${duelists.map(p => `<button class="pick ${betDraft.on === p.id ? 'on' : ''}" data-bet="${p.id}">${medal(p)}<span class="pn">${esc(p.name)}</span></button>`).join('')}</div>
        <div class="chip-row">${amounts.map(a => `<button class="chip ${betDraft.amount === a ? 'on' : ''}" data-amt="${a}">🪙 ${fmt(a, lang)}</button>`).join('')}</div>
        <button class="btn big blood" id="bet-go">${esc(t('p.betBtn'))}</button></div>`;
    }
    let sabHtml = '';
    if (pd.stage === 'play') {
      if (!pd.pids.includes(sabTarget)) sabTarget = pd.pids[0];
      const left = ME.sabLeft;
      vSpectate.left = left;
      sabHtml = `<div class="sab-box card-box"><div class="section-title"><span>${esc(t('p.sabTitle'))}</span><small>${esc(left > 0 ? t('p.sabHint', { n: left }) : t('p.sabEmpty'))}</small></div>
        <div class="bet-who sab-who">${duelists.map(p => `<button class="pick ${sabTarget === p.id ? 'on' : ''}" data-sabt="${p.id}">${medal(p)}<span class="pn">${esc(p.name)}</span></button>`).join('')}</div>
        <div class="sab-btns">${Object.keys(D.SABOTAGE).map(k => `<button class="sab-btn" data-sab="${k}" ${left > 0 ? '' : 'disabled'}><span>${D.SABOTAGE[k].emoji}</span><small>${esc(t('sab.' + k))}</small></button>`).join('')}</div></div>`;
    }
    view.innerHTML = `${head}${betHtml}${sabHtml}${pd.stage === 'intro' ? `<div class="look-tv">📺 ${esc(t('p.duelWatch'))}</div>` : ''}`;
    $$('[data-bet]', view).forEach(b => b.onclick = () => { betDraft.on = b.dataset.bet; $$('[data-bet]', view).forEach(x => x.classList.toggle('on', x === b)); Sound.play('pop'); buzz(10); });
    $$('[data-amt]', view).forEach(b => b.onclick = () => { betDraft.amount = +b.dataset.amt; $$('[data-amt]', view).forEach(x => x.classList.toggle('on', x === b)); Sound.play('coin'); buzz(10); });
    const go = $('#bet-go');
    if (go) go.onclick = () => {
      if (!betDraft.on) { toast(t('p.betOn')); buzz(80); return; }
      go.disabled = true;
      conn.emit('player:bet', { on: betDraft.on, amount: betDraft.amount }, (r) => { go.disabled = false; if (r && r.ok) { Sound.play('kaching'); buzz([20, 30, 20]); } else toast('⚠️'); });
    };
    $$('[data-sabt]', view).forEach(b => b.onclick = () => { sabTarget = b.dataset.sabt; $$('[data-sabt]', view).forEach(x => x.classList.toggle('on', x === b)); Sound.play('pop'); });
    $$('[data-sab]', view).forEach(b => b.onclick = () => {
      if (!sabTarget) return;
      b.classList.remove('thrown'); void b.offsetWidth; b.classList.add('thrown');
      conn.emit('player:sabotage', { to: sabTarget, kind: b.dataset.sab }, (r) => {
        if (r && r.ok) {
          Sound.play(b.dataset.sab === 'tomato' ? 'splat' : 'whoosh'); buzz(30);
          const left = Math.max(0, (vSpectate.left != null ? vSpectate.left : ME.sabLeft) - 1);
          vSpectate.left = left;
          const hint = $('.sab-box .section-title small'); if (hint) hint.textContent = left > 0 ? t('p.sabHint', { n: left }) : t('p.sabEmpty');
          if (!left) $$('[data-sab]', view).forEach(x => { x.disabled = true; });
        } else if (r && r.error === 'empty') toast(t('p.sabEmpty'));
      });
    });
  }

  // Ich werde sabotiert, während ich spiele
  conn.on('sabotaged', (s) => {
    if (!S || S.phase !== 'duel' || S.pd.stage !== 'play') return;
    const from = P(s.from);
    toast(`${D.SABOTAGE[s.kind].emoji} ${t('p.sabGot', { a: from ? from.name : '?', x: t('sab.' + s.kind) })}`, 2200);
    const layer = $('#sab-layer');
    if (s.kind === 'tomato') {
      const el = document.createElement('div');
      el.className = 'splat';
      el.style.left = (10 + Math.random() * 60) + '%'; el.style.top = (20 + Math.random() * 50) + '%';
      el.innerHTML = '<span>🍅</span>';
      layer.appendChild(el);
      setTimeout(() => el.remove(), 3200);
      Sound.play('splat'); buzz([60, 30, 60]);
    } else {
      const cls = 'sab-' + s.kind;
      document.body.classList.remove(cls); void document.body.offsetWidth; document.body.classList.add(cls);
      clearTimeout(vSpectate['tm' + s.kind]);
      vSpectate['tm' + s.kind] = setTimeout(() => document.body.classList.remove(cls), s.kind === 'flip' ? 2600 : 3000);
      Sound.play(s.kind === 'quake' ? 'rumble' : s.kind === 'fog' ? 'stink' : 'boing'); buzz(s.kind === 'quake' ? [80, 40, 80, 40, 80] : 60);
    }
  });

  /* ================= Selfie-Duell ================= */
  function vSelfie(pd) {
    if (ME.selfie) {
      view.innerHTML = `<div class="big-emoji">🤳</div><div class="h2 center">${esc(t('p.selfieSent'))}</div><div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`;
      return;
    }
    view.innerHTML = `<div class="clause-paper parchment"><b>${esc(t('p.selfieTitle'))}</b><p>${esc(t('clause.' + pd.clause))}</p></div>
      <p class="sub center">${esc(t('p.selfieHint'))}</p>
      <div class="sticky-cta"><button class="btn big blood" id="btn-selfie">${esc(t('p.selfieTake'))}</button></div>`;
    $('#btn-selfie').onclick = () => openPhoto((data) => {
      conn.emit('player:selfie', data, (r) => { if (r && r.ok) { Sound.play('shutter'); buzz([20, 40, 20]); } else toast('⚠️'); });
    }, { profile: false, title: 'p.selfieTitle', hint: 'vq.' + pd.clause });
    buzz([40, 40, 40]);
  }

  /* ================= Plot-Twist ================= */
  let tapState = null;
  function vTwist() {
    const pd = S.pd, tw = D.TWISTS[pd.type] || { emoji: '🌀' };
    const head = `<div class="twist-head"><div class="tw-badge">${esc(t('h.twist'))}</div><div class="tw-e">${tw.emoji}</div><div class="h2 center">${esc(t('twist.' + pd.type))}</div><p class="sub center">${esc(t('twistd.' + pd.type))}</p></div>`;
    if (tapState && (pd.stage !== 'act' || pd.type !== 'treasure_hunt')) { tapState.alive = false; tapState = null; }
    if (pd.stage === 'act' && pd.type === 'tax_raid') {
      if (ME.twistIn !== undefined) { view.innerHTML = `${head}<div class="secret parchment">🫣 ${esc(t('p.twistHidden', { r: ME.twistIn }))}</div><div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`; return; }
      view.innerHTML = `${head}<div class="section-title"><span>${esc(t('p.twistHide'))}</span></div><div class="rooms hide-rooms">${(pd.rooms || S.rooms).map(r => `<button class="room-btn" data-room="${r}" style="--tone:${D.ROOMS[r].tone}"><span class="re">${D.ROOMS[r].emoji}</span><span class="rn">${esc(t('room.' + r))}</span></button>`).join('')}</div>`;
      $$('[data-room]', view).forEach(b => b.onclick = () => { conn.emit('player:twist', b.dataset.room); Sound.play('stairs'); buzz(30); });
      buzz([100, 50, 100]);
      return;
    }
    if (pd.stage === 'act' && pd.type === 'treasure_hunt') {
      if (ME.ghost) { view.innerHTML = `${head}<div class="look-tv">👻 ${esc(t('p.twistWatch'))}</div>`; return; }
      if (ME.twistIn !== undefined) { view.innerHTML = `${head}<div class="duel-res"><div class="e">⛏️</div><div class="t">${esc(t('p.twistTaps', { n: ME.twistIn }))}</div></div><div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`; return; }
      if (tapState && tapState.alive) return;
      tapState = { n: 0, alive: true };
      const st = tapState;
      view.innerHTML = `<div class="twist-head small"><div class="tw-e">${tw.emoji}</div><div class="h2 center">${esc(t('p.twistTapHint'))}</div></div>
        <button class="tap-zone dig" id="dig">${esc(t('p.twistTap'))}</button><div class="tap-count" id="digc">0</div><p class="center sub" id="digt"></p>`;
      const btn = $('#dig');
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); if (!st.alive) return;
        st.n++; $('#digc').textContent = st.n; Sound.play('dig'); buzz(6);
        if (st.n % 10 === 0) { const s = document.createElement('span'); s.className = 'dirt'; s.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); s.textContent = ['🪙', '💎', '🦴', '🥔'][Math.floor(Math.random() * 4)]; btn.appendChild(s); setTimeout(() => s.remove(), 900); }
      });
      const send = () => { if (!st.alive) return; st.alive = false; btn.disabled = true; conn.emit('player:twist', st.n); };
      (function tick() {
        if (!st.alive) return;
        const l = Clock.left(S.endsAt);
        const el = $('#digt'); if (el) el.textContent = (l / 1000).toFixed(1) + ' s';
        if (l <= 700) return send();
        requestAnimationFrame(tick);
      })();
      buzz(80);
      return;
    }
    if (pd.stage === 'result') {
      const mine = (pd.lines || []);
      view.innerHTML = `${head}
        ${pd.raid ? `<p class="center tw-raid">🚔 ${esc(t('tw.raided', { r: pd.raid }))}</p>` : ''}
        <div class="lines">${mine.map((l, i) => `<div class="${l.pid === ME.id ? 'me ' : ''}${l.a > 0 ? 'pos' : l.a < 0 ? 'neg' : ''}" style="animation-delay:${i * 150}ms">${esc(t(l.k, l.p))}</div>`).join('')}</div>
        ${ME.roleChanged ? `<div class="secret parchment role-swap"><div>🎭 ${esc(t('p.roleChanged'))}</div><div class="re">${D.ROLES[ME.role].emoji}</div><b>${esc(t('role.' + ME.role))}</b><p>${esc(t('roled.' + ME.role))}</p></div>` : ''}
        <div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`;
      const mineLine = mine.find(l => l.pid === ME.id);
      if (mineLine && mineLine.a > 0) { Sound.play('jackpot'); buzz([30, 30, 90]); }
      else if (mineLine && mineLine.a < 0) { Sound.play('wahwah'); buzz(250); }
      if (ME.roleChanged) { Sound.play('sparkle'); buzz([60, 60, 60, 60]); }
      return;
    }
    view.innerHTML = `${head}<div class="look-tv">${pd.type === 'treasure_hunt' ? '⛏️ ' + esc(t('p.twistTapReady')) : '📺 ' + esc(t('p.lookTV'))}</div>`;
    buzz([100, 60, 100]);
  }

  /* ================= Erbstück-Auktion ================= */
  let bidDraft = 0;
  function vAuction() {
    const pd = S.pd, h = D.HEIRLOOM_BY_ID[pd.h];
    const item = `<div class="auction-item"><div class="ai-e">${h.emoji}</div><div class="h2 center">${esc(t('h.' + pd.h))}</div></div>`;
    if (pd.stage === 'result') {
      const w = P(pd.winner);
      const mine = pd.winner === ME.id;
      view.innerHTML = `<div class="section-title center-title">${esc(t('p.auction'))}</div>${item}
        ${w ? `<div class="wait-hero">${medal(w)}<div class="h2">${esc(t('h.sold', { a: w.name, n: fmt(pd.price, lang) }))}</div></div>` : `<p class="center sub">${esc(t('h.unsold'))}</p>`}
        ${ME.bid > 0 && !mine ? `<p class="center sub">${esc(t('p.auctionLost'))}</p>` : ''}`;
      if (mine) { Sound.play('gavel'); confetti({ count: 70 }); buzz([40, 40, 120]); toast(t('p.auctionWon', { h: pd.h })); }
      return;
    }
    if (ME.bid !== undefined) {
      view.innerHTML = `<div class="section-title center-title">${esc(t('p.auction'))}</div>${item}<div class="secret parchment">🔨 ${esc(ME.bid > 0 ? t('p.bidDone', { n: fmt(ME.bid, lang) }) : t('p.noBidDone'))}</div><div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`;
      return;
    }
    if (ME.ghost) { view.innerHTML = `${item}<div class="look-tv">👻 ${esc(t('p.lookTV'))}</div>`; conn.emit('player:bid', 0); return; }
    bidDraft = Math.min(bidDraft || 50, ME.money);
    view.innerHTML = `<div class="section-title center-title">${esc(t('p.auction'))}</div>${item}
      <p class="sub center">${esc(t('p.bidHint'))}</p>
      <div class="bid-display"><span class="money" id="bid-v">${fmt(bidDraft, lang)}</span></div>
      <div class="chip-row">${[-50, -10, 10, 50, 100].map(d => `<button class="chip" data-d="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)}</button>`).join('')}</div>
      <div class="two-btn"><button class="btn big blood" id="bid-go">🔨 ${esc(t('p.bid'))}</button><button class="btn big" id="bid-no">${esc(t('p.noBid'))}</button></div>`;
    $$('[data-d]', view).forEach(b => b.onclick = () => {
      bidDraft = Math.max(0, Math.min(ME.money, bidDraft + +b.dataset.d));
      $('#bid-v').textContent = fmt(bidDraft, lang);
      const v = $('#bid-v'); v.classList.remove('pop'); void v.offsetWidth; v.classList.add('pop');
      Sound.play('coin'); buzz(8);
    });
    $('#bid-go').onclick = () => { if (bidDraft <= 0) { buzz(80); return; } conn.emit('player:bid', bidDraft); Sound.play('gavel'); buzz([20, 40, 20]); };
    $('#bid-no').onclick = () => { conn.emit('player:bid', 0); Sound.play('pop'); };
    Sound.play('gavel');
  }

  /* ================= Handel & Verträge ================= */
  const Deals = { list: [], unread: 0, open: false };
  conn.on('dealHistory', (list) => { Deals.list = Array.isArray(list) ? list : []; updateDealBadge(); });
  conn.on('deal', (d) => {
    if (!ME) return;
    const i = Deals.list.findIndex(x => x.id === d.id);
    const prev = i >= 0 ? Deals.list[i] : null;
    if (i >= 0) Deals.list[i] = d; else Deals.list.push(d);
    const other = P(d.from === ME.id ? d.to : d.from);
    const name = other ? other.name : '?';
    if (!prev && d.to === ME.id && d.status === 'open') { toast(t('p.dealIncoming', { a: name }), 4000); Sound.play('scribble'); buzz([30, 50, 30]); if (!Deals.open) Deals.unread++; }
    else if (prev && prev.status !== d.status) {
      if (d.status === 'accepted') { toast(t('p.dealSignedMe', { a: name })); Sound.play('stamp'); buzz([20, 40, 20]); }
      else if (d.status === 'declined' && d.from === ME.id) { toast(t('p.dealDeclinedMe', { a: name })); Sound.play('wrong'); }
      else if (d.status === 'broken' && d.brokenBy === ME.id) { toast(t('p.dealBrokenMe', { a: name }), 4000); Sound.play('wahwah'); buzz(300); }
    }
    updateDealBadge();
    if (Deals.open) renderDeals();
  });
  function updateDealBadge() {
    const pending = ME ? Deals.list.filter(d => d.to === ME.id && d.status === 'open').length : 0;
    const n = Math.max(pending, Deals.unread ? pending : 0);
    const b = $('#deal-badge');
    b.textContent = n; b.classList.toggle('hidden', !n);
    $('#deal-btn').classList.toggle('hidden', !S || S.phase === 'lobby' || S.phase === 'finale');
  }
  conn.on('state', () => updateDealBadge());
  $('#deal-btn').onclick = () => openDeals();
  function closeDeals() { Deals.open = false; }
  function dealTerms(d) {
    const a = P(d.from), b = P(d.to);
    const out = [];
    if (d.giveMoney) out.push(t('p.dealPays', { a: a ? a.name : '?', n: fmt(d.giveMoney, lang) }));
    if (d.wantMoney) out.push(t('p.dealPays', { a: b ? b.name : '?', n: fmt(d.wantMoney, lang) }));
    if (d.giveCard) out.push(t('p.dealCardFrom', { a: a ? a.name : '?', c: d.giveCard }));
    if (d.promise) out.push(t('p.dealPromiseFrom', { a: a ? a.name : '?', x: d.promise.key ? t('promise.' + d.promise.key) : d.promise.text }));
    return out;
  }
  function openDeals() {
    if (!ME || !S || S.phase === 'lobby' || S.phase === 'finale') return;
    Deals.open = true; Deals.unread = 0; Deals.form = false;
    renderDeals();
  }
  function renderDeals() {
    if (!Deals.open) return;
    if (Deals.form) return renderDealForm();
    const list = [...Deals.list].sort((x, y) => (x.status === 'open' ? 0 : 1) - (y.status === 'open' ? 0 : 1) || y.id - x.id);
    openSheet(`<div class="deals"><h3>🤝 ${esc(t('p.deals'))}</h3>
      <button class="btn blood wide" id="deal-new">${esc(t('p.dealNew'))}</button>
      ${list.length ? list.map(d => {
        const other = P(d.from === ME.id ? d.to : d.from);
        const incoming = d.to === ME.id && d.status === 'open';
        const mineOpen = d.from === ME.id && d.status === 'open';
        const canAccuse = d.status === 'accepted';
        return `<div class="deal st-${d.status}">
          <div class="deal-top">${medal(other, 'tiny')}<b>${esc(other ? other.name : '?')}</b><span class="deal-st">${d.status === 'broken' ? '🐍 ' : d.status === 'accepted' ? '✍️ ' : ''}${esc(t('deal.' + d.status))}</span></div>
          <ul>${dealTerms(d).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          ${incoming ? `<div class="two-btn"><button class="btn blood" data-acc="${d.id}">${esc(t('p.dealAccept'))}</button><button class="btn" data-dec="${d.id}">${esc(t('p.dealDecline'))}</button></div>` : ''}
          ${mineOpen ? `<button class="btn ghosty ink" data-can="${d.id}">${esc(t('p.dealCancel'))}</button>` : ''}
          ${canAccuse ? `<button class="btn ghosty ink accuse" data-acu="${d.id}">${esc(t('p.dealAccuse'))}</button>` : ''}
        </div>`;
      }).join('') : `<p class="chat-empty">${esc(t('p.dealEmpty'))}</p>`}
      <button class="btn" data-close>${esc(t('p.close'))}</button></div>`);
    const sb = $('#sheet-body');
    $('#deal-new').onclick = () => { Deals.form = true; Deals.draft = { to: null, giveMoney: 0, wantMoney: 0, giveCard: null, promise: null, text: '' }; renderDeals(); };
    $$('[data-acc]', sb).forEach(b => b.onclick = () => conn.emit('player:dealRespond', { id: +b.dataset.acc, accept: true }, (r) => { if (r && r.error) toast(t('p.dealErr.' + r.error)); }));
    $$('[data-dec]', sb).forEach(b => b.onclick = () => conn.emit('player:dealRespond', { id: +b.dataset.dec, accept: false }, () => {}));
    $$('[data-can]', sb).forEach(b => b.onclick = () => conn.emit('player:dealCancel', +b.dataset.can, () => {}));
    $$('[data-acu]', sb).forEach(b => b.onclick = () => {
      const d = Deals.list.find(x => x.id === +b.dataset.acu); if (!d) return;
      const other = P(d.from === ME.id ? d.to : d.from);
      if (b.dataset.sure) { conn.emit('player:dealAccuse', d.id, (r) => { if (r && r.error) toast(t('p.dealErr.' + r.error)); else { Sound.play('whistle'); buzz(100); } }); return; }
      b.dataset.sure = '1'; b.textContent = '⚠️ ' + t('p.dealAccuseConfirm', { a: other ? other.name : '?' }); buzz(30);
    });
  }
  function renderDealForm() {
    const dr = Deals.draft;
    const others = S.players.filter(p => p.id !== ME.id);
    const promiseOpts = D.PROMISES.map(k => `<button class="chip promise ${dr.promise === k ? 'on' : ''}" data-pr="${k}">${esc(t('promise.' + k))}</button>`).join('');
    openSheet(`<div class="deals deal-form"><h3>${esc(t('p.dealNew'))}</h3>
      <h4>${esc(t('p.dealWith'))}</h4>
      <div class="pick-list">${others.map(p => `<button class="pick ${dr.to === p.id ? 'on' : ''}" data-to="${p.id}">${medal(p)}<span class="pn">${esc(p.name)}</span></button>`).join('')}</div>
      <div class="money-row"><label>${esc(t('p.dealGive'))}<input id="dl-give" inputmode="numeric" pattern="[0-9]*" value="${dr.giveMoney || ''}" placeholder="0"></label>
        <label>${esc(t('p.dealWant'))}<input id="dl-want" inputmode="numeric" pattern="[0-9]*" value="${dr.wantMoney || ''}" placeholder="0"></label></div>
      <h4>${esc(t('p.dealCard'))}</h4>
      <div class="chip-row wrap"><button class="chip ${dr.giveCard == null ? 'on' : ''}" data-card="">${esc(t('p.dealNoCard'))}</button>${ME.hand.map((c, i) => `<button class="chip ${dr.giveCard === i ? 'on' : ''}" data-card="${i}">${D.CARDS[c].emoji} ${esc(t('card.' + c))}</button>`).join('')}</div>
      <h4>${esc(t('p.dealPromise'))}</h4>
      <div class="chip-row wrap"><button class="chip promise ${!dr.promise ? 'on' : ''}" data-pr="">${esc(t('p.dealNoPromise'))}</button>${promiseOpts}<button class="chip promise ${dr.promise === 'own' ? 'on' : ''}" data-pr="own">${esc(t('p.dealOwn'))}</button></div>
      <input id="dl-own" class="${dr.promise === 'own' ? '' : 'hidden'}" maxlength="80" placeholder="${esc(t('p.dealOwnPh'))}" value="${esc(dr.text || '')}">
      <button class="btn big blood wide" id="dl-send">📜 ${esc(t('p.dealSend'))}</button>
      <button class="btn ghosty ink" id="dl-back">‹ ${esc(t('p.deals'))}</button></div>`);
    const sb = $('#sheet-body');
    const keep = () => { dr.giveMoney = parseInt($('#dl-give').value, 10) || 0; dr.wantMoney = parseInt($('#dl-want').value, 10) || 0; dr.text = $('#dl-own').value; };
    $$('[data-to]', sb).forEach(b => b.onclick = () => { keep(); dr.to = b.dataset.to; renderDealForm(); Sound.play('pop'); });
    $$('[data-card]', sb).forEach(b => b.onclick = () => { keep(); dr.giveCard = b.dataset.card === '' ? null : +b.dataset.card; renderDealForm(); Sound.play('card'); });
    $$('[data-pr]', sb).forEach(b => b.onclick = () => { keep(); dr.promise = b.dataset.pr || null; renderDealForm(); Sound.play('pop'); if (dr.promise === 'own') setTimeout(() => $('#dl-own').focus(), 50); });
    $('#dl-back').onclick = () => { Deals.form = false; renderDeals(); };
    $('#dl-send').onclick = () => {
      keep();
      if (!dr.to) { toast(t('p.dealErr.target')); buzz(80); return; }
      const promise = dr.promise === 'own' ? (dr.text || '').trim() : dr.promise;
      conn.emit('player:deal', { to: dr.to, giveMoney: dr.giveMoney, wantMoney: dr.wantMoney, giveCard: dr.giveCard, promise }, (r) => {
        if (r && r.error) { toast(t('p.dealErr.' + r.error)); buzz(80); return; }
        toast(t('p.dealSent')); Sound.play('scribble'); buzz([20, 30, 20]);
        Deals.form = false; renderDeals();
      });
    };
  }

  /* ================= Preisverleihung ================= */
  function myAwards() {
    const st = (S.pd.steps || []).find(x => x.t === 'awards');
    const mine = st ? st.awards.filter(a => a.pid === ME.id) : [];
    if (!mine.length) return '';
    const A = Object.fromEntries(D.AWARDS.map(a => [a.id, a]));
    return `<div class="my-awards card-box"><div class="section-title"><span>🏆 ${esc(t('p.awardsMe'))}</span></div>
      ${mine.map((a, i) => `<div class="award-row" style="animation-delay:${i * 150}ms"><span class="aw-e">${A[a.id].emoji}</span><div><b>${esc(t('award.' + a.id))}</b><small>${esc(t('awardd.' + a.id, { n: a.n }))}</small></div></div>`).join('')}</div>`;
  }

  // Bei neuem Spiel zurücksetzen
  let prevPhase = null;
  conn.on('state', (d) => {
    if (d.phase === 'lobby') {
      showRank = false; fvDraft = {}; draftRound = -1; Deals.list = []; Deals.unread = 0;
      if (prevPhase && prevPhase !== 'lobby') { Chat.msgs = []; Chat.unread = {}; updateChatBadge(); }
    }
    prevPhase = d.phase;
  });

  window.__otto = () => ({ S, ME, Chat, Deals });
  applyI18n();
  renderJoinPortrait();
})();
