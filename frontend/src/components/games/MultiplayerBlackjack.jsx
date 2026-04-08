import { useState, useEffect } from 'react';
import { handScore, isBlackjack } from '../../lib/deck';
import { useGameStore } from '../../store/gameStore';
import PageEdgeIndicator from '../PageEdgeIndicator';
import '../../styles/MultiplayerBJ.css';

const CHIP_VALUES = [
  { value: 5,   color: '#e63946' },
  { value: 10,  color: '#3b82f6' },
  { value: 25,  color: '#22c55e' },
  { value: 50,  color: '#f97316' },
  { value: 100, color: '#a855f7' },
];

export default function MultiplayerBlackjack({
  onPlaceBet, onDeal, onHit, onStand, onDoubleDown,
  onNewRound, onLeave, onClose,
}) {
  // Read from store
  const room      = useGameStore(s => s.room);
  const players   = useGameStore(s => s.players);
  const me        = useGameStore(s => s.me);
  const isHost    = useGameStore(s => s.isHost);
  const gs        = useGameStore(s => s.gs);
  const phase     = useGameStore(s => s.phase);
  const isMyTurn  = useGameStore(s => s.isMyTurn);
  const myData    = useGameStore(s => s.myData);
  const canAct    = useGameStore(s => s.canAct);
  const canBet    = useGameStore(s => s.canBet);
  const canDouble = useGameStore(s => s.canDouble);

  const [localBet, setLocalBet]  = useState(0);
  const [betLocked, setBetLocked] = useState(false);
  const [acting, setActing]      = useState(false);

  const myBalance = players.find(p => p.id === me?.id)?.balance ?? 1000;
  const dealerHand = gs?.dealer_hand || [];
  const seats = gs?.seats || {};
  const activeSeat = gs?.active_seat;

  // Reset local bet state on new round
  useEffect(() => {
    if (phase === 'betting') {
      setLocalBet(0);
      setBetLocked(false);
      setActing(false);
    }
  }, [phase, gs?.round]);

  // ── Betting ──────────────────────────────────────────────────────────────────
  async function handlePlaceBet() {
    if (localBet === 0 || betLocked || !canBet) return;
    setBetLocked(true);
    await onPlaceBet(localBet);
  }

  const betsPlaced = Object.values(seats).filter(s => s.action === 'bet_placed').length;
  const canDeal = isHost && betsPlaced > 0;

  // ── Playing ───────────────────────────────────────────────────────────────────
  async function doAction(fn) {
    if (acting) return;
    setActing(true);
    await fn();
    setActing(false);
  }

  // ── Result ───────────────────────────────────────────────────────────────────
  const myResult = me?.seat ? seats[me.seat] : null;

  // ── Dealer score display ──────────────────────────────────────────────────────
  const dealerVisible = dealerHand.filter(c => !c.hidden);
  const dealerScore   = dealerVisible.length ? handScore(dealerVisible) : null;
  const dealerFull    = phase === 'result' || phase === 'dealer'
    ? handScore(dealerHand.map(c => ({ ...c, hidden: false })))
    : null;

  return (
    <div className="mbj-page">
      <PageEdgeIndicator />

      {/* ── Top bar ── */}
      <header className="mbj-header">
        <div className="mbj-header-left">
          <span className="mbj-suit">♦</span>
          <span className="mbj-title">Blackjack</span>
          <span className="mbj-room-code">{room?.code}</span>
        </div>
        <div className="mbj-header-right">
          <span className="mbj-balance">
            <span className="mbj-balance-label">You</span>
            <strong>{me?.name}</strong>
            <span className="mbj-balance-chip">${myBalance}</span>
          </span>
          <button className="mbj-exit-btn" onClick={isHost ? onClose : onLeave}>
            {isHost ? 'Close' : 'Leave'}
          </button>
        </div>
      </header>

      {/* ── Table ── */}
      <div className="mbj-table">

        {/* Dealer */}
        <div className="mbj-dealer-zone">
          <div className="mbj-zone-label">
            Dealer
            {dealerScore !== null && (
              <span className="mbj-score">
                {phase === 'result' || phase === 'dealer' ? dealerFull : `${dealerScore}+?`}
              </span>
            )}
          </div>
          <div className="mbj-hand">
            {dealerHand.length === 0
              ? <MBJCardPlaceholder />
              : dealerHand.map((c, i) => <MBJCard key={i} card={c} index={i} />)
            }
          </div>
        </div>

        {/* Phase indicator */}
        <div className="mbj-phase-strip">
          <PhaseIndicator phase={phase} activeSeat={activeSeat} players={players} seats={seats} />
        </div>

        {/* All player seats */}
        <div className="mbj-seats-grid">
          {players.map(player => {
            const seatData  = seats[player.seat] || {};
            const hand      = seatData.hand || [];
            const score     = hand.length ? handScore(hand) : null;
            const isMe      = player.id === me?.id;
            const isActive  = player.seat === activeSeat;
            const action    = seatData.action;
            const outcome   = phase === 'result' ? seatData.outcome : null;

            return (
              <div
                key={player.id}
                className={[
                  'mbj-seat',
                  isMe     ? 'mbj-seat-me'     : '',
                  isActive ? 'mbj-seat-active'  : '',
                  outcome  ? `mbj-seat-${outcome}` : '',
                ].join(' ')}
              >
                <div className="mbj-seat-header">
                  <span className="mbj-seat-name">
                    {player.name}
                    {isMe && <span className="mbj-you-tag">You</span>}
                    {isMe && isMyTurn && <span className="mbj-your-turn-badge">YOUR TURN</span>}
                  </span>
                  <div className="mbj-seat-meta">
                    {seatData.bet > 0 && (
                      <span className="mbj-seat-bet">Bet: ${seatData.bet}</span>
                    )}
                    {action && action !== 'bet_placed' && action !== 'sitting_out' && (
                      <span className={`mbj-action-tag mbj-action-${action}`}>
                        {actionLabel(action)}
                      </span>
                    )}
                    {action === 'sitting_out' && (
                      <span className="mbj-action-tag mbj-action-sit">Sitting out</span>
                    )}
                  </div>
                </div>

                <div className="mbj-hand">
                  {hand.length === 0
                    ? <MBJCardPlaceholder />
                    : hand.map((c, i) => <MBJCard key={i} card={c} index={i} />)
                  }
                </div>

                {score !== null && (
                  <div className={`mbj-score-row ${score > 21 ? 'bust' : score === 21 ? 'max' : ''}`}>
                    {score > 21 ? 'Bust' : isBlackjack(hand) ? '♦ Blackjack' : score}
                  </div>
                )}

                {outcome && (
                  <div className={`mbj-outcome mbj-outcome-${outcome}`}>
                    {outcomeLabel(outcome, seatData.payout, seatData.bet)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="mbj-controls">

        {/* Betting phase */}
        {phase === 'betting' && (
          <div className="mbj-betting-panel">
            {!betLocked ? (
              <>
                <div className="mbj-bet-row">
                  <span className="mbj-bet-label">Your Bet</span>
                  <span className="mbj-bet-amount">${localBet}</span>
                  <button
                    className="room-btn secondary sm"
                    onClick={() => setLocalBet(0)}
                    disabled={localBet === 0}
                  >Clear</button>
                </div>
                <div className="mbj-chips">
                  {CHIP_VALUES.map(chip => (
                    <button
                      key={chip.value}
                      className="mbj-chip"
                      style={{ '--chip-color': chip.color }}
                      onClick={() => setLocalBet(b => Math.min(b + chip.value, myBalance))}
                      disabled={!canBet || betLocked || localBet + chip.value > myBalance}
                    >
                      ${chip.value}
                    </button>
                  ))}
                </div>
                <button
                  className="room-btn primary full"
                  onClick={handlePlaceBet}
                  disabled={localBet === 0 || betLocked || !canBet}
                >
                  Confirm Bet →
                </button>
              </>
            ) : (
              <div className="mbj-bet-confirmed">
                ✓ Bet of ${localBet} placed — waiting for others…
              </div>
            )}

            {isHost && (
              <div className="mbj-deal-row">
                <span className="mbj-deal-hint">
                  {betsPlaced}/{Object.keys(seats).length} players bet
                </span>
                <button
                  className="room-btn primary"
                  onClick={onDeal}
                  disabled={!canDeal}
                >
                  Deal Cards
                </button>
              </div>
            )}
          </div>
        )}

        {/* Playing phase — only for active player */}
        {canAct && (
          <div className="mbj-action-panel">
            <div className="mbj-your-turn">Your turn!</div>
            <div className="mbj-action-btns">
              <button
                className="mbj-action-btn hit"
                onClick={() => doAction(onHit)}
                disabled={acting}
              >Hit</button>
              <button
                className="mbj-action-btn stand"
                onClick={() => doAction(onStand)}
                disabled={acting}
              >Stand</button>
              {canDouble && (
                <button
                  className="mbj-action-btn double"
                  onClick={() => doAction(onDoubleDown)}
                  disabled={acting}
                >Double</button>
              )}
            </div>
          </div>
        )}

        {/* Playing phase — waiting */}
        {phase === 'playing' && !isMyTurn && (
          <div className="mbj-waiting-panel">
            <span className="mbj-waiting-dot" />
            {(() => {
              const activeP = players.find(p => p.seat === activeSeat);
              return activeP
                ? `Waiting for ${activeP.id === me?.id ? 'you' : activeP.name}…`
                : 'Waiting…';
            })()}
          </div>
        )}

        {/* Dealer playing */}
        {phase === 'dealer' && (
          <div className="mbj-waiting-panel">
            <span className="mbj-waiting-dot" />
            Dealer is playing…
          </div>
        )}

        {/* Result */}
        {phase === 'result' && (
          <div className="mbj-result-panel">
            {myResult && (
              <div className={`mbj-my-result mbj-result-${myResult.outcome}`}>
                {outcomeLabel(myResult.outcome, myResult.payout, myResult.bet)}
              </div>
            )}
            {isHost && (
              <button className="room-btn primary full" onClick={onNewRound}>
                New Round →
              </button>
            )}
            {!isHost && (
              <p className="mbj-waiting-host">Waiting for host to start next round…</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function actionLabel(action) {
  return { stand: 'Stand', bust: 'Bust', done: '21!', double: 'Double', blackjack: 'Blackjack!' }[action] || action;
}

function outcomeLabel(outcome, payout, bet) {
  if (outcome === 'win')       return `✓ Win +$${payout - bet}`;
  if (outcome === 'blackjack') return `♦ Blackjack +$${payout - bet}`;
  if (outcome === 'push')      return `= Push`;
  if (outcome === 'lose')      return `✗ Lost $${bet}`;
  if (outcome === 'bust')      return `✗ Bust — Lost $${bet}`;
  return outcome;
}

function PhaseIndicator({ phase, activeSeat, players, seats }) {
  const labels = {
    betting: '♦ Place your bets',
    playing: activeSeat
      ? `${players.find(p => p.seat === activeSeat)?.name || '?'}'s turn`
      : 'Playing…',
    dealer: '♦ Dealer playing',
    result: '♦ Round over',
  };
  return <span className="mbj-phase-label">{labels[phase] || phase}</span>;
}

// ── Card components ───────────────────────────────────────────────────────────

function MBJCard({ card, index }) {
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

function MBJCardPlaceholder() {
  return <div className="bj-card-placeholder" />;
}
