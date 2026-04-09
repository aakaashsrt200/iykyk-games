import React from 'react';
import GameCard from './GameCard';

const LIVE_GAMES = [
  {
    id: 1,
    name: 'Poker',
    suit: '♠',
    suitColor: 'white',
    caption: 'Strategy & Bluff',
    description: "The definitive game of skill, psychology, and nerve. Read your opponents, bluff your way to glory, and take the pot.",
    players: '3',
    accentColor: '#f4c542',
    disabled: false,
    beta: true,
    path: '/games/poker',
    rules: {
      title: "How to Play Poker (Texas Hold'em)",
      points: [
        "Each player receives 2 private hole cards; 5 community cards are dealt face-up over 3 rounds (Flop, Turn, River)",
        "Make the best 5-card hand using any combination of your hole cards and the community cards",
        "Hand rankings (best to worst): Royal Flush · Straight Flush · Four of a Kind · Full House · Flush · Straight · Three of a Kind · Two Pair · Pair · High Card",
        "Bet, call, raise, or fold in each betting round",
        "Last player standing or best hand at showdown wins the pot",
      ],
    },
  },
  {
    id: 2,
    name: 'Blackjack',
    suit: '♦',
    suitColor: 'red',
    caption: 'Beat the Dealer',
    description: "Beat the dealer to 21 without busting. Simple on the surface, deep in strategy — the casino classic refined.",
    players: '1–8',
    accentColor: '#e63946',
    disabled: false,
    path: '/games/blackjack',
    multiplayerPath: '/rooms',
    rules: {
      title: 'How to Play Blackjack',
      points: [
        'Goal: get closer to 21 than the dealer without busting (going over 21)',
        'Number cards = face value · Face cards (J/Q/K) = 10 · Ace = 1 or 11',
        'Hit to take another card · Stand to keep your hand',
        'Dealer must hit on 16 or below and stand on 17 or above',
        'Blackjack (Ace + any 10-value card on the initial deal) is an instant win',
        'In multiplayer, each player competes against the dealer independently',
      ],
    },
  },
  {
    id: 7,
    name: 'Judgement',
    suit: '♠',
    suitColor: 'white',
    caption: 'Trick-Taking',
    description: "Bid exactly right or score zero. Trick-taking with trump rotation, sequential bidding, and 45-second turns. Pure Kachuful.",
    players: '2–8',
    accentColor: '#a78bfa',
    disabled: false,
    multiplayerPath: '/games/judgement',
    multiplayerOnly: true,
    scorerPath: '/games/judgement/scorer',
    rules: {
      title: 'How to Play Judgement (Kachuful)',
      points: [
        'Each round, bid exactly how many tricks you\'ll win — not more, not less',
        'Score 10 + bid if your guess is exact · Score 0 if wrong',
        'Trump suit rotates every round: ♠ Spades → ♦ Diamonds → ♣ Clubs → ♥ Hearts',
        'When trump is led, you must follow with trump if you have it',
        'Dealer restriction: the dealer cannot bid such that total bids = hand size',
        'Rounds pyramid up and back: 1 card → max hand size → 1 card',
        '45 seconds per action — a default bid or play is made if time runs out',
      ],
    },
  },
];

const COMING_SOON_GAMES = [
  {
    id: 3,
    name: 'Teen Patti',
    suit: '♥',
    suitColor: 'red',
    caption: 'South Asian Poker',
    description: "South Asia's beloved card game. Three cards, one pot, and the boldest player wins. Pure heart and guts.",
    players: '3–6',
    accentColor: '#e63946',
    disabled: true,
    rules: {
      title: 'How to Play Teen Patti',
      points: [
        'Each player receives 3 cards; bet on having the best hand',
        'Hand rankings (best to worst): Trail/Set (3 of a kind) · Pure Sequence · Sequence · Color (flush) · Pair · High Card',
        'Play blind (without looking at your cards) or seen — blind bets are half the seen bet',
        'Betting continues until only 2 players remain, then a show is called',
        'Player with the highest hand wins the pot',
      ],
    },
  },
  {
    id: 4,
    name: 'Rummy',
    suit: '♣',
    suitColor: 'white',
    caption: 'Meld & Win',
    description: "Form melds and sequences before anyone else. A game of memory, planning, and tactical card management.",
    players: '2–6',
    accentColor: '#a78bfa',
    disabled: true,
    rules: {
      title: 'How to Play Rummy',
      points: [
        'Goal: form valid melds — sets (same rank) or sequences (consecutive cards of same suit)',
        'A set = 3–4 cards of the same rank · A sequence = 3+ cards of the same suit in order',
        'Each turn: draw one card from the deck or discard pile',
        'End your turn by discarding one card to the discard pile',
        'First player to meld all their cards and go out wins the round',
      ],
    },
  },
  {
    id: 5,
    name: 'Solitaire',
    suit: '♠',
    suitColor: 'white',
    caption: 'Solo Challenge',
    description: "The timeless solo challenge. Clear the tableau, build the foundations, and master the art of patience.",
    players: '1',
    accentColor: '#34d399',
    disabled: true,
    rules: {
      title: 'How to Play Solitaire (Klondike)',
      points: [
        'Goal: build 4 foundation piles (one per suit) from Ace up to King',
        'Move cards between 7 tableau columns — stack descending rank in alternating colors',
        'Only Kings (or stacks led by a King) may fill empty tableau columns',
        'Draw from the deck when you have no valid tableau moves',
        'Game is won when all 52 cards are moved to the four foundations',
      ],
    },
  },
  {
    id: 6,
    name: 'War',
    suit: '♦',
    suitColor: 'red',
    caption: 'Quick Battle',
    description: "Pure, chaotic card battle. Flip, compare, conquer. The fastest game in the deck — zero strategy, all adrenaline.",
    players: '2',
    accentColor: '#fb923c',
    disabled: true,
    rules: {
      title: 'How to Play War',
      points: [
        'Split the deck evenly between two players',
        'Each player flips their top card simultaneously — higher card wins both',
        'Ace is the highest card; suits are irrelevant',
        'On a tie (war): each player places 3 cards face-down and 1 face-up — higher face-up card wins all 10 cards',
        'The player who collects all 52 cards wins',
      ],
    },
  },
];

export default function GamesGrid() {
  return (
    <section className="games-section" id="games">
      <div className="container">

        <div className="games-section-group">
          <div className="games-group-header">
            <span className="games-group-dot" />
            <span className="games-group-label">Live Now</span>
          </div>
          <div className="games-grid">
            {LIVE_GAMES.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>

        <div className="games-section-group">
          <div className="games-group-header">
            <span className="games-group-label dim">Coming Soon</span>
          </div>
          <div className="games-grid">
            {COMING_SOON_GAMES.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
