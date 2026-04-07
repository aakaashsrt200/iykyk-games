// ─── Judgement (Kachuful) — pure game logic ───────────────────────────────────

export const SUITS = ['spades', 'diamonds', 'clubs', 'hearts'];
export const SUIT_SYMBOLS = { spades: '♠', diamonds: '♦', clubs: '♣', hearts: '♥' };
export const SUIT_NAMES = { spades: 'Spades', diamonds: 'Diamonds', clubs: 'Clubs', hearts: 'Hearts' };
export const SUIT_COLORS = { spades: 'black', diamonds: 'red', clubs: 'black', hearts: 'red' };
export const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
export const RANK_VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

export const TIMER_MS = 45000;
export const TRICK_PAUSE_MS = 2500;
export const ROUND_PAUSE_MS = 5000;

// ─── Deck ─────────────────────────────────────────────────────────────────────
export function buildDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank });
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Round sequence ───────────────────────────────────────────────────────────
export function maxHandSize(playerCount) {
  return Math.floor(52 / Math.max(playerCount, 2));
}

export function buildRoundSequence(playerCount) {
  const max = maxHandSize(playerCount);
  const up   = Array.from({ length: max },     (_, i) => i + 1);
  const down = Array.from({ length: max - 1 }, (_, i) => max - 1 - i);
  return [...up, ...down];
}

// ─── Trump rotation: Spades → Diamonds → Clubs → Hearts ──────────────────────
export function getTrumpSuit(trumpIdx) { return SUITS[trumpIdx % 4]; }
export function nextTrumpIdx(current)  { return (current + 1) % 4; }

// ─── Seat helpers ─────────────────────────────────────────────────────────────
// Returns the next active seat after `seat` (wrapping), skipping `skip` seats
export function seatAfter(seat, seats, skip = 0) {
  const sorted = Object.keys(seats)
    .map(Number)
    .filter(s => seats[s]?.active)
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  let idx = sorted.indexOf(Number(seat));
  if (idx === -1) idx = sorted.length - 1; // fallback
  for (let i = 0; i <= skip; i++) idx = (idx + 1) % sorted.length;
  return sorted[idx];
}

export function firstBidder(dealerSeat, seats) {
  return seatAfter(dealerSeat, seats, 0);
}

export function activeSeatList(seats) {
  return Object.keys(seats)
    .map(Number)
    .filter(s => seats[s]?.active)
    .sort((a, b) => a - b);
}

// ─── Trick resolution ─────────────────────────────────────────────────────────
// trick.cards = [{ seat, card: { suit, rank } }, ...]
export function determineTrickWinner(trickCards, ledSuit, trumpSuit) {
  if (!trickCards.length) return null;
  let winner = trickCards[0];
  for (let i = 1; i < trickCards.length; i++) {
    const challenger = trickCards[i];
    const w = winner.card;
    const c = challenger.card;
    const wTrump = w.suit === trumpSuit;
    const cTrump = c.suit === trumpSuit;
    if (cTrump && !wTrump) {
      winner = challenger;
    } else if (cTrump && wTrump) {
      if (RANK_VALUES[c.rank] > RANK_VALUES[w.rank]) winner = challenger;
    } else if (!cTrump && !wTrump) {
      if (c.suit === ledSuit && w.suit !== ledSuit) winner = challenger;
      else if (c.suit === ledSuit && w.suit === ledSuit) {
        if (RANK_VALUES[c.rank] > RANK_VALUES[w.rank]) winner = challenger;
      }
    }
  }
  return winner.seat;
}

// ─── Valid card check (trump-suit-only following rule) ────────────────────────
export function validCardsToPlay(hand, ledSuit, trumpSuit) {
  if (!ledSuit) return hand; // leading — anything goes
  if (ledSuit === trumpSuit) {
    const hasTrump = hand.some(c => c.suit === trumpSuit);
    if (hasTrump) return hand.filter(c => c.suit === trumpSuit);
  }
  return hand; // non-trump led — play anything
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
export function scoreRound(bid, tricksWon) {
  if (bid === null) return 0; // missed round (disconnected)
  return bid === tricksWon ? 10 + bid : 0;
}

// ─── Dealer bid restriction ────────────────────────────────────────────────────
// Dealer cannot bid such that total bids == hand size
// Returns list of forbidden bids for dealer
export function dealerForbiddenBid(bidsTotal, handSize) {
  const forbidden = handSize - bidsTotal;
  if (forbidden < 0 || forbidden > handSize) return null;
  return forbidden;
}

// ─── Initial game state builder ───────────────────────────────────────────────
export function buildInitialGameState(activePlayers, firstDealerSeat) {
  const seats = {};
  activePlayers.forEach(p => {
    seats[p.seat] = {
      player_id: p.id,
      hand: [],
      bid: null,
      tricks_won: 0,
      active: true,
    };
  });
  const playerCount = activePlayers.length;
  const roundSeq    = buildRoundSequence(playerCount);
  const scores      = {};
  activePlayers.forEach(p => { scores[p.seat] = 0; });

  return {
    phase:        'dealing',
    round_seq:    roundSeq,
    round_idx:    0,
    hand_size:    roundSeq[0],
    trump_idx:    0,
    trump_suit:   SUITS[0],
    dealer_seat:  firstDealerSeat,
    active_seat:  null,
    timer_start:  null,
    seats,
    bids_total:   0,
    trick: { cards: [], led_suit: null, winner: null, resolved_at: null },
    trick_count:  0,
    scores,
    round_history: [],
  };
}
