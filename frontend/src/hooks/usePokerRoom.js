import { useEffect, useCallback, useRef } from 'react';
import { RoomSocket } from '../lib/ws';
import { loadSession, clearSession } from '../lib/session';
import { useGameStore } from '../store/gameStore';

export function usePokerRoom(code) {
  const socketRef  = useRef(null);
  const sessionRef = useRef(loadSession());

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'state') {
      const { room: r, players: p } = msg;
      const session = sessionRef.current;
      useGameStore.getState().applyServerState(r, p, session?.playerToken || null);
    } else if (msg.type === 'room_closed') {
      useGameStore.getState().setError('The host has closed this room.');
    } else if (msg.type === 'error') {
      console.warn('[usePokerRoom] server error:', msg.message);
    }
  }, []);

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
    useGameStore.getState().setSend((action) => socket.send(action));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      useGameStore.getState().reset();
    };
  }, [code, handleMessage]);

  const send = useCallback((action) => {
    socketRef.current?.send(action);
  }, []);

  const startGame  = useCallback(() => send({ type: 'start_game' }), [send]);
  const nextHand   = useCallback(() => send({ type: 'next_hand' }), [send]);
  const pokerAction = useCallback((action, amount) => send({ type: 'poker_action', action, amount }), [send]);
  const leaveRoom  = useCallback(() => {
    send({ type: 'leave_room' });
    clearSession();
  }, [send]);

  return { startGame, nextHand, pokerAction, leaveRoom };
}
