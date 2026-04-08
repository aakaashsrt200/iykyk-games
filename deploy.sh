#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy iykyk-games to Vercel (frontend) + Railway (backend)
#
# Usage:
#   ./deploy.sh             — deploy both frontend and backend
#   ./deploy.sh frontend    — deploy frontend only (git push → Vercel)
#   ./deploy.sh backend     — deploy backend only (railway up)
#
# Prerequisites:
#   - Vercel: git remote linked to Vercel project (already set up)
#   - Railway: `railway login` + project linked (`railway link`)
#   - backend/.env must have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-both}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[deploy]${RESET} $*"; }
success() { echo -e "${GREEN}[deploy] ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}[deploy] ⚠${RESET} $*"; }
error()   { echo -e "${RED}[deploy] ✗${RESET} $*" >&2; }

echo -e "\n${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║     IYKYK Games — Deploy             ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}\n"

# ── Deploy Frontend (Vercel via git push) ─────────────────────────────────────
deploy_frontend() {
    info "Deploying frontend to Vercel..."

    # Ensure we're on main
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$BRANCH" != "main" ]]; then
        warn "Current branch is '$BRANCH', not 'main'. Vercel production deploys from main."
        read -rp "Continue anyway? [y/N] " confirm
        [[ "$confirm" =~ ^[Yy]$ ]] || { error "Aborted."; exit 1; }
    fi

    # Commit any staged/unstaged changes the user may want included
    if [[ -n "$(git status --porcelain)" ]]; then
        warn "You have uncommitted changes. Committing them now..."
        git add -A
        git commit -m "deploy: pre-deploy snapshot $(date '+%Y-%m-%d %H:%M')"
    fi

    info "Pushing to GitHub (triggers Vercel build)..."
    git push origin main
    success "Pushed. Vercel will build and deploy automatically."

    # Show latest deployment URL if vercel CLI available
    if command -v vercel &>/dev/null; then
        sleep 5
        DEPLOY_URL=$(vercel ls --scope aakaash-ramnath-sankars-projects --format json 2>/dev/null \
            | python3 -c "import json,sys; d=json.load(sys.stdin)['deployments'][0]; print(d['url'])" 2>/dev/null || true)
        if [[ -n "$DEPLOY_URL" ]]; then
            success "Frontend: https://$DEPLOY_URL"
        fi
    fi
}

# ── Deploy Backend (Railway) ──────────────────────────────────────────────────
deploy_backend() {
    info "Deploying backend to Railway..."

    if ! command -v railway &>/dev/null; then
        error "Railway CLI not found. Install with: npm install -g @railway/cli"
        exit 1
    fi

    if ! railway whoami &>/dev/null 2>&1; then
        error "Not authenticated with Railway. Run: railway login"
        exit 1
    fi

    # Check we have a railway project linked
    if [[ ! -f "$ROOT_DIR/railway.toml" ]]; then
        error "railway.toml not found. Run 'railway link' first."
        exit 1
    fi

    info "Uploading backend to Railway (from repo root)..."
    cd "$ROOT_DIR"
    railway up --detach

    success "Backend deployment triggered on Railway."
    info "Monitor progress: railway status  |  railway logs"
}

# ── Run ───────────────────────────────────────────────────────────────────────
case "$TARGET" in
    frontend)
        deploy_frontend
        ;;
    backend)
        deploy_backend
        ;;
    both|"")
        deploy_frontend
        echo ""
        deploy_backend
        ;;
    *)
        error "Unknown target '$TARGET'. Use: frontend | backend | both"
        exit 1
        ;;
esac

echo -e "\n${GREEN}${BOLD}Deploy complete!${RESET}"
echo -e "  Frontend  → https://iykyk-games.vercel.app  (or check Vercel dashboard)"
echo -e "  Backend   → check Railway dashboard for URL\n"
