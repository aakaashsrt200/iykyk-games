import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { generateRoomCode, saveSession, uuid } from '../../lib/session';
import { broadcastRoomEvent } from '../../hooks/useRoom';
import '../../styles/Room.css';

export default function RoomsIndex() {
  const navigate = useNavigate();
  const [mode, setMode]       = useState(null);      // null | 'create' | 'join'
  const [name, setName]       = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name first.');
    setLoading(true);
    setError('');

    const code         = generateRoomCode();
    const playerToken  = uuid();

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({ code, host_token: playerToken, game_type: 'blackjack', max_players: 8 })
      .select()
      .single();

    if (roomErr) { setError('Could not create room. Try again.'); setLoading(false); return; }

    const { error: playerErr } = await supabase
      .from('players')
      .insert({ room_id: room.id, name: name.trim(), player_token: playerToken, seat: 1, is_host: true });

    if (playerErr) { setError('Could not join room. Try again.'); setLoading(false); return; }

    saveSession({ roomCode: code, playerToken, playerName: name.trim(), isHost: true });
    navigate(`/rooms/${code}`);
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim())     return setError('Enter your name first.');
    if (!joinCode.trim()) return setError('Enter the room code.');
    setLoading(true);
    setError('');

    const code = joinCode.trim().toLowerCase();

    const { data: room, error: roomErr } = await supabase
      .from('rooms').select('*').eq('code', code).single();

    if (roomErr || !room) { setError('Room not found. Check the code.'); setLoading(false); return; }
    if (room.status === 'closed') { setError('This room is already closed.'); setLoading(false); return; }
    if (room.status === 'playing') { setError('Game already in progress.'); setLoading(false); return; }

    const { data: existing } = await supabase
      .from('players').select('id').eq('room_id', room.id).eq('status', 'active');

    if ((existing?.length || 0) >= room.max_players) {
      setError('Room is full (8 players max).'); setLoading(false); return;
    }

    const playerToken = uuid();
    const seat        = (existing?.length || 0) + 1;

    const { error: playerErr } = await supabase
      .from('players')
      .insert({ room_id: room.id, name: name.trim(), player_token: playerToken, seat, is_host: false });

    if (playerErr) { setError('Could not join room. Try again.'); setLoading(false); return; }

    saveSession({ roomCode: code, playerToken, playerName: name.trim(), isHost: false });
    broadcastRoomEvent(code, 'players_updated'); // fire-and-forget
    navigate(`/rooms/${code}`);
  }

  return (
    <div className="room-page">
      <div className="room-entry-card">
        <div className="room-entry-logo">
          <span className="room-suit">♦</span>
          <h1>IYKYK Games</h1>
        </div>
        <p className="room-entry-sub">Multiplayer Blackjack · Up to 8 players</p>

        {/* Name input — always visible */}
        <div className="room-field">
          <label>Your Name</label>
          <input
            className="room-input"
            type="text"
            placeholder="Enter your name"
            maxLength={20}
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
          />
        </div>

        {/* Mode selection */}
        {!mode && (
          <div className="room-mode-btns">
            <button className="room-btn primary" onClick={() => setMode('create')}>
              Create Room
            </button>
            <button className="room-btn secondary" onClick={() => setMode('join')}>
              Join Room
            </button>
          </div>
        )}

        {/* Create form */}
        {mode === 'create' && (
          <form onSubmit={handleCreate} className="room-form">
            <p className="room-hint">A unique room code will be generated for you to share.</p>
            {error && <p className="room-error">{error}</p>}
            <div className="room-form-actions">
              <button type="button" className="room-btn secondary sm" onClick={() => { setMode(null); setError(''); }}>
                ← Back
              </button>
              <button type="submit" className="room-btn primary" disabled={loading || !name.trim()}>
                {loading ? 'Creating…' : 'Create Room →'}
              </button>
            </div>
          </form>
        )}

        {/* Join form */}
        {mode === 'join' && (
          <form onSubmit={handleJoin} className="room-form">
            <div className="room-field">
              <label>Room Code</label>
              <input
                className="room-input code-input"
                type="text"
                placeholder="e.g. golden-tiger-42"
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value); setError(''); }}
                autoFocus
              />
            </div>
            {error && <p className="room-error">{error}</p>}
            <div className="room-form-actions">
              <button type="button" className="room-btn secondary sm" onClick={() => { setMode(null); setError(''); }}>
                ← Back
              </button>
              <button type="submit" className="room-btn primary" disabled={loading || !name.trim() || !joinCode.trim()}>
                {loading ? 'Joining…' : 'Join Room →'}
              </button>
            </div>
          </form>
        )}

        <button className="room-solo-link" onClick={() => navigate('/games/blackjack')}>
          Or play solo →
        </button>
      </div>
    </div>
  );
}
