#!/usr/bin/env bash
# =============================================================================
# docker-build.sh — Build Docker images for iykyk-games
#
# What it does:
#   1. Checks Docker & Docker Compose are available
#   2. Stops any running containers for this project
#   3. Builds frontend and backend images (with build args)
#   4. Optionally runs the stack with docker compose
#
# Usage:
#   ./docker-build.sh           # build only
#   ./docker-build.sh --run     # build + start
#   ./docker-build.sh --push    # build + push to registry
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_PREFIX="iykyk-games"
REGISTRY="${DOCKER_REGISTRY:-""}"   # set DOCKER_REGISTRY env var to push
TAG="${DOCKER_TAG:-latest}"

# ── Flags ─────────────────────────────────────────────────────────────────────
RUN_AFTER=false
PUSH_AFTER=false
for arg in "$@"; do
    case $arg in
        --run)  RUN_AFTER=true  ;;
        --push) PUSH_AFTER=true ;;
    esac
done

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[docker]${RESET} $*"; }
success() { echo -e "${GREEN}[docker] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[docker] ⚠${RESET} $*"; }
error()   { echo -e "${RED}[docker] ✗${RESET} $*" >&2; exit 1; }

echo -e "\n${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║    IYKYK Games — Docker Build        ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}\n"

# ── Prerequisite checks ───────────────────────────────────────────────────────
command -v docker        &>/dev/null || error "Docker not found. Install from https://docker.com"
command -v docker        &>/dev/null && docker info &>/dev/null || error "Docker daemon is not running."

COMPOSE_CMD=""
if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
else
    warn "docker compose not found — skipping compose steps."
fi

# ── Stop running containers ───────────────────────────────────────────────────
if [[ -n "$COMPOSE_CMD" ]]; then
    info "Stopping existing containers..."
    $COMPOSE_CMD -f "$ROOT_DIR/docker-compose.yml" down --remove-orphans 2>/dev/null || true
fi

# ── Build frontend ────────────────────────────────────────────────────────────
FRONTEND_IMAGE="${REGISTRY:+$REGISTRY/}${IMAGE_PREFIX}-frontend:${TAG}"
info "Building frontend image → $FRONTEND_IMAGE"

docker build \
    --file "$ROOT_DIR/frontend/Dockerfile" \
    --tag  "$FRONTEND_IMAGE" \
    --build-arg REACT_APP_API_URL="/api" \
    --build-arg REACT_APP_APP_NAME="IYKYK Games" \
    --progress plain \
    "$ROOT_DIR/frontend"

success "Frontend image built: $FRONTEND_IMAGE"

# ── Build backend ─────────────────────────────────────────────────────────────
BACKEND_IMAGE="${REGISTRY:+$REGISTRY/}${IMAGE_PREFIX}-backend:${TAG}"
info "Building backend image → $BACKEND_IMAGE"

docker build \
    --file "$ROOT_DIR/backend/Dockerfile" \
    --tag  "$BACKEND_IMAGE" \
    --progress plain \
    "$ROOT_DIR/backend"

success "Backend image built: $BACKEND_IMAGE"

# ── Push ──────────────────────────────────────────────────────────────────────
if $PUSH_AFTER; then
    if [[ -z "$REGISTRY" ]]; then
        warn "--push specified but DOCKER_REGISTRY is not set. Skipping push."
    else
        info "Pushing $FRONTEND_IMAGE..."
        docker push "$FRONTEND_IMAGE"
        info "Pushing $BACKEND_IMAGE..."
        docker push "$BACKEND_IMAGE"
        success "Images pushed to $REGISTRY."
    fi
fi

# ── Run ───────────────────────────────────────────────────────────────────────
if $RUN_AFTER; then
    if [[ -z "$COMPOSE_CMD" ]]; then
        warn "docker compose not available. Start containers manually."
    else
        info "Starting stack with docker compose..."
        $COMPOSE_CMD -f "$ROOT_DIR/docker-compose.yml" up -d
        success "Stack is running!"
        echo -e "\n  Frontend  → ${CYAN}http://localhost:3000${RESET}"
        echo -e "  Backend   → ${CYAN}http://localhost:8000${RESET}"
        echo -e "  API Docs  → ${CYAN}http://localhost:8000/docs${RESET}"
        echo -e "\n  Run ${BOLD}docker compose logs -f${RESET} to tail logs."
        echo -e "  Run ${BOLD}docker compose down${RESET} to stop.\n"
    fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}Build complete!${RESET}"
echo -e "  Frontend  → ${CYAN}$FRONTEND_IMAGE${RESET}"
echo -e "  Backend   → ${CYAN}$BACKEND_IMAGE${RESET}"
if ! $RUN_AFTER; then
    echo -e "\n  Run ${BOLD}./docker-build.sh --run${RESET} to build and start."
    echo -e "  Run ${BOLD}docker compose up${RESET} to start without rebuilding.\n"
fi
