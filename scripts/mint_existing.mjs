// scripts/mint_existing.mjs
// Command-line script to mint 1,000,000 $ATTEST tokens directly to recipient wallet
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import bs58 from 'bs58';
import readline from 'readline';

const EXISTING_MINT = "91Zh1Nh5Leuktcn878HACDGtTnEwXXpTdDXEMp18rMbU";
const TARGET_WALLET = "8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV";
const TOKEN_SYMBOL = "$ATTEST";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log("=================================================");
    console.log(" 🪙  Restore 1,000,000 $ATTEST Tokens (CLI)     ");
    console.log(` 🏷️ Token Mint: ${EXISTING_MINT}`);
    console.log(` 👤 Beneficiary Wallet: ${TARGET_WALLET}`);
    console.log("=================================================\n");

    const secretKeyInput = await askQuestion("🔑 Paste your Phantom Wallet Private Key (Base58 string): ");
    
    if (!secretKeyInput.trim()) {
        console.error("❌ Private key is required to sign the transaction.");
        rl.close();
        return;
    }

    try {
        let secretKey;
        if (secretKeyInput.trim().startsWith('[')) {
            secretKey = Uint8Array.from(JSON.parse(secretKeyInput.trim()));
        } else {
            secretKey = bs58.decode(secretKeyInput.trim());
        }

        const payer = Keypair.fromSecretKey(secretKey);
        console.log(`\n✅ Connected Mint Authority Wallet: ${payer.publicKey.toBase58()}`);

        const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
        const mintPubkey = new PublicKey(EXISTING_MINT);
        const recipientPubkey = new PublicKey(TARGET_WALLET);

        console.log(`\n⏳ 1. Creating/Verifying Associated Token Account for ${TARGET_WALLET}...`);
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mintPubkey,
            recipientPubkey
        );

        console.log(`✅ Token Account Address: ${tokenAccount.address.toBase58()}`);

        console.log("\n⏳ 2. Minting 1,000,000 $ATTEST tokens to recipient wallet...");
        const amountToMint = BigInt(1000000) * BigInt(10 ** 9);
        const txSig = await mintTo(
            connection,
            payer,
            mintPubkey,
            tokenAccount.address,
            payer.publicKey,
            amountToMint
        );

        console.log("\n=================================================");
        console.log("🔥 SUCCESS! 1,000,000 $ATTEST Tokens Restored!");
        console.log(`🪙 Mint Address: ${EXISTING_MINT}`);
        console.log(`👤 Recipient Wallet: ${TARGET_WALLET}`);
        console.log(`📦 Token Balance: 1,000,000 ${TOKEN_SYMBOL}`);
        console.log(`🧾 Transaction Signature: ${txSig}`);
        console.log("=================================================");

    } catch (err) {
        console.error("❌ Error restoring tokens:", err.message || err);
    } finally {
        rl.close();
    }
}

main();
