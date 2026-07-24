// public/app.js
let userWallet = null;
let currentProposalId = null;

// Utilidad para convertir firma Uint8Array a Base58
function toBase58(buffer) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let base = BigInt(0);
    for (let i = 0; i < buffer.length; i++) base = (base * 256n) + BigInt(buffer[i]);
    let str = '';
    while (base > 0n) { str = ALPHABET[Number(base % 58n)] + str; base /= 58n; }
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) str = '1' + str;
    return str;
}

async function connectWallet() {
    const provider = window.solana;
    if (!provider) return alert("Phantom Wallet required.");
    try {
        const resp = await provider.connect();
        userWallet = resp.publicKey.toString();
        document.getElementById('connectBtn').classList.add('hidden');
        document.getElementById('walletInfo').classList.remove('hidden');
        document.getElementById('walletInfo').textContent = `${userWallet.substring(0, 4)}...${userWallet.substring(userWallet.length - 4)}`;
        loadProposals();
    } catch (err) { console.error(err); }
}

document.getElementById('connectBtn').addEventListener('click', connectWallet);

async function loadProposals() {
    const res = await fetch('/api/proposals');
    const proposals = await res.json();
    const grid = document.getElementById('proposalsGrid');
    grid.innerHTML = '';
    proposals.forEach(p => {
        const card = document.createElement('div');
        card.className = 'glass-card p-8 rounded-xl flex flex-col justify-between h-full';
        card.innerHTML = `
            <div>
                <h3 class="text-2xl font-bold mb-3 text-white">${p.title}</h3>
                <p class="text-gray-400 text-sm mb-6">${p.description}</p>
                <div class="w-full bg-[#08070b] rounded-full h-2 mb-2">
                    <div class="bg-[#8b5cf6] h-2 rounded-full" style="width: ${p.yes_percentage}%"></div>
                </div>
                <div class="text-xs text-gray-500 text-right">Approval: ${p.yes_percentage.toFixed(1)}%</div>
            </div>
            <button onclick="openVoteModal(${p.id}, '${p.title.replace(/'/g, "\'")}', '${p.description.replace(/'/g, "\'")}')" 
                class="w-full mt-6 py-3 bg-[#1d172e] hover:bg-[#2e2347] border border-[#3d2b5e] rounded-lg text-white">
                Initialize Vote
            </button>`;
        grid.appendChild(card);
    });
}

window.openVoteModal = (id, title, desc) => {
    if (!userWallet) return alert("Connect wallet first.");
    currentProposalId = id;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalDesc').textContent = desc;
    document.getElementById('voteModal').classList.remove('hidden');
    document.getElementById('voteModal').classList.add('flex');
};

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('voteModal').classList.add('hidden');
    document.getElementById('voteModal').classList.remove('flex');
});

window.submitVote = async (choice) => {
    const provider = window.solana;
    const timestamp = Date.now();
    const message = `Attestto Official Vote | Proposal: ${currentProposalId} | Choice: ${choice} | Ts: ${timestamp}`;
    try {
        const { signature } = await provider.signMessage(new TextEncoder().encode(message), "utf8");
        const res = await fetch('/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                proposalId: currentProposalId,
                wallet: userWallet,
                signature: toBase58(signature),
                choice: choice,
                timestamp: timestamp
            })
        });
        const data = await res.json();
        if (data.success) {
            alert("Vote recorded successfully.");
            document.getElementById('voteModal').classList.add('hidden');
            loadProposals();
        } else { alert("Error: " + data.error); }
    } catch (err) { alert("Signing failed."); }
};

loadProposals();
