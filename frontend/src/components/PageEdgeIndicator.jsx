import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';

export default function PageEdgeIndicator() {
  const isMyTurn  = useGameStore(s => s.isMyTurn);
  const timerStart = useGameStore(s => s.gs?.timer_start);
  const [pct, setPct] = useState(100);

  const TIMER_SECONDS = 45;

  useEffect(() => {
    if (!timerStart) { setPct(100); return; }
    const update = () => {
      const elapsed = Date.now() - new Date(timerStart).getTime();
      setPct(Math.max(0, 100 - (elapsed / (TIMER_SECONDS * 1000)) * 100));
    };
    update();
    const id = setInterval(update, 300);
    return () => clearInterval(id);
  }, [timerStart]);

  if (!isMyTurn) return null;

  const color = !timerStart
    ? '#10b981'  // Blackjack — no timer, always green
    : pct > 40 ? '#10b981' : pct > 15 ? '#f59e0b' : '#ef4444';
  const urgent = timerStart && pct < 15;

  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999,
      boxShadow: `inset 5px 0 0 ${color}, inset -5px 0 0 ${color}, inset 0 -5px 0 ${color}`,
      animation: urgent ? 'edge-urgent 0.6s ease-in-out infinite alternate' : 'none',
      borderRadius: 0,
    }} />
  );
}
