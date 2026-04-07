"""
Blackjack game logic — pure functions, no side effects.
Ported from frontend/src/lib/deck.js and frontend/src/hooks/useRoom.js.
"""
import random

SUITS = ['♠', '♥', '♦', '♣']
RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
RED_SUITS = {'♥', '♦'}


# ── Deck helpers ──────────────────────────────────────────────────────────────

def build_deck(num_decks: int = 6) -> list[dict]:
    cards = [
        {'suit': s, 'rank': r, 'red': s in RED_SUITS}
        for _ in range(num_decks)
        for s in SUITS
        for r in RANKS
    ]
    random.shuffle(cards)
    return cards


def hand_score(hand: list[dict]) -> int:
    total = aces = 0
    for card in hand:
        if card.get('hidden'):
            continue
        r = card['rank']
        if r == 'A':
            total += 11
            aces += 1
        elif r in ('J', 'Q', 'K'):
            total += 10
        else:
            total += int(r)
    while total > 21 and aces > 0:
        total -= 10
        aces -= 1
    return total


def is_blackjack(hand: list[dict]) -> bool:
    return len(hand) == 2 and hand_score(hand) == 21


# ── State machine ─────────────────────────────────────────────────────────────

def start_game(players: list[dict]) -> dict:
    """Build initial game_state from active players."""
    seats = {
        str(p['seat']): {'player_id': p['id'], 'hand': [], 'bet': 0, 'action': None}
        for p in players if p.get('status') == 'active'
    }
    return {
        'phase': 'betting',
        'deck': [],
        'dealer_hand': [],
        'active_seat': None,
        'seats': seats,
        'round': 1,
    }


def place_bet(gs: dict, seat: str, amount: int) -> dict | None:
    if gs.get('phase') != 'betting':
        return None
    if seat not in gs['seats']:
        return None
    return {
        **gs,
        'seats': {
            **gs['seats'],
            seat: {**gs['seats'][seat], 'bet': amount, 'action': 'bet_placed'},
        },
    }


def deal(gs: dict) -> dict | None:
    betting_seats = [s for s, d in gs['seats'].items() if d.get('action') == 'bet_placed']
    if not betting_seats:
        return None

    deck = build_deck(6)
    new_seats = dict(gs['seats'])

    for s in list(new_seats.keys()):
        if s not in betting_seats:
            new_seats[s] = {**new_seats[s], 'hand': [], 'action': 'sitting_out'}

    for seat in betting_seats:
        new_seats[seat] = {**new_seats[seat], 'hand': [deck.pop(), deck.pop()], 'action': None}

    dealer_hand = [deck.pop(), {**deck.pop(), 'hidden': True}]

    for seat in betting_seats:
        if is_blackjack(new_seats[seat]['hand']):
            new_seats[seat] = {**new_seats[seat], 'action': 'blackjack'}

    first_active = next(
        (s for s in sorted(betting_seats, key=int) if new_seats[s]['action'] is None),
        None,
    )

    return {
        **gs,
        'deck': deck,
        'dealer_hand': dealer_hand,
        'seats': new_seats,
        'active_seat': first_active,
        'phase': 'playing' if first_active is not None else 'dealer',
    }


def _next_active_seat(seats: dict, current_seat: str) -> str | None:
    """Find the lowest-numbered seat > current_seat with action == None."""
    candidates = [
        int(s) for s, d in seats.items()
        if d.get('action') is None and int(s) > int(current_seat)
    ]
    return str(min(candidates)) if candidates else None


def hit(gs: dict, seat: str) -> dict | None:
    if gs.get('phase') != 'playing' or gs.get('active_seat') != seat:
        return None
    deck = list(gs['deck'])
    hand = list(gs['seats'][seat]['hand']) + [deck.pop()]
    score = hand_score(hand)
    action = 'bust' if score > 21 else ('done' if score == 21 else None)
    new_seats = {**gs['seats'], seat: {**gs['seats'][seat], 'hand': hand, 'action': action}}
    if score >= 21:
        next_seat = _next_active_seat(new_seats, seat)
        return {**gs, 'deck': deck, 'seats': new_seats,
                'active_seat': next_seat, 'phase': 'dealer' if next_seat is None else 'playing'}
    return {**gs, 'deck': deck, 'seats': new_seats, 'active_seat': seat}


def stand(gs: dict, seat: str) -> dict | None:
    if gs.get('phase') != 'playing' or gs.get('active_seat') != seat:
        return None
    new_seats = {**gs['seats'], seat: {**gs['seats'][seat], 'action': 'stand'}}
    next_seat = _next_active_seat(new_seats, seat)
    return {**gs, 'seats': new_seats,
            'active_seat': next_seat, 'phase': 'dealer' if next_seat is None else 'playing'}


def double_down(gs: dict, seat: str) -> dict | None:
    if gs.get('phase') != 'playing' or gs.get('active_seat') != seat:
        return None
    if len(gs['seats'][seat]['hand']) != 2:
        return None
    deck = list(gs['deck'])
    hand = list(gs['seats'][seat]['hand']) + [deck.pop()]
    score = hand_score(hand)
    action = 'bust' if score > 21 else 'double'
    new_seats = {
        **gs['seats'],
        seat: {**gs['seats'][seat], 'hand': hand, 'bet': gs['seats'][seat]['bet'] * 2, 'action': action},
    }
    next_seat = _next_active_seat(new_seats, seat)
    return {**gs, 'deck': deck, 'seats': new_seats,
            'active_seat': next_seat, 'phase': 'dealer' if next_seat is None else 'playing'}


def _compute_results(seats: dict, dealer_hand: list[dict]) -> dict:
    d_score = hand_score(dealer_hand)
    dealer_bj = is_blackjack(dealer_hand)
    results = {}
    for seat, data in seats.items():
        p_score = hand_score(data['hand'])
        player_bj = is_blackjack(data['hand'])
        if p_score > 21:
            outcome, payout = 'bust', 0
        elif player_bj and dealer_bj:
            outcome, payout = 'push', data['bet']
        elif player_bj:
            outcome, payout = 'blackjack', int(data['bet'] * 2.5)
        elif dealer_bj:
            outcome, payout = 'lose', 0
        elif d_score > 21:
            outcome, payout = 'win', data['bet'] * 2
        elif p_score > d_score:
            outcome, payout = 'win', data['bet'] * 2
        elif p_score == d_score:
            outcome, payout = 'push', data['bet']
        else:
            outcome, payout = 'lose', 0
        results[seat] = {**data, 'outcome': outcome, 'payout': payout}
    return results


def run_dealer(gs: dict) -> tuple[dict, dict]:
    """
    Run dealer draw phase, compute results.
    Returns (new_gs, balance_deltas) where balance_deltas = {player_id: net_change}.
    """
    deck = list(gs['deck'])
    dealer_hand = [{**c, 'hidden': False} for c in gs['dealer_hand']]
    while hand_score(dealer_hand) < 17:
        dealer_hand.append(deck.pop())
    results = _compute_results(gs['seats'], dealer_hand)
    balance_deltas = {
        data['player_id']: -data['bet'] + data['payout']
        for data in results.values()
    }
    new_gs = {**gs, 'phase': 'result', 'deck': deck, 'dealer_hand': dealer_hand, 'seats': results}
    return new_gs, balance_deltas


def new_round(gs: dict, players: list[dict]) -> dict:
    fresh_seats = {
        str(p['seat']): {'player_id': p['id'], 'hand': [], 'bet': 0, 'action': None}
        for p in players if p.get('status') == 'active'
    }
    return {
        'phase': 'betting',
        'deck': [],
        'dealer_hand': [],
        'active_seat': None,
        'seats': fresh_seats,
        'round': gs.get('round', 1) + 1,
    }
