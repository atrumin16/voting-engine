# deploy.ps1 - Run with: .\scripts\deploy.ps1
$ErrorActionPreference = "Stop"

Write-Host "==> Applying schema to remote D1..."
wrangler d1 execute attestto-db --file=schema.sql

Write-Host "==> Deploying to Cloudflare Pages..."
npm run deploy

Write-Host ""
Write-Host "✅ Deployed! Check your Cloudflare Pages dashboard."
