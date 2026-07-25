// scripts/mint_existing.mjs
// Command-line script to mint 1,000,000 $ATTEST tokens directly to recipient wallet
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, mintTo } from '@solana/spl-token';
import bs58 from 'bs58';
import readline from 'readline';

const EXISTING_MINT = "91Zh1Nh5Leuktcn878HACDGtTnEwXXpTdDXEMp18rMbU";
const TARGET_WALLET = "8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV";
const TOKEN_SYMBOL = "$ATTEST";
const ATA_RENT_FEE = 0.00204; // Solana network rent exemption for ATA

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

        const solBalLamports = await connection.getBalance(payer.publicKey);
        const solBal = solBalLamports / 1e9;
        console.log(`💰 Current Wallet Balance: ${solBal.toFixed(5)} SOL`);

        const ataPubkey = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);
        const ataAccountInfo = await connection.getAccountInfo(ataPubkey);

        if (!ataAccountInfo && solBal < ATA_RENT_FEE) {
            console.error(`\n❌ Network Requirement Notice:`);
            console.error(`Creating a new Token Account on Solana requires ~${ATA_RENT_FEE} SOL for on-chain rent exemption.`);
            console.error(`Your current balance is ${solBal.toFixed(5)} SOL (short by ~${(ATA_RENT_FEE - solBal).toFixed(5)} SOL / ~0.10 USD).`);
            console.error(`Please deposit ~0.001 SOL into your wallet and run the script again.`);
            rl.close();
            return;
        }

        console.log(`\n⏳ 1. Creating Associated Token Account (${ataPubkey.toBase58()})...`);
        const transaction = new (await import('@solana/web3.js')).Transaction();

        if (!ataAccountInfo) {
            transaction.add(
                createAssociatedTokenAccountInstruction(
                    payer.publicKey,
                    ataPubkey,
                    recipientPubkey,
                    mintPubkey
                )
            );
        }

        console.log("\n⏳ 2. Minting 1,000,000 $ATTEST tokens to recipient wallet...");
        const amountToMint = BigInt(1000000) * BigInt(10 ** 9);
        transaction.add(
            mintTo(
                payer.publicKey,
                ataPubkey,
                payer.publicKey,
                amountToMint
            )
        );

        const { sendAndConfirmTransaction } = await import('@solana/web3.js');
        const txSig = await sendAndConfirmTransaction(connection, transaction, [payer]);

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
