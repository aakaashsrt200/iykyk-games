// Shared deck utilities used by both solo and multiplayer Blackjack

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function buildDeck(numDecks = 6) {
  const cards = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ suit, rank, red: suit === '♥' || suit === '♦' });
      }
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

export function handScore(hand) {
  let total = 0, aces = 0;
  for (const card of hand) {
    if (card.hidden) continue;
    if (card.rank === 'A')                      { total += 11; aces++; }
    else if (['J', 'Q', 'K'].includes(card.rank)) total += 10;
    else                                          total += parseInt(card.rank, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export function isBlackjack(hand) {
  return hand.length === 2 && handScore(hand) === 21;
}
