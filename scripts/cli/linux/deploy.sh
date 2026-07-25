#!/usr/bin/env bash
# =============================================================
#  voting-engine — scripts/cli/linux/deploy.sh
# =============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
info() { echo -e "${CYAN}ℹ️  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
cd "$ROOT_DIR"

echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔════════════════════════════════════════════╗"
echo "  ║         voting-engine  ·  deploy           ║"
echo "  ╚════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Sanity checks ─────────────────────────────────────────────
command -v wrangler &>/dev/null || err "Wrangler not found. Run setup.sh first."
command -v npm      &>/dev/null || err "npm not found. Run setup.sh first."

wrangler whoami &>/dev/null 2>&1 || {
  warn "Not logged in to Cloudflare. Logging in now..."
  wrangler login
}

# ── Read DB name from wrangler.toml ──────────────────────────
DB_NAME=$(grep 'database_name' wrangler.toml | grep -oP '(?<=")[^"]+' | head -1 || echo "attestto-db")
info "Target database: $DB_NAME"

# ── Confirm ───────────────────────────────────────────────────
echo ""
warn "⚠️  This will push changes to PRODUCTION Cloudflare Pages + D1."
read -rp "  Are you sure? Type 'yes' to confirm: " CONFIRM
[[ "$CONFIRM" == "yes" ]] || { info "Aborted."; exit 0; }

# ── Apply schema to remote D1 ─────────────────────────────────
echo ""
info "Applying schema to remote D1..."
wrangler d1 execute "$DB_NAME" --file=schema.sql
ok "Schema applied to remote D1"

# ── Deploy to Cloudflare Pages ────────────────────────────────
echo ""
info "Deploying to Cloudflare Pages..."
npm run deploy
ok "Deploy complete"

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔════════════════════════════════════════════╗"
echo "  ║         ✅  Deployed successfully!         ║"
echo "  ║  Check your Cloudflare Pages dashboard     ║"
echo "  ╚════════════════════════════════════════════╝"
echo -e "${NC}"
