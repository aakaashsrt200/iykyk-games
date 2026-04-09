import React, { useState, useEffect } from 'react';

function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  );

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('iykyk-theme', next);
    setTheme(next);
  };

  return (
    <button
      className="theme-toggle-btn"
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle colour theme"
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}

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

      <ThemeToggle />
    </nav>
  );
}
