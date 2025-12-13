# compusophlets

computational philosophlets - a Farcaster Mini App where each user creates one unique Fibonacci spiral artwork from their profile picture, mints it as an ERC1155 NFT on Base, and others can collect copies.

## Features

- **One Creation Per Address**: Each wallet creates exactly one compusophlet
- **Collectible**: Anyone can mint copies of any compusophlet (ERC1155)
- **Mint Fee**: 0.0003 ETH per mint (changeable by owner)
- **Pausable**: Owner can pause/unpause minting
- **Shareable**: Each compusophlet has a shareable URL (`?token=1`)
- **Background Removal**: AI-powered background removal using `rembg`
- **Generative Art**: Fibonacci spiral patterns using the user's face

## Architecture

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│     React Frontend          │  POST   │       FastAPI Backend            │
│     (Vercel)                │ ──────► │       (Railway)                  │
│                             │         │                                  │
│  - Farcaster SDK            │         │  1. Download PFP from URL        │
│  - Wagmi + Wallet           │ ◄────── │  2. Remove background (rembg)    │
│  - Mint transactions        │  base64 │  3. Generate spiral art (Pillow) │
│                             │         │  4. Upload to IPFS (Pinata)      │
└─────────────────────────────┘         │  5. Sign mint authorization      │
              │                         └──────────────────────────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Compusophlets Contract     │
│  (Base Mainnet)             │
│                             │
│  - ERC1155 multi-edition    │
│  - Signature-verified mint  │
│  - 0.0003 ETH mint fee      │
│  - One creation per address │
│  - Pausable by owner        │
└─────────────────────────────┘
```

## User Flow

1. **New User**: Connect wallet → Generate artwork → Create (mint first copy)
2. **Returning Creator**: Connect wallet → See your compusophlet → Share link
3. **Collector**: Open shared link → See artwork → Collect (mint copy)

## Tech Stack

### Frontend
- React 18 (TypeScript)
- Vite
- Tailwind CSS
- Wagmi + viem
- @farcaster/miniapp-sdk
- @farcaster/miniapp-wagmi-connector

### Backend
- Python 3.11+
- FastAPI
- rembg (AI background removal)
- Pillow (image processing)
- eth-account (EIP-712 signing)
- httpx (Pinata IPFS uploads)

### Smart Contract
- Solidity 0.8.24
- Hardhat
- OpenZeppelin Contracts v5
- ERC1155 + EIP712 + Pausable + Ownable

## Getting Started

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd server
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
```

### Contracts

```bash
cd contracts
npm install
npm run compile
npm run test
npm run deploy:base  # Prompts for private key
```

## Contract Admin Functions

```solidity
// Changeable without redeploy:
setMintFee(uint256 _fee)        // Change mint fee
setFeeRecipient(address _to)    // Change fee recipient
pause() / unpause()             // Emergency pause
transferOwnership(address)      // Transfer contract ownership
withdrawFees()                  // Withdraw accumulated fees
```

## Environment Variables

### Server (Railway)
```
PINATA_API_KEY
PINATA_SECRET_KEY
SIGNER_PRIVATE_KEY
CONTRACT_ADDRESS
CHAIN_ID=8453
```

## NFT Metadata

Each compusophlet has metadata like:
```json
{
  "name": "compusophlet #1",
  "description": "a unique compusophlet - computational philosophlets",
  "image": "ipfs://...",
  "external_url": "https://compusophlets.vercel.app/?token=1"
}
```

## License

MIT
