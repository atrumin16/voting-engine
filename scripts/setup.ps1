# setup.ps1 — Run with: .\scripts\setup.ps1
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════╗"
Write-Host "║        voting-engine  setup          ║"
Write-Host "╚══════════════════════════════════════╝"
Write-Host ""

# ── 1. Check Node.js ──────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Node.js not found. Installing via winget..."
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "✅ Node.js $(node -v) found"
}

# ── 2. Check / install Wrangler ───────────────────────────────
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing Wrangler CLI..."
    npm install -g wrangler
} else {
    Write-Host "✅ Wrangler found"
}

# ── 3. Install project dependencies ──────────────────────────
Write-Host ""
Write-Host "📦 Installing project dependencies..."
npm install

# ── 4. Cloudflare login ───────────────────────────────────────
Write-Host ""
Write-Host "🔐 Logging into Cloudflare (browser will open)..."
wrangler login

# ── 5. Ask for DB name ────────────────────────────────────────
Write-Host ""
$DB_NAME = Read-Host "📛 D1 database name [press Enter for 'attestto-db']"
if ([string]::IsNullOrWhiteSpace($DB_NAME)) { $DB_NAME = "attestto-db" }

# ── 6. Create D1 database ─────────────────────────────────────
Write-Host ""
Write-Host "🗄️  Creating D1 database '$DB_NAME'..."
$createOutput = wrangler d1 create $DB_NAME 2>&1 | Out-String
Write-Host $createOutput

$DB_ID = ""
if ($createOutput -match 'database_id = "([^"]+)"') {
    $DB_ID = $Matches[1]
}
if ([string]::IsNullOrWhiteSpace($DB_ID)) {
    $DB_ID = Read-Host "⚠️  Could not auto-detect database_id. Paste it here"
}

# ── 7. Patch wrangler.toml ────────────────────────────────────
$toml = Get-Content wrangler.toml -Raw
$toml = $toml -replace 'database_name = ".*"', "database_name = `"$DB_NAME`""
$toml = $toml -replace 'database_id = ".*"',   "database_id = `"$DB_ID`""
Set-Content wrangler.toml $toml
Write-Host "✅ wrangler.toml updated"

# ── 8. Ask for admin wallet ───────────────────────────────────
Write-Host ""
$ADMIN_WALLET = Read-Host "🔑 Admin Solana wallet public key [press Enter to keep default]"
if (-not [string]::IsNullOrWhiteSpace($ADMIN_WALLET)) {
    $schema = Get-Content schema.sql -Raw
    $schema = $schema -replace "8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV", $ADMIN_WALLET
    Set-Content schema.sql $schema
    Write-Host "✅ Admin wallet updated in schema.sql"
}

# ── 9. Apply schema locally ───────────────────────────────────
Write-Host ""
Write-Host "📐 Applying database schema locally..."
wrangler d1 execute $DB_NAME --local --file=schema.sql

# ── 10. Done — start dev server ───────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════╗"
Write-Host "║  ✅ Setup complete!                  ║"
Write-Host "║  🌐 http://localhost:8788            ║"
Write-Host "╚══════════════════════════════════════╝"
Write-Host ""
npm run dev
