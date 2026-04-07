import React, { useState, useEffect } from 'react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <a href="/" className="navbar-logo">
        <span className="suit">♠</span>
        IYKYK <span className="brand">GAMES</span>
      </a>

      <div className="navbar-title">
        <span className="suits">♠ ♥ ♦ ♣</span>
        The Card Game Arena
      </div>
    </nav>
  );
}
