import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildPokerDeck, shuffle, bestHand, determineWinners, aiDecide } from '../../lib/poker.js';
import '../../styles/Poker.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const SMALL_BLIND = 5;
const BIG_BLIND   = 10;
const STARTING_CHIPS = 500;

const PLAYERS_INIT = [
  { id: 0, name: 'You',  isHuman: true,  chips: STARTING_CHIPS, avatar: '♠' },
  { id: 1, name: 'Aria', isHuman: false, chips: STARTING_CHIPS, avatar: '♥' },
  { id: 2, name: 'Rex',  isHuman: false, chips: STARTING_CHIPS, avatar: '♦' },
];

// Seat positions (dealer button rotates)
const SEAT_POSITIONS = ['bottom', 'left', 'right'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initRound(players, dealerIdx, deckIn) {
  const deck = deckIn ? [...deckIn] : shuffle(buildPokerDeck());

  const sbIdx  = (dealerIdx + 1) % players.length;
  const bbIdx  = (dealerIdx + 2) % players.length;
  const utg    = (dealerIdx + 3) % players.length;

  // Deal 2 hole cards per player
  const dealt = players.map(p => ({ ...p, holeCards: [], folded: false, bet: 0, hasActed: false, allIn: false }));
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < dealt.length; j++) {
      const card = deck.pop();
      dealt[j].holeCards.push({ ...card, hidden: dealt[j].id !== 0 }); // hide AI cards
    }
  }

  // Post blinds
  const pot = [];
  function postBlind(pidx, amount) {
    const actual = Math.min(amount, dealt[pidx].chips);
    dealt[pidx].chips -= actual;
    dealt[pidx].bet    = actual;
    if (dealt[pidx].chips === 0) dealt[pidx].allIn = true;
    pot.push({ playerId: dealt[pidx].id, amount: actual });
  }
  postBlind(sbIdx, SMALL_BLIND);
  postBlind(bbIdx, BIG_BLIND);

  return {
    deck,
    players: dealt,
    communityCards: [],
    pot: SMALL_BLIND + BIG_BLIND,
    currentBet: BIG_BLIND,
    phase: 'preflop',
    activeIdx: utg % dealt.length,
    dealerIdx,
    sbIdx,
    bbIdx,
    log: [`${dealt[sbIdx].name} posts SB $${SMALL_BLIND}`, `${dealt[bbIdx].name} posts BB $${BIG_BLIND}`],
    winners: null,
    showdown: false,
  };
}

function nextActiveIdx(players, from) {
  let idx = (from + 1) % players.length;
  const start = idx;
  do {
    if (!players[idx].folded && !players[idx].allIn) return idx;
    idx = (idx + 1) % players.length;
  } while (idx !== start);
  return -1; // everyone folded / all-in
}

function bettingRoundComplete(players, currentBet, phase, bbIdx) {
  const active = players.filter(p => !p.folded);
  if (active.length === 1) return true;
  const canAct = active.filter(p => !p.allIn);
  if (canAct.length === 0) return true;
  // All active, non-all-in players must have acted and matched currentBet
  return canAct.every(p => p.hasActed && p.bet === currentBet);
}

function advancePhase(state) {
  const { phase, deck, players, communityCards, pot } = state;
  const order = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const nextPhase = order[order.indexOf(phase) + 1];

  let newCommunity = [...communityCards];
  const newDeck = [...deck];

  if (nextPhase === 'flop') {
    newDeck.pop(); // burn
    newCommunity = [newDeck.pop(), newDeck.pop(), newDeck.pop()];
  } else if (nextPhase === 'turn' || nextPhase === 'river') {
    newDeck.pop(); // burn
    newCommunity = [...newCommunity, newDeck.pop()];
  }

  // Reset bets for new betting round, start action from left of dealer
  const reset = players.map(p => ({ ...p, bet: 0, hasActed: false }));
  const dealerIdx = state.dealerIdx;
  let firstActive = (dealerIdx + 1) % reset.length;
  while (reset[firstActive].folded || reset[firstActive].allIn) {
    firstActive = (firstActive + 1) % reset.length;
  }

  if (nextPhase === 'showdown') {
    return {
      ...state,
      phase: 'showdown',
      communityCards: newCommunity,
      deck: newDeck,
      players: reset,
      currentBet: 0,
      activeIdx: -1,
      showdown: true,
    };
  }

  return {
    ...state,
    phase: nextPhase,
    communityCards: newCommunity,
    deck: newDeck,
    players: reset,
    currentBet: 0,
    activeIdx: firstActive,
    log: [...state.log, `── ${nextPhase.toUpperCase()} ──`],
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PokerGame() {
  const navigate = useNavigate();
  const [gs, setGs] = useState(null);            // game state
  const [uiPhase, setUiPhase] = useState('idle'); // idle | playing | result
  const [raiseAmount, setRaiseAmount] = useState(BIG_BLIND * 2);
  const aiTimerRef = useRef(null);

  // ── Start a new hand ──────────────────────────────────────────────────────

  const startHand = useCallback((prevPlayers, dealerIdx) => {
    const alive = prevPlayers.filter(p => p.chips > 0);
    if (alive.length < 2) {
      setUiPhase('result');
      return;
    }
    const newGs = initRound(alive, dealerIdx % alive.length, null);
    setGs(newGs);
    setUiPhase('playing');
    setRaiseAmount(BIG_BLIND * 2);
  }, []);

  const handleStartGame = () => {
    startHand(PLAYERS_INIT.map(p => ({ ...p })), 0);
  };

  // ── Apply an action to game state ─────────────────────────────────────────

  const applyAction = useCallback((state, playerIdx, action, amount = 0) => {
    const players = state.players.map(p => ({ ...p }));
    const p = players[playerIdx];
    let pot = state.pot;
    let currentBet = state.currentBet;
    const log = [...state.log];

    if (action === 'fold') {
      p.folded = true;
      p.hasActed = true;
      log.push(`${p.name} folds`);

    } else if (action === 'check') {
      p.hasActed = true;
      log.push(`${p.name} checks`);

    } else if (action === 'call') {
      const toCall = Math.min(currentBet - p.bet, p.chips);
      p.chips -= toCall;
      pot += toCall;
      p.bet += toCall;
      p.hasActed = true;
      if (p.chips === 0) p.allIn = true;
      log.push(`${p.name} calls $${toCall}`);

    } else if (action === 'raise') {
      const raiseTotal = Math.min(amount, p.chips + p.bet); // total chips in this round
      const extra = raiseTotal - p.bet;
      p.chips -= extra;
      pot += extra;
      p.bet = raiseTotal;
      currentBet = raiseTotal;
      p.hasActed = true;
      if (p.chips === 0) p.allIn = true;
      // Reset hasActed for everyone else
      players.forEach((pl, i) => { if (i !== playerIdx && !pl.folded) pl.hasActed = false; });
      log.push(`${p.name} raises to $${raiseTotal}`);
    }

    const newState = { ...state, players, pot, currentBet, log };

    // Check for single active player
    const active = players.filter(pl => !pl.folded);
    if (active.length === 1) {
      // Everyone else folded — current player wins
      return { ...newState, showdown: false, winners: [active[0].id], phase: 'showdown', activeIdx: -1 };
    }

    // Check if betting round is done
    if (bettingRoundComplete(players, currentBet, state.phase, state.bbIdx)) {
      if (state.phase === 'river') {
        return { ...newState, showdown: true, phase: 'showdown', activeIdx: -1 };
      }
      return advancePhase(newState);
    }

    // Move to next player
    const next = nextActiveIdx(players, playerIdx);
    return { ...newState, activeIdx: next };
  }, []);

  // ── Human actions ──────────────────────────────────────────────────────────

  const humanAction = useCallback((action, amount = 0) => {
    if (!gs || gs.activeIdx < 0) return;
    const p = gs.players[gs.activeIdx];
    if (!p || !p.isHuman) return;
    setGs(prev => applyAction(prev, prev.activeIdx, action, amount));
  }, [gs, applyAction]);

  // ── AI turn via useEffect ──────────────────────────────────────────────────

  useEffect(() => {
    if (!gs || uiPhase !== 'playing') return;
    if (gs.phase === 'showdown') return;
    if (gs.activeIdx < 0) return;

    const p = gs.players[gs.activeIdx];
    if (!p || p.isHuman || p.folded || p.allIn) return;

    // Clear any lingering timer
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    aiTimerRef.current = setTimeout(() => {
      setGs(prev => {
        if (!prev || prev.activeIdx < 0) return prev;
        const ai = prev.players[prev.activeIdx];
        if (!ai || ai.isHuman) return prev;
        const toCall = prev.currentBet - ai.bet;
        const decision = aiDecide({
          holeCards:      ai.holeCards,
          communityCards: prev.communityCards,
          toCall,
          pot:            prev.pot,
          chips:          ai.chips,
          phase:          prev.phase,
          bigBlind:       BIG_BLIND,
        });
        return applyAction(prev, prev.activeIdx, decision.action, decision.amount || 0);
      });
    }, 900 + Math.random() * 600);

    return () => clearTimeout(aiTimerRef.current);
  }, [gs?.activeIdx, gs?.phase, uiPhase, applyAction]);

  // ── Resolve showdown ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!gs || gs.phase !== 'showdown') return;

    // Reveal all cards
    setGs(prev => {
      if (!prev || prev.winners) return prev;
      const revealedPlayers = prev.players.map(p => ({
        ...p,
        holeCards: p.holeCards.map(c => ({ ...c, hidden: false })),
      }));
      const winnerIds = determineWinners(revealedPlayers, prev.communityCards);
      return { ...prev, players: revealedPlayers, winners: winnerIds };
    });
  }, [gs?.phase]);

  // ── Deal out pot when winners known ───────────────────────────────────────

  useEffect(() => {
    if (!gs?.winners) return;
    // Already distributed? Check if pot > 0
    if (gs.pot === 0) return;

    setGs(prev => {
      if (!prev?.winners || prev.pot === 0) return prev;
      const share = Math.floor(prev.pot / prev.winners.length);
      const updated = prev.players.map(p => ({
        ...p,
        chips: prev.winners.includes(p.id) ? p.chips + share : p.chips,
      }));
      return { ...prev, players: updated, pot: 0 };
    });
  }, [gs?.winners]);

  // ── Next hand / new game ───────────────────────────────────────────────────

  const handleNextHand = useCallback(() => {
    if (!gs) return;
    const nextDealer = (gs.dealerIdx + 1) % gs.players.length;
    startHand(gs.players, nextDealer);
  }, [gs, startHand]);

  const handleRestart = () => {
    setGs(null);
    setUiPhase('idle');
  };

  // ─── Derived ───────────────────────────────────────────────────────────────

  const isHumanTurn = gs && gs.activeIdx >= 0 && gs.players[gs.activeIdx]?.isHuman;
  const humanPlayer = gs?.players.find(p => p.isHuman);
  const toCall = gs && humanPlayer ? Math.max(0, gs.currentBet - humanPlayer.bet) : 0;
  const canCheck = toCall === 0;
  const canCall  = toCall > 0 && humanPlayer?.chips >= toCall;
  const canRaise = humanPlayer?.chips > toCall;
  const maxRaise = humanPlayer ? humanPlayer.chips + humanPlayer.bet : 0;

  // ─── Idle screen ───────────────────────────────────────────────────────────

  if (uiPhase === 'idle') {
    return (
      <div className="pk-page pk-idle">
        <header className="pk-header">
          <button className="pk-back" onClick={() => navigate('/')}>← Back</button>
        </header>
        <div className="pk-idle-card">
          <div className="pk-idle-suit">♠</div>
          <h1 className="pk-idle-title">Texas Hold'em</h1>
          <p className="pk-idle-sub">3-player · Blinds $5/$10 · Start with $500</p>
          <div className="pk-players-preview">
            {PLAYERS_INIT.map(p => (
              <div key={p.id} className={`pk-preview-player ${p.isHuman ? 'you' : ''}`}>
                <span className="pk-preview-avatar">{p.avatar}</span>
                <span className="pk-preview-name">{p.name}</span>
                <span className="pk-preview-chips">${p.chips}</span>
              </div>
            ))}
          </div>
          <button className="pk-primary-btn" onClick={handleStartGame}>Deal Cards →</button>
        </div>
      </div>
    );
  }

  if (uiPhase === 'result') {
    const humans = gs?.players.find(p => p.isHuman);
    const won = humans?.chips > STARTING_CHIPS;
    return (
      <div className="pk-page pk-idle">
        <div className="pk-idle-card">
          <div className="pk-idle-suit">{won ? '♠' : '♦'}</div>
          <h2 className="pk-idle-title">{won ? 'Victory!' : 'Busted Out'}</h2>
          <p className="pk-idle-sub">
            {won ? `You ended with $${humans?.chips}` : 'All chips lost'}
          </p>
          <div className="pk-final-standings">
            {gs?.players.sort((a, b) => b.chips - a.chips).map(p => (
              <div key={p.id} className="pk-standing-row">
                <span>{p.name}</span>
                <span>${p.chips}</span>
              </div>
            ))}
          </div>
          <button className="pk-primary-btn" onClick={handleRestart}>Play Again →</button>
          <button className="pk-ghost-btn" onClick={() => navigate('/')}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  if (!gs) return null;

  const { players, communityCards, pot, phase, activeIdx, dealerIdx, log, winners } = gs;

  // Seat mapping: human always at bottom
  const humanIdx = players.findIndex(p => p.isHuman);
  const seatOrder = players.map((_, i) => {
    const offset = (i - humanIdx + players.length) % players.length;
    return SEAT_POSITIONS[offset];
  });

  return (
    <div className="pk-page">
      {/* Header */}
      <header className="pk-header">
        <button className="pk-back" onClick={() => navigate('/')}>← Back</button>
        <div className="pk-header-center">
          <span className="pk-header-suit">♠</span>
          <span className="pk-header-title">Poker</span>
          <span className="pk-beta-tag">BETA</span>
        </div>
        <div className="pk-pot-display">
          <span className="pk-pot-label">Pot</span>
          <span className="pk-pot-value">${pot}</span>
        </div>
      </header>

      {/* Table */}
      <div className="pk-table">
        <div className="pk-table-felt">

          {/* Phase pill */}
          <div className="pk-phase-pill">{phase.toUpperCase()}</div>

          {/* Community cards */}
          <div className="pk-community">
            {communityCards.length === 0 && phase === 'preflop' && (
              <div className="pk-community-placeholder">Community Cards</div>
            )}
            {communityCards.map((card, i) => (
              <PokerCard key={i} card={card} index={i} />
            ))}
          </div>

          {/* Players around the table */}
          {players.map((p, i) => {
            const seat = seatOrder[i];
            const isActive = i === activeIdx && phase !== 'showdown';
            const isDealer = i === dealerIdx;
            const isWinner = winners?.includes(p.id);
            const handEval = (phase === 'showdown' || winners)
              ? bestHand(p.holeCards, communityCards)
              : null;

            return (
              <div
                key={p.id}
                className={`pk-seat pk-seat-${seat} ${isActive ? 'active' : ''} ${p.folded ? 'folded' : ''} ${isWinner ? 'winner' : ''}`}
              >
                <div className="pk-seat-info">
                  <div className="pk-seat-header">
                    <span className="pk-seat-avatar">{p.avatar}</span>
                    <span className="pk-seat-name">{p.name}{p.isHuman ? ' (You)' : ''}</span>
                    {isDealer && <span className="pk-dealer-btn">D</span>}
                  </div>
                  <div className="pk-seat-chips">${p.chips}</div>
                  {p.bet > 0 && <div className="pk-seat-bet">Bet: ${p.bet}</div>}
                  {p.allIn && <div className="pk-all-in-tag">ALL IN</div>}
                  {p.folded && <div className="pk-folded-tag">FOLDED</div>}
                  {isWinner && <div className="pk-winner-tag">WINNER +${Math.floor(gs.pot > 0 ? 0 : pot / (winners?.length || 1))}</div>}
                  {handEval && !p.folded && (
                    <div className="pk-hand-name">{handEval.name}</div>
                  )}
                </div>
                <div className={`pk-hole-cards ${p.isHuman ? 'pk-human-cards' : ''}`}>
                  {p.holeCards.map((card, ci) => (
                    <PokerCard key={ci} card={card} index={ci} small={!p.isHuman} />
                  ))}
                </div>
                {isActive && !p.isHuman && (
                  <div className="pk-thinking">thinking...</div>
                )}
              </div>
            );
          })}

        </div>
      </div>

      {/* Controls */}
      <div className="pk-controls">
        {phase === 'showdown' && winners ? (
          <div className="pk-showdown-controls">
            <div className="pk-showdown-msg">
              {winners.length === 1
                ? `${players.find(p => p.id === winners[0])?.name} wins!`
                : 'Split pot!'}
            </div>
            <button className="pk-primary-btn" onClick={handleNextHand}>Next Hand →</button>
          </div>
        ) : isHumanTurn ? (
          <div className="pk-action-panel">
            <div className="pk-action-info">
              <span className="pk-action-label">Your turn</span>
              {toCall > 0 && <span className="pk-to-call">To call: ${toCall}</span>}
            </div>
            <div className="pk-action-btns">
              <button className="pk-action-btn fold" onClick={() => humanAction('fold')}>
                Fold
              </button>
              {canCheck ? (
                <button className="pk-action-btn check" onClick={() => humanAction('check')}>
                  Check
                </button>
              ) : (
                <button className="pk-action-btn call" onClick={() => humanAction('call')} disabled={!canCall}>
                  Call ${toCall}
                </button>
              )}
              {canRaise && (
                <div className="pk-raise-group">
                  <button
                    className="pk-action-btn raise"
                    onClick={() => humanAction('raise', raiseAmount)}
                    disabled={raiseAmount > humanPlayer.chips + humanPlayer.bet}
                  >
                    Raise ${raiseAmount}
                  </button>
                  <div className="pk-raise-slider-wrap">
                    <span className="pk-raise-min">${Math.max(gs.currentBet + BIG_BLIND, BIG_BLIND * 2)}</span>
                    <input
                      type="range"
                      className="pk-raise-slider"
                      min={Math.max(gs.currentBet + BIG_BLIND, BIG_BLIND * 2)}
                      max={maxRaise}
                      step={BIG_BLIND}
                      value={raiseAmount}
                      onChange={e => setRaiseAmount(Number(e.target.value))}
                    />
                    <span className="pk-raise-max">${maxRaise}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="pk-waiting">
            <span className="pk-waiting-dot" />
            <span>{players[activeIdx]?.name ?? '...'} is thinking</span>
          </div>
        )}
      </div>

      {/* Action log */}
      <ActionLog log={log} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PokerCard({ card, index, small }) {
  if (card.hidden) {
    return (
      <div className={`pk-card pk-card-back ${small ? 'pk-card-sm' : ''}`} style={{ '--ci': index }}>
        <div className="pk-card-back-pattern" />
      </div>
    );
  }
  return (
    <div
      className={`pk-card ${card.red ? 'pk-card-red' : 'pk-card-black'} ${small ? 'pk-card-sm' : ''}`}
      style={{ '--ci': index }}
    >
      <div className="pk-card-tl">
        <div className="pk-card-rank">{card.rank}</div>
        <div className="pk-card-suit-sm">{card.suit}</div>
      </div>
      <div className="pk-card-center">{card.suit}</div>
      <div className="pk-card-br">
        <div className="pk-card-rank">{card.rank}</div>
        <div className="pk-card-suit-sm">{card.suit}</div>
      </div>
    </div>
  );
}

function ActionLog({ log }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);

  return (
    <div className="pk-log" ref={ref}>
      {log.slice(-12).map((entry, i) => (
        <div key={i} className={`pk-log-entry ${entry.startsWith('──') ? 'pk-log-phase' : ''}`}>
          {entry}
        </div>
      ))}
    </div>
  );
}
