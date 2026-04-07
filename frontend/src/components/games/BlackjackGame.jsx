import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/Blackjack.css';

// ─── Deck utilities ────────────────────────────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const NUM_DECKS = 6;

function buildDeck() {
  const cards = [];
  for (let d = 0; d < NUM_DECKS; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ suit, rank, red: suit === '♥' || suit === '♦' });
      }
    }
  }
  return shuffle(cards);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function handScore(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.hidden) continue;
    if (card.rank === 'A') { total += 11; aces++; }
    else if (['J', 'Q', 'K'].includes(card.rank)) total += 10;
    else total += parseInt(card.rank, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handScore(hand) === 21;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHIP_VALUES = [
  { value: 5,   label: '$5',   color: '#e63946' },
  { value: 10,  label: '$10',  color: '#3b82f6' },
  { value: 25,  label: '$25',  color: '#22c55e' },
  { value: 50,  label: '$50',  color: '#f97316' },
  { value: 100, label: '$100', color: '#a855f7' },
];

const STARTING_BALANCE = 1000;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BlackjackGame() {
  const navigate = useNavigate();

  const [deck, setDeck]           = useState(() => buildDeck());
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [phase, setPhase]         = useState('betting'); // betting | playing | result
  const [balance, setBalance]     = useState(STARTING_BALANCE);
  const [bet, setBet]             = useState(0);
  const [result, setResult]       = useState(null); // win | lose | push | blackjack | bust
  const [message, setMessage]     = useState('');
  const [canDouble, setCanDouble] = useState(false);

  // Reshuffle when deck runs low
  const getWorkingDeck = useCallback((d) => {
    if (d.length < 30) return buildDeck();
    return d;
  }, []);

  // ── Betting ──────────────────────────────────────────────────────────────────

  const addChip = (value) => {
    if (phase !== 'betting') return;
    if (bet + value > balance) return;
    setBet(b => b + value);
  };

  const clearBet = () => {
    if (phase !== 'betting') return;
    setBet(0);
  };

  const maxBet = () => {
    if (phase !== 'betting') return;
    setBet(balance);
  };

  // ── Deal ─────────────────────────────────────────────────────────────────────

  const deal = () => {
    if (bet === 0 || phase !== 'betting') return;

    let d = getWorkingDeck([...deck]);

    const p1 = d.pop();
    const d1 = d.pop();
    const p2 = d.pop();
    const d2 = { ...d.pop(), hidden: true };

    const pHand = [p1, p2];
    const dHand = [d1, d2];

    setDeck(d);
    setPlayerHand(pHand);
    setDealerHand(dHand);
    setBalance(b => b - bet);
    setResult(null);
    setMessage('');

    // Check player blackjack
    if (isBlackjack(pHand)) {
      const fullDealer = [d1, { ...d2, hidden: false }];
      setDealerHand(fullDealer);
      if (isBlackjack(fullDealer)) {
        setBalance(b => b + bet);
        setMessage("Push — both have Blackjack!");
        setResult('push');
      } else {
        const payout = Math.floor(bet * 2.5);
        setBalance(b => b + payout);
        setMessage(`♦ Blackjack! +$${payout - bet}`);
        setResult('blackjack');
      }
      setPhase('result');
      return;
    }

    setCanDouble(balance - bet >= bet);
    setPhase('playing');
  };

  // ── Settle ───────────────────────────────────────────────────────────────────

  const settle = useCallback((pHand, dHand, currentBet) => {
    const pScore = handScore(pHand);
    const dScore = handScore(dHand);

    if (dScore > 21) {
      setBalance(b => b + currentBet * 2);
      setMessage(`Dealer busts (${dScore})! You win +$${currentBet}`);
      setResult('win');
    } else if (pScore > dScore) {
      setBalance(b => b + currentBet * 2);
      setMessage(`You win! ${pScore} vs ${dScore} (+$${currentBet})`);
      setResult('win');
    } else if (dScore > pScore) {
      setMessage(`Dealer wins. ${dScore} vs ${pScore}`);
      setResult('lose');
    } else {
      setBalance(b => b + currentBet);
      setMessage(`Push — both have ${pScore}`);
      setResult('push');
    }
    setPhase('result');
  }, []);

  // ── Dealer play ───────────────────────────────────────────────────────────────

  const dealerPlay = useCallback((pHand, d, currentBet) => {
    let dHand = dealerHand.map(c => ({ ...c, hidden: false }));
    let workDeck = [...d];

    while (handScore(dHand) < 17) {
      dHand = [...dHand, workDeck.pop()];
    }

    setDeck(workDeck);
    setDealerHand(dHand);
    settle(pHand, dHand, currentBet);
  }, [dealerHand, settle]);

  // ── Stand ────────────────────────────────────────────────────────────────────

  const stand = useCallback((pHand = null, d = null, currentBet = null) => {
    if (phase !== 'playing' && pHand === null) return;
    dealerPlay(pHand || playerHand, d || deck, currentBet ?? bet);
  }, [phase, playerHand, deck, bet, dealerPlay]);

  // ── Hit ──────────────────────────────────────────────────────────────────────

  const hit = () => {
    if (phase !== 'playing') return;
    const d = [...deck];
    const card = d.pop();
    const newHand = [...playerHand, card];

    setDeck(d);
    setPlayerHand(newHand);
    setCanDouble(false);

    const score = handScore(newHand);
    if (score > 21) {
      setMessage(`Bust! You went over 21 (${score})`);
      setResult('bust');
      setPhase('result');
    } else if (score === 21) {
      dealerPlay(newHand, d, bet);
    }
  };

  // ── Double Down ───────────────────────────────────────────────────────────────

  const doubleDown = () => {
    if (phase !== 'playing' || !canDouble) return;
    const newBet = bet * 2;
    setBalance(b => b - bet);
    setBet(newBet);

    const d = [...deck];
    const card = d.pop();
    const newHand = [...playerHand, card];

    setDeck(d);
    setPlayerHand(newHand);
    setCanDouble(false);

    const score = handScore(newHand);
    if (score > 21) {
      setMessage(`Bust! You went over 21 (${score})`);
      setResult('bust');
      setPhase('result');
    } else {
      dealerPlay(newHand, d, newBet);
    }
  };

  // ── New Hand ──────────────────────────────────────────────────────────────────

  const newHand = () => {
    if (balance === 0) setBalance(STARTING_BALANCE);
    setBet(0);
    setPlayerHand([]);
    setDealerHand([]);
    setResult(null);
    setMessage('');
    setCanDouble(false);
    setPhase('betting');
  };

  // ── Derived display ───────────────────────────────────────────────────────────

  const playerScore = playerHand.length ? handScore(playerHand) : null;
  const dealerVisible = dealerHand.filter(c => !c.hidden);
  const dealerScore = dealerVisible.length ? handScore(dealerVisible) : null;
  const dealerFullScore = dealerHand.length ? handScore(dealerHand.map(c => ({ ...c, hidden: false }))) : null;

  const showFullDealerScore = phase === 'result';

  return (
    <div className="bj-page">
      {/* ── Header ── */}
      <header className="bj-header">
        <button className="bj-back" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="bj-title-block">
          <span className="bj-title-suit">♦</span>
          <h1 className="bj-title">Blackjack</h1>
        </div>
        <div className="bj-balance">
          <span className="bj-balance-label">Balance</span>
          <span className="bj-balance-value">${balance}</span>
        </div>
      </header>

      {/* ── Table ── */}
      <div className="bj-table">
        <div className="bj-table-inner">

          {/* Dealer area */}
          <div className="bj-zone dealer-zone">
            <div className="bj-zone-label">
              Dealer
              {dealerScore !== null && (
                <span className="bj-score">
                  {showFullDealerScore ? dealerFullScore : dealerScore}
                  {!showFullDealerScore && dealerHand.some(c => c.hidden) && '+?'}
                </span>
              )}
            </div>
            <div className="bj-hand">
              {dealerHand.length === 0
                ? <CardPlaceholder />
                : dealerHand.map((card, i) => <PlayingCard key={i} card={card} index={i} />)
              }
            </div>
          </div>

          {/* Center — message / logo */}
          <div className="bj-center">
            {message ? (
              <div className={`bj-message bj-message-${result}`}>{message}</div>
            ) : (
              <div className="bj-table-logo">♦ IYKYK</div>
            )}
          </div>

          {/* Player area */}
          <div className="bj-zone player-zone">
            <div className="bj-zone-label">
              You
              {playerScore !== null && (
                <span className={`bj-score ${playerScore > 21 ? 'bust' : playerScore === 21 ? 'max' : ''}`}>
                  {playerScore}
                </span>
              )}
            </div>
            <div className="bj-hand">
              {playerHand.length === 0
                ? <CardPlaceholder />
                : playerHand.map((card, i) => <PlayingCard key={i} card={card} index={i} />)
              }
            </div>
          </div>

        </div>
      </div>

      {/* ── Controls ── */}
      <div className="bj-controls">

        {/* Betting phase */}
        {phase === 'betting' && (
          <div className="bj-betting">
            <div className="bj-bet-row">
              <div className="bj-bet-display">
                <span className="bj-bet-label">Bet</span>
                <span className="bj-bet-amount">${bet}</span>
              </div>
              <div className="bj-bet-actions">
                <button className="bj-btn-sm" onClick={clearBet} disabled={bet === 0}>Clear</button>
                <button className="bj-btn-sm" onClick={maxBet} disabled={balance === 0}>Max</button>
              </div>
            </div>
            <div className="bj-chips">
              {CHIP_VALUES.map(chip => (
                <button
                  key={chip.value}
                  className="bj-chip"
                  style={{ '--chip-color': chip.color }}
                  onClick={() => addChip(chip.value)}
                  disabled={bet + chip.value > balance}
                >
                  <span className="bj-chip-label">{chip.label}</span>
                </button>
              ))}
            </div>
            <button
              className="bj-deal-btn"
              onClick={deal}
              disabled={bet === 0}
            >
              Deal
            </button>
          </div>
        )}

        {/* Playing phase */}
        {phase === 'playing' && (
          <div className="bj-actions">
            <div className="bj-active-bet">Bet: ${bet}</div>
            <div className="bj-action-buttons">
              <button className="bj-action-btn hit" onClick={hit}>Hit</button>
              <button className="bj-action-btn stand" onClick={() => stand()}>Stand</button>
              {canDouble && (
                <button className="bj-action-btn double" onClick={doubleDown}>Double Down</button>
              )}
            </div>
          </div>
        )}

        {/* Result phase */}
        {phase === 'result' && (
          <div className="bj-result-controls">
            <div className="bj-active-bet">Bet was: ${bet}</div>
            <button className="bj-deal-btn" onClick={newHand}>
              {balance === 0 ? '↺ Restart ($1000)' : 'New Hand →'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Playing Card ─────────────────────────────────────────────────────────────

function PlayingCard({ card, index }) {
  if (card.hidden) {
    return (
      <div className="bj-card bj-card-hidden" style={{ '--card-index': index }}>
        <div className="bj-card-back-pattern" />
      </div>
    );
  }

  return (
    <div
      className={`bj-card ${card.red ? 'bj-card-red' : 'bj-card-black'}`}
      style={{ '--card-index': index }}
    >
      <div className="bj-card-corner bj-card-tl">
        <div className="bj-card-rank">{card.rank}</div>
        <div className="bj-card-suit-sm">{card.suit}</div>
      </div>
      <div className="bj-card-center-suit">{card.suit}</div>
      <div className="bj-card-corner bj-card-br">
        <div className="bj-card-rank">{card.rank}</div>
        <div className="bj-card-suit-sm">{card.suit}</div>
      </div>
    </div>
  );
}

function CardPlaceholder() {
  return <div className="bj-card-placeholder" />;
}
