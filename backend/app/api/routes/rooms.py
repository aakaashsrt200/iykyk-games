import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import room_service

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])

VALID_GAME_TYPES = {"blackjack", "judgement", "poker"}


class CreateRoomRequest(BaseModel):
    name: str
    game_type: str = "blackjack"


class JoinRoomRequest(BaseModel):
    name: str


@router.post("/")
async def create_room(body: CreateRoomRequest):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")
    if body.game_type not in VALID_GAME_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid game_type. Must be one of: {VALID_GAME_TYPES}")

    player_token = str(uuid.uuid4())
    room = await room_service.create_room(body.game_type, player_token)
    player = await room_service.create_player(
        room_id=room['id'],
        name=body.name.strip(),
        player_token=player_token,
        seat=1,
        is_host=True,
    )
    return {
        "room_code": room['code'],
        "room_id": room['id'],
        "player_token": player_token,
        "seat": player['seat'],
    }


@router.post("/{code}/join")
async def join_room(code: str, body: JoinRoomRequest):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")

    room = await room_service.get_room_by_code(code.lower())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found. Check the code.")
    if room['status'] == 'closed':
        raise HTTPException(status_code=409, detail="This room is already closed.")
    if room['status'] == 'playing':
        raise HTTPException(status_code=409, detail="Game already in progress.")

    players = await room_service.get_players(room['id'])
    if len(players) >= room.get('max_players', 8):
        raise HTTPException(status_code=409, detail="Room is full (8 players max).")

    player_token = str(uuid.uuid4())
    seat = len(players) + 1
    player = await room_service.create_player(
        room_id=room['id'],
        name=body.name.strip(),
        player_token=player_token,
        seat=seat,
        is_host=False,
    )
    return {
        "room_code": room['code'],
        "room_id": room['id'],
        "player_token": player_token,
        "seat": player['seat'],
    }
