# deploy.ps1 — Run with: .\scripts\deploy.ps1
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════╗"
Write-Host "║      voting-engine  deploy           ║"
Write-Host "╚══════════════════════════════════════╝"
Write-Host ""

# ── Read DB name from wrangler.toml ──────────────────────────
$toml = Get-Content wrangler.toml -Raw
$DB_NAME = "attestto-db"
if ($toml -match 'database_name = "([^"]+)"') { $DB_NAME = $Matches[1] }
Write-Host "📡 Target database: $DB_NAME"

# ── Confirm ───────────────────────────────────────────────────
Write-Host ""
$CONFIRM = Read-Host "🚀 Deploy to production? This will apply schema + push to Cloudflare Pages. [y/N]"
if ($CONFIRM -notmatch '^[Yy]$') {
    Write-Host "Aborted."
    exit 0
}

# ── Apply schema to remote D1 ─────────────────────────────────
Write-Host ""
Write-Host "📐 Applying schema to remote D1..."
wrangler d1 execute $DB_NAME --file=schema.sql

# ── Deploy to Cloudflare Pages ────────────────────────────────
Write-Host ""
Write-Host "☁️  Deploying to Cloudflare Pages..."
npm run deploy

Write-Host ""
Write-Host "╔══════════════════════════════════════╗"
Write-Host "║  ✅ Deployed successfully!           ║"
Write-Host "║  Check Cloudflare Pages dashboard   ║"
Write-Host "╚══════════════════════════════════════╝"
