# Generative PFP Server

FastAPI server for background removal and Fibonacci spiral art generation.

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run server
python main.py
# or
uvicorn main:app --reload --port 8000
```

## API Endpoints

### GET /
Health check, returns service info.

### GET /health
Health check for Railway.

### POST /api/generate
Generate spiral artwork and return as base64.

**Request:**
```json
{
  "pfp_url": "https://example.com/pfp.png",
  "fid": 12345,
  "remove_background": true,
  "size": 1024
}
```

**Response:**
```json
{
  "success": true,
  "image_base64": "data:image/png;base64,..."
}
```

### POST /api/generate/image
Same as above but returns the PNG image directly.

### POST /api/mint/prepare
Prepare an NFT mint by uploading to IPFS and generating authorization signature.

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
  "nonce": 0,
  "contract_address": "0x...",
  "chain_id": 84532
}
```

### GET /api/contract-info
Get deployed contract info for frontend.

## Deploy to Railway

1. Push this `server/` folder to a Git repo
2. Connect to Railway
3. Railway will auto-detect the Dockerfile
4. Deploy!

## Environment Variables

Required for NFT minting:

```bash
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
SIGNER_PRIVATE_KEY=your_server_wallet_private_key
CONTRACT_ADDRESS=0xDeployedContractAddress
CHAIN_ID=84532  # Base Sepolia (use 8453 for mainnet)
```

The `SIGNER_PRIVATE_KEY` must correspond to the trusted signer address set in the smart contract.
