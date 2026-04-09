import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.connection_manager import manager
from app.services import room_service
import app.services.blackjack_service as bj
import app.services.judgement_service as jdg
import app.services.poker_service as poker
from app.services.timer_service import timer_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ── State builder ─────────────────────────────────────────────────────────────

async def build_state_message(room_id: str) -> dict:
    room = await room_service.get_room_by_id(room_id)
    players = await room_service.get_players(room_id)
    return {'type': 'state', 'room': room, 'players': players}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def save_and_broadcast(room_id: str, game_state: dict, status: str | None = None) -> None:
    if status:
        await room_service.update_room(room_id, game_state=game_state, status=status)
    else:
        await room_service.update_room(room_id, game_state=game_state)
    msg = await build_state_message(room_id)
    await manager.broadcast(room_id, msg)


# ── Timer callback factory (Judgement only) ───────────────────────────────────

def make_judgement_timer(room_id: str):
    async def tick():
        room = await room_service.get_room_by_id(room_id)
        if not room or room.get('status') != 'playing' or room.get('game_type') != 'judgement':
            timer_service.stop(room_id)
            return

        gs = room.get('game_state')
        if not gs:
            return

        result = jdg.check_timer_enforcement(gs)
        if result is None:
            return

        if result == 'start_next_round':
            players = await room_service.get_players(room_id)
            new_gs = jdg.start_next_round(gs, players)
            await save_and_broadcast(room_id, new_gs)
            if new_gs.get('phase') == 'game_over':
                timer_service.stop(room_id)
        elif isinstance(result, dict):
            await save_and_broadcast(room_id, result)

    return tick


# ── Action handlers ───────────────────────────────────────────────────────────

async def handle_blackjack_action(websocket: WebSocket, room: dict, player: dict, data: dict) -> None:
    room_id = room['id']
    gs = room.get('game_state') or {}
    action = data.get('type')
    seat = str(player['seat'])

    new_gs = None

    if action == 'start_game':
        if not player.get('is_host'):
            await manager.send(websocket, {'type': 'error', 'message': 'Only the host can start the game.'})
            return
        players = await room_service.get_players(room_id)
        if len(players) < 2:
            await manager.send(websocket, {'type': 'error', 'message': 'Need at least 2 players to start.'})
            return
        new_gs = bj.start_game(players)
        await room_service.update_room(room_id, game_state=new_gs, status='playing')
        msg = await build_state_message(room_id)
        await manager.broadcast(room_id, msg)
        return

    elif action == 'place_bet':
        amount = data.get('amount', 0)
        new_gs = bj.place_bet(gs, seat, amount)

    elif action == 'deal':
        if not player.get('is_host'):
            await manager.send(websocket, {'type': 'error', 'message': 'Only the host can deal.'})
            return
        new_gs = bj.deal(gs)

    elif action == 'hit':
        new_gs = bj.hit(gs, seat)

    elif action == 'stand':
        new_gs = bj.stand(gs, seat)

    elif action == 'double_down':
        new_gs = bj.double_down(gs, seat)

    elif action == 'new_round':
        if not player.get('is_host'):
            await manager.send(websocket, {'type': 'error', 'message': 'Only the host can start a new round.'})
            return
        players = await room_service.get_players(room_id)
        new_gs = bj.new_round(gs, players)

    elif action in ('leave_room', 'close_room'):
        await handle_leave_or_close(room, player, action)
        return

    else:
        await manager.send(websocket, {'type': 'error', 'message': f'Unknown action: {action}'})
        return

    if new_gs is None:
        await manager.send(websocket, {'type': 'error', 'message': 'Invalid action or not your turn.'})
        return

    # If dealer phase triggered, run it immediately
    if new_gs.get('phase') == 'dealer':
        players = await room_service.get_players(room_id)
        new_gs, balance_deltas = bj.run_dealer(new_gs)
        await room_service.apply_balance_deltas(players, balance_deltas)

    await save_and_broadcast(room_id, new_gs)


async def handle_judgement_action(websocket: WebSocket, room: dict, player: dict, data: dict) -> None:
    room_id = room['id']
    gs = room.get('game_state') or {}
    action = data.get('type')
    seat = int(player['seat'])

    new_gs = None

    if action == 'start_game':
        if not player.get('is_host'):
            await manager.send(websocket, {'type': 'error', 'message': 'Only the host can start the game.'})
            return
        players = await room_service.get_players(room_id)
        if len(players) < 2:
            await manager.send(websocket, {'type': 'error', 'message': 'Need at least 2 players to start.'})
            return
        new_gs = jdg.start_game(players)
        await room_service.update_room(room_id, game_state=new_gs, status='playing')
        # Start timer for Judgement
        timer_service.start(room_id, make_judgement_timer(room_id))
        msg = await build_state_message(room_id)
        await manager.broadcast(room_id, msg)
        return

    elif action == 'place_bid':
        bid = data.get('bid')
        if bid is None:
            await manager.send(websocket, {'type': 'error', 'message': 'Bid value required.'})
            return
        new_gs = jdg.place_bid(gs, seat, int(bid))

    elif action == 'play_card':
        card = data.get('card')
        if not card:
            await manager.send(websocket, {'type': 'error', 'message': 'Card required.'})
            return
        new_gs = jdg.play_card(gs, seat, card)

    elif action in ('leave_room', 'close_room'):
        await handle_leave_or_close(room, player, action)
        return

    else:
        await manager.send(websocket, {'type': 'error', 'message': f'Unknown action: {action}'})
        return

    if new_gs is None:
        await manager.send(websocket, {'type': 'error', 'message': 'Invalid action or not your turn.'})
        return

    # Restart timer when state changes (so timer sees fresh timer_start)
    timer_service.stop(room_id)
    timer_service.start(room_id, make_judgement_timer(room_id))

    await save_and_broadcast(room_id, new_gs)

    if new_gs.get('phase') == 'game_over':
        timer_service.stop(room_id)


async def poker_broadcast(room_id: str, gs: dict, room: dict, players_db: list) -> None:
    """Broadcast personalized poker state (hole cards hidden from others)."""
    def make_msg(player_id: str) -> dict:
        seat = next((str(p['seat']) for p in players_db if p['id'] == player_id), None)
        personal_gs = poker.get_personalized_state(gs, seat) if seat else poker.get_personalized_state(gs, None)
        return {'type': 'state', 'room': {**room, 'game_state': personal_gs}, 'players': players_db}

    await manager.broadcast_personalized(room_id, make_msg)


async def handle_poker_action(websocket: WebSocket, room: dict, player: dict, data: dict) -> None:
    room_id = room['id']
    gs = room.get('game_state') or {}
    action = data.get('type')
    seat = str(player['seat'])

    new_gs = None

    if action == 'start_game':
        if not player.get('is_host'):
            await manager.send(websocket, {'type': 'error', 'message': 'Only the host can start the game.'})
            return
        players = await room_service.get_players(room_id)
        if len(players) < 2:
            await manager.send(websocket, {'type': 'error', 'message': 'Need at least 2 players to start.'})
            return
        new_gs = poker.start_game(players)
        await room_service.update_room(room_id, game_state=new_gs, status='playing')
        players_db = await room_service.get_players(room_id)
        await poker_broadcast(room_id, new_gs, room, players_db)
        return

    elif action == 'poker_action':
        player_action = data.get('action')
        amount = data.get('amount')
        new_gs = poker.apply_action(gs, seat, player_action, amount)

    elif action == 'next_hand':
        if not player.get('is_host'):
            await manager.send(websocket, {'type': 'error', 'message': 'Only the host can start the next hand.'})
            return
        new_gs = poker.start_next_hand(gs)
        if new_gs is None:
            await manager.send(websocket, {'type': 'error', 'message': 'Game over — not enough players.'})
            return

    elif action in ('leave_room', 'close_room'):
        await handle_leave_or_close(room, player, action)
        return

    else:
        await manager.send(websocket, {'type': 'error', 'message': f'Unknown poker action: {action}'})
        return

    if new_gs is None:
        await manager.send(websocket, {'type': 'error', 'message': 'Invalid action or not your turn.'})
        return

    status = 'playing' if new_gs.get('phase') != 'game_over' else 'closed'
    await room_service.update_room(room_id, game_state=new_gs, status=status)
    room_updated = await room_service.get_room_by_id(room_id) or room
    players_db = await room_service.get_players(room_id)
    await poker_broadcast(room_id, new_gs, room_updated, players_db)


async def handle_leave_or_close(room: dict, player: dict, action: str) -> None:
    room_id = room['id']
    if action == 'close_room' or player.get('is_host'):
        await room_service.update_room(room_id, status='closed')
        timer_service.stop(room_id)
        await manager.broadcast(room_id, {'type': 'room_closed'})
    else:
        await room_service.update_player(player['id'], status='left')
        msg = await build_state_message(room_id)
        await manager.broadcast(room_id, msg)


# ── Main WebSocket endpoint ───────────────────────────────────────────────────

@router.websocket("/ws/{code}/{player_token}")
async def ws_room(websocket: WebSocket, code: str, player_token: str):
    # ── Validate room ──────────────────────────────────────────────────────────
    room = await room_service.get_room_by_code(code)
    if not room:
        await websocket.close(code=4004)
        return
    if room['status'] == 'closed':
        await websocket.close(code=4003)
        return

    # ── Validate player ────────────────────────────────────────────────────────
    player = await room_service.get_player_by_token(player_token, room['id'])
    if not player:
        await websocket.close(code=4004)
        return

    room_id = room['id']
    game_type = room.get('game_type', 'blackjack')

    # ── Connect and send current state ────────────────────────────────────────
    await manager.connect(websocket, room_id, player['id'])
    msg = await build_state_message(room_id)
    await manager.broadcast(room_id, msg)

    # ── Resume timer for in-progress Judgement room ───────────────────────────
    if game_type == 'judgement' and room['status'] == 'playing':
        timer_service.start(room_id, make_judgement_timer(room_id))

    try:
        while True:
            data = await websocket.receive_json()
            # Re-fetch room on each action to get latest state
            room = await room_service.get_room_by_id(room_id)
            if not room or room['status'] == 'closed':
                break

            if game_type == 'blackjack':
                await handle_blackjack_action(websocket, room, player, data)
            elif game_type == 'judgement':
                await handle_judgement_action(websocket, room, player, data)
            elif game_type == 'poker':
                await handle_poker_action(websocket, room, player, data)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error for room {room_id}, player {player['id']}: {e}")
    finally:
        manager.disconnect(websocket, room_id)
        # Stop timer only if no one is connected
        if manager.room_connection_count(room_id) == 0:
            timer_service.stop(room_id)
