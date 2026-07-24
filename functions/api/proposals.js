// functions/api/proposals.js
import { initDb } from './_db.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const url = new URL(request.url);
        const statusFilter = url.searchParams.get('status');
        const categoryFilter = url.searchParams.get('category');
        const search = url.searchParams.get('search');

        // Fetch quorum config
        const quorumConfig = await env.DB.prepare(
            "SELECT value FROM admin_config WHERE type = 'quorum_percentage' AND is_active = 1"
        ).first();
        const quorumPct = parseFloat((quorumConfig && quorumConfig.value) || 10);

        let query = "SELECT * FROM proposals WHERE 1=1";
        const params = [];

        if (statusFilter && statusFilter !== 'all') {
            query += " AND status = ?";
            params.push(statusFilter);
        }

        if (categoryFilter && categoryFilter !== 'all') {
            query += " AND category = ?";
            params.push(categoryFilter);
        }

        if (search) {
            query += " AND (title LIKE ? OR description LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        query += " ORDER BY is_pinned DESC, created_at DESC";

        const stmt = env.DB.prepare(query);
        const proposalsRes = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
        const proposals = proposalsRes.results || [];

        const now = new Date();

        const results = await Promise.all(proposals.map(async (proposal) => {
            const votesRes = await env.DB.prepare(
                "SELECT choice, vote_power FROM votes WHERE proposal_id = ?"
            ).bind(proposal.id).all();

            const votes = votesRes.results || [];
            let yesPower = 0;
            let noPower = 0;
            let abstainPower = 0;

            votes.forEach(v => {
                const power = parseFloat(v.vote_power || 1.0);
                if (v.choice === 'yes') yesPower += power;
                else if (v.choice === 'no') noPower += power;
                else if (v.choice === 'abstain') abstainPower += power;
            });

            const totalPower = yesPower + noPower + abstainPower;
            const totalVotes = votes.length;

            const yesPct = totalPower > 0 ? (yesPower / totalPower) * 100 : 0;
            const noPct = totalPower > 0 ? (noPower / totalPower) * 100 : 0;
            const abstainPct = totalPower > 0 ? (abstainPower / totalPower) * 100 : 0;

            const endTime = new Date(proposal.end_time);
            const isExpired = now > endTime;

            let currentStatus = proposal.status;
            if (currentStatus === 'active' && isExpired) {
                // Auto-evaluate finished proposals
                if (yesPower > noPower && totalPower > 0) {
                    currentStatus = 'passed';
                } else {
                    currentStatus = 'rejected';
                }
            }

            return {
                ...proposal,
                status: currentStatus,
                is_expired: isExpired,
                yes_power: yesPower,
                no_power: noPower,
                abstain_power: abstainPower,
                total_power: totalPower,
                total_votes: totalVotes,
                yes_pct: Math.round(yesPct * 10) / 10,
                no_pct: Math.round(noPct * 10) / 10,
                abstain_pct: Math.round(abstainPct * 10) / 10,
                quorum_required_power: quorumPct,
                quorum_met: totalPower >= quorumPct
            };
        }));

        return new Response(JSON.stringify(results), {
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
