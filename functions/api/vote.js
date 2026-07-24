// functions/api/vote.js
import { initDb } from './_db.js';
import { verifySignature, isValidSolanaAddress } from './_auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const body = await request.json();
        const { proposalId, wallet, signature, choice, reason, timestamp } = body;

        if (!proposalId || !wallet || !signature || !choice || !timestamp) {
            throw new Error("Missing required voting parameter fields");
        }

        if (!['yes', 'no', 'abstain'].includes(choice)) {
            throw new Error("Invalid voting choice. Must be 'yes', 'no', or 'abstain'");
        }

        if (!isValidSolanaAddress(wallet)) {
            throw new Error("Invalid Solana wallet address format");
        }

        // Prevent replay attacks (2 min limit)
        if (Math.abs(Date.now() - timestamp) > 120000) {
            throw new Error("Voting timestamp expired or system clock out of sync");
        }

        // Check maintenance mode
        const maintConfig = await env.DB.prepare(
            "SELECT value FROM admin_config WHERE type = 'maintenance_mode' AND is_active = 1"
        ).first();
        if (maintConfig && maintConfig.value === 'true') {
            throw new Error("DAO voting is currently paused for scheduled maintenance");
        }

        // Verify proposal state
        const proposal = await env.DB.prepare("SELECT * FROM proposals WHERE id = ?").bind(proposalId).first();
        if (!proposal) {
            throw new Error("Proposal not found");
        }

        if (proposal.status !== 'active') {
            throw new Error(`Cannot vote on proposal with status '${proposal.status}'`);
        }

        const now = new Date();
        const endTime = new Date(proposal.end_time);
        const startTime = new Date(proposal.start_time);
        if (now < startTime) {
            throw new Error("Voting for this proposal has not opened yet");
        }
        if (now > endTime) {
            throw new Error("Voting for this proposal has closed");
        }

        // Verify cryptographic signature
        const message = `Attestto Official Vote | Proposal: ${proposalId} | Choice: ${choice} | Ts: ${timestamp}`;
        await verifySignature(wallet, signature, message);

        // Check voter whitelist multiplier
        const whitelistEntry = await env.DB.prepare(
            "SELECT multiplier FROM whitelist_voters WHERE wallet_address = ?"
        ).bind(wallet).first();
        const votePower = whitelistEntry ? parseFloat(whitelistEntry.multiplier || 1.0) : 1.0;

        // Upsert vote into database
        await env.DB.prepare(`
            INSERT INTO votes (proposal_id, wallet_address, signature, vote_power, choice, reason, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(proposal_id, wallet_address) DO UPDATE SET
                signature = excluded.signature,
                vote_power = excluded.vote_power,
                choice = excluded.choice,
                reason = excluded.reason,
                timestamp = CURRENT_TIMESTAMP
        `).bind(proposalId, wallet, signature, votePower, choice, reason || '').run();

        return new Response(JSON.stringify({ 
            success: true, 
            message: "Vote successfully cast and cryptographically verified!",
            vote_power: votePower 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
}
