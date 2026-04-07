#!/usr/bin/env bash
# =============================================================================
# host.sh — Start the iykyk-games application locally
#
# What it does:
#   1. Kills any process on ports 3000 (frontend) and 8000 (backend)
#   2. Starts FastAPI backend (uvicorn) in background
#   3. Starts React frontend (npm start) in background
#   4. Traps Ctrl+C to kill both processes cleanly
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT=3000
BACKEND_PORT=8000

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[host]${RESET} $*"; }
success() { echo -e "${GREEN}[host] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[host] ⚠${RESET} $*"; }

echo -e "\n${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║      IYKYK Games — Local Host        ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}\n"

# ── Kill ports ────────────────────────────────────────────────────────────────
kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
        echo "$pids" | xargs kill -9 2>/dev/null || true
        warn "Killed process(es) on port $port."
    fi
}

info "Clearing ports $FRONTEND_PORT and $BACKEND_PORT..."
kill_port "$FRONTEND_PORT"
kill_port "$BACKEND_PORT"
sleep 0.5

# ── Activate backend venv ─────────────────────────────────────────────────────
VENV="$ROOT_DIR/backend/venv"
if [[ ! -d "$VENV" ]]; then
    echo -e "${RED}[host] ✗ backend/venv not found. Run ./setup.sh first.${RESET}" >&2
    exit 1
fi

# ── Start backend ─────────────────────────────────────────────────────────────
info "Starting FastAPI backend on :$BACKEND_PORT..."
(
    source "$VENV/bin/activate"
    cd "$ROOT_DIR/backend"
    uvicorn app.main:app \
        --host 0.0.0.0 \
        --port "$BACKEND_PORT" \
        --reload \
        --log-level info
) &
BACKEND_PID=$!
success "Backend PID: $BACKEND_PID"

# Wait a moment for backend to be ready
sleep 2

# ── Start frontend ────────────────────────────────────────────────────────────
info "Starting React frontend on :$FRONTEND_PORT..."
(
    cd "$ROOT_DIR/frontend"
    # Use nvm if available
    if [[ -f "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
        # shellcheck disable=SC1091
        source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    fi
    BROWSER=none npm start
) &
FRONTEND_PID=$!
success "Frontend PID: $FRONTEND_PID"

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}Application running!${RESET}"
echo -e "  Frontend  → ${CYAN}http://localhost:$FRONTEND_PORT${RESET}"
echo -e "  Backend   → ${CYAN}http://localhost:$BACKEND_PORT${RESET}"
echo -e "  API Docs  → ${CYAN}http://localhost:$BACKEND_PORT/docs${RESET}"
echo -e "\n  Press ${BOLD}Ctrl+C${RESET} to stop both services.\n"

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
    echo -e "\n${YELLOW}[host] Stopping services...${RESET}"
    kill "$BACKEND_PID"  2>/dev/null || true
    kill "$FRONTEND_PID" 2>/dev/null || true
    kill_port "$FRONTEND_PORT"
    kill_port "$BACKEND_PORT"
    echo -e "${GREEN}[host] Stopped.${RESET}\n"
}

trap cleanup INT TERM EXIT

# Keep alive
wait "$BACKEND_PID" "$FRONTEND_PID"
