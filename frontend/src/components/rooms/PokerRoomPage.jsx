/**
 * PokerRoomPage — multiplayer Texas Hold'em via WebSocket.
 * Route: /games/poker/rooms/:code
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { loadSession, saveSession } from '../../lib/session';
import { joinRoom } from '../../lib/api';
import { usePokerRoom } from '../../hooks/usePokerRoom';
import { useGameStore } from '../../store/gameStore';
import { bestHand } from '../../lib/poker.js';
import '../../styles/Room.css';
import '../../styles/Poker.css';

// ── Join form for shared-link visitors ────────────────────────────────────────
function JoinViaLink({ code }) {
  const navigate = useNavigate();
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name.');
    setLoading(true); setError('');
    try {
      const result = await joinRoom(code, name.trim());
      saveSession({ roomCode: result.room_code, playerToken: result.player_token, playerName: name.trim(), isHost: false });
      navigate(`/games/poker/rooms/${code}`);
    } catch (err) {
      setError(err.message || 'Could not join. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="room-page">
      <div className="room-entry-card">
        <div className="room-entry-logo">
          <span className="room-suit" style={{ color: '#f59e0b' }}>♠</span>
          <h1>Join Poker Room</h1>
        </div>
        <div className="room-code-display">
          <span className="room-code-badge">{code.toUpperCase()}</span>
        </div>
        <form onSubmit={handleJoin} className="room-form">
          <div className="room-field">
            <label>Your Name</label>
            <input
              className="room-input"
              type="text"
              placeholder="Enter your name"
              maxLength={20}
              value={name}
              autoFocus
              onChange={e => { setName(e.target.value); setError(''); }}
            />
          </div>
          {error && <p className="room-error">{error}</p>}
          <button
            type="submit"
            className="room-btn primary"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
            disabled={loading || !name.trim()}
          >
            {loading ? 'Joining…' : 'Join Room →'}
          </button>
        </form>
        <button className="room-solo-link" onClick={() => navigate('/games/poker/rooms')}>← Back</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PokerRoomPage() {
  const { code }   = useParams();
  const session    = loadSession();
  const hasSession = session && session.roomCode === code && session.playerToken;
  if (!hasSession) return <JoinViaLink code={code} />;
  return <RoomWithSession code={code} />;
}

function RoomWithSession({ code }) {
  const navigate = useNavigate();
  const { startGame, nextHand, pokerAction, leaveRoom } = usePokerRoom(code);

  const room    = useGameStore(s => s.room);
  const players = useGameStore(s => s.players);
  const me      = useGameStore(s => s.me);
  const loading = useGameStore(s => s.loading);
  const error   = useGameStore(s => s.error);

  const gs        = room?.game_state || null;
  const status    = room?.status;
  const isHost    = me?.is_host;
  const myToken   = loadSession()?.playerToken;
  const myDbSeat  = me ? String(me.seat) : null;

  // ── Render loading / error ─────────────────────────────────────────────────

  if (error) {
    return (
      <div className="room-page room-error-page">
        <p className="room-error large">{error}</p>
        <button className="room-btn secondary" onClick={() => navigate('/games/poker/rooms')}>
          Back to Lobby
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="room-page room-loading">
        <div className="room-spinner" />
        <p>Connecting…</p>
      </div>
    );
  }

  // ── Lobby (waiting for players) ────────────────────────────────────────────

  if (status === 'waiting') {
    return (
      <div className="room-page lobby-page">
        <div className="lobby-card">
          <div className="lobby-header">
            <div className="lobby-title-row">
              <span style={{ color: '#f59e0b', fontSize: '1.2rem' }}>♠</span>
              <h2>Texas Hold'em</h2>
              <span className="lobby-badge">BETA</span>
            </div>
            <div className="lobby-code-section">
              <div className="lobby-code-label">Room Code</div>
              <div className="lobby-code-row">
                <span className="lobby-code">{code.toUpperCase()}</span>
                <button
                  className="room-btn secondary sm copy-btn"
                  onClick={() => navigator.clipboard.writeText(code)}
                >
                  Copy
                </button>
              </div>
              <p className="lobby-share-hint">Share this code with friends to invite them.</p>
            </div>
          </div>

          <div>
            <div className="lobby-section-label">Players ({players.length}/4)</div>
            <div className="lobby-player-list">
              {players.map(p => (
                <div key={p.id} className={`lobby-player ${p.player_token === myToken ? 'me' : ''}`}>
                  <span className="lobby-player-suit" style={{ color: '#f59e0b' }}>♠</span>
                  <div className="lobby-player-name">
                    {p.name}
                    {p.player_token === myToken && <span className="lobby-you-tag">YOU</span>}
                    {p.is_host && <span className="lobby-host-tag">HOST</span>}
                  </div>
                  <div className="lobby-player-right">
                    <span className="lobby-player-balance">${p.balance || 500}</span>
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="lobby-player empty">
                  <span className="lobby-player-suit dim">♠</span>
                  <span className="lobby-player-name dim">Waiting for player…</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lobby-actions">
            {isHost ? (
              <>
                {players.length < 2 && (
                  <p className="lobby-waiting">Need at least 2 players to start.</p>
                )}
                <button
                  className="room-btn primary full"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
                  onClick={startGame}
                  disabled={players.length < 2}
                >
                  Start Game →
                </button>
              </>
            ) : (
              <p className="lobby-waiting">Waiting for host to start the game…</p>
            )}
            <div className="lobby-secondary-actions">
              <button className="room-btn danger sm" onClick={() => { leaveRoom(); navigate('/games/poker/rooms'); }}>
                Leave Room
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Game in progress ───────────────────────────────────────────────────────

  if (!gs) return null;

  const gsPlayers = gs.players || {};
  const community = gs.community_cards || [];
  const pot       = gs.pot || 0;
  const phase     = gs.phase || 'preflop';
  const activeSeat = gs.active_seat;
  const dealerSeat = gs.dealer_seat;
  const sbSeat     = gs.sb_seat;
  const bbSeat     = gs.bb_seat;
  const winners    = gs.winners || null;
  const currentBet = gs.current_bet || 0;

  const myGsData = myDbSeat ? gsPlayers[myDbSeat] : null;
  const isMyTurn = activeSeat === myDbSeat;
  const myBet    = myGsData?.bet || 0;
  const myChips  = myGsData?.chips || 0;
  const toCall   = Math.max(0, currentBet - myBet);
  const canCheck = toCall === 0;
  const minRaise = Math.max(currentBet + 10, 20);
  const [raiseAmt, setRaiseAmt] = useState(minRaise);

  const SEAT_POSITIONS = ['bottom', 'left', 'top', 'right'];
  const seatList = Object.values(gsPlayers).sort((a, b) => Number(a.seat) - Number(b.seat));
  const myIdx = seatList.findIndex(p => p.seat === myDbSeat);

  return (
    <div className="pk-page pk-game-page">
      <header className="pk-header">
        <button className="pk-back" onClick={() => navigate('/games/poker/rooms')}>← Lobby</button>
        <div className="pk-header-center">
          <span className="pk-header-suit">♠</span>
          <span className="pk-header-title">Texas Hold'em</span>
          <span className="pk-beta-badge">BETA</span>
        </div>
        <div className="pk-pot-pill">
          <span className="pk-pot-label">Pot</span>
          <span className="pk-pot-value">${pot}</span>
        </div>
      </header>

      {/* Context bar */}
      <div className="pk-context-bar">
        <span className="pk-ctx-item">
          <span className="pk-ctx-badge dealer">D</span>
          {gsPlayers[dealerSeat]?.name}
        </span>
        <span className="pk-ctx-sep">·</span>
        <span className="pk-ctx-item">
          <span className="pk-ctx-badge sb">SB</span>
          {gsPlayers[sbSeat]?.name} $5
        </span>
        <span className="pk-ctx-sep">·</span>
        <span className="pk-ctx-item">
          <span className="pk-ctx-badge bb">BB</span>
          {gsPlayers[bbSeat]?.name} $10
        </span>
        <span className="pk-ctx-sep">·</span>
        <span className="pk-ctx-phase">{phase.toUpperCase()}</span>
      </div>

      <div className="pk-layout">
        {/* No hand guide in multiplayer — keep it focused */}
        <main className="pk-main" style={{ flex: '1' }}>
          <div className="pk-table-wrap">
            <div className="pk-felt">
              <div className="pk-community-area">
                {community.length === 0 ? (
                  <div className="pk-community-placeholder">Waiting for flop…</div>
                ) : (
                  <div className="pk-community-cards">
                    {community.map((card, i) => (
                      <MPCard key={i} card={card} index={i} />
                    ))}
                  </div>
                )}
              </div>

              {seatList.map((p, i) => {
                const offset = (i - (myIdx >= 0 ? myIdx : 0) + seatList.length) % seatList.length;
                const seat = SEAT_POSITIONS[offset] || 'top';
                const isActive = p.seat === activeSeat && phase !== 'showdown';
                const isWinner = winners?.includes(p.seat);
                const isMe = p.seat === myDbSeat;
                const handEval = (phase === 'showdown' || winners) && !p.folded
                  ? bestHand(p.hole_cards || [], community)
                  : null;

                return (
                  <div
                    key={p.seat}
                    className={[
                      'pk-seat', `pk-seat-${seat}`,
                      isActive ? 'pk-active' : '',
                      p.folded  ? 'pk-folded' : '',
                      isWinner  ? 'pk-winner' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="pk-seat-chip">
                      <div className="pk-seat-top-row">
                        <span className="pk-seat-avatar">♠</span>
                        <span className="pk-seat-name">{p.name}{isMe ? ' (You)' : ''}</span>
                        {p.seat === dealerSeat && <span className="pk-role-badge pk-dealer-d">D</span>}
                        {p.seat === sbSeat && p.seat !== dealerSeat && <span className="pk-role-badge pk-sb-badge">SB</span>}
                        {p.seat === bbSeat && <span className="pk-role-badge pk-bb-badge">BB</span>}
                      </div>
                      <div className="pk-seat-chips">${p.chips}</div>
                      {p.bet > 0 && <div className="pk-seat-bet">Bet ${p.bet}</div>}
                      {p.all_in  && <div className="pk-status-tag pk-allin">ALL IN</div>}
                      {p.folded  && <div className="pk-status-tag pk-fold-tag">FOLDED</div>}
                      {isWinner  && <div className="pk-status-tag pk-win-tag">WINNER</div>}
                      {handEval  && <div className="pk-hand-eval">{handEval.name}</div>}
                    </div>
                    <div className={`pk-hole-cards ${isMe ? 'pk-yours' : ''}`}>
                      {(p.hole_cards || []).map((card, ci) => (
                        <MPCard key={ci} card={card} index={ci} small={!isMe} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Controls */}
          <div className="pk-controls">
            {phase === 'showdown' && winners ? (
              <div className="pk-showdown-bar">
                <span className="pk-showdown-msg">
                  {winners.length === 1
                    ? `${gsPlayers[winners[0]]?.name} wins!`
                    : 'Split pot!'}
                </span>
                {isHost && (
                  <button className="pk-primary-btn pk-btn-inline" onClick={nextHand}>
                    Next Hand →
                  </button>
                )}
                {!isHost && <span style={{ fontSize: '0.8rem', color: 'var(--text-4)' }}>Waiting for host…</span>}
              </div>
            ) : isMyTurn && myGsData && !myGsData.folded ? (
              <div className="pk-action-panel">
                <div className="pk-action-context">
                  {toCall > 0
                    ? <span className="pk-call-context">To call: <strong>${toCall}</strong>{toCall === 10 && phase === 'preflop' ? ' (Big Blind)' : ''}</span>
                    : <span className="pk-call-context">Your turn — free to check or bet</span>
                  }
                </div>
                <div className="pk-action-row">
                  <button className="pk-btn pk-btn-fold" onClick={() => pokerAction('fold')}>Fold</button>
                  {canCheck
                    ? <button className="pk-btn pk-btn-check" onClick={() => pokerAction('check')}>Check</button>
                    : <button className="pk-btn pk-btn-call" onClick={() => pokerAction('call')} disabled={myChips < toCall}>Call ${toCall}</button>
                  }
                  {myChips > toCall && (
                    <button className="pk-btn pk-btn-raise" onClick={() => pokerAction('raise', raiseAmt)}>
                      {canCheck ? 'Bet' : 'Raise'} ${raiseAmt}
                    </button>
                  )}
                </div>
                {myChips > toCall && (
                  <div className="pk-raise-row">
                    <span className="pk-raise-label">${minRaise}</span>
                    <input
                      type="range"
                      className="pk-slider"
                      min={minRaise}
                      max={myChips + myBet}
                      step={10}
                      value={raiseAmt}
                      onChange={e => setRaiseAmt(Number(e.target.value))}
                    />
                    <span className="pk-raise-label">${myChips + myBet}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="pk-waiting-bar">
                <span className="pk-waiting-dot" />
                <span className="pk-waiting-text">
                  {activeSeat && gsPlayers[activeSeat]
                    ? `${gsPlayers[activeSeat].name} is acting…`
                    : 'Waiting…'}
                </span>
              </div>
            )}
          </div>
        </main>

        {/* Right: game log */}
        <aside className="pk-side pk-live-feed">
          <div className="pk-feed-title">Live Action</div>
          <div className="pk-feed-scroll">
            {(gs.log || []).slice(-20).map((entry, i) => {
              const isPhase = entry.startsWith('──');
              return (
                <div key={i} className={isPhase ? 'pk-feed-phase' : 'pk-feed-entry'}>
                  {isPhase ? entry : <span className="pk-feed-what">{entry}</span>}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MPCard({ card, index, small }) {
  if (card.hidden) {
    return (
      <div className={`pk-card pk-card-back ${small ? 'pk-card-sm' : ''}`} style={{ '--ci': index }}>
        <div className="pk-card-back-inner" />
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
