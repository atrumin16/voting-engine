#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        voting-engine  setup          ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "⚠️  Node.js not found. Installing via nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  source "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
else
  echo "✅ Node.js $(node -v) found"
fi

# ── 2. Check / install Wrangler ───────────────────────────────
if ! command -v wrangler &>/dev/null; then
  echo "📦 Installing Wrangler CLI..."
  npm install -g wrangler
else
  echo "✅ Wrangler $(wrangler --version | head -1) found"
fi

# ── 3. Install project dependencies ──────────────────────────
echo ""
echo "📦 Installing project dependencies..."
npm install

# ── 4. Cloudflare login ───────────────────────────────────────
echo ""
echo "🔐 Logging into Cloudflare (browser will open)..."
wrangler login

# ── 5. Ask for DB name ────────────────────────────────────────
echo ""
read -p "📛 D1 database name [attestto-db]: " DB_NAME
DB_NAME="${DB_NAME:-attestto-db}"

# ── 6. Create D1 database ─────────────────────────────────────
echo ""
echo "🗄️  Creating D1 database '$DB_NAME'..."
CREATE_OUTPUT=$(wrangler d1 create "$DB_NAME" 2>&1) || true
echo "$CREATE_OUTPUT"

DB_ID=$(echo "$CREATE_OUTPUT" | grep -oP '(?<=database_id = ")[^"]+' || true)
if [ -z "$DB_ID" ]; then
  echo ""
  read -p "⚠️  Could not auto-detect database_id. Paste it here: " DB_ID
fi

# ── 7. Patch wrangler.toml ────────────────────────────────────
sed -i.bak \
  -e "s|database_name = \".*\"|database_name = \"$DB_NAME\"|" \
  -e "s|database_id = \".*\"|database_id = \"$DB_ID\"|" \
  wrangler.toml
echo "✅ wrangler.toml updated"

# ── 8. Ask for admin wallet ───────────────────────────────────
echo ""
read -p "🔑 Admin Solana wallet public key [leave blank to keep default]: " ADMIN_WALLET
if [ -n "$ADMIN_WALLET" ]; then
  sed -i "s|8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV|$ADMIN_WALLET|g" schema.sql
  echo "✅ Admin wallet updated in schema.sql"
fi

# ── 9. Apply schema locally ───────────────────────────────────
echo ""
echo "📐 Applying database schema locally..."
wrangler d1 execute "$DB_NAME" --local --file=schema.sql

# ── 10. Done — start dev server ───────────────────────────────
echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ Setup complete!                  ║"
echo "║  🌐 http://localhost:8788            ║"
echo "╚══════════════════════════════════════╝"
echo ""
npm run dev
