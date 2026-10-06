import { useParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, ExternalLink, Copy, ShieldCheck, ArrowLeft, Ban } from "lucide-react";
import { demoCertificates } from "../data";
import CertificatePreview from "../components/CertificatePreview";
import TemplateCertificatePreview from "../components/TemplateCertificatePreview";
import { useEffect, useState } from "react";
import { findIssuedCertificate } from "../certificateStore";
import { ethers } from "ethers";
import { CERTIFICATE_REGISTRY_ABI, certificateBytes32 } from "../blockchainService";
import { loadInstitutionSettings } from "../institutionStore";
import { apiBaseUrl, getPublicAppUrl, isLocalVerificationUrl } from "../verificationUrl";

function valueForVariable(data, key) {
  const exact = data?.[key];
  if (exact !== undefined && exact !== null) return String(exact);
  const found = Object.entries(data || {}).find(([entryKey]) => String(entryKey).toLowerCase() === String(key).toLowerCase());
  return found ? String(found[1] ?? "") : "";
}

function recipientName(record) {
  return valueForVariable(record.data, "name") || valueForVariable(record.data, "student_name") || valueForVariable(record.data, "recipient_name") || "Participant";
}

function courseName(record) {
  return valueForVariable(record.data, "course") || record.templateName || "Certificate";
}

export default function Verification() {
  const { certificateId } = useParams();
  const [issued, setIssued] = useState(() => findIssuedCertificate(certificateId));
  const [copied, setCopied] = useState(false);
  const [chainResult, setChainResult] = useState(null);
  const [publicRecord, setPublicRecord] = useState(null);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState("");
  const settings = loadInstitutionSettings();

  useEffect(() => {
    setIssued(findIssuedCertificate(certificateId));
    setPublicLoading(true);
    setPublicError("");
    fetch(`${apiBaseUrl()}/api/public/certificates/${encodeURIComponent(certificateId)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Public verification record not found.");
        setPublicRecord(data?.certificate || null);
      })
      .catch((error) => {
        setPublicRecord(null);
        setPublicError(error?.message || "Public verification service unavailable.");
      })
      .finally(() => setPublicLoading(false));
    if (settings.blockchain.contractAddress && settings.blockchain.rpcUrl) {
      (async () => {
        try {
          const provider = new ethers.JsonRpcProvider(settings.blockchain.rpcUrl);
          const contract = new ethers.Contract(settings.blockchain.contractAddress, CERTIFICATE_REGISTRY_ABI, provider);
          const x = await contract.verifyCertificate(certificateBytes32(certificateId));
          setChainResult({ exists: Boolean(x[0]), revoked: Boolean(x[1]), issuer: x[2], ipfsCid: x[3], issuedAt: Number(x[4] || 0) });
        } catch { setChainResult(null); }
      })();
    } else setChainResult(null);
    const refresh = () => setIssued(findIssuedCertificate(certificateId));
    window.addEventListener("storage", refresh);
    window.addEventListener("certichain:issued-certificates-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("certichain:issued-certificates-updated", refresh);
    };
  }, [certificateId]);

  const cert = issued || publicRecord || demoCertificates.find((x) => x.id.toLowerCase() === String(certificateId || "").toLowerCase());
  const isDynamic = Boolean(issued || publicRecord);
  const remoteRecord = issued || publicRecord;
  const isDisqualified = remoteRecord?.status === "Disqualified" || Boolean(chainResult?.revoked);
  const publicUrlIsLocal = isLocalVerificationUrl(getPublicAppUrl());
  const copy = () => { navigator.clipboard?.writeText(certificateId || ""); setCopied(true); setTimeout(() => setCopied(false), 1400); };

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><ShieldCheck size={21}/></span><span><b className="block text-sm">CertiChain</b><small className="text-xs text-slate-400">Public Certificate Verification</small></span></Link><Link to="/" className="flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Home</Link></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10">
      {publicUrlIsLocal && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>QR testing note:</b> this QR currently targets <span className="font-mono">{getPublicAppUrl()}</span>. A phone cannot normally open a certificate that points to desktop <b>localhost</b>. For Google Lens/phone-camera verification, set <span className="font-mono">VITE_PUBLIC_APP_URL</span> to your deployed CertiChain HTTPS URL (or your computer's LAN IP while testing on the same Wi-Fi).</div>}
      {publicError && !publicLoading && !issued && !chainResult && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Public verification service: {publicError}</div>}
      {!cert ? <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600"><XCircle size={35}/></div><h1 className="mt-6 text-3xl font-bold">Certificate not found</h1><p className="mt-3 text-slate-500">No CertiChain record was found for <b>{certificateId}</b>.</p></div> :
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div>{issued?.template ? <TemplateCertificatePreview template={issued.template} form={issued.data || {}} certificateId={issued.id}/> : <CertificatePreview certificateId={cert.id} name={cert.name} course={cert.course} grade={cert.grade}/>}</div>
        <div className="space-y-5">
          <section className={`rounded-3xl border p-7 ${isDisqualified ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-center gap-4"><div className={`flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ${isDisqualified ? "text-rose-600" : "text-emerald-600"}`}>{isDisqualified ? <Ban size={33}/> : <CheckCircle2 size={33}/>}</div><div><h1 className="text-2xl font-bold text-slate-900">{isDisqualified ? "Certificate Disqualified" : "Certificate Verified"}</h1><p className={`mt-1 text-sm ${isDisqualified ? "text-rose-700" : "text-emerald-700"}`}>{isDisqualified ? "This certificate was disqualified by the original creator and is no longer valid." : isDynamic ? "This certificate matches the issued CertiChain record." : "This record matches the certificate registry entry."}</p></div></div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Verification details</h2><div className="mt-5 space-y-4 text-sm">{isDynamic ? [["Certificate ID",remoteRecord.id],["Recipient",remoteRecord.name || recipientName(remoteRecord)],["Course",remoteRecord.course || courseName(remoteRecord)],["Issuer",remoteRecord.createdByName || "Authorized Institution"],["Issued",remoteRecord.issuedAt ? new Date(remoteRecord.issuedAt).toLocaleString() : "—"],["Record type","Public issued certificate"],["Blockchain",remoteRecord.blockchainNetwork||settings.blockchain.network||"Ethereum Sepolia"],["Blockchain status",chainResult?(!chainResult.exists?"Not found":chainResult.revoked?"Revoked":"Verified"):remoteRecord.transactionHash?"Registered locally":"Not queried"],["Transaction",remoteRecord.transactionHash||"Not registered"],["IPFS CID",remoteRecord.ipfsCid||chainResult?.ipfsCid||"Not linked"],["Status",isDisqualified?"Disqualified":remoteRecord.status]].map(([a,b])=><div key={a} className="flex justify-between gap-4 border-b border-slate-100 pb-3"><span className="text-slate-400">{a}</span><span className={`max-w-[65%] text-right font-semibold ${a === "Status" && isDisqualified ? "text-rose-600" : "text-slate-800"}`}>{b}</span></div>) : [["Certificate ID",cert.id],["Recipient",cert.name],["Course",cert.course],["Issuer","Authorized Institution"],["Issued",cert.date],["Network","Ethereum Sepolia"],["Status",cert.status]].map(([a,b])=><div key={a} className="flex justify-between gap-4 border-b border-slate-100 pb-3"><span className="text-slate-400">{a}</span><span className="text-right font-semibold text-slate-800">{b}</span></div>)}</div>{isDynamic && isDisqualified && <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-800"><b>Disqualification reason:</b> {remoteRecord.disqualificationReason || "Certificate disqualified by the original creator."}</div>}<div className="mt-5 flex gap-2"><button onClick={copy} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"><Copy size={16}/>{copied?"Copied":"Copy ID"}</button>{issued ? <Link to={`/certificates/${issued.id}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"><ExternalLink size={16}/> Record</Link> : <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"><ExternalLink size={16}/> Blockchain</button>}</div></section>
          <p className="text-center text-xs text-slate-400">Verification is read-only. Issued certificates cannot be modified.</p>
        </div>
      </div>}
    </main>
  </div>;
}
