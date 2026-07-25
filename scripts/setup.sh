#!/bin/bash
set -e

echo "==> Installing dependencies..."
npm install

echo "==> Logging into Cloudflare..."
wrangler login

echo "==> Creating local D1 database..."
wrangler d1 create attestto-db 2>/dev/null || echo "(DB may already exist, continuing...)"

echo "==> Applying database schema..."
wrangler d1 execute attestto-db --local --file=schema.sql

echo ""
echo "✅ Done! Starting local dev server..."
echo "   Open http://localhost:8788"
echo ""
npm run dev
