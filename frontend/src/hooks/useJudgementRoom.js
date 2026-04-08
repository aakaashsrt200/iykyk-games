import { useEffect, useCallback, useRef } from 'react';
import { RoomSocket } from '../lib/ws';
import { loadSession, clearSession } from '../lib/session';
import { useGameStore } from '../store/gameStore';

export function useJudgementRoom(code) {
  const socketRef  = useRef(null);
  const sessionRef = useRef(loadSession());

  // ── Handle incoming WS messages ───────────────────────────────────────────
  const handleMessage = useCallback((msg) => {
    if (msg.type === 'state') {
      const { room: r, players: p } = msg;
      const session = sessionRef.current;
      useGameStore.getState().applyServerState(r, p, session?.playerToken || null);

    } else if (msg.type === 'room_closed') {
      useGameStore.getState().setError('The host has closed this room.');

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
      useGameStore.getState().setError('No session found for this room.');
      return;
    }

    const socket = new RoomSocket(code, session.playerToken, handleMessage, (closeCode) => {
      if (closeCode === 4003) useGameStore.getState().setError('This room has been closed.');
      else if (closeCode === 4004) useGameStore.getState().setError('Room not found or session expired.');
      else useGameStore.getState().setError('Connection lost. Please refresh.');
    });

    socket.connect();
    socketRef.current = socket;

    // Register send function in store
    useGameStore.getState().setSend((action) => socket.send(action));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      useGameStore.getState().reset();
    };
  }, [code, handleMessage]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const send = useCallback((action) => {
    socketRef.current?.send(action);
  }, []);

  const leaveRoom = useCallback(async () => {
    const me = useGameStore.getState().me;
    if (!me) return;
    send(me.is_host ? { type: 'close_room' } : { type: 'leave_room' });
    clearSession();
  }, [send]);

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

  return {
    leaveRoom, closeRoom, startGame,
    placeBid, playCard,
  };
}
