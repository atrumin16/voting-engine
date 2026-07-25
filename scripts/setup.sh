#!/usr/bin/env bash
# =============================================================
#  voting-engine — setup.sh
#  Compatible: macOS, Ubuntu/Debian, Fedora/RHEL, Arch
# =============================================================
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✅ $*${NC}"; }
info() { echo -e "${CYAN}ℹ️  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; exit 1; }
ask()  { echo -e "${BOLD}${BLUE}❓ $*${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}"
echo "  ╔════════════════════════════════════════════╗"
echo "  ║         voting-engine  ·  setup            ║"
echo "  ╚════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  This script will install everything you need"
echo -e "  and walk you through the full setup.\n"
read -rp "  Press ENTER to continue (Ctrl+C to cancel)..." _
echo ""

# ── Detect OS ─────────────────────────────────────────────────
OS="unknown"
PKG_MANAGER=""
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="mac"
elif [[ -f /etc/debian_version ]]; then
  OS="debian"
elif [[ -f /etc/fedora-release ]] || [[ -f /etc/redhat-release ]]; then
  OS="fedora"
elif [[ -f /etc/arch-release ]]; then
  OS="arch"
fi
info "Detected OS: $OS"

# ── Install Homebrew (macOS only) ─────────────────────────────
if [[ "$OS" == "mac" ]] && ! command -v brew &>/dev/null; then
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
fi

# ── Install Node.js ───────────────────────────────────────────
echo -e "\n${BOLD}── Step 1/7 · Node.js ───────────────────────${NC}"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  MAJOR=$(echo "$NODE_VER" | cut -d. -f1 | tr -d 'v')
  if [[ $MAJOR -lt 18 ]]; then
    warn "Node.js $NODE_VER found but v18+ is required. Upgrading..."
    UPGRADE_NODE=true
  else
    ok "Node.js $NODE_VER already installed"
    UPGRADE_NODE=false
  fi
else
  UPGRADE_NODE=true
fi

if [[ "$UPGRADE_NODE" == true ]]; then
  info "Installing Node.js LTS..."
  case "$OS" in
    mac)
      brew install node@20
      brew link --overwrite node@20
      ;;
    debian)
      curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
      sudo apt-get install -y nodejs
      ;;
    fedora)
      curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
      sudo dnf install -y nodejs
      ;;
    arch)
      sudo pacman -S --noconfirm nodejs npm
      ;;
    *)
      warn "Unknown OS. Trying nvm..."
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
      export NVM_DIR="$HOME/.nvm"
      # shellcheck source=/dev/null
      source "$NVM_DIR/nvm.sh"
      nvm install --lts
      nvm use --lts
      ;;
  esac
  ok "Node.js $(node -v) installed"
fi

# ── Install Wrangler ──────────────────────────────────────────
echo -e "\n${BOLD}── Step 2/7 · Wrangler CLI ──────────────────${NC}"
if command -v wrangler &>/dev/null; then
  ok "Wrangler already installed"
else
  info "Installing Wrangler CLI globally..."
  npm install -g wrangler
  ok "Wrangler installed"
fi

# ── Install project dependencies ──────────────────────────────
echo -e "\n${BOLD}── Step 3/7 · Project dependencies ──────────${NC}"
info "Running npm install..."
npm install
ok "Dependencies installed"

# ── Cloudflare login ──────────────────────────────────────────
echo -e "\n${BOLD}── Step 4/7 · Cloudflare login ──────────────${NC}"
info "Checking Cloudflare auth status..."
if wrangler whoami &>/dev/null 2>&1; then
  CF_USER=$(wrangler whoami 2>&1 | grep -oP '(?<=You are logged in with email: ).*' || echo "already logged in")
  ok "Already logged in to Cloudflare ($CF_USER)"
else
  info "A browser window will open. Log in to your Cloudflare account."
  wrangler login
  ok "Cloudflare login successful"
fi

# ── D1 database setup ─────────────────────────────────────────
echo -e "\n${BOLD}── Step 5/7 · D1 Database ───────────────────${NC}"
ask "Database name? [press Enter for 'attestto-db']:"
read -r DB_NAME
DB_NAME="${DB_NAME:-attestto-db}"

info "Creating D1 database '$DB_NAME'..."
CREATE_OUTPUT=$(wrangler d1 create "$DB_NAME" 2>&1) || true
echo "$CREATE_OUTPUT"

DB_ID=$(echo "$CREATE_OUTPUT" | grep -oP '(?<=database_id = ")[^"]+' || true)

if [[ -z "$DB_ID" ]]; then
  warn "Could not auto-detect the database_id."
  info "You can find it at: https://dash.cloudflare.com → Workers & Pages → D1"
  ask "Paste your database_id here:"
  read -r DB_ID
fi

[[ -z "$DB_ID" ]] && err "database_id is required. Aborting."

# Update wrangler.toml
sed -i.bak \
  -e "s|database_name = \"[^\"]*\"|database_name = \"$DB_NAME\"|" \
  -e "s|database_id = \"[^\"]*\"|database_id = \"$DB_ID\"|" \
  wrangler.toml
rm -f wrangler.toml.bak
ok "wrangler.toml updated (DB: $DB_NAME · ID: ${DB_ID:0:8}...)"

# ── Admin wallet ──────────────────────────────────────────────
echo -e "\n${BOLD}── Step 6/7 · Admin wallet ──────────────────${NC}"
info "The admin wallet is the Solana address that controls this instance."
ask "Your Solana wallet public key? [press Enter to keep the default]:"
read -r ADMIN_WALLET

if [[ -n "$ADMIN_WALLET" ]]; then
  # Validate: base58, 32-44 chars
  if [[ ${#ADMIN_WALLET} -lt 32 || ${#ADMIN_WALLET} -gt 44 ]]; then
    warn "That doesn't look like a valid Solana public key (should be 32-44 chars). Keeping default."
  else
    sed -i.bak "s|8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV|$ADMIN_WALLET|g" schema.sql
    rm -f schema.sql.bak
    ok "Admin wallet set to $ADMIN_WALLET"
  fi
else
  warn "Keeping default admin wallet. Remember to change it before going live."
fi

# ── Apply schema ──────────────────────────────────────────────
echo -e "\n${BOLD}── Step 7/7 · Database schema ───────────────${NC}"
info "Applying schema to local D1..."
wrangler d1 execute "$DB_NAME" --local --file=schema.sql
ok "Schema applied"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔════════════════════════════════════════════╗"
echo "  ║           ✅  Setup complete!              ║"
echo "  ╠════════════════════════════════════════════╣"
echo "  ║  DB name   : $DB_NAME"
printf "  ║  DB id     : %.8s...\n" "$DB_ID"
echo "  ║  URL       : http://localhost:8788         ║"
echo "  ║                                            ║"
echo "  ║  To deploy to production later run:        ║"
echo "  ║    bash scripts/deploy.sh                  ║"
echo "  ╚════════════════════════════════════════════╝"
echo -e "${NC}"

read -rp "  Start the local dev server now? [Y/n]: " START
START="${START:-y}"
if [[ "$START" =~ ^[Yy]$ ]]; then
  npm run dev
fi
