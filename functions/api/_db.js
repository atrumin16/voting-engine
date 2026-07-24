// functions/api/_db.js
// Auto-initialization helper to guarantee tables exist in Cloudflare D1

export async function initDb(env) {
    if (!env || !env.DB) return;
    try {
        await env.DB.batch([
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS proposals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    category TEXT DEFAULT 'Governance',
                    status TEXT DEFAULT 'active',
                    start_time DATETIME NOT NULL,
                    end_time DATETIME NOT NULL,
                    created_by TEXT NOT NULL,
                    is_pinned INTEGER DEFAULT 0,
                    discussion_url TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS votes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    proposal_id INTEGER NOT NULL,
                    wallet_address TEXT NOT NULL,
                    signature TEXT NOT NULL,
                    vote_power REAL NOT NULL DEFAULT 1.0,
                    choice TEXT NOT NULL,
                    reason TEXT DEFAULT '',
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
                    UNIQUE(proposal_id, wallet_address)
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS admin_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL,
                    value TEXT NOT NULL,
                    is_active BOOLEAN DEFAULT 1,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(type, value)
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS whitelist_voters (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    wallet_address TEXT NOT NULL UNIQUE,
                    tier TEXT DEFAULT 'VIP',
                    multiplier REAL DEFAULT 1.0,
                    added_by TEXT NOT NULL,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS admin_audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_wallet TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details TEXT,
                    signature TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS user_profiles (
                    wallet_address TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `),
            env.DB.prepare("INSERT OR IGNORE INTO admin_config (type, value) VALUES ('admin_wallet', '8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV')"),
            env.DB.prepare("INSERT OR IGNORE INTO user_profiles (wallet_address, display_name) VALUES ('8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV', 'Alberto')"),
            env.DB.prepare("INSERT OR IGNORE INTO admin_config (type, value) VALUES ('dao_name', 'Attestto Governance')"),
            env.DB.prepare("INSERT OR IGNORE INTO admin_config (type, value) VALUES ('dao_description', 'Decentralized Decision-Making & Reputation Governance Protocol')"),
            env.DB.prepare("INSERT OR IGNORE INTO admin_config (type, value) VALUES ('announcement_banner', 'Welcome to Attestto DAO! Connect your Solana wallet to participate in active governance proposals.')"),
            env.DB.prepare("INSERT OR IGNORE INTO admin_config (type, value) VALUES ('min_proposal_power', '1.0')"),
            env.DB.prepare("INSERT OR IGNORE INTO admin_config (type, value) VALUES ('quorum_percentage', '10')"),
            env.DB.prepare("INSERT OR IGNORE INTO admin_config (type, value) VALUES ('voting_duration_days', '7')"),
            env.DB.prepare("INSERT OR IGNORE INTO admin_config (type, value) VALUES ('maintenance_mode', 'false')"),
            env.DB.prepare("INSERT OR REPLACE INTO admin_config (type, value) VALUES ('link_twitter', 'https://x.com/attesttoID')"),
            // Tokenomics Configuration Seeds
            env.DB.prepare("INSERT OR REPLACE INTO admin_config (type, value) VALUES ('governance_token_mint', 'ATTESTTo111111111111111111111111111111111')"),
            env.DB.prepare("INSERT OR REPLACE INTO admin_config (type, value) VALUES ('governance_token_symbol', '$ATTEST')"),
            env.DB.prepare("INSERT OR REPLACE INTO admin_config (type, value) VALUES ('governance_token_logo', 'https://avatars.githubusercontent.com/u/108633374?s=200&v=4')"),
            env.DB.prepare("INSERT OR REPLACE INTO admin_config (type, value) VALUES ('governance_token_supply', '1000000')"),
            env.DB.prepare("INSERT OR REPLACE INTO admin_config (type, value) VALUES ('governance_token_decimals', '9')"),
            // Founder Whitelist & 100k ATTEST Multiplier (10.0x)
            env.DB.prepare(`
                INSERT INTO whitelist_voters (wallet_address, tier, multiplier, added_by)
                VALUES ('8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV', 'Founder & Token Holder (100k $ATTEST)', 10.0, 'SYSTEM')
                ON CONFLICT(wallet_address) DO UPDATE SET tier = excluded.tier, multiplier = excluded.multiplier
            `)
        ]);

        // Seed default institutional proposals if empty
        const propCheck = await env.DB.prepare("SELECT COUNT(*) as count FROM proposals").first();
        if (propCheck && propCheck.count === 0) {
            const futureDate = new Date(Date.now() + 14 * 86400000).toISOString();
            await env.DB.prepare(`
                INSERT INTO proposals (title, description, category, status, start_time, end_time, created_by, is_pinned)
                VALUES 
                ('PIP-1: Establish DAO Institutional Treasury Reserve Fund', 'Authorize the creation of an institutional multi-signature treasury reserve account secured by Squads v4 protocol to manage protocol capital and operational grants.', 'Treasury', 'active', CURRENT_TIMESTAMP, ?, '8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV', 1),
                ('PIP-2: Integrate Automated AML & Sanction List Risk Screening', 'Implement real-time automated wallet screening against OFAC and EU sanctions databases for all governance voting and treasury interactions.', 'Governance', 'active', CURRENT_TIMESTAMP, ?, '8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV', 0)
            `).bind(futureDate, futureDate).run();
        }
    } catch (err) {
        console.error("DB Init Warning:", err.message);
    }
}
