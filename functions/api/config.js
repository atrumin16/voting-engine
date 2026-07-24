// functions/api/config.js
import { initDb } from './_db.js';
import { checkIsAdmin } from './_auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const url = new URL(request.url);
        const userWallet = url.searchParams.get('wallet');

        const configs = await env.DB.prepare("SELECT type, value FROM admin_config WHERE is_active = 1").all();
        const configMap = {};
        if (configs && configs.results) {
            configs.results.forEach(row => {
                configMap[row.type] = row.value;
            });
        }

        // Get count of admins
        const adminRows = await env.DB.prepare("SELECT value FROM admin_config WHERE type = 'admin_wallet' AND is_active = 1").all();
        const adminWallets = (adminRows.results || []).map(r => r.value);

        // Check if userWallet is admin
        let isAdmin = false;
        if (userWallet) {
            isAdmin = adminWallets.includes(userWallet);
        }

        return new Response(JSON.stringify({
            dao_name: configMap.dao_name || "Attestto Governance",
            dao_description: configMap.dao_description || "Decentralized Decision-Making & Reputation Governance Protocol",
            announcement_banner: configMap.announcement_banner || "",
            min_proposal_power: parseFloat(configMap.min_proposal_power || "1.0"),
            quorum_percentage: parseFloat(configMap.quorum_percentage || "10"),
            voting_duration_days: parseInt(configMap.voting_duration_days || "7"),
            voting_strategy: configMap.voting_strategy || "Reputation & Multipliers",
            maintenance_mode: configMap.maintenance_mode === "true",
            link_twitter: configMap.link_twitter || "https://x.com/attesttoID",
            link_github: configMap.link_github || "https://github.com/Attestto-com",
            link_docs: configMap.link_docs || "https://attestto.com",
            admin_wallets: adminWallets,
            is_user_admin: isAdmin
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
