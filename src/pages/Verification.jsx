import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2, Copy, Search, ShieldCheck, XCircle, AlertTriangle, Clock3, Hash, Blocks, UserRound, GraduationCap, Building2, CalendarDays, Link2, FileKey2 } from "lucide-react";
import { getPublicAppUrl, isLocalVerificationUrl, verifyCertificatePublicly } from "../verificationUrl";

function formatDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATES = {
  VERIFIED: {
    title: "Certificate Verified",
    label: "VERIFIED",
    icon: CheckCircle2,
    shell: "border-emerald-200 bg-emerald-50",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-800",
    iconShell: "bg-emerald-600 text-white",
    message: "This certificate has been verified successfully and is currently valid.",
  },
  REVOKED: {
    title: "Certificate Not Valid",
    label: "REVOKED",
    icon: XCircle,
    shell: "border-amber-200 bg-amber-50",
    badge: "border-amber-200 bg-amber-100 text-amber-800",
    iconShell: "bg-amber-500 text-white",
    message: "This certificate has been revoked and should no longer be accepted as valid.",
  },
  DISQUALIFIED: {
    title: "Certificate Not Valid",
    label: "DISQUALIFIED",
    icon: Ban,
    shell: "border-rose-200 bg-rose-50",
    badge: "border-rose-200 bg-rose-100 text-rose-800",
    iconShell: "bg-rose-600 text-white",
    message: "This certificate has been disqualified and is no longer valid.",
  },
  UNREGISTERED: {
    title: "Certificate Not Verified",
    label: "NOT VERIFIED",
    icon: AlertTriangle,
    shell: "border-amber-200 bg-amber-50",
    badge: "border-amber-200 bg-amber-100 text-amber-800",
    iconShell: "bg-amber-500 text-white",
    message: "A certificate record exists, but it is not currently registered on the blockchain.",
  },
};

function Detail({ icon: Icon, label, value, wide = false, mono = false }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon size={15} />
        {label}
      </div>
      <div className={`mt-2 break-words font-semibold text-slate-900 ${mono ? "font-mono text-sm" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

export default function Verification() {
  const { certificateId } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResult(null);
    verifyCertificatePublicly(certificateId).then((data) => {
      if (active) setResult(data);
    }).catch(() => {
      if (active) setResult({ ok: false, state: "UNAVAILABLE", error: "Certificate verification is temporarily unavailable." });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [certificateId]);

  const id = String(certificateId || "").trim().toUpperCase();
  const certificate = result?.certificate || null;
  const state = result?.state || (result?.status === 404 ? "NOT_FOUND" : "UNAVAILABLE");
  const config = STATES[state];
  const Icon = config?.icon || XCircle;
  const publicUrlIsLocal = isLocalVerificationUrl();

  const copyId = async () => {
    try { await navigator.clipboard?.writeText(id); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><ShieldCheck size={21} /></span>
            <span><b className="block text-sm">CertiChain</b><small className="text-xs text-slate-400">Public Certificate Verification</small></span>
          </Link>
          <Link to="/verify" className="flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16} /> Verify another</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
        {publicUrlIsLocal && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            QR testing note: this portal is using <span className="font-mono">{getPublicAppUrl()}</span>. Use the deployed HTTPS portal for phone-camera or Google Lens verification.
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="mt-4 text-sm text-slate-500">Checking certificate authenticity…</p>
          </div>
        )}

        {!loading && (state === "NOT_FOUND" || !result?.ok) && (
          <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600"><XCircle size={34} /></div>
            <h1 className="mt-6 text-3xl font-bold">{state === "NOT_FOUND" ? "Certificate not found" : "Verification temporarily unavailable"}</h1>
            <p className="mt-3 text-slate-500">{result?.error || `No CertiChain record was found for ${id}.`}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-sm">{id}<button onClick={copyId} className="text-blue-600">{copied ? "Copied" : <Copy size={15} />}</button></div>
            <Link to="/verify" className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"><Search size={16} className="mr-2" /> Verify another certificate</Link>
          </div>
        )}

        {!loading && result?.ok && certificate && (
          <div className="space-y-5">
            {/* QR verification result: intentionally no certificate preview or status seal. */}
            <section className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${config?.shell || "border-slate-200 bg-white"}`}>
              <div className="flex flex-col items-center text-center">
                <div className={`flex h-20 w-20 items-center justify-center rounded-full shadow-sm ${config?.iconShell || "bg-slate-600 text-white"}`}>
                  <Icon size={40} strokeWidth={2.4} />
                </div>
                <div className={`mt-5 inline-flex items-center rounded-full border px-5 py-2 text-sm font-black tracking-[0.16em] ${config?.badge || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                  {config?.label || state}
                </div>
                <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{config?.title || "Certificate Verification"}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{config?.message || "The certificate verification result is shown below."}</p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 font-mono text-sm shadow-sm">
                  <Hash size={15} className="text-slate-400" /> {certificate.id}
                  <button onClick={copyId} className="ml-1 text-blue-600" aria-label="Copy certificate ID">{copied ? "Copied" : <Copy size={15} />}</button>
                </div>
              </div>
            </section>

            {/* Full public certificate details. Email is intentionally omitted because public verification must not expose participant email. */}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="border-b border-slate-100 pb-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Certificate details</div>
                <h2 className="mt-1 text-2xl font-bold">Complete verification information</h2>
                <p className="mt-2 text-sm text-slate-500">All publicly available certificate and verification details are shown below.</p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Detail icon={Hash} label="Certificate ID" value={certificate.id} mono />
                <Detail icon={UserRound} label="Recipient" value={certificate.name} />
                <Detail icon={GraduationCap} label="Course / Certificate" value={certificate.course} />
                <Detail icon={FileKey2} label="Template" value={certificate.templateName} />
                <Detail icon={CalendarDays} label="Issued date" value={formatDate(certificate.issuedAt)} />
                <Detail icon={Building2} label="Issued by" value={certificate.createdByName} />
                <Detail icon={Blocks} label="Blockchain network" value={certificate.blockchainNetwork || "Ethereum Sepolia"} />
                <Detail icon={CheckCircle2} label="Blockchain status" value={certificate.blockchainStatus || "Not registered"} />
                <Detail icon={Link2} label="Transaction hash" value={certificate.transactionHash} mono wide />
                <Detail icon={Hash} label="Block number" value={certificate.blockNumber} mono />
                <Detail icon={FileKey2} label="Certificate hash" value={certificate.certificateHash} mono />
                <Detail icon={Link2} label="IPFS CID" value={certificate.ipfsCid} mono wide />
              </div>

              {state === "DISQUALIFIED" && certificate.disqualificationReason && (
                <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-800">
                  <div className="font-bold">Disqualification reason</div>
                  <div className="mt-1">{certificate.disqualificationReason}</div>
                  {certificate.disqualifiedAt && <div className="mt-2 text-xs">Disqualified: {formatDate(certificate.disqualifiedAt)}</div>}
                </div>
              )}

              {state === "REVOKED" && certificate.revocationReason && (
                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-5 text-sm text-amber-800">
                  <div className="font-bold">Revocation reason</div>
                  <div className="mt-1">{certificate.revocationReason}</div>
                  {certificate.blockchainRevokedAt && <div className="mt-2 text-xs">Revoked: {formatDate(certificate.blockchainRevokedAt)}</div>}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 shrink-0 text-blue-700" size={20} />
                <div>
                  <h2 className="font-bold text-blue-950">QR verification</h2>
                  <p className="mt-1 text-sm leading-6 text-blue-900/75">This page is the public result opened by scanning the certificate QR code. No account or login is required.</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/verify" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"><Search size={16} /> Verify another certificate</Link>
                <button onClick={copyId} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-900"><Copy size={16} /> {copied ? "Copied" : "Copy Certificate ID"}</button>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
