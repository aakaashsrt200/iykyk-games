import asyncio
from typing import Any
from supabase import create_client, Client
from app.core.config import get_settings

_client: Client | None = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        s = get_settings()
        _client = create_client(s.supabase_url, s.supabase_service_role_key)
    return _client


async def db(fn) -> Any:
    """Run a synchronous Supabase call in a thread pool to avoid blocking the event loop."""
    return await asyncio.to_thread(fn)
