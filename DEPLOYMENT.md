# Deployment Guide

> How to run voting-engine locally and deploy it to production on Cloudflare.

---

## Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18 | Runtime |
| Wrangler CLI | ≥ 4 | Cloudflare dev server & deploy |
| Cloudflare account | Free tier | Pages + D1 hosting |
| Phantom wallet | Any | Admin access & testing |

Don't worry — the setup script installs Node.js and Wrangler automatically if missing.

---

## ⚡ Quick start — one command

**Linux / Mac** — open Terminal:
```bash
git clone https://github.com/atrumin16/voting-engine.git && cd voting-engine && bash scripts/cli/linux/setup.sh
```

**Windows** — open PowerShell as Administrator:
```powershell
git clone https://github.com/atrumin16/voting-engine.git; cd voting-engine; powershell -ExecutionPolicy Bypass -File scripts\cli\windows\setup.ps1
```

The script walks you through every step interactively.

---

## What the setup script does

| Step | Action |
|------|--------|
| 1 | Detects your OS and installs Node.js LTS if missing |
| 2 | Installs Wrangler CLI globally via npm |
| 3 | Runs `npm install` for project dependencies |
| 4 | Opens browser to authenticate with Cloudflare |
| 5 | Creates the D1 database and auto-fills `wrangler.toml` |
| 6 | Asks for your Solana admin wallet public key (validates format) |
| 7 | Applies the SQL schema to the local database |
| ✅ | Starts the dev server at **http://localhost:8788** |

---

## Manual setup (step by step)

If you prefer to do it manually instead of using the script:

### 1. Install dependencies
```bash
npm install -g wrangler
npm install
```

### 2. Log into Cloudflare
```bash
wrangler login
```

### 3. Create the D1 database
```bash
wrangler d1 create my-db-name
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "my-db-name"
database_id = "paste-your-id-here"
```

### 4. Set your admin wallet

Open `schema.sql` and replace the default wallet address:

```sql
INSERT OR IGNORE INTO admin_config (type, value)
VALUES ('admin_wallet', 'YOUR_SOLANA_PUBLIC_KEY_HERE');
```

### 5. Apply the schema locally
```bash
wrangler d1 execute my-db-name --local --file=schema.sql
```

### 6. Start the dev server
```bash
npm run dev
# → http://localhost:8788
```

---

## Deploy to production

**Linux / Mac**
```bash
bash scripts/cli/linux/deploy.sh
```

**Windows**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\cli\windows\deploy.ps1
```

The deploy script:
1. Confirms you want to deploy to production
2. Applies the schema to the **remote** D1 database
3. Runs `npm run deploy` (Wrangler Pages deploy)

### After deploying — Cloudflare dashboard setup

Go to **Cloudflare Dashboard → Pages → your project → Settings → Functions → D1 database bindings** and add:

| Variable name | D1 database |
|---|---|
| `DB` | `my-db-name` |

---

## Configuration

All DAO settings are stored in the `admin_config` table and editable from the Admin panel in the UI (wallet signature required). Key settings:

| Key | Default | Description |
|-----|---------|-------------|
| `admin_wallet` | *(your wallet)* | Controls admin access |
| `dao_name` | `Attestto Governance` | Displayed in the UI |
| `quorum_percentage` | `10` | % of members required for a valid vote |
| `voting_duration_days` | `7` | Default proposal duration |
| `voting_strategy` | `Reputation & Multiplier` | Voting weight model |
| `min_proposal_power` | `1.0` | Minimum power to create proposals |
| `maintenance_mode` | `false` | Locks the UI for non-admins |

---

## Project structure

```
├── public/                     # Frontend (HTML, CSS, JS)
│   ├── index.html              # Main app (proposals, members, treasury, analytics)
│   ├── admin.html              # Admin panel
│   └── app.js                  # Frontend logic
├── functions/
│   └── api/                    # Cloudflare Pages Functions (serverless API)
│       ├── _auth.js            # ed25519 wallet signature verification
│       ├── _db.js              # D1 query helpers
│       ├── proposals.js
│       ├── vote.js
│       ├── admin.js
│       ├── members.js
│       ├── treasury.js
│       ├── config.js
│       ├── stats.js
│       └── profile.js
├── scripts/
│   ├── cli/
│   │   ├── linux/              # Bash scripts (Linux & Mac)
│   │   │   ├── setup.sh
│   │   │   └── deploy.sh
│   │   └── windows/            # PowerShell scripts (Windows)
│   │       ├── setup.ps1
│   │       └── deploy.ps1
│   ├── create_token.mjs        # Deploy SPL governance token to Solana
│   └── create_metadata.mjs     # Upload token metadata (Metaplex)
├── schema.sql                  # D1 database schema & default config
└── wrangler.toml               # Cloudflare project config
```

---

## Troubleshooting

**`wrangler: command not found`**
```bash
npm install -g wrangler
```

**`D1_ERROR: no such table`**
Run the schema again:
```bash
wrangler d1 execute my-db-name --local --file=schema.sql
```

**`Admin action failed: unauthorized`**
Your connected wallet is not registered as admin. Add it via `schema.sql` before applying, or use an existing admin wallet to add it from the Admin panel.

**`Error: database_id not found`**
Make sure `wrangler.toml` has the correct `database_id` from `wrangler d1 list`.
