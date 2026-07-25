import * as solanaWeb3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';

if (typeof window !== 'undefined') {
  window.solanaWeb3 = solanaWeb3;
  window.splToken = splToken;
}
