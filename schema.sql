-- schema.sql (Versión Final Robusta)
CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    wallet_address TEXT NOT NULL,
    signature TEXT NOT NULL,
    vote_power REAL NOT NULL,
    choice TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(proposal_id) REFERENCES proposals(id),
    UNIQUE(proposal_id, wallet_address)
);

CREATE TABLE IF NOT EXISTS admin_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(type, value)
);

-- Índices seguros (no fallan si ya existen)
CREATE INDEX IF NOT EXISTS idx_votes_proposal ON votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_wallet ON votes(wallet_address);

-- Registro del Admin Fundador (seguro por el UNIQUE de la tabla)
INSERT OR IGNORE INTO admin_config (type, value) VALUES ('admin_wallet', '8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV');