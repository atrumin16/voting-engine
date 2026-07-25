#!/bin/bash
set -e

echo "==> Applying schema to remote D1..."
wrangler d1 execute attestto-db --file=schema.sql

echo "==> Deploying to Cloudflare Pages..."
npm run deploy

echo ""
echo "✅ Deployed! Check your Cloudflare Pages dashboard."
