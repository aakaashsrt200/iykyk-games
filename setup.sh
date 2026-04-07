#!/usr/bin/env bash
# =============================================================================
# setup.sh — One-time environment setup for iykyk-games
#
# What it does:
#   1. Checks / installs Python 3.12 via pyenv
#   2. Creates a virtualenv in backend/venv
#   3. Installs Python dependencies
#   4. Checks / installs Node 20 via nvm
#   5. Installs npm dependencies in frontend/
#   6. Creates .env files from templates if they don't exist
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_VERSION="3.12.3"
NODE_VERSION="20"

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[setup]${RESET} $*"; }
success() { echo -e "${GREEN}[setup] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[setup] ⚠${RESET} $*"; }
error()   { echo -e "${RED}[setup] ✗${RESET} $*" >&2; }

echo -e "\n${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║       IYKYK Games — Setup            ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}\n"

# ── 1. Python via pyenv ───────────────────────────────────────────────────────
info "Checking Python..."

if ! command -v pyenv &>/dev/null; then
    warn "pyenv not found. Installing pyenv..."
    curl -fsSL https://pyenv.run | bash

    export PYENV_ROOT="$HOME/.pyenv"
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init -)"
    eval "$(pyenv virtualenv-init -)" 2>/dev/null || true
    success "pyenv installed."
else
    export PYENV_ROOT="${PYENV_ROOT:-$HOME/.pyenv}"
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init -)"
    eval "$(pyenv virtualenv-init -)" 2>/dev/null || true
fi

CURRENT_PY=$(python3 --version 2>/dev/null | awk '{print $2}' || echo "none")
REQUIRED_MAJOR=3
REQUIRED_MINOR=11

PY_OK=false
if [[ "$CURRENT_PY" != "none" ]]; then
    IFS='.' read -r maj min _patch <<< "$CURRENT_PY"
    if [[ "$maj" -ge "$REQUIRED_MAJOR" && "$min" -ge "$REQUIRED_MINOR" ]]; then
        PY_OK=true
    fi
fi

if $PY_OK; then
    success "Python $CURRENT_PY is compatible."
else
    info "Installing Python $PYTHON_VERSION via pyenv..."
    pyenv install -s "$PYTHON_VERSION"
    pyenv local "$PYTHON_VERSION"
    success "Python $PYTHON_VERSION installed."
fi

# ── 2. Backend virtualenv ─────────────────────────────────────────────────────
info "Setting up Python virtual environment..."
VENV_DIR="$ROOT_DIR/backend/venv"

if [[ ! -d "$VENV_DIR" ]]; then
    python3 -m venv "$VENV_DIR"
    success "Virtual environment created at backend/venv"
else
    success "Virtual environment already exists."
fi

# Activate venv
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

info "Installing Python dependencies..."
pip install --upgrade pip --quiet
pip install -r "$ROOT_DIR/backend/requirements.txt" --quiet
success "Python dependencies installed."

# ── 3. Node via nvm ───────────────────────────────────────────────────────────
info "Checking Node.js..."

NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ ! -f "$NVM_DIR/nvm.sh" ]]; then
    warn "nvm not found. Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    success "nvm installed."
fi

# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh"

CURRENT_NODE=$(node --version 2>/dev/null || echo "none")
NODE_OK=false
if [[ "$CURRENT_NODE" != "none" ]]; then
    NODE_MAJOR=$(echo "$CURRENT_NODE" | sed 's/v\([0-9]*\).*/\1/')
    if [[ "$NODE_MAJOR" -ge "$NODE_VERSION" ]]; then
        NODE_OK=true
    fi
fi

if $NODE_OK; then
    success "Node $CURRENT_NODE is compatible."
else
    info "Installing Node $NODE_VERSION via nvm..."
    nvm install "$NODE_VERSION"
    nvm use "$NODE_VERSION"
    nvm alias default "$NODE_VERSION"
    success "Node $NODE_VERSION installed."
fi

# ── 4. Frontend npm install ───────────────────────────────────────────────────
info "Installing frontend npm dependencies..."
cd "$ROOT_DIR/frontend"
npm install --silent
success "npm dependencies installed."
cd "$ROOT_DIR"

# ── 5. .env files ────────────────────────────────────────────────────────────
info "Setting up .env files..."

if [[ ! -f "$ROOT_DIR/frontend/.env" ]]; then
    cp "$ROOT_DIR/frontend/.env.example" "$ROOT_DIR/frontend/.env"
    success "Created frontend/.env from example."
else
    success "frontend/.env already exists."
fi

if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
    warn "backend/.env not found — creating from template..."
    cat > "$ROOT_DIR/backend/.env" << 'ENVEOF'
APP_ENV=development
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
BACKEND_RELOAD=true
SECRET_KEY=change-me-generate-with-openssl-rand-hex-32
ALLOWED_ORIGINS=http://localhost:3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DATABASE_URL=
REDIS_URL=
ENVEOF
    warn "Created backend/.env — add your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY!"
else
    success "backend/.env already exists."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}✓ Setup complete!${RESET}"
echo -e "  Run ${CYAN}./host.sh${RESET} to start the application.\n"
echo -e "  ${YELLOW}Required secrets in backend/.env:${RESET}"
echo -e "    SUPABASE_URL             — your Supabase project URL"
echo -e "    SUPABASE_SERVICE_ROLE_KEY — from Supabase dashboard → Settings → API"
echo -e "    ANTHROPIC_API_KEY        — optional, for AI features\n"
