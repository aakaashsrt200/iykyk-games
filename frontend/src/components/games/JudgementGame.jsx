import { useState, useEffect, useRef } from 'react';
import {
  SUIT_SYMBOLS, SUIT_NAMES,
  ROUND_PAUSE_MS, scoreRound,
} from '../../lib/judgement';
import { useGameStore } from '../../store/gameStore';
import PageEdgeIndicator from '../PageEdgeIndicator';
import ResultOverlay from '../ResultOverlay';
import '../../styles/Judgement.css';

// ─── Constants ─────────────────────────────────────────────────────────────────
const TIMER_SECONDS = 45;

const TRUMP_SUIT_COLORS = {
  spades:   '#a78bfa',
  diamonds: '#f87171',
  clubs:    '#34d399',
  hearts:   '#f472b6',
};

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#db2777', '#0891b2', '#65a30d', '#dc2626',
];

// ─── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, index, size = 32 }) {
  const bg = AVATAR_COLORS[(index || 0) % AVATAR_COLORS.length];
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: `${Math.round(size * 0.42)}px`, color: '#fff', flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ─── Card component ─────────────────────────────────────────────────────────────
function Card({ card, onClick, dimmed, highlight, size = 'md', cardIndex }) {
  if (!card) return null;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const cardColor = isRed ? '#dc2626' : '#111827';

  return (
    <button
      className={`jdg-card jdg-card-${size}${dimmed ? ' dimmed' : ''}${highlight ? ' highlight' : ''}${onClick ? ' playable' : ''}`}
      style={{ color: cardColor, '--card-index': cardIndex ?? 0 }}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="jdg-card-rank">{card.rank}</span>
      <span className="jdg-card-suit">{SUIT_SYMBOLS[card.suit]}</span>
    </button>
  );
}

// ─── Timer bar ──────────────────────────────────────────────────────────────────
function TimerBar({ timerStart, active }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (!active || !timerStart) { setPct(100); return; }
    const update = () => {
      const elapsed = Date.now() - new Date(timerStart).getTime();
      setPct(Math.max(0, 100 - (elapsed / (TIMER_SECONDS * 1000)) * 100));
    };
    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [active, timerStart]);

  if (!active) return null;
  const color = pct > 50 ? '#10b981' : pct > 25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="jdg-timer-track">
      <div className="jdg-timer-bar" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── Countdown display ──────────────────────────────────────────────────────────
function Countdown({ timerStart }) {
  const [secs, setSecs] = useState(TIMER_SECONDS);
  useEffect(() => {
    if (!timerStart) return;
    const update = () => {
      const elapsed = (Date.now() - new Date(timerStart).getTime()) / 1000;
      setSecs(Math.max(0, Math.ceil(TIMER_SECONDS - elapsed)));
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [timerStart]);
  return (
    <span style={{ color: secs <= 10 ? '#ef4444' : '#9ca3af', fontSize: '0.75rem', fontWeight: 700 }}>
      {secs}s
    </span>
  );
}

// ─── Round auto-advance countdown ───────────────────────────────────────────────
function RoundCountdown({ roundResultAt }) {
  const [secs, setSecs] = useState(Math.ceil(ROUND_PAUSE_MS / 1000));
  useEffect(() => {
    if (!roundResultAt) return;
    const update = () => {
      const elapsed = (Date.now() - new Date(roundResultAt).getTime()) / 1000;
      setSecs(Math.max(0, Math.ceil(ROUND_PAUSE_MS / 1000 - elapsed)));
    };
    update();
    const id = setInterval(update, 300);
    return () => clearInterval(id);
  }, [roundResultAt]);
  return <span style={{ fontWeight: 700, color: '#a78bfa' }}>{secs}s</span>;
}

// ─── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="jdg-toast">
      {message}
    </div>
  );
}

// ─── Score History Modal ─────────────────────────────────────────────────────────
function ScoreHistoryModal({ round_history, players, seats, onClose }) {
  if (!round_history?.length) return (
    <div className="jdg-score-modal" onClick={onClose}>
      <div className="jdg-score-modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#e8eaf0' }}>Score History</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>No rounds completed yet.</p>
      </div>
    </div>
  );

  const activePlayers = players.filter(p => {
    const someRoundWithSeat = round_history.some(r => r.seats?.[p.seat]);
    return someRoundWithSeat;
  });

  return (
    <div className="jdg-score-modal" onClick={onClose}>
      <div className="jdg-score-modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#e8eaf0' }}>Score History</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 10px', color: '#6b7280', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Round</th>
                {activePlayers.map(p => (
                  <th key={p.id} style={{ textAlign: 'center', padding: '6px 10px', color: '#9ca3af', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {round_history.map((rh, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '7px 10px', color: '#9ca3af', fontWeight: 600 }}>R{idx + 1}</td>
                  {activePlayers.map(p => {
                    const sd = rh.seats?.[p.seat];
                    if (!sd) return <td key={p.id} style={{ textAlign: 'center', padding: '7px 10px', color: '#4b5563' }}>—</td>;
                    const delta = scoreRound(sd.bid, sd.tricks_won);
                    const hit   = sd.bid === sd.tricks_won;
                    return (
                      <td key={p.id} style={{ textAlign: 'center', padding: '7px 10px' }}>
                        <span style={{ color: '#9ca3af' }}>{sd.bid}/{sd.tricks_won} </span>
                        <span style={{ color: hit ? '#10b981' : '#9ca3af', fontWeight: 700 }}>
                          {hit ? `+${delta}` : '+0'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {/* Totals row */}
              <tr style={{ background: 'rgba(124,58,237,0.08)', borderTop: '2px solid rgba(124,58,237,0.3)' }}>
                <td style={{ padding: '8px 10px', color: '#a78bfa', fontWeight: 800, fontSize: '0.8rem' }}>TOTAL</td>
                {activePlayers.map(p => {
                  const last = round_history[round_history.length - 1];
                  const total = last?.scores_snapshot?.[p.seat] ?? 0;
                  return (
                    <td key={p.id} style={{ textAlign: 'center', padding: '8px 10px', color: '#a78bfa', fontWeight: 800, fontSize: '0.85rem' }}>
                      {total} pts
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main game component ────────────────────────────────────────────────────────
export default function JudgementGame({
  onPlaceBid, onPlayCard, onNextRound,
  onLeave, onClose,
}) {
  // Read from store
  const room         = useGameStore(s => s.room);
  const players      = useGameStore(s => s.players);
  const me           = useGameStore(s => s.me);
  const isHost       = useGameStore(s => s.isHost);
  const gs           = useGameStore(s => s.gs);
  const phase        = useGameStore(s => s.phase);
  const isMyTurn     = useGameStore(s => s.isMyTurn);
  const myData       = useGameStore(s => s.myData);
  const myValidCards = useGameStore(s => s.myValidCards);
  const forbidden    = useGameStore(s => s.forbidden);
  const canBid       = useGameStore(s => s.canBid);
  const canPlay      = useGameStore(s => s.canPlay);

  const [bidInput,     setBidInput]     = useState(null);
  const [showHistory,  setShowHistory]  = useState(false);
  const [toast,        setToast]        = useState(null);
  const [overlay,      setOverlay]      = useState(null);

  // Track turn changes for toast notifications
  const prevPhaseRef        = useRef(phase);
  const prevMyTurnRef       = useRef(isMyTurn);
  const prevRoundIdxRef     = useRef(gs?.round_idx);
  const prevTrickWinnerRef  = useRef(null);

  useEffect(() => {
    if (!gs) return;
    const prevPhase  = prevPhaseRef.current;
    const wasMyTurn  = prevMyTurnRef.current;

    // "Your turn to bid!"
    if (phase === 'bidding' && isMyTurn && (!wasMyTurn || prevPhase !== 'bidding')) {
      setToast('Your turn to bid!');
    }
    // "Your turn to play a card!"
    else if (phase === 'playing' && isMyTurn && (!wasMyTurn || prevPhase !== 'playing')) {
      setToast('Your turn to play a card!');
    }
    // Round result overlay
    else if (phase === 'round_result' && prevPhase === 'playing' && gs.round_history?.length) {
      const lastRound = gs.round_history[gs.round_history.length - 1];
      const mySeat    = me?.seat;
      if (mySeat != null && lastRound?.seats?.[mySeat]) {
        const sd    = lastRound.seats[mySeat];
        const delta = scoreRound(sd.bid, sd.tricks_won);
        const hit   = sd.bid === sd.tricks_won;
        setToast(`You won ${delta} pts this round!`);
        setOverlay(hit
          ? { type: 'bid_hit',  message: 'Bid hit!',  sub: `+${delta} pts / Bid ${sd.bid}, got ${sd.tricks_won}` }
          : { type: 'bid_miss', message: 'Missed',    sub: `+0 pts / Bid ${sd.bid}, got ${sd.tricks_won}` }
        );
      }
    }

    prevPhaseRef.current    = phase;
    prevMyTurnRef.current   = isMyTurn;
    prevRoundIdxRef.current = gs?.round_idx;
  }, [phase, isMyTurn, gs?.round_idx, gs?.round_history?.length]);

  // Reset bid input when turn changes
  useEffect(() => {
    if (!isMyTurn || phase !== 'bidding') setBidInput(null);
  }, [isMyTurn, phase]);

  // Trick win overlay for current player
  useEffect(() => {
    if (!gs?.trick || phase !== 'playing') return;
    const trickWinner = gs.trick.winner;
    const prevWinner  = prevTrickWinnerRef.current;
    if (trickWinner != null && trickWinner !== prevWinner && trickWinner === me?.seat) {
      const mySeat   = me?.seat;
      const mySeatData = gs.seats?.[String(mySeat)];
      const tricks   = mySeatData?.tricks_won ?? 0;
      const bid      = mySeatData?.bid ?? 0;
      setOverlay({ type: 'trick_win', message: '✨ You won the trick!', sub: `${tricks}/${bid} tricks` });
    }
    prevTrickWinnerRef.current = trickWinner;
  }, [gs?.trick?.winner, phase]);

  if (!gs || !gs.seats) return <div className="jdg-loading">Loading game…</div>;

  const {
    seats, scores, trick, trump_suit, hand_size, round_idx, round_seq,
    dealer_seat, active_seat, timer_start, round_result_at, round_history,
  } = gs;

  const activePlayers  = players.filter(p => seats[p.seat]?.active !== false);
  const totalRounds    = round_seq?.length || 0;
  const currentRound   = (round_idx || 0) + 1;
  const trumpSymbol    = SUIT_SYMBOLS[trump_suit];
  const trumpColor     = TRUMP_SUIT_COLORS[trump_suit] || '#a78bfa';

  // Helper: find player by seat
  function playerBySeat(seat) {
    return players.find(p => p.seat === seat);
  }
  // Helper: player index for avatar color
  function playerIndex(p) {
    return players.indexOf(p);
  }

  // ── Player Panel ────────────────────────────────────────────────────────────
  function renderPlayerPanel() {
    return (
      <div className="jdg-player-panel">
        {activePlayers.map(p => {
          const seatData  = seats[p.seat];
          if (!seatData) return null;
          const isActive  = p.seat === active_seat;
          const isDealer  = p.seat === dealer_seat;
          const isMe      = p.id === me?.id;
          const hasBid    = seatData.bid !== null;
          const isBidding = phase === 'bidding' && isActive;
          const tricks    = seatData.tricks_won || 0;

          return (
            <div
              key={p.id}
              className={`jdg-player-tile${isActive ? ' active' : ''}${isMe ? ' me' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Avatar name={p.name} index={playerIndex(p)} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#e8eaf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>
                      {p.name}
                    </span>
                    {isDealer && (
                      <span style={{
                        background: '#f59e0b', color: '#000',
                        borderRadius: '3px', padding: '0 5px', fontSize: '0.58rem', fontWeight: 900,
                      }}>D</span>
                    )}
                    {isMe && (
                      <span style={{
                        background: 'rgba(167,139,250,0.2)', color: '#a78bfa',
                        border: '1px solid rgba(167,139,250,0.4)',
                        borderRadius: '3px', padding: '0 5px', fontSize: '0.58rem', fontWeight: 800,
                      }}>YOU</span>
                    )}
                  </div>
                  {/* Bid / tricks status */}
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '2px', display: 'flex', gap: '8px' }}>
                    {phase === 'bidding' && (
                      <span>
                        {isBidding
                          ? <span style={{ color: '#a78bfa' }}>…bidding</span>
                          : hasBid
                            ? <span style={{ color: '#10b981' }}>Bid: {seatData.bid}</span>
                            : <span style={{ color: '#6b7280' }}>?</span>
                        }
                      </span>
                    )}
                    {(phase === 'playing' || phase === 'round_result') && hasBid && (
                      <span style={{ color: tricks >= seatData.bid ? '#10b981' : '#9ca3af' }}>
                        {tricks}/{seatData.bid}
                      </span>
                    )}
                    <span style={{ color: '#6b7280' }}>{scores?.[p.seat] ?? 0} pts</span>
                  </div>
                </div>
              </div>
              {isActive && (phase === 'bidding' || (phase === 'playing' && !trick?.winner)) && (
                <TimerBar timerStart={timer_start} active />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Trick display ───────────────────────────────────────────────────────────
  function renderTrickArea() {
    if (!trick) return null;
    const hasTrick = trick.cards?.length > 0;
    if (!hasTrick && phase !== 'playing') return null;

    const winnerPlayer = trick.winner != null ? playerBySeat(trick.winner) : null;

    return (
      <div className="jdg-trick-area">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <p className="jdg-trick-label" style={{ margin: 0 }}>
            {winnerPlayer
              ? <span style={{ color: '#10b981', fontWeight: 700 }}>✨ {winnerPlayer.name} wins the trick!</span>
              : 'Current Trick'
            }
          </p>
          {trick.led_suit && (
            <span style={{
              fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px',
              background: `${trumpColor}20`, color: trumpColor, fontWeight: 700,
              border: `1px solid ${trumpColor}40`,
            }}>
              Led: {SUIT_SYMBOLS[trick.led_suit]} {SUIT_NAMES[trick.led_suit]}
            </span>
          )}
        </div>
        <div className="jdg-trick-cards">
          {(trick.cards || []).map((tc, i) => {
            const player = playerBySeat(tc.seat);
            const isWinner = trick.winner === tc.seat;
            return (
              <div key={i} className="jdg-trick-slot">
                <div style={{ position: 'relative' }}>
                  <Card card={tc.card} size="lg" highlight={isWinner} cardIndex={i} />
                  {isWinner && (
                    <div style={{
                      position: 'absolute', top: '-8px', right: '-8px',
                      background: '#10b981', borderRadius: '50%', width: '18px', height: '18px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', fontWeight: 900,
                    }}>✓</div>
                  )}
                </div>
                <span className="jdg-trick-name">{player?.name || `Seat ${tc.seat}`}</span>
              </div>
            );
          })}
        </div>
        {!hasTrick && (
          <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: 0, textAlign: 'center', padding: '12px 0' }}>
            Waiting for the first card…
          </p>
        )}
      </div>
    );
  }

  // ── Bidding panel ───────────────────────────────────────────────────────────
  function renderBiddingPanel() {
    if (!canBid) return null;
    const bids = Array.from({ length: hand_size + 1 }, (_, i) => i);
    return (
      <div className="jdg-bidding-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#e8eaf0' }}>
            Your bid <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.78rem' }}>({hand_size} cards in hand)</span>
          </p>
          <Countdown timerStart={timer_start} />
        </div>
        {forbidden !== null && (
          <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⚠</span> You cannot bid {forbidden} (dealer restriction)
          </div>
        )}
        <div className="jdg-bid-grid">
          {bids.map(b => (
            <button
              key={b}
              className={`jdg-bid-btn${bidInput === b ? ' selected' : ''}${forbidden === b ? ' forbidden' : ''}`}
              onClick={() => setBidInput(b)}
              disabled={forbidden === b}
            >
              {b}
            </button>
          ))}
        </div>
        <button
          className="jdg-confirm-btn"
          disabled={bidInput === null || forbidden === bidInput}
          onClick={() => { onPlaceBid(bidInput); setBidInput(null); }}
        >
          Confirm Bid →
        </button>
      </div>
    );
  }

  // ── Waiting message ─────────────────────────────────────────────────────────
  function renderWaiting() {
    if (phase === 'bidding' && !isMyTurn) {
      const waitingPlayer = playerBySeat(active_seat);
      return (
        <div className="jdg-waiting-msg">
          <div style={{ fontSize: '0.95rem', marginBottom: '6px' }}>
            Waiting for <strong style={{ color: '#a78bfa' }}>{waitingPlayer?.name || 'player'}</strong> to bid
          </div>
          {timer_start && <Countdown timerStart={timer_start} />}
        </div>
      );
    }
    if (phase === 'playing' && !isMyTurn && !trick?.winner) {
      const waitingPlayer = playerBySeat(active_seat);
      return (
        <div className="jdg-waiting-msg">
          <div style={{ fontSize: '0.95rem', marginBottom: '6px' }}>
            Waiting for <strong style={{ color: '#a78bfa' }}>{waitingPlayer?.name || 'player'}</strong> to play
          </div>
          {timer_start && <Countdown timerStart={timer_start} />}
        </div>
      );
    }
    return null;
  }

  // ── Hand area ───────────────────────────────────────────────────────────────
  function renderHand() {
    if (!myData?.hand?.length) return null;
    if (phase !== 'bidding' && phase !== 'playing') return null;

    const isBiddingPhase = phase === 'bidding';
    const label = isBiddingPhase
      ? 'Your Hand (bidding phase — cards are not playable yet)'
      : isMyTurn
        ? 'Your turn — play a card'
        : 'Your Hand';

    return (
      <div className="jdg-hand-area">
        <p className="jdg-hand-label">
          {label}
          {phase === 'playing' && isMyTurn && (
            <span style={{ marginLeft: '8px' }}><Countdown timerStart={timer_start} /></span>
          )}
        </p>
        <div className="jdg-hand">
          {myData.hand.map((card, i) => {
            if (isBiddingPhase) {
              return <Card key={i} card={card} size="md" dimmed cardIndex={i} />;
            }
            const isValid = myValidCards.some(c => c.suit === card.suit && c.rank === card.rank);
            return (
              <Card
                key={i}
                card={card}
                size="md"
                dimmed={!canPlay || !isValid}
                highlight={canPlay && isValid}
                onClick={canPlay && isValid ? () => onPlayCard(card) : null}
                cardIndex={i}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ── Round result ────────────────────────────────────────────────────────────
  function renderRoundResult() {
    if (phase !== 'round_result') return null;
    const lastRound   = round_history?.[round_history.length - 1];
    const isLastRound = round_idx >= totalRounds - 1;

    return (
      <div className="jdg-round-result-overlay">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.3rem', color: '#e8eaf0', textAlign: 'center' }}>
          Round {currentRound} Complete!
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '16px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ textAlign: 'left',   padding: '6px 8px', color: '#6b7280', fontWeight: 700 }}>Player</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#6b7280', fontWeight: 700 }}>Bid</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#6b7280', fontWeight: 700 }}>Got</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#6b7280', fontWeight: 700 }}>Delta</th>
              <th style={{ textAlign: 'right',  padding: '6px 8px', color: '#6b7280', fontWeight: 700 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {activePlayers.map(p => {
              const sd = lastRound?.seats?.[p.seat];
              if (!sd) return null;
              const delta = scoreRound(sd.bid, sd.tricks_won);
              const hit   = sd.bid === sd.tricks_won;
              const isMe  = p.id === me?.id;
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: isMe ? 'rgba(124,58,237,0.06)' : 'transparent' }}>
                  <td style={{ padding: '9px 8px', fontWeight: 600, color: '#e8eaf0', borderLeft: `3px solid ${hit ? '#10b981' : 'transparent'}` }}>
                    {p.name}{isMe ? ' (you)' : ''}
                  </td>
                  <td style={{ textAlign: 'center', padding: '9px 8px', color: '#9ca3af' }}>{sd.bid}</td>
                  <td style={{ textAlign: 'center', padding: '9px 8px', color: '#9ca3af' }}>{sd.tricks_won}</td>
                  <td style={{ textAlign: 'center', padding: '9px 8px', fontWeight: 800, color: hit ? '#10b981' : '#6b7280' }}>
                    {hit ? `+${delta}` : '+0'}
                  </td>
                  <td style={{ textAlign: 'right', padding: '9px 8px', fontWeight: 700, color: '#a78bfa' }}>
                    {lastRound.scores_snapshot?.[p.seat] ?? 0} pts
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {isLastRound
            ? <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>Game ending…</p>
            : <p style={{ color: '#9ca3af', fontSize: '0.82rem', margin: 0 }}>
                Next round in <RoundCountdown roundResultAt={round_result_at} />
              </p>
          }
          {isHost && !isLastRound && (
            <button className="jdg-confirm-btn" style={{ width: 'auto', padding: '8px 20px', fontSize: '0.85rem' }} onClick={onNextRound}>
              Start Next Round Now →
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Game over ───────────────────────────────────────────────────────────────
  function renderGameOver() {
    if (phase !== 'game_over') return null;
    const sorted = [...players].sort((a, b) => (scores?.[b.seat] ?? 0) - (scores?.[a.seat] ?? 0));
    const winner = sorted[0];

    return (
      <div className="jdg-game-over">
        <div className="jdg-trophy">🏆</div>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.8rem', color: '#e8eaf0' }}>Game Over!</h2>
        <p style={{ margin: '0 0 24px', color: '#a78bfa', fontWeight: 700, fontSize: '1.1rem' }}>
          {winner?.name} wins!
        </p>
        <div className="jdg-final-scores">
          {sorted.map((p, idx) => {
            const isMe   = p.id === me?.id;
            const isWin  = idx === 0;
            return (
              <div key={p.id} className={`jdg-final-row${isWin ? ' winner' : ''}`}>
                <span className="jdg-rank">
                  {isWin ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </span>
                <Avatar name={p.name} index={playerIndex(p)} size={28} />
                <span className="jdg-final-name">
                  {p.name}{isMe ? ' (you)' : ''}
                </span>
                <span className="jdg-final-score">{scores?.[p.seat] ?? 0} pts</span>
              </div>
            );
          })}
        </div>
        <button
          className="room-btn primary"
          style={{ marginTop: '24px', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', minWidth: '160px' }}
          onClick={onLeave}
        >
          Leave Room
        </button>
      </div>
    );
  }

  // ── Layout ──────────────────────────────────────────────────────────────────
  if (phase === 'game_over') {
    return (
      <div className="jdg-page">
        {renderGameOver()}
        {showHistory && (
          <ScoreHistoryModal
            round_history={round_history}
            players={players}
            seats={seats}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="jdg-page">
      <PageEdgeIndicator />

      {/* Top bar */}
      <div className="jdg-topbar">
        <div className="jdg-topbar-left">
          <span style={{ color: '#a78bfa', fontSize: '1.3rem' }}>♠</span>
          <span className="jdg-game-title">Judgement</span>
          <span className="jdg-round-badge">Round {currentRound}/{totalRounds}</span>
        </div>
        <div className="jdg-topbar-center">
          <span
            className="jdg-trump-badge"
            style={{
              color: trumpColor,
              borderColor: trumpColor,
              background: `${trumpColor}18`,
            }}
          >
            Trump: {trumpSymbol} {SUIT_NAMES[trump_suit]}
          </span>
          <span className="jdg-hand-badge">Hand: {hand_size}</span>
        </div>
        <div className="jdg-topbar-right">
          <button
            onClick={() => setShowHistory(v => !v)}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#9ca3af', borderRadius: '6px', padding: '4px 10px', fontSize: '0.75rem',
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            History
          </button>
          {isHost
            ? <button className="room-btn danger sm" onClick={onClose}>Close</button>
            : <button className="room-btn secondary sm" onClick={onLeave}>Leave</button>
          }
        </div>
      </div>

      {/* Main game layout */}
      <div className="jdg-game-layout">
        {/* Left: Player panel */}
        {renderPlayerPanel()}

        {/* Right: Main area */}
        <div className="jdg-main-content">
          {phase === 'round_result' ? (
            renderRoundResult()
          ) : (
            <>
              {renderTrickArea()}
              {renderWaiting()}
              {renderBiddingPanel()}
            </>
          )}
        </div>
      </div>

      {/* Bottom: Always-visible hand */}
      {renderHand()}

      {/* Result overlays */}
      {overlay && (
        <ResultOverlay result={overlay} onDismiss={() => setOverlay(null)} />
      )}

      {/* Toast */}
      <Toast message={toast} onDone={() => setToast(null)} />

      {/* Score history modal */}
      {showHistory && (
        <ScoreHistoryModal
          round_history={round_history}
          players={players}
          seats={seats}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
