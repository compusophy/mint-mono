"""
Pinata IPFS upload helpers for NFT metadata
"""

import os
import json
import httpx
from typing import Optional

PINATA_API_URL = "https://api.pinata.cloud"
PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs"


def get_pinata_headers() -> dict:
    """Get headers for Pinata API authentication"""
    api_key = os.environ.get("PINATA_API_KEY")
    api_secret = os.environ.get("PINATA_SECRET_KEY")
    
    if not api_key or not api_secret:
        raise ValueError("PINATA_API_KEY and PINATA_SECRET_KEY must be set")
    
    return {
        "pinata_api_key": api_key,
        "pinata_secret_api_key": api_secret,
    }


async def upload_image_to_ipfs(image_data: bytes, filename: str = "artwork.png") -> str:
    """
    Upload an image to IPFS via Pinata
    
    Args:
        image_data: Raw image bytes
        filename: Name for the file
    
    Returns:
        IPFS CID (content identifier)
    """
    headers = get_pinata_headers()
    
    async with httpx.AsyncClient() as client:
        # Pinata pinFileToIPFS endpoint
        files = {
            "file": (filename, image_data, "image/png"),
        }
        
        # Optional: add metadata
        pinata_metadata = json.dumps({
            "name": filename,
        })
        
        response = await client.post(
            f"{PINATA_API_URL}/pinning/pinFileToIPFS",
            headers=headers,
            files=files,
            data={"pinataMetadata": pinata_metadata},
            timeout=60.0,
        )
        
        if response.status_code != 200:
            raise Exception(f"Pinata upload failed: {response.text}")
        
        result = response.json()
        return result["IpfsHash"]


async def upload_metadata_to_ipfs(
    image_cid: str,
    token_id: int,
) -> str:
    """
    Upload NFT metadata JSON to IPFS via Pinata
    
    Args:
        image_cid: IPFS CID of the image
        token_id: Token ID for the compusophlet
    
    Returns:
        IPFS CID of the metadata JSON
    """
    headers = get_pinata_headers()
    headers["Content-Type"] = "application/json"
    
    # Build metadata following ERC-1155 metadata standard
    metadata = {
        "name": f"compusophlet #{token_id}",
        "description": "a unique compusophlet - computational philosophlets",
        "image": f"ipfs://{image_cid}",
        "external_url": f"https://compusophlets.vercel.app/?token={token_id}",
    }
    
    # Pin JSON to IPFS
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{PINATA_API_URL}/pinning/pinJSONToIPFS",
            headers=headers,
            json={
                "pinataContent": metadata,
                "pinataMetadata": {
                    "name": f"compusophlet-{token_id}-metadata.json",
                },
            },
            timeout=30.0,
        )
        
        if response.status_code != 200:
            raise Exception(f"Pinata metadata upload failed: {response.text}")
        
        result = response.json()
        return result["IpfsHash"]


def ipfs_to_http_url(cid: str) -> str:
    """Convert IPFS CID to HTTP gateway URL"""
    return f"{PINATA_GATEWAY}/{cid}"


def ipfs_uri(cid: str) -> str:
    """Convert CID to ipfs:// URI"""
    return f"ipfs://{cid}"
