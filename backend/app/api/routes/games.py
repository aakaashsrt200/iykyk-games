from fastapi import APIRouter, HTTPException, Depends
from app.models.game import GameListResponse, Game, AgentRequest, AgentResponse
from app.services.game_service import GameService, get_game_service
from app.agents.game_agent import GameAgent, get_game_agent
from app.agents.base_agent import AgentContext

router = APIRouter(prefix="/games", tags=["Games"])


@router.get("/", response_model=GameListResponse)
async def list_games(
    service: GameService = Depends(get_game_service),
):
    return service.list_games()


@router.get("/{slug}", response_model=Game)
async def get_game(
    slug: str,
    service: GameService = Depends(get_game_service),
):
    game = service.get_game(slug)
    if not game:
        raise HTTPException(status_code=404, detail=f"Game '{slug}' not found.")
    return game


@router.post("/{slug}/ask", response_model=AgentResponse)
async def ask_game_agent(
    slug: str,
    body: AgentRequest,
    service: GameService = Depends(get_game_service),
    agent:   GameAgent   = Depends(get_game_agent),
):
    game = service.get_game(slug)
    if not game:
        raise HTTPException(status_code=404, detail=f"Game '{slug}' not found.")

    ctx = AgentContext(
        metadata={"game": game.model_dump(), **(body.context or {})},
    )
    reply = await agent.run(body.user_query, ctx)

    return AgentResponse(
        reply=reply,
        suggestions=[
            f"How do I win at {game.name}?",
            f"What are the rules for {game.name}?",
            f"Give me a {game.name} strategy tip.",
        ],
        metadata={"session_id": ctx.session_id, "turns": ctx.turn},
    )
