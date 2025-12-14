import io
import os
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import httpx
from rembg import remove
from generator import generate_spiral_art
from pinata import upload_image_to_ipfs, upload_metadata_to_ipfs, ipfs_uri
from signer import create_mint_signature, get_signer_address

app = FastAPI(title="compusophlets API")

# CORS - allow our frontend
ALLOWED_ORIGINS = [
    "https://compusophlets.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    pfp_url: str
    fid: int | None = None
    remove_background: bool = True
    size: int = 1024


class GenerateResponse(BaseModel):
    success: bool
    image_base64: str | None = None
    error: str | None = None


class MintPrepareRequest(BaseModel):
    image_base64: str  # The generated artwork (data:image/png;base64,...)
    creator_address: str  # Wallet address of the creator
    nonce: int  # Current nonce from contract
    token_id: int = 0  # 0 for new creation, or existing token ID for collecting


class MintPrepareResponse(BaseModel):
    success: bool
    token_id: int | None = None  # 0 for new artwork
    metadata_uri: str | None = None  # ipfs://...
    signature: str | None = None  # EIP-712 signature
    deadline: int | None = None  # Signature expiration
    nonce: int | None = None
    contract_address: str | None = None
    chain_id: int | None = None
    error: str | None = None


@app.get("/")
async def root():
    return {"status": "ok", "service": "compusophlets API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """
    Generate spiral artwork from a PFP image.
    
    1. Download the PFP from URL
    2. Remove background (optional)
    3. Generate Fibonacci spiral artwork
    4. Return as base64
    """
    try:
        print(f"Generating for FID: {request.fid}, URL: {request.pfp_url[:50]}...")
        
        # Step 1: Download the image
        async with httpx.AsyncClient() as client:
            response = await client.get(request.pfp_url, timeout=10.0)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to download PFP")
            image_data = response.content
        
        print(f"Downloaded image: {len(image_data)} bytes")
        
        # Step 2: Remove background (optional)
        if request.remove_background:
            print("Removing background...")
            image_data = remove(image_data)
            print(f"Background removed: {len(image_data)} bytes")
        
        # Step 3: Generate spiral artwork
        print(f"Generating spiral art at {request.size}x{request.size}...")
        result_image = generate_spiral_art(image_data, size=request.size)
        
        # Step 4: Convert to base64
        buffer = io.BytesIO()
        result_image.save(buffer, format="PNG")
        image_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
        print(f"Generated image: {len(image_base64)} chars base64")
        
        return GenerateResponse(
            success=True,
            image_base64=f"data:image/png;base64,{image_base64}"
        )
        
    except Exception as e:
        print(f"Error: {e}")
        return GenerateResponse(
            success=False,
            error=str(e)
        )


@app.post("/api/generate/image")
async def generate_image(request: GenerateRequest):
    """
    Same as /api/generate but returns the image directly instead of base64.
    """
    try:
        # Download
        async with httpx.AsyncClient() as client:
            response = await client.get(request.pfp_url, timeout=10.0)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to download PFP")
            image_data = response.content
        
        # Remove background
        if request.remove_background:
            image_data = remove(image_data)
        
        # Generate
        result_image = generate_spiral_art(image_data, size=request.size)
        
        # Return as PNG
        buffer = io.BytesIO()
        result_image.save(buffer, format="PNG")
        buffer.seek(0)
        
        return Response(content=buffer.getvalue(), media_type="image/png")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mint/prepare", response_model=MintPrepareResponse)
async def mint_prepare(request: MintPrepareRequest):
    """
    Prepare a mint transaction by uploading to IPFS and creating signature.
    
    For new creations (token_id=0):
    1. Decode base64 image
    2. Upload image to IPFS via Pinata
    3. Create and upload metadata JSON to IPFS
    4. Generate EIP-712 signature
    
    For collecting existing (token_id>0):
    1. Generate EIP-712 signature (no IPFS upload needed)
    """
    try:
        print(f"Preparing mint for address: {request.creator_address}, token_id: {request.token_id}")
        
        is_new_creation = request.token_id == 0
        metadata_uri = ""
        
        if is_new_creation:
            # Step 1: Decode base64 image
            image_data = request.image_base64
            if image_data.startswith("data:"):
                image_data = image_data.split(",", 1)[1]
            image_bytes = base64.b64decode(image_data)
            print(f"Decoded image: {len(image_bytes)} bytes")
            
            # Step 2: Upload image to IPFS
            print("Uploading image to IPFS...")
            image_cid = await upload_image_to_ipfs(
                image_bytes,
                filename=f"compusophlet-{request.creator_address[:8]}.png"
            )
            print(f"Image uploaded: {image_cid}")
            
            # Step 3: Create and upload metadata
            # Note: We use a placeholder for token_id since we don't know it yet
            # The actual token_id is assigned on-chain
            print("Uploading metadata to IPFS...")
            metadata_cid = await upload_metadata_to_ipfs(
                image_cid=image_cid,
                token_id=0,  # Placeholder, will be "compusophlet #0" but that's OK
            )
            metadata_uri = ipfs_uri(metadata_cid)
            print(f"Metadata uploaded: {metadata_uri}")
        
        # Step 4: Generate signature
        print("Creating mint signature...")
        sig_result = create_mint_signature(
            minter_address=request.creator_address,
            token_id=request.token_id,
            uri=metadata_uri,
            amount=1,
            nonce=request.nonce,
        )
        print(f"Signature created, deadline: {sig_result['deadline']}")
        
        # Get contract info from env
        contract_address = os.environ.get("CONTRACT_ADDRESS", "")
        chain_id = int(os.environ.get("CHAIN_ID", "8453"))
        
        return MintPrepareResponse(
            success=True,
            token_id=request.token_id,
            metadata_uri=metadata_uri if metadata_uri else None,
            signature=sig_result["signature"],
            deadline=sig_result["deadline"],
            nonce=request.nonce,
            contract_address=contract_address,
            chain_id=chain_id,
        )
        
    except Exception as e:
        print(f"Mint prepare error: {e}")
        return MintPrepareResponse(
            success=False,
            error=str(e)
        )


@app.get("/api/contract-info")
async def contract_info():
    """Get contract deployment info for frontend"""
    try:
        return {
            "contract_address": os.environ.get("CONTRACT_ADDRESS", ""),
            "chain_id": int(os.environ.get("CHAIN_ID", "8453")),
            "signer_address": get_signer_address() if os.environ.get("SIGNER_PRIVATE_KEY") else None,
        }
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
