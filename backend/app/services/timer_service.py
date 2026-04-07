import asyncio
import logging
from typing import Callable, Awaitable

logger = logging.getLogger(__name__)


class TimerService:
    """Manages per-room asyncio tasks that tick every second for timer enforcement."""

    def __init__(self):
        self._tasks: dict[str, asyncio.Task] = {}

    def start(self, room_id: str, tick_fn: Callable[[], Awaitable[None]]) -> None:
        """Start a 1-second tick loop for a room if one isn't already running."""
        if room_id not in self._tasks:
            self._tasks[room_id] = asyncio.create_task(self._run(room_id, tick_fn))

    def stop(self, room_id: str) -> None:
        """Cancel the tick loop for a room."""
        task = self._tasks.pop(room_id, None)
        if task:
            task.cancel()

    async def _run(self, room_id: str, tick_fn: Callable[[], Awaitable[None]]) -> None:
        try:
            while True:
                await asyncio.sleep(1)
                try:
                    await tick_fn()
                except Exception as e:
                    logger.error(f"Timer tick error for room {room_id}: {e}")
        except asyncio.CancelledError:
            pass


timer_service = TimerService()
