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
    extortion: { emoji: '💼', target: null }
  };
  const CARD_WEIGHTS = { banana: 4, thief: 4, forgery: 3, lawyer: 3, blackout: 1, lure: 3, tape: 2, gift: 2, extortion: 3 };
  const CARD_POOL = [];
  Object.keys(CARD_WEIGHTS).forEach(k => { for (let i = 0; i < CARD_WEIGHTS[k]; i++) CARD_POOL.push(k); });

  const ROLES = {
    relative: { emoji: '🤑' },
    butler:   { emoji: '🤵' },
    kid:      { emoji: '👶' },
    cat:      { emoji: '🐈‍⬛' }
  };

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
   * 50 Testamentsklauseln. fx-Schlüssel:
   *  mult {raum|all: faktor}  closed [räume]  noCards  now/after + n  vote (Betrag)
   *  forceBlackout bedroomTwo vaultShare vaultAlarmAt thiefMult game duelAll bonus
   *  kitchenPoison reverseDuel maxCards gardenPot mirror req final
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
    { id: 'finale',          fx: { mult: { all: 3 }, final: true } }
  ];

  const AVATARS = ['🦊','🐸','🦉','🐷','🐵','🦄','🐙','🦁','🐼','🐔','🦖','🐢','🐝','🦩','🐨','🐺','🦔','🐳'];
  const COLORS = ['#e0525a','#f0a23b','#e6d14a','#6cc36a','#3fb8b0','#4a90e2','#8a6fe0','#d667c4',
                  '#f07f59','#a3d94f','#5bd1e8','#c9a0ff','#ff8fab','#b8865a','#9fb3c8'];

  const byId = arr => Object.fromEntries(arr.map(x => [x.id, x]));
  const data = {
    START_MONEY, HAND_MAX, ROOMS, BASE_ROOMS, BIG_ROOMS, CARDS, CARD_POOL, ROLES,
    HEIRLOOMS, HEIRLOOM_BY_ID: byId(HEIRLOOMS), QUESTIONS, QUESTION_BY_ID: byId(QUESTIONS),
    CLAUSES, CLAUSE_BY_ID: byId(CLAUSES), AVATARS, COLORS,
    DUEL_TYPES: ['tap', 'reaction', 'estimate', 'stopwatch']
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.OTTO_DATA = data;
})(this);
