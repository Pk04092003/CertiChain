import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Search, ArrowLeft, ScanLine } from "lucide-react";

export default function VerificationSearch() {
  const [id, setId] = useState("");
  const nav = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    const value = id.trim();
    if (value) nav(`/verify/${encodeURIComponent(value)}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-2xl sm:p-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
            <ArrowLeft size={16} /> CertiChain
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            <ShieldCheck size={15} /> Viewer — Public verification
          </span>
        </div>

        <div className="mx-auto mt-16 max-w-2xl text-center">
          <ShieldCheck className="mx-auto text-blue-600" size={52} />
          <h1 className="mt-5 text-4xl font-bold">Verify a certificate</h1>
          <p className="mt-3 text-slate-500">
            Enter the certificate ID printed on the certificate, or scan the QR code with your phone camera or Google Lens.
          </p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="CERT-2026-000001"
                className="w-full rounded-xl border border-slate-200 py-3.5 pl-10 pr-3 outline-none focus:border-blue-500"
              />
            </div>
            <button className="rounded-xl bg-blue-600 px-6 py-3.5 font-semibold text-white">
              Verify certificate
            </button>
          </form>

          <div className="mt-8 grid gap-4 text-left sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 font-semibold">
                <Search size={18} className="text-blue-600" /> Certificate ID
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Enter the ID printed on the certificate to view the public verification result.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 font-semibold">
                <ScanLine size={18} className="text-emerald-600" /> QR / Google Lens
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Scan the QR code. It contains the public HTTPS verification URL, so Google Lens can open the result directly.
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-left text-sm text-slate-600">
            <b className="text-slate-800">Viewer access</b>
            <p className="mt-1">
              No account, password, or registration is required. Verification is read-only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
