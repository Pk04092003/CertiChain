import "dotenv/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: "0.8.28",
  networks: {
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : []
    }
  }
});
