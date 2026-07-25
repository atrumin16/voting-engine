# =============================================================
#  voting-engine — deploy.ps1
#  Run with: powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
# =============================================================
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

function ok($m)   { Write-Host "  ✅ $m" -ForegroundColor Green }
function info($m) { Write-Host "  ℹ️  $m" -ForegroundColor Cyan }
function warn($m) { Write-Host "  ⚠️  $m" -ForegroundColor Yellow }
function err($m)  { Write-Host "  ❌ $m" -ForegroundColor Red; exit 1 }

$ROOT = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Set-Location $ROOT

Write-Host ""
Write-Host "  ╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║         voting-engine  ·  deploy           ║" -ForegroundColor Cyan
Write-Host "  ╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Sanity checks ─────────────────────────────────────────────
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) { err "Wrangler not found. Run setup.ps1 first." }
if (-not (Get-Command npm      -ErrorAction SilentlyContinue)) { err "npm not found. Run setup.ps1 first." }

$whoami = wrangler whoami 2>&1 | Out-String
if ($whoami -notmatch "You are logged in") {
    warn "Not logged in to Cloudflare. Logging in now..."
    wrangler login
}

# ── Read DB name from wrangler.toml ──────────────────────────
$toml   = Get-Content wrangler.toml -Raw
$DB_NAME = "attestto-db"
if ($toml -match 'database_name = "([^"]+)"') { $DB_NAME = $Matches[1] }
info "Target database: $DB_NAME"

# ── Confirm ───────────────────────────────────────────────────
Write-Host ""
warn "This will push changes to PRODUCTION Cloudflare Pages + D1."
$CONFIRM = Read-Host "  Are you sure? Type 'yes' to confirm"
if ($CONFIRM -ne "yes") { info "Aborted."; exit 0 }

# ── Apply schema to remote D1 ─────────────────────────────────
Write-Host ""
info "Applying schema to remote D1..."
wrangler d1 execute $DB_NAME --file=schema.sql
ok "Schema applied to remote D1"

# ── Deploy to Cloudflare Pages ────────────────────────────────
Write-Host ""
info "Deploying to Cloudflare Pages..."
npm run deploy
ok "Deploy complete"

Write-Host ""
Write-Host "  ╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║         ✅  Deployed successfully!         ║" -ForegroundColor Green
Write-Host "  ║  Check your Cloudflare Pages dashboard     ║" -ForegroundColor Green
Write-Host "  ╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
