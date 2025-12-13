"""
EIP-712 signing for NFT mint authorization
"""

import os
import time
from eth_account import Account
from eth_account.messages import encode_typed_data


# EIP-712 domain for GenerativePFP contract
DOMAIN_NAME = "GenerativePFP"
DOMAIN_VERSION = "1"

# Default chain ID (Base mainnet = 8453, Base Sepolia = 84532)
DEFAULT_CHAIN_ID = 8453  # Base mainnet


def get_signer_account():
    """Get the server's signing account from environment"""
    private_key = os.environ.get("SIGNER_PRIVATE_KEY")
    if not private_key:
        raise ValueError("SIGNER_PRIVATE_KEY must be set")
    
    # Add 0x prefix if missing
    if not private_key.startswith("0x"):
        private_key = f"0x{private_key}"
    
    return Account.from_key(private_key)


def get_contract_address() -> str:
    """Get the deployed contract address from environment"""
    address = os.environ.get("CONTRACT_ADDRESS")
    if not address:
        raise ValueError("CONTRACT_ADDRESS must be set")
    return address


def get_chain_id() -> int:
    """Get the chain ID from environment"""
    chain_id = os.environ.get("CHAIN_ID")
    if chain_id:
        return int(chain_id)
    return DEFAULT_CHAIN_ID


def create_mint_signature(
    minter_address: str,
    token_id: int,
    uri: str,
    amount: int,
    fid: int,
    nonce: int,
    deadline: int | None = None,
) -> dict:
    """
    Create an EIP-712 signature authorizing a mint
    
    Args:
        minter_address: Address that will call mint
        token_id: Token ID to mint (0 for new artwork)
        uri: Metadata URI
        amount: Number of tokens to mint
        fid: Farcaster FID
        nonce: User's current nonce from contract
        deadline: Signature expiration timestamp (default: 1 hour from now)
    
    Returns:
        Dict with signature, deadline, and other params
    """
    account = get_signer_account()
    contract_address = get_contract_address()
    chain_id = get_chain_id()
    
    if deadline is None:
        deadline = int(time.time()) + 3600  # 1 hour from now
    
    # EIP-712 typed data
    typed_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "MintAuthorization": [
                {"name": "minter", "type": "address"},
                {"name": "tokenId", "type": "uint256"},
                {"name": "uri", "type": "string"},
                {"name": "amount", "type": "uint256"},
                {"name": "fid", "type": "uint256"},
                {"name": "nonce", "type": "uint256"},
                {"name": "deadline", "type": "uint256"},
            ],
        },
        "primaryType": "MintAuthorization",
        "domain": {
            "name": DOMAIN_NAME,
            "version": DOMAIN_VERSION,
            "chainId": chain_id,
            "verifyingContract": contract_address,
        },
        "message": {
            "minter": minter_address,
            "tokenId": token_id,
            "uri": uri,
            "amount": amount,
            "fid": fid,
            "nonce": nonce,
            "deadline": deadline,
        },
    }
    
    # Sign the typed data
    signable_message = encode_typed_data(full_message=typed_data)
    signed = account.sign_message(signable_message)
    
    return {
        "signature": signed.signature.hex(),
        "deadline": deadline,
        "token_id": token_id,
        "nonce": nonce,
        "signer": account.address,
    }


def get_signer_address() -> str:
    """Get the server signer's address (for contract verification)"""
    account = get_signer_account()
    return account.address
