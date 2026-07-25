# voting-engine

On-chain voting and proposal management engine — Cloudflare Pages + D1 + Solana.

---

## ⚡ Quick start (one command)

**Linux / Mac** — open Terminal:
```bash
git clone https://github.com/atrumin16/voting-engine.git && cd voting-engine && bash scripts/cli/linux/setup.sh
```

**Windows** — open PowerShell as Administrator:
```powershell
git clone https://github.com/atrumin16/voting-engine.git; cd voting-engine; powershell -ExecutionPolicy Bypass -File scripts\cli\windows\setup.ps1
```

The setup script will handle **everything** automatically:

| Step | What it does |
|------|-------------|
| 1 | Installs Node.js if missing (v18 LTS) |
| 2 | Installs Wrangler CLI if missing |
| 3 | Installs project dependencies |
| 4 | Opens browser to log into Cloudflare |
| 5 | Creates the D1 database and updates config |
| 6 | Sets your Solana admin wallet |
| 7 | Applies the database schema |
| ✅ | Starts the dev server at **http://localhost:8788** |

> You only need a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and [Phantom](https://phantom.app) (or any Solana wallet).

---

## 🚀 Deploy to production

**Linux / Mac**
```bash
bash scripts/cli/linux/deploy.sh
```

**Windows**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\cli\windows\deploy.ps1
```

Asks for confirmation before touching anything in production.

---

## Project structure

```
├── public/                     # Frontend (HTML, CSS, JS)
├── functions/api/              # Cloudflare Pages Functions (API)
├── scripts/
│   ├── cli/
│   │   ├── linux/              # Bash scripts (Linux & Mac)
│   │   │   ├── setup.sh
│   │   │   └── deploy.sh
│   │   └── windows/            # PowerShell scripts (Windows)
│   │       ├── setup.ps1
│   │       └── deploy.ps1
│   ├── create_token.mjs        # Solana SPL token deployment
│   └── create_metadata.mjs     # Solana token metadata upload
├── schema.sql                  # Database schema
└── wrangler.toml               # Cloudflare config
```
