import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Ban, CheckCircle2, Copy, ExternalLink, Search, ShieldCheck, XCircle, AlertTriangle } from "lucide-react";
import { apiBaseUrl, getPublicAppUrl, isLocalVerificationUrl, verifyCertificatePublicly } from "../verificationUrl";

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
    seal: "border-emerald-500 bg-white text-emerald-700",
    message: "This certificate exists on the CertiChain blockchain and is currently valid.",
  },
  REVOKED: {
    title: "Certificate Revoked",
    label: "REVOKED",
    icon: XCircle,
    shell: "border-amber-200 bg-amber-50",
    seal: "border-amber-500 bg-white text-amber-700",
    message: "This certificate is recorded on the CertiChain blockchain as revoked and should no longer be accepted as valid.",
  },
  DISQUALIFIED: {
    title: "Certificate Disqualified",
    label: "DISQUALIFIED",
    icon: Ban,
    shell: "border-rose-200 bg-rose-50",
    seal: "border-rose-500 bg-white text-rose-700",
    message: "The CertiChain administrator has disqualified this certificate. It is no longer valid.",
  },
  UNREGISTERED: {
    title: "Certificate Not Registered",
    label: "UNREGISTERED",
    icon: AlertTriangle,
    shell: "border-amber-200 bg-amber-50",
    seal: "border-amber-400 bg-white text-amber-700",
    message: "A public certificate record exists, but the certificate is not currently registered on the blockchain.",
  },
};

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
  // Use the CertiChain backend as a same-origin PDF proxy. Directly embedding
  // ipfs.io can be blocked by gateway framing/security headers on mobile.
  const documentViewerUrl = certificate?.ipfsCid
    ? `${apiBaseUrl()}/api/public/certificates/${encodeURIComponent(certificate.id || id)}/document`
    : (certificate?.documentUrl || null);

  const copyId = async () => {
    try { await navigator.clipboard?.writeText(id); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
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
            <p className="mt-4 text-sm text-slate-500">Checking the CertiChain blockchain…</p>
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
            <section className={`rounded-3xl border p-6 shadow-sm sm:p-8 ${config?.shell || "border-slate-200 bg-white"}`}>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Public certificate verification</div>
                  <h1 className="mt-2 text-3xl font-bold">{config?.title || "Certificate status"}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">{config?.message || "Certificate status information is available below."}</p>
                </div>
                <div className={`flex min-w-[170px] flex-col items-center justify-center rounded-2xl border-2 px-7 py-5 text-center shadow-sm ${config?.seal || "border-slate-300 bg-white text-slate-700"}`}>
                  <Icon size={34} />
                  <strong className="mt-2 text-lg tracking-widest">{config?.label || state}</strong>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide">CertiChain</span>
                </div>
              </div>
            </section>

            {documentViewerUrl && (
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Open Verified Certificate</div>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">Certificate document</h2>
                    <p className="mt-1 text-xs text-slate-500">The verification seal is displayed directly over the certificate document.</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 text-xs font-extrabold tracking-wider ${config?.seal || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                    {config?.label || state}
                  </span>
                </div>
                <div className="relative mx-auto aspect-[1.414/1] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
                  <iframe title={`${certificate.id} certificate`} src={documentViewerUrl} className="h-full w-full bg-white" />
                  <div className={`cc-status-seal pointer-events-none right-[7%] top-[8%] ${state === "VERIFIED" ? "cc-status-seal-verified" : state === "DISQUALIFIED" ? "cc-status-seal-disqualified" : state === "REVOKED" ? "cc-status-seal-revoked" : "cc-status-seal-unregistered"}`}>
                    <Icon size={29} strokeWidth={2.4} />
                    <strong className="relative z-10 mt-1 text-[15px] font-black tracking-[0.14em]">{config?.label || state}</strong>
                    <span className="relative z-10 mt-0.5 text-[8px] font-bold uppercase tracking-[0.18em]">CertiChain Status</span>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Certificate ID</div>
                  <div className="mt-2 break-all font-mono text-lg font-bold text-slate-900">{certificate.id}</div>
                </div>
                <button onClick={copyId} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">{copied ? "Copied" : <><Copy size={14} /> Copy ID</>}</button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Recipient</div><div className="mt-1 font-semibold">{certificate.name || "—"}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Course / Certificate</div><div className="mt-1 font-semibold">{certificate.course || "—"}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Issued</div><div className="mt-1 font-semibold">{formatDate(certificate.issuedAt)}</div></div>
                <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Blockchain</div><div className="mt-1 font-semibold">{certificate.blockchainStatus || "Not registered"}</div></div>
              </div>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center gap-2 font-semibold text-blue-900"><ShieldCheck size={18} /> Blockchain verification</div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div><span className="text-blue-700/70">Network:</span> <b>{certificate.blockchainNetwork || "Ethereum Sepolia"}</b></div>
                  <div><span className="text-blue-700/70">On-chain status:</span> <b>{certificate.blockchainStatus || "Not registered"}</b></div>
                  <div className="sm:col-span-2 break-all"><span className="text-blue-700/70">Transaction:</span> <b>{certificate.transactionHash || "Registered on blockchain"}</b></div>
                  {certificate.ipfsCid && <div className="sm:col-span-2 break-all"><span className="text-blue-700/70">IPFS CID:</span> <b>{certificate.ipfsCid}</b></div>}
                </div>
              </div>

              {certificate.disqualificationReason && state === "DISQUALIFIED" && (
                <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-800"><b>Disqualification reason:</b> {certificate.disqualificationReason}</div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {documentViewerUrl && (
                  <a href={documentViewerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"><ExternalLink size={16} /> Open Verified Certificate</a>
                )}
                <Link to="/verify" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold"><Search size={16} /> Verify another</Link>
              </div>

              <p className="mt-6 text-xs leading-5 text-slate-400">No account or login is required to verify a certificate. This public page can be opened directly from the QR code using a phone camera or Google Lens.</p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
