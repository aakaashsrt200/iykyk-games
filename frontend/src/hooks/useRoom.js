import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { loadSession, clearSession } from '../lib/session';
import { buildDeck, handScore, isBlackjack } from '../lib/deck';

// ─── Fire-and-forget broadcast (best-effort, non-blocking) ───────────────────
export function broadcastRoomEvent(code, event, payload = {}) {
  const ch = supabase.channel(`notify-${code}`);
  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      ch.send({ type: 'broadcast', event, payload })
        .finally(() => supabase.removeChannel(ch));
    }
  });
  setTimeout(() => supabase.removeChannel(ch), 5000);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeResults(seats, dealerHand) {
  const dScore   = handScore(dealerHand);
  const dealerBJ = isBlackjack(dealerHand);
  const results  = {};
  for (const [seat, data] of Object.entries(seats)) {
    const pScore   = handScore(data.hand);
    const playerBJ = isBlackjack(data.hand);
    let outcome, payout;
    if (pScore > 21) {
      outcome = 'bust';      payout = 0;
    } else if (playerBJ && dealerBJ) {
      outcome = 'push';      payout = data.bet;
    } else if (playerBJ) {
      outcome = 'blackjack'; payout = Math.floor(data.bet * 2.5);
    } else if (dealerBJ) {
      outcome = 'lose';      payout = 0;
    } else if (dScore > 21) {
      outcome = 'win';       payout = data.bet * 2;
    } else if (pScore > dScore) {
      outcome = 'win';       payout = data.bet * 2;
    } else if (pScore === dScore) {
      outcome = 'push';      payout = data.bet;
    } else {
      outcome = 'lose';      payout = 0;
    }
    results[seat] = { ...data, outcome, payout };
  }
  return results;
}

function nextActiveSeat(seats, currentSeat) {
  return Object.entries(seats)
    .map(([s, d]) => ({ seat: parseInt(s), action: d.action }))
    .sort((a, b) => a.seat - b.seat)
    .find(s => s.seat > currentSeat && s.action === null)
    ?.seat ?? null;
}

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useRoom(code) {
  const [room,    setRoom]    = useState(null);
  const [players, setPlayers] = useState([]);
  const [me,      setMe]      = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const roomIdRef     = useRef(null);
  const playersRef    = useRef([]);
  const prevPhaseRef  = useRef(null);

  useEffect(() => { playersRef.current = players; }, [players]);

  // ── Full refresh: room + players ──────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    const id = roomIdRef.current;
    if (!id) return;

    const [{ data: roomData }, { data: playersData }] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', id).single(),
      supabase.from('players').select('*').eq('room_id', id).eq('status', 'active').order('seat'),
    ]);

    if (roomData) {
      setRoom(prev => {
        // Only update if something actually changed (avoid unnecessary re-renders)
        if (JSON.stringify(prev) !== JSON.stringify(roomData)) return roomData;
        return prev;
      });
      if (roomData.status === 'closed') setError('The host has closed this room.');
    }

    const list = playersData || [];
    setPlayers(prev => {
      if (JSON.stringify(prev) !== JSON.stringify(list)) return list;
      return prev;
    });
    const session = loadSession();
    if (session?.playerToken) {
      const found = list.find(p => p.player_token === session.playerToken);
      setMe(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(found || null)) return found || null;
        return prev;
      });
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────
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

      // ── Realtime (best-effort) ───────────────────────────────────────────
      // If Realtime works, updates are instant; if not, polling covers us.
      const ch = supabase
        .channel(`room-${roomData.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'rooms',
          filter: `id=eq.${roomData.id}`,
        }, () => refreshAll())
        .on('broadcast', { event: 'players_updated' }, () => refreshAll())
        .subscribe();

      return ch;
    }

    let channel;
    init().then(ch => { channel = ch; });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [code, refreshAll]);

  // ── Polling: primary update mechanism ────────────────────────────────────
  // Lobby: every 3 s. In-game: every 2 s (keeps turn state fresh).
  useEffect(() => {
    if (!room || error) return;
    const interval = room.status === 'waiting' ? 3000 : 2000;
    const timer = setInterval(refreshAll, interval);
    return () => clearInterval(timer);
  }, [room?.status, !!error, refreshAll]);

  // ── Lobby actions ─────────────────────────────────────────────────────────
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
    const seats = {};
    active.forEach(p => { seats[p.seat] = { player_id: p.id, hand: [], bet: 0, action: null }; });
    const { error: err } = await supabase.from('rooms').update({
      status: 'playing',
      game_state: { phase: 'betting', deck: [], dealer_hand: [], active_seat: null, seats, round: 1 },
    }).eq('id', room.id);
    if (!err) await refreshAll();
  }, [me, room, players, refreshAll]);

  // ── Game actions ──────────────────────────────────────────────────────────
  const placeBet = useCallback(async (amount) => {
    if (!me || !room) return;
    const { data: fresh } = await supabase.from('rooms').select('game_state').eq('id', room.id).single();
    if (!fresh?.game_state?.seats?.[me.seat]) return;
    const gs = fresh.game_state;
    await supabase.from('rooms').update({
      game_state: { ...gs, seats: { ...gs.seats,
        [me.seat]: { ...gs.seats[me.seat], bet: amount, action: 'bet_placed' } } },
    }).eq('id', room.id);
    await refreshAll();
  }, [me, room, refreshAll]);

  const deal = useCallback(async () => {
    if (!me?.is_host || !room) return;
    const { data: fresh } = await supabase.from('rooms').select('game_state').eq('id', room.id).single();
    if (!fresh) return;
    const gs = fresh.game_state;
    const bettingSeats = Object.entries(gs.seats)
      .filter(([, d]) => d.action === 'bet_placed').map(([s]) => parseInt(s));
    if (!bettingSeats.length) return;

    let deck = buildDeck(6);
    const newSeats = { ...gs.seats };
    Object.keys(newSeats).forEach(s => {
      if (!bettingSeats.includes(parseInt(s)))
        newSeats[s] = { ...newSeats[s], hand: [], action: 'sitting_out' };
    });
    bettingSeats.forEach(seat => {
      newSeats[seat] = { ...newSeats[seat], hand: [deck.pop(), deck.pop()], action: null };
    });
    const dealerHand = [deck.pop(), { ...deck.pop(), hidden: true }];
    bettingSeats.forEach(seat => {
      if (isBlackjack(newSeats[seat].hand)) newSeats[seat].action = 'blackjack';
    });
    const firstActive = bettingSeats.find(s => newSeats[s].action === null) ?? null;
    await supabase.from('rooms').update({
      game_state: { ...gs, deck, dealer_hand: dealerHand, seats: newSeats,
        active_seat: firstActive, phase: firstActive ? 'playing' : 'dealer' },
    }).eq('id', room.id);
    await refreshAll();
  }, [me, room, refreshAll]);

  const doTurnAction = useCallback(async (transformFn) => {
    if (!me || !room) return;
    const { data: fresh } = await supabase
      .from('rooms').select('game_state').eq('id', room.id).single();
    if (!fresh) return;
    const gs = fresh.game_state;
    if (gs.active_seat !== me.seat) return;
    await supabase.from('rooms').update({ game_state: transformFn(gs) }).eq('id', room.id);
    await refreshAll();
  }, [me, room, refreshAll]);

  const runDealerAndSettle = useCallback(async (gs) => {
    let deck = [...gs.deck];
    let dealerHand = gs.dealer_hand.map(c => ({ ...c, hidden: false }));
    while (handScore(dealerHand) < 17) dealerHand = [...dealerHand, deck.pop()];
    const results = computeResults(gs.seats, dealerHand);
    await Promise.all(
      playersRef.current.map(p => {
        const s = results[p.seat];
        if (!s) return Promise.resolve();
        return supabase.from('players').update({ balance: p.balance - s.bet + s.payout }).eq('id', p.id);
      })
    );
    await supabase.from('rooms').update({
      game_state: { ...gs, phase: 'result', deck, dealer_hand: dealerHand, seats: results },
    }).eq('id', room.id);
    await refreshAll();
  }, [room, refreshAll]);

  const hit = useCallback(async () => {
    await doTurnAction(gs => {
      const seat  = me.seat;
      const deck  = [...gs.deck];
      const hand  = [...gs.seats[seat].hand, deck.pop()];
      const score = handScore(hand);
      const action = score > 21 ? 'bust' : score === 21 ? 'done' : null;
      const newSeats = { ...gs.seats, [seat]: { ...gs.seats[seat], hand, action } };
      const nextSeat = score >= 21 ? nextActiveSeat(newSeats, seat) : seat;
      return { ...gs, deck, seats: newSeats,
        phase: score >= 21 && nextSeat === null ? 'dealer' : 'playing',
        active_seat: score >= 21 ? nextSeat : seat };
    });
  }, [doTurnAction, me]);

  const stand = useCallback(async () => {
    await doTurnAction(gs => {
      const seat     = me.seat;
      const newSeats = { ...gs.seats, [seat]: { ...gs.seats[seat], action: 'stand' } };
      const nextSeat = nextActiveSeat(newSeats, seat);
      return { ...gs, seats: newSeats,
        phase: nextSeat === null ? 'dealer' : 'playing', active_seat: nextSeat };
    });
  }, [doTurnAction, me]);

  const doubleDown = useCallback(async () => {
    await doTurnAction(gs => {
      const seat   = me.seat;
      const deck   = [...gs.deck];
      const hand   = [...gs.seats[seat].hand, deck.pop()];
      const score  = handScore(hand);
      const action = score > 21 ? 'bust' : 'double';
      const newSeats = {
        ...gs.seats,
        [seat]: { ...gs.seats[seat], hand, bet: gs.seats[seat].bet * 2, action },
      };
      const nextSeat = nextActiveSeat(newSeats, seat);
      return { ...gs, deck, seats: newSeats,
        phase: nextSeat === null ? 'dealer' : 'playing', active_seat: nextSeat };
    });
  }, [doTurnAction, me]);

  const newRound = useCallback(async () => {
    if (!me?.is_host || !room) return;
    const { data: fresh } = await supabase.from('rooms').select('game_state').eq('id', room.id).single();
    const freshSeats = {};
    playersRef.current.filter(p => p.status === 'active').forEach(p => {
      freshSeats[p.seat] = { player_id: p.id, hand: [], bet: 0, action: null };
    });
    await supabase.from('rooms').update({
      game_state: { phase: 'betting', deck: [], dealer_hand: [], active_seat: null,
        seats: freshSeats, round: ((fresh?.game_state?.round) || 1) + 1 },
    }).eq('id', room.id);
    await refreshAll();
  }, [me, room, refreshAll]);

  // Trigger dealer phase (only lowest-seat active player runs it to avoid duplicates)
  useEffect(() => {
    if (!room || !me) return;
    const gs = room.game_state;
    if (gs?.phase !== 'dealer') return;
    if (prevPhaseRef.current === 'dealer') return; // already running
    prevPhaseRef.current = 'dealer';
    const sorted = playersRef.current.filter(p => p.status === 'active').sort((a, b) => a.seat - b.seat);
    if (!sorted.length || sorted[0].id !== me.id) return;
    runDealerAndSettle(gs);
  }, [room?.game_state?.phase]); // eslint-disable-line

  useEffect(() => {
    if (room?.game_state?.phase && room.game_state.phase !== 'dealer') {
      prevPhaseRef.current = room.game_state.phase;
    }
  }, [room?.game_state?.phase]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const isHost    = !!me?.is_host;
  const gs        = room?.game_state || {};
  const phase     = gs.phase;
  const isMyTurn  = phase === 'playing' && gs.active_seat === me?.seat;
  const myData    = me?.seat ? gs.seats?.[me.seat] : null;
  const myBalance = players.find(p => p.id === me?.id)?.balance ?? 1000;
  const canDouble = isMyTurn && myData?.hand?.length === 2 && myData.bet <= myBalance - myData.bet;

  return {
    room, players, me, loading, error,
    isHost, gs, phase, isMyTurn, myData, canDouble,
    leaveRoom, closeRoom, startGame,
    placeBet, deal, hit, stand, doubleDown, newRound,
  };
}
