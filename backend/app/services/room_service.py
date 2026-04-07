import random
from typing import Optional
from app.core.supabase_client import get_supabase, db

ADJECTIVES = ['royal', 'golden', 'silver', 'crimson', 'lucky', 'bold', 'swift', 'iron', 'dark', 'noble']
NOUNS = ['falcon', 'tiger', 'dragon', 'cobra', 'wolf', 'shark', 'viper', 'eagle', 'lion', 'fox']


def generate_room_code() -> str:
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    num = random.randint(10, 99)
    return f"{adj}-{noun}-{num}"


async def get_room_by_code(code: str) -> Optional[dict]:
    resp = await db(lambda: get_supabase().table('rooms').select('*').eq('code', code).maybe_single().execute())
    return resp.data


async def get_room_by_id(room_id: str) -> Optional[dict]:
    resp = await db(lambda: get_supabase().table('rooms').select('*').eq('id', room_id).maybe_single().execute())
    return resp.data


async def get_players(room_id: str) -> list[dict]:
    resp = await db(lambda: get_supabase().table('players').select('*').eq('room_id', room_id).eq('status', 'active').order('seat').execute())
    return resp.data or []


async def get_player_by_token(player_token: str, room_id: str) -> Optional[dict]:
    resp = await db(lambda: get_supabase().table('players').select('*').eq('player_token', player_token).eq('room_id', room_id).maybe_single().execute())
    return resp.data


async def create_room(game_type: str, host_token: str) -> dict:
    code = generate_room_code()
    resp = await db(lambda: get_supabase().table('rooms').insert({
        'code': code,
        'host_token': host_token,
        'game_type': game_type,
        'max_players': 8,
        'status': 'waiting',
    }).select().single().execute())
    return resp.data


async def create_player(room_id: str, name: str, player_token: str, seat: int, is_host: bool) -> dict:
    resp = await db(lambda: get_supabase().table('players').insert({
        'room_id': room_id,
        'name': name,
        'player_token': player_token,
        'seat': seat,
        'is_host': is_host,
        'status': 'active',
        'balance': 1000,
    }).select().single().execute())
    return resp.data


async def update_room(room_id: str, **kwargs) -> dict:
    resp = await db(lambda: get_supabase().table('rooms').update(kwargs).eq('id', room_id).select().single().execute())
    return resp.data


async def update_player(player_id: str, **kwargs) -> dict:
    resp = await db(lambda: get_supabase().table('players').update(kwargs).eq('id', player_id).select().single().execute())
    return resp.data


async def apply_balance_deltas(players: list[dict], deltas: dict) -> None:
    """Apply balance changes for dealer settle. deltas: {player_id: delta}"""
    for player in players:
        delta = deltas.get(player['id'])
        if delta is not None:
            new_balance = player['balance'] + delta
            pid = player['id']
            await db(lambda: get_supabase().table('players').update({'balance': new_balance}).eq('id', pid).execute())


async def count_active_players(room_id: str) -> int:
    resp = await db(lambda: get_supabase().table('players').select('id', count='exact').eq('room_id', room_id).eq('status', 'active').execute())
    return resp.count or 0
