import { useState, useEffect, useCallback, useRef } from 'react';
import { RoomSocket } from '../lib/ws';
import { loadSession, clearSession } from '../lib/session';
import { validCardsToPlay, dealerForbiddenBid } from '../lib/judgement';

export function useJudgementRoom(code) {
  const [room,    setRoom]    = useState(null);
  const [players, setPlayers] = useState([]);
  const [me,      setMe]      = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const socketRef  = useRef(null);
  const sessionRef = useRef(loadSession());

  // ── Handle incoming WS messages ───────────────────────────────────────────
  const handleMessage = useCallback((msg) => {
    if (msg.type === 'state') {
      const { room: r, players: p } = msg;
      setRoom(prev => JSON.stringify(prev) !== JSON.stringify(r) ? r : prev);
      setPlayers(prev => JSON.stringify(prev) !== JSON.stringify(p) ? p : prev);

      const session = sessionRef.current;
      if (session?.playerToken) {
        const found = p.find(pl => pl.player_token === session.playerToken) || null;
        setMe(prev => JSON.stringify(prev) !== JSON.stringify(found) ? found : prev);
      }

      if (r?.status === 'closed') setError('The host has closed this room.');
      setLoading(false);

    } else if (msg.type === 'room_closed') {
      setError('The host has closed this room.');

    } else if (msg.type === 'error') {
      console.warn('[useJudgementRoom] server error:', msg.message);
    }
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) return;
    const session = loadSession();
    sessionRef.current = session;

    if (!session?.playerToken || session.roomCode !== code) {
      setError('No session found for this room.');
      setLoading(false);
      return;
    }

    const socket = new RoomSocket(code, session.playerToken, handleMessage, (closeCode) => {
      if (closeCode === 4003) setError('This room has been closed.');
      else if (closeCode === 4004) setError('Room not found or session expired.');
      else setError('Connection lost. Please refresh.');
    });

    socket.connect();
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, handleMessage]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const send = useCallback((action) => {
    socketRef.current?.send(action);
  }, []);

  const leaveRoom = useCallback(async () => {
    if (!me) return;
    send(me.is_host ? { type: 'close_room' } : { type: 'leave_room' });
    clearSession();
  }, [me, send]);

  const closeRoom = useCallback(async () => {
    send({ type: 'close_room' });
    clearSession();
  }, [send]);

  const startGame = useCallback(() => {
    send({ type: 'start_game' });
  }, [send]);

  const placeBid = useCallback((bid) => {
    send({ type: 'place_bid', bid });
  }, [send]);

  const playCard = useCallback((card) => {
    send({ type: 'play_card', card });
  }, [send]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const isHost   = !!me?.is_host;
  const gs       = room?.game_state || {};
  const phase    = gs.phase;
  const isMyTurn = (phase === 'bidding' || phase === 'playing') && gs.active_seat === me?.seat;
  const myData   = me?.seat != null ? gs.seats?.[String(me.seat)] : null;

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
    placeBid, playCard,
  };
}
