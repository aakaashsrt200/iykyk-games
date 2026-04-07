import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function RulesModal({ rules, accentColor, onClose }) {
  return (
    <div className="rules-overlay" onClick={onClose}>
      <div
        className="rules-modal"
        style={{ '--modal-accent': accentColor }}
        onClick={e => e.stopPropagation()}
      >
        <div className="rules-modal-header">
          <h3 className="rules-modal-title">{rules.title}</h3>
          <button className="rules-modal-close" onClick={onClose}>✕</button>
        </div>
        <ul className="rules-modal-list">
          {rules.points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function GameCard({ game }) {
  const { name, suit, suitColor, caption, description, players,
          accentColor, disabled, path, multiplayerPath, multiplayerOnly, scorerPath, rules } = game;
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);

  const cardStyle = {
    '--card-accent':    accentColor || 'var(--gold)',
    '--card-glow':      accentColor ? `${accentColor}28` : 'rgba(244,197,66,0.15)',
    '--card-suit-glow': accentColor ? `${accentColor}99` : 'rgba(244,197,66,0.6)',
    opacity: disabled ? 0.52 : 1,
    filter:  disabled ? 'grayscale(0.2)' : 'none',
  };

  return (
    <>
      <div className="game-card" style={cardStyle}>
        <div className="game-card-header">
          <span
            className="game-suit-icon"
            style={{ color: suitColor === 'red' ? 'var(--red)' : 'var(--text-primary)' }}
          >
            {suit}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="game-caption-tag">{caption}</span>
            {rules && (
              <button
                className="rules-icon-btn"
                onClick={e => { e.stopPropagation(); setShowRules(true); }}
                title="How to play"
              >
                ?
              </button>
            )}
          </div>
        </div>

        <div className="game-card-body">
          <h3 className="game-name">{name}</h3>
          <p className="game-desc">{description}</p>
        </div>

        <div className="game-meta">
          <div className="meta-item">
            <span className="meta-icon">👥</span>
            <span className="meta-value">{players} players</span>
          </div>
        </div>

        <div className="game-card-footer">
          {disabled ? (
            <button className="game-btn ghost" disabled>
              Coming Soon
            </button>
          ) : multiplayerOnly ? (
            <div className="game-btn-row">
              {scorerPath && (
                <button
                  className="game-btn outlined"
                  onClick={() => navigate(scorerPath)}
                >
                  Score Tracker
                </button>
              )}
              <button
                className="game-btn filled"
                onClick={() => navigate(multiplayerPath)}
              >
                With Friends
              </button>
            </div>
          ) : multiplayerPath ? (
            <div className="game-btn-row">
              <button
                className="game-btn outlined"
                onClick={() => navigate(path)}
              >
                Solo
              </button>
              <button
                className="game-btn filled"
                onClick={() => navigate(multiplayerPath)}
              >
                With Friends
              </button>
            </div>
          ) : (
            <button className="game-btn filled" onClick={() => navigate(path)}>
              Play →
            </button>
          )}
        </div>
      </div>

      {showRules && rules && (
        <RulesModal
          rules={rules}
          accentColor={accentColor}
          onClose={() => setShowRules(false)}
        />
      )}
    </>
  );
}
