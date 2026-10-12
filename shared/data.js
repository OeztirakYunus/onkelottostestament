/* Onkel Ottos Testament – Spieldaten (Server + Browser) */
(function (root) {
  'use strict';

  const START_MONEY = 300;
  const HAND_MAX = 4;

  const ROOMS = {
    vault:    { emoji: '💰', tone: '#c9962e' },
    kitchen:  { emoji: '🍳', tone: '#c4573a' },
    library:  { emoji: '📚', tone: '#4f7fb8' },
    bedroom:  { emoji: '🛏️', tone: '#a8487a' },
    cellar:   { emoji: '🕳️', tone: '#6a5a8e' },
    garden:   { emoji: '🌳', tone: '#4f9a5c' },
    attic:    { emoji: '🕸️', tone: '#8a7a62' },
    ballroom: { emoji: '💃', tone: '#c94d6a' }
  };
  const BASE_ROOMS = ['vault', 'kitchen', 'library', 'bedroom', 'cellar', 'garden'];
  const BIG_ROOMS = ['attic', 'ballroom']; // ab 9 Spielern

  const CARDS = {
    banana:    { emoji: '🍌', target: 'player' },
    thief:     { emoji: '🧤', target: 'player' },
    forgery:   { emoji: '📜', target: null },
    lawyer:    { emoji: '⚖️', target: null },
    blackout:  { emoji: '🔌', target: null },
    lure:      { emoji: '🪤', target: 'player' },
    tape:      { emoji: '🚧', target: 'room' },
    gift:      { emoji: '🎁', target: 'player', needsHeirloom: true },
    extortion: { emoji: '💼', target: null },
    // 15 neue Karten
    swap:      { emoji: '🔄', target: 'player' },
    magnet:    { emoji: '🧲', target: null },
    clover:    { emoji: '🍀', target: null },
    sleep:     { emoji: '💤', target: 'player' },
    invoice:   { emoji: '🧾', target: 'player' },
    copycat:   { emoji: '🐒', target: 'player' },
    dice:      { emoji: '🎲', target: null },
    bell:      { emoji: '🔔', target: null },
    curse:     { emoji: '🕯️', target: 'room' },
    trumpet:   { emoji: '🎺', target: null },
    paparazzi: { emoji: '📸', target: 'player' },
    pickcard:  { emoji: '🐍', target: 'player' },
    wine:      { emoji: '🍷', target: 'player' },
    stinkbomb: { emoji: '💨', target: 'room' },
    legacy:    { emoji: '🏺', target: null }
  };
  const CARD_WEIGHTS = {
    banana: 4, thief: 4, forgery: 3, lawyer: 3, blackout: 1, lure: 3, tape: 2, gift: 2, extortion: 3,
    swap: 2, magnet: 1, clover: 2, sleep: 2, invoice: 2, copycat: 2, dice: 2, bell: 1, curse: 2,
    trumpet: 2, paparazzi: 2, pickcard: 2, wine: 2, stinkbomb: 2, legacy: 1
  };
  const CARD_POOL = [];
  Object.keys(CARD_WEIGHTS).forEach(k => { for (let i = 0; i < CARD_WEIGHTS[k]; i++) CARD_POOL.push(k); });

  const ROLES = {
    relative: { emoji: '🤑' },
    butler:   { emoji: '🤵' },
    kid:      { emoji: '👶' },
    cat:      { emoji: '🐈‍⬛' },
    seer:     { emoji: '🔮' },
    clown:    { emoji: '🤡' }
  };
  // Ab wie vielen Spielern eine Rolle ins Spiel kommt
  const ROLE_UNLOCK = { kid: 4, butler: 5, cat: 6, seer: 7, clown: 8 };

  // Werte bleiben bis zur Testamentseröffnung geheim!
  const HEIRLOOMS = [
    { id: 'goldwatch', emoji: '⌚', value: 200 },
    { id: 'cuckoo',    emoji: '🕰️', value: -150 },
    { id: 'painting',  emoji: '🖼️', value: 250 },
    { id: 'poodle',    emoji: '🐩', value: 80 },
    { id: 'teeth',     emoji: '🦷', value: -80 },
    { id: 'ring',      emoji: '💍', value: 300 },
    { id: 'bear',      emoji: '🐻', value: 120 },
    { id: 'doll',      emoji: '🪆', value: -200 },
    { id: 'stamps',    emoji: '📮', value: 180 },
    { id: 'wig',       emoji: '💇', value: 10 },
    { id: 'silver',    emoji: '🍴', value: 140 },
    { id: 'urn',       emoji: '⚱️', value: -120 },
    { id: 'map',       emoji: '🗺️', value: 220 },
    { id: 'duck',      emoji: '🦆', value: 5 },
    { id: 'egg',       emoji: '🥚', value: 350 },
    { id: 'musicbox',  emoji: '🎶', value: -60 },
    { id: 'sabre',     emoji: '🗡️', value: 160 },
    { id: 'skull',     emoji: '💀', value: 190 },
    { id: 'slippers',  emoji: '🥿', value: 15 },
    { id: 'gramophone',emoji: '📯', value: 130 }
  ];

  // Schätzfragen – Antworten
  const QUESTIONS = [
    { id: 'teeth', answer: 32 }, { id: 'eiffel', answer: 330 }, { id: 'wall', answer: 1989 },
    { id: 'bones', answer: 206 }, { id: 'eu', answer: 27 }, { id: 'piano', answer: 88 },
    { id: 'minutes', answer: 1440 }, { id: 'octopus', answer: 3 }, { id: 'istanbul', answer: 16 },
    { id: 'glockner', answer: 3798 }, { id: 'republic', answer: 1923 }, { id: 'chess', answer: 64 },
    { id: 'viennaist', answer: 1255 }, { id: 'seconds', answer: 3600 }, { id: 'states', answer: 9 },
    { id: 'uno', answer: 108 }, { id: 'whale', answer: 180 }, { id: 'greece', answer: 6000 },
    { id: 'blood', answer: 5 }, { id: 'ararat', answer: 5137 }, { id: 'bosphorus', answer: 3 },
    { id: 'moon', answer: 384400 }, { id: 'danube', answer: 2850 }, { id: 'heart', answer: 100000 },
    { id: 'ants', answer: 6 }, { id: 'mozart', answer: 1756 }, { id: 'turkeycities', answer: 81 },
    { id: 'football', answer: 105 }
  ];

  /*
   * 100 Testamentsklauseln. fx-Schlüssel:
   *  mult {raum|all: faktor}  closed [räume]  noCards  now/after + n  vote (Betrag)
   *  forceBlackout bedroomTwo vaultShare vaultAlarmAt thiefMult extMult game duelAll bonus {raum: betrag}
   *  kitchenPoison reverseDuel maxCards gardenPot mirror cellarNoLoss ghostMult noDuels libraryTwo
   *  gardenUnsafe heirloomKind ('cursed'|'blessed') role (für roleHint) req final
   */
  const CLAUSES = [
    { id: 'vault_double',    fx: { mult: { vault: 2 } } },
    { id: 'kitchen_reno',    fx: { closed: ['kitchen'] } },
    { id: 'tax',             fx: { now: 'tax', n: 40 } },
    { id: 'robin',           fx: { now: 'robin', n: 100 } },
    { id: 'pity',            fx: { now: 'pity', n: 150 } },
    { id: 'lawyer_sleeps',   fx: { noCards: true } },
    { id: 'xmas',            fx: { now: 'everyoneCard' } },
    { id: 'pass_left',       fx: { now: 'passHands' } },
    { id: 'lonely',          fx: { after: 'alone', n: 70 } },
    { id: 'crowd',           fx: { after: 'crowd', n: 40 } },
    { id: 'cellar_mood',     fx: { mult: { cellar: 2 } } },
    { id: 'garden_bloom',    fx: { mult: { garden: 5 } } },
    { id: 'silence',         fx: { vote: -80 } },
    { id: 'compliment',      fx: { vote: 100 } },
    { id: 'accent',          fx: { vote: -60 } },
    { id: 'suspicious',      fx: { vote: -70 } },
    { id: 'favorite',        fx: { vote: 120 } },
    { id: 'storm',           fx: { forceBlackout: true } },
    { id: 'house_arrest',    fx: { closed: ['kitchen', 'library', 'bedroom', 'attic', 'ballroom'] } },
    { id: 'two_heirlooms',   fx: { bedroomTwo: true } },
    { id: 'envy_tax',        fx: { now: 'richTax', n: 60 } },
    { id: 'poltergeist',     fx: { now: 'heirloomShuffle', req: 'heirlooms' } },
    { id: 'whisper',         fx: { now: 'butlerHint', req: 'butler' } },
    { id: 'seance',          fx: { now: 'seance', n: 120, req: 'ghosts' } },
    { id: 'piggy',           fx: { now: 'allPlus', n: 50 } },
    { id: 'swap',            fx: { now: 'swapRichPoor' } },
    { id: 'broken_alarm',    fx: { vaultShare: 400 } },
    { id: 'thieves_night',   fx: { thiefMult: 2 } },
    { id: 'quiz_night',      fx: { game: 'estimate' } },
    { id: 'tap_fever',       fx: { game: 'tap' } },
    { id: 'family_feud',     fx: { duelAll: 80 } },
    { id: 'sticky',          fx: { after: 'sticky', n: 40 } },
    { id: 'prophecy',        fx: { after: 'mostCrowded', n: 50 } },
    { id: 'secret_tip',      fx: { after: 'leastCrowded', n: 80 } },
    { id: 'library_cash',    fx: { bonus: { library: 120 } } },
    { id: 'spoiled_food',    fx: { kitchenPoison: true } },
    { id: 'upside_down',     fx: { reverseDuel: true } },
    { id: 'family_duty',     fx: { now: 'payLeft', n: 10 } },
    { id: 'card_magic',      fx: { maxCards: 2 } },
    { id: 'inventory',       fx: { now: 'heirloomTax', n: 30, req: 'heirlooms' } },
    { id: 'even_luck',       fx: { now: 'evenMoney', n: 60 } },
    { id: 'hum',             fx: { vote: 100 } },
    { id: 'drama',           fx: { vote: 90 } },
    { id: 'alibi',           fx: { vote: -70 } },
    { id: 'gold_rush',       fx: { mult: { vault: 3 }, vaultAlarmAt: 2 } },
    { id: 'garden_party',    fx: { gardenPot: 250 } },
    { id: 'honesty',         fx: { after: 'noCardBonus', n: 50 } },
    { id: 'consolation',     fx: { now: 'poorCards' } },
    { id: 'mirror',          fx: { mirror: true } },
    /* ---- 50 neue Klauseln ---- */
    { id: 'cake',            fx: { now: 'allPlus', n: 30 } },
    { id: 'lottery',         fx: { now: 'lottery', n: 200 } },
    { id: 'birthday',        fx: { now: 'birthday', n: 20 } },
    { id: 'cat_ate_cards',   fx: { now: 'cardTax' } },
    { id: 'pawnshop',        fx: { now: 'pawn', n: 25 } },
    { id: 'card_storm',      fx: { now: 'shuffleHands' } },
    { id: 'innocent',        fx: { now: 'innocent', req: 'innocent' } },
    { id: 'cat_hint',        fx: { now: 'roleHint', role: 'cat', req: 'cat' } },
    { id: 'kid_hint',        fx: { now: 'roleHint', role: 'kid', req: 'kid' } },
    { id: 'clown_hint',      fx: { now: 'roleHint', role: 'clown', req: 'clown' } },
    { id: 'swap_random',     fx: { now: 'swapRandom' } },
    { id: 'peace',           fx: { now: 'peace', n: 25 } },
    { id: 'poor_heirloom',   fx: { now: 'poorHeirloom' } },
    { id: 'small_savers',    fx: { now: 'smallSavers', n: 100 } },
    { id: 'empty_vault',     fx: { mult: { vault: 0 } } },
    { id: 'kitchen_feast',   fx: { bonus: { kitchen: 60 } } },
    { id: 'cellar_safe',     fx: { cellarNoLoss: true } },
    { id: 'lazy_alarm',      fx: { vaultAlarmAt: 4 } },
    { id: 'ghost_party',     fx: { ghostMult: 2, req: 'ghosts' } },
    { id: 'ceasefire',       fx: { noDuels: true } },
    { id: 'gossip',          fx: { libraryTwo: true } },
    { id: 'extortion_season',fx: { extMult: 2 } },
    { id: 'garden_fence',    fx: { gardenUnsafe: true } },
    { id: 'card_chaos',      fx: { maxCards: 3 } },
    { id: 'fair',            fx: { game: 'balloon' } },
    { id: 'brain_day',       fx: { game: 'memory' } },
    { id: 'tax_audit',       fx: { game: 'math' } },
    { id: 'party',           fx: { after: 'crowdBonus', n: 50 } },
    { id: 'pairs',           fx: { after: 'pairs', n: 60 } },
    { id: 'loner_tax',       fx: { after: 'aloneTax', n: 50 } },
    { id: 'reading',         fx: { closed: ['library'], bonus: { garden: 40 } } },
    { id: 'cursed_bed',      fx: { heirloomKind: 'cursed' } },
    { id: 'blessed_bed',     fx: { heirloomKind: 'blessed' } },
    { id: 'refund',          fx: { now: 'percent', n: 10 } },
    { id: 'inflation',       fx: { now: 'percent', n: -15 } },
    { id: 'anti_robin',      fx: { now: 'antiRobin', n: 80 } },
    { id: 'lucky_seven',     fx: { now: 'digit7', n: 77 } },
    { id: 'joke',            fx: { vote: 100 } },
    { id: 'eulogy',          fx: { vote: 90 } },
    { id: 'animal',          fx: { vote: 80 } },
    { id: 'greedy',          fx: { vote: -90 } },
    { id: 'liar',            fx: { vote: -80 } },
    { id: 'dance',           fx: { vote: 100 } },
    { id: 'poem',            fx: { vote: 100 } },
    { id: 'slimer',          fx: { vote: -70 } },
    { id: 'hero',            fx: { vote: 120 } },
    { id: 'villain',         fx: { vote: -100 } },
    { id: 'language',        fx: { vote: 90 } },
    { id: 'story',           fx: { vote: 100 } },
    { id: 'pose',            fx: { vote: 80 } },
    /* ---- Selfie-Klauseln: alle machen ein Foto, dann wird abgestimmt ---- */
    { id: 'selfie_teeth',    fx: { vote: 100, selfie: true } },
    { id: 'selfie_rich',     fx: { vote: 100, selfie: true } },
    { id: 'selfie_guilty',   fx: { vote: 100, selfie: true } },
    { id: 'selfie_ghost',    fx: { vote: 100, selfie: true } },
    { id: 'selfie_notary',   fx: { vote: 100, selfie: true } },
    { id: 'finale',          fx: { mult: { all: 3 }, final: true } }
  ];

  /*
   * 14 Minispiele für den Familienstreit.
   * time = Sekunden, die der Server wartet; play = Sekunden auf dem Handy
   * better: high (mehr ist besser), low (weniger ist besser), close (nah an pd.target), unique (höchste einzigartige Zahl)
   */
  const DUELS = {
    tap:       { emoji: '👆', time: 8,  play: 5.5, better: 'high' },
    reaction:  { emoji: '🤠', time: 11, play: 0,   better: 'low' },
    estimate:  { emoji: '🤔', time: 21, play: 0,   better: 'close' },
    stopwatch: { emoji: '⏱️', time: 14, play: 0,   better: 'close' },
    memory:    { emoji: '🧠', time: 30, play: 26,  better: 'high' },
    math:      { emoji: '🧮', time: 19, play: 15,  better: 'high' },
    balloon:   { emoji: '🎈', time: 19, play: 15,  better: 'high' },
    colorword: { emoji: '🎨', time: 19, play: 15,  better: 'high' },
    mole:      { emoji: '🔨', time: 19, play: 15,  better: 'high' },
    count:     { emoji: '🪙', time: 20, play: 0,   better: 'close' },
    safe:      { emoji: '🔐', time: 31, play: 27,  better: 'low' },
    oddone:    { emoji: '🔍', time: 19, play: 15,  better: 'high' },
    arrows:    { emoji: '⬆️', time: 19, play: 15,  better: 'high' },
    unique:    { emoji: '🤑', time: 16, play: 0,   better: 'unique' }
  };

  // Familien mit Wappen und Farbe (Namen stehen in i18n: fam.<id>)
  const FAMILIES = [
    { id: 0, emoji: '🦷', color: '#e0525a' },
    { id: 1, emoji: '🥙', color: '#f0a23b' },
    { id: 2, emoji: '🥿', color: '#4a90e2' },
    { id: 3, emoji: '🍯', color: '#6cc36a' },
    { id: 4, emoji: '🦊', color: '#d667c4' },
    { id: 5, emoji: '🧦', color: '#3fb8b0' }
  ];

  // Plot-Twists: unerwartete Ereignisse zwischen den Runden
  const TWISTS = {
    otto_alive:     { emoji: '⚰️' },
    tax_raid:       { emoji: '🚔', interactive: 'hide' },
    second_will:    { emoji: '📜' },
    earthquake:     { emoji: '🌋' },
    role_swap:      { emoji: '🎭' },
    treasure_hunt:  { emoji: '🗝️', interactive: 'tap' },
    vultures:       { emoji: '🦅' },
    cousin_america: { emoji: '🤠' }
  };
  // Foto-Streiche für Verlierer (eine Runde lang)
  const PRANKS = ['nose', 'stache', 'shades', 'tp'];
  // Sabotage, die Zuschauer auf Duellanten werfen können
  const SABOTAGE = { tomato: { emoji: '🍅' }, quake: { emoji: '📳' }, fog: { emoji: '🌫️' }, flip: { emoji: '🙃' } };
  const SABOTAGE_MAX = 3;
  // Versprechen für Verträge (eigener Text ist auch möglich)
  const PROMISES = ['noVault', 'noCard', 'noVote', 'sameRoom', 'noTheft'];
  // Preisverleihung: Statistik → Auszeichnung
  const AWARDS = [
    { id: 'robbed', emoji: '🥀' }, { id: 'chat', emoji: '💬' }, { id: 'cellar', emoji: '🪜' }, { id: 'banana', emoji: '🍌' },
    { id: 'duelWin', emoji: '⚔️' }, { id: 'sabThrown', emoji: '🍅' }, { id: 'sabGot', emoji: '🎯' }, { id: 'betProfit', emoji: '🎰' },
    { id: 'broken', emoji: '🐍' }, { id: 'cards', emoji: '🃏' }, { id: 'ghostRounds', emoji: '👻' }, { id: 'auctionSpent', emoji: '🔨' }
  ];

  const AVATARS = ['🦊','🐸','🦉','🐷','🐵','🦄','🐙','🦁','🐼','🐔','🦖','🐢','🐝','🦩','🐨','🐺','🦔','🐳'];
  const COLORS = ['#e0525a','#f0a23b','#e6d14a','#6cc36a','#3fb8b0','#4a90e2','#8a6fe0','#d667c4',
                  '#f07f59','#a3d94f','#5bd1e8','#c9a0ff','#ff8fab','#b8865a','#9fb3c8'];

  const byId = arr => Object.fromEntries(arr.map(x => [x.id, x]));
  const data = {
    START_MONEY, HAND_MAX, ROOMS, BASE_ROOMS, BIG_ROOMS, CARDS, CARD_POOL, ROLES,
    HEIRLOOMS, HEIRLOOM_BY_ID: byId(HEIRLOOMS), QUESTIONS, QUESTION_BY_ID: byId(QUESTIONS),
    CLAUSES, CLAUSE_BY_ID: byId(CLAUSES), AVATARS, COLORS, FAMILIES,
    TWISTS, PRANKS, SABOTAGE, SABOTAGE_MAX, PROMISES, AWARDS, ROLE_UNLOCK, DUELS,
    DUEL_TYPES: Object.keys(DUELS)
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.OTTO_DATA = data;
})(this);
