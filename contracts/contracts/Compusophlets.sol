// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title Compusophlets
 * @notice ERC1155 NFT contract for compusophlets - computational philosophlets
 * @dev One creation per address, anyone can collect copies, mint fee required
 */
contract Compusophlets is ERC1155, ERC1155Supply, Ownable, Pausable, EIP712 {
    using ECDSA for bytes32;

    // Contract metadata for OpenSea/marketplaces
    string public constant name = "compusophlets";
    string public constant symbol = "CMPS";

    // Contract name for EIP-712
    string public constant NAME = "Compusophlets";
    string public constant VERSION = "1";

    // Trusted signer (server wallet that authorizes mints)
    address public trustedSigner;

    // Fee configuration
    uint256 public mintFee = 0.0003 ether;
    address public feeRecipient;

    // Token ID counter
    uint256 private _nextTokenId;

    // Mapping from token ID to creator address
    mapping(uint256 => address) public tokenCreators;

    // Mapping from token ID to metadata URI
    mapping(uint256 => string) public tokenURIs;

    // Mapping from creator address to their token ID (one per address)
    mapping(address => uint256) public creatorTokenId;

    // Nonces for replay protection (address => nonce)
    mapping(address => uint256) public nonces;

    // Mapping to track if an address has collected a specific token (one collect per token per address)
    mapping(uint256 => mapping(address => bool)) public hasCollected;

    // EIP-712 type hash for mint authorization
    bytes32 public constant MINT_TYPEHASH = keccak256(
        "MintAuthorization(address minter,uint256 tokenId,string uri,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    // Events
    event CompusophletCreated(
        uint256 indexed tokenId,
        address indexed creator,
        string uri
    );
    
    event CompusophletCollected(
        uint256 indexed tokenId,
        address indexed collector,
        uint256 amount
    );

    event MintFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event TrustedSignerUpdated(address oldSigner, address newSigner);
    event FeesWithdrawn(address to, uint256 amount);

    error InvalidSignature();
    error SignatureExpired();
    error ZeroAddress();
    error TokenNotCreated();
    error AlreadyCreated();
    error AlreadyCollected();
    error InsufficientFee();
    error WithdrawFailed();

    constructor(
        address _trustedSigner,
        address _feeRecipient
    ) ERC1155("") EIP712(NAME, VERSION) Ownable(msg.sender) {
        if (_trustedSigner == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        trustedSigner = _trustedSigner;
        feeRecipient = _feeRecipient;
        _nextTokenId = 1; // Start from 1
    }

    /**
     * @notice Mint a new compusophlet or collect copies with server authorization
     * @param tokenId Token ID to mint (0 for new creation, existing ID for collecting)
     * @param _uri Metadata URI (only used for new creations)
     * @param amount Number of tokens to mint
     * @param deadline Signature expiration timestamp
     * @param signature Server's EIP-712 signature
     */
    function mintWithSignature(
        uint256 tokenId,
        string calldata _uri,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external payable whenNotPaused {
        // Check fee
        if (msg.value < mintFee) revert InsufficientFee();
        
        // Check deadline
        if (block.timestamp > deadline) revert SignatureExpired();

        // Get current nonce and increment
        uint256 currentNonce = nonces[msg.sender];
        nonces[msg.sender] = currentNonce + 1;

        // Determine actual token ID
        uint256 actualTokenId;
        bool isNewCreation = (tokenId == 0);
        
        if (isNewCreation) {
            // Check one-creation-per-address
            if (creatorTokenId[msg.sender] != 0) revert AlreadyCreated();
            
            actualTokenId = _nextTokenId;
            _nextTokenId++;
        } else {
            actualTokenId = tokenId;
            // Verify token exists for collecting
            if (tokenCreators[actualTokenId] == address(0)) revert TokenNotCreated();
            // Check one-collect-per-token-per-address
            if (hasCollected[actualTokenId][msg.sender]) revert AlreadyCollected();
        }

        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            MINT_TYPEHASH,
            msg.sender,
            tokenId, // Use original tokenId (0 for new) in signature
            keccak256(bytes(_uri)),
            amount,
            currentNonce,
            deadline
        ));

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);
        
        if (signer != trustedSigner) revert InvalidSignature();

        // For new creations, store creator info
        if (isNewCreation) {
            tokenCreators[actualTokenId] = msg.sender;
            tokenURIs[actualTokenId] = _uri;
            creatorTokenId[msg.sender] = actualTokenId;
            
            emit CompusophletCreated(actualTokenId, msg.sender, _uri);
        }

        // Mark as collected
        hasCollected[actualTokenId][msg.sender] = true;

        // Mint the tokens
        _mint(msg.sender, actualTokenId, amount, "");
        
        emit CompusophletCollected(actualTokenId, msg.sender, amount);

        // Transfer fee to recipient
        (bool success, ) = payable(feeRecipient).call{value: msg.value}("");
        if (!success) revert WithdrawFailed();
    }

    /**
     * @notice Get the URI for a token
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenUri = tokenURIs[tokenId];
        if (bytes(tokenUri).length == 0) {
            return super.uri(tokenId);
        }
        return tokenUri;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the mint fee
     */
    function setMintFee(uint256 _fee) external onlyOwner {
        uint256 oldFee = mintFee;
        mintFee = _fee;
        emit MintFeeUpdated(oldFee, _fee);
    }

    /**
     * @notice Update the fee recipient
     */
    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        address oldRecipient = feeRecipient;
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(oldRecipient, _recipient);
    }

    /**
     * @notice Update the trusted signer
     */
    function setTrustedSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        address oldSigner = trustedSigner;
        trustedSigner = _signer;
        emit TrustedSignerUpdated(oldSigner, _signer);
    }

    /**
     * @notice Update a token's metadata URI
     * @param tokenId The token ID to update
     * @param _uri The new metadata URI
     */
    function setTokenURI(uint256 tokenId, string calldata _uri) external onlyOwner {
        if (tokenCreators[tokenId] == address(0)) revert TokenNotCreated();
        tokenURIs[tokenId] = _uri;
        emit URI(_uri, tokenId);
    }

    /**
     * @notice Batch update multiple token URIs
     * @param tokenIds Array of token IDs to update
     * @param uris Array of new URIs (must match tokenIds length)
     */
    function setTokenURIBatch(uint256[] calldata tokenIds, string[] calldata uris) external onlyOwner {
        require(tokenIds.length == uris.length, "Length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenCreators[tokenIds[i]] == address(0)) revert TokenNotCreated();
            tokenURIs[tokenIds[i]] = uris[i];
            emit URI(uris[i], tokenIds[i]);
        }
    }

    /**
     * @notice Pause minting
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause minting
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraw any ETH stuck in contract (emergency)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        if (!success) revert WithdrawFailed();
        emit FeesWithdrawn(owner(), balance);
    }

    /**
     * @notice Get the next token ID
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

    /**
     * @notice Check if an address has already created a compusophlet
     */
    function hasCreated(address account) external view returns (bool) {
        return creatorTokenId[account] != 0;
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
