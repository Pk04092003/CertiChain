import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("CertificateRegistry", function () {
  async function deployed() {
    const [owner] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    return { owner, registry };
  }

  it("issues and verifies a certificate", async function () {
    const { owner, registry } = await deployed();

    const id = ethers.keccak256(ethers.toUtf8Bytes("PRAVEEN|SOFTWARE|2026"));
    await registry.issueCertificate(id, "bafy-demo-cid");

    const result = await registry.verifyCertificate(id);
    expect(result[0]).to.equal(true);
    expect(result[1]).to.equal(false);
    expect(result[2]).to.equal(owner.address);
    expect(result[3]).to.equal("bafy-demo-cid");
  });

  it("supports revocation", async function () {
    const { registry } = await deployed();

    const id = ethers.keccak256(ethers.toUtf8Bytes("CERT-REVOKE"));
    await registry.issueCertificate(id, "bafy-revoke");

    await registry.revokeCertificate(id);
    const result = await registry.verifyCertificate(id);
    expect(result[0]).to.equal(true);
    expect(result[1]).to.equal(true);
  });
});
