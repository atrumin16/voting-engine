-- schema.sql (Versión Final Profesional - Attestto DAO Governance)

-- Proposals Table
CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'Governance', -- 'Governance', 'Treasury', 'Technical', 'Community'
    status TEXT DEFAULT 'active',      -- 'draft', 'active', 'passed', 'rejected', 'executed', 'cancelled'
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    created_by TEXT NOT NULL,
    is_pinned INTEGER DEFAULT 0,
    discussion_url TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Votes Table
CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    wallet_address TEXT NOT NULL,
    signature TEXT NOT NULL,
    vote_power REAL NOT NULL DEFAULT 1.0,
    choice TEXT NOT NULL,              -- 'yes', 'no', 'abstain'
    reason TEXT DEFAULT '',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
    UNIQUE(proposal_id, wallet_address)
);

-- Admin & DAO Configuration Table
CREATE TABLE IF NOT EXISTS admin_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(type, value)
);

-- Voter Whitelist & Multipliers Table
CREATE TABLE IF NOT EXISTS whitelist_voters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL UNIQUE,
    tier TEXT DEFAULT 'VIP',
    multiplier REAL DEFAULT 1.0,
    added_by TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Admin Cryptographic Audit Log Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_wallet TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    signature TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance & Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_votes_proposal ON votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_wallet ON votes(wallet_address);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_config_type ON admin_config(type);

-- Default Admin Registration & System Configurations
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('admin_wallet', '8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('dao_name', 'Attestto Governance');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('dao_description', 'Decentralized Decision-Making & Reputation Governance Protocol');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('announcement_banner', 'Welcome to Attestto DAO! Connect your Solana wallet to participate in active governance proposals.');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('min_proposal_power', '1.0');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('quorum_percentage', '10');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('voting_duration_days', '7');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('voting_strategy', 'Reputation & Multiplier');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('maintenance_mode', 'false');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('link_twitter', 'https://twitter.com/attestto');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('link_github', 'https://github.com/Attestto-com');
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('link_docs', 'https://attestto.com');