// functions/api/stats.js
import { initDb } from './_db.js';

export async function onRequestGet(context) {
    const { env } = context;
    await initDb(env);

    try {
        const totalProposals = await env.DB.prepare("SELECT COUNT(*) as count FROM proposals").first();
        const activeProposals = await env.DB.prepare("SELECT COUNT(*) as count FROM proposals WHERE status = 'active'").first();
        const totalVotes = await env.DB.prepare("SELECT COUNT(*) as count FROM votes").first();
        const totalVoters = await env.DB.prepare("SELECT COUNT(DISTINCT wallet_address) as count FROM votes").first();
        const totalPowerCast = await env.DB.prepare("SELECT SUM(vote_power) as total FROM votes").first();
        const activeAdmins = await env.DB.prepare("SELECT COUNT(*) as count FROM admin_config WHERE type = 'admin_wallet' AND is_active = 1").first();
        const totalWhitelisted = await env.DB.prepare("SELECT COUNT(*) as count FROM whitelist_voters").first();

        return new Response(JSON.stringify({
            total_proposals: totalProposals ? totalProposals.count : 0,
            active_proposals: activeProposals ? activeProposals.count : 0,
            total_votes: totalVotes ? totalVotes.count : 0,
            unique_voters: totalVoters ? totalVoters.count : 0,
            total_power_cast: totalPowerCast ? (totalPowerCast.total || 0) : 0,
            active_admins: activeAdmins ? activeAdmins.count : 0,
            whitelisted_voters: totalWhitelisted ? totalWhitelisted.count : 0
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
