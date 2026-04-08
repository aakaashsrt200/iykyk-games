import { useEffect, useCallback, useRef } from 'react';
import { RoomSocket } from '../lib/ws';
import { loadSession, clearSession } from '../lib/session';
import { useGameStore } from '../store/gameStore';

export function useRoom(code) {
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
      console.warn('[useRoom] server error:', msg.message);
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

  // ── Actions (all go through WebSocket) ───────────────────────────────────
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

  const placeBet = useCallback((amount) => {
    send({ type: 'place_bet', amount });
  }, [send]);

  const deal = useCallback(() => {
    send({ type: 'deal' });
  }, [send]);

  const hit = useCallback(() => {
    send({ type: 'hit' });
  }, [send]);

  const stand = useCallback(() => {
    send({ type: 'stand' });
  }, [send]);

  const doubleDown = useCallback(() => {
    send({ type: 'double_down' });
  }, [send]);

  const newRound = useCallback(() => {
    send({ type: 'new_round' });
  }, [send]);

  return {
    leaveRoom, closeRoom, startGame,
    placeBet, deal, hit, stand, doubleDown, newRound,
  };
}
