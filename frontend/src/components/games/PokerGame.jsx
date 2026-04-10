/**
 * PokerGame — Texas Hold'em solo (1 human + 3 bots) or multiplayer via room.
 *
 * Layout: 3-column
 *   [Hand Guide] | [Three-zone arena: You | Table | Opponents] | [Live Feed]
 *
 * Turn timer: 45s for human player, auto-fold on expiry.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildPokerDeck, shuffle, bestHand, determineWinners, aiDecide } from '../../lib/poker.js';
import '../../styles/Poker.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const SMALL_BLIND    = 5;
const BIG_BLIND      = 10;
const STARTING_CHIPS = 500;
const TURN_SECONDS   = 45;

const BOT_NAMES = [
  { id: 1, name: 'Aria', avatar: '♥', isHuman: false, chips: STARTING_CHIPS },
  { id: 2, name: 'Rex',  avatar: '♦', isHuman: false, chips: STARTING_CHIPS },
  { id: 3, name: 'Zara', avatar: '♣', isHuman: false, chips: STARTING_CHIPS },
];

const HUMAN_PLAYER = { id: 0, name: 'You', avatar: '♠', isHuman: true, chips: STARTING_CHIPS };

// ─── Inline timer components ──────────────────────────────────────────────────

function TimerBar({ timerStart }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (!timerStart) { setPct(100); return; }
    const update = () => {
      const elapsed = Date.now() - new Date(timerStart).getTime();
      setPct(Math.max(0, 100 - (elapsed / (TURN_SECONDS * 1000)) * 100));
    };
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [timerStart]);

  const tier = pct > 50 ? 'safe' : pct > 25 ? 'warn' : 'danger';
  return (
    <div className="pk-timer-wrap">
      <div className="pk-timer-row">
        <span className="pk-timer-label">Time left</span>
        <Countdown timerStart={timerStart} />
      </div>
      <div className="pk-timer-track">
        <div className={`pk-timer-bar ${tier}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Countdown({ timerStart }) {
  const [secs, setSecs] = useState(TURN_SECONDS);

  useEffect(() => {
    if (!timerStart) { setSecs(TURN_SECONDS); return; }
    const update = () => {
      const elapsed = (Date.now() - new Date(timerStart).getTime()) / 1000;
      setSecs(Math.max(0, Math.ceil(TURN_SECONDS - elapsed)));
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [timerStart]);

  const tier = secs > TURN_SECONDS * 0.5 ? 'safe' : secs > TURN_SECONDS * 0.25 ? 'warn' : 'danger';
  return <span className={`pk-countdown ${tier}`}>{secs}s</span>;
}

// ─── Hand rankings data ───────────────────────────────────────────────────────

const HAND_RANKINGS = [
  { rank: 'Royal Flush',     short: 'RF', example: ['A♠','K♠','Q♠','J♠','T♠'], color: '#f59e0b' },
  { rank: 'Straight Flush',  short: 'SF', example: ['9♥','8♥','7♥','6♥','5♥'], color: '#f43f5e' },
  { rank: 'Four of a Kind',  short: '4K', example: ['A♣','A♠','A♥','A♦','K♠'], color: '#8b5cf6' },
  { rank: 'Full House',      short: 'FH', example: ['K♠','K♥','K♦','Q♠','Q♥'], color: '#3b82f6' },
  { rank: 'Flush',           short: 'F',  example: ['A♠','J♠','8♠','5♠','2♠'], color: '#06b6d4' },
  { rank: 'Straight',        short: 'S',  example: ['T♠','9♥','8♦','7♣','6♠'], color: '#22c55e' },
  { rank: 'Three of a Kind', short: '3K', example: ['7♠','7♥','7♦','K♠','2♣'], color: '#84cc16' },
  { rank: 'Two Pair',        short: '2P', example: ['K♠','K♥','5♦','5♣','A♠'], color: '#f97316' },
  { rank: 'Pair',            short: '1P', example: ['J♠','J♦','A♥','7♣','3♠'], color: '#94a3b8' },
  { rank: 'High Card',       short: 'HC', example: ['A♠','J♥','9♣','6♦','2♠'], color: '#64748b' },
];

// ─── Game logic helpers ───────────────────────────────────────────────────────

function initRound(players, dealerIdx) {
  const deck = shuffle(buildPokerDeck());
  const n = players.length;

  const sbIdx  = (dealerIdx + 1) % n;
  const bbIdx  = (dealerIdx + 2) % n;
  const utgIdx = n === 2 ? dealerIdx : (dealerIdx + 3) % n;

  const dealt = players.map(p => ({
    ...p,
    holeCards: [],
    folded:   false,
    bet:      0,
    hasActed: false,
    allIn:    false,
    lastAction: null,
  }));

  for (let round = 0; round < 2; round++) {
    for (let j = 0; j < dealt.length; j++) {
      const card = deck.pop();
      dealt[j].holeCards.push({ ...card, hidden: !dealt[j].isHuman });
    }
  }

  const postBlind = (idx, amount) => {
    const actual = Math.min(amount, dealt[idx].chips);
    dealt[idx].chips -= actual;
    dealt[idx].bet    = actual;
    if (dealt[idx].chips === 0) dealt[idx].allIn = true;
  };
  postBlind(sbIdx, SMALL_BLIND);
  postBlind(bbIdx, BIG_BLIND);

  return {
    deck,
    players: dealt,
    communityCards: [],
    pot: SMALL_BLIND + BIG_BLIND,
    currentBet: BIG_BLIND,
    phase: 'preflop',
    activeIdx: utgIdx,
    dealerIdx,
    sbIdx,
    bbIdx,
    feed: [
      { type: 'phase',  text: '── PREFLOP ──' },
      { type: 'blind',  player: dealt[sbIdx].name,  text: `posts SB $${SMALL_BLIND}` },
      { type: 'blind',  player: dealt[bbIdx].name,  text: `posts BB $${BIG_BLIND}` },
    ],
    winners: null,
    showdown: false,
    handNum: 1,
  };
}

function nextActiveIdx(players, from) {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (!players[idx].folded && !players[idx].allIn) return idx;
  }
  return -1;
}

function bettingRoundComplete(players, currentBet) {
  const active = players.filter(p => !p.folded);
  if (active.length <= 1) return true;
  const canAct = active.filter(p => !p.allIn);
  if (canAct.length === 0) return true;
  return canAct.every(p => p.hasActed && p.bet === currentBet);
}

function advancePhase(state) {
  const { phase, deck, players, communityCards } = state;
  const order = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const nextPhase = order[order.indexOf(phase) + 1];
  const newDeck = [...deck];
  let newCommunity = [...communityCards];

  if (nextPhase === 'flop') {
    newDeck.pop();
    newCommunity = [newDeck.pop(), newDeck.pop(), newDeck.pop()];
  } else if (nextPhase === 'turn' || nextPhase === 'river') {
    newDeck.pop();
    newCommunity = [...newCommunity, newDeck.pop()];
  }

  const reset = players.map(p => ({ ...p, bet: 0, hasActed: false }));
  const dealerIdx = state.dealerIdx;
  let firstActive = (dealerIdx + 1) % reset.length;
  for (let i = 0; i < reset.length; i++) {
    const idx = (dealerIdx + 1 + i) % reset.length;
    if (!reset[idx].folded && !reset[idx].allIn) { firstActive = idx; break; }
  }

  if (nextPhase === 'showdown') {
    return {
      ...state, phase: 'showdown',
      communityCards: newCommunity, deck: newDeck, players: reset,
      currentBet: 0, activeIdx: -1, showdown: true,
      feed: [...state.feed, { type: 'phase', text: '── SHOWDOWN ──' }],
    };
  }

  return {
    ...state, phase: nextPhase,
    communityCards: newCommunity, deck: newDeck, players: reset,
    currentBet: 0, activeIdx: firstActive,
    feed: [...state.feed, { type: 'phase', text: `── ${nextPhase.toUpperCase()} ──` }],
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PokerGame() {
  const navigate = useNavigate();
  const [gs, setGs]           = useState(null);
  const [uiPhase, setUiPhase] = useState('idle');
  const [raiseAmt, setRaiseAmt] = useState(BIG_BLIND * 2);
  const [turnTimerStart, setTurnTimerStart] = useState(null);
  const aiTimer    = useRef(null);
  const autoFold   = useRef(null);
  const feedRef    = useRef(null);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [gs?.feed]);

  // ── Start hand ──────────────────────────────────────────────────────────────

  const startHand = useCallback((prevPlayers, dealerIdx, handNum = 1) => {
    const alive = prevPlayers.filter(p => p.chips > 0);
    if (alive.length < 2) { setUiPhase('result'); return; }
    const newGs = { ...initRound(alive, dealerIdx % alive.length), handNum };
    setGs(newGs);
    setUiPhase('playing');
    setRaiseAmt(BIG_BLIND * 2);
  }, []);

  const handleStart = () => {
    const all = [{ ...HUMAN_PLAYER }, ...BOT_NAMES.map(b => ({ ...b }))];
    startHand(all, 0, 1);
  };

  // ── Apply action ────────────────────────────────────────────────────────────

  const applyAction = useCallback((state, playerIdx, action, amount = 0) => {
    const players = state.players.map(p => ({ ...p }));
    const p = players[playerIdx];
    let pot = state.pot;
    let currentBet = state.currentBet;
    const feed = [...state.feed];

    const addFeed = (type, text) => feed.push({ type, player: p.name, text });

    players.forEach(pl => { pl.lastAction = null; });

    if (action === 'fold') {
      p.folded = true;
      p.hasActed = true;
      p.lastAction = 'folds';
      addFeed('fold', 'folds');
    } else if (action === 'check') {
      p.hasActed = true;
      p.lastAction = 'checks';
      addFeed('check', 'checks');
    } else if (action === 'call') {
      const toCall = Math.min(currentBet - p.bet, p.chips);
      p.chips -= toCall; pot += toCall; p.bet += toCall;
      p.hasActed = true;
      if (p.chips === 0) p.allIn = true;
      p.lastAction = `calls $${p.bet}`;
      addFeed('call', `calls $${p.bet}`);
    } else if (action === 'raise') {
      const extra = Math.min(amount, p.chips + p.bet) - p.bet;
      p.chips -= extra; pot += extra;
      p.bet += extra; currentBet = p.bet;
      p.hasActed = true;
      if (p.chips === 0) p.allIn = true;
      p.lastAction = `raises to $${p.bet}`;
      addFeed('raise', `raises to $${p.bet}`);
      players.forEach((pl, i) => { if (i !== playerIdx && !pl.folded) pl.hasActed = false; });
    }

    players[playerIdx] = p;
    const newState = { ...state, players, pot, currentBet, feed };

    const active = players.filter(pl => !pl.folded);
    if (active.length === 1) {
      return { ...newState, showdown: false, winners: [active[0].id], phase: 'showdown', activeIdx: -1,
               feed: [...feed, { type: 'win', text: `${active[0].name} wins uncontested!` }] };
    }
    if (bettingRoundComplete(players, currentBet)) {
      if (state.phase === 'river') {
        return { ...newState, showdown: true, phase: 'showdown', activeIdx: -1 };
      }
      return advancePhase(newState);
    }
    return { ...newState, activeIdx: nextActiveIdx(players, playerIdx) };
  }, []);

  // ── Human action ────────────────────────────────────────────────────────────

  const humanAction = useCallback((action, amount = 0) => {
    if (!gs || gs.activeIdx < 0) return;
    const p = gs.players[gs.activeIdx];
    if (!p?.isHuman) return;
    setGs(prev => applyAction(prev, prev.activeIdx, action, amount));
  }, [gs, applyAction]);

  // ── AI turns ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!gs || uiPhase !== 'playing') return;
    if (gs.phase === 'showdown') return;
    if (gs.activeIdx < 0) return;
    const p = gs.players[gs.activeIdx];
    if (!p || p.isHuman || p.folded || p.allIn) return;

    if (aiTimer.current) clearTimeout(aiTimer.current);
    aiTimer.current = setTimeout(() => {
      setGs(prev => {
        if (!prev || prev.activeIdx < 0) return prev;
        const ai = prev.players[prev.activeIdx];
        if (!ai || ai.isHuman) return prev;
        const toCall = prev.currentBet - ai.bet;
        const decision = aiDecide({
          holeCards: ai.holeCards, communityCards: prev.communityCards,
          toCall, pot: prev.pot, chips: ai.chips, phase: prev.phase, bigBlind: BIG_BLIND,
        });
        return applyAction(prev, prev.activeIdx, decision.action, decision.amount || 0);
      });
    }, 800 + Math.random() * 700);

    return () => clearTimeout(aiTimer.current);
  }, [gs?.activeIdx, gs?.phase, uiPhase, applyAction]);

  // ── Human turn timer ────────────────────────────────────────────────────────

  useEffect(() => {
    if (autoFold.current) clearTimeout(autoFold.current);

    if (!gs || gs.phase === 'showdown') {
      setTurnTimerStart(null);
      return;
    }
    const activePlayer = gs.players[gs.activeIdx];
    if (!activePlayer?.isHuman) {
      setTurnTimerStart(null);
      return;
    }

    const start = new Date().toISOString();
    setTurnTimerStart(start);
    autoFold.current = setTimeout(() => {
      setGs(prev => {
        if (!prev) return prev;
        const ap = prev.players[prev.activeIdx];
        if (!ap?.isHuman) return prev;
        return applyAction(prev, prev.activeIdx, 'fold');
      });
    }, TURN_SECONDS * 1000);

    return () => clearTimeout(autoFold.current);
  }, [gs?.activeIdx, gs?.phase, applyAction]);

  // ── Showdown: reveal only winner's cards ────────────────────────────────────

  useEffect(() => {
    if (!gs || gs.phase !== 'showdown') return;
    if (gs.winners) return;

    setGs(prev => {
      if (!prev || prev.winners) return prev;
      const allRevealed = prev.players.map(p => ({
        ...p, holeCards: p.holeCards.map(c => ({ ...c, hidden: false })),
      }));
      const winIds = determineWinners(allRevealed, prev.communityCards);
      const finalPlayers = prev.players.map(p => ({
        ...p,
        holeCards: p.holeCards.map(c => ({
          ...c,
          hidden: !winIds.includes(p.id) && !p.isHuman,
        })),
      }));
      return { ...prev, players: finalPlayers, winners: winIds };
    });
  }, [gs?.phase, gs?.winners]);

  // ── Pot distribution ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!gs?.winners || gs.pot === 0) return;
    setGs(prev => {
      if (!prev?.winners || prev.pot === 0) return prev;
      const share = Math.floor(prev.pot / prev.winners.length);
      const players = prev.players.map(p => ({
        ...p, chips: prev.winners.includes(p.id) ? p.chips + share : p.chips,
      }));
      const winNames = players.filter(p => prev.winners.includes(p.id)).map(p => p.name);
      const feed = [...prev.feed, {
        type: 'win',
        text: `🏆 ${winNames.join(' & ')} win${prev.winners.length > 1 ? ' (split)' : ''} $${share}`,
      }];
      return { ...prev, players, pot: 0, feed };
    });
  }, [gs?.winners]);

  // ── Next hand ───────────────────────────────────────────────────────────────

  const handleNextHand = useCallback(() => {
    if (!gs) return;
    const nextDealer = (gs.dealerIdx + 1) % gs.players.length;
    startHand(gs.players, nextDealer, (gs.handNum || 1) + 1);
  }, [gs, startHand]);

  // ─── Idle screen ───────────────────────────────────────────────────────────

  if (uiPhase === 'idle') {
    return (
      <div className="pk-page pk-idle-page">
        <header className="pk-header pk-header-simple">
          <button className="pk-back" onClick={() => navigate('/')}>← Back</button>
          <div className="pk-header-center">
            <span className="pk-header-suit">♠</span>
            <span className="pk-header-title">Texas Hold'em</span>
            <span className="pk-beta-badge">BETA</span>
          </div>
          <div />
        </header>
        <div className="pk-idle-content">
          <div className="pk-idle-card">
            <div className="pk-idle-icon">♠</div>
            <h1 className="pk-idle-title">Texas Hold'em Poker</h1>
            <p className="pk-idle-sub">Blinds $5/$10 · Start $500 · 3 bots · 45s turn timer</p>

            <div className="pk-idle-players">
              <div className="pk-idle-player you">
                <span className="pk-ip-avatar">♠</span>
                <span className="pk-ip-name">You</span>
                <span className="pk-ip-chips">$500</span>
              </div>
              {BOT_NAMES.map(b => (
                <div key={b.id} className="pk-idle-player">
                  <span className="pk-ip-avatar">{b.avatar}</span>
                  <span className="pk-ip-name">{b.name} <span className="pk-ip-ai">AI</span></span>
                  <span className="pk-ip-chips">$500</span>
                </div>
              ))}
            </div>

            <div className="pk-idle-rules-preview">
              <p className="pk-idle-rules-label">Quick rules: make the best 5-card hand from 2 hole cards + 5 community cards. Blinds are forced bets — SB posts $5, BB posts $10 before cards are dealt.</p>
            </div>

            <button className="pk-primary-btn" onClick={handleStart}>Deal Cards →</button>
            <button className="pk-ghost-btn" onClick={() => navigate('/games/poker/rooms')}>
              Play with Friends →
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (uiPhase === 'result') {
    const humanChips = gs?.players.find(p => p.isHuman)?.chips || 0;
    const won = humanChips > STARTING_CHIPS;
    return (
      <div className="pk-page pk-idle-page">
        <div className="pk-idle-content">
          <div className="pk-idle-card">
            <div className="pk-idle-icon">{won ? '♠' : '♦'}</div>
            <h2 className="pk-idle-title">{won ? 'Well Played!' : 'Busted Out'}</h2>
            <p className="pk-idle-sub">{won ? `You ended with $${humanChips}` : 'All chips lost'}</p>
            <div className="pk-final-standings">
              {(gs?.players || []).sort((a, b) => b.chips - a.chips).map(p => (
                <div key={p.id} className="pk-standing-row">
                  <span>{p.name}{p.isHuman ? ' (You)' : ''}</span>
                  <span>${p.chips}</span>
                </div>
              ))}
            </div>
            <button className="pk-primary-btn" onClick={() => { setGs(null); setUiPhase('idle'); }}>
              Play Again →
            </button>
            <button className="pk-ghost-btn" onClick={() => navigate('/')}>Back to Lobby</button>
          </div>
        </div>
      </div>
    );
  }

  if (!gs) return null;

  const { players, communityCards, pot, phase, activeIdx, dealerIdx, sbIdx, bbIdx, feed, winners, handNum } = gs;

  // Derived
  const humanIdx      = players.findIndex(p => p.isHuman);
  const humanPlayer   = players[humanIdx];
  const opponents     = players.filter(p => !p.isHuman);

  const isHumanTurn   = activeIdx >= 0 && players[activeIdx]?.isHuman && phase !== 'showdown';
  const isHumanDealer = humanIdx === dealerIdx;
  const isHumanSB     = humanIdx === sbIdx;
  const isHumanBB     = humanIdx === bbIdx;
  const isHumanWinner = winners?.includes(humanPlayer?.id);
  const humanHandEval = (phase === 'showdown' || winners) && humanPlayer
    ? bestHand(humanPlayer.holeCards, communityCards) : null;

  const toCall    = humanPlayer ? Math.max(0, (gs.currentBet || 0) - humanPlayer.bet) : 0;
  const canCheck  = toCall === 0;
  const canCall   = toCall > 0 && (humanPlayer?.chips || 0) >= toCall;
  const canRaise  = (humanPlayer?.chips || 0) > toCall;
  const maxRaise  = humanPlayer ? humanPlayer.chips + humanPlayer.bet : 0;
  const minRaise  = Math.max((gs.currentBet || 0) + BIG_BLIND, BIG_BLIND * 2);

  const activeOpponent = activeIdx >= 0 && !players[activeIdx]?.isHuman ? players[activeIdx] : null;
  const is6Players = opponents.length >= 5;

  return (
    <div className="pk-page pk-game-page">
      {/* ── Header ── */}
      <header className="pk-header">
        <button className="pk-back" onClick={() => navigate('/')}>← Back</button>
        <div className="pk-header-center">
          <span className="pk-header-suit">♠</span>
          <span className="pk-header-title">Texas Hold'em</span>
          <span className="pk-beta-badge">BETA</span>
        </div>
        <div className="pk-header-right">
          <div className="pk-pot-pill">
            <span className="pk-pot-label">Pot</span>
            <span className="pk-pot-value">${pot}</span>
          </div>
          <div className="pk-hand-num">Hand #{handNum}</div>
        </div>
      </header>

      {/* ── 3-column outer layout ── */}
      <div className="pk-layout">

        {/* LEFT: Hand Guide */}
        <aside className="pk-side pk-hand-guide">
          <div className="pk-guide-title">Hand Rankings</div>
          <div className="pk-guide-list">
            {HAND_RANKINGS.map((h, i) => (
              <div key={i} className="pk-guide-row">
                <div className="pk-guide-rank-num" style={{ color: h.color }}>
                  {HAND_RANKINGS.length - i}
                </div>
                <div className="pk-guide-info">
                  <div className="pk-guide-name" style={{ color: h.color }}>{h.rank}</div>
                  <div className="pk-guide-cards">
                    {h.example.map((c, ci) => {
                      const isRed = c.endsWith('♥') || c.endsWith('♦');
                      return (
                        <span key={ci} className={`pk-guide-card ${isRed ? 'red' : 'black'}`}>
                          {c}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER: Main play area */}
        <main className="pk-main">

          {/* Blinds + Turn context bar */}
          <div className="pk-context-bar">
            <span className="pk-ctx-item">
              <span className="pk-ctx-badge dealer">D</span>
              {players[dealerIdx]?.name}
            </span>
            <span className="pk-ctx-sep">·</span>
            <span className="pk-ctx-item">
              <span className="pk-ctx-badge sb">SB</span>
              {players[sbIdx]?.name} ${SMALL_BLIND}
            </span>
            <span className="pk-ctx-sep">·</span>
            <span className="pk-ctx-item">
              <span className="pk-ctx-badge bb">BB</span>
              {players[bbIdx]?.name} ${BIG_BLIND}
            </span>

            {/* Right side: turn indicator + phase */}
            <div className="pk-ctx-right">
              {phase !== 'showdown' && activeIdx >= 0 && (
                <div className="pk-turn-indicator">
                  <div className={`pk-turn-dot${isHumanTurn ? ' green' : ''}`} />
                  {isHumanTurn ? (
                    <span className="pk-turn-you">Your turn</span>
                  ) : (
                    <>
                      <span className="pk-turn-name">{players[activeIdx]?.name}</span>
                      <span className="pk-turn-rest">'s turn</span>
                    </>
                  )}
                </div>
              )}
              <span className="pk-ctx-phase">{phase.toUpperCase()}</span>
            </div>
          </div>

          {/* ── Three-zone arena ── */}
          <div className="pk-arena">

            {/* ── YOU ZONE (left) ── */}
            <div className={`pk-you-zone${isHumanTurn ? ' your-turn' : ''}`}>
              {isHumanTurn && <div className="pk-your-turn-badge">YOUR TURN</div>}
              {isHumanTurn && <TimerBar timerStart={turnTimerStart} />}

              <div className="pk-you-cards">
                {humanPlayer?.holeCards.map((card, i) => (
                  <PokerCard key={i} card={card} index={i} />
                ))}
              </div>

              <div className="pk-you-info">
                <div className="pk-you-name-row">
                  <span className="pk-header-suit" style={{ fontSize: '0.9rem' }}>♠</span>
                  <span className="pk-you-name">You</span>
                  {isHumanDealer && <span className="pk-role-badge pk-dealer-d">D</span>}
                  {isHumanSB && !isHumanDealer && <span className="pk-role-badge pk-sb-badge">SB</span>}
                  {isHumanBB && <span className="pk-role-badge pk-bb-badge">BB</span>}
                </div>
                <div className="pk-you-chips">${humanPlayer?.chips ?? 0}</div>
                {(humanPlayer?.bet ?? 0) > 0 && (
                  <div className="pk-you-bet">Bet ${humanPlayer.bet}</div>
                )}
                {humanPlayer?.allIn  && <div className="pk-status-tag pk-allin">ALL IN</div>}
                {humanPlayer?.folded && <div className="pk-status-tag pk-fold-tag">FOLDED</div>}
                {isHumanWinner       && <div className="pk-status-tag pk-win-tag">WINNER</div>}
                {humanHandEval && !humanPlayer?.folded && (
                  <div className="pk-you-hand">{humanHandEval.name}</div>
                )}
                {humanPlayer?.lastAction && (
                  <div className={`pk-last-action pk-action-${humanPlayer.lastAction.split(' ')[0]}`}>
                    {humanPlayer.lastAction}
                  </div>
                )}
              </div>
            </div>

            {/* ── TABLE ZONE (center) ── */}
            <div className="pk-table-zone">
              <div className="pk-felt">
                <div className="pk-community-area">
                  {communityCards.length === 0 ? (
                    <div className="pk-community-placeholder">Waiting for flop…</div>
                  ) : (
                    <div className="pk-community-cards">
                      {communityCards.map((card, i) => (
                        <PokerCard key={i} card={card} index={i} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="pk-pot-center">POT · ${pot}</div>
              </div>

              {/* Waiting pill — shows whose turn it is when it's not yours */}
              {!isHumanTurn && activeOpponent && phase !== 'showdown' && (
                <div className="pk-waiting-pill">
                  <div className="pk-waiting-dot" />
                  Waiting for{' '}
                  <span className="pk-waiting-pill-name">{activeOpponent.name}</span>
                  {' '}to act…
                </div>
              )}
            </div>

            {/* ── OPPONENT ZONE (right) ── */}
            <div className={`pk-opp-zone${is6Players ? ' pk-opp-6p' : ''}`}>
              <div className="pk-opp-zone-label">Players</div>
              <div className={is6Players ? 'pk-opp-grid-2' : 'pk-opp-grid-1'}>
                {opponents.map(p => {
                  const pIdx     = players.indexOf(p);
                  const isActive = pIdx === activeIdx && phase !== 'showdown';
                  const isWinner = winners?.includes(p.id);
                  const isDealer = pIdx === dealerIdx;
                  const isSB     = pIdx === sbIdx;
                  const isBB     = pIdx === bbIdx;
                  const oppHandEval = isWinner
                    ? bestHand(p.holeCards, communityCards) : null;

                  return (
                    <div
                      key={p.id}
                      className={[
                        'pk-opp-panel',
                        isActive ? 'active'  : '',
                        isWinner ? 'winner'  : '',
                        p.folded ? 'folded'  : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="pk-opp-name-row">
                        <span className="pk-opp-avatar">{p.avatar}</span>
                        <span className="pk-opp-name">{p.name}</span>
                        {isDealer && <span className="pk-role-badge pk-dealer-d">D</span>}
                        {isSB && !isDealer && <span className="pk-role-badge pk-sb-badge">SB</span>}
                        {isBB && <span className="pk-role-badge pk-bb-badge">BB</span>}
                      </div>
                      <div className="pk-opp-chips">${p.chips}</div>
                      {p.bet > 0 && <div className="pk-opp-bet">Bet ${p.bet}</div>}
                      {p.allIn   && <div className="pk-status-tag pk-allin">ALL IN</div>}
                      {p.folded  && <div className="pk-status-tag pk-fold-tag">FOLDED</div>}
                      {isWinner  && <div className="pk-status-tag pk-win-tag">WINNER</div>}
                      {oppHandEval && !p.folded && (
                        <div className="pk-hand-eval">{oppHandEval.name}</div>
                      )}
                      {/* Revealed winner cards at showdown */}
                      {isWinner && p.holeCards.some(c => !c.hidden) && (
                        <div className="pk-opp-showdown-cards">
                          {p.holeCards.map((card, ci) => (
                            <PokerCard key={ci} card={card} index={ci} />
                          ))}
                        </div>
                      )}
                      {p.lastAction && !p.folded && !isWinner && (
                        <div className={`pk-last-action pk-action-${p.lastAction.split(' ')[0]}`}>
                          {p.lastAction}
                        </div>
                      )}
                      {isActive && <span className="pk-thinking-badge">thinking…</span>}
                      {isActive && (
                        <div className="pk-opp-mini-timer">
                          <div className="pk-opp-mini-bar" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>{/* end pk-arena */}

          {/* ── Controls ── */}
          <div className="pk-controls">
            {phase === 'showdown' && winners ? (
              <div className="pk-showdown-bar">
                <span className="pk-showdown-msg">
                  {winners.length === 1
                    ? `${players.find(p => p.id === winners[0])?.name} wins the hand!`
                    : 'Split pot!'}
                </span>
                <button className="pk-primary-btn pk-btn-inline" onClick={handleNextHand}>
                  Next Hand →
                </button>
              </div>
            ) : isHumanTurn ? (
              <div className="pk-action-panel">
                <div className="pk-action-context">
                  {toCall > 0 ? (
                    <span className="pk-call-context">
                      To call: <strong>${toCall}</strong>
                      {toCall === BIG_BLIND && phase === 'preflop' ? ' (Big Blind)' : ''}
                    </span>
                  ) : (
                    <span className="pk-call-context">Your turn — free to check or bet</span>
                  )}
                </div>
                <div className="pk-action-row">
                  <button className="pk-btn pk-btn-fold" onClick={() => humanAction('fold')}>
                    Fold
                  </button>
                  {canCheck ? (
                    <button className="pk-btn pk-btn-check" onClick={() => humanAction('check')}>
                      Check
                    </button>
                  ) : (
                    <button className="pk-btn pk-btn-call" onClick={() => humanAction('call')} disabled={!canCall}>
                      Call ${toCall}
                    </button>
                  )}
                  {canRaise && (
                    <button
                      className="pk-btn pk-btn-raise"
                      onClick={() => humanAction('raise', raiseAmt)}
                      disabled={raiseAmt > maxRaise}
                    >
                      {canCheck ? 'Bet' : 'Raise'} ${raiseAmt}
                    </button>
                  )}
                </div>
                {canRaise && (
                  <div className="pk-raise-row">
                    <span className="pk-raise-label">${minRaise}</span>
                    <input
                      type="range"
                      className="pk-slider"
                      min={minRaise}
                      max={maxRaise}
                      step={BIG_BLIND}
                      value={raiseAmt}
                      onChange={e => setRaiseAmt(Number(e.target.value))}
                    />
                    <span className="pk-raise-label">${maxRaise} (All in)</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="pk-waiting-bar">
                <span className="pk-waiting-dot" />
                <span className="pk-waiting-text">
                  {activeIdx >= 0 && players[activeIdx]
                    ? `${players[activeIdx].name} is thinking…`
                    : 'Processing…'}
                </span>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT: Live Feed */}
        <aside className="pk-side pk-live-feed">
          <div className="pk-feed-title">Live Action</div>
          <div className="pk-feed-scroll" ref={feedRef}>
            {feed.map((entry, i) => (
              <FeedEntry key={i} entry={entry} />
            ))}
          </div>
        </aside>

      </div>
    </div>
  );
}

// ─── Feed entry ───────────────────────────────────────────────────────────────

function FeedEntry({ entry }) {
  if (entry.type === 'phase') {
    return <div className="pk-feed-phase">{entry.text}</div>;
  }
  const colorClass = {
    fold:  'pk-feed-fold',
    check: 'pk-feed-check',
    call:  'pk-feed-call',
    raise: 'pk-feed-raise',
    blind: 'pk-feed-blind',
    win:   'pk-feed-win',
  }[entry.type] || '';

  return (
    <div className={`pk-feed-entry ${colorClass}`}>
      {entry.player && <span className="pk-feed-who">{entry.player}</span>}
      <span className="pk-feed-what">{entry.text}</span>
    </div>
  );
}

// ─── Poker Card ───────────────────────────────────────────────────────────────

function PokerCard({ card, index }) {
  if (card.hidden) {
    return (
      <div className="pk-card pk-card-back" style={{ '--ci': index }}>
        <div className="pk-card-back-inner" />
      </div>
    );
  }
  return (
    <div
      className={`pk-card ${card.red ? 'pk-card-red' : 'pk-card-black'}`}
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
