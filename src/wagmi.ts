import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

// Always use Base mainnet
export const config = createConfig({
  chains: [base],
  connectors: [
    farcasterMiniApp(),
  ],
  transports: {
    [base.id]: http(),
  },
});

// Contract ABI for GenerativePFP (only the functions we need)
export const GENERATIVE_PFP_ABI = [
  {
    name: 'mintWithSignature',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'uri', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'fid', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokenCreators',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'uri',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

// API URL
export const API_URL = import.meta.env.PROD 
  ? 'https://gnpfp-server-production.up.railway.app'
  : 'http://localhost:8000';

// Contract address on Base mainnet
export const CONTRACT_ADDRESS = '0x6cA7C6542C0F4E6e7ACBb4eaE9242DD424781076';

// Chain ID - Base mainnet
export const CHAIN_ID = base.id;
