# voting-engine

On-chain voting and proposal management engine — Cloudflare Pages + D1 + Solana.

## Requirements

- [Node.js](https://nodejs.org) ≥ 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) — `npm i -g wrangler`
- A Cloudflare account (free tier works)
- Phantom or any Solana wallet (browser extension)

---

## Run locally

**Linux / Mac**
```bash
bash scripts/setup.sh
```

**Windows (PowerShell)**
```powershell
.\scripts\setup.ps1
```

The script will: install dependencies → log into Cloudflare → create the local D1 database → apply the schema → start the dev server at **http://localhost:8788**.

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

> Make sure the D1 binding is set in your Cloudflare dashboard under **Pages → Settings → Functions → D1 database bindings** (`DB` → `attestto-db`).

---

## Project structure

```
├── public/          # Frontend (HTML, CSS, JS)
├── functions/api/   # Cloudflare Pages Functions (API)
├── scripts/         # Setup, deploy & token scripts
├── schema.sql       # Database schema
└── wrangler.toml    # Cloudflare config
```
