from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # room_id -> set of (websocket, player_id) tuples
        self._rooms: dict[str, set[tuple]] = defaultdict(set)

    async def connect(self, websocket: WebSocket, room_id: str, player_id: str) -> None:
        await websocket.accept()
        self._rooms[room_id].add((websocket, player_id))

    def disconnect(self, websocket: WebSocket, room_id: str) -> None:
        self._rooms[room_id] = {
            pair for pair in self._rooms[room_id] if pair[0] is not websocket
        }
        if not self._rooms[room_id]:
            del self._rooms[room_id]

    async def broadcast(self, room_id: str, message: dict) -> None:
        pairs = list(self._rooms.get(room_id, set()))
        dead = []
        for ws, pid in pairs:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, room_id)

    async def send(self, websocket: WebSocket, message: dict) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            pass

    def room_connection_count(self, room_id: str) -> int:
        return len(self._rooms.get(room_id, set()))


manager = ConnectionManager()
