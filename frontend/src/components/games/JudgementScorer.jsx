import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  buildRoundSequence, getTrumpSuit, nextTrumpIdx,
  dealerForbiddenBid, scoreRound, SUIT_SYMBOLS, SUIT_NAMES,
} from '../../lib/judgement';
import '../../styles/JudgementScorer.css';

// ── Constants ────────────────────────────────────────────────────────────────

const TRUMP_COLORS = {
  spades: '#a78bfa', diamonds: '#f87171',
  clubs:  '#34d399', hearts:   '#f472b6',
};

const AVATAR_BG = [
  '#7c3aed','#2563eb','#059669','#d97706',
  '#db2777','#0891b2','#65a30d','#dc2626',
];

const MEDALS = ['🥇', '🥈', '🥉'];

// ── Shared micro-components ───────────────────────────────────────────────────

function Avatar({ name, idx, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: AVATAR_BG[idx % AVATAR_BG.length],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: Math.round(size * 0.38), color: '#fff', flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function Stepper({ value, min = 0, max, onChange }) {
  return (
    <div className="sc-stepper">
      <button
        className="sc-step-btn"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >−</button>
      <span className="sc-step-val">{value}</span>
      <button
        className="sc-step-btn"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >+</button>
    </div>
  );
}

function TrumpBadge({ suit }) {
  const color = TRUMP_COLORS[suit];
  return (
    <span className="sc-trump-badge" style={{
      color, borderColor: color + '55', background: color + '1a',
    }}>
      {SUIT_SYMBOLS[suit]} {SUIT_NAMES[suit]}
    </span>
  );
}

// Dealer bids last; everyone else bids in seat order starting from left of dealer
function biddingOrder(players, dealerSeat) {
  const di = players.findIndex(p => p.seat === dealerSeat);
  return Array.from({ length: players.length }, (_, i) => players[(di + 1 + i) % players.length]);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function JudgementScorer() {
  const navigate = useNavigate();

  // Setup
  const [names, setNames]       = useState(['', '']);
  const [dealerIdx, setDealerIdx] = useState(0);

  // Active game
  const [game, setGame]         = useState(null);

  // Per-round inputs
  const [bids, setBids]         = useState({});
  const [tricks, setTricks]     = useState({});

  // Score history modal
  const [showHistory, setShowHistory] = useState(false);

  // ── Setup handlers ──────────────────────────────────────────────────────────

  function addPlayer() {
    if (names.length < 8) setNames(n => [...n, '']);
  }

  function removePlayer(i) {
    if (names.length <= 2) return;
    setNames(n => n.filter((_, j) => j !== i));
    if (dealerIdx >= names.length - 1) setDealerIdx(0);
  }

  function setName(i, v) {
    setNames(n => { const a = [...n]; a[i] = v; return a; });
  }

  function startGame() {
    const players = names.map((n, i) => ({
      name: n.trim() || `Player ${i + 1}`,
      seat: i,
    }));
    const roundSeq = buildRoundSequence(players.length);
    setGame({
      phase: 'bidding',
      players,
      dealerSeat: dealerIdx,
      roundSeq,
      roundIdx: 0,
      trumpIdx: 0,
      scores: Object.fromEntries(players.map(p => [p.seat, 0])),
      history: [],
      lastEntry: null,
    });
    setBids(Object.fromEntries(players.map(p => [p.seat, 0])));
    setTricks(Object.fromEntries(players.map(p => [p.seat, 0])));
  }

  // ── Game flow ───────────────────────────────────────────────────────────────

  function confirmBids() {
    setTricks(Object.fromEntries(game.players.map(p => [p.seat, 0])));
    setGame(g => ({ ...g, phase: 'tricks' }));
  }

  function confirmTricks() {
    const { players, roundSeq, roundIdx, trumpIdx, scores, history } = game;
    const handSize = roundSeq[roundIdx];
    const trump    = getTrumpSuit(trumpIdx);

    const deltas    = {};
    const newScores = { ...scores };
    players.forEach(p => {
      const d = scoreRound(bids[p.seat], tricks[p.seat]);
      deltas[p.seat]    = d;
      newScores[p.seat] = (newScores[p.seat] || 0) + d;
    });

    const entry = {
      roundNum:  roundIdx + 1,
      handSize,
      trump,
      bids:    { ...bids },
      tricks:  { ...tricks },
      deltas,
      totals:  { ...newScores },
    };

    const isLast = roundIdx >= roundSeq.length - 1;
    setGame(g => ({
      ...g,
      phase:     isLast ? 'over' : 'result',
      scores:    newScores,
      history:   [...history, entry],
      lastEntry: entry,
    }));
  }

  function nextRound() {
    const { players, dealerSeat, roundSeq, roundIdx, trumpIdx } = game;
    setGame(g => ({
      ...g,
      phase:      'bidding',
      dealerSeat: (dealerSeat + 1) % players.length,
      roundIdx:   roundIdx + 1,
      trumpIdx:   nextTrumpIdx(trumpIdx),
    }));
    setBids(Object.fromEntries(game.players.map(p => [p.seat, 0])));
    setTricks(Object.fromEntries(game.players.map(p => [p.seat, 0])));
  }

  function resetAll() {
    setGame(null);
    setNames(['', '']);
    setDealerIdx(0);
    setBids({});
    setTricks({});
    setShowHistory(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!game) {
    return (
      <SetupScreen
        names={names}
        dealerIdx={dealerIdx}
        onNameChange={setName}
        onAddPlayer={addPlayer}
        onRemovePlayer={removePlayer}
        onDealerChange={setDealerIdx}
        onStart={startGame}
        onBack={() => navigate('/')}
      />
    );
  }

  const { phase, players, dealerSeat, roundSeq, roundIdx, trumpIdx, scores, history, lastEntry } = game;
  const handSize    = roundSeq[roundIdx];
  const trump       = getTrumpSuit(trumpIdx);
  const totalRounds = roundSeq.length;
  const bidOrder    = biddingOrder(players, dealerSeat);

  // Dealer restriction: sum of all non-dealer bids before dealer's turn
  const nonDealerSum = bidOrder.slice(0, -1).reduce((s, p) => s + (bids[p.seat] ?? 0), 0);
  const forbidden    = dealerForbiddenBid(nonDealerSum, handSize);

  const tricksTotal  = players.reduce((s, p) => s + (tricks[p.seat] ?? 0), 0);

  return (
    <div className="sc-page">
      {/* Sticky header */}
      {phase !== 'over' && (
        <div className="sc-header">
          <button className="sc-back-link" onClick={resetAll}>← Setup</button>
          <div className="sc-round-info">
            <span className="sc-round-tag">
              R{lastEntry && phase === 'result' ? lastEntry.roundNum : roundIdx + 1} / {totalRounds}
            </span>
            <TrumpBadge suit={trump} />
            <span className="sc-hand-tag">{handSize} card{handSize !== 1 ? 's' : ''}</span>
          </div>
          {history.length > 0 && (
            <button className="sc-history-icon" onClick={() => setShowHistory(true)} title="Score history">
              📊
            </button>
          )}
        </div>
      )}

      <div className="sc-body">
        {phase === 'bidding' && (
          <BiddingPanel
            players={players}
            dealerSeat={dealerSeat}
            bidOrder={bidOrder}
            bids={bids}
            setBids={setBids}
            handSize={handSize}
            forbidden={forbidden}
            onConfirm={confirmBids}
          />
        )}

        {phase === 'tricks' && (
          <TricksPanel
            players={players}
            bids={bids}
            tricks={tricks}
            setTricks={setTricks}
            handSize={handSize}
            tricksTotal={tricksTotal}
            onConfirm={confirmTricks}
          />
        )}

        {phase === 'result' && lastEntry && (
          <ResultPanel
            players={players}
            entry={lastEntry}
            nextHandSize={roundSeq[roundIdx + 1]}
            nextTrump={getTrumpSuit(nextTrumpIdx(trumpIdx))}
            onNext={nextRound}
          />
        )}

        {phase === 'over' && (
          <GameOverPanel
            players={players}
            scores={scores}
            onNewGame={resetAll}
            onShowHistory={() => setShowHistory(true)}
          />
        )}
      </div>

      {showHistory && (
        <HistoryModal players={players} history={history} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

// ── Setup Screen ──────────────────────────────────────────────────────────────

function SetupScreen({ names, dealerIdx, onNameChange, onAddPlayer, onRemovePlayer, onDealerChange, onStart, onBack }) {
  return (
    <div className="sc-page sc-setup-page">
      <div className="sc-setup-card">
        <button className="sc-back-link plain" onClick={onBack}>← Back</button>

        <div className="sc-setup-hero">
          <div className="sc-setup-icon">♠</div>
          <div>
            <h1 className="sc-setup-heading">Score Tracker</h1>
            <p className="sc-setup-sub">Judgement · Kachuful</p>
          </div>
        </div>

        <div className="sc-setup-section">
          <div className="sc-section-label">Players <span>{names.length} / 8</span></div>
          <div className="sc-player-inputs">
            {names.map((name, i) => (
              <div key={i} className="sc-name-row">
                <div
                  className="sc-name-avatar"
                  style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}
                >
                  {((name.trim() || String.fromCharCode(65 + i)))[0].toUpperCase()}
                </div>
                <input
                  className="sc-input"
                  placeholder={`Player ${i + 1}`}
                  value={name}
                  onChange={e => onNameChange(i, e.target.value)}
                  maxLength={20}
                />
                {names.length > 2 && (
                  <button className="sc-remove" onClick={() => onRemovePlayer(i)}>×</button>
                )}
              </div>
            ))}
          </div>
          {names.length < 8 && (
            <button className="sc-add-btn" onClick={onAddPlayer}>+ Add Player</button>
          )}
        </div>

        <div className="sc-setup-section">
          <div className="sc-section-label">First Dealer</div>
          <div className="sc-dealer-grid">
            {names.map((name, i) => (
              <button
                key={i}
                className={`sc-dealer-tile ${dealerIdx === i ? 'selected' : ''}`}
                onClick={() => onDealerChange(i)}
              >
                <div
                  className="sc-name-avatar sm"
                  style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}
                >
                  {((name.trim() || String.fromCharCode(65 + i)))[0].toUpperCase()}
                </div>
                <span>{name.trim() || `Player ${i + 1}`}</span>
              </button>
            ))}
          </div>
        </div>

        <button className="sc-primary-btn" onClick={onStart}>
          Start Tracking →
        </button>
      </div>
    </div>
  );
}

// ── Bidding Panel ─────────────────────────────────────────────────────────────

function BiddingPanel({ players, dealerSeat, bidOrder, bids, setBids, handSize, forbidden, onConfirm }) {
  const dealerName    = players.find(p => p.seat === dealerSeat)?.name;
  const dealerViolates = bids[dealerSeat] === forbidden && forbidden !== null;

  return (
    <div className="sc-panel">
      <div className="sc-panel-header">
        <span className="sc-panel-title">Place Bids</span>
        <span className="sc-dealer-tag">Dealer: {dealerName}</span>
      </div>

      <div className="sc-rows">
        {bidOrder.map(p => {
          const isDealer  = p.seat === dealerSeat;
          const isInvalid = isDealer && bids[p.seat] === forbidden && forbidden !== null;
          return (
            <div key={p.seat} className={`sc-row ${isInvalid ? 'invalid' : ''}`}>
              <div className="sc-row-left">
                <Avatar name={p.name} idx={p.seat} size={40} />
                <div>
                  <div className="sc-row-name">{p.name}</div>
                  {isDealer && (
                    <div className="sc-row-sub">
                      Dealer {forbidden !== null ? `· cannot bid ${forbidden}` : ''}
                    </div>
                  )}
                </div>
              </div>
              <Stepper
                value={bids[p.seat] ?? 0}
                max={handSize}
                onChange={v => setBids(b => ({ ...b, [p.seat]: v }))}
              />
            </div>
          );
        })}
      </div>

      {dealerViolates && (
        <div className="sc-alert">
          ⚠ Dealer cannot bid {forbidden} — total bids would equal hand size ({handSize})
        </div>
      )}

      <button className="sc-primary-btn" onClick={onConfirm} disabled={dealerViolates}>
        Lock Bids →
      </button>
    </div>
  );
}

// ── Tricks Panel ──────────────────────────────────────────────────────────────

function TricksPanel({ players, bids, tricks, setTricks, handSize, tricksTotal, onConfirm }) {
  const valid = tricksTotal === handSize;

  return (
    <div className="sc-panel">
      <div className="sc-panel-header">
        <span className="sc-panel-title">Tricks Won</span>
        <span className={`sc-total-badge ${valid ? 'ok' : 'bad'}`}>
          {tricksTotal} / {handSize}
        </span>
      </div>

      <div className="sc-rows">
        {players.map(p => (
          <div key={p.seat} className="sc-row">
            <div className="sc-row-left">
              <Avatar name={p.name} idx={p.seat} size={40} />
              <div>
                <div className="sc-row-name">{p.name}</div>
                <div className="sc-row-sub">Bid: {bids[p.seat]}</div>
              </div>
            </div>
            <Stepper
              value={tricks[p.seat] ?? 0}
              max={handSize}
              onChange={v => setTricks(t => ({ ...t, [p.seat]: v }))}
            />
          </div>
        ))}
      </div>

      {!valid && (
        <div className="sc-alert">
          ⚠ Total tricks must add up to {handSize} (currently {tricksTotal})
        </div>
      )}

      <button className="sc-primary-btn" onClick={onConfirm} disabled={!valid}>
        Record Results →
      </button>
    </div>
  );
}

// ── Round Result Panel ────────────────────────────────────────────────────────

function ResultPanel({ players, entry, nextHandSize, nextTrump, onNext }) {
  const { roundNum, bids, tricks, deltas, totals } = entry;
  const sorted = [...players].sort((a, b) => totals[b.seat] - totals[a.seat]);
  const isLast = nextHandSize === undefined;

  return (
    <div className="sc-panel">
      <div className="sc-result-title">Round {roundNum} — Results</div>

      <table className="sc-result-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Bid</th>
            <th>Got</th>
            <th>+/−</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => {
            const hit = bids[p.seat] === tricks[p.seat];
            return (
              <tr key={p.seat} className={hit ? 'sc-hit' : 'sc-miss'}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={p.name} idx={p.seat} size={26} />
                    <span>{p.name}</span>
                  </div>
                </td>
                <td>{bids[p.seat]}</td>
                <td>{tricks[p.seat]}</td>
                <td className={deltas[p.seat] > 0 ? 'sc-pos' : 'sc-zero'}>
                  {deltas[p.seat] > 0 ? `+${deltas[p.seat]}` : '–'}
                </td>
                <td className="sc-total-cell">{totals[p.seat]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {!isLast && nextTrump && (
        <div className="sc-next-hint">
          Next round · {nextHandSize} card{nextHandSize !== 1 ? 's' : ''} ·{' '}
          <span style={{ color: TRUMP_COLORS[nextTrump] }}>
            {SUIT_SYMBOLS[nextTrump]} {SUIT_NAMES[nextTrump]}
          </span>
        </div>
      )}

      <button className="sc-primary-btn" onClick={onNext}>
        {isLast ? 'Final Results →' : 'Next Round →'}
      </button>
    </div>
  );
}

// ── Game Over Panel ───────────────────────────────────────────────────────────

function GameOverPanel({ players, scores, onNewGame, onShowHistory }) {
  const sorted = [...players].sort((a, b) => scores[b.seat] - scores[a.seat]);

  return (
    <div className="sc-panel sc-gameover">
      <div className="sc-trophy-anim">🏆</div>
      <h2 className="sc-gameover-title">Game Over!</h2>
      <p className="sc-gameover-winner">{sorted[0]?.name} wins!</p>

      <div className="sc-standings">
        {sorted.map((p, i) => (
          <div key={p.seat} className={`sc-standing ${i === 0 ? 'first' : ''}`}>
            <span className="sc-medal">{MEDALS[i] ?? `${i + 1}.`}</span>
            <Avatar name={p.name} idx={p.seat} size={42} />
            <span className="sc-standing-name">{p.name}</span>
            <span className="sc-standing-pts">{scores[p.seat]} pts</span>
          </div>
        ))}
      </div>

      <div className="sc-gameover-btns">
        <button className="sc-ghost-btn" onClick={onShowHistory}>Score History</button>
        <button className="sc-primary-btn" onClick={onNewGame}>New Game</button>
      </div>
    </div>
  );
}

// ── History Modal ─────────────────────────────────────────────────────────────

function HistoryModal({ players, history, onClose }) {
  return (
    <div className="sc-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={e => e.stopPropagation()}>
        <div className="sc-modal-head">
          <span>Score History</span>
          <button className="sc-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="sc-modal-body">
          <table className="sc-history-table">
            <thead>
              <tr>
                <th>Rnd</th>
                <th>Hand</th>
                <th>Trump</th>
                {players.map(p => <th key={p.seat}>{p.name.split(' ')[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              {history.map((e, i) => (
                <tr key={i}>
                  <td className="sc-h-rnd">R{e.roundNum}</td>
                  <td>{e.handSize}</td>
                  <td style={{ color: TRUMP_COLORS[e.trump] }}>{SUIT_SYMBOLS[e.trump]}</td>
                  {players.map(p => (
                    <td key={p.seat} className={e.deltas[p.seat] > 0 ? 'sc-pos' : 'sc-zero'}>
                      <div>{e.deltas[p.seat] > 0 ? `+${e.deltas[p.seat]}` : '–'}</div>
                      <div className="sc-h-total">{e.totals[p.seat]}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
