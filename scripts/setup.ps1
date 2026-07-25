# setup.ps1 - Run with: .\scripts\setup.ps1
$ErrorActionPreference = "Stop"

Write-Host "==> Installing dependencies..."
npm install

Write-Host "==> Logging into Cloudflare..."
wrangler login

Write-Host "==> Creating local D1 database..."
try { wrangler d1 create attestto-db } catch { Write-Host "(DB may already exist, continuing...)" }

Write-Host "==> Applying database schema..."
wrangler d1 execute attestto-db --local --file=schema.sql

Write-Host ""
Write-Host "✅ Done! Starting local dev server..."
Write-Host "   Open http://localhost:8788"
Write-Host ""
npm run dev
