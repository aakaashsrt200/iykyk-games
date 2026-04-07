import { useState, useEffect } from 'react';
import '../../styles/Room.css';

// Avatar color palette — one per slot, cycling
const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#db2777', '#0891b2', '#65a30d', '#dc2626',
];

function PlayerAvatar({ name, index }) {
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: '50%',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: '1rem', color: '#fff', flexShrink: 0,
      boxShadow: `0 0 0 2px rgba(255,255,255,0.1)`,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function PulsingDot() {
  return (
    <span style={{
      display: 'inline-block', width: '8px', height: '8px',
      borderRadius: '50%', background: '#a78bfa',
      animation: 'jdg-pulse 1.4s ease-in-out infinite',
      marginRight: '6px',
    }} />
  );
}

export default function JudgementLobby({ room, players, me, isHost, onStart, onLeave, onClose }) {
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(0);

  // Pulsing effect for "waiting" indicator
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 700);
    return () => clearInterval(id);
  }, []);

  const shareLink = `${window.location.origin}/games/judgement/${room.code}`;
  const maxHandSize = Math.floor(52 / Math.max(players.length, 2));
  const totalRounds = maxHandSize > 1 ? 2 * maxHandSize - 1 : 1;

  function copyLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const canStart = isHost && players.length >= 2;

  return (
    <div className="room-page">
      <style>{`
        @keyframes jdg-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes jdg-slide-in {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="room-lobby-card" style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div className="lobby-header" style={{ borderBottom: '1px solid rgba(124,58,237,0.2)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg,#7c3aed,#4c1d95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
            }}>
              ♠
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#e8eaf0' }}>Judgement</h2>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#6b7280' }}>
                Trick-taking card game · {players.length} / {room.max_players} joined
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isHost
              ? <button className="room-btn danger sm" onClick={onClose}>Close Room</button>
              : <button className="room-btn secondary sm" onClick={onLeave}>Leave</button>
            }
          </div>
        </div>

        {/* Room code */}
        <div className="lobby-code-block" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '10px', padding: '14px', marginTop: '14px' }}>
          <div className="lobby-code-label" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', marginBottom: '4px' }}>Room Code</div>
          <div className="lobby-code" style={{ fontSize: '2rem', fontWeight: 900, color: '#a78bfa', letterSpacing: '0.12em' }}>
            {room.code.toUpperCase()}
          </div>
          <button className="room-btn secondary sm" onClick={copyLink} style={{ marginTop: '8px' }}>
            {copied ? '✓ Copied!' : 'Copy Invite Link'}
          </button>
        </div>

        {/* Player list */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af' }}>Players</span>
            <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{players.length} / {room.max_players}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {players.map((p, idx) => {
              const isMe   = p.id === me?.id;
              const isHost = p.is_host;
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '10px',
                    background: isMe ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isMe ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    animation: 'jdg-slide-in 0.3s ease',
                    transition: 'background 0.2s',
                  }}
                >
                  <PlayerAvatar name={p.name} index={idx} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e8eaf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: '1px' }}>
                      Seat #{p.seat}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                    {isHost && (
                      <span style={{
                        background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000',
                        fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: '20px',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>HOST</span>
                    )}
                    {isMe && (
                      <span style={{
                        background: 'rgba(167,139,250,0.2)', color: '#a78bfa',
                        border: '1px solid rgba(167,139,250,0.4)',
                        fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: '20px',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>YOU</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Waiting indicator */}
          {players.length < 2 && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', fontSize: '0.78rem', color: '#6b7280',
            }}>
              <PulsingDot />
              Waiting for more players to join…
            </div>
          )}
        </div>

        {/* Rules hint */}
        <div style={{
          fontSize: '0.7rem', color: '#6b7280', textAlign: 'center',
          marginTop: '14px', lineHeight: '1.7',
          padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
        }}>
          Trick-taking · Bid exactly right to score · Trump rotates each round<br />
          Rounds: 1 → {maxHandSize} → 1 ({totalRounds} rounds total) · 45s per action
        </div>

        {/* Start button */}
        {isHost && (
          <button
            className="room-btn primary full"
            style={{
              marginTop: '16px',
              background: canStart ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : undefined,
              fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.02em',
            }}
            disabled={!canStart}
            onClick={onStart}
          >
            {players.length < 2 ? 'Need at least 2 players' : `Start Game (${players.length} players)`}
          </button>
        )}
        {!isHost && (
          <div style={{
            textAlign: 'center', marginTop: '16px', padding: '12px',
            background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            <PulsingDot />
            <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>Waiting for the host to start the game…</span>
          </div>
        )}
      </div>
    </div>
  );
}
