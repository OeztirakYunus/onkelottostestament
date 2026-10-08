/* Handy-Controller */
(function () {
  'use strict';
  const { D, I, Connection, Sound, confetti, esc, $, $$, fmt, Clock, animateNumber } = window.OTTO;

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
  const medal = (p, cls = '') => p ? `<div class="medal ${p.ghost ? 'ghost' : ''} ${cls}" style="--c:${p.color}">${p.avatar}</div>` : '';
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n), lang);
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* egal */ } };
  const view = $('#view');

  /* ---------------- Sprache ---------------- */
  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i]').forEach(el => { el.textContent = t(el.dataset.i); });
    $$('[data-langswitch] button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    document.title = t('app.title');
  }
  document.addEventListener('click', (e) => {
    Sound.init();
    const lb = e.target.closest('[data-lang]');
    if (lb) {
      lang = lb.dataset.lang;
      localStorage.setItem('otto.lang', lang);
      applyI18n();
      if (joined) conn.emit('player:lang', lang);
      viewKey = '';
      render();
    }
    if (e.target.closest('[data-close]')) closeSheet();
  });

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  /* ---------------- Beitreten ---------------- */
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
  avatar = localStorage.getItem('otto.avatar') || D.AVATARS[Math.floor(Math.random() * D.AVATARS.length)];
  buildAvatarGrid($('#av-grid'));
  $('#in-code').value = (params.get('code') || '').toUpperCase();
  $('#in-name').value = localStorage.getItem('otto.name') || '';

  $('#join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    Sound.init();
    const code = $('#in-code').value.trim().toUpperCase();
    const name = $('#in-name').value.trim();
    if (!name) { $('#join-err').textContent = t('err.name'); $('#in-name').focus(); return; }
    if (code.length !== 4) { $('#join-err').textContent = t('err.nogame'); $('#in-code').focus(); return; }
    $('#join-err').textContent = '';
    $('#btn-join').disabled = true;
    $('#btn-join').textContent = t('p.joining');
    localStorage.setItem('otto.name', name);
    localStorage.setItem('otto.avatar', avatar);
    conn.emit('player:join', { code, name, avatar, lang }, (res) => {
      $('#btn-join').disabled = false;
      $('#btn-join').textContent = t('p.join');
      if (res.error) { $('#join-err').textContent = t('err.' + res.error); return; }
      localStorage.setItem('otto.player', JSON.stringify({ code: res.code, token: res.token }));
      joined = true;
      Sound.play('join');
      buzz(30);
      showGame();
    });
  });

  function showGame() { $('#scr-join').classList.add('hidden'); $('#scr-game').classList.remove('hidden'); }
  function showJoin(err) {
    joined = false; S = null; ME = null; viewKey = '';
    $('#scr-game').classList.add('hidden'); $('#scr-join').classList.remove('hidden');
    $('#join-err').textContent = err || '';
  }

  conn.on('open', () => {
    $('#conn').classList.add('hidden');
    const saved = JSON.parse(localStorage.getItem('otto.player') || 'null');
    const urlCode = (params.get('code') || '').toUpperCase();
    if (saved && (!urlCode || urlCode === saved.code)) {
      conn.emit('player:join', { code: saved.code, token: saved.token, lang, rejoinOnly: true }, (res) => {
        if (res.ok) { joined = true; showGame(); }
        else { localStorage.removeItem('otto.player'); if (joined) showJoin(t('err.' + (res.error === 'notoken' ? 'running' : res.error))); }
      });
    }
  });
  conn.on('close', () => { if (joined) $('#conn').classList.remove('hidden'); });
  conn.on('kicked', () => { localStorage.removeItem('otto.player'); showJoin(t('p.kicked')); });
  conn.on('replaced', () => { joined = false; $('#view').innerHTML = `<div class="summary"><div class="se">📱</div><p>${esc(t('p.replaced'))}</p></div>`; });
  conn.on('state', (d) => {
    if (!d.me) return;
    S = d; ME = d.me;
    Clock.sync(d.now);
    if (!joined) { joined = true; showGame(); }
    render();
  });

  /* ---------------- Rendern ---------------- */
  function render() {
    if (!S || !ME) return;
    document.body.classList.toggle('is-ghost', !!ME.ghost);
    $('#me-medal').innerHTML = medal(P(ME.id) || ME);
    $('#me-name').textContent = ME.name;
    $('#me-money').classList.toggle('hidden', S.phase === 'lobby');
    animateNumber($('#me-money'), ME.money, 800, lang);

    const pd = S.pd || {};
    let extra = '';
    if (S.phase === 'lobby') extra = S.players.map(p => p.avatar).join('');
    if (S.phase === 'plan') extra = (ME.plan && !editing ? 'S' : 'E') + (ME.ghost ? 'g' : '');
    if (S.phase === 'vote') extra = ME.vote ? 'v' : '';
    if (S.phase === 'finalvote') extra = ME.finalVote ? 'f' : '';
    if (S.phase === 'duel') extra = ME.duelScore !== undefined ? 'd' : '';
    if (S.phase === 'finale') extra = showRank ? 'r' : '';
    const key = [S.phase, S.round, pd.stage || '', extra, lang].join('|');
    if (key === viewKey) return;
    const phaseChanged = viewKey.split('|').slice(0, 3).join('|') !== key.split('|').slice(0, 3).join('|');
    viewKey = key;
    if (phaseChanged) { phaseTotal = Clock.left(S.endsAt) || 1; closeSheet(); }
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

  /* ---------------- Ansichten ---------------- */
  function vLobby() {
    const taken = new Set(S.players.filter(p => p.id !== ME.id).map(p => p.avatar));
    avatar = ME.avatar;
    view.innerHTML = `
      <div class="wait-hero">${medal(P(ME.id))}<div class="h2">${esc(ME.name)}</div><p class="sub">${esc(t('p.waiting'))}</p></div>
      <div class="card-box lobby-av"><div class="section-title">${esc(t('p.avatar'))}</div><div class="av-grid" id="lobby-av"></div></div>
      <p class="center"><button class="btn ghosty" id="btn-leave">${esc(t('p.leave'))}</button></p>`;
    buildAvatarGrid($('#lobby-av'), taken, (a) => { localStorage.setItem('otto.avatar', a); conn.emit('player:avatar', a); });
    $('#btn-leave').onclick = () => { conn.emit('player:leave'); localStorage.removeItem('otto.player'); showJoin(''); };
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
            ${fam ? `<p style="margin-top:.8rem"><b>${esc(t('p.family'))}:</b> ${fam.members.map(id => (P(id) || {}).avatar).join(' ')}</p>` : ''}
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
      <p class="center"><button class="btn ghosty" id="btn-change">✏️ ${esc(t('p.change'))}</button></p>`;
    $('#btn-change').onclick = () => { editing = true; draft = { room: null, cards: [] }; viewKey = ''; render(); };
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
      ${fam ? `<h4>${esc(t('p.family'))}</h4><div>${fam.members.map(id => { const p = P(id); return p ? `${p.avatar} ${esc(p.name)}` : ''; }).join(', ')}</div>` : ''}
      <h4>${esc(t('p.known'))}</h4>
      ${known.length ? known.map(([pid, role]) => { const p = P(pid); return p ? `<div class="row"><span class="e">${p.avatar}</span><div><b>${esc(p.name)}</b><small>${D.ROLES[role].emoji} ${esc(t('role.' + role))}</small></div></div>` : ''; }).join('') : `<p>${esc(t('p.nothingKnown'))}</p>`}
      <h4>${esc(t('p.heirlooms'))}</h4>
      ${ME.heirlooms.length ? ME.heirlooms.map(h => `<div class="row"><span class="e">${D.HEIRLOOM_BY_ID[h].emoji}</span><div><b>${esc(t('h.' + h))}</b><small>${esc(t('p.valueHidden'))}</small></div></div>`).join('') : `<p>${esc(t('p.noHeirlooms'))}</p>`}
      <h4>${esc(t('p.cards'))}</h4>
      ${ME.hand.length ? ME.hand.map(c => `<div class="row"><span class="e">${D.CARDS[c].emoji}</span><div><b>${esc(t('card.' + c))}</b><small>${esc(t('cardd.' + c))}</small></div></div>`).join('') : `<p>${esc(t('p.noHand'))}</p>`}
      <button class="btn" data-close>${esc(t('p.close'))}</button>
    </div>`);
  }

  /* --- Duell --- */
  function vDuel() {
    const pd = S.pd;
    const inDuel = pd.pids.includes(ME.id);
    if (!inDuel) return vLookTV('⚔️', `<p class="sub center">${esc(t('p.duelWatch'))}</p>`);
    const head = `<div class="duel-head"><div class="dn">${esc(t('duel.' + pd.type))}</div><p>${esc(t('dueld.' + pd.type))}</p>${pd.reverse ? `<p>🙃 ${esc(t('g.duelReverse'))}</p>` : ''}</div>`;
    if (pd.stage === 'intro') {
      const g = pd.groups.find(x => x.pids.includes(ME.id));
      const opp = g ? g.pids.filter(id => id !== ME.id).map(id => P(id)).filter(Boolean) : [];
      view.innerHTML = `<div class="big-emoji">⚔️</div><div class="h2 center">${esc(t('p.duelYou'))}</div>${head}
        <p class="center" style="font-size:2.4rem;margin-top:1rem">${opp.map(p => p.avatar).join(' ')}</p>
        <p class="center sub">${opp.map(p => esc(p.name)).join(', ')}</p>`;
      buzz([100, 80, 100]);
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
      const won = Object.values(pd.winners || {}).includes(ME.id);
      const sc = pd.scores ? pd.scores[ME.id] : undefined;
      view.innerHTML = `${head}<div class="duel-res"><div class="e">${won ? '👑' : '💀'}</div><div class="t">${esc(won ? t('p.youWon') : t('p.youLost'))}</div>
        <p>${esc(scoreText(pd.type, sc))}</p>${pd.answer != null ? `<p>${esc(t('g.answer', { n: fmt(pd.answer, lang) }))}</p>` : ''}</div>`;
      if (won) { Sound.play('win'); confetti({ count: 80, duration: 2200 }); buzz([50, 50, 150]); } else { Sound.play('lose'); buzz(200); }
    }
  }
  function scoreText(type, s) {
    if (s === undefined || s === null || !Number.isFinite(s)) return t('sc.none');
    if (type === 'tap') return t('sc.tap', { n: s });
    if (type === 'reaction') return s < 0 ? t('sc.early') : t('sc.ms', { n: Math.round(s) });
    if (type === 'stopwatch') return t('sc.sec', { n: (s / 1000).toFixed(2) });
    return fmt(s, lang);
  }
  function sendScore(v, text) {
    if (!mini || mini.sent) return;
    mini.sent = true;
    mini.resultText = text || '';
    conn.emit('player:duel', v);
  }

  function startMini(pd, head) {
    if (mini && mini.key === viewKey && mini.alive) return;
    if (mini && mini.cleanup) mini.cleanup();
    mini = { key: viewKey, alive: true, sent: false };
    const timers = [];
    mini.cleanup = () => { timers.forEach(clearTimeout); mini.alive = false; };
    buzz(80);

    if (pd.type === 'tap') {
      let n = 0, done = false;
      view.innerHTML = `${head}<button class="tap-zone" id="tap">${esc(t('p.tapHere'))}</button><div class="tap-count" id="tapc">0</div><p class="center sub" id="tapt"></p>`;
      const btn = $('#tap'), c = $('#tapc'), tt = $('#tapt');
      const end = performance.now() + 5500;
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (done) return; n++; c.textContent = n; Sound.play('tock'); buzz(6); });
      (function tick() { if (!mini.alive || done) return; const l = Math.max(0, end - performance.now()); tt.textContent = (l / 1000).toFixed(1) + ' s'; if (l <= 0) { done = true; btn.disabled = true; sendScore(n, t('p.taps', { n })); return; } requestAnimationFrame(tick); })();
    }

    if (pd.type === 'reaction') {
      let state = 'wait', t0 = 0;
      view.innerHTML = `${head}<button class="react-zone" id="rz">${esc(t('p.wait'))}</button>`;
      const z = $('#rz');
      timers.push(setTimeout(() => {
        if (state !== 'wait') return;
        state = 'go'; t0 = performance.now(); z.classList.add('go'); z.textContent = t('p.now'); buzz(60); Sound.play('go');
        timers.push(setTimeout(() => { if (state === 'go') { state = 'done'; z.classList.add('done'); z.textContent = t('sc.none'); sendScore(null, ''); } }, 3200));
      }, 1600 + Math.random() * 3400));
      z.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (state === 'wait') { state = 'done'; z.classList.add('done'); z.textContent = t('p.tooEarly'); buzz(300); Sound.play('lose'); sendScore(-1, t('p.tooEarly')); }
        else if (state === 'go') { const ms = Math.round(performance.now() - t0); state = 'done'; z.classList.add('done'); z.textContent = t('p.yourTime', { n: ms }); Sound.play('coin'); sendScore(ms, t('p.yourTime', { n: ms })); }
      });
    }

    if (pd.type === 'estimate') {
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
    }

    if (pd.type === 'stopwatch') {
      let running = false, t0 = 0, stopped = false;
      view.innerHTML = `${head}<div class="watch" id="w">0.00</div><p class="center sub">${esc(t('p.watchHint'))}</p>
        <div class="sticky-cta"><button class="btn big blood" id="wb">${esc(t('p.startWatch'))}</button></div>`;
      const w = $('#w'), b = $('#wb');
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
      function loop() {
        if (!running || !mini.alive) return;
        const el = performance.now() - t0;
        if (el < 2000) w.textContent = (el / 1000).toFixed(2);
        else { w.textContent = '?.??'; w.classList.add('hidden-digits'); }
        requestAnimationFrame(loop);
      }
    }
  }

  /* --- Ergebnis --- */
  function vResults() {
    const pd = S.pd;
    const d = (pd.deltas && pd.deltas[ME.id]) || 0;
    const mine = [];
    (pd.rooms || []).forEach(r => r.lines.forEach(l => { if (l.pid === ME.id || (l.p && (l.p.a === ME.name || l.p.b === ME.name))) mine.push({ ...l, room: r.room }); }));
    (pd.extra || []).forEach(l => { if (l.pid === ME.id) mine.push(l); });
    const learned = ME.learned && P(ME.learned.pid);
    const becameGhost = (pd.newGhosts || []).includes(ME.id);
    const revived = (pd.revived || []).includes(ME.id);
    view.innerHTML = `
      <div class="h2 center">${esc(t('p.roundResult'))}</div>
      <div class="delta-big ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${signed(d)}</div>
      <div class="lines">${mine.map((l, i) => `<div class="${l.a > 0 ? 'pos' : l.a < 0 ? 'neg' : ''}" style="animation-delay:${i * 120}ms">${l.room ? D.ROOMS[l.room].emoji + ' ' : ''}${esc(t(l.k, l.p))}</div>`).join('')}</div>
      ${learned ? `<div class="secret parchment">🕵️ ${esc(t('p.learned', { a: learned.name, r: t('role.' + ME.learned.role) }))}</div>` : ''}
      ${becameGhost ? `<div class="secret parchment">👻 ${esc(t('p.youAreGhost'))}<br><small>${esc(t('p.ghostInfo'))}</small></div>` : ''}
      ${revived ? `<div class="secret parchment">✨ ${esc(t('g.revived', { a: ME.name }))}</div>` : ''}
      <div class="look-tv">📺 ${esc(t('p.lookTV'))}</div>`;
    if (d > 0) { Sound.play('coin'); buzz(30); } else if (d < 0) { Sound.play('lose'); buzz(120); }
    if (learned) buzz([30, 30, 30, 30]);
  }

  /* --- Abstimmung --- */
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
      ${w ? `<div class="wait-hero">${medal(w)}<div class="h2">${esc(w.name)}</div><div class="delta-big ${pd.applied >= 0 ? 'pos' : 'neg'}">${signed(pd.applied)}</div></div>` : `<p class="center sub">${esc(t('g.noVotes'))}</p>`}`;
    if (isMe) { buzz([60, 60, 200]); Sound.play(pd.applied >= 0 ? 'win' : 'lose'); }
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
    view.innerHTML = `<div class="final-rank card-box"><div class="sub">${esc(t('p.end'))}</div><div class="rn">${esc(t('p.rank', { n: idx + 1 }))}</div>
      <span class="money">${fmt(me ? me.money : 0, lang)}</span><p class="sub" style="margin-top:1rem">${D.ROLES[ME.role].emoji} ${esc(t('role.' + ME.role))}</p></div>
      <div class="lines">${rk.map((r, i) => { const p = P(r.pid); return p ? `<div>${i + 1}. ${p.avatar} ${esc(p.name)} · ${fmt(r.money, lang)}</div>` : ''; }).join('')}</div>
      <p class="center sub" style="margin-top:1.4rem">${esc(t('p.thanks'))}</p>`;
    if (idx === 0) { confetti({ count: 200 }); Sound.play('fanfare'); }
  }

  // Bei neuem Spiel zurücksetzen
  conn.on('state', (d) => { if (d.phase === 'lobby') { showRank = false; fvDraft = {}; draftRound = -1; } });

  window.__otto = () => ({ S, ME });
  applyI18n();
})();
