from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes.health import router as health_router
from app.api.routes.games import router as games_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────
    settings = get_settings()
    print(f"[iykyk-games] Starting in {settings.app_env} mode on :{settings.backend_port}")
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────
    print("[iykyk-games] Shutting down.")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="IYKYK Games API",
        description="Backend API for the IYKYK Games card game platform.",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ───────────────────────────────────────────────────────────
    app.include_router(health_router)
    app.include_router(games_router, prefix="/api")

    return app


app = create_app()
