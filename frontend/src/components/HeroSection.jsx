import React, { useEffect, useRef } from 'react';

const SUITS = ['♠', '♣', '♥', '♦', '♠', '♣', '♥', '♦', '♠', '♦'];

export default function HeroSection() {
  const floatsRef = useRef(null);

  useEffect(() => {
    if (!floatsRef.current) return;
    const container = floatsRef.current;

    SUITS.forEach((suit, i) => {
      const el = document.createElement('span');
      el.className = 'float-suit';
      el.textContent = suit;
      el.style.left = `${Math.random() * 90 + 5}%`;
      el.style.animationDuration = `${12 + Math.random() * 16}s`;
      el.style.animationDelay = `${Math.random() * -20}s`;
      el.style.fontSize = `${2 + Math.random() * 3}rem`;
      el.style.color = suit === '♥' || suit === '♦' ? '#e63946' : '#f0f0f5';
      container.appendChild(el);
    });

    return () => { while (container.firstChild) container.removeChild(container.firstChild); };
  }, []);

  return (
    <section className="hero" id="hero">
      <div className="hero-bg" />
      <div className="hero-grid" />
      <div className="hero-floats" ref={floatsRef} />

      <div className="hero-content animate-in">
        <div className="hero-badge">
          <span>♠ ♥ ♦ ♣</span>
          The Card Game Arena
        </div>

        <h1 className="hero-title">
          <span className="line1">Play Like You</span>
          <span className="line2">Know You Know</span>
        </h1>

        <p className="hero-subtitle">
          Premium card games, real competition. From Poker to Teen Patti —
          sharpen your skills, climb the leaderboard, and prove you've got the edge.
        </p>

        <div className="hero-actions">
          <a href="#games" className="btn btn-primary">
            ♠ &nbsp;Start Playing
          </a>
          <a href="#how-to-play" className="btn btn-secondary">
            View Games →
          </a>
        </div>

        <div className="hero-stats">
          <div className="stat-item">
            <span className="stat-value">6+</span>
            <span className="stat-label">Card Games</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">10K+</span>
            <span className="stat-label">Players</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">Live</span>
            <span className="stat-label">Multiplayer</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">Free</span>
            <span className="stat-label">To Start</span>
          </div>
        </div>
      </div>
    </section>
  );
}
