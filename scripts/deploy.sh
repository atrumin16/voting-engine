#!/bin/bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      voting-engine  deploy           ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Read DB name from wrangler.toml ──────────────────────────
DB_NAME=$(grep 'database_name' wrangler.toml | grep -oP '(?<=")[^"]+' | head -1)
DB_NAME="${DB_NAME:-attestto-db}"
echo "📡 Target database: $DB_NAME"

# ── Confirm ───────────────────────────────────────────────────
echo ""
read -p "🚀 Deploy to production? This will apply schema + push to Cloudflare Pages. [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ── Apply schema to remote D1 ─────────────────────────────────
echo ""
echo "📐 Applying schema to remote D1..."
wrangler d1 execute "$DB_NAME" --file=schema.sql

# ── Deploy to Cloudflare Pages ────────────────────────────────
echo ""
echo "☁️  Deploying to Cloudflare Pages..."
npm run deploy

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅ Deployed successfully!           ║"
echo "║  Check Cloudflare Pages dashboard   ║"
echo "╚══════════════════════════════════════╝"
