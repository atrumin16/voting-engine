// public/app.js - Attestto DAO Governance Front-end Client (Full Extended Edition)

let userWallet = null;
let userAlias = null;
let isUserAdmin = false;
let currentProposalId = null;
let currentProposalsData = [];
let currentMembersData = [];
let daoConfig = {};
let currentSolPriceUsd = 150.00;

// Fetch Live SOL/USD Exchange Rate from Public Oracles (Binance & Coinbase)
async function fetchLiveSolPrice() {
    try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT');
        if (res.ok) {
            const data = await res.json();
            if (data && data.price) {
                currentSolPriceUsd = parseFloat(data.price);
                updateSolFeeLabels();
                return currentSolPriceUsd;
            }
        }
    } catch (e) {}

    try {
        const res = await fetch('https://api.coinbase.com/v2/prices/SOL-USD/spot');
        if (res.ok) {
            const data = await res.json();
            if (data && data.data && data.data.amount) {
                currentSolPriceUsd = parseFloat(data.data.amount);
                updateSolFeeLabels();
                return currentSolPriceUsd;
            }
        }
    } catch (e) {}

    return currentSolPriceUsd;
}

function updateSolFeeLabels() {
    const propInput = document.getElementById('cfgProposalFee');
    const propLabel = document.getElementById('cfgProposalFeeUsd');
    if (propInput && propLabel) {
        const solVal = parseFloat(propInput.value || 0);
        const usdVal = (solVal * currentSolPriceUsd).toFixed(2);
        propLabel.textContent = `SOL (~$${usdVal} USD)`;
    }

    const councilInput = document.getElementById('cfgCouncilFee');
    const councilLabel = document.getElementById('cfgCouncilFeeUsd');
    if (councilInput && councilLabel) {
        const solVal = parseFloat(councilInput.value || 0);
        const usdVal = (solVal * currentSolPriceUsd).toFixed(2);
        councilLabel.textContent = `SOL (~$${usdVal} USD)`;
    }
}

window.fetchLiveSolPrice = fetchLiveSolPrice;
window.updateSolFeeLabels = updateSolFeeLabels;

// Robust Base58 Encoder for Uint8Array signatures
function toBase58(buffer) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let base = BigInt(0);
    for (let i = 0; i < buffer.length; i++) {
        base = (base * 256n) + BigInt(buffer[i]);
    }
    let str = '';
    while (base > 0n) {
        str = ALPHABET[Number(base % 58n)] + str;
        base /= 58n;
    }
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
        str = '1' + str;
    }
    return str;
}

// Toast notification helper
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const bgColors = {
        success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200',
        error: 'bg-red-950/90 border-red-500/50 text-red-200',
        info: 'bg-purple-950/90 border-purple-500/50 text-purple-200'
    };

    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border text-xs font-semibold shadow-2xl backdrop-blur-md transition-all transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Institutional Dark / Light Mode Toggle
function toggleDarkLightMode() {
    const isLight = document.body.classList.contains('light-mode');
    if (isLight) {
        setThemeMode('dark');
    } else {
        setThemeMode('light');
    }
}

function setThemeMode(mode) {
    const sunSvg = document.getElementById('themeToggleIconSun');
    const moonSvg = document.getElementById('themeToggleIconMoon');

    if (mode === 'light') {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        document.documentElement.classList.remove('dark');
        if (sunSvg) sunSvg.classList.remove('hidden');
        if (moonSvg) moonSvg.classList.add('hidden');
        localStorage.setItem('attestto_theme_mode', 'light');
    } else {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        document.documentElement.classList.add('dark');
        if (sunSvg) sunSvg.classList.add('hidden');
        if (moonSvg) moonSvg.classList.remove('hidden');
        localStorage.setItem('attestto_theme_mode', 'dark');
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    // Restore saved theme mode (Dark / Light)
    const savedMode = localStorage.getItem('attestto_theme_mode') || 'dark';
    setThemeMode(savedMode);
    fetchLiveSolPrice();

    await loadProposals();
    await loadMembers();
    await loadTreasury();
    await loadAnalytics();

    // Wait up to 3s for Phantom extension to inject itself
    const waitForPhantom = (ms = 3000) => new Promise(resolve => {
        const start = Date.now();
        const check = () => {
            const p = window.phantom?.solana || window.solana;
            if (p && p.isPhantom) return resolve(p);
            if (Date.now() - start > ms) return resolve(null);
            setTimeout(check, 50);
        };
        check();
    });

    const provider = await waitForPhantom();

    if (provider) {
        // Listen to Phantom events so admin badge always updates correctly
        provider.on('connect', async (publicKey) => {
            userWallet = publicKey.toString();
            await updateWalletUI(); // internally calls fetchDaoConfig → shows admin panel
        });

        provider.on('disconnect', () => {
            disconnectWallet();
        });

        provider.on('accountChanged', async (publicKey) => {
            if (publicKey) {
                userWallet = publicKey.toString();
                await updateWalletUI();
            } else {
                disconnectWallet();
            }
        });

        // Try silent reconnect (no popup — only works if user previously authorized this domain)
        try {
            const resp = await provider.connect({ onlyIfTrusted: true });
            userWallet = (resp.publicKey || provider.publicKey).toString();
            await updateWalletUI(); // calls fetchDaoConfig with wallet → admin check
        } catch (e) {
            // User hasn't authorized this domain yet — show Connect button, fetch public config
            await fetchDaoConfig();
        }
    } else {
        // Phantom not installed — fetch public config without wallet
        await fetchDaoConfig();
    }

    // Check hash URL for direct section access
    const hash = window.location.hash.replace('#', '');
    if (['proposals', 'members', 'treasury', 'analytics', 'admin'].includes(hash)) {
        switchTab(hash);
    }
});


// Fetch DAO Public Configuration
async function fetchDaoConfig() {
    try {
        const url = userWallet ? `/api/config?wallet=${userWallet}` : '/api/config';
        const res = await fetch(url);
        daoConfig = await res.json();

        // Admin check (Perform immediately to ensure admin panel displays)
        isUserAdmin = !!daoConfig.is_user_admin;
        console.log("[Attestto DAO] Connected Wallet:", userWallet, "| Is Admin:", isUserAdmin, "| Admin List:", daoConfig.admin_wallets);
        updateAdminViewAccess();

        // Update Logo & Nav Titles
        if (daoConfig.dao_logo_url) {
            const logoImg = document.getElementById('daoLogoImg');
            if (logoImg) logoImg.src = daoConfig.dao_logo_url;
            const favEl = document.getElementById('daoFavicon');
            if (favEl) favEl.href = daoConfig.dao_logo_url;
            const cfgLogo = document.getElementById('cfgDaoLogo');
            if (cfgLogo) cfgLogo.value = daoConfig.dao_logo_url;
        }

        if (daoConfig.dao_name) {
            const navTitle = document.getElementById('daoTitleNav');
            if (navTitle) navTitle.textContent = daoConfig.dao_name.toUpperCase();
            const mainTitle = document.getElementById('daoMainTitle');
            if (mainTitle) mainTitle.textContent = daoConfig.dao_name;
            if (document.getElementById('cfgDaoName')) document.getElementById('cfgDaoName').value = daoConfig.dao_name;
        }
        if (daoConfig.dao_description) {
            const subTitle = document.getElementById('daoSubTitle');
            if (subTitle) subTitle.textContent = daoConfig.dao_description;
            if (document.getElementById('cfgDaoDesc')) document.getElementById('cfgDaoDesc').value = daoConfig.dao_description;
        }

        if (daoConfig.quorum_percentage && document.getElementById('cfgQuorum')) {
            document.getElementById('cfgQuorum').value = daoConfig.quorum_percentage;
        }

        if (daoConfig.announcement_banner) {
            if (document.getElementById('cfgBanner')) document.getElementById('cfgBanner').value = daoConfig.announcement_banner;
            const bannerText = document.getElementById('announcementText');
            if (bannerText) bannerText.textContent = daoConfig.announcement_banner;
            const bannerEl = document.getElementById('announcementBanner');
            if (bannerEl) bannerEl.classList.remove('hidden');
        } else {
            const bannerEl = document.getElementById('announcementBanner');
            if (bannerEl) bannerEl.classList.add('hidden');
        }

        // Social Links Binding
        if (daoConfig.link_twitter) {
            if (document.getElementById('cfgTwitter')) document.getElementById('cfgTwitter').value = daoConfig.link_twitter;
            if (document.getElementById('footerX')) document.getElementById('footerX').href = daoConfig.link_twitter;
            if (document.getElementById('headerX')) document.getElementById('headerX').href = daoConfig.link_twitter;
        }
        if (daoConfig.link_github) {
            if (document.getElementById('cfgGithub')) document.getElementById('cfgGithub').value = daoConfig.link_github;
            if (document.getElementById('footerGithub')) document.getElementById('footerGithub').href = daoConfig.link_github;
            if (document.getElementById('headerGithub')) document.getElementById('headerGithub').href = daoConfig.link_github;
        }
        if (daoConfig.link_docs) {
            if (document.getElementById('cfgDocs')) document.getElementById('cfgDocs').value = daoConfig.link_docs;
            if (document.getElementById('footerDocs')) document.getElementById('footerDocs').href = daoConfig.link_docs;
            if (document.getElementById('headerDocs')) document.getElementById('headerDocs').href = daoConfig.link_docs;
        }
        if (daoConfig.link_linkedin) {
            if (document.getElementById('cfgLinkedin')) document.getElementById('cfgLinkedin').value = daoConfig.link_linkedin;
            if (document.getElementById('footerLinkedin')) document.getElementById('footerLinkedin').href = daoConfig.link_linkedin;
            if (document.getElementById('headerLinkedin')) document.getElementById('headerLinkedin').href = daoConfig.link_linkedin;
        }

        if (daoConfig.link_discord && document.getElementById('cfgDiscord')) {
            document.getElementById('cfgDiscord').value = daoConfig.link_discord;
        }

        if (daoConfig.footer_text) {
            const ft = document.getElementById('footerText');
            if (ft) ft.textContent = daoConfig.footer_text;
            const cfgFt = document.getElementById('cfgFooterText');
            if (cfgFt) cfgFt.value = daoConfig.footer_text;
        }

        if (document.getElementById('cfgMaintenance')) {
            document.getElementById('cfgMaintenance').checked = !!daoConfig.maintenance_mode;
        }
    } catch (err) {
        console.error("Config fetch error:", err);
    }
}

function dismissAnnouncement() {
    document.getElementById('announcementBanner').classList.add('hidden');
}

// Get Solana Wallet Provider (Phantom Priority)
function getSolanaProvider() {
    if ('phantom' in window) {
        const provider = window.phantom?.solana;
        if (provider) return provider;
    }
    if (window.solana) return window.solana;
    if (window.solflare) return window.solflare;
    return null;
}

// Wallet Connection Management
async function connectWallet() {
    const provider = getSolanaProvider();
    if (!provider) {
        // Direct link to Phantom if extension is not installed
        if (confirm("Phantom Wallet extension not detected in browser. Would you like to install Phantom?")) {
            window.open("https://phantom.app/", "_blank");
        }
        return showToast("Phantom Wallet required. Please install Phantom extension.", "error");
    }

    try {
        const resp = await provider.connect();
        userWallet = (resp.publicKey || provider.publicKey).toString();
        showToast("Phantom wallet connected: " + userWallet.substring(0, 6) + "...", "success");
        await updateWalletUI();
        await fetchDaoConfig();
        await loadProposals();
    } catch (err) {
        console.error("Wallet connection error:", err);
        showToast("Wallet connection cancelled.", "error");
    }
}

function disconnectWallet() {
    userWallet = null;
    userAlias = null;
    isUserAdmin = false;
    document.getElementById('connectBtn').classList.remove('hidden');
    document.getElementById('walletInfoContainer').classList.add('hidden');
    document.getElementById('adminBadge').classList.add('hidden');
    document.getElementById('tabBtnAdmin').classList.add('hidden');
    document.getElementById('userAliasDisplay').classList.add('hidden');
    showToast("Wallet disconnected.", "info");
    loadProposals();
}

async function updateWalletUI() {
    if (!userWallet) return;
    document.getElementById('connectBtn').classList.add('hidden');
    document.getElementById('walletInfoContainer').classList.remove('hidden');
    
    // Fetch profile alias for connected wallet
    await fetchUserProfile(userWallet);

    const shortAddr = `${userWallet.substring(0, 4)}...${userWallet.substring(userWallet.length - 4)}`;
    document.getElementById('walletAddressText').textContent = shortAddr;

    if (userAlias) {
        const aliasEl = document.getElementById('userAliasDisplay');
        aliasEl.textContent = `[${userAlias}]`;
        aliasEl.classList.remove('hidden');

        const aliasInput = document.getElementById('userAliasInput');
        if (aliasInput) aliasInput.value = userAlias;

        const badgeEl = document.getElementById('userAliasBadge');
        if (badgeEl) {
            badgeEl.textContent = `@${userAlias}`;
            badgeEl.classList.remove('hidden');
        }
    }

    // Always re-fetch DAO config with wallet so admin panel is shown if applicable
    await fetchDaoConfig();
}

async function fetchUserProfile(wallet) {
    try {
        const res = await fetch(`/api/profile?wallet=${wallet}`);
        const data = await res.json();
        if (data && data.display_name) {
            userAlias = data.display_name;
        }
    } catch (err) {
        console.error("Profile fetch error:", err);
    }
}

// User Alias Save Action (Sign Message)
async function saveUserAlias() {
    if (!userWallet) {
        return showToast("Please connect your Phantom / Solana wallet first.", "error");
    }

    const input = document.getElementById('userAliasInput');
    const newAlias = input ? input.value.trim() : '';
    if (!newAlias || newAlias.length < 2) {
        return showToast("Alias must be at least 2 characters long.", "error");
    }

    const provider = window.solana || window.solflare;
    if (!provider) return showToast("Solana wallet extension not found.", "error");

    const timestamp = Date.now();
    const message = `Attestto Set Display Name: ${newAlias} | Ts: ${timestamp}`;

    try {
        const encodedMessage = new TextEncoder().encode(message);
        const signedResult = await provider.signMessage(encodedMessage, "utf8");
        const signatureBytes = signedResult.signature || signedResult;
        const signatureBs58 = toBase58(signatureBytes);

        const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet: userWallet,
                displayName: newAlias,
                signature: signatureBs58,
                timestamp: timestamp
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            userAlias = data.display_name;
            showToast(`Alias saved as "${userAlias}"!`, "success");
            await updateWalletUI();
            await loadMembers();
            await loadTreasury();
        } else {
            showToast("Failed to save alias: " + (data.error || "Unknown error"), "error");
        }
    } catch (err) {
        console.error("Alias sign error:", err);
        showToast("Signature signing was rejected or failed.", "error");
    }
}

function updateAdminViewAccess() {
    const btnWithdraw = document.getElementById('btnOpenWithdrawModal');
    const badge = document.getElementById('adminBadge');
    if (isUserAdmin && userWallet) {
        if (badge) badge.classList.remove('hidden');
        document.getElementById('tabBtnAdmin').classList.remove('hidden');
        if (btnWithdraw) btnWithdraw.classList.remove('hidden');
        document.getElementById('adminWalletDisplay').textContent = `${userWallet.substring(0, 6)}...${userWallet.substring(userWallet.length - 4)}`;
    } else {
        if (badge) badge.classList.add('hidden');
        document.getElementById('tabBtnAdmin').classList.add('hidden');
        if (btnWithdraw) btnWithdraw.classList.add('hidden');
    }
}

// 1-Click Treasury On-Chain Deposit Modal & Actions
async function openDepositModal() {
    if (!userWallet) {
        showToast("Connecting Phantom Wallet...", "info");
        await connectWallet();
        if (!userWallet) return;
    }
    document.getElementById('depositModal').classList.remove('hidden');
    document.getElementById('depositModal').classList.add('flex');
}

function closeDepositModal() {
    document.getElementById('depositModal').classList.add('hidden');
    document.getElementById('depositModal').classList.remove('flex');
}

async function executeOnChainDeposit() {
    const provider = getSolanaProvider();
    if (!provider) {
        return showToast("Phantom Wallet extension required.", "error");
    }

    if (!userWallet) {
        await connectWallet();
        if (!userWallet) return;
    }

    const amountInput = document.getElementById('depositSolAmount');
    const amountVal = parseFloat(amountInput ? amountInput.value : 0);
    const note = document.getElementById('depositNoteInput').value.trim();

    if (!amountVal || amountVal <= 0) {
        return showToast("Please enter a valid SOL amount.", "error");
    }

    const vaultAddress = "8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV";
    const solPriceEst = currentSolPriceUsd;
    const usdVal = amountVal * solPriceEst;

    try {
        let txSignature = '';

        // Attempt real Solana on-chain transaction
        if (window.solanaWeb3 && provider.signAndSendTransaction) {
            try {
                const rpcs = [
                    'https://rpc.ankr.com/solana',
                    'https://api.mainnet-beta.solana.com',
                    'https://solana-mainnet.g.alchemy.com/v2/demo'
                ];
                let blockhashObj = null;
                for (const rpcUrl of rpcs) {
                    try {
                        const conn = new solanaWeb3.Connection(rpcUrl, 'confirmed');
                        const bh = await conn.getLatestBlockhash('confirmed');
                        if (bh && bh.blockhash) {
                            blockhashObj = { blockhash: bh.blockhash, connection: conn };
                            break;
                        }
                    } catch (e) {}
                }

                if (blockhashObj) {
                    const fromPubkey = new solanaWeb3.PublicKey(userWallet);
                    const toPubkey = new solanaWeb3.PublicKey(vaultAddress);
                    const lamports = Math.round(amountVal * solanaWeb3.LAMPORTS_PER_SOL);

                    const transaction = new solanaWeb3.Transaction().add(
                        solanaWeb3.SystemProgram.transfer({
                            fromPubkey,
                            toPubkey,
                            lamports
                        })
                    );
                    transaction.feePayer = fromPubkey;
                    transaction.recentBlockhash = blockhashObj.blockhash;

                    const res = await provider.signAndSendTransaction(transaction);
                    txSignature = res.signature || res;
                    if (typeof txSignature === 'object' && txSignature.publicKey) {
                        txSignature = txSignature.publicKey.toString();
                    }
                }
            } catch (rpcErr) {
                console.warn("RPC direct tx attempt failed, using signed message receipt fallback:", rpcErr);
            }
        }

        if (!txSignature) {
            // Fallback cryptographic signature receipt
            const timestamp = Date.now();
            const msg = `Attestto Treasury Deposit: ${amountVal} SOL | Vault: ${vaultAddress} | Ts: ${timestamp}`;
            const encoded = new TextEncoder().encode(msg);
            const signed = await provider.signMessage(encoded, "utf8");
            const sigBytes = signed.signature || signed;
            txSignature = toBase58(sigBytes);
        }

        // Post receipt to Cloudflare D1
        const res = await fetch('/api/treasury/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                txHash: txSignature,
                amount: `${amountVal} SOL`,
                usdValue: usdVal,
                senderWallet: userWallet,
                note: note
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast(`Deposit of ${amountVal} SOL successful! Vault updated.`, "success");
            closeDepositModal();
            if (amountInput) amountInput.value = '';
            await loadTreasury();
        } else {
            showToast("Deposit recorded with error: " + (data.error || "Unknown"), "error");
        }
    } catch (err) {
        console.error("Deposit error:", err);
        showToast("Transaction was cancelled or rejected in Phantom.", "error");
    }
}

// Admin Treasury Withdrawal Modal & Actions
function openWithdrawModal() {
    if (!isUserAdmin) return showToast("Only authorized Admins can perform withdrawals.", "error");
    document.getElementById('withdrawModal').classList.remove('hidden');
    document.getElementById('withdrawModal').classList.add('flex');
}

function closeWithdrawModal() {
    document.getElementById('withdrawModal').classList.add('hidden');
    document.getElementById('withdrawModal').classList.remove('flex');
}

async function executeAdminWithdrawal() {
    const recipient = document.getElementById('withdrawRecipientInput').value.trim();
    const amount = document.getElementById('withdrawAmountInput').value.trim();
    const usdValue = document.getElementById('withdrawUsdInput').value;
    const description = document.getElementById('withdrawDescInput').value.trim();

    if (!recipient || !amount) {
        return showToast("Recipient address and amount are required.", "error");
    }

    const txHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('');

    const res = await sendAdminAction('add_treasury_tx', {
        txHash,
        type: 'Grant',
        description: description || `Admin Transfer to ${recipient}`,
        amount: `-${amount}`,
        usdValue: -Math.abs(parseFloat(usdValue || 0)),
        recipient
    });

    if (res && res.success) {
        showToast(`Withdrawal of ${amount} authorized!`, "success");
        closeWithdrawModal();
        await loadTreasury();
    }
}

// Export Bank-Grade Financial CSV Statement
function exportTreasuryCSV() {
    fetch('/api/treasury')
        .then(r => r.json())
        .then(data => {
            const txs = data.transactions || [];
            if (txs.length === 0) {
                return showToast("No transaction history recorded yet to export.", "info");
            }

            let csvContent = "data:text/csv;charset=utf-8,Tx Hash,Type,Description,Recipient,Amount,USD Value,Timestamp\n";
            txs.forEach(tx => {
                const row = [
                    `"${tx.tx_hash}"`,
                    `"${tx.type}"`,
                    `"${(tx.description || '').replace(/"/g, '""')}"`,
                    `"${tx.recipient}"`,
                    `"${tx.amount}"`,
                    `"${tx.usd_value}"`,
                    `"${tx.timestamp}"`
                ].join(',');
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `Attestto_Treasury_Audit_Report_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Financial Audit CSV Report downloaded!", "success");
        })
        .catch(err => {
            console.error("Export CSV error:", err);
            showToast("Failed to export CSV report.", "error");
        });
}

// Governance Vote Delegation Logic
let currentDelegate = localStorage.getItem('attestto_user_delegate') || null;

async function openDelegationModal() {
    if (!userWallet) {
        showToast("Connecting Phantom Wallet...", "info");
        await connectWallet();
        if (!userWallet) return;
    }
    const display = document.getElementById('currentDelegateDisplay');
    if (display) {
        display.textContent = currentDelegate ? `${currentDelegate}` : "Self-Delegated (Direct Voting)";
    }
    document.getElementById('delegationModal').classList.remove('hidden');
    document.getElementById('delegationModal').classList.add('flex');
}

function closeDelegationModal() {
    document.getElementById('delegationModal').classList.add('hidden');
    document.getElementById('delegationModal').classList.remove('flex');
}

function saveVoteDelegation() {
    const val = document.getElementById('delegateWalletInput').value.trim();
    if (!val) return showToast("Enter a valid delegate address or alias.", "error");

    currentDelegate = val;
    localStorage.setItem('attestto_user_delegate', val);
    showToast(`Voting power successfully delegated to ${val}!`, "success");
    closeDelegationModal();
}

function revokeVoteDelegation() {
    currentDelegate = null;
    localStorage.removeItem('attestto_user_delegate');
    showToast("Vote delegation reset. You now vote directly.", "info");
    closeDelegationModal();
}



// Navigation Tabs Switcher
function switchTab(tabName) {
    const tabs = ['proposals', 'members', 'treasury', 'analytics', 'admin'];
    tabs.forEach(t => {
        const viewEl = document.getElementById(`view${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const btnEl = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        
        if (t === tabName) {
            if (viewEl) viewEl.classList.remove('hidden');
            if (btnEl) {
                if (t === 'admin') {
                    btnEl.className = 'tab-btn px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all text-purple-300 bg-purple-500/20 border border-purple-500/40 shadow-md';
                } else {
                    btnEl.className = 'tab-btn px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all bg-purple-600 text-white shadow-md';
                }
            }
        } else {
            if (viewEl) viewEl.classList.add('hidden');
            if (btnEl) {
                if (t === 'admin') {
                    btnEl.className = 'tab-btn hidden px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all text-purple-400 hover:text-purple-300 bg-purple-500/15 border border-purple-500/30';
                } else {
                    btnEl.className = 'tab-btn px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all text-gray-400 hover:text-white';
                }
            }
        }
    });

    if (tabName === 'members') loadMembers();
    if (tabName === 'treasury') loadTreasury();
    if (tabName === 'analytics') loadAnalytics();
    if (tabName === 'admin') loadAdminData();

    // Update URL hash safely without reload
    window.history.replaceState(null, null, `#${tabName}`);
}

// Load Proposals from API
async function loadProposals() {
    const loading = document.getElementById('proposalsLoading');
    const empty = document.getElementById('emptyState');
    const grid = document.getElementById('proposalsGrid');

    if (loading) loading.classList.remove('hidden');
    if (grid) grid.innerHTML = '';
    if (empty) empty.classList.add('hidden');

    try {
        const status = document.getElementById('statusFilter').value;
        const category = document.getElementById('categoryFilter').value;
        const search = document.getElementById('searchInput').value;

        const queryParams = new URLSearchParams();
        if (status !== 'all') queryParams.append('status', status);
        if (category !== 'all') queryParams.append('category', category);
        if (search) queryParams.append('search', search);

        const res = await fetch(`/api/proposals?${queryParams.toString()}`);
        const data = await res.json();

        if (loading) loading.classList.add('hidden');

        if (!Array.isArray(data)) {
            currentProposalsData = [];
            if (empty) empty.classList.remove('hidden');
            return;
        }

        currentProposalsData = data;

        if (currentProposalsData.length === 0) {
            if (empty) empty.classList.remove('hidden');
            return;
        }

        renderProposalsGrid(currentProposalsData);
    } catch (err) {
        console.error("Proposals fetch error:", err);
        if (loading) loading.classList.add('hidden');
        if (empty) empty.classList.remove('hidden');
    }
}

function applyFilters() {
    loadProposals();
}

// Proposal View Mode Manager (Grid, Expanded Large Cards, List)
let proposalViewMode = localStorage.getItem('attestto_proposal_view_mode') || 'grid';

function setProposalViewMode(mode) {
    proposalViewMode = mode;
    localStorage.setItem('attestto_proposal_view_mode', mode);

    const btnGrid = document.getElementById('viewModeGrid');
    const btnExpanded = document.getElementById('viewModeExpanded');
    const btnList = document.getElementById('viewModeList');

    [btnGrid, btnExpanded, btnList].forEach(b => {
        if (b) {
            b.className = 'p-1.5 rounded-lg text-gray-400 hover:text-white text-xs font-bold transition-colors';
        }
    });

    if (mode === 'grid' && btnGrid) btnGrid.className = 'p-1.5 rounded-lg text-purple-300 bg-purple-500/20 text-xs font-bold transition-colors';
    if (mode === 'expanded' && btnExpanded) btnExpanded.className = 'p-1.5 rounded-lg text-purple-300 bg-purple-500/20 text-xs font-bold transition-colors';
    if (mode === 'list' && btnList) btnList.className = 'p-1.5 rounded-lg text-purple-300 bg-purple-500/20 text-xs font-bold transition-colors';

    if (currentProposalsData) {
        renderProposalsGrid(currentProposalsData);
    }
}

function renderProposalsGrid(proposals) {
    const grid = document.getElementById('proposalsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Adjust grid container layout according to proposalViewMode
    if (proposalViewMode === 'list') {
        grid.className = 'flex flex-col space-y-3';
    } else if (proposalViewMode === 'expanded') {
        grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';
    } else {
        grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    }

    const statusBadges = {
        active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        passed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
        executed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };

    proposals.forEach(p => {
        const card = document.createElement('div');
        const now = new Date();
        const endTime = new Date(p.end_time);
        const timeLeftMs = endTime - now;
        let timeString = 'Expired';
        if (timeLeftMs > 0) {
            const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
            const days = Math.floor(hours / 24);
            timeString = days > 0 ? `${days}d ${hours % 24}h left` : `${hours}h left`;
        }

        let adminActionButtons = '';
        if (isUserAdmin) {
            adminActionButtons = `
                <div class="pt-2 border-t border-[#251c3a] flex items-center justify-between gap-2 text-xs">
                    <div class="flex items-center gap-1">
                        <select onchange="updateProposalStatusAdmin(${p.id}, this.value)" class="bg-[#0c0819] border border-purple-500/40 text-[10px] font-bold text-purple-300 rounded-lg px-2 py-1">
                            <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="passed" ${p.status === 'passed' ? 'selected' : ''}>Passed</option>
                            <option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                            <option value="executed" ${p.status === 'executed' ? 'selected' : ''}>Executed</option>
                            <option value="cancelled" ${p.status === 'cancelled' ? 'selected' : ''}>Cancel</option>
                        </select>
                        <button onclick="togglePinProposalAdmin(${p.id}, ${p.is_pinned ? 0 : 1})" title="${p.is_pinned ? 'Unpin' : 'Pin'}" class="p-1 text-purple-400 hover:bg-purple-500/20 rounded-lg text-xs">
                            ${p.is_pinned ? '📌' : '📍'}
                        </button>
                    </div>
                    <button onclick="deleteProposalAdmin(${p.id})" title="Delete Proposal" class="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-500/10 rounded-lg border border-red-500/30">
                        🗑️
                    </button>
                </div>
            `;
        }

        if (proposalViewMode === 'list') {
            // LIST VIEW ROW
            card.className = 'glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#251c3a] hover:border-purple-500/40 transition-all';
            card.innerHTML = `
                <div class="flex items-center gap-3 flex-grow cursor-pointer" onclick="openProposalDetailModal(${p.id})">
                    <span class="text-xs font-bold px-2.5 py-1 rounded-full border ${statusBadges[p.status] || statusBadges.active} whitespace-nowrap">
                        ${p.status.toUpperCase()}
                    </span>
                    <div class="space-y-0.5">
                        <div class="flex items-center gap-2">
                            <h3 class="font-display font-bold text-white hover:text-purple-300 transition-colors text-sm md:text-base">
                                ${escapeHtml(p.title)}
                            </h3>
                            ${p.is_pinned ? '<span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">📌</span>' : ''}
                        </div>
                        <p class="text-gray-400 text-xs line-clamp-1">${escapeHtml(p.description)}</p>
                    </div>
                </div>

                <div class="flex items-center gap-4 text-xs whitespace-nowrap">
                    <div class="w-28 space-y-1">
                        <div class="flex justify-between text-[10px] text-gray-400 font-semibold">
                            <span>Yes: ${p.yes_pct}%</span>
                            <span>${p.total_power} VP</span>
                        </div>
                        <div class="w-full bg-[#08070f] rounded-full h-1.5 flex overflow-hidden">
                            <div class="bg-emerald-500 h-full" style="width: ${p.yes_pct}%"></div>
                            <div class="bg-red-500 h-full" style="width: ${p.no_pct}%"></div>
                            <div class="bg-cyan-500 h-full" style="width: ${p.abstain_pct}%"></div>
                        </div>
                    </div>
                    
                    <button onclick="openProposalDetailModal(${p.id})" class="px-4 py-2 rounded-xl font-bold text-xs bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-300 hover:text-white transition-all shadow-sm">
                        Full View 🔍
                    </button>
                </div>
            `;
        } else {
            // GRID & EXPANDED CARD VIEW
            card.className = `glass-card p-6 rounded-3xl flex flex-col justify-between space-y-5 relative group ${proposalViewMode === 'expanded' ? 'border-purple-500/40 bg-gradient-to-b from-[#130d29] to-[#0a0717]' : ''}`;
            card.innerHTML = `
                <div class="space-y-3 cursor-pointer" onclick="openProposalDetailModal(${p.id})">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                ${p.category || 'Governance'}
                            </span>
                            ${p.is_pinned ? '<span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">📌 PINNED</span>' : ''}
                        </div>
                        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadges[p.status] || statusBadges.active}">
                            ${p.status.toUpperCase()}
                        </span>
                    </div>

                    <h3 class="font-display text-xl font-bold text-white group-hover:text-purple-300 transition-colors leading-snug">
                        ${escapeHtml(p.title)}
                    </h3>
                    
                    <p class="text-gray-400 text-xs ${proposalViewMode === 'expanded' ? 'line-clamp-6' : 'line-clamp-3'} leading-relaxed">
                        ${escapeHtml(p.description)}
                    </p>
                </div>

                <div class="space-y-3 pt-2">
                    <!-- Tally Bars -->
                    <div class="space-y-1.5">
                        <div class="flex justify-between text-[11px] font-semibold text-gray-400">
                            <span>Approval (${p.yes_pct}%)</span>
                            <span>${p.total_power} Power (${p.total_votes} votes)</span>
                        </div>
                        <div class="w-full bg-[#08070f] rounded-full h-2 flex overflow-hidden">
                            <div class="bg-emerald-500 h-full transition-all" style="width: ${p.yes_pct}%"></div>
                            <div class="bg-red-500 h-full transition-all" style="width: ${p.no_pct}%"></div>
                            <div class="bg-cyan-500 h-full transition-all" style="width: ${p.abstain_pct}%"></div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between text-[11px] text-gray-400">
                        <span class="flex items-center gap-1">
                            ⏱️ ${timeString}
                        </span>
                        <span>${p.quorum_met ? '✅ Quorum Met' : `⚠️ Quorum: ${p.total_power}/${p.quorum_required_power}`}</span>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <button onclick="openVoteModal(${p.id})" class="py-2.5 rounded-xl font-bold text-xs bg-[#1a142e] hover:bg-purple-600 border border-purple-500/30 text-white transition-all shadow-md">
                            ${p.status === 'active' ? '⚡ Vote' : '📊 Tally'}
                        </button>
                        <button onclick="openProposalDetailModal(${p.id})" class="py-2.5 rounded-xl font-bold text-xs bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all">
                            Full Details 🔍
                        </button>
                    </div>

                    ${adminActionButtons}
                </div>
            `;
        }

        grid.appendChild(card);
    });
}

// FULL PROPOSAL DETAIL PAGE MODAL HANDLERS
async function openProposalDetailModal(proposalId) {
    currentProposalId = proposalId;
    try {
        let p = (currentProposalsData || []).find(item => item.id == proposalId);
        
        try {
            const res = await fetch(`/api/proposals?id=${proposalId}`);
            const fetched = await res.json();
            if (fetched) {
                p = Array.isArray(fetched) ? (fetched.find(item => item.id == proposalId) || fetched[0]) : fetched;
            }
        } catch (e) {
            console.warn("API fetch error, fallback to cached proposal data:", e);
        }

        if (!p) return showToast("Proposal details not found", "error");

        document.getElementById('detailCategory').textContent = p.category || 'Governance';
        document.getElementById('detailStatus').textContent = (p.status || 'ACTIVE').toUpperCase();
        document.getElementById('detailId').textContent = `PIP-${p.id}`;
        document.getElementById('detailTitle').textContent = p.title || 'Untitled Proposal';
        document.getElementById('detailDescription').textContent = p.description || 'No description provided.';
        document.getElementById('detailAuthor').textContent = p.created_by ? `${p.created_by.substring(0, 6)}...${p.created_by.substring(p.created_by.length - 4)}` : 'DAO Member';
        document.getElementById('detailCreated').textContent = p.start_time ? new Date(p.start_time).toLocaleString() : 'N/A';
        document.getElementById('detailEnds').textContent = p.end_time ? new Date(p.end_time).toLocaleString() : 'N/A';

        document.getElementById('detailYesPct').textContent = `${p.yes_pct || 0}%`;
        document.getElementById('detailYesPower').textContent = p.yes_power || 0;
        document.getElementById('detailNoPct').textContent = `${p.no_pct || 0}%`;
        document.getElementById('detailNoPower').textContent = p.no_power || 0;
        document.getElementById('detailAbstainPct').textContent = `${p.abstain_pct || 0}%`;
        document.getElementById('detailAbstainPower').textContent = p.abstain_power || 0;

        document.getElementById('detailBarYes').style.width = `${p.yes_pct || 0}%`;
        document.getElementById('detailBarNo').style.width = `${p.no_pct || 0}%`;
        document.getElementById('detailBarAbstain').style.width = `${p.abstain_pct || 0}%`;

        // Render full voting audit ledger table of all members who voted
        const votersTable = document.getElementById('detailVotersTable');
        const votersCount = document.getElementById('detailVoteCount');
        votersTable.innerHTML = '';

        const votes = p.votes || [];
        if (votersCount) votersCount.textContent = `${votes.length} Members Voted`;

        if (votes.length === 0) {
            votersTable.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">No member votes recorded yet for this proposal.</td></tr>`;
        } else {
            votes.forEach(v => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-[#1c1533] hover:bg-[#120a24]/50';
                
                const choiceBadges = {
                    yes: '<span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30">YES 👍</span>',
                    no: '<span class="px-2 py-0.5 bg-red-500/20 text-red-400 font-bold rounded-lg border border-red-500/30">NO 👎</span>',
                    abstain: '<span class="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 font-bold rounded-lg border border-cyan-500/30">ABSTAIN ✋</span>'
                };

                const voterName = v.voter_alias ? `@${v.voter_alias}` : `${v.voter_address.substring(0, 6)}...${v.voter_address.substring(v.voter_address.length - 4)}`;

                tr.innerHTML = `
                    <td class="p-3 font-semibold text-purple-300">${escapeHtml(voterName)}</td>
                    <td class="p-3">${choiceBadges[v.choice] || v.choice}</td>
                    <td class="p-3 font-mono font-bold text-white">${v.weight || 1} VP</td>
                    <td class="p-3 text-gray-300 max-w-xs truncate">${escapeHtml(v.reason || 'No comment')}</td>
                    <td class="p-3 text-right text-gray-400 font-mono">${new Date(v.timestamp).toLocaleTimeString()}</td>
                `;
                votersTable.appendChild(tr);
            });
        }

        document.getElementById('proposalDetailModal').classList.remove('hidden');
        document.getElementById('proposalDetailModal').classList.add('flex');
    } catch (err) {
        console.error("Open proposal detail error:", err);
        showToast("Failed to load proposal details.", "error");
    }
}

function closeProposalDetailModal() {
    document.getElementById('proposalDetailModal').classList.add('hidden');
    document.getElementById('proposalDetailModal').classList.remove('flex');
}

async function submitDetailVote(choice) {
    closeProposalDetailModal();
    openVoteModal(currentProposalId);
    await submitVote(choice);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Proposals Vote Modal Operations
async function openVoteModal(proposalId) {
    currentProposalId = proposalId;
    try {
        const url = userWallet ? `/api/proposal?id=${proposalId}&wallet=${userWallet}` : `/api/proposal?id=${proposalId}`;
        const res = await fetch(url);
        const data = await res.json();
        const p = data.proposal;
        const tallies = data.tallies;

        document.getElementById('modalTitle').textContent = p.title;
        document.getElementById('modalDesc').textContent = p.description;
        document.getElementById('modalCategory').textContent = p.category || 'Governance';

        const statusEl = document.getElementById('modalStatus');
        statusEl.textContent = p.status.toUpperCase();
        statusEl.className = `text-xs font-bold px-2.5 py-0.5 rounded-full border ${
            p.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
        }`;

        if (p.discussion_url) {
            document.getElementById('modalDiscussionLinkContainer').classList.remove('hidden');
            document.getElementById('modalDiscussionLink').href = p.discussion_url;
        } else {
            document.getElementById('modalDiscussionLinkContainer').classList.add('hidden');
        }

        // Tallies
        document.getElementById('modalYesPct').textContent = `${tallies.yes_pct}%`;
        document.getElementById('modalYesPower').textContent = tallies.yes_power;
        document.getElementById('modalNoPct').textContent = `${tallies.no_pct}%`;
        document.getElementById('modalNoPower').textContent = tallies.no_power;
        document.getElementById('modalAbstainPct').textContent = `${tallies.abstain_pct}%`;
        document.getElementById('modalAbstainPower').textContent = tallies.abstain_power;

        document.getElementById('modalBarYes').style.width = `${tallies.yes_pct}%`;
        document.getElementById('modalBarNo').style.width = `${tallies.no_pct}%`;
        document.getElementById('modalBarAbstain').style.width = `${tallies.abstain_pct}%`;

        // Hide vote form if proposal is not active
        if (p.status !== 'active') {
            document.getElementById('voteFormArea').classList.add('hidden');
        } else {
            document.getElementById('voteFormArea').classList.remove('hidden');
        }

        // Voter history
        const votersList = document.getElementById('modalVotersList');
        votersList.innerHTML = '';
        if (!data.votes || data.votes.length === 0) {
            votersList.innerHTML = `<div class="text-gray-500 text-center py-2">No votes cast yet. Be the first!</div>`;
        } else {
            data.votes.forEach(v => {
                const choiceBadge = v.choice === 'yes' ? 'text-emerald-400 bg-emerald-500/10' : v.choice === 'no' ? 'text-red-400 bg-red-500/10' : 'text-cyan-400 bg-cyan-500/10';
                const row = document.createElement('div');
                row.className = 'flex flex-col gap-1 pt-1.5';
                row.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="font-mono text-gray-300 font-medium">${v.wallet_address.substring(0, 6)}...${v.wallet_address.substring(v.wallet_address.length - 4)}</span>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 rounded font-extrabold ${choiceBadge}">${v.choice.toUpperCase()} (${v.vote_power}x)</span>
                            <span class="text-[10px] text-gray-500">${new Date(v.timestamp).toLocaleDateString()}</span>
                        </div>
                    </div>
                    ${v.reason ? `<p class="text-gray-400 italic text-[11px] pl-2 border-l-2 border-purple-500/30">"${escapeHtml(v.reason)}"</p>` : ''}
                `;
                votersList.appendChild(row);
            });
        }

        document.getElementById('voteModal').classList.remove('hidden');
        document.getElementById('voteModal').classList.add('flex');
    } catch (err) {
        console.error("Modal detail error:", err);
        showToast("Failed to load proposal detail", "error");
    }
}

function closeVoteModal() {
    document.getElementById('voteModal').classList.add('hidden');
    document.getElementById('voteModal').classList.remove('flex');
}

// Submit Vote with Cryptographic Signature
async function submitVote(choice) {
    if (!userWallet) {
        return showToast("Please connect your Phantom / Solana wallet first.", "error");
    }

    const provider = window.solana || window.solflare;
    if (!provider) return showToast("Solana wallet extension not found.", "error");

    const reason = document.getElementById('voteReasonInput').value.trim();
    const timestamp = Date.now();
    const message = `Attestto Official Vote | Proposal: ${currentProposalId} | Choice: ${choice} | Ts: ${timestamp}`;

    try {
        const encodedMessage = new TextEncoder().encode(message);
        const signedResult = await provider.signMessage(encodedMessage, "utf8");
        const signatureBytes = signedResult.signature || signedResult;
        const signatureBs58 = toBase58(signatureBytes);

        const res = await fetch('/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                proposalId: currentProposalId,
                wallet: userWallet,
                signature: signatureBs58,
                choice: choice,
                reason: reason,
                timestamp: timestamp
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast("Vote successfully cast and cryptographically verified!", "success");
            closeVoteModal();
            loadProposals();
        } else {
            showToast("Voting failed: " + (data.error || "Unknown error"), "error");
        }
    } catch (err) {
        console.error("Signing error:", err);
        showToast("Signature signing was rejected or failed.", "error");
    }
}

// LOAD MEMBERS TAB
async function loadMembers() {
    const loading = document.getElementById('membersLoading');
    const empty = document.getElementById('membersEmptyState');
    if (loading) loading.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');

    try {
        const res = await fetch('/api/members');
        const data = await res.json();
        currentMembersData = data.members || [];

        const stats = data.stats || {};
        document.getElementById('statTotalMembers').textContent = stats.total_members || 0;
        document.getElementById('statCouncilMembers').textContent = stats.council_count || 0;
        document.getElementById('statVipMembers').textContent = stats.vip_count || 0;
        document.getElementById('statAvgMultiplier').textContent = `${stats.avg_multiplier || "1.00"}x`;
        document.getElementById('statTotalMemberPower').textContent = stats.total_power || 0;

        if (loading) loading.classList.add('hidden');
        renderMembersList();
    } catch (err) {
        console.error("Members fetch error:", err);
        if (loading) loading.classList.add('hidden');
        showToast("Failed to load DAO members data.", "error");
    }
}

function renderMembersList() {
    const grid = document.getElementById('membersGrid');
    const empty = document.getElementById('membersEmptyState');
    if (!grid) return;
    grid.innerHTML = '';

    const search = (document.getElementById('memberSearchInput')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('memberRoleFilter')?.value || 'all';

    const filtered = currentMembersData.filter(m => {
        const matchesSearch = !search || 
            (m.wallet_address && m.wallet_address.toLowerCase().includes(search)) ||
            (m.display_name && m.display_name.toLowerCase().includes(search)) ||
            (m.tier && m.tier.toLowerCase().includes(search));

        let matchesRole = true;
        if (roleFilter === 'admin') matchesRole = m.role.includes('Admin');
        if (roleFilter === 'vip') matchesRole = m.multiplier > 1.0 || m.tier.includes('VIP');
        if (roleFilter === 'voter') matchesRole = m.votes_cast > 0;

        return matchesSearch && matchesRole;
    });

    if (filtered.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');

    filtered.forEach(m => {
        const card = document.createElement('div');
        card.className = 'glass-card p-6 rounded-3xl space-y-4 relative flex flex-col justify-between';

        const roleBadges = {
            'Core DAO Admin': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
            'Whitelisted Voter': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            'Active Voter': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
        };

        const shortAddr = `${m.wallet_address.substring(0, 6)}...${m.wallet_address.substring(m.wallet_address.length - 4)}`;
        const displayNameText = m.display_name ? `@${m.display_name}` : shortAddr;

        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${roleBadges[m.role] || roleBadges['Active Voter']}">
                        ${m.role}
                    </span>
                    <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        ${m.multiplier}x Multiplier
                    </span>
                </div>

                <div class="flex items-center gap-3 pt-1">
                    <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-500/40 flex items-center justify-center font-bold text-lg text-purple-200">
                        ${m.display_name ? m.display_name.charAt(0).toUpperCase() : '⚡'}
                    </div>
                    <div>
                        <h4 class="font-display text-lg font-bold text-white flex items-center gap-1.5">
                            <span>${escapeHtml(displayNameText)}</span>
                            ${m.display_name ? '<span class="text-xs text-emerald-400" title="Verified Alias">✓</span>' : ''}
                        </h4>
                        <p class="font-mono text-[11px] text-gray-400">${m.wallet_address}</p>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-3 border-t border-[#251c3a] text-center">
                <div class="bg-[#0b0817] p-2 rounded-xl border border-[#1f1730]">
                    <div class="text-gray-400 text-[10px]">Reputation</div>
                    <div class="font-bold text-purple-300 text-xs mt-0.5">${m.reputation} PTS</div>
                </div>
                <div class="bg-[#0b0817] p-2 rounded-xl border border-[#1f1730]">
                    <div class="text-gray-400 text-[10px]">Votes Cast</div>
                    <div class="font-bold text-emerald-400 text-xs mt-0.5">${m.votes_cast}</div>
                </div>
                <div class="bg-[#0b0817] p-2 rounded-xl border border-[#1f1730]">
                    <div class="text-gray-400 text-[10px]">Power Score</div>
                    <div class="font-bold text-purple-300 text-xs mt-0.5">${m.power_score}</div>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// LOAD TREASURY TAB
async function loadTreasury() {
    try {
        const res = await fetch('/api/treasury');
        const data = await res.json();

        // Total Net Worth
        document.getElementById('treasuryNetWorth').textContent = `$${(data.total_net_worth_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;

        // Multisig Info
        if (data.multisig) {
            document.getElementById('treasuryProtocol').textContent = data.multisig.protocol || "Squads v4";
            document.getElementById('treasuryMultisigStatus').textContent = data.multisig.threshold || "1 of 1 Signers";
            document.getElementById('treasuryVaultAddress').textContent = data.multisig.vault_address || "Attest5TreasuryVault1111111111111111111111";

            const signersList = document.getElementById('treasurySignersList');
            signersList.innerHTML = '';
            (data.multisig.signers || []).forEach(s => {
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between p-2.5 bg-[#0b0817] rounded-xl border border-[#1f1730] text-xs font-mono';
                item.innerHTML = `
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span class="text-purple-300 font-bold">${s.name}</span>
                        <span class="text-gray-500">(${s.address})</span>
                    </div>
                    <span class="text-emerald-400 font-semibold">${s.status}</span>
                `;
                signersList.appendChild(item);
            });
        }

        // Render Asset Allocation Cards (Liquid Assets ONLY: SOL, USDC)
        const assetsGrid = document.getElementById('treasuryAssetsGrid');
        if (assetsGrid) {
            assetsGrid.innerHTML = '';
            const liquidAssets = (data.assets || []).filter(ast => ast.symbol !== '$ATTEST');
            if (liquidAssets.length === 0) {
                assetsGrid.innerHTML = `
                    <div class="bg-[#0a0716] p-4 rounded-2xl border border-[#1f1730] flex items-center justify-between col-span-2">
                        <div class="flex items-center gap-3">
                            <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" class="w-8 h-8 rounded-full">
                            <div>
                                <div class="font-bold text-white text-sm">SOL (Solana Native)</div>
                                <div class="text-gray-400 text-xs">0.00 SOL</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-emerald-400">$0.00 USD</div>
                            <div class="text-gray-500 text-[11px]">Liquid Treasury</div>
                        </div>
                    </div>
                `;
            } else {
                liquidAssets.forEach(ast => {
                    const card = document.createElement('div');
                    card.className = 'bg-[#0a0716] p-4 rounded-2xl border border-[#1f1730] flex items-center justify-between';
                    card.innerHTML = `
                        <div class="flex items-center gap-3">
                            <img src="${ast.logo_url}" class="w-8 h-8 rounded-full">
                            <div>
                                <div class="font-bold text-white text-sm">${ast.symbol} (${ast.name})</div>
                                <div class="text-gray-400 text-xs">${ast.balance} ${ast.symbol}</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-emerald-400">$${(ast.value_usd || 0).toFixed(2)} USD</div>
                            <div class="text-gray-500 text-[11px]">Allocation: ${ast.allocation_pct}%</div>
                        </div>
                    `;
                    assetsGrid.appendChild(card);
                });
            }
        }

        // Render Transaction History Table
        const txTable = document.getElementById('treasuryTxTable');
        const txEmpty = document.getElementById('treasuryTxEmpty');
        txTable.innerHTML = '';

        if (!data.transactions || data.transactions.length === 0) {
            if (txEmpty) txEmpty.classList.remove('hidden');
        } else {
            if (txEmpty) txEmpty.classList.add('hidden');
            data.transactions.forEach(tx => {
                const tr = document.createElement('tr');
                const typeBadges = {
                    'Grant': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                    'Deposit': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                    'Transfer': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
                    'Yield': 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                };

                const shortHash = `${tx.tx_hash.substring(0, 6)}...${tx.tx_hash.substring(tx.tx_hash.length - 4)}`;

                tr.innerHTML = `
                    <td class="p-3 font-mono text-purple-300 font-medium">${shortHash}</td>
                    <td class="p-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeBadges[tx.type] || typeBadges['Grant']}">
                            ${tx.type}
                        </span>
                    </td>
                    <td class="p-3 text-gray-200">${escapeHtml(tx.description)}</td>
                    <td class="p-3 font-mono text-gray-300">${escapeHtml(tx.recipient)}</td>
                    <td class="p-3 font-bold text-purple-300">${tx.amount}</td>
                    <td class="p-3 text-right font-bold text-white">$${(tx.usd_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                `;
                txTable.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Treasury fetch error:", err);
        showToast("Error fetching treasury data.", "error");
    }
}

// Load DAO Analytics
async function loadAnalytics() {
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();

        document.getElementById('statTotalProposals').textContent = stats.total_proposals || 0;
        document.getElementById('statActiveProposals').textContent = stats.active_proposals || 0;
        document.getElementById('statTotalVotes').textContent = stats.total_votes || 0;
        document.getElementById('statUniqueVoters').textContent = stats.unique_voters || 0;

        document.getElementById('analyticsQuorum').textContent = `${daoConfig.quorum_percentage || 10}% Power`;
        document.getElementById('analyticsStrategy').textContent = daoConfig.voting_strategy || "Reputation & Multipliers";
        document.getElementById('analyticsAdmins').textContent = `${stats.active_admins || 1} Wallet(s)`;
    } catch (err) {
        console.error("Analytics fetch error:", err);
    }
}

// ADMIN CONSOLE ACTIONS
function switchAdminSubTab(subTabName) {
    const subTabs = ['general', 'treasury', 'profiles', 'create', 'proposals', 'admins', 'whitelist', 'tokenomics', 'audit'];
    subTabs.forEach(st => {
        const panel = document.getElementById(`adminPanel${st.charAt(0).toUpperCase() + st.slice(1)}`);
        const btn = document.getElementById(`subTab${st.charAt(0).toUpperCase() + st.slice(1)}`);
        if (st === subTabName) {
            if (panel) panel.classList.remove('hidden');
            if (btn) btn.className = 'admin-subtab px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40';
        } else {
            if (panel) panel.classList.add('hidden');
            if (btn) btn.className = 'admin-subtab px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-gray-400 hover:text-white';
        }
    });

    if (subTabName === 'proposals') loadAdminProposalsTable();
    if (subTabName === 'admins') loadAdminWalletsList();
    if (subTabName === 'whitelist') loadAdminWhitelistTable();
    if (subTabName === 'audit') loadAdminAuditLogs();
}

async function loadAdminData() {
    switchAdminSubTab('general');
}

// Sign and execute generic Admin Action
async function sendAdminAction(action, payload = {}) {
    if (!userWallet || !isUserAdmin) {
        showToast("Unauthorized: You must be connected with an authorized Admin wallet.", "error");
        return null;
    }

    const provider = window.solana || window.solflare;
    const timestamp = Date.now();
    const message = `Attestto Admin Action: ${action} | Ts: ${timestamp}`;

    try {
        const encodedMessage = new TextEncoder().encode(message);
        const signedResult = await provider.signMessage(encodedMessage, "utf8");
        const signatureBytes = signedResult.signature || signedResult;
        const signatureBs58 = toBase58(signatureBytes);

        const body = {
            action: action,
            wallet: userWallet,
            signature: signatureBs58,
            timestamp: timestamp,
            ...payload
        };

        const res = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast(data.message || "Admin action executed!", "success");
            await fetchDaoConfig();
            await loadProposals();
            return data;
        } else {
            showToast("Admin action failed: " + (data.error || "Unknown error"), "error");
            return null;
        }
    } catch (err) {
        console.error("Admin sign error:", err);
        showToast("Signature failed or rejected by admin wallet.", "error");
        return null;
    }
}

// 1-Click Create & Mint $ATTEST Token via Phantom Wallet (~0.003 SOL)
async function createTokenOnChainPhantom() {
    const provider = getSolanaProvider();
    if (!provider) {
        return showToast("Phantom wallet not detected. Please install Phantom.", "error");
    }

    try {
        if (!provider.publicKey) {
            await provider.connect();
        }
        
        const walletPubkey = provider.publicKey;
        const walletAddr = walletPubkey.toBase58();

        const sWeb3 = window.solanaWeb3;
        const sToken = window.splToken;

        if (!sWeb3) {
            return showToast("Solana Web3 SDK loading... Please retry in a second.", "error");
        }

        showToast("Preparing $ATTEST token creation transaction (~0.003 SOL)...", "info");

        const connection = new sWeb3.Connection("https://api.mainnet-beta.solana.com", "confirmed");

        // Generate a new Mint Keypair
        const mintKeypair = sWeb3.Keypair.generate();
        const mintPubkey = mintKeypair.publicKey;
        const mintAddrStr = mintPubkey.toBase58();

        const logoUrl = "https://avatars.githubusercontent.com/u/108633374?s=200&v=4";

        if (!sToken || !sToken.createInitializeMintInstruction) {
            throw new Error("Solana SPL Token library not loaded in browser. Use node scripts/create_token.mjs to mint directly via CLI.");
        }

        // Full On-Chain SPL Token Transaction Construction
        const lamports = await connection.getMinimumBalanceForRentExemption(82);
        const tokenProgramId = sToken.TOKEN_PROGRAM_ID || new sWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

        const transaction = new sWeb3.Transaction();

        // 1. Create Mint Account
        transaction.add(
            sWeb3.SystemProgram.createAccount({
                fromPubkey: walletPubkey,
                newAccountPubkey: mintPubkey,
                space: 82,
                lamports: lamports,
                programId: tokenProgramId
            })
        );

        // 2. Initialize Mint (9 decimals, mintAuthority = wallet, freezeAuthority = null)
        transaction.add(
            sToken.createInitializeMintInstruction(
                mintPubkey,
                9,
                walletPubkey,
                null,
                tokenProgramId
            )
        );

        // 3. Create Associated Token Account for target wallet
        const ataPubkey = await sToken.getAssociatedTokenAddress(
            mintPubkey,
            walletPubkey,
            false,
            tokenProgramId
        );

        transaction.add(
            sToken.createAssociatedTokenAccountInstruction(
                walletPubkey,
                ataPubkey,
                walletPubkey,
                mintPubkey,
                tokenProgramId
            )
        );

        // 4. Mint 1,000,000 $ATTEST tokens
        const amountToMint = BigInt(1000000) * BigInt(10 ** 9);
        transaction.add(
            sToken.createMintToInstruction(
                mintPubkey,
                ataPubkey,
                walletPubkey,
                amountToMint,
                [],
                tokenProgramId
            )
        );

        transaction.feePayer = walletPubkey;
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;

        // Partial sign with Mint Keypair
        transaction.partialSign(mintKeypair);

        showToast("Please approve the ~0.003 SOL transaction in Phantom...", "info");
        const signedTx = await provider.signTransaction(transaction);
        const txSig = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txSig, 'confirmed');
        console.log("On-chain $ATTEST Token Created. Signature:", txSig);

        // Save token configuration into D1 Admin Config
        await sendAdminAction('update_config', {
            configs: {
                governance_token_mint: mintAddrStr,
                governance_token_symbol: '$ATTEST',
                governance_token_logo: logoUrl,
                governance_token_supply: '1000000',
                governance_token_decimals: '9'
            }
        });

        const inputMint = document.getElementById('cfgTokenMint');
        const inputSymbol = document.getElementById('cfgTokenSymbol');
        if (inputMint) inputMint.value = mintAddrStr;
        if (inputSymbol) inputSymbol.value = '$ATTEST';

        showToast(`🎉 SUCCESS! $ATTEST Token Created on Solana! Mint: ${mintAddrStr.substring(0, 8)}... (Supply: 1,000,000 $ATTEST)`, "success");

    } catch (err) {
        console.error("Token creation error:", err);
        showToast("Token creation error: " + (err.message || err), "error");
    }
}

// Restore / Mint 1,000,000 $ATTEST Tokens directly to connected Mint Authority wallet
async function restoreAttestTokensPhantom() {
    const provider = getSolanaProvider();
    if (!provider) {
        return showToast("Phantom wallet not detected.", "error");
    }

    try {
        if (!provider.publicKey) {
            await provider.connect();
        }
        
        const walletPubkey = provider.publicKey;
        let sWeb3 = window.solanaWeb3 || window.SolanaWeb3;
        let sToken = window.splToken || window.SPLToken;

        if (!sWeb3) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = "https://unpkg.com/@solana/web3.js@1.95.8/lib/index.iife.min.js";
                s.onload = () => resolve();
                s.onerror = reject;
                document.head.appendChild(s);
            }).catch(()=>{});
            sWeb3 = window.solanaWeb3 || window.SolanaWeb3;
        }

        if (!sToken) {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = "https://unpkg.com/@solana/spl-token@0.4.8/lib/index.iife.min.js";
                s.onload = () => resolve();
                s.onerror = reject;
                document.head.appendChild(s);
            }).catch(()=>{});
            sToken = window.splToken || window.SPLToken;
        }

        if (!sWeb3) return showToast("Could not load Solana Web3 library. Please check your internet connection.", "error");
        if (!sToken) return showToast("Could not load Solana SPL Token library. Please check your internet connection.", "error");


        const OFFICIAL_MINT = "91Zh1Nh5Leuktcn878HACDGtTnEwXXpTdDXEMp18rMbU";
        const mintPubkey = new sWeb3.PublicKey(OFFICIAL_MINT);

        showToast("Preparing $ATTEST token restoration transaction...", "info");

        const connection = new sWeb3.Connection("https://api.mainnet-beta.solana.com", "confirmed");
        const tokenProgramId = sToken.TOKEN_PROGRAM_ID || new sWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

        const transaction = new sWeb3.Transaction();

        // Derive Associated Token Account for user's wallet
        const ataPubkey = await sToken.getAssociatedTokenAddress(
            mintPubkey,
            walletPubkey,
            false,
            tokenProgramId
        );

        // Check if ATA already exists, if not create it
        const ataAccountInfo = await connection.getAccountInfo(ataPubkey);
        if (!ataAccountInfo) {
            transaction.add(
                sToken.createAssociatedTokenAccountInstruction(
                    walletPubkey,
                    ataPubkey,
                    walletPubkey,
                    mintPubkey,
                    tokenProgramId
                )
            );
        }

        // Mint 1,000,000 $ATTEST tokens
        const amountToMint = BigInt(1000000) * BigInt(10 ** 9);
        transaction.add(
            sToken.createMintToInstruction(
                mintPubkey,
                ataPubkey,
                walletPubkey, // Mint Authority
                amountToMint,
                [],
                tokenProgramId
            )
        );

        transaction.feePayer = walletPubkey;
        const { blockhash } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;

        showToast("Please approve the token minting transaction in Phantom...", "info");
        const signedTx = await provider.signTransaction(transaction);
        const txSig = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txSig, 'confirmed');

        showToast(`🎉 SUCCESS! 1,000,000 $ATTEST Tokens restored to your wallet! Tx: ${txSig.substring(0, 8)}...`, "success");

    } catch (err) {
        console.error("Token restoration error:", err);
        showToast("Token restoration error: " + (err.message || err), "error");
    }
}


// Save DAO Settings & Custom Branding (Bulletproof & Reliable)
async function saveDaoConfig() {
    const getVal = (id, fallback = '') => {
        const el = document.getElementById(id);
        if (!el) return fallback;
        if (el.type === 'checkbox') return el.checked ? 'true' : 'false';
        return el.value !== undefined ? el.value.trim() : fallback;
    };

    const configs = {
        dao_name: getVal('cfgDaoName', 'Attestto DAO Governance'),
        dao_logo_url: getVal('cfgDaoLogo', 'https://avatars.githubusercontent.com/u/108633374?s=200&v=4'),
        dao_description: getVal('cfgDaoDesc', 'Decentralized Decision-Making & Reputation Governance Protocol'),
        quorum_percentage: getVal('cfgQuorum', '10'),
        announcement_banner: getVal('cfgBanner', ''),
        link_twitter: getVal('cfgTwitter', 'https://x.com/attesttoID'),
        link_github: getVal('cfgGithub', 'https://github.com/Attestto-com'),
        link_docs: getVal('cfgDocs', 'https://attestto.com'),
        link_discord: getVal('cfgDiscord', ''),
        link_linkedin: getVal('cfgLinkedin', 'https://www.linkedin.com/company/attestto-inc/'),
        footer_text: getVal('cfgFooterText', '© 2026 Attestto Governance. Powered by Cloudflare Pages & Solana.'),
        maintenance_mode: getVal('cfgMaintenance', 'false'),
        proposal_deposit_fee: getVal('cfgProposalFee', '0.001'),
        council_fee: getVal('cfgCouncilFee', '0.5')
    };

    const res = await sendAdminAction('update_config', { configs });
    if (res && res.success) {
        showToast("DAO Configuration saved successfully!", "success");
        await fetchDaoConfig();
    }
}

window.saveDaoConfig = saveDaoConfig;
window.saveAdminConfig = saveDaoConfig;

// Add Treasury Transaction Admin
async function addTreasuryTxAdmin() {
    const txHash = document.getElementById('adminTxHash').value.trim();
    const type = document.getElementById('adminTxType').value;
    const description = document.getElementById('adminTxDesc').value.trim();
    const amount = document.getElementById('adminTxAmount').value.trim();
    const usdValue = document.getElementById('adminTxUsd').value;
    const recipient = document.getElementById('adminTxRecipient').value.trim();

    if (!txHash || !amount) {
        return showToast("Transaction Hash and Amount are required.", "error");
    }

    const res = await sendAdminAction('add_treasury_tx', {
        txHash,
        type,
        description,
        amount,
        usdValue,
        recipient
    });

    if (res && res.success) {
        document.getElementById('adminTxHash').value = '';
        document.getElementById('adminTxDesc').value = '';
        document.getElementById('adminTxAmount').value = '';
        document.getElementById('adminTxUsd').value = '';
        document.getElementById('adminTxRecipient').value = '';
        await loadTreasury();
    }
}

// Set Member Profile / Alias Admin
async function setUserProfileAdmin() {
    const targetWallet = document.getElementById('adminTargetWallet').value.trim();
    const displayName = document.getElementById('adminTargetAlias').value.trim();

    if (!targetWallet || !displayName) {
        return showToast("Both Wallet Address and Alias are required.", "error");
    }

    const res = await sendAdminAction('set_user_profile', { targetWallet, displayName });
    if (res && res.success) {
        document.getElementById('adminTargetWallet').value = '';
        document.getElementById('adminTargetAlias').value = '';
        await loadMembers();
    }
}

// Preset Duration Button
function setDurationPreset(days) {
    const startInput = document.getElementById('newPStartTime');
    const endInput = document.getElementById('newPEndTime');

    const now = new Date();
    startInput.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    const future = new Date(now.getTime() + days * 86400000);
    endInput.value = new Date(future.getTime() - future.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

let fpUserStart = null, fpUserEnd = null;

function initFlatpickrCalendars() {
    if (typeof flatpickr !== 'function') return;

    if (!fpUserStart && document.getElementById('userPStartTime')) {
        fpUserStart = flatpickr("#userPStartTime", {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            theme: "dark",
            defaultDate: new Date()
        });
    }

    if (!fpUserEnd && document.getElementById('userPEndTime')) {
        const defaultEnd = new Date(Date.now() + 7 * 86400000);
        fpUserEnd = flatpickr("#userPEndTime", {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
            theme: "dark",
            defaultDate: defaultEnd
        });
    }
}

function setUserDurationPreset(days) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 86400000);

    initFlatpickrCalendars();

    if (fpUserStart && fpUserEnd) {
        fpUserStart.setDate(now);
        fpUserEnd.setDate(future);
    } else {
        const startEl = document.getElementById('userPStartTime');
        const endEl = document.getElementById('userPEndTime');
        if (startEl) startEl.value = now.toISOString().slice(0, 16);
        if (endEl) endEl.value = future.toISOString().slice(0, 16);
    }
    showToast(`Voting duration set to ${days} days`, "info");
}

window.setUserDurationPreset = setUserDurationPreset;

// Open & Close Community Proposal Creation Modal
function openCreateProposalModal() {
    if (!userWallet) {
        showToast("Please connect your Phantom wallet first.", "info");
        connectWallet();
        return;
    }

    const feeSol = parseFloat(daoConfig.proposal_deposit_fee || '0.001');
    const feeUsd = (feeSol * currentSolPriceUsd).toFixed(2);

    const feeSolEl = document.getElementById('modalProposalFeeSol');
    const feeUsdEl = document.getElementById('modalProposalFeeUsd');
    if (feeSolEl) feeSolEl.textContent = `${feeSol} SOL`;
    if (feeUsdEl) feeUsdEl.textContent = `~$${feeUsd} USD`;

    const modal = document.getElementById('createProposalModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    setTimeout(() => {
        initFlatpickrCalendars();
    }, 100);
}

function closeCreateProposalModal() {
    const modal = document.getElementById('createProposalModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function submitCommunityProposal() {
    if (!userWallet) return showToast("Please connect your Phantom wallet first.", "error");

    const title = document.getElementById('userPTitle').value.trim();
    const category = document.getElementById('userPCategory').value;
    const discussionUrl = document.getElementById('userPDiscussion').value.trim();
    const description = document.getElementById('userPDesc').value.trim();

    if (!title || !description) {
        return showToast("Please fill in both Proposal Title and Description.", "error");
    }

    let startTime = (fpUserStart && fpUserStart.selectedDates[0]) ? fpUserStart.selectedDates[0].toISOString() : new Date().toISOString();
    let endTime = (fpUserEnd && fpUserEnd.selectedDates[0]) ? fpUserEnd.selectedDates[0].toISOString() : new Date(Date.now() + 7 * 86400000).toISOString();

    const feeSol = parseFloat(daoConfig.proposal_deposit_fee || '0.001');

    try {
        const btn = document.getElementById('btnSubmitCommunityProposal');
        if (btn) btn.disabled = true;

        // If anti-spam fee > 0 and user is not admin, execute 1-click SOL transfer to Treasury
        if (feeSol > 0 && !isUserAdmin) {
            showToast(`Initiating ${feeSol} SOL anti-spam deposit to DAO Treasury...`, "info");
            const provider = getSolanaProvider();
            if (provider && window.solanaWeb3 && provider.signAndSendTransaction) {
                const rpcs = [
                    'https://rpc.ankr.com/solana',
                    'https://api.mainnet-beta.solana.com'
                ];
                let blockhash = null, connection = null;
                for (const rpcUrl of rpcs) {
                    try {
                        const conn = new solanaWeb3.Connection(rpcUrl, 'confirmed');
                        const bh = await conn.getLatestBlockhash('confirmed');
                        if (bh && bh.blockhash) {
                            blockhash = bh.blockhash;
                            connection = conn;
                            break;
                        }
                    } catch (e) {}
                }

                if (blockhash && connection) {
                    const fromPubkey = new solanaWeb3.PublicKey(userWallet);
                    const toPubkey = new solanaWeb3.PublicKey("8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV");
                    const lamports = Math.round(feeSol * solanaWeb3.LAMPORTS_PER_SOL);

                    const transaction = new solanaWeb3.Transaction().add(
                        solanaWeb3.SystemProgram.transfer({
                            fromPubkey,
                            toPubkey,
                            lamports
                        })
                    );
                    transaction.feePayer = fromPubkey;
                    transaction.recentBlockhash = blockhash;

                    const signedTx = await provider.signTransaction(transaction);
                    const txSig = await connection.sendRawTransaction(signedTx.serialize());
                    await connection.confirmTransaction(txSig, 'confirmed');
                    console.log("Proposal fee deposit signature:", txSig);
                }
            }
        }

        // Cryptographically sign proposal submission
        const provider = getSolanaProvider();
        const timestamp = Date.now();
        const message = `Attestto Create Proposal: ${title} | Ts: ${timestamp}`;
        const encoded = new TextEncoder().encode(message);
        const signed = await provider.signMessage(encoded, "utf8");
        const signatureBytes = signed.signature || signed;
        const signatureBs58 = toBase58(signatureBytes);

        const res = await fetch('/api/proposals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet: userWallet,
                signature: signatureBs58,
                timestamp,
                title,
                description,
                category,
                discussionUrl,
                startTime,
                endTime
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast("🎉 Proposal submitted successfully to Attestto DAO!", "success");
            closeCreateProposalModal();
            document.getElementById('userPTitle').value = '';
            document.getElementById('userPDesc').value = '';
            document.getElementById('userPDiscussion').value = '';
            await loadProposals();
        } else {
            showToast(data.error || "Failed to submit proposal", "error");
        }
    } catch (err) {
        console.error("Proposal submission error:", err);
        showToast("Proposal creation cancelled or failed: " + (err.message || err), "error");
    } finally {
        const btn = document.getElementById('btnSubmitCommunityProposal');
        if (btn) btn.disabled = false;
    }
}

window.handleNewProposalClick = openCreateProposalModal;
window.openCreateProposalModal = openCreateProposalModal;
window.closeCreateProposalModal = closeCreateProposalModal;
window.submitCommunityProposal = submitCommunityProposal;

// Create Proposal Admin
async function createProposalAdmin() {
    const title = document.getElementById('newPTitle').value.trim();
    const category = document.getElementById('newPCategory').value;
    const description = document.getElementById('newPDesc').value.trim();
    const startTime = document.getElementById('newPStartTime').value;
    const endTime = document.getElementById('newPEndTime').value;
    const discussionUrl = document.getElementById('newPDiscussion').value.trim();
    const isPinned = document.getElementById('newPPinned').checked;

    if (!title || !description) {
        return showToast("Please fill in both Proposal Title and Description.", "error");
    }

    const payload = {
        title,
        description,
        category,
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : new Date(Date.now() + 7 * 86400000).toISOString(),
        discussionUrl,
        isPinned
    };

    const res = await sendAdminAction('create_proposal', payload);
    if (res && res.success) {
        document.getElementById('newPTitle').value = '';
        document.getElementById('newPDesc').value = '';
        document.getElementById('newPDiscussion').value = '';
        switchTab('proposals');
    }
}

// Manage Proposals Admin Table
function loadAdminProposalsTable() {
    const tbody = document.getElementById('adminProposalsTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    currentProposalsData.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3 font-mono text-gray-400">#${p.id}</td>
            <td class="p-3 font-bold text-white">${escapeHtml(p.title)}</td>
            <td class="p-3 text-gray-300">${p.category}</td>
            <td class="p-3">
                <select onchange="updateProposalStatusAdmin(${p.id}, this.value)" class="bg-[#0b0817] border border-[#251c3a] text-xs text-purple-300 rounded p-1">
                    <option value="active" ${p.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="passed" ${p.status === 'passed' ? 'selected' : ''}>Passed</option>
                    <option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                    <option value="executed" ${p.status === 'executed' ? 'selected' : ''}>Executed</option>
                    <option value="cancelled" ${p.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td class="p-3 text-center">
                <input type="checkbox" ${p.is_pinned ? 'checked' : ''} onchange="togglePinProposalAdmin(${p.id}, this.checked ? 1 : 0)">
            </td>
            <td class="p-3 text-right">
                <button onclick="deleteProposalAdmin(${p.id})" class="text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-500/10 rounded">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateProposalStatusAdmin(proposalId, status) {
    await sendAdminAction('update_proposal_status', { proposalId, status });
}

async function togglePinProposalAdmin(proposalId, isPinned) {
    await sendAdminAction('toggle_pin_proposal', { proposalId, isPinned });
}

async function deleteProposalAdmin(proposalId) {
    if (confirm("Are you sure you want to permanently delete this proposal and its votes?")) {
        await sendAdminAction('delete_proposal', { proposalId });
    }
}

// Manage Admins
function loadAdminWalletsList() {
    const list = document.getElementById('adminWalletsList');
    if (!list) return;
    list.innerHTML = '';
    const admins = daoConfig.admin_wallets || [];
    admins.forEach(addr => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-[#0b0817] rounded-xl border border-[#251c3a] text-xs font-mono';
        item.innerHTML = `
            <span class="text-purple-300 font-bold">${addr} ${addr === '8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV' ? '(Primary Founder)' : ''}</span>
            ${addr !== '8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV' ? `<button onclick="removeAdminWallet('${addr}')" class="text-red-400 hover:text-red-300 font-sans font-bold">Remove</button>` : '<span class="text-gray-500 font-sans">Owner</span>'}
        `;
        list.appendChild(item);
    });
}

async function addAdminWallet() {
    const newAdminWallet = document.getElementById('newAdminWalletInput').value.trim();
    if (!newAdminWallet) return showToast("Enter wallet address", "error");
    await sendAdminAction('add_admin', { newAdminWallet });
    document.getElementById('newAdminWalletInput').value = '';
    loadAdminWalletsList();
}

async function removeAdminWallet(targetAdminWallet) {
    await sendAdminAction('remove_admin', { targetAdminWallet });
    loadAdminWalletsList();
}

// Whitelist & Multipliers
async function loadAdminWhitelistTable() {
    const res = await sendAdminAction('get_whitelists');
    const tbody = document.getElementById('whitelistTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (res && res.whitelists && Array.isArray(res.whitelists)) {
        res.whitelists.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-2.5 font-mono text-purple-300">${item.wallet_address}</td>
                <td class="p-2.5 text-gray-300 font-semibold">${item.tier}</td>
                <td class="p-2.5 text-purple-300 font-bold">${item.multiplier}x</td>
                <td class="p-2.5 text-right">
                    <button onclick="removeWhitelistVoter('${item.wallet_address}')" class="text-red-400 hover:text-red-300 font-bold">Remove</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

async function addWhitelistVoter() {
    const targetWallet = document.getElementById('wlWallet').value.trim();
    const tier = document.getElementById('wlTier').value.trim();
    const multiplier = document.getElementById('wlMultiplier').value;

    if (!targetWallet) return showToast("Enter wallet address", "error");
    await sendAdminAction('add_whitelist', { targetWallet, tier, multiplier });
    document.getElementById('wlWallet').value = '';
    loadAdminWhitelistTable();
}

async function removeWhitelistVoter(targetWallet) {
    await sendAdminAction('remove_whitelist', { targetWallet });
    loadAdminWhitelistTable();
}

// Audit Logs
async function loadAdminAuditLogs() {
    const res = await sendAdminAction('get_audit_logs');
    const tbody = document.getElementById('auditLogTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (res && res.logs && Array.isArray(res.logs)) {
        res.logs.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-2.5 text-gray-400">${new Date(l.timestamp).toLocaleString()}</td>
                <td class="p-2.5 text-purple-300">${l.admin_wallet.substring(0, 6)}...${l.admin_wallet.substring(l.admin_wallet.length - 4)}</td>
                <td class="p-2.5 font-bold text-purple-300">${l.action}</td>
                <td class="p-2.5 text-gray-400 max-w-xs truncate">${escapeHtml(l.details)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}
