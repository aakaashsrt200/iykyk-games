import { create } from 'zustand';
import { validCardsToPlay, dealerForbiddenBid } from '../lib/judgement';

export const useGameStore = create((set, get) => ({
  // ── Raw server state ────────────────────────────────────────────────────────
  room: null,
  players: [],
  me: null,
  loading: true,
  error: null,

  // ── Unpacked game state ─────────────────────────────────────────────────────
  gs: {},
  phase: null,

  // ── Identity ────────────────────────────────────────────────────────────────
  isHost: false,
  isMyTurn: false,

  // ── Blackjack guards ────────────────────────────────────────────────────────
  canAct: false,     // hit / stand / double — phase=playing && isMyTurn
  canBet: false,     // place/confirm bet   — phase=betting
  canDouble: false,  // hand.length===2 && bet <= balance - bet

  // ── Judgement guards ────────────────────────────────────────────────────────
  canBid: false,     // phase=bidding && isMyTurn
  canPlay: false,    // phase=playing && isMyTurn && !trick?.winner

  // ── Per-player data ─────────────────────────────────────────────────────────
  myData: null,
  myValidCards: [],  // Judgement only
  forbidden: null,   // Judgement dealer bid restriction

  // ── WS send function ────────────────────────────────────────────────────────
  send: () => {},

  // ── Actions ─────────────────────────────────────────────────────────────────

  setSend: (fn) => set({ send: fn }),

  setError: (err) => set({ error: err, loading: false }),

  reset: () => set({
    room: null, players: [], me: null, loading: true, error: null,
    gs: {}, phase: null,
    isHost: false, isMyTurn: false,
    canAct: false, canBet: false, canDouble: false,
    canBid: false, canPlay: false,
    myData: null, myValidCards: [], forbidden: null,
    send: () => {},
  }),

  applyServerState: (room, players, myToken) => {
    // Resolve me from token
    const me = myToken
      ? (players.find(p => p.player_token === myToken) || null)
      : null;

    const gs = room?.game_state || {};
    const phase = gs.phase || null;

    // Identity
    const isHost = !!me?.is_host;

    // ── Blackjack derived ──────────────────────────────────────────────────
    const bjActiveSeat = gs.active_seat;
    const bjIsMyTurn = phase === 'playing' && bjActiveSeat === String(me?.seat);
    const bjMyData = me?.seat != null ? (gs.seats?.[String(me.seat)] || null) : null;
    const myBalance = players.find(p => p.id === me?.id)?.balance ?? 1000;
    const bjCanBet = phase === 'betting';
    const bjCanAct = phase === 'playing' && bjIsMyTurn;
    const bjCanDouble = bjCanAct
      && bjMyData?.hand?.length === 2
      && bjMyData.bet <= myBalance - bjMyData.bet;

    // ── Judgement derived ──────────────────────────────────────────────────
    const jdgActiveSeat = gs.active_seat;
    const jdgIsMyTurn = (phase === 'bidding' || phase === 'playing')
      && jdgActiveSeat === me?.seat;
    const jdgMyData = me?.seat != null ? (gs.seats?.[String(me.seat)] || null) : null;
    const jdgCanBid = phase === 'bidding' && jdgIsMyTurn;
    const jdgCanPlay = phase === 'playing' && jdgIsMyTurn && !gs.trick?.winner;

    // Detect game type: Judgement has trump_suit, Blackjack has dealer_hand
    const isJudgement = gs.trump_suit !== undefined;

    // isMyTurn: unify — pick the right one based on game type
    const isMyTurn = isJudgement ? jdgIsMyTurn : bjIsMyTurn;
    const myData   = isJudgement ? jdgMyData   : bjMyData;

    const myValidCards = (isJudgement && jdgCanPlay && jdgMyData?.hand)
      ? validCardsToPlay(
          jdgMyData.hand,
          gs.trick?.cards?.length ? gs.trick.led_suit : null,
          gs.trump_suit,
        )
      : [];

    const forbidden = (isJudgement && phase === 'bidding' && jdgIsMyTurn && gs.dealer_seat === me?.seat)
      ? dealerForbiddenBid(gs.bids_total, gs.hand_size)
      : null;

    set({
      room,
      players,
      me,
      loading: false,
      error: room?.status === 'closed' ? 'The host has closed this room.' : null,

      gs,
      phase,

      isHost,
      isMyTurn,

      canAct: isJudgement ? false : bjCanAct,
      canBet: isJudgement ? false : bjCanBet,
      canDouble: isJudgement ? false : bjCanDouble,

      canBid: isJudgement ? jdgCanBid : false,
      canPlay: isJudgement ? jdgCanPlay : false,

      myData,
      myValidCards,
      forbidden,
    });
  },
}));
