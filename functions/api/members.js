// functions/api/members.js
import { initDb } from './_db.js';

export async function onRequestGet(context) {
    const { env } = context;
    await initDb(env);

    try {
        // Fetch registered active admin wallets from D1
        const adminRes = await env.DB.prepare(
            "SELECT value FROM admin_config WHERE type = 'admin_wallet' AND is_active = 1"
        ).all();
        const adminWallets = new Set((adminRes.results || []).map(a => a.value));

        // Fetch whitelisted voters from D1
        const wlRes = await env.DB.prepare("SELECT * FROM whitelist_voters").all();
        const whitelistVoters = wlRes.results || [];

        // Fetch vote counts and power cast per wallet address from D1
        const voterStatsRes = await env.DB.prepare(`
            SELECT 
                wallet_address,
                COUNT(id) as votes_count,
                SUM(vote_power) as total_power,
                MAX(timestamp) as last_voted
            FROM votes
            GROUP BY wallet_address
        `).all();
        const voterStatsMap = new Map();
        (voterStatsRes.results || []).forEach(v => voterStatsMap.set(v.wallet_address, v));

        // Fetch user profiles (display names)
        const profilesRes = await env.DB.prepare("SELECT * FROM user_profiles").all();
        const profilesMap = new Map();
        (profilesRes.results || []).forEach(p => profilesMap.set(p.wallet_address, p.display_name));

        const memberMap = new Map();

        // 1. Add all registered admin wallets from D1
        adminWallets.forEach(addr => {
            const vStats = voterStatsMap.get(addr);
            memberMap.set(addr, {
                wallet_address: addr,
                role: "Core DAO Admin",
                tier: "Council Core",
                multiplier: 1.0,
                reputation: vStats ? (vStats.votes_count * 100) + 1000 : 1000,
                votes_cast: vStats ? vStats.votes_count : 0,
                power_score: vStats ? Math.round(vStats.total_power * 10) / 10 : 0,
                joined_at: vStats && vStats.last_voted ? vStats.last_voted.split(' ')[0] : 'Admin'
            });
        });

        // 2. Add or update whitelisted voters from D1
        whitelistVoters.forEach(w => {
            const vStats = voterStatsMap.get(w.wallet_address);
            const existing = memberMap.get(w.wallet_address) || {
                wallet_address: w.wallet_address,
                role: adminWallets.has(w.wallet_address) ? "Core DAO Admin" : "Whitelisted Voter",
                tier: w.tier || "VIP",
                multiplier: parseFloat(w.multiplier || 1.0),
                reputation: vStats ? (vStats.votes_count * 100) + 500 : 500,
                votes_cast: vStats ? vStats.votes_count : 0,
                power_score: vStats ? Math.round(vStats.total_power * 10) / 10 : 0,
                joined_at: w.added_at ? w.added_at.split(' ')[0] : 'Whitelisted'
            };
            existing.tier = w.tier || existing.tier;
            existing.multiplier = parseFloat(w.multiplier || existing.multiplier);
            memberMap.set(w.wallet_address, existing);
        });

        // 3. Add any other wallets that have voted in D1
        voterStatsMap.forEach((v, addr) => {
            if (!memberMap.has(addr)) {
                memberMap.set(addr, {
                    wallet_address: addr,
                    role: "Active Voter",
                    tier: "Community Member",
                    multiplier: 1.0,
                    reputation: v.votes_count * 100,
                    votes_cast: v.votes_count,
                    power_score: Math.round(v.total_power * 10) / 10,
                    joined_at: v.last_voted ? v.last_voted.split(' ')[0] : 'Voter'
                });
            }
        });

        const membersList = Array.from(memberMap.values()).map(m => ({
            ...m,
            display_name: profilesMap.get(m.wallet_address) || null
        })).sort((a, b) => b.power_score - a.power_score || b.votes_cast - a.votes_cast);

        const summaryStats = {
            total_members: membersList.length,
            council_count: membersList.filter(m => m.tier.includes('Council') || m.role.includes('Admin')).length,
            vip_count: membersList.filter(m => m.tier.includes('VIP') || m.multiplier > 1.0).length,
            avg_multiplier: membersList.length > 0 ? (membersList.reduce((acc, m) => acc + (m.multiplier || 1.0), 0) / membersList.length).toFixed(2) : "1.00",
            total_power: membersList.reduce((acc, m) => acc + (m.power_score || 0), 0)
        };

        return new Response(JSON.stringify({
            stats: summaryStats,
            members: membersList
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
