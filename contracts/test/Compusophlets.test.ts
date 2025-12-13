import { expect } from "chai";
import { ethers } from "hardhat";
import { Compusophlets } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Compusophlets", function () {
  let contract: Compusophlets;
  let owner: SignerWithAddress;
  let trustedSigner: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let creator: SignerWithAddress;
  let collector: SignerWithAddress;
  let other: SignerWithAddress;

  const DOMAIN_NAME = "Compusophlets";
  const DOMAIN_VERSION = "1";
  const MINT_FEE = ethers.parseEther("0.0003");

  // Helper to create EIP-712 signature
  async function createMintSignature(
    signer: SignerWithAddress,
    minterAddress: string,
    tokenId: bigint,
    uri: string,
    amount: bigint,
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
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    const value = {
      minter: minterAddress,
      tokenId,
      uri,
      amount,
      nonce,
      deadline,
    };

    return await signer.signTypedData(domain, types, value);
  }

  beforeEach(async function () {
    [owner, trustedSigner, feeRecipient, creator, collector, other] = await ethers.getSigners();

    const Compusophlets = await ethers.getContractFactory("Compusophlets");
    contract = await Compusophlets.deploy(trustedSigner.address, feeRecipient.address);
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct trusted signer", async function () {
      expect(await contract.trustedSigner()).to.equal(trustedSigner.address);
    });

    it("Should set the correct fee recipient", async function () {
      expect(await contract.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("Should set the correct mint fee", async function () {
      expect(await contract.mintFee()).to.equal(MINT_FEE);
    });

    it("Should start with token ID 1", async function () {
      expect(await contract.getNextTokenId()).to.equal(1n);
    });
  });

  describe("Creating a compusophlet", function () {
    it("Should create new compusophlet with valid signature and fee", async function () {
      const uri = "ipfs://QmTest123";
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const signature = await createMintSignature(
        trustedSigner,
        creator.address,
        0n, // tokenId 0 = new creation
        uri,
        1n,
        0n,
        deadline
      );

      const feeRecipientBalanceBefore = await ethers.provider.getBalance(feeRecipient.address);

      await expect(
        contract.connect(creator).mintWithSignature(0n, uri, 1n, deadline, signature, { value: MINT_FEE })
      )
        .to.emit(contract, "CompusophletCreated")
        .withArgs(1n, creator.address, uri);

      expect(await contract.balanceOf(creator.address, 1n)).to.equal(1n);
      expect(await contract.tokenCreators(1n)).to.equal(creator.address);
      expect(await contract.creatorTokenId(creator.address)).to.equal(1n);
      expect(await contract.hasCreated(creator.address)).to.equal(true);

      // Check fee was transferred
      const feeRecipientBalanceAfter = await ethers.provider.getBalance(feeRecipient.address);
      expect(feeRecipientBalanceAfter - feeRecipientBalanceBefore).to.equal(MINT_FEE);
    });

    it("Should revert if trying to create twice", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // First creation
      const sig1 = await createMintSignature(trustedSigner, creator.address, 0n, "ipfs://test1", 1n, 0n, deadline);
      await contract.connect(creator).mintWithSignature(0n, "ipfs://test1", 1n, deadline, sig1, { value: MINT_FEE });

      // Second attempt
      const sig2 = await createMintSignature(trustedSigner, creator.address, 0n, "ipfs://test2", 1n, 1n, deadline);
      await expect(
        contract.connect(creator).mintWithSignature(0n, "ipfs://test2", 1n, deadline, sig2, { value: MINT_FEE })
      ).to.be.revertedWithCustomError(contract, "AlreadyCreated");
    });

    it("Should revert without sufficient fee", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sig = await createMintSignature(trustedSigner, creator.address, 0n, "ipfs://test", 1n, 0n, deadline);

      await expect(
        contract.connect(creator).mintWithSignature(0n, "ipfs://test", 1n, deadline, sig, { value: 0n })
      ).to.be.revertedWithCustomError(contract, "InsufficientFee");
    });
  });

  describe("Collecting a compusophlet", function () {
    beforeEach(async function () {
      // Creator makes their compusophlet
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sig = await createMintSignature(trustedSigner, creator.address, 0n, "ipfs://original", 1n, 0n, deadline);
      await contract.connect(creator).mintWithSignature(0n, "ipfs://original", 1n, deadline, sig, { value: MINT_FEE });
    });

    it("Should allow collecting copies of existing compusophlet", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      
      const sig = await createMintSignature(
        trustedSigner,
        collector.address,
        1n, // Existing token ID
        "", // URI not needed for collecting
        2n, // Collect 2 copies
        0n,
        deadline
      );

      await expect(
        contract.connect(collector).mintWithSignature(1n, "", 2n, deadline, sig, { value: MINT_FEE })
      )
        .to.emit(contract, "CompusophletCollected")
        .withArgs(1n, collector.address, 2n);

      expect(await contract.balanceOf(collector.address, 1n)).to.equal(2n);
      expect(await contract["totalSupply(uint256)"](1n)).to.equal(3n); // 1 original + 2 collected
    });

    it("Should allow creator to also collect more of their own", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      
      const sig = await createMintSignature(trustedSigner, creator.address, 1n, "", 3n, 1n, deadline);
      await contract.connect(creator).mintWithSignature(1n, "", 3n, deadline, sig, { value: MINT_FEE });

      expect(await contract.balanceOf(creator.address, 1n)).to.equal(4n); // 1 original + 3 more
    });

    it("Should revert when collecting non-existent token", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sig = await createMintSignature(trustedSigner, collector.address, 99n, "", 1n, 0n, deadline);

      await expect(
        contract.connect(collector).mintWithSignature(99n, "", 1n, deadline, sig, { value: MINT_FEE })
      ).to.be.revertedWithCustomError(contract, "TokenNotCreated");
    });
  });

  describe("Admin functions", function () {
    it("Should allow owner to update mint fee", async function () {
      const newFee = ethers.parseEther("0.001");
      await expect(contract.setMintFee(newFee))
        .to.emit(contract, "MintFeeUpdated")
        .withArgs(MINT_FEE, newFee);

      expect(await contract.mintFee()).to.equal(newFee);
    });

    it("Should allow owner to update fee recipient", async function () {
      await expect(contract.setFeeRecipient(other.address))
        .to.emit(contract, "FeeRecipientUpdated")
        .withArgs(feeRecipient.address, other.address);

      expect(await contract.feeRecipient()).to.equal(other.address);
    });

    it("Should allow owner to pause and unpause", async function () {
      await contract.pause();
      expect(await contract.paused()).to.equal(true);

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sig = await createMintSignature(trustedSigner, creator.address, 0n, "ipfs://test", 1n, 0n, deadline);
      
      await expect(
        contract.connect(creator).mintWithSignature(0n, "ipfs://test", 1n, deadline, sig, { value: MINT_FEE })
      ).to.be.revertedWithCustomError(contract, "EnforcedPause");

      await contract.unpause();
      expect(await contract.paused()).to.equal(false);

      // Now it should work
      await contract.connect(creator).mintWithSignature(0n, "ipfs://test", 1n, deadline, sig, { value: MINT_FEE });
      expect(await contract.balanceOf(creator.address, 1n)).to.equal(1n);
    });

    it("Should reject non-owner admin calls", async function () {
      await expect(
        contract.connect(other).setMintFee(0n)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");

      await expect(
        contract.connect(other).pause()
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });
  });

  describe("Signature validation", function () {
    it("Should reject expired signature", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) - 3600);
      const sig = await createMintSignature(trustedSigner, creator.address, 0n, "ipfs://test", 1n, 0n, deadline);

      await expect(
        contract.connect(creator).mintWithSignature(0n, "ipfs://test", 1n, deadline, sig, { value: MINT_FEE })
      ).to.be.revertedWithCustomError(contract, "SignatureExpired");
    });

    it("Should reject wrong signer", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sig = await createMintSignature(other, creator.address, 0n, "ipfs://test", 1n, 0n, deadline);

      await expect(
        contract.connect(creator).mintWithSignature(0n, "ipfs://test", 1n, deadline, sig, { value: MINT_FEE })
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });

    it("Should reject replay", async function () {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sig = await createMintSignature(trustedSigner, creator.address, 0n, "ipfs://test", 1n, 0n, deadline);

      await contract.connect(creator).mintWithSignature(0n, "ipfs://test", 1n, deadline, sig, { value: MINT_FEE });

      // Can't create again anyway, but even collecting would fail due to nonce
      const sig2 = await createMintSignature(trustedSigner, creator.address, 1n, "", 1n, 0n, deadline); // Wrong nonce
      await expect(
        contract.connect(creator).mintWithSignature(1n, "", 1n, deadline, sig2, { value: MINT_FEE })
      ).to.be.revertedWithCustomError(contract, "InvalidSignature");
    });
  });
});
