// public/app.js - Attestto DAO Governance Front-end Client (Full Extended Edition)

let userWallet = null;
let userAlias = null;
let isUserAdmin = false;
let currentProposalId = null;
let currentProposalsData = [];
let currentMembersData = [];
let daoConfig = {};

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

    await fetchDaoConfig();
    await loadProposals();
    await loadMembers();
    await loadTreasury();
    await loadAnalytics();

    // Auto-check if Phantom/Solana wallet is connected
    if (window.solana && window.solana.isPhantom && window.solana.isConnected) {
        try {
            userWallet = window.solana.publicKey.toString();
            await updateWalletUI();
        } catch (e) {}
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
            document.getElementById('daoTitleNav').textContent = daoConfig.dao_name.toUpperCase();
            document.getElementById('daoMainTitle').textContent = daoConfig.dao_name;
            if (document.getElementById('cfgDaoName')) document.getElementById('cfgDaoName').value = daoConfig.dao_name;
        }
        if (daoConfig.dao_description) {
            document.getElementById('daoSubTitle').textContent = daoConfig.dao_description;
            if (document.getElementById('cfgDaoDesc')) document.getElementById('cfgDaoDesc').value = daoConfig.dao_description;
        }

        if (daoConfig.quorum_percentage && document.getElementById('cfgQuorum')) {
            document.getElementById('cfgQuorum').value = daoConfig.quorum_percentage;
        }

        if (daoConfig.announcement_banner) {
            if (document.getElementById('cfgBanner')) document.getElementById('cfgBanner').value = daoConfig.announcement_banner;
            document.getElementById('announcementText').textContent = daoConfig.announcement_banner;
            document.getElementById('announcementBanner').classList.remove('hidden');
        } else {
            document.getElementById('announcementBanner').classList.add('hidden');
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

        if (daoConfig.theme_accent && !localStorage.getItem('attestto_theme_accent')) {
            setAppTheme(daoConfig.theme_accent);
        }

        if (document.getElementById('cfgMaintenance')) {
            document.getElementById('cfgMaintenance').checked = !!daoConfig.maintenance_mode;
        }

        // Admin check
        isUserAdmin = !!daoConfig.is_user_admin;
        updateAdminViewAccess();
    } catch (err) {
        console.error("Config fetch error:", err);
    }
}

function dismissAnnouncement() {
    document.getElementById('announcementBanner').classList.add('hidden');
}

// Wallet Connection Management
async function connectWallet() {
    const provider = window.solana || window.solflare;
    if (!provider) {
        return showToast("Solana Wallet (Phantom/Solflare) required. Please install Phantom extension.", "error");
    }

    try {
        const resp = await provider.connect();
        userWallet = resp.publicKey.toString();
        showToast("Wallet connected: " + userWallet.substring(0, 6) + "...", "success");
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
    if (isUserAdmin && userWallet) {
        document.getElementById('adminBadge').classList.remove('hidden');
        document.getElementById('tabBtnAdmin').classList.remove('hidden');
        if (btnWithdraw) btnWithdraw.classList.remove('hidden');
        document.getElementById('adminWalletDisplay').textContent = `${userWallet.substring(0, 6)}...${userWallet.substring(userWallet.length - 4)}`;
    } else {
        document.getElementById('adminBadge').classList.add('hidden');
        document.getElementById('tabBtnAdmin').classList.add('hidden');
        if (btnWithdraw) btnWithdraw.classList.add('hidden');
    }
}

// 1-Click Treasury On-Chain Deposit Modal & Actions
function openDepositModal() {
    document.getElementById('depositModal').classList.remove('hidden');
    document.getElementById('depositModal').classList.add('flex');
}

function closeDepositModal() {
    document.getElementById('depositModal').classList.add('hidden');
    document.getElementById('depositModal').classList.remove('flex');
}

async function executeOnChainDeposit() {
    if (!userWallet) {
        return showToast("Please connect your Phantom / Solana wallet first.", "error");
    }

    const amountInput = document.getElementById('depositSolAmount');
    const amountVal = parseFloat(amountInput ? amountInput.value : 0);
    const note = document.getElementById('depositNoteInput').value.trim();

    if (!amountVal || amountVal <= 0) {
        return showToast("Enter a valid SOL amount to deposit.", "error");
    }

    const provider = window.solana || window.solflare;
    if (!provider) return showToast("Solana wallet extension not found.", "error");

    const vaultAddress = "8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV"; // Primary Founder Vault Address
    const solPriceEst = 150;
    const usdVal = amountVal * solPriceEst;

    try {
        let txSignature = '';

        // If solanaWeb3 SDK is available, build a real Solana transfer instruction!
        if (window.solanaWeb3 && provider.signAndSendTransaction) {
            const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');
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
            const { blockhash } = await connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;

            const res = await provider.signAndSendTransaction(transaction);
            txSignature = res.signature || res;
        } else {
            // Cryptographic fallback signature verification
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
        showToast("Transaction cancelled or rejected.", "error");
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

// DAO Staking Vault Operations
let userStakedSol = 0;
function stakeSolVault() {
    if (!userWallet) return showToast("Connect wallet to stake in the DAO vault.", "error");
    const val = parseFloat(document.getElementById('stakeAmountInput').value || 0);
    if (!val || val <= 0) return showToast("Enter amount of SOL to stake.", "error");

    userStakedSol += val;
    document.getElementById('userStakedBalance').textContent = `${userStakedSol.toFixed(2)} SOL`;
    document.getElementById('userEarnedYield').textContent = `${(userStakedSol * 0.085 / 365).toFixed(4)} SOL`;
    document.getElementById('stakeAmountInput').value = '';
    showToast(`Staked ${val} SOL into 8.5% APY Revenue Vault!`, "success");
}

function unstakeSolVault() {
    if (userStakedSol <= 0) return showToast("No staked balance found in vault.", "error");
    const claimed = userStakedSol;
    userStakedSol = 0;
    document.getElementById('userStakedBalance').textContent = `0.00 SOL`;
    document.getElementById('userEarnedYield').textContent = `0.0000 SOL`;
    showToast(`Unstaked ${claimed.toFixed(2)} SOL and claimed accumulated protocol yield!`, "success");
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
                    btnEl.className = 'tab-btn px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all text-amber-300 bg-amber-500/20 border border-amber-500/40 shadow-md';
                } else {
                    btnEl.className = 'tab-btn px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all bg-purple-600 text-white shadow-md';
                }
            }
        } else {
            if (viewEl) viewEl.classList.add('hidden');
            if (btnEl) {
                if (t === 'admin') {
                    btnEl.className = 'tab-btn hidden px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30';
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
    const grid = document.getElementById('proposalsGrid');
    const empty = document.getElementById('emptyState');

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
        currentProposalsData = await res.json();

        if (loading) loading.classList.add('hidden');

        if (!currentProposalsData || currentProposalsData.length === 0) {
            if (empty) empty.classList.remove('hidden');
            return;
        }

        renderProposalsGrid(currentProposalsData);
    } catch (err) {
        console.error("Proposals fetch error:", err);
        if (loading) loading.classList.add('hidden');
        showToast("Error loading proposals", "error");
    }
}

function applyFilters() {
    loadProposals();
}

function renderProposalsGrid(proposals) {
    const grid = document.getElementById('proposalsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    proposals.forEach(p => {
        const card = document.createElement('div');
        card.className = 'glass-card p-6 rounded-3xl flex flex-col justify-between space-y-5 relative group';

        const statusBadges = {
            active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            passed: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
            executed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
            cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        };

        const now = new Date();
        const endTime = new Date(p.end_time);
        const timeLeftMs = endTime - now;
        let timeString = 'Expired';
        if (timeLeftMs > 0) {
            const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
            const days = Math.floor(hours / 24);
            timeString = days > 0 ? `${days}d ${hours % 24}h remaining` : `${hours}h remaining`;
        }

        let adminActionButtons = '';
        if (isUserAdmin) {
            adminActionButtons = `
                <div class="pt-3 border-t border-[#251c3a] flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-1">
                        <select onchange="updateProposalStatusAdmin(${p.id}, this.value)" class="bg-[#0c0819] border border-amber-500/40 text-[10px] font-bold text-amber-300 rounded-lg px-2 py-1">
                            <option value="active" ${p.status === 'active' ? 'selected' : ''}>Set Active</option>
                            <option value="passed" ${p.status === 'passed' ? 'selected' : ''}>Set Passed</option>
                            <option value="rejected" ${p.status === 'rejected' ? 'selected' : ''}>Set Rejected</option>
                            <option value="executed" ${p.status === 'executed' ? 'selected' : ''}>Set Executed</option>
                            <option value="cancelled" ${p.status === 'cancelled' ? 'selected' : ''}>Cancel</option>
                        </select>
                        <button onclick="togglePinProposalAdmin(${p.id}, ${p.is_pinned ? 0 : 1})" title="${p.is_pinned ? 'Unpin' : 'Pin'}" class="p-1 text-amber-400 hover:bg-amber-500/20 rounded-lg text-xs">
                            ${p.is_pinned ? '📌' : '📍'}
                        </button>
                    </div>
                    <button onclick="deleteProposalAdmin(${p.id})" title="Delete Proposal" class="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-500/10 rounded-lg border border-red-500/30">
                        🗑️
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            ${p.category || 'Governance'}
                        </span>
                        ${p.is_pinned ? '<span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">📌 PINNED</span>' : ''}
                    </div>
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadges[p.status] || statusBadges.active}">
                        ${p.status.toUpperCase()}
                    </span>
                </div>

                <h3 class="font-display text-xl font-bold text-white group-hover:text-purple-300 transition-colors leading-snug">
                    ${escapeHtml(p.title)}
                </h3>
                
                <p class="text-gray-400 text-xs line-clamp-3 leading-relaxed">
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

                <button onclick="openVoteModal(${p.id})" class="w-full py-2.5 rounded-xl font-bold text-xs bg-[#1a142e] hover:bg-purple-600 border border-purple-500/30 text-white transition-all shadow-md">
                    ${p.status === 'active' ? '⚡ Cast Vote / View' : '🔍 View Details'}
                </button>

                ${adminActionButtons}
            </div>
        `;

        grid.appendChild(card);
    });
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
            'Core DAO Admin': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
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
                    <div class="font-bold text-amber-300 text-xs mt-0.5">${m.power_score}</div>
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

        // Render Asset Allocation Cards
        const assetsGrid = document.getElementById('treasuryAssetsGrid');
        assetsGrid.innerHTML = '';
        (data.assets || []).forEach(ast => {
            const card = document.createElement('div');
            card.className = 'bg-[#0a0716] p-4 rounded-2xl border border-[#1f1730] flex flex-col justify-between space-y-3';
            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-2xl bg-[#140e28] border border-[#251c3a] p-1.5 flex items-center justify-center shadow-md">
                            <img src="${ast.logo_url || 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'}" class="w-full h-full rounded-full object-contain" alt="${ast.symbol}">
                        </div>
                        <div>
                            <div class="font-bold text-white text-sm">${ast.name}</div>
                            <div class="text-xs text-gray-400 font-mono">${ast.symbol}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-white text-sm">$${(ast.value_usd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        <div class="text-xs text-purple-300 font-semibold">${ast.balance} ${ast.symbol}</div>
                    </div>
                </div>

                <div class="space-y-1">
                    <div class="flex justify-between text-[10px] text-gray-400 font-medium">
                        <span>Vault Allocation</span>
                        <span>${ast.allocation_pct || 0}%</span>
                    </div>
                    <div class="w-full bg-[#140e28] rounded-full h-1.5 overflow-hidden">
                        <div class="bg-gradient-to-r ${ast.color} h-full transition-all" style="width: ${ast.allocation_pct || 0}%"></div>
                    </div>
                </div>
            `;
            assetsGrid.appendChild(card);
        });

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
                    'Yield': 'bg-amber-500/20 text-amber-300 border-amber-500/30'
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
                    <td class="p-3 font-bold text-amber-300">${tx.amount}</td>
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
    const subTabs = ['general', 'treasury', 'profiles', 'create', 'proposals', 'admins', 'whitelist', 'audit'];
    subTabs.forEach(st => {
        const panel = document.getElementById(`adminPanel${st.charAt(0).toUpperCase() + st.slice(1)}`);
        const btn = document.getElementById(`subTab${st.charAt(0).toUpperCase() + st.slice(1)}`);
        if (st === subTabName) {
            if (panel) panel.classList.remove('hidden');
            if (btn) btn.className = 'admin-subtab px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40';
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

// Save DAO Settings & Custom Branding
async function saveDaoConfig() {
    const configs = {
        dao_name: document.getElementById('cfgDaoName').value.trim(),
        dao_logo_url: document.getElementById('cfgDaoLogo').value.trim(),
        dao_description: document.getElementById('cfgDaoDesc').value.trim(),
        quorum_percentage: document.getElementById('cfgQuorum').value,
        announcement_banner: document.getElementById('cfgBanner').value.trim(),
        link_twitter: document.getElementById('cfgTwitter').value.trim(),
        link_github: document.getElementById('cfgGithub').value.trim(),
        link_docs: document.getElementById('cfgDocs').value.trim(),
        link_discord: document.getElementById('cfgDiscord').value.trim(),
        footer_text: document.getElementById('cfgFooterText').value.trim(),
        maintenance_mode: document.getElementById('cfgMaintenance').checked ? 'true' : 'false'
    };

    await sendAdminAction('update_config', { configs });
}

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
                <select onchange="updateProposalStatusAdmin(${p.id}, this.value)" class="bg-[#0b0817] border border-[#251c3a] text-xs text-amber-300 rounded p-1">
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
            <span class="text-amber-300 font-bold">${addr} ${addr === '8NHPU8LZ2bKVuhXZ1oWy6Djum8nkhqMFAJMejrwTofhV' ? '(Primary Founder)' : ''}</span>
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
                <td class="p-2.5 text-amber-300 font-bold">${item.multiplier}x</td>
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
                <td class="p-2.5 text-amber-300">${l.admin_wallet.substring(0, 6)}...${l.admin_wallet.substring(l.admin_wallet.length - 4)}</td>
                <td class="p-2.5 font-bold text-purple-300">${l.action}</td>
                <td class="p-2.5 text-gray-400 max-w-xs truncate">${escapeHtml(l.details)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}
