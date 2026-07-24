// scripts/create_token.mjs
// Command-line script to create $ATTEST SPL Token directly on Solana Mainnet
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import bs58 from 'bs58';
import readline from 'readline';

const TARGET_WALLET = "8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV";
const LOGO_URL = "https://avatars.githubusercontent.com/u/108633374?s=200&v=4";
const TOKEN_NAME = "Attestto Governance Token";
const TOKEN_SYMBOL = "$ATTEST";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log("=================================================");
    console.log(" 🪙  Attestto DAO $ATTEST Token Creator (CLI)   ");
    console.log(` 👤 Recipient Wallet: ${TARGET_WALLET}`);
    console.log(` 🖼️ Logo Asset: ${LOGO_URL}`);
    console.log("=================================================\n");

    const secretKeyInput = await askQuestion("🔑 Paste your Phantom Wallet Private Key (Base58 string or array): ");
    
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
        console.log(`\n✅ Connected Wallet: ${payer.publicKey.toBase58()}`);

        const connection = new Connection("https://rpc.ankr.com/solana", "confirmed");

        const balance = await connection.getBalance(payer.publicKey);
        console.log(`💰 Wallet Balance: ${(balance / 1e9).toFixed(4)} SOL`);

        if (balance < 0.003 * 1e9) {
            console.error("❌ Insufficient SOL balance. You need at least 0.003 SOL to pay for mint account rent.");
            rl.close();
            return;
        }

        console.log("\n⏳ 1. Creating $ATTEST SPL Token Mint Account (9 decimals)...");
        const mint = await createMint(
            connection,
            payer,
            payer.publicKey, // mintAuthority
            null,            // freezeAuthority (null = decentralized)
            9                // decimals
        );

        console.log(`🎉 Token Mint Created! Mint Address: ${mint.toBase58()}`);

        const recipientPubkey = new PublicKey(TARGET_WALLET);

        console.log(`\n⏳ 2. Creating Associated Token Account for ${TARGET_WALLET}...`);
        const tokenAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mint,
            recipientPubkey
        );

        console.log(`✅ Token Account Address: ${tokenAccount.address.toBase58()}`);

        console.log("\n⏳ 3. Minting 1,000,000 $ATTEST tokens to recipient wallet...");
        const amountToMint = 1000000 * (10 ** 9);
        const txSig = await mintTo(
            connection,
            payer,
            mint,
            tokenAccount.address,
            payer.publicKey,
            BigInt(amountToMint)
        );

        console.log("\n=================================================");
        console.log("🔥 SUCCESS! $ATTEST Token is live on Solana!");
        console.log(`🪙 Mint Address: ${mint.toBase58()}`);
        console.log(`🏷️ Token Name: ${TOKEN_NAME} (${TOKEN_SYMBOL})`);
        console.log(`🖼️ Logo URL: ${LOGO_URL}`);
        console.log(`👤 Beneficiary Address: ${TARGET_WALLET}`);
        console.log(`📦 Minted Supply: 1,000,000 $ATTEST`);
        console.log(`🧾 Transaction Signature: ${txSig}`);
        console.log("=================================================");

    } catch (err) {
        console.error("❌ Error creating token:", err.message);
    } finally {
        rl.close();
    }
}

main();
