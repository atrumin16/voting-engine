// functions/api/treasury.js
import { initDb } from './_db.js';

export async function onRequestGet(context) {
    const { env } = context;
    await initDb(env);

    try {
        // Ensure treasury_transactions table exists in D1
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS treasury_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_hash TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT NOT NULL,
                amount TEXT NOT NULL,
                usd_value REAL NOT NULL,
                recipient TEXT NOT NULL,
                status TEXT DEFAULT 'Completed',
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run();

        // Fetch real transactions from D1
        const txsRes = await env.DB.prepare("SELECT * FROM treasury_transactions ORDER BY id DESC").all();
        const transactions = txsRes.results || [];

        // Fetch active admin wallets to display as real multisig signers
        const adminRes = await env.DB.prepare(
            "SELECT value FROM admin_config WHERE type = 'admin_wallet' AND is_active = 1"
        ).all();
        const adminWallets = (adminRes.results || []).map(a => a.value);

        const signers = adminWallets.map((addr, idx) => ({
            name: `Admin Signer ${idx + 1}`,
            address: `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`,
            status: "Active"
        }));

        // Assets state derived from actual transactions or initial zero balance
        let totalNetWorth = 0;
        let solBalance = 0;
        let usdcBalance = 0;

        transactions.forEach(tx => {
            if (tx.status === 'Completed') {
                totalNetWorth += (tx.usd_value || 0);
                if (tx.amount.includes('SOL')) {
                    const match = tx.amount.match(/([0-9.,]+)\s*SOL/i);
                    if (match) solBalance += parseFloat(match[1].replace(',', ''));
                }
                if (tx.amount.includes('USDC')) {
                    const match = tx.amount.match(/([0-9.,]+)\s*USDC/i);
                    if (match) usdcBalance += parseFloat(match[1].replace(',', ''));
                }
            }
        });

        const assets = [
            {
                symbol: 'SOL',
                name: 'Solana Native',
                balance: solBalance,
                price: 150.00,
                value_usd: solBalance * 150.00,
                allocation_pct: totalNetWorth > 0 ? Math.round(((solBalance * 150) / totalNetWorth) * 100) : 0,
                logo_url: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
                color: 'from-purple-500/20 to-indigo-500/20'
            },
            {
                symbol: 'USDC',
                name: 'USD Coin Stablecoin',
                balance: usdcBalance,
                price: 1.00,
                value_usd: usdcBalance,
                allocation_pct: totalNetWorth > 0 ? Math.round((usdcBalance / totalNetWorth) * 100) : 0,
                logo_url: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
                color: 'from-blue-500/20 to-cyan-500/20'
            }
        ];

        const multisig = {
            vault_address: "Attest5TreasuryVault1111111111111111111111",
            threshold: `${adminWallets.length > 1 ? Math.ceil(adminWallets.length * 0.6) : 1} of ${adminWallets.length || 1} Signers`,
            protocol: "Squads Protocol v4",
            signers: signers.length > 0 ? signers : [
                { name: "DAO Admin", address: "8NHP...ofhV", status: "Active" }
            ]
        };

        return new Response(JSON.stringify({
            total_net_worth_usd: totalNetWorth,
            assets,
            multisig,
            transactions
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
