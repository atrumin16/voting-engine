// functions/api/profile.js
import { initDb } from './_db.js';
import { verifySignature, isValidSolanaAddress } from './_auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const url = new URL(request.url);
        const wallet = url.searchParams.get('wallet');

        if (wallet) {
            const profile = await env.DB.prepare(
                "SELECT display_name FROM user_profiles WHERE wallet_address = ?"
            ).bind(wallet).first();
            return new Response(JSON.stringify({ 
                wallet_address: wallet,
                display_name: profile ? profile.display_name : null 
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Return all profiles map
        const profilesRes = await env.DB.prepare("SELECT * FROM user_profiles").all();
        const profilesMap = {};
        (profilesRes.results || []).forEach(p => {
            profilesMap[p.wallet_address] = p.display_name;
        });

        return new Response(JSON.stringify(profilesMap), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    await initDb(env);

    try {
        const body = await request.json();
        const { wallet, displayName, signature, timestamp } = body;

        if (!wallet || !displayName) {
            throw new Error("Wallet address and display name are required");
        }

        if (!isValidSolanaAddress(wallet)) {
            throw new Error("Invalid Solana wallet address format");
        }

        const trimmedName = displayName.trim().slice(0, 32);
        if (trimmedName.length < 2) {
            throw new Error("Display name must be at least 2 characters long");
        }

        // Verify wallet signature if provided
        if (signature && timestamp) {
            if (Math.abs(Date.now() - timestamp) > 300000) {
                throw new Error("Timestamp expired. Please try again.");
            }
            const message = `Attestto Set Display Name: ${trimmedName} | Ts: ${timestamp}`;
            await verifySignature(wallet, signature, message);
        }

        // Save or update profile in D1
        await env.DB.prepare(`
            INSERT INTO user_profiles (wallet_address, display_name, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(wallet_address) DO UPDATE SET 
                display_name = excluded.display_name,
                updated_at = CURRENT_TIMESTAMP
        `).bind(wallet, trimmedName).run();

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Display name updated to "${trimmedName}"!`,
            display_name: trimmedName 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
