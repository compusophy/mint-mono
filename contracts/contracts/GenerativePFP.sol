// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title GenerativePFP
 * @notice ERC1155 NFT contract for Generative PFP artworks
 * @dev Uses EIP-712 signatures for authorized minting
 */
contract GenerativePFP is ERC1155, ERC1155Supply, Ownable, EIP712 {
    using ECDSA for bytes32;

    // Contract name for EIP-712
    string public constant NAME = "GenerativePFP";
    string public constant VERSION = "1";

    // Trusted signer (server wallet that authorizes mints)
    address public trustedSigner;

    // Token ID counter
    uint256 private _nextTokenId;

    // Mapping from token ID to creator address
    mapping(uint256 => address) public tokenCreators;

    // Mapping from token ID to metadata URI
    mapping(uint256 => string) public tokenURIs;

    // Mapping from token ID to Farcaster FID of creator
    mapping(uint256 => uint256) public tokenFids;

    // Nonces for replay protection (address => nonce)
    mapping(address => uint256) public nonces;

    // EIP-712 type hash for mint authorization
    bytes32 public constant MINT_TYPEHASH = keccak256(
        "MintAuthorization(address minter,uint256 tokenId,string uri,uint256 amount,uint256 fid,uint256 nonce,uint256 deadline)"
    );

    // Events
    event ArtworkCreated(
        uint256 indexed tokenId,
        address indexed creator,
        uint256 indexed fid,
        string uri
    );
    
    event ArtworkMinted(
        uint256 indexed tokenId,
        address indexed minter,
        uint256 amount
    );

    event TrustedSignerUpdated(address indexed oldSigner, address indexed newSigner);

    error InvalidSignature();
    error SignatureExpired();
    error InvalidNonce();
    error ZeroAddress();
    error TokenNotCreated();

    constructor(
        address _trustedSigner
    ) ERC1155("") EIP712(NAME, VERSION) Ownable(msg.sender) {
        if (_trustedSigner == address(0)) revert ZeroAddress();
        trustedSigner = _trustedSigner;
        _nextTokenId = 1; // Start from 1
    }

    /**
     * @notice Mint a new artwork or additional copies with server authorization
     * @param tokenId Token ID to mint (0 for new artwork, existing ID for copies)
     * @param uri Metadata URI (only used for new artworks)
     * @param amount Number of tokens to mint
     * @param fid Farcaster FID of the creator (only used for new artworks)
     * @param deadline Signature expiration timestamp
     * @param signature Server's EIP-712 signature
     */
    function mintWithSignature(
        uint256 tokenId,
        string calldata uri,
        uint256 amount,
        uint256 fid,
        uint256 deadline,
        bytes calldata signature
    ) external {
        // Check deadline
        if (block.timestamp > deadline) revert SignatureExpired();

        // Get current nonce and increment
        uint256 currentNonce = nonces[msg.sender];
        nonces[msg.sender] = currentNonce + 1;

        // Determine actual token ID
        uint256 actualTokenId;
        bool isNewArtwork = (tokenId == 0);
        
        if (isNewArtwork) {
            actualTokenId = _nextTokenId;
            _nextTokenId++;
        } else {
            actualTokenId = tokenId;
            // Verify token exists for minting copies
            if (tokenCreators[actualTokenId] == address(0)) revert TokenNotCreated();
        }

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            MINT_TYPEHASH,
            msg.sender,
            tokenId, // Use original tokenId (0 for new) in signature
            keccak256(bytes(uri)),
            amount,
            fid,
            currentNonce,
            deadline
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);
        
        if (signer != trustedSigner) revert InvalidSignature();

        // For new artworks, store creator info
        if (isNewArtwork) {
            tokenCreators[actualTokenId] = msg.sender;
            tokenURIs[actualTokenId] = uri;
            tokenFids[actualTokenId] = fid;
            
            emit ArtworkCreated(actualTokenId, msg.sender, fid, uri);
        }

        // Mint the tokens
        _mint(msg.sender, actualTokenId, amount, "");
        
        emit ArtworkMinted(actualTokenId, msg.sender, amount);
    }

    /**
     * @notice Get the URI for a token
     * @param tokenId The token ID
     * @return The metadata URI
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenUri = tokenURIs[tokenId];
        if (bytes(tokenUri).length == 0) {
            return super.uri(tokenId);
        }
        return tokenUri;
    }

    /**
     * @notice Update the trusted signer address
     * @param newSigner New signer address
     */
    function setTrustedSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        address oldSigner = trustedSigner;
        trustedSigner = newSigner;
        emit TrustedSignerUpdated(oldSigner, newSigner);
    }

    /**
     * @notice Get the next token ID that will be minted
     */
    function getNextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @notice Get the domain separator for EIP-712
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // Required overrides
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
