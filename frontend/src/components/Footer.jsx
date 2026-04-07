import React from 'react';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="/" className="footer-logo">
              <span className="suit">♠</span>
              IYKYK GAMES
            </a>
            <p>
              The card game arena built for those who know the game.
              Sharpen your skills, challenge others, and let the cards decide.
            </p>
            <div className="footer-suits">
              <span className="black" title="Spades">♠</span>
              <span className="red"   title="Hearts">♥</span>
              <span className="red"   title="Diamonds">♦</span>
              <span className="black" title="Clubs">♣</span>
            </div>
          </div>

          <div className="footer-col">
            <h4>Games</h4>
            <ul>
              <li><a href="#games">Poker</a></li>
              <li><a href="#games">Blackjack</a></li>
              <li><a href="#games">Teen Patti</a></li>
              <li><a href="#games">Rummy</a></li>
              <li><a href="#games">Solitaire</a></li>
              <li><a href="#games">War</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Platform</h4>
            <ul>
              <li><a href="#how-to-play">How to Play</a></li>
              <li><a href="#leaderboard">Leaderboard</a></li>
              <li><a href="#tournaments">Tournaments</a></li>
              <li><a href="#profile">Profile</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#about">About</a></li>
              <li><a href="#careers">Careers</a></li>
              <li><a href="#privacy">Privacy</a></li>
              <li><a href="#terms">Terms</a></li>
              <li><a href="#contact">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {year} IYKYK Games. Built with <span>♠ ♥</span> for card lovers.</p>
          <p>If you know, you know.</p>
        </div>
      </div>
    </footer>
  );
}
