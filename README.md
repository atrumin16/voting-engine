# voting-engine

On-chain voting and proposal management engine — Cloudflare Pages + D1 + Solana.

---

## Setup local (first time)

The script installs everything it needs and asks you a few questions:

**Linux / Mac**
```bash
bash scripts/setup.sh
```

**Windows (PowerShell)**
```powershell
.\scripts\setup.ps1
```

It will:
1. Install Node.js if missing
2. Install Wrangler CLI if missing
3. Install project dependencies (`npm install`)
4. Open browser to log into Cloudflare
5. Ask for a D1 database name (default: `attestto-db`)
6. Create the database and auto-fill `wrangler.toml`
7. Ask for your admin Solana wallet public key
8. Apply the database schema locally
9. Start the dev server at **http://localhost:8788**

---

## Deploy to production

**Linux / Mac**
```bash
bash scripts/deploy.sh
```

**Windows (PowerShell)**
```powershell
.\scripts\deploy.ps1
```

It will ask for confirmation, apply the schema to the remote D1, and deploy to Cloudflare Pages.

---

## Project structure

```
├── public/          # Frontend (HTML, CSS, JS)
├── functions/api/   # Cloudflare Pages Functions (API)
├── scripts/         # Setup, deploy & token scripts
├── schema.sql       # Database schema
└── wrangler.toml    # Cloudflare config
```
