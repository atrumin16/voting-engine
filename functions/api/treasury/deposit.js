// functions/api/treasury/deposit.js
import { initDb } from '../_db.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const body = await request.json();
        const { txHash, amount, usdValue, senderWallet, note } = body;

        if (!txHash || !amount || !senderWallet) {
            return new Response(JSON.stringify({ error: "Missing required deposit fields (txHash, amount, senderWallet)" }), { status: 400 });
        }

        // Ensure treasury_transactions table exists
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

        const desc = note ? `1-Click Deposit: ${note}` : `On-Chain Community Vault Deposit by ${senderWallet.substring(0, 6)}...${senderWallet.substring(senderWallet.length - 4)}`;
        const usdVal = parseFloat(usdValue || 0);

        await env.DB.prepare(`
            INSERT INTO treasury_transactions (tx_hash, type, description, amount, usd_value, recipient, status, timestamp)
            VALUES (?, 'Deposit', ?, ?, ?, 'DAO Treasury Vault', 'Completed', CURRENT_TIMESTAMP)
        `).bind(txHash, desc, amount, usdVal).run();

        return new Response(JSON.stringify({
            success: true,
            message: "Deposit successfully recorded in Treasury Ledger!",
            txHash
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
