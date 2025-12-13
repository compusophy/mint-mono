import { ethers, run, network } from "hardhat";
import * as readline from "readline";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n=== GenerativePFP Contract Deployment ===\n");
  
  // Check if we have a private key from env, otherwise prompt
  let privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  
  if (!privateKey || privateKey === "0x0000000000000000000000000000000000000000000000000000000000000001") {
    console.log("No DEPLOYER_PRIVATE_KEY found in environment.");
    privateKey = await prompt("Enter deployer private key (with 0x prefix): ");
  }
  
  if (!privateKey.startsWith("0x")) {
    privateKey = "0x" + privateKey;
  }
  
  // Create wallet from private key
  const provider = ethers.provider;
  const deployer = new ethers.Wallet(privateKey, provider);
  
  console.log("\nDeployer address:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    console.error("\n❌ Deployer has no ETH! Fund this address first.");
    console.log(`   Send ETH to: ${deployer.address}`);
    console.log(`   Network: ${network.name}`);
    process.exit(1);
  }

  // Get trusted signer - prompt if not in env
  let trustedSigner = process.env.TRUSTED_SIGNER;
  
  if (!trustedSigner) {
    console.log("\n--- Trusted Signer Setup ---");
    console.log("The trusted signer is the wallet that will authorize mints.");
    console.log("This private key will be stored on your server.");
    console.log("For simplicity, you can use the same address as the deployer.\n");
    
    const useSame = await prompt("Use deployer as trusted signer? (y/n): ");
    
    if (useSame.toLowerCase() === "y" || useSame.toLowerCase() === "yes") {
      trustedSigner = deployer.address;
    } else {
      trustedSigner = await prompt("Enter trusted signer ADDRESS (0x...): ");
    }
  }
  
  console.log("\nTrusted signer:", trustedSigner);

  // Confirm before deploying
  console.log("\n--- Deployment Summary ---");
  console.log(`Network:        ${network.name} (Chain ID: ${network.config.chainId})`);
  console.log(`Deployer:       ${deployer.address}`);
  console.log(`Trusted Signer: ${trustedSigner}`);
  console.log(`Balance:        ${ethers.formatEther(balance)} ETH`);
  
  const confirm = await prompt("\nProceed with deployment? (y/n): ");
  if (confirm.toLowerCase() !== "y" && confirm.toLowerCase() !== "yes") {
    console.log("Deployment cancelled.");
    process.exit(0);
  }

  // Deploy the contract
  console.log("\nDeploying contract...");
  const GenerativePFP = await ethers.getContractFactory("GenerativePFP", deployer);
  const contract = await GenerativePFP.deploy(trustedSigner);

  console.log("Waiting for deployment transaction...");
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("GenerativePFP deployed to:", contractAddress);
  console.log("Network:", network.name);

  // Verify on block explorer if not on hardhat network
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    // Wait for a few block confirmations
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log("Verifying contract on Basescan...");
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [trustedSigner],
      });
      console.log("Contract verified!");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("Contract already verified!");
      } else {
        console.error("Verification failed:", error.message);
      }
    }
  }

  // Output deployment info for easy copy-paste
  console.log("\n=== Deployment Summary ===");
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`TRUSTED_SIGNER=${trustedSigner}`);
  console.log(`NETWORK=${network.name}`);
  console.log(`CHAIN_ID=${network.config.chainId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
