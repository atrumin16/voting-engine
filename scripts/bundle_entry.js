const solanaWeb3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');

if (typeof window !== 'undefined') {
  window.solanaWeb3 = solanaWeb3;
  window.splToken = splToken;
  console.log('✅ Solana Web3 & SPL Token Bundle loaded successfully on window!');
}
