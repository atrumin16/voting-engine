// functions/api/admin.js
import * as ed from '@noble/ed25519';
import bs58 from 'bs58';

async function verifyAdmin(request, env) {
    const body = await request.json();
    const { wallet, signature, timestamp, action } = body;
    if (Math.abs(Date.now() - timestamp) > 60000) throw new Error("Expired");

    const adminCheck = await env.DB.prepare(
        "SELECT 1 FROM admin_config WHERE type = 'admin_wallet' AND value = ? AND is_active = 1"
    ).bind(wallet).first();
    if (!adminCheck) throw new Error("Unauthorized");

    const message = `Attestto Admin Action: ${action} | Ts: ${timestamp}`;
    const isValid = await ed.verify(bs58.decode(signature), new TextEncoder().encode(message), bs58.decode(wallet));
    if (!isValid) throw new Error("Invalid signature");
    return { wallet, body };
}

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const { wallet, body } = await verifyAdmin(request, env);
        
        if (body.action === 'create_proposal') {
            await env.DB.prepare(
                "INSERT INTO proposals (title, description, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?)"
            ).bind(body.title, body.description, body.startTime, body.endTime, wallet).run();
            return new Response(JSON.stringify({ success: true }));
        } else if (body.action === 'add_admin') {
            await env.DB.prepare("INSERT OR IGNORE INTO admin_config (type, value) VALUES ('admin_wallet', ?)").bind(body.value).run();
            return new Response(JSON.stringify({ success: true }));
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 403 });
    }
}
