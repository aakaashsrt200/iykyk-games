// ─── Poker utilities: deck, hand eval, AI ─────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const RANK_VALUE = {};
RANKS.forEach((r, i) => { RANK_VALUE[r] = i + 2; }); // 2=2 … A=14

export function buildPokerDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        rank,
        suit,
        value: RANK_VALUE[rank],
        red: suit === '♥' || suit === '♦',
        hidden: false,
      });
    }
  }
  return shuffle(cards);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Hand evaluation ──────────────────────────────────────────────────────────
// Returns { rank: 0-8, name, tiebreakers: number[] }
// rank 8 = Royal Flush, 0 = High Card

const HAND_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
  'Straight', 'Flush', 'Full House', 'Four of a Kind',
  'Straight Flush', /* 8 */ 'Royal Flush', /* treated as SF */
];

function evalFiveCards(cards) {
  // cards: array of 5 {rank, suit, value}
  const vals = cards.map(c => c.value).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const rankCounts = {};
  for (const v of vals) rankCounts[v] = (rankCounts[v] || 0) + 1;

  const counts = Object.entries(rankCounts)
    .map(([v, c]) => ({ v: Number(v), c }))
    .sort((a, b) => b.c - a.c || b.v - a.v);

  const isFlush = suits.every(s => s === suits[0]);

  // Straight check (including A-low: A2345)
  let isStraight = false;
  let straightHigh = 0;
  const uniqueVals = [...new Set(vals)];
  if (uniqueVals.length === 5) {
    if (uniqueVals[0] - uniqueVals[4] === 4) {
      isStraight = true;
      straightHigh = uniqueVals[0];
    } else if (JSON.stringify(uniqueVals) === JSON.stringify([14, 5, 4, 3, 2])) {
      isStraight = true;
      straightHigh = 5; // wheel
    }
  }

  if (isFlush && isStraight) {
    const isRoyal = straightHigh === 14;
    return { rank: 8, name: isRoyal ? 'Royal Flush' : 'Straight Flush', tiebreakers: [straightHigh] };
  }
  if (counts[0].c === 4) {
    return { rank: 7, name: 'Four of a Kind', tiebreakers: [counts[0].v, counts[1].v] };
  }
  if (counts[0].c === 3 && counts[1].c === 2) {
    return { rank: 6, name: 'Full House', tiebreakers: [counts[0].v, counts[1].v] };
  }
  if (isFlush) {
    return { rank: 5, name: 'Flush', tiebreakers: vals };
  }
  if (isStraight) {
    return { rank: 4, name: 'Straight', tiebreakers: [straightHigh] };
  }
  if (counts[0].c === 3) {
    const kickers = counts.slice(1).map(x => x.v);
    return { rank: 3, name: 'Three of a Kind', tiebreakers: [counts[0].v, ...kickers] };
  }
  if (counts[0].c === 2 && counts[1].c === 2) {
    const kicker = counts[2].v;
    return { rank: 2, name: 'Two Pair', tiebreakers: [counts[0].v, counts[1].v, kicker] };
  }
  if (counts[0].c === 2) {
    const kickers = counts.slice(1).map(x => x.v);
    return { rank: 1, name: 'Pair', tiebreakers: [counts[0].v, ...kickers] };
  }
  return { rank: 0, name: 'High Card', tiebreakers: vals };
}

// C(n,5) combinations
function combinations5(arr) {
  const result = [];
  const n = arr.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++)
            result.push([arr[a], arr[b], arr[c], arr[d], arr[e]]);
  return result;
}

export function bestHand(holeCards, communityCards) {
  const all = [...holeCards, ...communityCards];
  if (all.length < 5) return { rank: -1, name: '—', tiebreakers: [] };
  const combos = combinations5(all);
  let best = null;
  for (const combo of combos) {
    const ev = evalFiveCards(combo);
    if (!best || compareHands(ev, best) > 0) best = ev;
  }
  return best;
}

// returns positive if a > b
export function compareHands(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const diff = (a.tiebreakers[i] || 0) - (b.tiebreakers[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ─── Winner determination ─────────────────────────────────────────────────────

export function determineWinners(players, communityCards) {
  // players: [{id, name, holeCards, folded}]
  const active = players.filter(p => !p.folded);
  if (active.length === 1) return [active[0].id];

  const evaluated = active.map(p => ({
    id: p.id,
    hand: bestHand(p.holeCards, communityCards),
  }));

  evaluated.sort((a, b) => compareHands(b.hand, a.hand));
  const best = evaluated[0].hand;
  const winners = evaluated.filter(e => compareHands(e.hand, best) === 0);
  return winners.map(w => w.id);
}

// ─── Preflop hand strength ────────────────────────────────────────────────────
// Returns 0-1 score for 2 hole cards

export function preflopStrength(holeCards) {
  const [a, b] = holeCards.map(c => c.value).sort((x, y) => y - x);
  const suited = holeCards[0].suit === holeCards[1].suit;
  const paired = a === b;

  if (paired) {
    if (a >= 13) return 0.95; // AA KK
    if (a >= 11) return 0.85; // QQ JJ
    if (a >= 9)  return 0.72; // TT 99
    if (a >= 7)  return 0.55; // 88 77
    return 0.40;
  }
  const gap = a - b;
  let base = (a + b) / 28; // 0–1 rough
  if (suited) base += 0.06;
  if (gap === 1) base += 0.04; // connectors
  if (a === 14) base += 0.08; // ace
  return Math.min(0.9, Math.max(0.05, base));
}

// ─── AI decision ──────────────────────────────────────────────────────────────
// Returns { action: 'fold'|'check'|'call'|'raise', amount? }

export function aiDecide({ holeCards, communityCards, toCall, pot, chips, phase, bigBlind }) {
  // Blend preflop strength with current hand rank for post-flop
  const pre = preflopStrength(holeCards);
  let strength = pre;

  if (communityCards.length >= 3) {
    const hand = bestHand(holeCards, communityCards);
    // Map hand rank 0-8 → 0-1
    const postStrength = hand.rank / 8;
    // Blend: later streets trust hand rank more
    const weight = communityCards.length === 3 ? 0.5 : communityCards.length === 4 ? 0.7 : 0.85;
    strength = pre * (1 - weight) + postStrength * weight;
  }

  // Add noise so AI isn't deterministic
  const noise = (Math.random() - 0.5) * 0.15;
  strength = Math.max(0, Math.min(1, strength + noise));

  const canCheck = toCall === 0;
  const raiseAmount = Math.max(bigBlind * 2, Math.floor(pot * 0.6));

  if (strength < 0.25) {
    return canCheck ? { action: 'check' } : { action: 'fold' };
  }
  if (strength < 0.45) {
    return canCheck ? { action: 'check' } : { action: 'call' };
  }
  if (strength < 0.65) {
    if (canCheck) {
      // Occasionally bet even on check
      if (Math.random() < 0.35 && chips >= raiseAmount) {
        return { action: 'raise', amount: raiseAmount };
      }
      return { action: 'check' };
    }
    return chips >= toCall ? { action: 'call' } : { action: 'fold' };
  }
  // Strong hand
  if (chips >= raiseAmount && Math.random() < 0.7) {
    return { action: 'raise', amount: raiseAmount };
  }
  return canCheck ? { action: 'check' } : (chips >= toCall ? { action: 'call' } : { action: 'fold' });
}
