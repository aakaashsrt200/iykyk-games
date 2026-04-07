"""
Judgement (Kachuful) game logic — pure functions, no side effects.
Ported from frontend/src/lib/judgement.js and frontend/src/hooks/useJudgementRoom.js.
"""
import random
from datetime import datetime, timezone

SUITS = ['spades', 'diamonds', 'clubs', 'hearts']
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
RANK_VALUES = {r: i + 2 for i, r in enumerate(RANKS)}

TIMER_MS = 45_000
TRICK_PAUSE_MS = 2_500
ROUND_PAUSE_MS = 5_000


# ── Deck ──────────────────────────────────────────────────────────────────────

def build_deck() -> list[dict]:
    deck = [{'suit': s, 'rank': r} for s in SUITS for r in RANKS]
    random.shuffle(deck)
    return deck


# ── Round sequence ────────────────────────────────────────────────────────────

def max_hand_size(player_count: int) -> int:
    return 52 // max(player_count, 2)


def build_round_sequence(player_count: int) -> list[int]:
    m = max_hand_size(player_count)
    return list(range(1, m + 1)) + list(range(m - 1, 0, -1))


# ── Trump rotation ────────────────────────────────────────────────────────────

def get_trump_suit(trump_idx: int) -> str:
    return SUITS[trump_idx % 4]


# ── Seat helpers ──────────────────────────────────────────────────────────────

def seat_after(seat: int, seats: dict, skip: int = 0) -> int | None:
    sorted_seats = sorted(int(s) for s, d in seats.items() if d.get('active'))
    if not sorted_seats:
        return None
    try:
        idx = sorted_seats.index(int(seat))
    except ValueError:
        idx = len(sorted_seats) - 1
    for _ in range(skip + 1):
        idx = (idx + 1) % len(sorted_seats)
    return sorted_seats[idx]


def first_bidder(dealer_seat: int, seats: dict) -> int | None:
    return seat_after(dealer_seat, seats, 0)


def active_seat_list(seats: dict) -> list[int]:
    return sorted(int(s) for s, d in seats.items() if d.get('active'))


# ── Trick resolution ──────────────────────────────────────────────────────────

def determine_trick_winner(trick_cards: list[dict], led_suit: str, trump_suit: str) -> int | None:
    if not trick_cards:
        return None
    winner = trick_cards[0]
    for challenger in trick_cards[1:]:
        w, c = winner['card'], challenger['card']
        w_trump = w['suit'] == trump_suit
        c_trump = c['suit'] == trump_suit
        if c_trump and not w_trump:
            winner = challenger
        elif c_trump and w_trump:
            if RANK_VALUES[c['rank']] > RANK_VALUES[w['rank']]:
                winner = challenger
        elif not c_trump and not w_trump:
            if c['suit'] == led_suit and w['suit'] != led_suit:
                winner = challenger
            elif c['suit'] == led_suit and w['suit'] == led_suit:
                if RANK_VALUES[c['rank']] > RANK_VALUES[w['rank']]:
                    winner = challenger
    return winner['seat']


# ── Valid card check ──────────────────────────────────────────────────────────

def valid_cards_to_play(hand: list[dict], led_suit: str | None, trump_suit: str) -> list[dict]:
    if not led_suit:
        return hand
    if led_suit == trump_suit:
        trump_cards = [c for c in hand if c['suit'] == trump_suit]
        if trump_cards:
            return trump_cards
    return hand


# ── Scoring ───────────────────────────────────────────────────────────────────

def score_round(bid: int | None, tricks_won: int) -> int:
    if bid is None:
        return 0
    return 10 + bid if bid == tricks_won else 0


# ── Dealer bid restriction ────────────────────────────────────────────────────

def dealer_forbidden_bid(bids_total: int, hand_size: int) -> int | None:
    forbidden = hand_size - bids_total
    if forbidden < 0 or forbidden > hand_size:
        return None
    return forbidden


# ── Now ───────────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── State machine ─────────────────────────────────────────────────────────────

def start_game(players: list[dict]) -> dict:
    active = [p for p in players if p.get('status') == 'active']
    seats = {
        str(p['seat']): {
            'player_id': p['id'],
            'hand': [],
            'bid': None,
            'tricks_won': 0,
            'active': True,
        }
        for p in active
    }
    scores = {str(p['seat']): 0 for p in active}
    round_seq = build_round_sequence(len(active))
    first_dealer_seat = active[0]['seat']

    # Deal first round
    deck = build_deck()
    hand_size = round_seq[0]
    for s in seats:
        seats[s] = {**seats[s], 'hand': deck[:hand_size]}
        deck = deck[hand_size:]

    first_bid = first_bidder(first_dealer_seat, seats)

    return {
        'phase': 'bidding',
        'round_seq': round_seq,
        'round_idx': 0,
        'hand_size': hand_size,
        'trump_idx': 0,
        'trump_suit': SUITS[0],
        'dealer_seat': first_dealer_seat,
        'active_seat': first_bid,
        'timer_start': _now_iso(),
        'seats': seats,
        'bids_total': 0,
        'trick': {'cards': [], 'led_suit': None, 'winner': None, 'resolved_at': None},
        'trick_count': 0,
        'scores': scores,
        'round_history': [],
    }


def place_bid(gs: dict, seat: int, bid: int) -> dict | None:
    seat_str = str(seat)
    if gs.get('phase') != 'bidding' or gs.get('active_seat') != seat:
        return None
    if seat_str not in gs['seats']:
        return None

    is_dealer = gs['dealer_seat'] == seat
    if is_dealer:
        forbidden = dealer_forbidden_bid(gs['bids_total'], gs['hand_size'])
        if forbidden is not None and bid == forbidden:
            return None

    is_last_bidder = (seat == gs['dealer_seat'])
    new_seats = {**gs['seats'], seat_str: {**gs['seats'][seat_str], 'bid': bid}}
    next_seat = (
        first_bidder(gs['dealer_seat'], new_seats)
        if is_last_bidder
        else seat_after(seat, new_seats, 0)
    )

    return {
        **gs,
        'seats': new_seats,
        'bids_total': gs['bids_total'] + bid,
        'phase': 'playing' if is_last_bidder else 'bidding',
        'active_seat': next_seat,
        'timer_start': _now_iso(),
        'trick': (
            {'cards': [], 'led_suit': None, 'winner': None, 'resolved_at': None}
            if is_last_bidder else gs['trick']
        ),
        'trick_count': 0 if is_last_bidder else gs['trick_count'],
    }


def play_card(gs: dict, seat: int, card: dict) -> dict | None:
    seat_str = str(seat)
    if gs.get('phase') != 'playing' or gs.get('active_seat') != seat:
        return None
    if seat_str not in gs['seats']:
        return None

    trick = gs['trick']
    led_suit = trick['cards'][0]['card']['suit'] if trick['cards'] else card['suit']

    hand = gs['seats'][seat_str]['hand']
    valid = valid_cards_to_play(
        hand,
        trick['cards'][0]['card']['suit'] if trick['cards'] else None,
        gs['trump_suit'],
    )
    if not any(c['suit'] == card['suit'] and c['rank'] == card['rank'] for c in valid):
        return None

    new_hand = [c for c in hand if not (c['suit'] == card['suit'] and c['rank'] == card['rank'])]
    trick_cards = list(trick['cards']) + [{'seat': seat, 'card': card}]
    all_active = active_seat_list(gs['seats'])

    if len(trick_cards) == len(all_active):
        # Trick complete
        winner_seat = determine_trick_winner(trick_cards, led_suit, gs['trump_suit'])
        winner_str = str(winner_seat)
        new_seats = {
            **gs['seats'],
            seat_str: {**gs['seats'][seat_str], 'hand': new_hand},
        }
        new_seats[winner_str] = {
            **new_seats[winner_str],
            'tricks_won': new_seats[winner_str].get('tricks_won', 0) + 1,
        }
        new_trick_count = gs['trick_count'] + 1
        round_done = new_trick_count >= gs['hand_size']

        new_gs = {
            **gs,
            'seats': new_seats,
            'trick_count': new_trick_count,
            'trick': {
                'cards': trick_cards,
                'led_suit': led_suit,
                'winner': winner_seat,
                'resolved_at': _now_iso(),
            },
            'active_seat': None if round_done else winner_seat,
            'timer_start': None,
            'phase': 'round_result' if round_done else 'playing',
        }

        if round_done:
            scores = dict(gs['scores'])
            for s in all_active:
                s_str = str(s)
                data = new_seats[s_str]
                scores[s_str] = scores.get(s_str, 0) + score_round(data['bid'], data['tricks_won'])
            new_gs['scores'] = scores
            new_gs['round_result_at'] = _now_iso()
            new_gs['round_history'] = list(gs.get('round_history', [])) + [{
                'round': gs['round_seq'][gs['round_idx']],
                'hand_size': gs['hand_size'],
                'seats': new_seats,
                'scores_snapshot': dict(scores),
            }]

        return new_gs

    else:
        # Trick still going
        next_seat = seat_after(seat, gs['seats'], 0)
        return {
            **gs,
            'seats': {**gs['seats'], seat_str: {**gs['seats'][seat_str], 'hand': new_hand}},
            'trick': {'cards': trick_cards, 'led_suit': led_suit, 'winner': None, 'resolved_at': None},
            'active_seat': next_seat,
            'timer_start': _now_iso(),
        }


def advance_trick(gs: dict) -> dict | None:
    if gs.get('phase') != 'playing':
        return None
    trick = gs.get('trick', {})
    if trick.get('winner') is None:
        return None
    return {
        **gs,
        'trick': {'cards': [], 'led_suit': None, 'winner': None, 'resolved_at': None},
        'active_seat': trick['winner'],
        'timer_start': _now_iso(),
    }


def start_next_round(gs: dict, players: list[dict]) -> dict:
    next_idx = gs['round_idx'] + 1
    round_seq = gs['round_seq']

    if next_idx >= len(round_seq):
        return {**gs, 'phase': 'game_over'}

    next_hand_size = round_seq[next_idx]
    next_trump_idx = (gs['trump_idx'] + 1) % 4
    next_trump = get_trump_suit(next_trump_idx)
    next_dealer = seat_after(gs['dealer_seat'], gs['seats'], 0) or gs['dealer_seat']

    current_players = [p for p in players if p.get('status') == 'active']
    deck = build_deck()
    new_seats = {}
    for p in current_players:
        s = str(p['seat'])
        new_seats[s] = {
            'player_id': p['id'],
            'hand': deck[:next_hand_size],
            'bid': None,
            'tricks_won': 0,
            'active': True,
        }
        deck = deck[next_hand_size:]

    scores = dict(gs['scores'])
    for p in current_players:
        s = str(p['seat'])
        if s not in scores:
            scores[s] = 0

    first_bid = first_bidder(next_dealer, new_seats)

    return {
        **gs,
        'phase': 'bidding',
        'round_idx': next_idx,
        'hand_size': next_hand_size,
        'trump_idx': next_trump_idx,
        'trump_suit': next_trump,
        'dealer_seat': next_dealer,
        'active_seat': first_bid,
        'timer_start': _now_iso(),
        'seats': new_seats,
        'bids_total': 0,
        'trick': {'cards': [], 'led_suit': None, 'winner': None, 'resolved_at': None},
        'trick_count': 0,
        'scores': scores,
        'round_result_at': None,
    }


# ── Timer enforcement ─────────────────────────────────────────────────────────

def _ms_since(iso_str: str) -> int:
    try:
        dt = datetime.fromisoformat(iso_str)
        now = datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int((now - dt).total_seconds() * 1000)
    except Exception:
        return 0


def check_timer_enforcement(gs: dict) -> dict | str | None:
    """
    Check whether any time-based auto-advance should trigger.
    Returns new game state if an action is needed, else None.
    """
    phase = gs.get('phase')
    trick = gs.get('trick', {})
    round_result_at = gs.get('round_result_at')
    timer_start = gs.get('timer_start')
    active_seat = gs.get('active_seat')

    # 1. Advance trick after pause
    if phase == 'playing' and trick.get('winner') is not None:
        resolved_at = trick.get('resolved_at')
        if resolved_at and _ms_since(resolved_at) >= TRICK_PAUSE_MS:
            return advance_trick(gs)
        return None

    # 2. Auto-advance round after pause
    if phase == 'round_result' and round_result_at:
        if _ms_since(round_result_at) >= ROUND_PAUSE_MS:
            return 'start_next_round'  # signal to caller (needs players list)
        return None

    # 3. Timer expiry — default action
    if not timer_start or active_seat is None:
        return None
    if _ms_since(timer_start) < TIMER_MS:
        return None

    if phase == 'bidding':
        return _enforce_default_bid(gs, active_seat)
    if phase == 'playing':
        return _enforce_default_play(gs, active_seat)

    return None


def _enforce_default_bid(gs: dict, seat: int) -> dict | None:
    if gs.get('phase') != 'bidding' or gs.get('active_seat') != seat:
        return None

    is_dealer = gs['dealer_seat'] == seat
    forbidden = dealer_forbidden_bid(gs['bids_total'], gs['hand_size']) if is_dealer else None
    default_bid = 1 if forbidden == 0 else 0

    return place_bid(gs, seat, default_bid)


def _enforce_default_play(gs: dict, seat: int) -> dict | None:
    seat_str = str(seat)
    if gs.get('phase') != 'playing' or gs.get('active_seat') != seat:
        return None

    hand = gs['seats'].get(seat_str, {}).get('hand', [])
    trick = gs.get('trick', {})
    led_suit = trick['cards'][0]['card']['suit'] if trick.get('cards') else None
    valid = valid_cards_to_play(hand, led_suit, gs['trump_suit'])
    if not valid:
        return None

    return play_card(gs, seat, valid[0])
