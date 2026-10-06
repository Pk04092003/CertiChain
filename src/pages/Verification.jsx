import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2, Copy, ExternalLink, FileCheck2, ShieldCheck, XCircle } from "lucide-react";
import { demoCertificates } from "../data";
import CertificatePreview from "../components/CertificatePreview";
import TemplateCertificatePreview from "../components/TemplateCertificatePreview";
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
function recipientName(record) { return valueForVariable(record?.data, "name") || valueForVariable(record?.data, "student_name") || valueForVariable(record?.data, "recipient_name") || record?.name || "Participant"; }
function courseName(record) { return valueForVariable(record?.data, "course") || record?.course || record?.templateName || "Certificate"; }
function formatDate(value) { const date=new Date(value||""); return Number.isNaN(date.getTime())?"—":date.toLocaleString(undefined,{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
function getVerificationState(record, chainResult) {
  if (!record) return "NOT_FOUND";
  if (record.status === "Disqualified" || record.verificationStatus === "Disqualified") return "DISQUALIFIED";
  if (record.status === "Revoked" || record.verificationStatus === "Revoked" || record.blockchainRevoked || Boolean(chainResult?.revoked)) return "REVOKED";
  return "VERIFIED";
}
const STATE={
  VERIFIED:{title:"Certificate Verified",label:"VERIFIED",icon:CheckCircle2,shell:"border-emerald-200 bg-emerald-50",iconShell:"bg-white text-emerald-600",seal:"border-emerald-500 text-emerald-700",message:"This certificate matches a published CertiChain record and is currently valid."},
  REVOKED:{title:"Certificate Revoked",label:"REVOKED",icon:XCircle,shell:"border-amber-200 bg-amber-50",iconShell:"bg-white text-amber-600",seal:"border-amber-500 text-amber-700",message:"This certificate was revoked and should no longer be treated as valid."},
  DISQUALIFIED:{title:"Certificate Disqualified",label:"DISQUALIFIED",icon:Ban,shell:"border-rose-200 bg-rose-50",iconShell:"bg-white text-rose-600",seal:"border-rose-500 text-rose-700",message:"This certificate was disqualified by the issuing administrator and is no longer valid."},
};
export default function Verification(){
  const {certificateId}=useParams();
  const [issued,setIssued]=useState(()=>findIssuedCertificate(certificateId));
  const [publicRecord,setPublicRecord]=useState(null);
  const [chainResult,setChainResult]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);
  const settings=loadInstitutionSettings();
  useEffect(()=>{
    let cancelled=false;
    const id=String(certificateId||"").trim().toUpperCase();
    setIssued(findIssuedCertificate(id)); setPublicRecord(null); setChainResult(null); setLoading(true); setError("");
    fetch(`${apiBaseUrl()}/api/public/certificates/${encodeURIComponent(id)}`,{headers:{Accept:"application/json"}}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||"Public verification record not found.");if(!cancelled)setPublicRecord(d?.certificate||null);}).catch(e=>{if(!cancelled)setError(e?.message||"Public verification service unavailable.");}).finally(()=>{if(!cancelled)setLoading(false);});
    if(settings.blockchain.contractAddress&&settings.blockchain.rpcUrl){(async()=>{try{const provider=new ethers.JsonRpcProvider(settings.blockchain.rpcUrl);const contract=new ethers.Contract(settings.blockchain.contractAddress,CERTIFICATE_REGISTRY_ABI,provider);const x=await contract.verifyCertificate(certificateBytes32(id));if(!cancelled)setChainResult({exists:Boolean(x[0]),revoked:Boolean(x[1]),issuer:x[2],ipfsCid:x[3],issuedAt:Number(x[4]||0)});}catch{}})();}
    return()=>{cancelled=true};
  },[certificateId]);
  const demo=useMemo(()=>demoCertificates.find(x=>x.id.toLowerCase()===String(certificateId||"").toLowerCase()),[certificateId]);
  const record=publicRecord||issued||demo||null;
  const state=getVerificationState(publicRecord,chainResult);
  const config=state==="NOT_FOUND"?null:STATE[state];
  const Icon=config?.icon||FileCheck2;
  const publicUrlIsLocal=isLocalVerificationUrl(getPublicAppUrl());
  const copyId=async()=>{try{await navigator.clipboard?.writeText(String(certificateId||""));}catch{} setCopied(true);setTimeout(()=>setCopied(false),1400);};
  const displayName=recipientName(record); const displayCourse=courseName(record);
  const statusText=state==="VERIFIED"?"Verified":state==="REVOKED"?"Revoked":state==="DISQUALIFIED"?"Disqualified":"Not found";
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><ShieldCheck size={21}/></span><span><b className="block text-sm">CertiChain</b><small className="text-xs text-slate-400">Public Certificate Verification</small></span></Link><Link to="/" className="flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Home</Link></div></header>
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
      {publicUrlIsLocal&&<div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>QR testing note:</b> this QR points to <span className="font-mono">{getPublicAppUrl()}</span>. Use the deployed HTTPS URL for Google Lens/phone-camera verification.</div>}
      {loading&&<div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"/><p className="mt-4 text-sm text-slate-500">Checking CertiChain public records…</p></div>}
      {!loading&&state==="NOT_FOUND"&&<div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm sm:p-10"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600"><XCircle size={35}/></div><h1 className="mt-6 text-3xl font-bold">Certificate not found</h1><p className="mt-3 text-slate-500">No published CertiChain verification record was found for</p><div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-sm font-semibold">{certificateId}</div>{error&&<p className="mt-4 text-sm text-rose-600">{error}</p>}<Link to="/verify" className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Verify another certificate</Link></div>}
      {!loading&&state!=="NOT_FOUND"&&record&&config&&<div className="space-y-6">
        <section className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${config.shell}`}><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${config.iconShell}`}><Icon size={32}/></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">CertiChain public result</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{config.title}</h1><p className="mt-1 text-sm text-slate-600">{config.message}</p></div></div><div className={`flex h-28 w-28 shrink-0 rotate-[-8deg] items-center justify-center rounded-full border-4 border-dashed bg-white/80 text-center text-xs font-black tracking-[0.14em] shadow-inner ${config.seal}`}><span>{config.label}</span></div></div></section>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Certificate record</p><h2 className="mt-1 text-2xl font-bold">{displayCourse}</h2><p className="mt-1 text-sm text-slate-500">Issued to <b className="text-slate-700">{displayName}</b></p></div><button onClick={copyId} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"><Copy size={16}/>{copied?"Copied":"Copy Certificate ID"}</button></div>{issued?.template?<div className="mt-6"><TemplateCertificatePreview template={issued.template} form={issued.data||{}} certificateId={issued.id}/></div>:<div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-6"><div className="flex items-center justify-center gap-3"><FileCheck2 className="text-blue-600" size={26}/><span className="text-lg font-bold">Certificate ID: {record.id}</span></div><p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-500">The public registry stores verification-safe certificate details. The original certificate document remains under the administrator's control.</p></div>}<div className="mt-6 grid gap-4 md:grid-cols-2">{[["Certificate ID",record.id],["Recipient",displayName],["Course / Program",displayCourse],["Issuer",record.createdByName||"Authorized Institution"],["Issued",formatDate(record.issuedAt)],["Status",statusText],["Blockchain status",chainResult?(chainResult.revoked?"Revoked":chainResult.exists?"Verified":"Not found"):(record.blockchainStatus||"Not registered")],["Transaction",record.transactionHash||"Not registered"]].map(([label,value])=><div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="text-xs font-medium text-slate-400">{label}</div><div className="mt-1 break-all text-sm font-semibold text-slate-800">{value}</div></div>)}</div>{(state==="DISQUALIFIED"||state==="REVOKED")&&<div className={`mt-5 rounded-2xl p-4 text-sm ${state==="DISQUALIFIED"?"border border-rose-100 bg-rose-50 text-rose-800":"border border-amber-100 bg-amber-50 text-amber-800"}`}><b>{state==="DISQUALIFIED"?"Disqualification reason:":"Revocation reason:"}</b> {record.disqualificationReason||record.revocationReason||"No additional reason was recorded."}</div>}<div className="mt-6 flex flex-wrap gap-3"><button onClick={copyId} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"><Copy size={16}/>{copied?"Copied":"Copy ID"}</button><Link to={`/verify/${record.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"><ExternalLink size={16}/> Permalink</Link></div></section><p className="text-center text-xs text-slate-400">Viewer access is public and read-only. No CertiChain account is required to verify a certificate.</p></div>}
    </main>
  </div>
}
