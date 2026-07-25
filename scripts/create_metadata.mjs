// scripts/create_metadata.mjs
// Registers Metaplex On-Chain Metadata (Name, Symbol, Logo) for ATTEST Token on Solana Mainnet
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createMetadataAccountV3, mplTokenMetadata, findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';
import { signerIdentity, createSignerFromKeypair, publicKey } from '@metaplex-foundation/umi';
import bs58 from 'bs58';

const MINT_ADDRESS = "91Zh1Nh5Leuktcn878HACDGtTnEwXXpTdDXEMp18rMbU";
const METADATA_URI = "https://attestto-governance.pages.dev/attestto-metadata.json";
const PRIVATE_KEY_B58 = process.env.KEY || "4ouW6LKngxZXi12ixhMQ1DPFbCPmiCZsLUmPrgifDufffTZgA7UG9ynCfSrUtJBuRwmk8f4rsvrbCaCtLq5V4yKh";

async function main() {
    console.log("=================================================");
    console.log(" 🏷️  Creating Metaplex On-Chain Metadata...       ");
    console.log(` 🪙 Mint Address: ${MINT_ADDRESS}`);
    console.log(` 🌐 Metadata URI: ${METADATA_URI}`);
    console.log("=================================================\n");

    const umi = createUmi("https://api.mainnet-beta.solana.com").use(mplTokenMetadata());

    const secretKey = bs58.decode(PRIVATE_KEY_B58.trim());
    const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    const signer = createSignerFromKeypair(umi, keypair);
    umi.use(signerIdentity(signer));

    const mintPubkey = publicKey(MINT_ADDRESS);
    const metadataPda = findMetadataPda(umi, { mint: mintPubkey });

    console.log(`📍 Metadata Account PDA: ${metadataPda.toString()}`);

    const tx = createMetadataAccountV3(umi, {
        metadata: metadataPda,
        mint: mintPubkey,
        mintAuthority: signer,
        payer: signer,
        updateAuthority: signer.publicKey,
        data: {
            name: "Attestto Governance Token",
            symbol: "ATTEST",
            uri: METADATA_URI,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
        },
        isMutable: true,
        collectionDetails: null,
    });

    console.log("⏳ Sending transaction to Solana Mainnet...");
    const result = await tx.sendAndConfirm(umi);
    const signatureStr = bs58.encode(result.signature);

    console.log("\n=================================================");
    console.log("🔥 SUCCESS! Metaplex On-Chain Metadata Created!");
    console.log(`🏷️ Token Name: Attestto Governance Token`);
    console.log(`🔤 Symbol: ATTEST`);
    console.log(`🖼️ Logo & Metadata URI: ${METADATA_URI}`);
    console.log(`🧾 Transaction Signature: ${signatureStr}`);
    console.log("=================================================");
}

main().catch((err) => {
    console.error("❌ Error creating Metaplex Metadata:", err);
});
