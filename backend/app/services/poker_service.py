"""
Server-side Texas Hold'em poker logic.
Handles: dealing, hand evaluation, betting rounds, phase advancement, showdown.
"""

import random
import itertools
from collections import Counter
from typing import Optional

SUITS = ['♠', '♥', '♦', '♣']
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
RANK_VALUE = {r: i + 2 for i, r in enumerate(RANKS)}  # 2=2 … A=14

SMALL_BLIND = 5
BIG_BLIND = 10
STARTING_CHIPS = 500


# ─── Deck ────────────────────────────────────────────────────────────────────

def build_deck():
    return [
        {'rank': r, 'suit': s, 'value': RANK_VALUE[r], 'red': s in ('♥', '♦'), 'hidden': False}
        for s in SUITS for r in RANKS
    ]


def shuffle_deck(deck):
    d = deck[:]
    random.shuffle(d)
    return d


# ─── Hand evaluation ─────────────────────────────────────────────────────────

def eval_five(cards):
    vals = sorted([c['value'] for c in cards], reverse=True)
    suits = [c['suit'] for c in cards]
    is_flush = len(set(suits)) == 1

    unique_vals = sorted(set(vals), reverse=True)
    is_straight = False
    straight_high = 0
    if len(unique_vals) == 5:
        if unique_vals[0] - unique_vals[4] == 4:
            is_straight = True
            straight_high = unique_vals[0]
        elif unique_vals == [14, 5, 4, 3, 2]:
            is_straight = True
            straight_high = 5

    counts = sorted(Counter(vals).items(), key=lambda x: (x[1], x[0]), reverse=True)

    if is_flush and is_straight:
        name = 'Royal Flush' if straight_high == 14 else 'Straight Flush'
        return {'rank': 8, 'name': name, 'tb': [straight_high]}
    if counts[0][1] == 4:
        return {'rank': 7, 'name': 'Four of a Kind', 'tb': [counts[0][0], counts[1][0]]}
    if counts[0][1] == 3 and len(counts) > 1 and counts[1][1] == 2:
        return {'rank': 6, 'name': 'Full House', 'tb': [counts[0][0], counts[1][0]]}
    if is_flush:
        return {'rank': 5, 'name': 'Flush', 'tb': vals}
    if is_straight:
        return {'rank': 4, 'name': 'Straight', 'tb': [straight_high]}
    if counts[0][1] == 3:
        return {'rank': 3, 'name': 'Three of a Kind', 'tb': [counts[0][0]] + [c[0] for c in counts[1:]]}
    if counts[0][1] == 2 and len(counts) > 1 and counts[1][1] == 2:
        return {'rank': 2, 'name': 'Two Pair', 'tb': [counts[0][0], counts[1][0]] + [c[0] for c in counts[2:]]}
    if counts[0][1] == 2:
        return {'rank': 1, 'name': 'Pair', 'tb': [counts[0][0]] + [c[0] for c in counts[1:]]}
    return {'rank': 0, 'name': 'High Card', 'tb': vals}


def best_hand(hole_cards, community):
    all_cards = hole_cards + community
    if len(all_cards) < 5:
        return {'rank': -1, 'name': '—', 'tb': []}
    best = None
    for combo in itertools.combinations(all_cards, 5):
        ev = eval_five(list(combo))
        if best is None or compare_hands(ev, best) > 0:
            best = ev
    return best


def compare_hands(a, b):
    if a['rank'] != b['rank']:
        return a['rank'] - b['rank']
    for ai, bi in zip(a.get('tb', []), b.get('tb', [])):
        if ai != bi:
            return ai - bi
    return 0


# ─── Game setup ──────────────────────────────────────────────────────────────

def start_game(players, dealer_seat=None, hand_number=1):
    """
    players: list of {seat (int or str), name, balance} dicts.
    Returns full game state dict.
    """
    seats_ordered = sorted([str(p['seat']) for p in players], key=lambda s: int(s))
    n = len(seats_ordered)

    # Dealer seat (button)
    if dealer_seat is None:
        d_idx = 0
    else:
        ds = str(dealer_seat)
        d_idx = seats_ordered.index(ds) if ds in seats_ordered else 0

    sb_idx = (d_idx + 1) % n
    bb_idx = (d_idx + 2) % n

    # Heads-up: dealer = SB, acts first preflop
    if n == 2:
        sb_idx = d_idx
        bb_idx = (d_idx + 1) % n
        utg_idx = d_idx
    else:
        utg_idx = (d_idx + 3) % n

    deck = shuffle_deck(build_deck())

    # Deal 2 hole cards per player
    hole_cards = {seats_ordered[i]: [deck.pop(), deck.pop()] for i in range(n)}

    # Build player state
    gs_players = {}
    player_chips = {str(p['seat']): int(p.get('balance', STARTING_CHIPS)) for p in players}
    player_names = {str(p['seat']): p['name'] for p in players}

    for i, seat in enumerate(seats_ordered):
        chips = player_chips[seat]
        bet = 0
        if i == sb_idx:
            bet = min(SMALL_BLIND, chips)
            chips -= bet
        elif i == bb_idx:
            bet = min(BIG_BLIND, chips)
            chips -= bet
        gs_players[seat] = {
            'seat': seat,
            'name': player_names[seat],
            'chips': chips,
            'bet': bet,
            'folded': False,
            'has_acted': False,
            'all_in': chips == 0,
            'hole_cards': hole_cards[seat],
            'hand_eval': None,
        }

    dealer_seat_str = seats_ordered[d_idx]
    sb_seat_str = seats_ordered[sb_idx]
    bb_seat_str = seats_ordered[bb_idx]
    active_seat = seats_ordered[utg_idx]

    log = [
        f"{gs_players[sb_seat_str]['name']} posts SB ${SMALL_BLIND}",
        f"{gs_players[bb_seat_str]['name']} posts BB ${BIG_BLIND}",
    ]

    return {
        'phase': 'preflop',
        'deck': deck,
        'players': gs_players,
        'community_cards': [],
        'pot': SMALL_BLIND + BIG_BLIND,
        'current_bet': BIG_BLIND,
        'active_seat': active_seat,
        'dealer_seat': dealer_seat_str,
        'sb_seat': sb_seat_str,
        'bb_seat': bb_seat_str,
        'log': log,
        'winners': None,
        'hand_number': hand_number,
        'seats_ordered': seats_ordered,
    }


# ─── Action application ───────────────────────────────────────────────────────

def apply_action(gs, seat, action, amount=None):
    """
    Apply a player action. Returns new game state or None if invalid.
    seat: str or int
    action: 'fold' | 'check' | 'call' | 'raise'
    amount: required for raise (total bet in this round)
    """
    seat = str(seat)
    if gs.get('active_seat') != seat:
        return None
    if gs.get('phase') == 'showdown':
        return None

    players = {k: dict(v) for k, v in gs['players'].items()}
    p = players[seat]
    if p['folded'] or p['all_in']:
        return None

    pot = gs['pot']
    current_bet = gs['current_bet']
    log = list(gs.get('log', []))
    seats_ordered = gs.get('seats_ordered', sorted(players.keys(), key=lambda s: int(s)))

    if action == 'fold':
        p['folded'] = True
        p['has_acted'] = True
        log.append(f"{p['name']} folds")

    elif action == 'check':
        if current_bet > p['bet']:
            return None
        p['has_acted'] = True
        log.append(f"{p['name']} checks")

    elif action == 'call':
        to_call = min(current_bet - p['bet'], p['chips'])
        if to_call <= 0:
            p['has_acted'] = True
            log.append(f"{p['name']} checks")
        else:
            p['chips'] -= to_call
            pot += to_call
            p['bet'] += to_call
            p['has_acted'] = True
            if p['chips'] == 0:
                p['all_in'] = True
            log.append(f"{p['name']} calls ${p['bet']}")

    elif action == 'raise':
        if amount is None:
            return None
        raise_total = int(amount)
        extra = raise_total - p['bet']
        if extra <= 0 or extra > p['chips']:
            return None
        p['chips'] -= extra
        pot += extra
        p['bet'] = raise_total
        current_bet = raise_total
        p['has_acted'] = True
        if p['chips'] == 0:
            p['all_in'] = True
        for s, pl in players.items():
            if s != seat and not pl['folded']:
                pl['has_acted'] = False
        log.append(f"{p['name']} raises to ${raise_total}")

    else:
        return None

    players[seat] = p
    new_gs = {**gs, 'players': players, 'pot': pot, 'current_bet': current_bet, 'log': log}

    # Single active player → instant win
    active = [s for s, pl in players.items() if not pl['folded']]
    if len(active) == 1:
        return _resolve_winners(new_gs, active)

    # Betting round complete?
    if _betting_round_complete(players, current_bet):
        return _advance_phase(new_gs)

    # Next player
    next_seat = _next_seat(players, seat, seats_ordered)
    return {**new_gs, 'active_seat': next_seat}


def start_next_hand(gs):
    """Rotate dealer and start a new hand with surviving players."""
    players = gs['players']
    seats_ordered = gs.get('seats_ordered', sorted(players.keys(), key=lambda s: int(s)))

    # Build player list with updated chips
    surviving = [
        {'seat': int(s), 'name': p['name'], 'balance': p['chips']}
        for s, p in players.items()
        if p['chips'] > 0
    ]
    if len(surviving) < 2:
        return None  # Game over

    # Rotate dealer
    current_dealer = gs.get('dealer_seat', seats_ordered[0])
    alive_seats = [str(p['seat']) for p in surviving]
    d_idx = alive_seats.index(current_dealer) if current_dealer in alive_seats else 0
    next_d_idx = (d_idx + 1) % len(alive_seats)
    next_dealer = int(alive_seats[next_d_idx])

    return start_game(surviving, dealer_seat=next_dealer, hand_number=gs.get('hand_number', 1) + 1)


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _next_seat(players, from_seat, seats_ordered):
    idx = seats_ordered.index(from_seat)
    for i in range(1, len(seats_ordered) + 1):
        candidate = seats_ordered[(idx + i) % len(seats_ordered)]
        p = players[candidate]
        if not p['folded'] and not p['all_in']:
            return candidate
    return None


def _betting_round_complete(players, current_bet):
    can_act = [p for p in players.values() if not p['folded'] and not p['all_in']]
    if not can_act:
        return True
    return all(p['has_acted'] and p['bet'] == current_bet for p in can_act)


def _advance_phase(gs):
    phase = gs['phase']
    order = ['preflop', 'flop', 'turn', 'river', 'showdown']
    next_phase = order[order.index(phase) + 1]

    deck = list(gs['deck'])
    community = list(gs['community_cards'])

    if next_phase == 'flop':
        if deck: deck.pop()  # burn
        community = [deck.pop(), deck.pop(), deck.pop()] if len(deck) >= 3 else community
    elif next_phase in ('turn', 'river'):
        if deck: deck.pop()  # burn
        if deck: community = community + [deck.pop()]

    players = {k: {**v, 'bet': 0, 'has_acted': False} for k, v in gs['players'].items()}

    if next_phase == 'showdown':
        # Evaluate hands for all non-folded players
        for seat, p in players.items():
            if not p['folded']:
                p['hand_eval'] = best_hand(p['hole_cards'], community)
        return _resolve_winners({**gs, 'phase': 'showdown', 'community_cards': community, 'deck': deck, 'players': players})

    # Find first active player (left of dealer)
    seats_ordered = gs.get('seats_ordered', sorted(players.keys(), key=lambda s: int(s)))
    dealer_seat = gs['dealer_seat']
    d_idx = seats_ordered.index(dealer_seat) if dealer_seat in seats_ordered else 0

    first_seat = None
    for i in range(1, len(seats_ordered) + 1):
        candidate = seats_ordered[(d_idx + i) % len(seats_ordered)]
        if not players[candidate]['folded'] and not players[candidate]['all_in']:
            first_seat = candidate
            break

    log = list(gs.get('log', [])) + [f'── {next_phase.upper()} ──']

    return {
        **gs,
        'phase': next_phase,
        'community_cards': community,
        'deck': deck,
        'players': players,
        'current_bet': 0,
        'active_seat': first_seat,
        'log': log,
    }


def _resolve_winners(gs, winner_seats=None):
    players = {k: dict(v) for k, v in gs['players'].items()}
    community = gs['community_cards']

    if winner_seats is None:
        active = {s: p for s, p in players.items() if not p['folded']}
        evaluated = [(s, best_hand(p['hole_cards'], community)) for s, p in active.items()]
        evaluated.sort(key=lambda x: (x[1]['rank'], x[1].get('tb', [])), reverse=True)
        best = evaluated[0][1]
        winner_seats = [s for s, h in evaluated if compare_hands(h, best) == 0]

    pot = gs['pot']
    share = pot // len(winner_seats) if winner_seats else 0
    for seat in winner_seats:
        players[seat]['chips'] += share

    winner_names = [players[s]['name'] for s in winner_seats]
    suffix = f"${share}" if len(winner_names) == 1 else f"split ${share} each"
    log = list(gs.get('log', [])) + [f"🏆 {' & '.join(winner_names)} win {suffix}"]

    return {
        **gs,
        'phase': 'showdown',
        'players': players,
        'pot': 0,
        'winners': winner_seats,
        'active_seat': None,
        'log': log,
    }


# ─── Card privacy ─────────────────────────────────────────────────────────────

def get_personalized_state(gs, my_seat):
    """Return game state with other players' hole cards hidden (except at showdown)."""
    my_seat = str(my_seat)
    is_showdown = gs.get('phase') == 'showdown'

    masked_players = {}
    for seat, p in gs['players'].items():
        p_copy = dict(p)
        if seat != my_seat and not is_showdown and not p.get('folded', False):
            p_copy['hole_cards'] = [{'hidden': True, 'red': False}, {'hidden': True, 'red': False}]
        masked_players[seat] = p_copy

    # Strip deck (clients don't need it)
    result = {k: v for k, v in gs.items() if k != 'deck'}
    result['players'] = masked_players
    return result
