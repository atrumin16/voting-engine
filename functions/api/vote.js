// functions/api/vote.js
import * as ed from '@noble/ed25519';
import bs58 from 'bs58';

function isValidSolanaAddress(address) {
    try { return bs58.decode(address).length === 32; } catch (e) { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { proposalId, wallet, signature, choice, timestamp } = body;

    if (!isValidSolanaAddress(wallet)) throw new Error("Invalid wallet format");
    if (Math.abs(Date.now() - timestamp) > 60000) throw new Error("Timestamp expired");

    const message = `Attestto Official Vote | Proposal: ${proposalId} | Choice: ${choice} | Ts: ${timestamp}`;
    const isValid = await ed.verify(
        bs58.decode(signature), 
        new TextEncoder().encode(message), 
        bs58.decode(wallet)
    );

    if (!isValid) throw new Error("Cryptographic verification failed");

    await env.DB.prepare(
      "INSERT INTO votes (proposal_id, wallet_address, signature, vote_power, choice) VALUES (?, ?, ?, ?, ?)"
    ).bind(proposalId, wallet, signature, 1.0, choice).run();

    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
}
