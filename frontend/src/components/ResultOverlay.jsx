import { useEffect, useRef, useState } from 'react';
import '../styles/App.css';

// Auto-dismiss durations by type
const AUTO_DISMISS = {
  win:       2200,
  lose:      2200,
  push:      2200,
  blackjack: 2500,
  trick_win: 2200,
  bid_hit:   2400,
  bid_miss:  2400,
  // round_result and game_over: no auto-dismiss
};

// Types that use slide animation instead of zoom
const SLIDE_TYPES = new Set(['trick_win']);

export default function ResultOverlay({ result, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);
  const dismissedRef = useRef(false);

  function startExit() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setExiting(true);
    // Wait for exit animation to finish before calling onDismiss
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  }

  useEffect(() => {
    if (!result) return;
    dismissedRef.current = false;
    setExiting(false);

    const delay = AUTO_DISMISS[result.type];
    if (delay) {
      timerRef.current = setTimeout(startExit, delay);
    }
    return () => clearTimeout(timerRef.current);
  }, [result]);

  if (!result) return null;

  const isSlide = SLIDE_TYPES.has(result.type);

  return (
    <div className="result-overlay" onClick={startExit}>
      <div
        className={[
          'result-overlay-card',
          `result-overlay-${result.type}`,
          isSlide ? 'trick-type' : '',
          exiting ? 'exiting' : '',
        ].filter(Boolean).join(' ')}
        onClick={e => e.stopPropagation()}
      >
        <div className="result-overlay-title">{result.message}</div>
        {result.sub && (
          <div className="result-overlay-sub">{result.sub}</div>
        )}
      </div>
    </div>
  );
}
