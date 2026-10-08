/* Fernseher-Ansicht: Spielbrett, Overlays, Animationen */
(function () {
  'use strict';
  const { D, I, Connection, Sound, Voice, confetti, esc, $, $$, sleep, fmt, Clock, animateNumber } = window.OTTO;

  let lang = localStorage.getItem('otto.lang') === 'tr' ? 'tr' : 'de';
  let S = null;
  let enteredKey = '';
  let seq = 0;                 // laufende Animationssequenz (zum Abbrechen)
  let lastPos = {};            // letzte Positionen der Figuren
  let phaseTotal = 0;          // Gesamtdauer für den Timer-Ring
  let builtRooms = '';
  let finaleSkip = null;

  Sound.enabled = localStorage.getItem('otto.sound') !== 'off';
  Voice.enabled = localStorage.getItem('otto.voice') !== 'off';

  const conn = new Connection();
  const t = (k, p) => I.t(lang, k, p);
  const P = (id) => (S && S.players.find(p => p.id === id)) || null;
  const nm = (id) => (P(id) || { name: '?' }).name;
  const medal = (p, cls = '') => p ? `<div class="medal ${p.ghost ? 'ghost' : ''} ${cls}" style="--c:${p.color}">${p.avatar}</div>` : '';
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n), lang);

  /* ---------------- Texte ---------------- */
  function applyI18n() {
    document.documentElement.lang = lang;
    $$('[data-i]').forEach(el => { el.textContent = t(el.dataset.i); });
    document.title = t('app.title');
    $$('[data-langswitch] button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
    renderTools();
  }

  function renderTools() {
    $$('[data-tools]').forEach(box => {
      const inGame = S && S.phase !== 'lobby';
      box.innerHTML = `
        <div class="lang-switch" data-langswitch>
          <button data-lang="de" class="${lang === 'de' ? 'on' : ''}">DE</button><button data-lang="tr" class="${lang === 'tr' ? 'on' : ''}">TR</button>
        </div>
        <button class="tool ${Sound.enabled ? '' : 'off'}" data-tool="sound" title="${esc(t('h.sound'))}">${Sound.enabled ? '🔊' : '🔇'}</button>
        <button class="tool ${Voice.enabled ? '' : 'off'}" data-tool="voice" title="${esc(t('h.voice'))}">🗣️</button>
        <button class="tool" data-tool="full" title="${esc(t('h.fullscreen'))}">⛶</button>
        ${inGame ? `<button class="tool skip" data-tool="skip">${esc(t('h.skip'))} ⏭</button>` : ''}`;
    });
  }

  document.addEventListener('click', (e) => {
    Sound.init();
    const lb = e.target.closest('[data-lang]');
    if (lb) {
      lang = lb.dataset.lang;
      localStorage.setItem('otto.lang', lang);
      if (S) conn.emit('host:lang', lang);
      applyI18n();
      if (S) { enteredKey = ''; render(); }
      return;
    }
    const tool = e.target.closest('[data-tool]');
    if (!tool) return;
    const k = tool.dataset.tool;
    if (k === 'sound') { Sound.enabled = !Sound.enabled; localStorage.setItem('otto.sound', Sound.enabled ? 'on' : 'off'); }
    if (k === 'voice') { Voice.enabled = !Voice.enabled; if (!Voice.enabled) Voice.stop(); localStorage.setItem('otto.voice', Voice.enabled ? 'on' : 'off'); }
    if (k === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
    if (k === 'skip') { if (S && S.phase === 'finale' && finaleSkip) finaleSkip(); else conn.emit('host:skip'); }
    renderTools();
  });

  /* ---------------- Verbindung ---------------- */
  $('#btn-create').addEventListener('click', () => {
    Sound.init(); Sound.play('stamp');
    $('#btn-create').disabled = true;
    $('#btn-create').textContent = t('h.connecting');
    conn.emit('host:create', { lang, origin: location.origin }, (res) => {
      sessionStorage.setItem('otto.host', JSON.stringify(res));
    });
  });

  conn.on('open', () => {
    $('#conn-lost').classList.add('hidden');
    const saved = sessionStorage.getItem('otto.host');
    if (saved) {
      const s = JSON.parse(saved);
      conn.emit('host:resume', s, (res) => { if (res.error) { sessionStorage.removeItem('otto.host'); showScreen('start'); } });
    }
  });
  conn.on('close', () => $('#conn-lost').classList.remove('hidden'));
  conn.on('state', (d) => {
    S = d;
    Clock.sync(d.now);
    if (d.lang !== lang) { lang = d.lang; localStorage.setItem('otto.lang', lang); applyI18n(); }
    render();
  });

  function showScreen(name) {
    ['start', 'lobby', 'game'].forEach(n => $('#scr-' + n).classList.toggle('hidden', n !== name));
  }

  /* ---------------- Hauptrender ---------------- */
  function render() {
    if (!S) return;
    if (S.phase === 'lobby') {
      showScreen('lobby');
      hideOverlay();
      renderLobby();
      if (enteredKey !== 'lobby') { enteredKey = 'lobby'; renderTools(); }
      return;
    }
    showScreen('game');
    buildVilla();
    renderTop();
    renderLedger();
    const key = [S.phase, S.round, S.pd.stage || ''].join('|');
    if (key !== enteredKey) {
      enteredKey = key;
      seq++;
      const left = Clock.left(S.endsAt);
      phaseTotal = left || 1;
      renderTools();
      enterPhase(S.phase);
    } else {
      updatePhase(S.phase);
    }
  }

  /* ---------------- Lobby ---------------- */
  let lastCount = 0;
  function renderLobby() {
    $('#qr').src = S.qr;
    $('#join-url').textContent = S.joinUrl.replace(/^https?:\/\//, '');
    $('#join-code').textContent = S.code;
    const n = S.players.length;
    $('#heir-count').textContent = t('h.heirsCount', { n });
    $('#heir-empty').classList.toggle('hidden', n > 0);
    const list = $('#heir-list');
    list.classList.toggle('many', n > 10);
    const ids = S.players.map(p => p.id + p.avatar + p.connected + p.name).join();
    if (list.dataset.ids !== ids) {
      list.dataset.ids = ids;
      list.innerHTML = S.players.map(p => `
        <li class="${p.connected ? '' : 'off'}">
          ${medal(p)}<span class="nm">${esc(p.name)}</span>
          <span class="tag">${p.isBot ? '🤖 ' + esc(t('h.bot')) : p.connected ? '' : esc(t('h.offline'))}</span>
          <button class="kick" data-kick="${p.id}" title="${esc(t('h.kick'))}">✕</button>
        </li>`).join('');
      if (n > lastCount) Sound.play('join');
      lastCount = n;
    }
    $$('.unlocks li').forEach(li => li.classList.toggle('on', n >= +li.dataset.n));
    $('#set-rounds').value = String(S.settings.rounds);
    $('#set-time').value = String(S.settings.planTime);
    const btn = $('#btn-start');
    btn.disabled = n < 2;
    btn.textContent = n < 2 ? t('h.needTwo') : t('h.start');
    $('#btn-bot').disabled = n >= 15;
  }
  $('#heir-list').addEventListener('click', (e) => { const k = e.target.closest('[data-kick]'); if (k) conn.emit('host:kick', k.dataset.kick); });
  $('#btn-bot').addEventListener('click', () => conn.emit('host:addBot'));
  $('#btn-start').addEventListener('click', () => { Sound.init(); conn.emit('host:start'); });
  $('#set-rounds').addEventListener('change', (e) => conn.emit('host:settings', { rounds: e.target.value, planTime: S.settings.planTime }));
  $('#set-time').addEventListener('change', (e) => conn.emit('host:settings', { rounds: S.settings.rounds, planTime: e.target.value }));

  /* ---------------- Villa ---------------- */
  function buildVilla() {
    const key = S.rooms.join() + lang;
    if (builtRooms === key) return;
    builtRooms = key;
    const villa = $('#villa');
    villa.classList.toggle('r8', S.rooms.length > 6);
    villa.innerHTML = S.rooms.map(r => `
      <div class="room" data-room="${r}" style="--tone:${D.ROOMS[r].tone}" data-closed="${esc(t('g.closed'))}">
        <div class="room-head"><span class="room-emoji">${D.ROOMS[r].emoji}</span><span class="room-name">${esc(t('room.' + r))}</span></div>
        <div class="room-desc">${esc(t('roomd.' + r))}</div>
        <div class="room-floor"></div>
        <div class="room-log"></div>
      </div>`).join('');
    $('#hall span').textContent = t('g.hall');
    requestAnimationFrame(() => layoutTokens(lastPos, 0));
  }
  function setClosed(list) {
    const set = new Set(list || []);
    $$('.room').forEach(el => el.classList.toggle('closed', set.has(el.dataset.room) && el.dataset.room !== 'garden'));
  }
  function clearLogs() { $$('.room-log').forEach(el => { el.innerHTML = ''; }); $$('.room').forEach(el => el.classList.remove('hot', 'alarm', 'dim', 'show-log')); }

  /* ---------------- Figuren ---------------- */
  function syncTokens() {
    const box = $('#tokens');
    S.players.forEach(p => {
      let el = box.querySelector(`[data-pid="${p.id}"]`);
      if (!el) {
        el = document.createElement('div');
        el.className = 'token';
        el.dataset.pid = p.id;
        el.innerHTML = `<div class="medal" style="--c:${p.color}">${p.avatar}</div><div class="tn"></div>`;
        box.appendChild(el);
      }
      el.querySelector('.tn').textContent = p.name;
      el.querySelector('.medal').classList.toggle('ghost', p.ghost);
      el.classList.toggle('ghostly', p.ghost);
    });
    $$('.token', box).forEach(el => { if (!P(el.dataset.pid)) el.remove(); });
  }

  function layoutTokens(pos, stagger = 0) {
    if (!S || !S.players.length) return;
    syncTokens();
    lastPos = { ...pos };
    const board = $('#board');
    const br = board.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const n = S.players.length;
    const ts = n > 11 ? 2.7 : n > 7 ? 3.1 : 3.6;
    board.style.setProperty('--ts', ts + 'rem');
    const tw = ts * rem, th = tw + 1.25 * rem;
    const groups = {};
    S.players.forEach(p => { const r = pos[p.id] || 'hall'; (groups[r] = groups[r] || []).push(p); });
    let i = 0;
    Object.keys(groups).forEach(room => {
      const ps = groups[room];
      const el = room === 'hall' ? $('#hall') : $(`.room[data-room="${room}"] .room-floor`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      let x0 = r.left - br.left, y0 = r.top - br.top, w = r.width, h = r.height;
      if (room === 'hall') { x0 += 4.5 * rem; w -= 5.5 * rem; y0 += (h - th) / 2; h = th; }
      else { x0 += .6 * rem; w -= 1.2 * rem; }
      const maxCols = Math.max(1, Math.floor((w - tw) / (tw * (ps.length > 6 ? 0.62 : 1.5))) + 1);
      const cols = Math.min(ps.length, maxCols);
      const rows = Math.ceil(ps.length / cols);
      const stepX = cols > 1 ? Math.min(tw * 1.5, (w - tw) / (cols - 1)) : 0;
      let stepY = rows > 1 ? Math.min(th, (h - th) / (rows - 1)) : 0;
      stepY = Math.max(stepY, th * 0.45);
      const totalW = tw + stepX * (cols - 1);
      const sx = x0 + (w - totalW) / 2;
      ps.forEach((p, k) => {
        const c = k % cols, rr = Math.floor(k / cols);
        const x = sx + c * stepX, y = y0 + rr * stepY;
        const tok = $(`.token[data-pid="${p.id}"]`);
        if (!tok) return;
        tok.style.transitionDelay = (stagger ? (i * stagger) : 0) + 'ms';
        tok.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        tok.style.zIndex = 10 + rr;
        i++;
      });
    });
  }
  window.addEventListener('resize', () => { if (S && S.phase !== 'lobby') layoutTokens(lastPos, 0); });

  function tokenFx(pid, cls, ms = 1200) {
    const tok = $(`.token[data-pid="${pid}"]`);
    if (!tok) return;
    tok.classList.remove(cls); void tok.offsetWidth; tok.classList.add(cls);
    setTimeout(() => tok.classList.remove(cls), ms);
  }
  function floater(pid, text, cls) {
    const tok = $(`.token[data-pid="${pid}"]`);
    if (!tok) return;
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(tok.style.transform || '');
    if (!m) return;
    const f = document.createElement('div');
    f.className = 'floater ' + cls;
    f.textContent = text;
    const w = tok.offsetWidth;
    f.style.left = (parseFloat(m[1]) + w / 2) + 'px';
    f.style.top = (parseFloat(m[2]) - 10) + 'px';
    $('#tokens').appendChild(f);
    setTimeout(() => f.remove(), 2700);
  }
  function hallPos() { return {}; }

  /* ---------------- Kopfzeile, Timer, Hauptbuch ---------------- */
  function renderTop() {
    $('#round-num').textContent = S.round || '·';
    $('#round-label').textContent = S.round ? (S.round === S.totalRounds ? t('g.finalRound') : t('g.round', { n: S.round, m: S.totalRounds })) : '';
    $('#clause-mini').textContent = S.clause && ['plan', 'reveal', 'duel', 'results', 'vote'].includes(S.phase) ? t('clause.' + S.clause) : '';
  }

  let lastTick = -1;
  (function timerLoop() {
    requestAnimationFrame(timerLoop);
    if (!S || S.phase === 'lobby') return;
    const left = Clock.left(S.endsAt);
    const el = $('#timer');
    const show = S.endsAt && ['plan', 'vote', 'finalvote'].includes(S.phase) || (S.phase === 'duel' && S.pd.stage === 'play');
    el.classList.toggle('idle', !show);
    if (!show) return;
    const sec = Math.ceil(left / 1000);
    $('#timer-num').textContent = sec;
    $('#timer-arc').style.strokeDashoffset = String(119.4 * (1 - left / phaseTotal));
    el.classList.toggle('urgent', sec <= 5);
    if (sec !== lastTick) { lastTick = sec; if (sec <= 5 && sec > 0) Sound.play('tick'); }
  })();

  const prevRank = {};
  function renderLedger() {
    const ol = $('#ledger');
    const list = [...S.players].sort((a, b) => b.money - a.money);
    const showDone = ['plan', 'vote', 'finalvote'].includes(S.phase);
    const showDelta = ['results', 'vote'].includes(S.phase);
    ol.classList.toggle('compact', list.length > 9);
    const fam = (p) => (S.families && p.family != null) ? `<i class="fam-dot" style="background:${D.COLORS[(p.family * 4) % D.COLORS.length]}"></i>` : '';
    // FLIP-Animation beim Umsortieren
    const before = {};
    $$('li', ol).forEach(li => { before[li.dataset.pid] = li.getBoundingClientRect().top; });
    ol.innerHTML = list.map((p, i) => `
      <li data-pid="${p.id}" class="${p.ghost ? 'ghost' : ''} ${showDone && p.done ? 'done' : ''}">
        <span class="rk">${i + 1}</span>
        ${medal(p)}
        <span class="who"><span class="nm">${fam(p)}${esc(p.name)}</span>
          <span class="meta"><span>🃏 ${p.cards}</span><span>🏺 ${p.heirlooms.length}</span>${p.connected || p.isBot ? '' : '<span>📵</span>'}${p.ghost ? '<span>👻</span>' : ''}</span></span>
        <span><span class="money" data-m="${p.id}" data-value="${prevRank[p.id] != null ? prevRank[p.id] : p.money}">${fmt(prevRank[p.id] != null ? prevRank[p.id] : p.money, lang)}</span>
          ${showDelta && p.lastDelta ? `<span class="delta ${p.lastDelta > 0 ? 'pos' : 'neg'}">${signed(p.lastDelta)}</span>` : ''}</span>
      </li>`).join('');
    $$('li', ol).forEach(li => {
      const b = before[li.dataset.pid];
      if (b == null) return;
      const dy = b - li.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) { li.style.transition = 'none'; li.style.transform = `translateY(${dy}px)`; requestAnimationFrame(() => { li.style.transition = ''; li.style.transform = ''; }); }
    });
    list.forEach(p => { const el = ol.querySelector(`[data-m="${p.id}"]`); animateNumber(el, p.money, 1100, lang); prevRank[p.id] = p.money; });
  }

  /* ---------------- Overlays ---------------- */
  function showOverlay(html, cls = '') {
    const o = $('#overlay');
    o.className = 'overlay ' + cls;
    o.innerHTML = html;
  }
  function hideOverlay() { $('#overlay').className = 'overlay hidden'; $('#overlay').innerHTML = ''; }
  function phaseBanner(html) {
    const b = $('#phase-banner');
    if (!html) { b.classList.add('hidden'); return; }
    b.innerHTML = html; b.classList.remove('hidden');
  }
  function eventCard(emoji, name, text) {
    const box = $('#event-banner');
    box.innerHTML = `<div class="ev-card parchment"><div class="ev-emoji">${emoji}</div><div><div class="ev-name">${esc(name)}</div><div class="ev-text">${esc(text)}</div></div></div>`;
    const card = box.firstElementChild;
    setTimeout(() => card && card.classList.add('out'), 2050);
  }

  /* ---------------- Phasen ---------------- */
  function enterPhase(ph) {
    const my = seq;
    phaseBanner(null);
    $('#event-banner').innerHTML = '';
    switch (ph) {
      case 'intro': return enterIntro(my);
      case 'clause': return enterClause(my);
      case 'plan': return enterPlan();
      case 'reveal': return enterReveal(my);
      case 'duel': return enterDuel(my);
      case 'results': return enterResults(my);
      case 'vote': return enterVote(my);
      case 'finalvote': return enterFinalVote();
      case 'finale': return enterFinale(my);
    }
  }
  function updatePhase(ph) {
    if (ph === 'plan') updatePlanBanner();
    if (ph === 'duel' && S.pd.stage === 'play') updateDuelReady();
    if (ph === 'vote' && S.pd.stage === 'vote') updateVoteReady();
    if (ph === 'finalvote') updateVoteReady();
  }

  function enterIntro(my) {
    clearLogs(); setClosed([]);
    layoutTokens({}, 0);
    showOverlay(`<div class="ov-inner intro">
      <div class="candles"><span>🕯️</span><span>⚰️</span><span>🕯️</span></div>
      <h1 class="display">${esc(t('i.dead'))}</h1>
      <p>${esc(t('i.money'))}</p>
      <p class="look">📱 ${esc(t('i.look'))}</p></div>`);
    Sound.play('bell');
    Voice.say(t('i.dead') + ' ' + t('i.money'), lang);
  }

  function enterClause(my) {
    clearLogs();
    setClosed(S.closed);
    layoutTokens({}, 40);
    const pd = S.pd;
    const text = t('clause.' + pd.clause);
    const words = text.split(/\s+/);
    const wordDelay = 70;
    const sealAt = 1300 + words.length * wordDelay + 300;
    const nowHtml = (pd.nowLines || []).map((l, i) => `<div style="animation-delay:${sealAt + 600 + i * 450}ms">${esc(t(l.k, l.p))}</div>`).join('');
    showOverlay(`<div class="scroll-wrap ${pd.final ? 'final' : ''}">
      <div class="scroll-rod"></div>
      <div class="scroll-paper parchment">
        <div class="sp-head"><b>${esc(t('g.clauseTitle', { n: S.round }))}</b><span>${esc(t('g.notary'))}</span></div>
        <div class="sp-text">${words.map((w, i) => `<span class="w" style="animation-delay:${1300 + i * wordDelay}ms">${esc(w)}</span>`).join(' ')}</div>
        ${nowHtml ? `<div class="sp-now">${nowHtml}</div>` : ''}
        ${pd.vote ? `<div class="sp-vote" style="animation:fade-in .5s ${sealAt + 400}ms both">🗳️ ${esc(t('g.voteLater'))}</div>` : ''}
        <div class="seal big-seal" style="animation-delay:${sealAt}ms"><span>O</span></div>
      </div>
      <div class="scroll-rod"></div>
    </div>`);
    Sound.play('whoosh');
    setTimeout(() => { if (seq === my) Voice.say(text, lang); }, 1200);
    setTimeout(() => { if (seq === my) { Sound.play('stamp'); document.body.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(6px)' }, { transform: 'translateY(0)' }], { duration: 180 }); } }, sealAt + 150);
    if (pd.final) setTimeout(() => { if (seq === my) Sound.play('fanfare'); }, 600);
    (pd.nowLines || []).forEach((l, i) => setTimeout(() => { if (seq === my) Sound.play(l.a < 0 ? 'lose' : 'coin'); }, sealAt + 600 + i * 450));
  }

  function enterPlan() {
    hideOverlay(); clearLogs();
    setClosed(S.closed);
    layoutTokens({}, 30);
    updatePlanBanner();
    Sound.play('pop');
  }
  function updatePlanBanner() {
    const act = S.players.filter(p => p.connected || p.isBot);
    const done = act.filter(p => p.done).length;
    phaseBanner(`🤫 ${esc(t('g.plan'))}<small>${esc(t('g.planSub', { n: done, m: act.length }))}</small>`);
    S.players.forEach(p => {
      const tok = $(`.token[data-pid="${p.id}"]`);
      if (!tok) return;
      if (p.done && !tok.classList.contains('done')) { tok.classList.add('done'); tokenFx(p.id, 'hop', 600); Sound.play('tock'); }
      if (!p.done) tok.classList.remove('done');
    });
  }

  async function enterReveal(my) {
    hideOverlay(); clearLogs();
    $$('.token').forEach(el => el.classList.remove('done'));
    const pd = S.pd;
    const tapeRooms = pd.events.filter(e => e.k === 'rv.tape').map(e => e.room);
    setClosed((pd.closed || []).filter(r => !tapeRooms.includes(r)));
    phaseBanner(`👣 ${esc(t('g.reveal'))}`);
    Sound.play('whoosh');
    const pos = { ...pd.planned };
    layoutTokens(pos, 70);
    await sleep(2600);
    phaseBanner(null);
    const closedNow = new Set((pd.closed || []).filter(r => !tapeRooms.includes(r)));
    for (const ev of pd.events) {
      if (seq !== my) return;
      const def = D.CARDS[ev.card] || {};
      let emoji = def.emoji || '❓';
      if (ev.k === 'ev.storm') emoji = '⛈️';
      if (ev.k === 'ev.blocked') emoji = '🛡️';
      if (ev.k === 'ev.bounced') emoji = '🐾';
      if (ev.k === 'ev.gardenSafe') emoji = '🌳';
      const text = t(ev.k, { a: nm(ev.from), b: nm(ev.to), r: ev.room, n: ev.n, h: ev.h });
      eventCard(emoji, t('card.' + ev.card), text);
      Sound.play('card');
      Voice.say(text, lang);
      if (ev.k === 'rv.blackout' || ev.k === 'ev.storm') {
        document.body.classList.remove('blackout'); void document.body.offsetWidth; document.body.classList.add('blackout');
        if (ev.k === 'ev.storm') { document.body.classList.add('thunder'); Sound.play('thunder'); setTimeout(() => document.body.classList.remove('thunder'), 1000); }
        setTimeout(() => document.body.classList.remove('blackout'), 2300);
      }
      if (ev.k === 'rv.tape') { closedNow.add(ev.room); setClosed([...closedNow]); }
      if (ev.moved) {
        Object.assign(pos, ev.moved);
        await sleep(ev.k === 'rv.blackout' || ev.k === 'ev.storm' ? 700 : 350);
        layoutTokens(pos, ev.k === 'rv.blackout' || ev.k === 'ev.storm' ? 25 : 0);
        Object.keys(ev.moved).forEach(pid => tokenFx(pid, ev.k === 'rv.banana' ? 'spin' : 'hop', 1500));
      }
      if (ev.k === 'rv.thief' && ev.n) { floater(ev.to, '−' + ev.n, 'neg'); setTimeout(() => floater(ev.from, '+' + ev.n, 'pos'), 500); tokenFx(ev.to, 'hit'); Sound.play('coin'); }
      if (ev.k === 'rv.extortion' && ev.n) { floater(ev.from, '+' + ev.n, 'pos'); Sound.play('coin'); }
      if (ev.k === 'rv.lawyer' || ev.k === 'rv.forgery') tokenFx(ev.from, 'glow', 2000);
      if (ev.k === 'ev.blocked' || ev.k === 'ev.bounced') tokenFx(ev.to, 'glow', 2000);
      if (ev.k === 'rv.gift') tokenFx(ev.to, 'hop');
      await sleep(ev.moved ? 2050 : 2400);
    }
    if (seq !== my) return;
    layoutTokens(pd.final, 0);
  }

  function fighterHtml(pid, extra = '') {
    const p = P(pid);
    return p ? `<div class="fighter ${extra}" data-f="${pid}">${medal(p)}<span class="nm">${esc(p.name)}</span><span class="sc"></span></div>` : '';
  }
  function fmtScore(type, s) {
    if (s === undefined || s === null || !Number.isFinite(s)) return t('sc.none');
    if (type === 'tap') return t('sc.tap', { n: s });
    if (type === 'reaction') return s < 0 ? t('sc.early') : t('sc.ms', { n: Math.round(s) });
    if (type === 'stopwatch') return t('sc.sec', { n: (s / 1000).toFixed(2) });
    return fmt(s, lang);
  }

  function enterDuel(my) {
    const pd = S.pd;
    if (S.pd.stage === 'intro') { layoutTokens(lastPos && Object.keys(lastPos).length ? lastPos : {}, 0); }
    const groupsHtml = pd.groups.map((g, gi) => `
      <div class="duel-group" style="animation:rise .6s ${gi * 200}ms both">
        <h3>${D.ROOMS[g.room].emoji} ${esc(t('room.' + g.room))}</h3>
        <div class="duel-row">${g.pids.map((id, i) => (i ? '<span class="vs">VS</span>' : '') + fighterHtml(id)).join('')}</div>
      </div>`).join('');
    const q = pd.q ? `<div class="question parchment">${esc(t('q.' + pd.q))}</div>` : '';
    let stageHtml = '';
    if (pd.stage === 'intro') stageHtml = `<div class="big-count">📱 ${esc(t('g.getReady'))}</div>`;
    if (pd.stage === 'play') stageHtml = `<div class="big-count" id="duel-count"></div>`;
    showOverlay(`<div class="ov-inner ov-duel">
      <h1 class="display">⚔️ ${esc(t('g.duelTitle'))}</h1>
      <div class="game-name">${esc(t('duel.' + pd.type))}</div>
      <p class="game-desc">${esc(t('dueld.' + pd.type))}</p>
      ${pd.reverse ? `<div class="reverse">🙃 ${esc(t('g.duelReverse'))}</div>` : ''}
      ${pd.stage !== 'intro' ? q : ''}
      <div class="duel-groups">${groupsHtml}</div>
      ${stageHtml}
      ${pd.stage === 'result' && pd.answer != null ? `<div class="answer-pill">✔ ${esc(t('g.answer', { n: fmt(pd.answer, lang) }))}</div>` : ''}
    </div>`);
    if (pd.stage === 'intro') { Sound.play('drum'); Voice.say(t('g.duelTitle') + ' ' + t('duel.' + pd.type), lang); }
    if (pd.stage === 'play') {
      Sound.play('go');
      updateDuelReady();
      const tick = () => {
        if (seq !== my) return;
        const el = $('#duel-count'); if (!el) return;
        const s = Math.ceil(Clock.left(S.endsAt) / 1000);
        el.textContent = s > 0 ? s : '⏱';
        setTimeout(tick, 200);
      };
      tick();
    }
    if (pd.stage === 'result') {
      Object.entries(pd.ranking).forEach(([room, ids]) => {
        ids.forEach((id, i) => {
          const f = $(`.fighter[data-f="${id}"]`);
          if (!f) return;
          f.querySelector('.sc').textContent = fmtScore(pd.type, pd.scores[id]);
          setTimeout(() => f.classList.add(i === 0 ? 'win' : 'lose'), 700 + i * 150);
        });
      });
      setTimeout(() => { if (seq === my) { Sound.play('win'); confetti({ count: 90, duration: 2500 }); } }, 800);
      const winners = Object.values(pd.winners).map(nm).join(', ');
      Voice.say(t('g.winner') + ': ' + winners, lang);
    }
  }
  function updateDuelReady() {
    S.players.forEach(p => { const f = $(`.fighter[data-f="${p.id}"]`); if (f) f.classList.toggle('ready', !!p.done); });
  }

  async function enterResults(my) {
    hideOverlay(); clearLogs();
    setClosed(S.closed);
    const pd = S.pd;
    layoutTokens(pd.final, 0);
    await sleep(500);
    for (const rr of pd.rooms) {
      if (seq !== my) return;
      const roomEl = $(`.room[data-room="${rr.room}"]`);
      if (!roomEl) continue;
      roomEl.classList.add('hot');
      const log = roomEl.querySelector('.room-log');
      const lines = rr.lines;
      const max = S.rooms.length > 6 ? 2 : 3;
      roomEl.classList.add('show-log');
      if (lines.some(l => l.k === 'ev.alarm')) { roomEl.classList.add('alarm'); Sound.play('alarm'); }
      lines.slice(0, max).forEach((l, i) => {
        const div = document.createElement('div');
        div.className = l.a > 0 ? 'pos' : l.a < 0 ? 'neg' : '';
        div.style.animationDelay = (i * 120) + 'ms';
        div.textContent = t(l.k, l.p);
        log.appendChild(div);
      });
      if (lines.length > max) { const div = document.createElement('div'); div.textContent = '+' + (lines.length - max) + ' …'; log.appendChild(div); }
      layoutTokens(lastPos, 0);
      await sleep(350);
      lines.forEach(l => {
        if (!l.pid) return;
        if (l.a) floater(l.pid, signed(l.a), l.a > 0 ? 'pos' : 'neg');
        else if (l.p && l.p.h) floater(l.pid, '🏺 ' + t('h.' + l.p.h), 'neutral');
        else if (l.k === 'ev.cards') floater(l.pid, '🃏 +' + l.p.n, 'neutral');
      });
      Sound.play(lines.some(l => l.a > 0) ? 'coin' : lines.some(l => l.a < 0) ? 'lose' : 'pop');
      await sleep(Math.max(900, 6000 / Math.max(3, pd.rooms.length)));
      roomEl.classList.remove('hot');
    }
    if (seq !== my) return;
    const msgs = [];
    if (pd.extra && pd.extra.length) msgs.push(`📜 ${esc(t('g.clauseEffect'))}<small>${pd.extra.map(l => esc(t(l.k, l.p))).join(' · ')}</small>`);
    (pd.newGhosts || []).forEach(id => msgs.push(`👻 ${esc(t('g.newGhost', { a: nm(id) }))}`));
    (pd.revived || []).forEach(id => msgs.push(`✨ ${esc(t('g.revived', { a: nm(id) }))}`));
    pd.extra && pd.extra.forEach(l => { if (l.pid && l.a) floater(l.pid, signed(l.a), l.a > 0 ? 'pos' : 'neg'); });
    for (const m of msgs) {
      if (seq !== my) return;
      phaseBanner(m);
      if (m.startsWith('👻')) Sound.play('ghost'); else Sound.play('pop');
      await sleep(2200);
    }
  }

  function enterVote(my) {
    const pd = S.pd;
    const amt = pd.amount;
    const others = S.players;
    if (pd.stage === 'vote') {
      showOverlay(`<div class="ov-inner ov-vote">
        <div class="vsub">🗳️ ${esc(t('g.vote'))}</div>
        <div class="vq">${esc(t('vq.' + pd.clause))}</div>
        <div class="vsub">${amt > 0 ? '+' : '−'}${fmt(Math.abs(amt), lang)} ${esc(t('cur'))} · <span id="vote-count"></span></div>
        <div class="vote-grid">${others.map((p, i) => `<div class="fighter" data-f="${p.id}" style="animation-delay:${i * 60}ms">${medal(p)}<span class="nm">${esc(p.name)}</span></div>`).join('')}</div>
      </div>`);
      Sound.play('bell');
      Voice.say(t('vq.' + pd.clause), lang);
      updateVoteReady();
    } else {
      const counts = pd.counts || {};
      const w = P(pd.winner);
      showOverlay(`<div class="ov-inner ov-vote">
        <div class="vq">${esc(t('vq.' + pd.clause))}</div>
        <div class="vote-grid">${others.map(p => `<div class="fighter ${p.id === pd.winner ? 'win' : 'lose'}" data-f="${p.id}">${medal(p)}<span class="nm">${esc(p.name)}</span><span class="votes">${'<i></i>'.repeat(counts[p.id] || 0)}</span></div>`).join('')}</div>
        ${w ? `<div class="spotlight"><div class="vsub">${esc(t('g.voteWinner'))}${pd.tie ? ' · ' + esc(t('g.voteTie')) : ''}</div>
          <div class="nm">${esc(w.name)}</div><div class="amt ${pd.applied >= 0 ? 'pos' : 'neg'}">${signed(pd.applied)} ${esc(t('cur'))}</div></div>`
          : `<div class="spotlight"><div class="vsub">${esc(t('g.noVotes'))}</div></div>`}
      </div>`);
      if (w) { Sound.play(pd.applied >= 0 ? 'win' : 'lose'); if (pd.applied > 0) confetti({ coins: true, count: 70 }); Voice.say(w.name, lang); }
    }
  }
  function updateVoteReady() {
    const act = S.players.filter(p => p.connected || p.isBot);
    const c = $('#vote-count');
    if (c) c.textContent = t('g.votesIn', { n: act.filter(p => p.done).length, m: act.length });
    S.players.forEach(p => { const f = $(`.fighter[data-f="${p.id}"]`); if (f) f.classList.toggle('ready', !!p.done); });
  }

  function enterFinalVote() {
    layoutTokens({}, 30);
    clearLogs();
    const qs = S.pd.qs;
    showOverlay(`<div class="ov-inner ov-vote">
      <div class="vsub">🔍 ${esc(t('g.finalVoteSub'))}</div>
      <div class="vq">${qs.map(q => esc(t('g.who.' + q))).join('<br>')}</div>
      <div class="vsub"><span id="vote-count"></span></div>
      <div class="vote-grid">${S.players.map((p, i) => `<div class="fighter" data-f="${p.id}" style="animation-delay:${i * 60}ms">${medal(p)}<span class="nm">${esc(p.name)}</span></div>`).join('')}</div>
    </div>`);
    Sound.play('drum');
    Voice.say(qs.map(q => t('g.who.' + q)).join(' '), lang);
    updateVoteReady();
  }

  /* ---------------- Finale ---------------- */
  async function enterFinale(my) {
    layoutTokens({}, 0);
    const steps = S.pd.steps;
    showOverlay(`<div class="ov-inner ov-finale"><h1 class="display f-title">📜 ${esc(t('f.title'))}</h1><div class="f-stage" id="f-stage"></div></div>`);
    Sound.play('fanfare');
    Voice.say(t('f.title'), lang);
    await sleep(2400);
    for (const st of steps) {
      if (seq !== my) return;
      const stage = $('#f-stage');
      if (!stage) return;
      let wait = 5000;
      let skip;
      const waiter = new Promise(res => { skip = res; });
      finaleSkip = () => skip();
      if (st.t === 'heirlooms') {
        const p = P(st.pid);
        stage.innerHTML = `<div class="f-step">
          <div class="f-who">${medal(p)}<b>${esc(t('f.heirlooms', { a: p.name }))}</b></div>
          <div class="f-items">${st.items.map((it, i) => `
            <div class="f-item ${it.v < 0 ? 'cursed' : 'parchment'}" style="animation-delay:${600 + i * 650}ms">
              <div class="e">${D.HEIRLOOM_BY_ID[it.h].emoji}</div><div class="n">${esc(t('h.' + it.h))}</div>
              <div class="v">${signed(it.v)}</div>${it.v < 0 ? `<div class="curse-tag">☠ ${esc(t('f.cursed'))}</div>` : ''}
            </div>`).join('')}</div>
          <div class="f-total" style="animation:pop-in .5s ${700 + st.items.length * 650}ms both">${esc(t('f.total'))}: <span class="${st.total >= 0 ? 'pos' : 'neg'}">${signed(st.total)}</span></div>
        </div>`;
        st.items.forEach((it, i) => setTimeout(() => { if (seq === my) Sound.play(it.v < 0 ? 'ghost' : 'coin'); }, 600 + i * 650));
        wait = 2600 + st.items.length * 650;
      } else if (st.t === 'role') {
        const real = P(st.real);
        const suspected = st.accused.map(nm).join(', ') || '–';
        const correct = st.correct.map(nm).join(', ');
        const eff = st.effect ? (st.role === 'butler' ? t('f.stole', { n: fmt(st.effect.stole, lang) }) : t('f.kidBonus', { n: fmt(st.effect.bonus, lang) })) : '';
        stage.innerHTML = `<div class="f-step f-reveal">
          <h2>${esc(t('f.real.' + st.role))}</h2>
          <div class="f-sub" style="animation-delay:.2s">${esc(t('f.suspected', { list: suspected }))}</div>
          <div style="animation:fade-in .1s 2.2s both">${medal(real)}<div class="role-name">${esc(real.name)} ${D.ROLES[st.role].emoji}</div></div>
          <div class="f-verdict ${st.caught ? 'good' : 'bad'}" style="animation-delay:3.2s">${esc(st.caught ? t('f.caught') : t('f.escaped'))}${eff ? `<br><small>${esc(eff)}</small>` : ''}</div>
          <div class="f-sub" style="animation-delay:4s">${esc(correct ? t('f.correct', { list: correct }) : t('f.nobodyCorrect'))}</div>
        </div>`;
        Sound.play('drum');
        setTimeout(() => { if (seq === my) { Sound.play('stamp'); } }, 2200);
        setTimeout(() => { if (seq === my) Sound.play(st.caught ? 'win' : 'alarm'); }, 3200);
        setTimeout(() => { if (seq === my) Voice.say(t('f.real.' + st.role) + ' ' + real.name, lang); }, 1600);
        wait = 7500;
      } else if (st.t === 'cat') {
        const p = P(st.pid);
        stage.innerHTML = `<div class="f-step f-reveal">
          ${medal(p)}<h2>🐈‍⬛ ${esc(t('f.cat', { a: p.name }))}</h2>
          <div class="f-verdict ${st.poorest ? 'good' : 'bad'}" style="animation-delay:1.2s">${esc(st.poorest ? t('f.catPoor') : t('f.catRich'))}</div>
        </div>`;
        Sound.play('pop');
        wait = 5000;
      } else if (st.t === 'family') {
        stage.innerHTML = `<div class="f-step"><h2>${esc(t('f.family'))}</h2><div class="fam-list">${st.ranking.map((f, i) => `
          <div class="fam-card ${i === 0 ? 'best' : ''}" style="animation:rise .5s ${i * 200}ms both">
            <b>${esc(t('fam.n', { n: f.id + 1 }))}</b><div class="ms">${f.members.map(id => (P(id) || {}).avatar).join('')}</div>
            <div class="money">${fmt(f.sum, lang)}</div></div>`).join('')}</div>
          <div class="f-sub">${esc(t('f.familyBonus'))}</div></div>`;
        Sound.play('win');
        wait = 5500;
      } else if (st.t === 'roles') {
        stage.innerHTML = `<div class="f-step"><h2>${esc(t('f.roles'))}</h2><div class="f-roles">${S.players.map((p, i) => `
          <div class="fighter" style="animation-delay:${i * 90}ms">${medal(p)}<span class="nm">${esc(p.name)}</span><span class="role">${D.ROLES[st.roles[p.id]].emoji} ${esc(t('role.' + st.roles[p.id]))}</span></div>`).join('')}</div></div>`;
        wait = 5500;
      } else if (st.t === 'podium') {
        const rk = st.ranking;
        const top = rk.slice(0, 3);
        const w = P(top[0].pid);
        stage.innerHTML = `<div class="f-step">
          <div class="winner-line">${esc(t('f.winner', { a: w.name }))}</div>
          <div class="podium">${top.map((r, i) => { const p = P(r.pid); return `<div class="pl p${i + 1}">${medal(p)}<span class="nm">${esc(p.name)}</span><span class="money">${fmt(r.money, lang)}</span><div class="block" style="animation-delay:${(2 - i) * 300}ms">${i + 1}</div></div>`; }).join('')}</div>
          <div class="rest">${rk.slice(3).map((r, i) => `<span>${i + 4}. ${esc(nm(r.pid))} · ${fmt(r.money, lang)}</span>`).join('')}</div>
          <div class="f-actions"><button class="btn big blood" id="btn-again">${esc(t('f.again'))}</button></div>
        </div>`;
        $('#btn-again').addEventListener('click', () => conn.emit('host:restart'));
        Sound.play('fanfare');
        confetti({ count: 260, duration: 5000 });
        setTimeout(() => confetti({ coins: true, count: 120, duration: 4500 }), 1200);
        Voice.say(t('f.winner', { a: w.name }), lang);
        finaleSkip = null;
        return;
      }
      await Promise.race([sleep(wait), waiter]);
    }
  }

  window.__otto = () => S;
  /* ---------------- Start ---------------- */
  applyI18n();
  if (!sessionStorage.getItem('otto.host')) showScreen('start');
  else showScreen('start');
  if (window.speechSynthesis) speechSynthesis.getVoices();
})();
