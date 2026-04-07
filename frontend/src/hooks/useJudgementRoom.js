import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { loadSession, clearSession } from '../lib/session';
import { broadcastRoomEvent } from './useRoom';
import {
  buildDeck, buildInitialGameState, buildRoundSequence,
  firstBidder, seatAfter, activeSeatList,
  determineTrickWinner, validCardsToPlay, scoreRound,
  dealerForbiddenBid, getTrumpSuit, nextTrumpIdx,
  TIMER_MS, TRICK_PAUSE_MS, ROUND_PAUSE_MS,
} from '../lib/judgement';

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useJudgementRoom(code) {
  const [room,    setRoom]    = useState(null);
  const [players, setPlayers] = useState([]);
  const [me,      setMe]      = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const roomIdRef    = useRef(null);
  const playersRef   = useRef([]);
  const enforcingRef = useRef(null); // tracks what action we're currently enforcing

  useEffect(() => { playersRef.current = players; }, [players]);

  // ── Full refresh ────────────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    const id = roomIdRef.current;
    if (!id) return;

    const [{ data: roomData }, { data: playersData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', id).single(),
      supabase.from('players').select('*').eq('room_id', id).eq('status', 'active').order('seat'),
    ]);

    if (roomData) {
      setRoom(prev => JSON.stringify(prev) !== JSON.stringify(roomData) ? roomData : prev);
      if (roomData.status === 'closed') setError('The host has closed this room.');
    }

    const list = playersData || [];
    setPlayers(prev => JSON.stringify(prev) !== JSON.stringify(list) ? list : prev);

    const session = loadSession();
    if (session?.playerToken) {
      const found = list.find(p => p.player_token === session.playerToken);
      setMe(prev => JSON.stringify(prev) !== JSON.stringify(found || null) ? (found || null) : prev);
    }
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;

    async function init() {
      setLoading(true);
      setError(null);

      const { data: roomData, error: roomErr } = await supabase
        .from('rooms').select('*').eq('code', code).single();

      if (roomErr || !roomData) {
        setError('Room not found or has been closed.');
        setLoading(false);
        return;
      }
      if (roomData.status === 'closed') {
        setError('This room has been closed by the host.');
        setLoading(false);
        return;
      }

      roomIdRef.current = roomData.id;
      setRoom(roomData);

      const { data: playersData } = await supabase
        .from('players').select('*')
        .eq('room_id', roomData.id).eq('status', 'active').order('seat');
      const list = playersData || [];
      setPlayers(list);

      const session = loadSession();
      if (session?.roomCode === code && session?.playerToken) {
        setMe(list.find(p => p.player_token === session.playerToken) || null);
      }

      setLoading(false);

      const ch = supabase
        .channel(`judgement-${roomData.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomData.id}` }, () => refreshAll())
        .on('broadcast', { event: 'players_updated' }, () => refreshAll())
        .subscribe();
      return ch;
    }

    let channel;
    init().then(ch => { channel = ch; });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [code, refreshAll]);

  // ── Polling ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!room || error) return;
    const interval = room.status === 'waiting' ? 3000 : 2000;
    const timer = setInterval(refreshAll, interval);
    return () => clearInterval(timer);
  }, [room?.status, !!error, refreshAll]);

  // ── Lobby actions ───────────────────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    if (!me) return;
    if (me.is_host) {
      await supabase.from('rooms').update({ status: 'closed' }).eq('id', me.room_id);
    } else {
      await supabase.from('players').update({ status: 'left' }).eq('id', me.id);
      broadcastRoomEvent(code, 'players_updated');
    }
    clearSession();
  }, [me, code]);

  const closeRoom = useCallback(async () => {
    if (!me?.is_host || !room) return;
    await supabase.from('rooms').update({ status: 'closed' }).eq('id', room.id);
    clearSession();
  }, [me, room]);

  const startGame = useCallback(async () => {
    if (!me?.is_host || !room) return;
    const active = players.filter(p => p.status === 'active');
    if (active.length < 2) return;

    // Build initial state and deal first round
    const gs = buildInitialGameState(active, active[0].seat);
    const { deck, newSeats, dealerSeat } = dealRound(gs, active);

    await supabase.from('rooms').update({
      status: 'playing',
      game_state: {
        ...gs,
        phase:       'bidding',
        seats:       newSeats,
        dealer_seat: dealerSeat,
        active_seat: firstBidder(dealerSeat, newSeats),
        timer_start: new Date().toISOString(),
      },
    }).eq('id', room.id);
    await refreshAll();
  }, [me, room, players, refreshAll]);

  // ── Game helpers ─────────────────────────────────────────────────────────────
  function dealRound(gs, activePlayers) {
    const deck     = buildDeck();
    const handSize = gs.hand_size;
    const newSeats = {};
    const playerList = activePlayers || playersRef.current.filter(p => p.status === 'active');

    // Build seats map (all active players get a hand; re-joiners also included)
    playerList.forEach(p => {
      const prev = gs.seats?.[p.seat];
      newSeats[p.seat] = {
        player_id:  p.id,
        hand:       deck.splice(0, handSize),
        bid:        null,
        tricks_won: 0,
        active:     true,
      };
    });

    return { deck, newSeats, dealerSeat: gs.dealer_seat };
  }

  // ── Fetch fresh game state (avoid stale closure) ───────────────────────────
  async function freshGs() {
    const { data } = await supabase.from('rooms').select('game_state').eq('id', roomIdRef.current).single();
    return data?.game_state ?? null;
  }

  // ── Bidding ──────────────────────────────────────────────────────────────────
  const placeBid = useCallback(async (bid) => {
    if (!me || !room) return;
    const gs = await freshGs();
    if (!gs || gs.phase !== 'bidding' || gs.active_seat !== me.seat) return;

    const newBidsTotal = gs.bids_total + bid;
    const isDealer     = gs.dealer_seat === me.seat;

    // Double-check dealer restriction
    if (isDealer) {
      const forbidden = dealerForbiddenBid(gs.bids_total, gs.hand_size);
      if (forbidden !== null && bid === forbidden) return;
    }

    // Dealer always bids last; use seatAfter for correct wrap-around
    const isLastBidder = me.seat === gs.dealer_seat;

    const newSeats = {
      ...gs.seats,
      [me.seat]: { ...gs.seats[me.seat], bid },
    };

    const nextSeat = isLastBidder
      ? firstBidder(gs.dealer_seat, newSeats) // first player left of dealer leads tricks
      : seatAfter(me.seat, newSeats, 0);      // next in bidding order (wraps correctly)

    await supabase.from('rooms').update({
      game_state: {
        ...gs,
        seats:       newSeats,
        bids_total:  newBidsTotal,
        phase:       isLastBidder ? 'playing' : 'bidding',
        active_seat: nextSeat,
        timer_start: new Date().toISOString(),
        trick:       isLastBidder ? { cards: [], led_suit: null, winner: null, resolved_at: null } : gs.trick,
        trick_count: isLastBidder ? 0 : gs.trick_count,
      },
    }).eq('id', room.id);
    await refreshAll();
  }, [me, room, refreshAll]);

  // ── Playing a card ───────────────────────────────────────────────────────────
  const playCard = useCallback(async (card) => {
    if (!me || !room) return;
    const gs = await freshGs();
    if (!gs || gs.phase !== 'playing' || gs.active_seat !== me.seat) return;

    const seat    = me.seat;
    const trick   = gs.trick;
    const ledSuit = trick.cards.length ? trick.led_suit : card.suit;

    // Validate: trump-suit following rule
    const valid = validCardsToPlay(gs.seats[seat].hand, trick.cards.length ? trick.led_suit : null, gs.trump_suit);
    if (!valid.some(c => c.suit === card.suit && c.rank === card.rank)) return;

    const newHand    = gs.seats[seat].hand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
    const trickCards = [...trick.cards, { seat, card }];
    const allActive  = activeSeatList(gs.seats);

    let newGs;

    if (trickCards.length === allActive.length) {
      // Trick complete
      const winnerSeat    = determineTrickWinner(trickCards, ledSuit, gs.trump_suit);
      const newSeats      = {
        ...gs.seats,
        [seat]: { ...gs.seats[seat], hand: newHand },
      };
      newSeats[winnerSeat] = { ...newSeats[winnerSeat], tricks_won: (newSeats[winnerSeat].tricks_won || 0) + 1 };
      const newTrickCount = gs.trick_count + 1;
      const roundDone     = newTrickCount >= gs.hand_size;

      newGs = {
        ...gs,
        seats:      newSeats,
        trick_count: newTrickCount,
        trick: {
          cards:       trickCards,
          led_suit:    ledSuit,
          winner:      winnerSeat,
          resolved_at: new Date().toISOString(),
        },
        active_seat:  roundDone ? null : winnerSeat,
        timer_start:  null,
        phase:        roundDone ? 'round_result' : 'playing',
        round_result_at: roundDone ? new Date().toISOString() : undefined,
      };

      if (roundDone) {
        // Calculate scores
        const scores = { ...gs.scores };
        allActive.forEach(s => {
          const data  = newSeats[s];
          const delta = scoreRound(data.bid, data.tricks_won);
          scores[s]   = (scores[s] || 0) + delta;
        });
        newGs.scores = scores;
        newGs.round_history = [
          ...(gs.round_history || []),
          { round: gs.round_seq[gs.round_idx], hand_size: gs.hand_size, seats: newSeats, scores_snapshot: { ...scores } },
        ];
      }
    } else {
      // Trick still going
      const nextSeat = seatAfter(seat, gs.seats, 0);
      newGs = {
        ...gs,
        seats:       { ...gs.seats, [seat]: { ...gs.seats[seat], hand: newHand } },
        trick:       { cards: trickCards, led_suit: ledSuit, winner: null, resolved_at: null },
        active_seat: nextSeat,
        timer_start: new Date().toISOString(),
      };
    }

    await supabase.from('rooms').update({ game_state: newGs }).eq('id', room.id);
    await refreshAll();
  }, [me, room, refreshAll]);

  // ── Advance trick (after pause) ──────────────────────────────────────────────
  const advanceTrick = useCallback(async () => {
    const gs = await freshGs();
    if (!gs || gs.phase !== 'playing') return;
    const trick = gs.trick;
    if (!trick?.winner) return;

    await supabase.from('rooms').update({
      game_state: {
        ...gs,
        trick:       { cards: [], led_suit: null, winner: null, resolved_at: null },
        active_seat: trick.winner,
        timer_start: new Date().toISOString(),
      },
    }).eq('id', room.id);
    await refreshAll();
  }, [room, refreshAll]);

  // ── Start next round ─────────────────────────────────────────────────────────
  const startNextRound = useCallback(async () => {
    const gs = await freshGs();
    if (!gs || gs.phase !== 'round_result') return;

    const nextIdx     = gs.round_idx + 1;
    const roundSeq    = gs.round_seq;

    if (nextIdx >= roundSeq.length) {
      // Game over
      await supabase.from('rooms').update({
        game_state: { ...gs, phase: 'game_over' },
      }).eq('id', room.id);
      await refreshAll();
      return;
    }

    const nextHandSize  = roundSeq[nextIdx];
    const nextTrumpIdx  = (gs.trump_idx + 1) % 4;
    const nextTrumpSuit = getTrumpSuit(nextTrumpIdx);

    // Rotate dealer to next active seat
    const nextDealer = seatAfter(gs.dealer_seat, gs.seats, 0);

    // Re-include any rejoined players (those in players table with active status)
    const currentPlayers = playersRef.current.filter(p => p.status === 'active');
    const deck           = buildDeck();
    const newSeats       = {};
    currentPlayers.forEach(p => {
      newSeats[p.seat] = {
        player_id:  p.id,
        hand:       deck.splice(0, nextHandSize),
        bid:        null,
        tricks_won: 0,
        active:     true,
      };
    });

    // Carry scores for any new player (scored 0 for past rounds)
    const scores = { ...gs.scores };
    currentPlayers.forEach(p => {
      if (scores[p.seat] === undefined) scores[p.seat] = 0;
    });

    const firstBid = firstBidder(nextDealer, newSeats);

    await supabase.from('rooms').update({
      game_state: {
        ...gs,
        phase:          'bidding',
        round_idx:      nextIdx,
        hand_size:      nextHandSize,
        trump_idx:      nextTrumpIdx,
        trump_suit:     nextTrumpSuit,
        dealer_seat:    nextDealer,
        active_seat:    firstBid,
        timer_start:    new Date().toISOString(),
        seats:          newSeats,
        bids_total:     0,
        trick:          { cards: [], led_suit: null, winner: null, resolved_at: null },
        trick_count:    0,
        scores,
        round_result_at: null,
      },
    }).eq('id', room.id);
    await refreshAll();
  }, [room, refreshAll]);

  // ── Timer / auto-advance enforcer ────────────────────────────────────────────
  // Pattern: store all enforcer logic in a ref so the interval (which runs on a fixed
  // schedule) always invokes the latest version — avoiding stale-closure issues.
  const enforcerFnRef = useRef(null);

  useEffect(() => {
    enforcerFnRef.current = () => {
      if (!room || !me) return;
      const gs = room.game_state;
      if (!gs || !gs.seats) return;

      const { phase, active_seat, timer_start, trick, round_result_at } = gs;
      const allActive = activeSeatList(gs.seats);
      if (!allActive.length) return;

      const enforcer = allActive.find(s => s !== active_seat) ?? null;
      if (enforcer === null || me.seat !== enforcer) return;

      const now = Date.now();

      // 1. Advance trick after pause
      if (phase === 'playing' && trick?.winner != null) {
        const pausedMs = now - new Date(trick.resolved_at).getTime();
        if (pausedMs >= TRICK_PAUSE_MS) {
          const key = `trick-${trick.resolved_at}`;
          if (enforcingRef.current !== key) {
            enforcingRef.current = key;
            advanceTrick();
          }
        }
        return;
      }

      // 2. Auto-advance round after pause
      if (phase === 'round_result' && round_result_at) {
        const pausedMs = now - new Date(round_result_at).getTime();
        if (pausedMs >= ROUND_PAUSE_MS) {
          const key = `round-${round_result_at}`;
          if (enforcingRef.current !== key) {
            enforcingRef.current = key;
            startNextRound();
          }
        }
        return;
      }

      // 3. Timer expiry — default action for active seat
      if (!timer_start || !active_seat) return;
      const elapsed = now - new Date(timer_start).getTime();
      if (elapsed < TIMER_MS) return;

      const key = `timer-${active_seat}-${timer_start}`;
      if (enforcingRef.current === key) return;
      enforcingRef.current = key;

      if (phase === 'bidding') enforceDefaultBid(active_seat, gs);
      else if (phase === 'playing') enforceDefaultPlay(active_seat, gs);
    };
  }); // no dep array — updates every render so the ref always has the freshest closure

  useEffect(() => {
    const id = setInterval(() => enforcerFnRef.current?.(), 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  async function enforceDefaultBid(seat, gs) {
    const fresh = await freshGs();
    if (!fresh || fresh.phase !== 'bidding' || fresh.active_seat !== seat) return;

    const forbidden  = fresh.dealer_seat === seat ? dealerForbiddenBid(fresh.bids_total, fresh.hand_size) : null;
    let   defaultBid = 0;
    if (forbidden === 0) defaultBid = 1;

    const isLastBidder = seat === fresh.dealer_seat;
    const newBidsTotal = fresh.bids_total + defaultBid;
    const newSeats     = { ...fresh.seats, [seat]: { ...fresh.seats[seat], bid: defaultBid } };
    const nextSeat     = isLastBidder ? firstBidder(fresh.dealer_seat, newSeats) : seatAfter(seat, newSeats, 0);

    await supabase.from('rooms').update({
      game_state: {
        ...fresh,
        seats:       newSeats,
        bids_total:  newBidsTotal,
        phase:       isLastBidder ? 'playing' : 'bidding',
        active_seat: nextSeat,
        timer_start: new Date().toISOString(),
        trick:       isLastBidder ? { cards: [], led_suit: null, winner: null, resolved_at: null } : fresh.trick,
        trick_count: isLastBidder ? 0 : fresh.trick_count,
      },
    }).eq('id', room.id);
    await refreshAll();
  }

  async function enforceDefaultPlay(seat, gs) {
    const fresh = await freshGs();
    if (!fresh || fresh.phase !== 'playing' || fresh.active_seat !== seat) return;

    const hand    = fresh.seats[seat]?.hand || [];
    const trick   = fresh.trick;
    const ledSuit = trick.cards.length ? trick.led_suit : null;
    const valid   = validCardsToPlay(hand, ledSuit, fresh.trump_suit);
    if (!valid.length) return;

    const card    = valid[0];
    const newLed  = ledSuit || card.suit;
    const newHand = hand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
    const trickCards = [...trick.cards, { seat, card }];
    const allActive  = activeSeatList(fresh.seats);

    const newSeats = { ...fresh.seats, [seat]: { ...fresh.seats[seat], hand: newHand } };

    let newGs;
    if (trickCards.length === allActive.length) {
      const winnerSeat    = determineTrickWinner(trickCards, newLed, fresh.trump_suit);
      newSeats[winnerSeat] = { ...newSeats[winnerSeat], tricks_won: (newSeats[winnerSeat].tricks_won || 0) + 1 };
      const newTrickCount = fresh.trick_count + 1;
      const roundDone     = newTrickCount >= fresh.hand_size;

      newGs = {
        ...fresh, seats: newSeats, trick_count: newTrickCount,
        trick: { cards: trickCards, led_suit: newLed, winner: winnerSeat, resolved_at: new Date().toISOString() },
        active_seat: roundDone ? null : winnerSeat,
        timer_start: null,
        phase:       roundDone ? 'round_result' : 'playing',
        round_result_at: roundDone ? new Date().toISOString() : undefined,
      };
      if (roundDone) {
        const scores = { ...fresh.scores };
        allActive.forEach(s => {
          const d = newSeats[s]; scores[s] = (scores[s] || 0) + scoreRound(d.bid, d.tricks_won);
        });
        newGs.scores = scores;
        newGs.round_history = [...(fresh.round_history || []),
          { round: fresh.round_seq[fresh.round_idx], hand_size: fresh.hand_size, seats: newSeats, scores_snapshot: { ...scores } }];
      }
    } else {
      const nextSeat = seatAfter(seat, fresh.seats, 0);
      newGs = {
        ...fresh, seats: newSeats,
        trick:       { cards: trickCards, led_suit: newLed, winner: null, resolved_at: null },
        active_seat: nextSeat,
        timer_start: new Date().toISOString(),
      };
    }

    await supabase.from('rooms').update({ game_state: newGs }).eq('id', room.id);
    await refreshAll();
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  const isHost    = !!me?.is_host;
  const gs        = room?.game_state || {};
  const phase     = gs.phase;
  const isMyTurn  = (phase === 'bidding' || phase === 'playing') && gs.active_seat === me?.seat;
  const myData    = me?.seat != null ? gs.seats?.[me.seat] : null;

  const myValidCards = (phase === 'playing' && isMyTurn && myData?.hand)
    ? validCardsToPlay(myData.hand, gs.trick?.cards?.length ? gs.trick.led_suit : null, gs.trump_suit)
    : [];

  const forbidden = (phase === 'bidding' && isMyTurn && gs.dealer_seat === me?.seat)
    ? dealerForbiddenBid(gs.bids_total, gs.hand_size)
    : null;

  return {
    room, players, me, loading, error,
    isHost, gs, phase, isMyTurn, myData, myValidCards, forbidden,
    leaveRoom, closeRoom, startGame,
    placeBid, playCard, startNextRound,
  };
}
