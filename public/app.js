// public/app.js - Attestto DAO Governance Front-end Client

let userWallet = null;
let isUserAdmin = false;
let currentProposalId = null;
let currentProposalsData = [];
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

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    await fetchDaoConfig();
    await loadProposals();
    await loadAnalytics();

    // Auto-check if Phantom/Solana wallet is connected
    if (window.solana && window.solana.isPhantom && window.solana.isConnected) {
        try {
            userWallet = window.solana.publicKey.toString();
            updateWalletUI();
        } catch (e) {}
    }

    // Check hash URL for #admin
    if (window.location.hash === '#admin') {
        switchTab('admin');
    }
});

// Fetch DAO Public Configuration
async function fetchDaoConfig() {
    try {
        const url = userWallet ? `/api/config?wallet=${userWallet}` : '/api/config';
        const res = await fetch(url);
        daoConfig = await res.json();

        // Update Nav & Main Titles
        if (daoConfig.dao_name) {
            document.getElementById('daoTitleNav').textContent = daoConfig.dao_name.toUpperCase();
            document.getElementById('daoMainTitle').textContent = daoConfig.dao_name;
        }
        if (daoConfig.dao_description) {
            document.getElementById('daoSubTitle').textContent = daoConfig.dao_description;
            document.getElementById('cfgDaoDesc').value = daoConfig.dao_description;
        }

        if (daoConfig.dao_name) document.getElementById('cfgDaoName').value = daoConfig.dao_name;
        if (daoConfig.quorum_percentage) document.getElementById('cfgQuorum').value = daoConfig.quorum_percentage;
        if (daoConfig.announcement_banner) {
            document.getElementById('cfgBanner').value = daoConfig.announcement_banner;
            document.getElementById('announcementText').textContent = daoConfig.announcement_banner;
            document.getElementById('announcementBanner').classList.remove('hidden');
        } else {
            document.getElementById('announcementBanner').classList.add('hidden');
        }

        if (daoConfig.link_twitter) {
            document.getElementById('cfgTwitter').value = daoConfig.link_twitter;
            document.getElementById('footerTwitter').href = daoConfig.link_twitter;
        }
        if (daoConfig.link_github) {
            document.getElementById('cfgGithub').value = daoConfig.link_github;
            document.getElementById('footerGithub').href = daoConfig.link_github;
        }
        if (daoConfig.link_docs) {
            document.getElementById('cfgDocs').value = daoConfig.link_docs;
            document.getElementById('footerDocs').href = daoConfig.link_docs;
        }

        document.getElementById('cfgMaintenance').checked = !!daoConfig.maintenance_mode;

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
        updateWalletUI();
        await fetchDaoConfig();
        await loadProposals();
    } catch (err) {
        console.error("Wallet connection error:", err);
        showToast("Wallet connection cancelled.", "error");
    }
}

function disconnectWallet() {
    userWallet = null;
    isUserAdmin = false;
    document.getElementById('connectBtn').classList.remove('hidden');
    document.getElementById('walletInfoContainer').classList.add('hidden');
    document.getElementById('adminBadge').classList.add('hidden');
    document.getElementById('tabBtnAdmin').classList.add('hidden');
    showToast("Wallet disconnected.", "info");
    loadProposals();
}

function updateWalletUI() {
    if (!userWallet) return;
    document.getElementById('connectBtn').classList.add('hidden');
    document.getElementById('walletInfoContainer').classList.remove('hidden');
    const shortAddr = `${userWallet.substring(0, 4)}...${userWallet.substring(userWallet.length - 4)}`;
    document.getElementById('walletAddressText').textContent = shortAddr;
}

function updateAdminViewAccess() {
    if (isUserAdmin && userWallet) {
        document.getElementById('adminBadge').classList.remove('hidden');
        document.getElementById('tabBtnAdmin').classList.remove('hidden');
        document.getElementById('adminWalletDisplay').textContent = `${userWallet.substring(0, 6)}...${userWallet.substring(userWallet.length - 4)}`;
    } else {
        document.getElementById('adminBadge').classList.add('hidden');
        document.getElementById('tabBtnAdmin').classList.add('hidden');
    }
}

// Navigation Tabs Switcher
function switchTab(tabName) {
    const tabs = ['proposals', 'analytics', 'admin'];
    tabs.forEach(t => {
        const viewEl = document.getElementById(`view${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const btnEl = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        
        if (t === tabName) {
            viewEl.classList.remove('hidden');
            if (t !== 'admin') {
                btnEl.className = 'tab-btn px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all bg-purple-600 text-white shadow-md';
            }
        } else {
            viewEl.classList.add('hidden');
            if (t !== 'admin') {
                btnEl.className = 'tab-btn px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all text-gray-400 hover:text-white';
            }
        }
    });

    if (tabName === 'analytics') loadAnalytics();
    if (tabName === 'admin') loadAdminData();
}

// Load Proposals from API
async function loadProposals() {
    const loading = document.getElementById('proposalsLoading');
    const grid = document.getElementById('proposalsGrid');
    const empty = document.getElementById('emptyState');

    loading.classList.remove('hidden');
    grid.innerHTML = '';
    empty.classList.add('hidden');

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

        loading.classList.add('hidden');

        if (!currentProposalsData || currentProposalsData.length === 0) {
            empty.classList.remove('hidden');
            return;
        }

        renderProposalsGrid(currentProposalsData);
    } catch (err) {
        console.error("Proposals fetch error:", err);
        loading.classList.add('hidden');
        showToast("Error loading proposals", "error");
    }
}

function applyFilters() {
    loadProposals();
}

function renderProposalsGrid(proposals) {
    const grid = document.getElementById('proposalsGrid');
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

        // Admin controls overlay if admin is connected
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

// Proposal Vote Modal Operations
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
    const subTabs = ['general', 'create', 'proposals', 'admins', 'whitelist', 'audit'];
    subTabs.forEach(st => {
        const panel = document.getElementById(`adminPanel${st.charAt(0).toUpperCase() + st.slice(1)}`);
        const btn = document.getElementById(`subTab${st.charAt(0).toUpperCase() + st.slice(1)}`);
        if (st === subTabName) {
            panel.classList.remove('hidden');
            btn.className = 'admin-subtab px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40';
        } else {
            panel.classList.add('hidden');
            btn.className = 'admin-subtab px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-gray-400 hover:text-white';
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

// Save DAO Settings
async function saveDaoConfig() {
    const configs = {
        dao_name: document.getElementById('cfgDaoName').value.trim(),
        dao_description: document.getElementById('cfgDaoDesc').value.trim(),
        quorum_percentage: document.getElementById('cfgQuorum').value,
        announcement_banner: document.getElementById('cfgBanner').value.trim(),
        link_twitter: document.getElementById('cfgTwitter').value.trim(),
        link_github: document.getElementById('cfgGithub').value.trim(),
        link_docs: document.getElementById('cfgDocs').value.trim(),
        maintenance_mode: document.getElementById('cfgMaintenance').checked ? 'true' : 'false'
    };

    await sendAdminAction('update_config', { configs });
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
    tbody.innerHTML = '';
    if (res && Array.isArray(res)) {
        res.forEach(item => {
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
    const logs = await sendAdminAction('get_audit_logs');
    const tbody = document.getElementById('auditLogTable');
    tbody.innerHTML = '';
    if (logs && Array.isArray(logs)) {
        logs.forEach(l => {
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
