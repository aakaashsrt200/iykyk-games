import { useState } from 'react';
import '../../styles/Room.css';

const SUIT_ICONS = ['♠', '♥', '♦', '♣', '♠', '♥', '♦', '♣'];

export default function RoomLobby({ room, players, me, isHost, onStart, onLeave, onClose }) {
  const [copied, setCopied] = useState(false);

  const shareUrl  = `${window.location.origin}/rooms/${room.code}`;
  const activeCnt = players.filter(p => p.status === 'active').length;
  const canStart  = isHost && activeCnt >= 2;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="room-page lobby-page">
      <div className="lobby-card">

        {/* Header */}
        <div className="lobby-header">
          <div className="lobby-title-row">
            <span className="room-suit">♦</span>
            <h2>Blackjack Room</h2>
            <span className="lobby-badge">
              {activeCnt} / {room.max_players} players
            </span>
          </div>

          {/* Room code */}
          <div className="lobby-code-section">
            <span className="lobby-code-label">Room Code</span>
            <div className="lobby-code-row">
              <span className="lobby-code">{room.code}</span>
              <button className="room-btn secondary sm copy-btn" onClick={copyLink}>
                {copied ? '✓ Copied!' : '⧉ Copy Link'}
              </button>
            </div>
            <p className="lobby-share-hint">Share this code with friends to invite them</p>
          </div>
        </div>

        {/* Players list */}
        <div className="lobby-players">
          <div className="lobby-section-label">Players in room</div>
          <div className="lobby-player-list">
            {players.map((p, i) => (
              <div key={p.id} className={`lobby-player ${p.id === me?.id ? 'me' : ''}`}>
                <span className="lobby-player-suit" style={{ color: ['♥','♦'].includes(SUIT_ICONS[i]) ? '#e63946' : '#f0f0f5' }}>
                  {SUIT_ICONS[i]}
                </span>
                <span className="lobby-player-name">
                  {p.name}
                  {p.id === me?.id && <span className="lobby-you-tag">You</span>}
                </span>
                <span className="lobby-player-right">
                  {p.is_host && <span className="lobby-host-tag">Host</span>}
                  <span className="lobby-player-balance">${p.balance}</span>
                </span>
              </div>
            ))}
            {/* Empty slots */}
            {Array.from({ length: Math.max(0, room.max_players - activeCnt) }).map((_, i) => (
              <div key={`empty-${i}`} className="lobby-player empty">
                <span className="lobby-player-suit dim">♤</span>
                <span className="lobby-player-name dim">Waiting for player…</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status / instructions */}
        <div className="lobby-status">
          {activeCnt < 2 && (
            <p className="lobby-waiting">Waiting for at least 2 players to start…</p>
          )}
          {activeCnt >= 2 && !isHost && (
            <p className="lobby-waiting">Waiting for the host to start the game…</p>
          )}
        </div>

        {/* Actions */}
        <div className="lobby-actions">
          {isHost && (
            <button
              className="room-btn primary full"
              onClick={onStart}
              disabled={!canStart}
            >
              {canStart ? 'Start Game →' : `Need at least 2 players (${activeCnt}/2)`}
            </button>
          )}

          <div className="lobby-secondary-actions">
            <button className="room-btn danger sm" onClick={isHost ? onClose : onLeave}>
              {isHost ? 'Close Room' : 'Leave Room'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
