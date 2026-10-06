// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CertificateRegistry {
    struct Certificate {
        bytes32 certificateId;
        address issuer;
        string ipfsCid;
        uint256 issuedAt;
        bool revoked;
    }

    address public owner;
    mapping(address => bool) public authorizedIssuers;
    mapping(bytes32 => Certificate) private certificates;

    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);
    event CertificateIssued(bytes32 indexed certificateId, address indexed issuer, string ipfsCid, uint256 issuedAt);
    event CertificateRevoked(bytes32 indexed certificateId, address indexed issuer, uint256 revokedAt);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Not authorized issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    function authorizeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    function revokeIssuer(address issuer) external onlyOwner {
        authorizedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    function issueCertificate(bytes32 certificateId, string calldata ipfsCid) external onlyIssuer {
        require(certificates[certificateId].issuedAt == 0, "Certificate exists");
        certificates[certificateId] = Certificate(
            certificateId,
            msg.sender,
            ipfsCid,
            block.timestamp,
            false
        );
        emit CertificateIssued(certificateId, msg.sender, ipfsCid, block.timestamp);
    }

    function revokeCertificate(bytes32 certificateId) external onlyIssuer {
        Certificate storage cert = certificates[certificateId];
        require(cert.issuedAt != 0, "Certificate not found");
        cert.revoked = true;
        emit CertificateRevoked(certificateId, msg.sender, block.timestamp);
    }

    function verifyCertificate(bytes32 certificateId)
        external
        view
        returns (
            bool exists,
            bool revoked,
            address issuer,
            string memory ipfsCid,
            uint256 issuedAt
        )
    {
        Certificate memory cert = certificates[certificateId];
        exists = cert.issuedAt != 0;
        revoked = cert.revoked;
        issuer = cert.issuer;
        ipfsCid = cert.ipfsCid;
        issuedAt = cert.issuedAt;
    }
}
