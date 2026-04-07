from app.models.game import Game, Difficulty, GameCategory, GameListResponse

# ── In-memory game catalogue (replace with DB later) ────────────────────────
GAMES: list[Game] = [
    Game(
        id=1, name="Poker", slug="poker",
        suit="♠", suit_color="black",
        description="The definitive game of skill, psychology, and nerve.",
        players_min=2, players_max=9,
        difficulty=Difficulty.hard, category=GameCategory.bluffing,
        tag="Popular",
    ),
    Game(
        id=2, name="Blackjack", slug="blackjack",
        suit="♦", suit_color="red",
        description="Beat the dealer to 21 without busting.",
        players_min=1, players_max=7,
        difficulty=Difficulty.medium, category=GameCategory.strategy,
        tag="Classic",
    ),
    Game(
        id=3, name="Teen Patti", slug="teen-patti",
        suit="♥", suit_color="red",
        description="South Asia's beloved three-card game.",
        players_min=3, players_max=6,
        difficulty=Difficulty.medium, category=GameCategory.bluffing,
        tag="Hot",
    ),
    Game(
        id=4, name="Rummy", slug="rummy",
        suit="♣", suit_color="black",
        description="Form melds and sequences before your opponents.",
        players_min=2, players_max=6,
        difficulty=Difficulty.medium, category=GameCategory.strategy,
        tag="Strategy",
    ),
    Game(
        id=5, name="Solitaire", slug="solitaire",
        suit="♠", suit_color="black",
        description="The timeless solo challenge. Clear the tableau.",
        players_min=1, players_max=1,
        difficulty=Difficulty.easy, category=GameCategory.patience,
        tag="Solo", is_multiplayer=False,
    ),
    Game(
        id=6, name="War", slug="war",
        suit="♦", suit_color="red",
        description="Pure card battle — flip, compare, conquer.",
        players_min=2, players_max=2,
        difficulty=Difficulty.easy, category=GameCategory.luck,
        tag="Quick",
    ),
]


class GameService:
    def list_games(self, active_only: bool = True) -> GameListResponse:
        games = [g for g in GAMES if g.is_active] if active_only else GAMES
        return GameListResponse(games=games, total=len(games))

    def get_game(self, slug: str) -> Game | None:
        return next((g for g in GAMES if g.slug == slug), None)


def get_game_service() -> GameService:
    return GameService()
