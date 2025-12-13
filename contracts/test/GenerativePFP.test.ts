import { expect } from "chai";
import { ethers } from "hardhat";
import { GenerativePFP } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("GenerativePFP", function () {
  let contract: GenerativePFP;
  let owner: SignerWithAddress;
  let trustedSigner: SignerWithAddress;
  let minter: SignerWithAddress;
  let other: SignerWithAddress;

  const DOMAIN_NAME = "GenerativePFP";
  const DOMAIN_VERSION = "1";

  // Helper to create EIP-712 signature
  async function createMintSignature(
    signer: SignerWithAddress,
    minterAddress: string,
    tokenId: bigint,
    uri: string,
    amount: bigint,
    fid: bigint,
    nonce: bigint,
    deadline: bigint
  ): Promise<string> {
    const domain = {
      name: DOMAIN_NAME,
      version: DOMAIN_VERSION,
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await contract.getAddress(),
    };

    const types = {
      MintAuthorization: [
        { name: "minter", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "uri", type: "string" },
        { name: "amount", type: "uint256" },
        { name: "fid", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const value = {
      minter: minterAddress,
      tokenId,
      uri,
      amount,
      fid,
      nonce,
      deadline,
    };

    return await signer.signTypedData(domain, types, value);
  }

  beforeEach(async function () {
    [owner, trustedSigner, minter, other] = await ethers.getSigners();

    const GenerativePFP = await ethers.getContractFactory("GenerativePFP");
    contract = await GenerativePFP.deploy(trustedSigner.address);
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct trusted signer", async function () {
      expect(await contract.trustedSigner()).to.equal(trustedSigner.address);
    });

    it("Should set the correct owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Should start with token ID 1", async function () {
      expect(await contract.getNextTokenId()).to.equal(1n);
    });

    it("Should revert if trusted signer is zero address", async function () {
      const GenerativePFP = await ethers.getContractFactory("GenerativePFP");
      await expect(
        GenerativePFP.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });
  });

  describe("Minting new artwork", function () {
    it("Should mint new artwork with valid signature", async function () {
      const uri = "ipfs://QmTest123";
      const amount = 1n;
      const fid = 12345n;
      const nonce = 0n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createMintSignature(
        trustedSigner,
        minter.address,
        0n, // tokenId 0 means new artwork
        uri,
        amount,
        fid,
        nonce,
        deadline
      );

      await expect(
        contract.connect(minter).mintWithSignature(0n, uri, amount, fid, deadline, signature)
      )
        .to.emit(contract, "ArtworkCreated")
        .withArgs(1n, minter.address, fid, uri)
        .and.to.emit(contract, "ArtworkMinted")
        .withArgs(1n, minter.address, amount);

      expect(await contract.balanceOf(minter.address, 1n)).to.equal(1n);
      expect(await contract.tokenCreators(1n)).to.equal(minter.address);
      expect(await contract.uri(1n)).to.equal(uri);
      expect(await contract.tokenFids(1n)).to.equal(fid);
    });

    it("Should increment token ID for each new artwork", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // First mint
      const sig1 = await createMintSignature(
        trustedSigner,
        minter.address,
        0n,
        "ipfs://test1",
        1n,
        100n,
        0n,
        deadline
      );
      await contract.connect(minter).mintWithSignature(0n, "ipfs://test1", 1n, 100n, deadline, sig1);

      // Second mint
      const sig2 = await createMintSignature(
        trustedSigner,
        minter.address,
        0n,
        "ipfs://test2",
        1n,
        100n,
        1n,
        deadline
      );
      await contract.connect(minter).mintWithSignature(0n, "ipfs://test2", 1n, 100n, deadline, sig2);

      expect(await contract.getNextTokenId()).to.equal(3n);
      expect(await contract.balanceOf(minter.address, 1n)).to.equal(1n);
      expect(await contract.balanceOf(minter.address, 2n)).to.equal(1n);
    });
  });

  describe("Minting copies of existing artwork", function () {
    beforeEach(async function () {
      // Create initial artwork
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sig = await createMintSignature(
        trustedSigner,
        minter.address,
        0n,
        "ipfs://original",
        1n,
        100n,
        0n,
        deadline
      );
      await contract.connect(minter).mintWithSignature(0n, "ipfs://original", 1n, 100n, deadline, sig);
    });

    it("Should allow minting copies of existing artwork", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      
      const sig = await createMintSignature(
        trustedSigner,
        other.address,
        1n, // Existing token ID
        "ipfs://original", // URI must match
        2n, // Mint 2 copies
        200n,
        0n, // Other's nonce
        deadline
      );

      await expect(
        contract.connect(other).mintWithSignature(1n, "ipfs://original", 2n, 200n, deadline, sig)
      )
        .to.emit(contract, "ArtworkMinted")
        .withArgs(1n, other.address, 2n);

      expect(await contract.balanceOf(other.address, 1n)).to.equal(2n);
      expect(await contract["totalSupply(uint256)"](1n)).to.equal(3n); // 1 original + 2 copies
    });

    it("Should revert when minting non-existent token ID", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      
      const sig = await createMintSignature(
        trustedSigner,
        other.address,
        99n, // Non-existent
        "ipfs://fake",
        1n,
        200n,
        0n,
        deadline
      );

      await expect(
        contract.connect(other).mintWithSignature(99n, "ipfs://fake", 1n, 200n, deadline, sig)
      ).to.be.revertedWithCustomError(contract, "TokenNotCreated");
    });
  });

  describe("Signature validation", function () {
    it("Should reject expired signature", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) - 3600); // Past

      const sig = await createMintSignature(
        trustedSigner,
        minter.address,
        0n,
        "ipfs://test",
        1n,
        100n,
        0n,
        deadline
      );

      await expect(
        contract.connect(minter).mintWithSignature(0n, "ipfs://test", 1n, 100n, deadline, sig)
      ).to.be.revertedWithCustomError(contract, "SignatureExpired");
    });

    it("Should reject signature from wrong signer", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Signed by 'other' instead of trustedSigner
      const sig = await createMintSignature(
        other,
        minter.address,
        0n,
        "ipfs://test",
        1n,
        100n,
        0n,
        deadline
      );

      await expect(
        contract.connect(minter).mintWithSignature(0n, "ipfs://test", 1n, 100n, deadline, sig)
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("Should reject signature for different minter", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Signature for minter.address but called by other
      const sig = await createMintSignature(
        trustedSigner,
        minter.address,
        0n,
        "ipfs://test",
        1n,
        100n,
        0n,
        deadline
      );

      await expect(
        contract.connect(other).mintWithSignature(0n, "ipfs://test", 1n, 100n, deadline, sig)
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("Should reject replayed signature (nonce reuse)", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const sig = await createMintSignature(
        trustedSigner,
        minter.address,
        0n,
        "ipfs://test",
        1n,
        100n,
        0n,
        deadline
      );

      // First mint succeeds
      await contract.connect(minter).mintWithSignature(0n, "ipfs://test", 1n, 100n, deadline, sig);

      // Same signature fails (nonce already used)
      await expect(
        contract.connect(minter).mintWithSignature(0n, "ipfs://test", 1n, 100n, deadline, sig)
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });
  });

  describe("Admin functions", function () {
    it("Should allow owner to update trusted signer", async function () {
      await expect(contract.setTrustedSigner(other.address))
        .to.emit(contract, "TrustedSignerUpdated")
        .withArgs(trustedSigner.address, other.address);

      expect(await contract.trustedSigner()).to.equal(other.address);
    });

    it("Should reject non-owner updating trusted signer", async function () {
      await expect(
        contract.connect(other).setTrustedSigner(other.address)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("Should reject setting zero address as trusted signer", async function () {
      await expect(
        contract.setTrustedSigner(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });
  });

  describe("Supply tracking", function () {
    it("Should track total supply per token", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // Mint 5 of token 1
      const sig = await createMintSignature(
        trustedSigner,
        minter.address,
        0n,
        "ipfs://test",
        5n,
        100n,
        0n,
        deadline
      );
      await contract.connect(minter).mintWithSignature(0n, "ipfs://test", 5n, 100n, deadline, sig);

      expect(await contract["totalSupply(uint256)"](1n)).to.equal(5n);
      expect(await contract.exists(1n)).to.equal(true);
      expect(await contract.exists(2n)).to.equal(false);
    });
  });
});
