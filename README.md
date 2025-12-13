# Generative PFP - Farcaster Mini App

A Farcaster Mini App that takes the user's profile picture, removes the background using AI, generates a Fibonacci-spiral generative art piece, and lets users mint it as an ERC1155 NFT on Base.

## Features

- **Background Removal**: Server-side AI-powered background removal using `rembg`
- **Generative Art**: Creates unique Fibonacci-spiral patterns using the user's face as texture
- **NFT Minting**: Mint your artwork as an ERC1155 NFT on Base
- **Collectible**: Others can mint copies of any artwork (ERC1155 multi-edition)
- **Farcaster Integration**: Wallet connection via Farcaster Mini App + sharing
- **Dev Mode**: Test with any image URL when running outside Farcaster

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
│   ERC1155 Contract (Base)   │
│                             │
│  - Signature-verified mint  │
│  - Multi-edition support    │
│  - Creator tracking         │
└─────────────────────────────┘
```

## Tech Stack

### Frontend
- React 18 (TypeScript)
- Vite
- Tailwind CSS
- Wagmi + viem (wallet/contract interaction)
- @farcaster/miniapp-sdk
- @farcaster/miniapp-wagmi-connector
- lucide-react

### Backend
- Python 3.11+
- FastAPI
- rembg (AI background removal)
- Pillow (image processing)
- eth-account (EIP-712 signing)
- httpx (Pinata IPFS uploads)

### Smart Contracts
- Solidity 0.8.24
- Hardhat
- OpenZeppelin Contracts v5
- ERC1155 with EIP-712 signature minting

## Getting Started

### Frontend Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Backend Development

```bash
cd server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export PINATA_API_KEY=your_key
export PINATA_SECRET_KEY=your_secret
export SIGNER_PRIVATE_KEY=your_private_key
export CONTRACT_ADDRESS=0x...
export CHAIN_ID=84532  # Base Sepolia

# Run server
python main.py
```

### Smart Contract Development

```bash
cd contracts

# Install dependencies
npm install

# Compile
npm run compile

# Run tests
npm run test

# Deploy to Base Sepolia
npm run deploy:sepolia

# Deploy to Base mainnet
npm run deploy:base
```

## API Endpoints

### POST /api/generate
Generate spiral artwork and return as base64.

### POST /api/mint/prepare
Prepare an NFT mint: upload to IPFS and return signature.

**Request:**
```json
{
  "image_base64": "data:image/png;base64,...",
  "fid": 12345,
  "creator_address": "0x...",
  "nonce": 0
}
```

**Response:**
```json
{
  "success": true,
  "token_id": 0,
  "metadata_uri": "ipfs://Qm...",
  "signature": "0x...",
  "deadline": 1702500000,
  "contract_address": "0x...",
  "chain_id": 84532
}
```

### GET /api/contract-info
Get deployed contract info for frontend.

## Environment Variables

### Server (Railway)
```
PINATA_API_KEY        # Pinata API key for IPFS
PINATA_SECRET_KEY     # Pinata secret key
SIGNER_PRIVATE_KEY    # Server wallet private key (for signing)
CONTRACT_ADDRESS      # Deployed contract address
CHAIN_ID              # 84532 (Base Sepolia) or 8453 (Base)
```

### Contracts
```
DEPLOYER_PRIVATE_KEY  # Deployer wallet private key
BASESCAN_API_KEY      # For contract verification
TRUSTED_SIGNER        # Server signer address (must match SIGNER_PRIVATE_KEY)
```

### Frontend
```
VITE_CONTRACT_ADDRESS # Contract address (optional, can be hardcoded)
```

## Project Structure

```
├── contracts/                  # Hardhat smart contract project
│   ├── contracts/
│   │   └── GenerativePFP.sol   # ERC1155 with signature minting
│   ├── scripts/
│   │   └── deploy.ts           # Deployment script
│   ├── test/
│   │   └── GenerativePFP.test.ts
│   ├── hardhat.config.ts
│   └── package.json
├── server/
│   ├── main.py                 # FastAPI server
│   ├── generator.py            # Spiral art generator
│   ├── pinata.py               # IPFS upload helpers
│   ├── signer.py               # EIP-712 signing
│   ├── requirements.txt
│   └── Dockerfile
├── src/
│   ├── main.tsx                # React entry with Wagmi provider
│   ├── App.tsx                 # Main app component
│   ├── wagmi.ts                # Wagmi config + contract ABI
│   └── components/
│       ├── WalletButton.tsx    # Connect/disconnect wallet
│       ├── MintButton.tsx      # Mint NFT flow
│       └── ShareButton.tsx     # Share to Farcaster
├── package.json
└── README.md
```

## Deployment Checklist

1. **Deploy Contract to Base Sepolia**
   ```bash
   cd contracts
   npm run deploy:sepolia
   ```

2. **Update Server Environment**
   - Set `CONTRACT_ADDRESS` to deployed address
   - Set `SIGNER_PRIVATE_KEY` to match contract's trusted signer
   - Set Pinata API keys

3. **Test End-to-End on Testnet**
   - Generate artwork
   - Connect wallet
   - Mint NFT
   - Verify on Basescan

4. **Deploy to Base Mainnet**
   - Update `CHAIN_ID` to 8453
   - Deploy contract to mainnet
   - Update all addresses

## License

MIT
