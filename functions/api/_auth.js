// functions/api/_auth.js
import * as ed from '@noble/ed25519';
import bs58 from 'bs58';

export function isValidSolanaAddress(address) {
    if (!address || typeof address !== 'string') return false;
    try { 
        return bs58.decode(address).length === 32; 
    } catch (e) { 
        return false; 
    }
}

export async function verifySignature(wallet, signature, message) {
    if (!isValidSolanaAddress(wallet)) {
        throw new Error("Invalid Solana wallet address format");
    }
    
    let sigBytes;
    try {
        sigBytes = bs58.decode(signature);
    } catch (e) {
        throw new Error("Signature must be a valid Base58 string");
    }

    if (sigBytes.length !== 64) {
        throw new Error("Invalid signature length");
    }

    const msgBytes = new TextEncoder().encode(message);
    const pubKeyBytes = bs58.decode(wallet);

    const isValid = await ed.verifyAsync(sigBytes, msgBytes, pubKeyBytes);
    if (!isValid) {
        throw new Error("Cryptographic signature verification failed");
    }
    return true;
}

export async function checkIsAdmin(wallet, env) {
    if (!isValidSolanaAddress(wallet)) return false;
    const adminCheck = await env.DB.prepare(
        "SELECT 1 FROM admin_config WHERE type = 'admin_wallet' AND value = ? AND is_active = 1"
    ).bind(wallet).first();
    return !!adminCheck;
}

export async function verifyAdminAction(request, env) {
    const body = await request.json();
    const { wallet, signature, timestamp, action } = body;

    if (!wallet || !signature || !timestamp || !action) {
        throw new Error("Missing required parameters: wallet, signature, timestamp, action");
    }

    // Prevent replay attacks beyond 2 minutes
    if (Math.abs(Date.now() - timestamp) > 120000) {
        throw new Error("Request timestamp expired or out of sync");
    }

    const isAdmin = await checkIsAdmin(wallet, env);
    if (!isAdmin) {
        throw new Error("Unauthorized: Wallet address is not an authorized DAO Admin");
    }

    const message = `Attestto Admin Action: ${action} | Ts: ${timestamp}`;
    await verifySignature(wallet, signature, message);

    return { wallet, action, body };
}
