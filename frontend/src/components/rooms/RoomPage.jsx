/**
 * RoomPage — smart router loaded at /rooms/:code
 *
 * Scenarios:
 *  1. Visitor has no session for this room → show join form
 *  2. Visitor has a valid session → show lobby or game depending on room.status
 *  3. Room is closed → redirect to home
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { loadSession, saveSession } from '../../lib/session';
import { joinRoom } from '../../lib/api';
import RoomLobby from './RoomLobby';
import MultiplayerBlackjack from '../games/MultiplayerBlackjack';
import { useRoom } from '../../hooks/useRoom';
import '../../styles/Room.css';

// ── Join form shown when visiting a shared link without a session ─────────────
function JoinViaLink({ code }) {
  const navigate    = useNavigate();
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name.');
    setLoading(true);
    setError('');
    try {
      const result = await joinRoom(code, name.trim());
      saveSession({ roomCode: result.room_code, playerToken: result.player_token, playerName: name.trim(), isHost: false });
      navigate(`/rooms/${code}`);
    } catch (err) {
      setError(err.message || 'Could not join room. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="room-page">
      <div className="room-entry-card">
        <div className="room-entry-logo">
          <span className="room-suit">♦</span>
          <h1>Join Room</h1>
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
            className="room-btn primary full"
            disabled={loading || !name.trim()}
          >
            {loading ? 'Joining…' : 'Join Room →'}
          </button>
        </form>
        <button className="room-solo-link" onClick={() => navigate('/rooms')}>
          ← Back to lobby
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RoomPage() {
  const { code }  = useParams();
  const session   = loadSession();
  const hasSession = session && session.roomCode === code && session.playerToken;

  if (!hasSession) return <JoinViaLink code={code} />;
  return <RoomWithSession code={code} />;
}

function RoomWithSession({ code }) {
  const navigate = useNavigate();

  const {
    room, players, me, loading, error,
    isHost, gs, phase, isMyTurn, myData, canDouble,
    leaveRoom, closeRoom, startGame,
    placeBet, deal, hit, stand, doubleDown, newRound,
  } = useRoom(code);

  // Auto-navigate away when the room gets closed
  useEffect(() => {
    if (error && error.includes('closed')) {
      const timer = setTimeout(() => navigate('/'), 2500);
      return () => clearTimeout(timer);
    }
  }, [error, navigate]);

  // ── Wrappers that navigate after leave/close ──────────────────────────────
  async function handleLeave() {
    await leaveRoom();
    navigate('/');
  }

  async function handleClose() {
    await closeRoom();
    navigate('/');
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="room-page room-loading">
      <div className="room-spinner" />
      <p>Connecting to room…</p>
    </div>
  );

  // ── Error / closed ────────────────────────────────────────────────────────
  if (error) return (
    <div className="room-page room-error-page">
      <div className="room-entry-card">
        <p className="room-error large">{error}</p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center' }}>
          Redirecting you home…
        </p>
        <button className="room-btn primary" onClick={() => navigate('/')}>
          Go Home
        </button>
      </div>
    </div>
  );

  if (!room) return null;

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (room.status === 'waiting') {
    return (
      <RoomLobby
        room={room} players={players} me={me} isHost={isHost}
        onStart={startGame}
        onLeave={handleLeave}
        onClose={handleClose}
      />
    );
  }

  // ── Game ──────────────────────────────────────────────────────────────────
  if (room.status === 'playing') {
    return (
      <MultiplayerBlackjack
        room={room} players={players} me={me} isHost={isHost}
        gs={gs} phase={phase} isMyTurn={isMyTurn} myData={myData} canDouble={canDouble}
        onPlaceBet={placeBet} onDeal={deal}
        onHit={hit} onStand={stand} onDoubleDown={doubleDown}
        onNewRound={newRound}
        onLeave={handleLeave}
        onClose={handleClose}
      />
    );
  }

  // ── Closed ────────────────────────────────────────────────────────────────
  return (
    <div className="room-page room-error-page">
      <div className="room-entry-card">
        <p className="room-error large">This room has been closed.</p>
        <button className="room-btn primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    </div>
  );
}
