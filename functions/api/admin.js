// functions/api/admin.js
import { initDb } from './_db.js';
import { verifyAdminAction, isValidSolanaAddress } from './_auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const { wallet, action, body } = await verifyAdminAction(request, env);

        // Helper to log admin action
        const logAudit = async (actionName, details) => {
            await env.DB.prepare(
                "INSERT INTO admin_audit_logs (admin_wallet, action, details, signature, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)"
            ).bind(wallet, actionName, JSON.stringify(details || {}), body.signature).run();
        };

        if (action === 'create_proposal') {
            const { title, description, category, startTime, endTime, discussionUrl, isPinned } = body;
            if (!title || !description) throw new Error("Title and description are required");

            const start = startTime || new Date().toISOString();
            const end = endTime || new Date(Date.now() + 7 * 86400000).toISOString();

            const res = await env.DB.prepare(`
                INSERT INTO proposals (title, description, category, status, start_time, end_time, created_by, is_pinned, discussion_url)
                VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)
            `).bind(
                title, 
                description, 
                category || 'Governance', 
                start, 
                end, 
                wallet, 
                isPinned ? 1 : 0, 
                discussionUrl || ''
            ).run();

            await logAudit('create_proposal', { title, category, start, end });
            return new Response(JSON.stringify({ success: true, message: "Proposal created successfully!" }));

        } else if (action === 'update_proposal_status') {
            const { proposalId, status } = body;
            if (!proposalId || !status) throw new Error("proposalId and status are required");
            if (!['active', 'passed', 'rejected', 'executed', 'cancelled'].includes(status)) {
                throw new Error("Invalid proposal status");
            }

            await env.DB.prepare("UPDATE proposals SET status = ? WHERE id = ?").bind(status, proposalId).run();
            await logAudit('update_proposal_status', { proposalId, status });
            return new Response(JSON.stringify({ success: true, message: `Proposal status updated to ${status}` }));

        } else if (action === 'toggle_pin_proposal') {
            const { proposalId, isPinned } = body;
            await env.DB.prepare("UPDATE proposals SET is_pinned = ? WHERE id = ?").bind(isPinned ? 1 : 0, proposalId).run();
            await logAudit('toggle_pin_proposal', { proposalId, isPinned });
            return new Response(JSON.stringify({ success: true, message: "Proposal pin status updated" }));

        } else if (action === 'delete_proposal') {
            const { proposalId } = body;
            await env.DB.prepare("DELETE FROM proposals WHERE id = ?").bind(proposalId).run();
            await env.DB.prepare("DELETE FROM votes WHERE proposal_id = ?").bind(proposalId).run();
            await logAudit('delete_proposal', { proposalId });
            return new Response(JSON.stringify({ success: true, message: "Proposal deleted" }));

        } else if (action === 'update_config') {
            const { configs } = body;
            if (!configs || typeof configs !== 'object') throw new Error("configs object required");

            for (const [type, value] of Object.entries(configs)) {
                const strValue = String(value);
                const existing = await env.DB.prepare(
                    "SELECT id FROM admin_config WHERE type = ?"
                ).bind(type).first();

                if (existing) {
                    await env.DB.prepare(
                        "UPDATE admin_config SET value = ?, is_active = 1 WHERE type = ?"
                    ).bind(strValue, type).run();
                } else {
                    await env.DB.prepare(
                        "INSERT INTO admin_config (type, value, is_active) VALUES (?, ?, 1)"
                    ).bind(type, strValue).run();
                }
            }

            await logAudit('update_config', configs);
            return new Response(JSON.stringify({ success: true, message: "DAO configuration updated successfully!" }));

        } else if (action === 'add_admin') {
            const { newAdminWallet } = body;
            if (!isValidSolanaAddress(newAdminWallet)) throw new Error("Invalid Solana wallet address for new admin");

            await env.DB.prepare(`
                INSERT INTO admin_config (type, value, is_active) VALUES ('admin_wallet', ?, 1)
                ON CONFLICT(type, value) DO UPDATE SET is_active = 1
            `).bind(newAdminWallet).run();

            await logAudit('add_admin', { newAdminWallet });
            return new Response(JSON.stringify({ success: true, message: `Added ${newAdminWallet} as Admin!` }));

        } else if (action === 'remove_admin') {
            const { targetAdminWallet } = body;
            // Prevent removing primary admin wallet
            if (targetAdminWallet === '8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV') {
                throw new Error("Cannot remove primary founder admin wallet!");
            }

            await env.DB.prepare("UPDATE admin_config SET is_active = 0 WHERE type = 'admin_wallet' AND value = ?").bind(targetAdminWallet).run();
            await logAudit('remove_admin', { targetAdminWallet });
            return new Response(JSON.stringify({ success: true, message: `Removed admin ${targetAdminWallet}` }));

        } else if (action === 'add_whitelist') {
            const { targetWallet, tier, multiplier } = body;
            if (!isValidSolanaAddress(targetWallet)) throw new Error("Invalid wallet address");

            const mult = parseFloat(multiplier || 1.0);
            await env.DB.prepare(`
                INSERT INTO whitelist_voters (wallet_address, tier, multiplier, added_by)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(wallet_address) DO UPDATE SET tier = excluded.tier, multiplier = excluded.multiplier
            `).bind(targetWallet, tier || 'VIP', mult, wallet).run();

            await logAudit('add_whitelist', { targetWallet, tier, multiplier: mult });
            return new Response(JSON.stringify({ success: true, message: `Added ${targetWallet} to whitelist tier ${tier} (${mult}x multiplier)` }));

        } else if (action === 'remove_whitelist') {
            const { targetWallet } = body;
            await env.DB.prepare("DELETE FROM whitelist_voters WHERE wallet_address = ?").bind(targetWallet).run();
            await logAudit('remove_whitelist', { targetWallet });
            return new Response(JSON.stringify({ success: true, message: `Removed ${targetWallet} from whitelist` }));

        } else if (action === 'get_audit_logs') {
            const logs = await env.DB.prepare("SELECT * FROM admin_audit_logs ORDER BY timestamp DESC LIMIT 50").all();
            return new Response(JSON.stringify(logs.results || []));

        } else if (action === 'get_whitelists') {
            const whitelists = await env.DB.prepare("SELECT * FROM whitelist_voters ORDER BY added_at DESC").all();
            return new Response(JSON.stringify(whitelists.results || []));

        } else {
            throw new Error(`Unknown admin action: ${action}`);
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
}
