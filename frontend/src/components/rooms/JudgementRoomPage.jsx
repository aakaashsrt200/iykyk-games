/**
 * JudgementRoomPage — router at /games/judgement/:code
 *
 * Scenarios:
 *  1. No session for this room → show join form
 *  2. Valid session → lobby or game
 *  3. Room closed → redirect home
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useEffect } from 'react';
import { loadSession, saveSession, uuid } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { broadcastRoomEvent } from '../../hooks/useRoom';
import { useJudgementRoom } from '../../hooks/useJudgementRoom';
import JudgementLobby from './JudgementLobby';
import JudgementGame from '../games/JudgementGame';
import '../../styles/Room.css';

// ── Join form for shared-link visitors ────────────────────────────────────────
function JoinViaLink({ code }) {
  const navigate              = useNavigate();
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name.');
    setLoading(true);
    setError('');

    const { data: room } = await supabase.from('rooms').select('*').eq('code', code).single();
    if (!room)                   { setError('Room not found.');             setLoading(false); return; }
    if (room.status === 'closed'){ setError('This room is closed.');        setLoading(false); return; }
    if (room.status === 'playing'){ setError('Game already in progress.'); setLoading(false); return; }

    const { data: existing } = await supabase
      .from('players').select('id').eq('room_id', room.id).eq('status', 'active');
    if ((existing?.length || 0) >= room.max_players) {
      setError('Room is full.'); setLoading(false); return;
    }

    const playerToken = uuid();
    const seat        = (existing?.length || 0) + 1;
    const { error: insertErr } = await supabase.from('players').insert({
      room_id: room.id, name: name.trim(), player_token: playerToken, seat, is_host: false,
    });
    if (insertErr) { setError('Could not join. Try again.'); setLoading(false); return; }

    saveSession({ roomCode: code, playerToken, playerName: name.trim(), isHost: false });
    broadcastRoomEvent(code, 'players_updated');
    navigate(`/games/judgement/${code}`);
  }

  return (
    <div className="room-page">
      <div className="room-entry-card">
        <div className="room-entry-logo">
          <span className="room-suit" style={{ color: '#a78bfa' }}>♠</span>
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
            className="room-btn primary"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}
            disabled={loading || !name.trim()}
          >
            {loading ? 'Joining…' : 'Join Room →'}
          </button>
        </form>
        <button className="room-solo-link" onClick={() => navigate('/games/judgement')}>← Back</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function JudgementRoomPage() {
  const { code }   = useParams();
  const session    = loadSession();
  const hasSession = session && session.roomCode === code && session.playerToken;

  if (!hasSession) return <JoinViaLink code={code} />;
  return <RoomWithSession code={code} />;
}

function RoomWithSession({ code }) {
  const navigate = useNavigate();

  const {
    room, players, me, loading, error,
    isHost, gs, phase, isMyTurn, myData, myValidCards, forbidden,
    leaveRoom, closeRoom, startGame,
    placeBid, playCard, startNextRound,
  } = useJudgementRoom(code);

  useEffect(() => {
    if (error && error.includes('closed')) {
      const timer = setTimeout(() => navigate('/'), 2500);
      return () => clearTimeout(timer);
    }
  }, [error, navigate]);

  async function handleLeave() { await leaveRoom(); navigate('/'); }
  async function handleClose() { await closeRoom(); navigate('/'); }

  if (loading) return (
    <div className="room-page room-loading">
      <div className="room-spinner" />
      <p>Connecting to room…</p>
    </div>
  );

  if (error) return (
    <div className="room-page room-error-page">
      <div className="room-entry-card">
        <p className="room-error large">{error}</p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center' }}>Redirecting you home…</p>
        <button className="room-btn primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    </div>
  );

  if (!room) return null;

  if (room.status === 'waiting') {
    return (
      <JudgementLobby
        room={room} players={players} me={me} isHost={isHost}
        onStart={startGame}
        onLeave={handleLeave}
        onClose={handleClose}
      />
    );
  }

  if (room.status === 'playing') {
    return (
      <JudgementGame
        room={room} players={players} me={me} isHost={isHost}
        gs={gs} phase={phase} isMyTurn={isMyTurn} myData={myData}
        myValidCards={myValidCards} forbidden={forbidden}
        onPlaceBid={placeBid} onPlayCard={playCard}
        onNextRound={startNextRound}
        onLeave={handleLeave}
        onClose={handleClose}
      />
    );
  }

  return (
    <div className="room-page room-error-page">
      <div className="room-entry-card">
        <p className="room-error large">This room has been closed.</p>
        <button className="room-btn primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    </div>
  );
}
