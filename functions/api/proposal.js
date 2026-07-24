// functions/api/proposal.js
import { initDb } from './_db.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const url = new URL(request.url);
        const proposalId = url.searchParams.get('id');
        const userWallet = url.searchParams.get('wallet');

        if (!proposalId) {
            return new Response(JSON.stringify({ error: "Missing proposal ID parameter" }), { status: 400 });
        }

        const proposal = await env.DB.prepare("SELECT * FROM proposals WHERE id = ?").bind(proposalId).first();
        if (!proposal) {
            return new Response(JSON.stringify({ error: "Proposal not found" }), { status: 404 });
        }

        const votesRes = await env.DB.prepare(`
            SELECT v.wallet_address, v.choice, v.vote_power, v.reason, v.timestamp, p.display_name
            FROM votes v
            LEFT JOIN user_profiles p ON v.wallet_address = p.wallet_address
            WHERE v.proposal_id = ?
            ORDER BY v.timestamp DESC
        `).bind(proposalId).all();

        const votes = votesRes.results || [];
        let userVote = null;

        let yesPower = 0, noPower = 0, abstainPower = 0;
        votes.forEach(v => {
            const power = parseFloat(v.vote_power || 1.0);
            if (v.choice === 'yes') yesPower += power;
            else if (v.choice === 'no') noPower += power;
            else if (v.choice === 'abstain') abstainPower += power;

            if (userWallet && v.wallet_address === userWallet) {
                userVote = v;
            }
        });

        const totalPower = yesPower + noPower + abstainPower;
        const totalVotes = votes.length;

        return new Response(JSON.stringify({
            proposal,
            votes,
            user_vote: userVote,
            tallies: {
                yes_power: yesPower,
                no_power: noPower,
                abstain_power: abstainPower,
                total_power: totalPower,
                total_votes: totalVotes,
                yes_pct: totalPower > 0 ? Math.round((yesPower / totalPower) * 1000) / 10 : 0,
                no_pct: totalPower > 0 ? Math.round((noPower / totalPower) * 1000) / 10 : 0,
                abstain_pct: totalPower > 0 ? Math.round((abstainPower / totalPower) * 1000) / 10 : 0
            }
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
