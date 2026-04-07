from enum import Enum
from typing import Optional
from pydantic import BaseModel


class Difficulty(str, Enum):
    easy   = "easy"
    medium = "medium"
    hard   = "hard"


class GameCategory(str, Enum):
    strategy  = "strategy"
    luck      = "luck"
    bluffing  = "bluffing"
    patience  = "patience"


class Game(BaseModel):
    id:          int
    name:        str
    slug:        str
    suit:        str
    suit_color:  str             # "red" | "black"
    description: str
    players_min: int
    players_max: int
    difficulty:  Difficulty
    category:    GameCategory
    tag:         str
    is_active:   bool = True
    is_multiplayer: bool = True


class GameListResponse(BaseModel):
    games:  list[Game]
    total:  int


class AgentRequest(BaseModel):
    game_slug:  str
    user_query: str
    context:    Optional[dict] = None


class AgentResponse(BaseModel):
    reply:      str
    suggestions: list[str] = []
    metadata:   Optional[dict] = None
