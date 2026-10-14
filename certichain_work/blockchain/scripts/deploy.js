import { network } from "hardhat";

const { ethers } = await network.connect();

const Registry = await ethers.getContractFactory("CertificateRegistry");
const registry = await Registry.deploy();
await registry.waitForDeployment();

console.log("CertificateRegistry deployed to:", await registry.getAddress());
