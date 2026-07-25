# voting-engine

On-chain voting and proposal management engine built on Cloudflare Pages + D1 + Solana.

## Stack

- **Frontend** — Vanilla HTML/CSS/JS (`public/`)
- **Backend** — Cloudflare Pages Functions (`functions/api/`)
- **Database** — Cloudflare D1 (SQLite at the edge)
- **Auth** — Solana wallet signature verification (ed25519)
- **Chain** — Solana (SPL Token, Phantom/any wallet adapter)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| Wrangler CLI | ≥ 4 | `npm i -g wrangler` |
| Phantom Wallet | any | Browser extension |

---

## Local Setup

### 1. Clone & install

```bash
git clone https://github.com/atrumin16/voting-engine.git
cd voting-engine
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

This opens a browser to link your Cloudflare account.

### 3. Create the local D1 database

```bash
wrangler d1 create attestto-db
```

Copy the `database_id` from the output and paste it in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "attestto-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 4. Apply the database schema

```bash
wrangler d1 execute attestto-db --local --file=schema.sql
```

This creates all tables and inserts the default config (admin wallet, DAO name, quorum, etc.).

### 5. Run locally

```bash
npm run dev
```

The app will be available at **http://localhost:8788**

> Wrangler simulates the D1 database locally — no cloud calls are made during development.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/proposals` | List all proposals |
| POST | `/api/proposals` | Create a proposal (admin) |
| GET | `/api/proposal?id=` | Get single proposal |
| POST | `/api/vote` | Cast a vote (wallet signature required) |
| GET | `/api/stats` | DAO statistics |
| GET | `/api/members` | Whitelisted members & multipliers |
| GET | `/api/treasury` | Treasury balances |
| GET | `/api/config` | Public DAO config |
| POST | `/api/admin` | Admin actions (authenticated) |
| GET/POST | `/api/profile` | Voter profile |

---

## Scripts

### Create SPL token metadata

```bash
node scripts/create_metadata.mjs
```

### Create SPL token on Solana

```bash
node scripts/create_token.mjs
```

> Requires a funded Solana wallet keypair. Set your RPC endpoint inside the script.

---

## Project Structure

```
voting-engine/
├── public/                  # Static frontend
│   ├── index.html           # Main voting UI
│   ├── admin.html           # Admin panel
│   ├── app.js               # Frontend logic (wallet, proposals, votes)
│   └── attestto-metadata.json
├── functions/
│   └── api/
│       ├── _auth.js         # Wallet signature verification
│       ├── _db.js           # D1 query helpers
│       ├── proposals.js
│       ├── vote.js
│       ├── admin.js
│       ├── members.js
│       ├── treasury.js
│       ├── config.js
│       ├── stats.js
│       └── profile.js
├── scripts/
│   ├── create_token.mjs     # SPL token deployment
│   └── create_metadata.mjs  # Token metadata upload
├── schema.sql               # D1 database schema
├── wrangler.toml            # Cloudflare config
└── package.json
```

---

## Deploy to Production

```bash
npm run deploy
```

Deploys to Cloudflare Pages. Make sure the D1 binding is set in the Cloudflare dashboard under **Settings → Functions → D1 database bindings**.

---

## Default Admin

The default admin wallet is set in `schema.sql`. Update it before deploying:

```sql
INSERT OR IGNORE INTO admin_config (type, value)
VALUES ('admin_wallet', 'YOUR_SOLANA_WALLET_PUBLIC_KEY');
```

Or change it from the Admin panel once running.
