import { ethers } from "ethers";

export const CERTIFICATE_REGISTRY_ABI = [
  "function issueCertificate(bytes32 certificateId, string ipfsCid) external",
  "function revokeCertificate(bytes32 certificateId) external",
  "function verifyCertificate(bytes32 certificateId) external view returns (bool exists,bool revoked,address issuer,string ipfsCid,uint256 issuedAt)",
  "function authorizedIssuers(address) external view returns (bool)",
];

export function certificateBytes32(id) {
  return ethers.keccak256(ethers.toUtf8Bytes(String(id || "")));
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");
  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  return { provider, signer, address: await signer.getAddress(), chainId: Number(network.chainId) };
}

export async function getBlockchainStatus(contractAddress) {
  const result = { configured: Boolean(contractAddress), wallet: null, chainId: null, authorized: null };
  if (!window.ethereum) return result;
  try {
    const { signer, address, chainId } = await connectWallet();
    result.wallet = address;
    result.chainId = chainId;
    if (contractAddress) result.authorized = await new ethers.Contract(contractAddress, CERTIFICATE_REGISTRY_ABI, signer).authorizedIssuers(address);
  } catch {
    // Wallet is optional until registration is requested.
  }
  return result;
}

export async function registerCertificateOnChain({ contractAddress, certificateId, ipfsCid }) {
  if (!contractAddress) throw new Error("Enter the deployed CertificateRegistry contract address in Settings.");
  if (!ipfsCid) throw new Error("An IPFS CID is required before blockchain registration.");
  const { signer } = await connectWallet();
  const contract = new ethers.Contract(contractAddress, CERTIFICATE_REGISTRY_ABI, signer);
  const allowed = await contract.authorizedIssuers(await signer.getAddress());
  if (!allowed) throw new Error("Connected wallet is not an authorized issuer in the CertificateRegistry contract.");
  const tx = await contract.issueCertificate(certificateBytes32(certificateId), ipfsCid);
  const receipt = await tx.wait();
  return { transactionHash: receipt.hash || tx.hash, blockNumber: receipt.blockNumber, wallet: await signer.getAddress() };
}

export async function revokeCertificateOnChain({ contractAddress, certificateId }) {
  if (!contractAddress) throw new Error("Enter the deployed CertificateRegistry contract address in Settings.");
  const { signer } = await connectWallet();
  const contract = new ethers.Contract(contractAddress, CERTIFICATE_REGISTRY_ABI, signer);
  const allowed = await contract.authorizedIssuers(await signer.getAddress());
  if (!allowed) throw new Error("Connected wallet is not an authorized issuer in the CertificateRegistry contract.");
  const tx = await contract.revokeCertificate(certificateBytes32(certificateId));
  const receipt = await tx.wait();
  return { transactionHash: receipt.hash || tx.hash, blockNumber: receipt.blockNumber, wallet: await signer.getAddress() };
}
