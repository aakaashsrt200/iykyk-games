import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoom, joinRoom } from '../../lib/api';
import { saveSession } from '../../lib/session';
import '../../styles/Room.css';

export default function JudgementRooms() {
  const navigate = useNavigate();
  const [mode, setMode]         = useState(null);
  const [name, setName]         = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Enter your name first.');
    setLoading(true);
    setError('');
    try {
      const result = await createRoom(name.trim(), 'judgement');
      saveSession({ roomCode: result.room_code, playerToken: result.player_token, playerName: name.trim(), isHost: true });
      navigate(`/games/judgement/${result.room_code}`);
    } catch (err) {
      setError(err.message || 'Could not create room. Try again.');
      setLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!name.trim())     return setError('Enter your name first.');
    if (!joinCode.trim()) return setError('Enter the room code.');
    setLoading(true);
    setError('');
    try {
      const result = await joinRoom(joinCode.trim().toLowerCase(), name.trim());
      saveSession({ roomCode: result.room_code, playerToken: result.player_token, playerName: name.trim(), isHost: false });
      navigate(`/games/judgement/${result.room_code}`);
    } catch (err) {
      setError(err.message || 'Could not join room. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="room-page">
      <div className="room-entry-card">
        <div className="room-entry-logo">
          <span className="room-suit" style={{ color: '#a78bfa' }}>♠</span>
          <h1>Judgement</h1>
        </div>
        <p className="room-entry-sub">Trick-taking · Bid &amp; Win · 2–8 Players</p>

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

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="room-form">
            <p className="room-hint">A unique room code will be generated for you to share.</p>
            {error && <p className="room-error">{error}</p>}
            <div className="room-form-actions">
              <button type="button" className="room-btn secondary sm" onClick={() => { setMode(null); setError(''); }}>← Back</button>
              <button type="submit" className="room-btn primary" disabled={loading || !name.trim()}>
                {loading ? 'Creating…' : 'Create Room →'}
              </button>
            </div>
          </form>
        )}

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
              <button type="button" className="room-btn secondary sm" onClick={() => { setMode(null); setError(''); }}>← Back</button>
              <button type="submit" className="room-btn primary" disabled={loading || !name.trim() || !joinCode.trim()}>
                {loading ? 'Joining…' : 'Join Room →'}
              </button>
            </div>
          </form>
        )}

        <button className="room-solo-link" onClick={() => navigate('/')}>← Back to games</button>
      </div>
    </div>
  );
}
