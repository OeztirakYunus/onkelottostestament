/* Fernseher-Ansicht: Spielbrett, Overlays, Animationen */
(function () {
  'use strict';
  const { D, I, Connection, Sound, Music, Voice, confetti, esc, $, $$, sleep, fmt, Clock, animateNumber, fmtScore } = window.OTTO;

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
  Music.enabled = localStorage.getItem('otto.music') !== 'off';
  Voice.load();

  const conn = new Connection();
  const t = (k, p) => I.t(lang, k, p);
  const P = (id) => (S && S.players.find(p => p.id === id)) || null;
  const nm = (id) => (P(id) || { name: '?' }).name;
  const medal = (p, cls = '') => window.OTTO.medal(p, S && S.code, cls);
  const say = (keys, opts) => Voice.say(keys, lang, opts);
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
        <button class="tool ${Music.enabled ? '' : 'off'}" data-tool="music" title="${esc(t('h.music'))}">🎵</button>
        <button class="tool ${Voice.enabled ? '' : 'off'}" data-tool="voice" title="${esc(t('h.voice'))}">🗣️</button>
        <button class="tool" data-tool="full" title="${esc(t('h.fullscreen'))}">⛶</button>
        ${inGame ? `<button class="tool skip" data-tool="skip">${esc(t('h.skip'))} ⏭</button>` : ''}
        ${S ? `<button class="tool end" data-tool="end" title="${esc(t('h.end'))}">🚪 <span>${esc(t('h.end'))}</span></button>` : ''}`;
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
    if (k === 'music') { Music.setEnabled(!Music.enabled); localStorage.setItem('otto.music', Music.enabled ? 'on' : 'off'); }
    if (k === 'voice') { Voice.enabled = !Voice.enabled; if (!Voice.enabled) Voice.stop(); localStorage.setItem('otto.voice', Voice.enabled ? 'on' : 'off'); }
    if (k === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
    if (k === 'end') { $('#end-confirm').classList.remove('hidden'); Sound.play('pop'); return; }
    if (k === 'skip') { if (S && S.phase === 'finale' && finaleSkip) finaleSkip(); else conn.emit('host:skip'); }
    renderTools();
  });

  /* ---------------- Verbindung ---------------- */
  $('#btn-create').addEventListener('click', () => {
    Sound.init(); Sound.play('stamp'); Voice.unlock();
    $('#btn-create').disabled = true;
    $('#btn-create').textContent = t('h.connecting');
    conn.emit('host:create', { lang, origin: location.origin }, (res) => {
      sessionStorage.setItem('otto.host', JSON.stringify(res));
      Music.play('lobby');
      setTimeout(() => say('v.welcome'), 600);
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

  /* ---------------- Sitzung beenden ---------------- */
  $('#end-no').addEventListener('click', () => $('#end-confirm').classList.add('hidden'));
  $('#end-yes').addEventListener('click', () => {
    $('#end-confirm').classList.add('hidden');
    conn.emit('host:end');
  });
  $('#btn-new-session').addEventListener('click', () => { sessionStorage.removeItem('otto.host'); location.reload(); });
  conn.on('ended', (msg) => {
    sessionStorage.removeItem('otto.host');
    seq++; finaleSkip = null;
    const code = msg.code;
    S = null; enteredKey = '';
    hideOverlay(); phaseBanner(null);
    $('#event-banner').innerHTML = ''; $('#whispers').innerHTML = '';
    ['start', 'lobby', 'game'].forEach(n => $('#scr-' + n).classList.add('hidden'));
    $('#ended-list').innerHTML = (msg.started ? msg.ranking : msg.ranking.map(p => ({ ...p, money: null }))).map((p, i) => `
      <li style="animation-delay:${200 + i * 90}ms"><span class="rk">${msg.started ? i + 1 : ''}</span>${window.OTTO.medal(p, code)}<span class="nm">${esc(p.name)}</span>${p.money != null ? `<span class="money">${fmt(p.money, lang)}</span>` : ''}</li>`).join('');
    $('#scr-ended').classList.remove('hidden');
    Music.play('finale');
    Sound.play('bell');
    say('v.ended');
    if (msg.started) setTimeout(() => confetti({ coins: true, count: 90 }), 600);
  });
  // Jemand schreibt heimlich: auf dem Fernseher sieht man nur, DASS geflüstert wird
  conn.on('whisper', (w) => {
    if (!S) return;
    const box = $('#whispers');
    while (box.children.length >= 3) box.firstElementChild.remove();
    const from = P(w.from), to = w.to ? P(w.to) : null;
    if (!from) return;
    const el = document.createElement('div');
    el.className = 'whisper';
    el.innerHTML = `${medal(from, 'wsm')}<span class="wdots">💬</span>${to ? medal(to, 'wsm') : `<span class="wfam">${D.FAMILIES[w.fam || 0].emoji}</span>`}
      <span class="wtext">${esc(to ? t('h.whisper', { a: from.name, b: to.name }) : t('h.famWhisper', { n: t('fam.' + (w.fam || 0)) }))}</span>`;
    box.appendChild(el);
    Sound.play('whisper');
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 4200);
  });
  conn.on('state', (d) => {
    S = d;
    Clock.sync(d.now);
    if (d.lang !== lang) { lang = d.lang; localStorage.setItem('otto.lang', lang); applyI18n(); }
    render();
  });

  function showScreen(name) {
    ['start', 'lobby', 'game'].forEach(n => $('#scr-' + n).classList.toggle('hidden', n !== name));
  }

  const MUSIC_FOR = { lobby: 'lobby', intro: null, clause: null, plan: 'plan', reveal: 'plan', duel: 'duel', results: 'lobby', vote: 'plan', finalvote: 'plan', finale: 'finale', twist: 'duel', auction: 'lobby' };
  /* ---------------- Hauptrender ---------------- */
  function render() {
    if (!S) return;
    Music.play(MUSIC_FOR[S.phase] || null);
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
    const fm = S.settings.famMode;
    const ids = S.players.map(p => p.id + p.avatar + p.connected + p.name + p.photo + p.famPick).join() + fm + S.settings.famCount + lang;
    if (list.dataset.ids !== ids) {
      list.dataset.ids = ids;
      list.innerHTML = S.players.map(p => `
        <li class="${p.connected ? '' : 'off'} ${fm === 'choose' ? 'fam-pickable' : ''}" data-pid="${p.id}" ${fm === 'choose' && p.famPick != null ? `style="--fc:${D.FAMILIES[p.famPick].color}"` : ''}>
          ${fm === 'choose' && p.famPick != null ? `<span class="fam-badge" title="${esc(t('fam.' + p.famPick))}">${D.FAMILIES[p.famPick].emoji}</span>` : ''}
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
    renderFamilySettings();
    const btn = $('#btn-start');
    btn.disabled = n < 2;
    btn.textContent = n < 2 ? t('h.needTwo') : t('h.start');
    $('#btn-bot').disabled = n >= 15;
  }
  $('#heir-list').addEventListener('click', (e) => {
    const k = e.target.closest('[data-kick]');
    if (k) { conn.emit('host:kick', k.dataset.kick); return; }
    const li = e.target.closest('li[data-pid]');
    if (li && S && S.settings.famMode === 'choose') { conn.emit('host:famCycle', li.dataset.pid); Sound.play('pop'); }
  });

  /* ---------------- Familien-Einstellung ---------------- */
  const sendSettings = (patch) => conn.emit('host:settings', { ...S.settings, ...patch });
  $('#fam-mode').addEventListener('click', (e) => { const b = e.target.closest('[data-fm]'); if (b) { sendSettings({ famMode: b.dataset.fm }); Sound.play('pop'); } });
  $('#fam-count').addEventListener('change', (e) => sendSettings({ famCount: e.target.value }));
  function renderFamilySettings() {
    const { famMode, famCount } = S.settings;
    $$('#fam-mode [data-fm]').forEach(b => b.classList.toggle('on', b.dataset.fm === famMode));
    $('#fam-count-wrap').classList.toggle('hidden', famMode === 'off');
    $('#fam-count').value = String(famCount);
    $('#fam-hint').textContent = t(famMode === 'choose' ? 'h.famHintChoose' : famMode === 'random' ? 'h.famHintRandom' : 'h.famHintOff');
    const board = $('#fam-board');
    if (famMode === 'off') { board.innerHTML = ''; return; }
    board.innerHTML = D.FAMILIES.slice(0, famCount).map(f => {
      const members = famMode === 'choose' ? S.players.filter(p => p.famPick === f.id) : [];
      return `<div class="fam-col" style="--fc:${f.color}">
        <div class="fam-crest">${f.emoji}</div>
        <div class="fam-name">${esc(t('fam.' + f.id))}</div>
        <div class="fam-members">${famMode === 'random' ? '<span class="fam-q">🎲</span>' : members.length ? members.map(p => medal(p, 'wsm')).join('') : `<small>${esc(t('h.famNoOne'))}</small>`}</div>
      </div>`;
    }).join('');
  }
  $('#btn-bot').addEventListener('click', () => conn.emit('host:addBot'));
  $('#btn-start').addEventListener('click', () => { Sound.init(); conn.emit('host:start'); });
  $('#set-rounds').addEventListener('change', (e) => sendSettings({ rounds: e.target.value }));
  $('#set-time').addEventListener('change', (e) => sendSettings({ planTime: e.target.value }));

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
        el.innerHTML = `<div class="medal"></div><div class="tn"></div>`;
        box.appendChild(el);
      }
      const look = p.photo + '|' + (p.prank || '');
      if (el.dataset.ph !== look) {
        const hadPrank = el.dataset.ph && !el.dataset.ph.endsWith('|') ;
        el.dataset.ph = look;
        if (p.prank && !hadPrank && S.phase !== 'lobby') setTimeout(() => { tokenFx(p.id, 'spin', 1400); floater(p.id, '🤡 ' + t('prank.' + p.prank), 'neutral'); Sound.play('boing'); }, 300);
        const tmp = document.createElement('div'); tmp.innerHTML = medal(p);
        el.replaceChild(tmp.firstElementChild, el.querySelector('.medal'));
      }
      el.querySelector('.tn').textContent = (S.families && p.family != null ? D.FAMILIES[p.family].emoji + ' ' : '') + p.name;
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
    const show = S.endsAt && (['plan', 'vote', 'finalvote'].includes(S.phase) || (S.phase === 'duel' && S.pd.stage === 'play') || (S.phase === 'twist' && S.pd.stage === 'act') || (S.phase === 'auction' && S.pd.stage === 'bid'));
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
    const fam = (p) => (S.families && p.family != null) ? `<i class="fam-tag" style="--fc:${D.FAMILIES[p.family].color}" title="${esc(t('fam.' + p.family))}">${D.FAMILIES[p.family].emoji}</i>` : '';
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
      case 'twist': return enterTwist(my);
      case 'auction': return enterAuction(my);
    }
  }
  function updatePhase(ph) {
    if (ph === 'plan') updatePlanBanner();
    if (ph === 'duel' && S.pd.stage === 'play') updateDuelReady();
    if (ph === 'duel' && S.pd.stage !== 'result') updateBetBoard();
    if (ph === 'vote' && S.pd.stage === 'selfie') updateVoteReady();
    if (ph === 'twist' && S.pd.stage === 'act') updateVoteReady();
    if (ph === 'auction' && S.pd.stage === 'bid') updateVoteReady();
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
    Sound.play('bell'); Sound.play('heartbeat');
    setTimeout(() => say('v.intro'), 900);
    if (S.families) setTimeout(() => { if (seq === my) showFamilies(my); }, 8500);
  }

  // Die Familien werden feierlich vorgestellt
  function showFamilies(my) {
    showOverlay(`<div class="ov-inner fam-intro">
      <h1 class="display">${esc(t('h.famIntro'))}</h1>
      <div class="fam-intro-row">${S.families.map((f, i) => { const F = D.FAMILIES[f.id]; return `
        <div class="fam-intro-card" style="--fc:${F.color};animation-delay:${300 + i * 450}ms">
          <div class="fam-crest big">${F.emoji}</div>
          <div class="fam-name">${esc(t('fam.' + f.id))}</div>
          <div class="fam-motto">„${esc(t('fam.motto.' + f.id))}“</div>
          <div class="fam-members">${f.members.map(id => medal(P(id))).join('')}</div>
        </div>`; }).join('')}</div>
    </div>`);
    Sound.play('fanfare');
    say('v.families');
    S.families.forEach((f, i) => setTimeout(() => { if (seq === my) Sound.play('stamp'); }, 300 + i * 450));
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
    setTimeout(() => { if (seq === my) say(pd.final ? ['v.lastRound', 'clause.' + pd.clause] : 'clause.' + pd.clause); }, 1200);
    words.forEach((w, i) => { if (i % 2 === 0) setTimeout(() => { if (seq === my) Sound.play('typewriter'); }, 1300 + i * wordDelay); });
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
    $$('.token').forEach(el => el.classList.toggle('wanted', el.dataset.pid === S.pd.wanted));
    const w = P(S.pd.wanted);
    if (w) {
      const my = seq;
      showOverlay(`<div class="wanted-poster parchment">
        <div class="wp-title">${esc(t('h.wanted'))}</div>
        <div class="wp-photo">${medal(w)}</div>
        <div class="wp-name">${esc(w.name)}</div>
        <div class="wp-reward">${esc(t('h.reward'))}: <span class="money">${fmt(50, lang)}</span></div>
        <div class="wp-sub">${esc(t('h.wantedSub', { a: w.name, n: fmt(50, lang) }))}</div>
        <div class="wp-nail l"></div><div class="wp-nail r"></div>
      </div>`, 'ov-wanted');
      Sound.play('whistle'); setTimeout(() => { if (seq === my) Sound.play('stamp'); }, 700);
      say(['v.wanted', 'v.plan']);
      setTimeout(() => { if (seq === my) hideOverlay(); }, 5200);
      return;
    }
    say('v.plan', { queue: true });
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

  const CARD_SFX = { banana: 'slip', thief: 'thief', forgery: 'scribble', lawyer: 'gavel', blackout: 'powerdown', lure: 'whistle', tape: 'tape', gift: 'gift', extortion: 'kaching',
    swap: 'whoosh', magnet: 'magnet', clover: 'sparkle', sleep: 'snore', invoice: 'kaching', copycat: 'boing', dice: 'dice', bell: 'bell', curse: 'ghost',
    trumpet: 'party', paparazzi: 'shutter', pickcard: 'shuffle', wine: 'hic', stinkbomb: 'stink', legacy: 'sparkle', bounty: 'jackpot' };
  const EVENT_SFX = { 'ev.storm': 'thunder', 'ev.blocked': 'boing', 'ev.bounced': 'meow', 'ev.gardenSafe': 'birds' };
  const EVENT_VOICE = { 'ev.storm': 'v.storm', 'ev.blocked': 'v.blocked', 'ev.bounced': 'v.bounced', 'ev.gardenSafe': 'v.gardenSafe' };
  async function enterReveal(my) {
    hideOverlay(); clearLogs();
    $$('.token').forEach(el => el.classList.remove('done'));
    const pd = S.pd;
    const tapeRooms = pd.events.filter(e => e.k === 'rv.tape').map(e => e.room);
    setClosed((pd.closed || []).filter(r => !tapeRooms.includes(r)));
    phaseBanner(`👣 ${esc(t('g.reveal'))}`);
    Sound.play('whoosh');
    say('v.reveal');
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
      if (ev.k === 'rv.bounty') emoji = '🎯';
      const text = t(ev.k, { a: nm(ev.from), b: nm(ev.to), r: ev.room, n: ev.n, h: ev.h });
      eventCard(emoji, ev.card === 'bounty' ? t('h.wanted') : t('card.' + ev.card), text);
      Sound.play('card');
      setTimeout(() => { if (seq === my) Sound.play(EVENT_SFX[ev.k] || CARD_SFX[ev.card] || 'pop'); }, 250);
      say(EVENT_VOICE[ev.k] || (ev.card === 'bounty' ? 'v.wanted' : 'v.card.' + ev.card));
      if (ev.k === 'rv.blackout' || ev.k === 'ev.storm') {
        document.body.classList.remove('blackout'); void document.body.offsetWidth; document.body.classList.add('blackout');
        if (ev.k === 'ev.storm') { document.body.classList.add('thunder'); setTimeout(() => document.body.classList.remove('thunder'), 1000); }
        setTimeout(() => document.body.classList.remove('blackout'), 2300);
      }
      if (ev.k === 'rv.tape') { closedNow.add(ev.room); setClosed([...closedNow]); }
      if (ev.moved) {
        Object.assign(pos, ev.moved);
        const mass = ['rv.blackout', 'ev.storm', 'rv.bell', 'rv.stinkbomb'].includes(ev.k);
        await sleep(mass ? 700 : 350);
        layoutTokens(pos, mass ? 25 : 0);
        Object.keys(ev.moved).forEach(pid => tokenFx(pid, ev.k === 'rv.banana' ? 'spin' : 'hop', 1500));
      }
      if (ev.k === 'rv.thief' && ev.n) { floater(ev.to, '−' + ev.n, 'neg'); setTimeout(() => floater(ev.from, '+' + ev.n, 'pos'), 500); tokenFx(ev.to, 'hit'); }
      if (ev.k === 'rv.extortion' && ev.n) floater(ev.from, '+' + ev.n, 'pos');
      if (ev.k === 'rv.bounty') { floater(ev.from, '🎯 +' + ev.n, 'pos'); tokenFx(ev.from, 'glow', 2000); }
      if (ev.k === 'rv.invoice' && ev.n) { floater(ev.to, '−' + ev.n, 'neg'); setTimeout(() => floater(ev.from, '+' + ev.n, 'pos'), 500); tokenFx(ev.to, 'hit'); }
      if (ev.k === 'rv.magnet' && ev.n) { floater(ev.from, '+' + ev.n, 'pos'); tokenFx(ev.from, 'glow', 2000); }
      if (ev.k === 'rv.diceWin') { floater(ev.from, '+' + ev.n, 'pos'); tokenFx(ev.from, 'spin', 1500); }
      if (ev.k === 'rv.diceLose') { floater(ev.from, '−' + ev.n, 'neg'); tokenFx(ev.from, 'hit'); }
      if (ev.k === 'rv.legacy') floater(ev.from, '🏺 −' + ev.n, 'neutral');
      if (ev.k === 'rv.sleep') { floater(ev.to, '💤', 'neutral'); tokenFx(ev.to, 'hit'); }
      if (ev.k === 'rv.wine') { floater(ev.to, '🍷 Hicks!', 'neutral'); tokenFx(ev.to, 'spin', 1500); }
      if (ev.k === 'rv.paparazzi') { tokenFx(ev.to, 'glow', 1500); document.body.animate([{ filter: 'brightness(2.2)' }, { filter: 'none' }], { duration: 350 }); }
      if (ev.k === 'rv.clover' || ev.k === 'rv.trumpet') tokenFx(ev.from, 'hop');
      if (ev.k === 'rv.curse' && ev.room) { const r = $(`.room[data-room="${ev.room}"]`); if (r) r.animate([{ filter: 'hue-rotate(0) brightness(1)' }, { filter: 'hue-rotate(250deg) brightness(.5)' }, { filter: 'none' }], { duration: 1600 }); }
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
      <div class="game-name">${D.DUELS[pd.type].emoji} ${esc(t('duel.' + pd.type))}</div>
      <p class="game-desc">${esc(t('dueld.' + pd.type))}</p>
      ${pd.reverse ? `<div class="reverse">🙃 ${esc(t('g.duelReverse'))}</div>` : ''}
      ${pd.stage !== 'intro' ? q : ''}
      <div class="duel-groups">${groupsHtml}</div>
      ${stageHtml}
      ${pd.bets ? `<div class="bet-board" id="bet-board"><div class="bb-title">🎰 ${esc(t('h.bets'))} · 🍅 ${esc(t('p.sabTitle').replace(/^\S+\s/, ''))}</div><div class="bb-list"></div></div>` : ''}
      ${pd.stage === 'result' && (pd.betResults || []).length ? `<div class="bet-results">${pd.betResults.map((b, i) => `<span class="bet-res ${b.delta > 0 ? 'pos' : 'neg'}" style="animation-delay:${1600 + i * 180}ms">${medal(P(b.pid), 'wsm')} ${esc(b.delta > 0 ? t('h.betWin', { a: nm(b.pid), n: fmt(b.delta, lang) }) : t('h.betLose', { a: nm(b.pid), n: fmt(-b.delta, lang) }))}</span>`).join('')}</div>` : ''}
      ${pd.stage === 'result' && ['estimate', 'count'].includes(pd.type) && pd.answer != null ? `<div class="answer-pill">✔ ${esc(t('g.answer', { n: fmt(pd.answer, lang) }))}</div>` : ''}
      ${pd.stage === 'result' && pd.type === 'safe' && pd.secret ? `<div class="answer-pill">🔓 ${esc(t('g.answer', { n: pd.secret }))}</div>` : ''}
      ${pd.stage === 'result' && pd.type === 'balloon' && pd.pop ? `<div class="answer-pill">💥 ${esc(t('sc.pumps', { n: pd.pop }))}</div>` : ''}
    </div>`);
    if (pd.stage === 'intro') { Sound.play('clang'); setTimeout(() => Sound.play('drum'), 300); say([...(pd.reverse ? ['v.duel', 'duel.' + pd.type, 'g.duelReverse'] : ['v.duel', 'duel.' + pd.type]), ...(pd.bets ? ['v.bets'] : [])]); }
    updateBetBoard();
    if (pd.stage === 'result' && (pd.pranked || []).length) setTimeout(() => { if (seq === my) { Sound.play('boing'); pd.pranked.forEach(x => { const f = $(`.fighter[data-f="${x.pid}"] .medal`); if (f) f.insertAdjacentHTML('beforeend', window.OTTO.prankArt(x.kind)); }); } }, 1500);
    if (pd.stage === 'result' && (pd.betResults || []).some(b => b.delta > 0)) setTimeout(() => { if (seq === my) Sound.play('jackpot'); }, 1700);
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
          f.querySelector('.sc').textContent = fmtScore(t, pd.type, pd.scores[id], lang);
          setTimeout(() => f.classList.add(i === 0 ? 'win' : 'lose'), 700 + i * 150);
        });
      });
      say('v.duelWin');
      setTimeout(() => { if (seq === my) { Sound.play('win'); Sound.play('applause'); confetti({ count: 90, duration: 2500 }); } }, 1100);
    }
  }
  // Wetten der Zuschauer live auf dem Fernseher
  function updateBetBoard() {
    const box = $('#bet-board .bb-list');
    if (!box) return;
    const bets = S.bets || {};
    const html = Object.entries(bets).map(([pid, b]) => `<span class="bb-chip" data-b="${pid}">${medal(P(pid), 'wsm')}<b>${fmt(b.amount, lang)}</b> ➜ ${medal(P(b.on), 'wsm')}</span>`).join('') || `<small class="bb-empty">📱 ${esc(t('v.bets'))}</small>`;
    const key = Object.keys(bets).join() + lang;
    if (box.dataset.k === key) return;
    const added = Object.keys(bets).filter(k => !(box.dataset.k || '').split(',').includes(k)).length;
    box.dataset.k = key; box.innerHTML = html;
    if (added && S.pd.stage !== 'result') Sound.play('coin');
  }
  // Fliegende Sabotage-Geschosse
  conn.on('sabotage', (s) => {
    if (!S || S.phase !== 'duel') return;
    const target = $(`.fighter[data-f="${s.to}"]`);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'sab-fly';
    el.textContent = D.SABOTAGE[s.kind].emoji;
    const fromLeft = Math.random() < 0.5;
    const sx = fromLeft ? -80 : innerWidth + 80, sy = innerHeight * (0.5 + Math.random() * 0.5);
    const tx = r.left + r.width / 2, ty = r.top + r.height * 0.35;
    el.style.left = '0px'; el.style.top = '0px';
    $('#fx-layer').appendChild(el);
    const anim = el.animate([
      { transform: `translate(${sx}px, ${sy}px) rotate(0deg) scale(1)` },
      { transform: `translate(${(sx + tx) / 2}px, ${Math.min(sy, ty) - 160}px) rotate(${fromLeft ? 360 : -360}deg) scale(1.4)`, offset: 0.55 },
      { transform: `translate(${tx}px, ${ty}px) rotate(${fromLeft ? 720 : -720}deg) scale(1)` }
    ], { duration: 750, easing: 'cubic-bezier(.3,.1,.5,1)' });
    Sound.play('whoosh');
    anim.onfinish = () => {
      el.remove();
      const from = P(s.from);
      target.classList.remove('sab-' + s.kind); void target.offsetWidth; target.classList.add('sab-' + s.kind);
      setTimeout(() => target.classList.remove('sab-' + s.kind), 1800);
      if (s.kind === 'tomato') { Sound.play('splat'); target.insertAdjacentHTML('beforeend', '<span class="splat-tv"></span>'); const sp = target.querySelector('.splat-tv:last-child'); setTimeout(() => sp && sp.remove(), 2600); }
      else Sound.play(s.kind === 'quake' ? 'rumble' : s.kind === 'fog' ? 'stink' : 'boing');
      if (from) { const tag = document.createElement('div'); tag.className = 'sab-by'; tag.innerHTML = `${medal(from, 'wsm')} ${D.SABOTAGE[s.kind].emoji}`; target.appendChild(tag); setTimeout(() => tag.remove(), 1800); }
    };
  });
  // Verträge: unterschrieben oder gebrochen
  conn.on('dealEvent', (e) => {
    if (!S) return;
    const a = P(e.a), b = P(e.b);
    if (!a || !b) return;
    const box = $('#deal-feed');
    const el = document.createElement('div');
    if (e.type === 'signed') {
      el.className = 'deal-card parchment';
      el.innerHTML = `<div class="dc-ms">${medal(a)}<span class="dc-hand">🤝</span>${medal(b)}</div><div class="dc-text">${esc(t('h.dealSigned', { a: a.name, b: b.name }))}</div><div class="dc-stamp">✍️</div>`;
      Sound.play('scribble'); setTimeout(() => Sound.play('stamp'), 600);
      if (Math.random() < 0.5) say('v.deal', { queue: true });
    } else {
      el.className = 'deal-card snake';
      const promise = e.promise ? (e.promise.key ? t('promise.' + e.promise.key) : e.promise.text) : '';
      el.innerHTML = `<div class="dc-snake">🐍</div><div class="dc-ms">${medal(b, 'big')}</div><div class="dc-big">${esc(t('h.snake'))}</div><div class="dc-text">${esc(t('h.dealBroken', { a: a.name, b: b.name }))}</div>${promise ? `<div class="dc-promise">„${esc(promise)}“</div>` : ''}`;
      Sound.play('hiss'); setTimeout(() => Sound.play('wahwah'), 700);
      say('v.dealBroken');
      if (S.phase !== 'lobby') tokenFx(b.id, 'hit', 1500);
    }
    while (box.children.length >= 2) box.firstElementChild.remove();
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, e.type === 'signed' ? 4200 : 6500);
  });
  function updateDuelReady() {
    S.players.forEach(p => { const f = $(`.fighter[data-f="${p.id}"]`); if (f) f.classList.toggle('ready', !!p.done); });
  }

  const RESULT_SFX = { 'ev.jackpot': 'jackpot', 'ev.cellarLoss': 'stairs', 'ev.rats': 'rats', 'ev.poison': 'burp', 'ev.heirloom': 'sparkle',
    'ev.haunt': 'ghost', 'ev.garden': 'birds', 'ev.vaultSolo': 'coins', 'ev.duelWin': 'coins', 'ev.cards': 'shuffle', 'ev.attic': 'shuffle',
    'ev.read': 'scribble', 'ev.mirror': 'boing', 'ev.asleep': 'snore', 'ev.clover': 'sparkle', 'ev.trumpet': 'party', 'ev.share': 'coins', 'ev.feud': 'clang', 'ev.bonus': 'kaching', 'ev.empty': 'wahwah' };
  async function enterResults(my) {
    hideOverlay(); clearLogs();
    setClosed(S.closed);
    const pd = S.pd;
    layoutTokens(pd.final, 0);
    say('v.results');
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
      if (lines.some(l => l.k === 'ev.alarm')) { roomEl.classList.add('alarm'); Sound.play('alarm'); say('v.alarm'); }
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
      const fxKey = lines.map(l => RESULT_SFX[l.k]).find(Boolean);
      Sound.play(fxKey || (lines.some(l => l.a > 0) ? 'coin' : lines.some(l => l.a < 0) ? 'lose' : 'pop'));
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
      if (m.startsWith('👻')) { Sound.play('ghost'); say('v.ghost'); } else if (m.startsWith('✨')) { Sound.play('sparkle'); say('v.revived'); } else Sound.play('pop');
      await sleep(2200);
    }
  }

  function enterVote(my) {
    const pd = S.pd;
    const amt = pd.amount;
    const others = S.players;
    const selfie = (p, round) => `<div class="selfie-frame"><img src="/selfie/${S.code}/${p.id}?r=${round}" alt=""></div>`;
    if (pd.stage === 'selfie') {
      const humans = S.players.filter(p => !p.isBot);
      showOverlay(`<div class="ov-inner ov-vote ov-selfie">
        <div class="vsub">📸 ${esc(t('h.selfieTitle'))}</div>
        <div class="vq">${esc(t('vq.' + pd.clause))}</div>
        <div class="vsub">${esc(t('h.selfieWait'))} · <span id="vote-count"></span></div>
        <div class="selfie-cams">${humans.map((p, i) => `<div class="fighter cam" data-f="${p.id}" style="animation-delay:${i * 80}ms">${medal(p)}<span class="nm">${esc(p.name)}</span><span class="cam-ico">📸</span></div>`).join('')}</div>
      </div>`);
      Sound.play('shutter'); setTimeout(() => Sound.play('shutter'), 250);
      say(['v.selfie', 'vq.' + pd.clause]);
      updateVoteReady();
      return;
    }
    if (pd.stage === 'vote') {
      const cands = pd.candidates ? others.filter(p => pd.candidates.includes(p.id)) : null;
      showOverlay(`<div class="ov-inner ov-vote ${cands ? 'ov-selfie' : ''}">
        <div class="vsub">${cands ? '📸' : '🗳️'} ${esc(t('g.vote'))}</div>
        <div class="vq">${esc(t('vq.' + pd.clause))}</div>
        <div class="vsub">${amt > 0 ? '+' : '−'}${fmt(Math.abs(amt), lang)} ${esc(t('cur'))} · <span id="vote-count"></span></div>
        ${cands ? `<div class="selfie-grid">${cands.map((p, i) => `<div class="fighter sf" data-f="${p.id}" style="animation-delay:${i * 140}ms;--tilt:${(i % 2 ? 1 : -1) * (2 + (i % 3))}deg">${selfie(p, pd.selfieRound)}<span class="nm">${esc(p.name)}</span></div>`).join('')}</div>`
          : `<div class="vote-grid">${others.map((p, i) => `<div class="fighter" data-f="${p.id}" style="animation-delay:${i * 60}ms">${medal(p)}<span class="nm">${esc(p.name)}</span></div>`).join('')}</div>`}
      </div>`);
      Sound.play('bell');
      say(['v.vote', 'vq.' + pd.clause]);
      if (cands) cands.forEach((p, i) => setTimeout(() => { if (seq === my) Sound.play('shutter'); }, i * 140));
      updateVoteReady();
    } else if (pd.candidates) {
      const counts = pd.counts || {};
      const w = P(pd.winner);
      const cands = others.filter(p => pd.candidates.includes(p.id));
      showOverlay(`<div class="ov-inner ov-vote ov-selfie">
        <div class="vq">${esc(t('vq.' + pd.clause))}</div>
        <div class="selfie-grid small">${cands.map(p => `<div class="fighter sf ${p.id === pd.winner ? 'win' : 'lose'}" data-f="${p.id}">${selfie(p, pd.selfieRound)}<span class="nm">${esc(p.name)}</span><span class="votes">${'<i></i>'.repeat(counts[p.id] || 0)}</span></div>`).join('')}</div>
        ${w ? `<div class="spotlight"><div class="vsub">${esc(t('g.voteWinner'))}</div><div class="nm">${esc(w.name)}</div><div class="amt ${pd.applied >= 0 ? 'pos' : 'neg'}">${signed(pd.applied)} ${esc(t('cur'))}</div></div>` : `<div class="spotlight"><div class="vsub">${esc(t('g.noVotes'))}</div></div>`}
      </div>`);
      Sound.play('drum');
      say('v.voteResult');
      if (w) setTimeout(() => { if (seq !== my) return; Sound.play('crash'); Sound.play('win'); Sound.play('applause'); confetti({ coins: true, count: 70 }); }, 1200);
    } else {
      const counts = pd.counts || {};
      const w = P(pd.winner);
      showOverlay(`<div class="ov-inner ov-vote">
        <div class="vq">${esc(t('vq.' + pd.clause))}</div>
        <div class="vote-grid">${others.map(p => `<div class="fighter ${p.id === pd.winner ? 'win' : 'lose'}" data-f="${p.id}">${medal(p)}<span class="nm">${esc(p.name)}</span><span class="votes">${'<i></i>'.repeat(counts[p.id] || 0)}</span></div>`).join('')}</div>
        ${w ? `<div class="spotlight"><div class="vsub">${esc(t('g.voteWinner'))}${pd.tie ? ' · ' + esc(t('g.voteTie')) : ''}</div>
          ${medal(w)}<div class="nm">${esc(w.name)}</div><div class="amt ${pd.applied >= 0 ? 'pos' : 'neg'}">${signed(pd.applied)} ${esc(t('cur'))}</div>
          ${pd.clown ? `<div class="vsub clown-line">${esc(t('g.clownVote', { a: w.name }))}</div>` : ''}</div>`
          : `<div class="spotlight"><div class="vsub">${esc(t('g.noVotes'))}</div></div>`}
      </div>`);
      Sound.play('drum');
      say('v.voteResult');
      if (w) setTimeout(() => { if (seq !== my) return; Sound.play('crash'); Sound.play(pd.clown ? 'boing' : pd.applied >= 0 ? 'win' : 'wahwah'); if (pd.applied > 0) confetti({ coins: true, count: 70 }); if (pd.clown) Sound.play('applause'); }, 1200);
    }
  }
  function updateVoteReady() {
    const selfieStage = S.phase === 'vote' && S.pd.stage === 'selfie';
    const act = S.players.filter(p => (p.connected || p.isBot) && !(selfieStage && p.isBot) && !(S.phase === 'auction' && p.ghost) && !(S.phase === 'twist' && S.pd.type === 'treasure_hunt' && p.ghost));
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
    say('v.finalvote');
    updateVoteReady();
  }

  /* ---------------- Finale ---------------- */
  async function enterFinale(my) {
    layoutTokens({}, 0);
    const steps = S.pd.steps;
    showOverlay(`<div class="ov-inner ov-finale"><h1 class="display f-title">📜 ${esc(t('f.title'))}</h1><div class="f-stage" id="f-stage"></div></div>`);
    Sound.play('fanfare');
    say('v.finale');
    await sleep(4200);
    let saidHeirlooms = false;
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
        if (!saidHeirlooms) { saidHeirlooms = true; say('v.heirlooms'); }
        st.items.forEach((it, i) => setTimeout(() => { if (seq === my) Sound.play(it.v < 0 ? 'ghost' : 'coins'); }, 600 + i * 650));
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
        setTimeout(() => { if (seq === my) { Sound.play(st.caught ? 'win' : 'alarm'); say(st.caught ? 'v.caught' : 'v.escaped'); } }, 3200);
        say('v.real.' + st.role);
        wait = 7500;
      } else if (st.t === 'seer') {
        const p = P(st.pid);
        say('v.seer');
        stage.innerHTML = `<div class="f-step f-reveal">
          <div style="animation:fade-in .1s 1.6s both">${medal(p)}</div><h2>🔮 ${esc(t('f.seer', { a: p.name }))}</h2>
          <div class="f-verdict ${st.hits ? 'good' : 'bad'}" style="animation-delay:2.2s">${esc(t('f.seerHits', { n: st.hits }))}</div>
        </div>`;
        setTimeout(() => { if (seq === my) Sound.play('sparkle'); }, 1600);
        wait = 5500;
      } else if (st.t === 'clown') {
        const p = P(st.pid);
        say('v.clown');
        stage.innerHTML = `<div class="f-step f-reveal">
          <div style="animation:fade-in .1s 1.6s both">${medal(p)}</div><h2>🤡 ${esc(t('f.clown', { a: p.name }))}</h2>
          <div class="f-verdict ${st.fooled ? 'good' : 'bad'}" style="animation-delay:2.2s">${esc(st.fooled ? t('f.clownFooled', { n: fmt(st.bonus, lang) }) : t('f.clownNot'))}</div>
        </div>`;
        setTimeout(() => { if (seq === my) { Sound.play('boing'); if (st.fooled) Sound.play('applause'); else Sound.play('wahwah'); } }, 1700);
        wait = 5500;
      } else if (st.t === 'cat') {
        const p = P(st.pid);
        say('v.cat');
        stage.innerHTML = `<div class="f-step f-reveal">
          <div style="animation:fade-in .1s 1.4s both">${medal(p)}</div><h2>🐈‍⬛ ${esc(t('f.cat', { a: p.name }))}</h2>
          <div class="f-verdict ${st.poorest ? 'good' : 'bad'}" style="animation-delay:1.2s">${esc(st.poorest ? t('f.catPoor') : t('f.catRich'))}</div>
        </div>`;
        setTimeout(() => { if (seq === my) Sound.play('meow'); }, 1400);
        wait = 5500;
      } else if (st.t === 'family') {
        stage.innerHTML = `<div class="f-step"><h2>${esc(t('f.family'))}</h2><div class="fam-list">${st.ranking.map((f, i) => `
          <div class="fam-card ${i === 0 ? 'best' : ''}" style="animation:rise .5s ${i * 200}ms both">
            <div class="fam-crest" style="--fc:${D.FAMILIES[f.id].color}">${D.FAMILIES[f.id].emoji}</div><b>${esc(t('fam.' + f.id))}</b><div class="ms">${f.members.map(id => medal(P(id), 'wsm')).join('')}</div>
            <div class="money">${fmt(f.sum, lang)}</div></div>`).join('')}</div>
          <div class="f-sub">${esc(t('f.familyBonus'))}</div></div>`;
        Sound.play('win'); say('v.family');
        wait = 5500;
      } else if (st.t === 'awards') {
        const A = Object.fromEntries(D.AWARDS.map(a => [a.id, a]));
        say('v.awards');
        stage.innerHTML = `<div class="f-step"><h2>🏆 ${esc(t('h.awards'))}</h2><div class="f-sub" style="animation-delay:.2s">${esc(t('h.awardsSub'))}</div>
          <div class="awards-grid">${st.awards.map((a, i) => { const p = P(a.pid); return p ? `
            <div class="award-card" style="animation-delay:${1400 + i * 1300}ms">
              <div class="aw-emoji">${A[a.id].emoji}</div>
              <div class="aw-title">${esc(t('award.' + a.id))}</div>
              ${medal(p)}<div class="aw-name">${esc(p.name)}</div>
              <div class="aw-desc">${esc(t('awardd.' + a.id, { n: fmt(a.n, lang) }))}</div>
            </div>` : ''; }).join('')}</div></div>`;
        st.awards.forEach((a, i) => setTimeout(() => { if (seq === my) { Sound.play(i % 2 ? 'applause' : 'fanfare'); Sound.play('stamp'); } }, 1400 + i * 1300));
        wait = 3200 + st.awards.length * 1300;
      } else if (st.t === 'roles') {
        say('v.roles');
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
        say('v.winner');
        Sound.play('drum');
        setTimeout(() => { if (seq !== my) return; Sound.play('fanfare'); Sound.play('applause'); confetti({ count: 260, duration: 5000 }); }, 1500);
        setTimeout(() => { if (seq === my) confetti({ coins: true, count: 120, duration: 4500 }); }, 2700);
        finaleSkip = null;
        return;
      }
      await Promise.race([sleep(wait), waiter]);
    }
  }


  /* ---------------- Plot-Twists ---------------- */
  const TWIST_SFX = { otto_alive: 'ghost', tax_raid: 'siren', second_will: 'scribble', earthquake: 'rumble', role_swap: 'sparkle', treasure_hunt: 'coins', vultures: 'vulture', cousin_america: 'yeehaw' };
  const TWIST_FX = { otto_alive: '🧟', tax_raid: '🚨', second_will: '📜', earthquake: '🪨', role_swap: '🎭', treasure_hunt: '🪙', vultures: '🦅', cousin_america: '🤠' };
  function twistRain(type, n = 14) {
    const box = $('#fx-layer');
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'tw-rain ' + type;
      el.textContent = TWIST_FX[type];
      el.style.left = (Math.random() * 100) + 'vw';
      el.style.animationDelay = (Math.random() * 1.6) + 's';
      el.style.fontSize = (2 + Math.random() * 3) + 'rem';
      box.appendChild(el);
      setTimeout(() => el.remove(), 5200);
    }
  }
  function enterTwist(my) {
    const pd = S.pd, tw = D.TWISTS[pd.type];
    clearLogs();
    setClosed([]);
    const head = (big) => `<div class="tw-stamp ${big ? 'big' : ''}">${esc(t('h.twist'))}</div>
      <div class="tw-emoji">${tw.emoji}</div><h1 class="display tw-title">${esc(t('twist.' + pd.type))}</h1>`;
    if (pd.stage === 'result') {
      if (pd.type === 'tax_raid' && pd.hidden) layoutTokens(pd.hidden, 40); else layoutTokens({}, 30);
      if (pd.raid) { const r = $(`.room[data-room="${pd.raid}"]`); if (r) { r.classList.add('alarm', 'hot'); } }
      const lines = pd.lines || [];
      const taps = pd.taps ? Object.entries(pd.taps).sort((a, b) => b[1] - a[1]).slice(0, 8) : null;
      showOverlay(`<div class="ov-inner ov-twist result">${head(false)}
        ${pd.raid ? `<div class="tw-raid">🚔 ${esc(t('tw.raided', { r: pd.raid }))}</div>` : ''}
        ${taps ? `<div class="tw-taps">${taps.map(([pid, n], i) => `<div class="tw-tap ${i < 3 ? 'top' : ''}" style="animation-delay:${400 + i * 160}ms">${i < 3 ? ['🥇', '🥈', '🥉'][i] : ''}${medal(P(pid), 'wsm')}<span>${esc(nm(pid))}</span><b>${n}×</b></div>`).join('')}</div>` : ''}
        <div class="tw-lines">${lines.map((l, i) => `<div class="${l.a > 0 ? 'pos' : l.a < 0 ? 'neg' : ''}" style="animation-delay:${900 + i * 380}ms">${l.pid ? medal(P(l.pid), 'wsm') : ''}<span>${esc(t(l.k, l.p))}</span></div>`).join('')}</div>
      </div>`, 'ov-twist-bg');
      if (pd.type === 'tax_raid') { hideOverlay(); phaseBanner(`🚔 ${esc(t('tw.raided', { r: pd.raid }))}<small>${lines.map(l => esc(t(l.k, l.p))).join(' · ')}</small>`); Sound.play('siren'); setTimeout(() => { if (seq === my) Sound.play(lines.some(l => l.a < 0) ? 'alarm' : 'birds'); }, 900); }
      lines.forEach((l, i) => setTimeout(() => { if (seq !== my) return; if (l.pid && l.a) floater(l.pid, signed(l.a), l.a > 0 ? 'pos' : 'neg'); Sound.play(l.a > 0 ? 'coins' : l.a < 0 ? 'lose' : 'pop'); }, 900 + i * 380));
      if (!['tax_raid', 'treasure_hunt'].includes(pd.type)) {
        // nicht-interaktiver Twist: Intro + Ergebnis in einem
        say(['v.twist', 'v.tw.' + pd.type]);
        Sound.play('twist');
        setTimeout(() => { if (seq === my) Sound.play(TWIST_SFX[pd.type]); }, 900);
        twistRain(pd.type);
        if (pd.type === 'earthquake') { document.body.classList.remove('quake'); void document.body.offsetWidth; document.body.classList.add('quake'); setTimeout(() => document.body.classList.remove('quake'), 2600); }
      }
      if (pd.type === 'treasure_hunt') { confetti({ coins: true, count: 90 }); Sound.play('jackpot'); }
      return;
    }
    if (pd.stage === 'intro') {
      layoutTokens({}, 30);
      showOverlay(`<div class="ov-inner ov-twist">${head(true)}<p class="tw-desc">${esc(t('twistd.' + pd.type))}</p><div class="look">📱 ${esc(t('p.twistTapReady'))}</div></div>`, 'ov-twist-bg');
      Sound.play('twist'); setTimeout(() => { if (seq === my) Sound.play(TWIST_SFX[pd.type]); }, 900);
      say(['v.twist', 'v.tw.' + pd.type]);
      twistRain(pd.type, 10);
      return;
    }
    // act
    layoutTokens({}, 30);
    showOverlay(`<div class="ov-inner ov-twist">${head(pd.type === 'tax_raid')}<p class="tw-desc">${esc(t('twistd.' + pd.type))}</p>
      ${pd.type === 'treasure_hunt' ? `<div class="tw-dig">⛏️</div>` : ''}
      <div class="vsub">📱 <span id="vote-count"></span></div>
      <div class="vote-grid">${S.players.filter(p => !(pd.type === 'treasure_hunt' && p.ghost)).map((p, i) => `<div class="fighter" data-f="${p.id}" style="animation-delay:${i * 50}ms">${medal(p)}<span class="nm">${esc(p.name)}</span></div>`).join('')}</div>
    </div>`, 'ov-twist-bg' + (pd.type === 'tax_raid' ? ' siren' : ''));
    if (pd.type === 'tax_raid') {
      Sound.play('twist'); setTimeout(() => { if (seq === my) Sound.play('siren'); }, 900);
      say(['v.twist', 'v.tw.tax_raid']);
      twistRain('tax_raid', 8);
    } else { Sound.play('go'); Sound.play('drum'); }
    updateVoteReady();
  }

  /* ---------------- Erbstück-Auktion ---------------- */
  async function enterAuction(my) {
    const pd = S.pd, h = D.HEIRLOOM_BY_ID[pd.h];
    clearLogs(); layoutTokens({}, 30);
    if (pd.stage === 'bid') {
      showOverlay(`<div class="ov-inner ov-auction">
        <div class="auc-title"><span>🔨</span> ${esc(t('h.auction'))}</div>
        <div class="auc-stage"><div class="auc-spot"></div><div class="auc-item">${h.emoji}</div><div class="auc-pedestal"></div></div>
        <div class="auc-name">${esc(t('h.' + pd.h))}</div>
        <p class="tw-desc">${esc(t('h.auctionSub'))}</p>
        <div class="vsub">📱 <span id="vote-count"></span></div>
        <div class="vote-grid">${S.players.filter(p => !p.ghost).map((p, i) => `<div class="fighter" data-f="${p.id}" style="animation-delay:${i * 50}ms">${medal(p)}<span class="nm">${esc(p.name)}</span></div>`).join('')}</div>
      </div>`, 'ov-auction-bg');
      Sound.play('gavel'); setTimeout(() => { if (seq === my) Sound.play('sparkle'); }, 500);
      say('v.auction');
      updateVoteReady();
      return;
    }
    const bids = [...(pd.bids || [])].reverse(); // vom kleinsten zum größten
    const w = P(pd.winner);
    showOverlay(`<div class="ov-inner ov-auction">
      <div class="auc-title"><span>🔨</span> ${esc(t('h.auction'))}</div>
      <div class="auc-row"><div class="auc-item small">${h.emoji}</div><div class="auc-name">${esc(t('h.' + pd.h))}</div></div>
      <div class="auc-bids" id="auc-bids"></div>
      <div class="auc-sold hidden" id="auc-sold">${w ? `${medal(w)}<div class="sold-stamp">${esc(t('h.sold', { a: w.name, n: fmt(pd.price, lang) }))}</div>` : `<div class="sold-stamp unsold">${esc(t('h.unsold'))}</div>`}</div>
    </div>`, 'ov-auction-bg');
    const box = $('#auc-bids');
    const step = Math.min(700, 4200 / Math.max(1, bids.length));
    for (const b of bids) {
      if (seq !== my) return;
      const p = P(b.pid);
      box.insertAdjacentHTML('beforeend', `<div class="auc-bid ${b.pid === pd.winner ? 'top' : ''}">${medal(p, 'wsm')}<span>${esc(nm(b.pid))}</span><b class="money">${fmt(b.amount, lang)}</b></div>`);
      Sound.play('coin');
      await sleep(step);
    }
    if (seq !== my) return;
    say('v.sold');
    await sleep(900);
    if (seq !== my) return;
    $('#auc-sold').classList.remove('hidden');
    Sound.play('gavel'); setTimeout(() => Sound.play('gavel'), 250); setTimeout(() => { Sound.play('crash'); if (w) { Sound.play('applause'); confetti({ coins: true, count: 60 }); } else Sound.play('wahwah'); }, 520);
    if (w) floater(w.id, h.emoji + ' −' + pd.price, 'neutral');
  }

  window.__otto = () => S;
  /* ---------------- Start ---------------- */
  applyI18n();
  if (!sessionStorage.getItem('otto.host')) showScreen('start');
  else showScreen('start');
})();
