# =============================================================
#  voting-engine — setup.ps1
#  Compatible: Windows 10/11 (PowerShell 5.1+)
#  Run with: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# =============================================================

# ── Fix execution policy for this session ─────────────────────
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# ── Colors ────────────────────────────────────────────────────
function ok($m)   { Write-Host "  ✅ $m" -ForegroundColor Green }
function info($m) { Write-Host "  ℹ️  $m" -ForegroundColor Cyan }
function warn($m) { Write-Host "  ⚠️  $m" -ForegroundColor Yellow }
function err($m)  { Write-Host "  ❌ $m" -ForegroundColor Red; exit 1 }
function ask($m)  { Write-Host "  ❓ $m" -ForegroundColor Blue }
function step($m) { Write-Host "`n  ── $m" -ForegroundColor White }

# ── Move to repo root ─────────────────────────────────────────
$ROOT = Split-Path -Parent $PSScriptRoot
Set-Location $ROOT

# ── Banner ────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  ╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║         voting-engine  ·  setup            ║" -ForegroundColor Cyan
Write-Host "  ╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  This script will install everything you need"
Write-Host "  and walk you through the full setup."
Write-Host ""
Read-Host "  Press ENTER to continue (Ctrl+C to cancel)"

# ── Helper: refresh PATH after installs ───────────────────────
function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

# ── Helper: check if command exists ───────────────────────────
function Has-Command($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ── Step 1: Node.js ───────────────────────────────────────────
step "Step 1/7 · Node.js"

$needNode = $false
if (Has-Command node) {
    $ver = (node -v).TrimStart('v')
    $major = [int]($ver.Split('.')[0])
    if ($major -lt 18) {
        warn "Node.js v$ver found but v18+ is required. Upgrading..."
        $needNode = $true
    } else {
        ok "Node.js v$ver already installed"
    }
} else {
    $needNode = $true
}

if ($needNode) {
    info "Installing Node.js LTS..."
    # Try winget first, then chocolatey, then direct download
    if (Has-Command winget) {
        winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    } elseif (Has-Command choco) {
        choco install nodejs-lts -y
    } else {
        info "Downloading Node.js installer..."
        $installer = "$env:TEMP\node_installer.msi"
        Invoke-WebRequest "https://nodejs.org/dist/lts/node-v20.19.0-x64.msi" -OutFile $installer
        Start-Process msiexec -ArgumentList "/i `"$installer`" /qn" -Wait
        Remove-Item $installer -Force
    }
    Refresh-Path
    if (-not (Has-Command node)) { err "Node.js installation failed. Please install manually: https://nodejs.org" }
    ok "Node.js $(node -v) installed"
}

# ── Step 2: Wrangler ──────────────────────────────────────────
step "Step 2/7 · Wrangler CLI"

if (Has-Command wrangler) {
    ok "Wrangler already installed"
} else {
    info "Installing Wrangler CLI globally..."
    npm install -g wrangler
    Refresh-Path
    if (-not (Has-Command wrangler)) { err "Wrangler installation failed." }
    ok "Wrangler installed"
}

# ── Step 3: Project dependencies ──────────────────────────────
step "Step 3/7 · Project dependencies"
info "Running npm install..."
npm install
ok "Dependencies installed"

# ── Step 4: Cloudflare login ──────────────────────────────────
step "Step 4/7 · Cloudflare login"
info "Checking Cloudflare auth status..."
$whoami = wrangler whoami 2>&1 | Out-String
if ($whoami -match "You are logged in") {
    ok "Already logged in to Cloudflare"
} else {
    info "A browser window will open. Log in to your Cloudflare account."
    wrangler login
    ok "Cloudflare login successful"
}

# ── Step 5: D1 Database ───────────────────────────────────────
step "Step 5/7 · D1 Database"
ask "Database name? [press Enter for 'attestto-db']:"
$DB_NAME = Read-Host "  >"
if ([string]::IsNullOrWhiteSpace($DB_NAME)) { $DB_NAME = "attestto-db" }

info "Creating D1 database '$DB_NAME'..."
$createOutput = wrangler d1 create $DB_NAME 2>&1 | Out-String
Write-Host $createOutput

$DB_ID = ""
if ($createOutput -match 'database_id = "([^"]+)"') { $DB_ID = $Matches[1] }

if ([string]::IsNullOrWhiteSpace($DB_ID)) {
    warn "Could not auto-detect the database_id."
    info "Find it at: https://dash.cloudflare.com → Workers & Pages → D1"
    ask "Paste your database_id here:"
    $DB_ID = Read-Host "  >"
}

if ([string]::IsNullOrWhiteSpace($DB_ID)) { err "database_id is required. Aborting." }

# Patch wrangler.toml
$toml = Get-Content wrangler.toml -Raw
$toml = $toml -replace 'database_name = "[^"]*"', "database_name = `"$DB_NAME`""
$toml = $toml -replace 'database_id = "[^"]*"',   "database_id = `"$DB_ID`""
Set-Content wrangler.toml $toml -Encoding UTF8
ok "wrangler.toml updated (DB: $DB_NAME · ID: $($DB_ID.Substring(0,8))...)"

# ── Step 6: Admin wallet ──────────────────────────────────────
step "Step 6/7 · Admin wallet"
info "The admin wallet is the Solana address that controls this instance."
ask "Your Solana wallet public key? [press Enter to keep the default]:"
$ADMIN_WALLET = Read-Host "  >"

if (-not [string]::IsNullOrWhiteSpace($ADMIN_WALLET)) {
    if ($ADMIN_WALLET.Length -lt 32 -or $ADMIN_WALLET.Length -gt 44) {
        warn "That doesn't look like a valid Solana public key (should be 32-44 chars). Keeping default."
    } else {
        $schema = Get-Content schema.sql -Raw
        $schema = $schema -replace "8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV", $ADMIN_WALLET
        Set-Content schema.sql $schema -Encoding UTF8
        ok "Admin wallet set to $ADMIN_WALLET"
    }
} else {
    warn "Keeping default admin wallet. Remember to change it before going live."
}

# ── Step 7: Apply schema ──────────────────────────────────────
step "Step 7/7 · Database schema"
info "Applying schema to local D1..."
wrangler d1 execute $DB_NAME --local --file=schema.sql
ok "Schema applied"

# ── Summary ───────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║           ✅  Setup complete!              ║" -ForegroundColor Green
Write-Host "  ╠════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "  ║  DB name   : $DB_NAME" -ForegroundColor Green
Write-Host "  ║  DB id     : $($DB_ID.Substring(0,8))..." -ForegroundColor Green
Write-Host "  ║  URL       : http://localhost:8788         ║" -ForegroundColor Green
Write-Host "  ║                                            ║" -ForegroundColor Green
Write-Host "  ║  To deploy to production later run:        ║" -ForegroundColor Green
Write-Host "  ║    .\scripts\deploy.ps1                    ║" -ForegroundColor Green
Write-Host "  ╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

$start = Read-Host "  Start the local dev server now? [Y/n]"
if ([string]::IsNullOrWhiteSpace($start) -or $start -match '^[Yy]$') {
    npm run dev
}
