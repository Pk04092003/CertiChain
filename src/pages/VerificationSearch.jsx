import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Search, ArrowLeft, ScanLine, Camera, X } from "lucide-react";

export default function VerificationSearch() {
  const [id, setId] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!scannerOpen) return;
    let cancelled = false;
    let timer;
    const startScanner = async () => {
      try {
        if (!("BarcodeDetector" in window)) {
          setScanError("Live QR scanning is not supported by this browser. Use your phone camera or Google Lens to scan the certificate QR code.");
          return;
        }
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.length && codes[0].rawValue) {
              const raw = codes[0].rawValue;
              stopScanner();
              if (/^https?:\/\//i.test(raw)) window.location.assign(raw);
              else nav(`/verify/${encodeURIComponent(raw.trim())}`);
              return;
            }
          } catch { /* Camera frames can be temporarily unreadable. */ }
          timer = window.setTimeout(scan, 250);
        };
        scan();
      } catch {
        setScanError("Could not access the camera. Allow camera permission and open this page over HTTPS, then try again.");
      }
    };
    startScanner();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [scannerOpen, nav]);

  const stopScanner = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScannerOpen(false);
  };

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

          <div className="mt-4">
            <button type="button" onClick={() => { setScanError(""); setScannerOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-3 font-semibold text-emerald-800 hover:bg-emerald-100">
              <Camera size={18} /> Scan QR with camera
            </button>
          </div>

          {scannerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
              <div role="dialog" aria-modal="true" aria-label="Scan certificate QR code" className="w-full max-w-lg rounded-3xl bg-white p-5 text-left shadow-2xl">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Scan certificate QR code</h2>
                  <button type="button" onClick={stopScanner} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close scanner"><X size={20} /></button>
                </div>
                <p className="mt-2 text-sm text-slate-500">Allow camera access and hold the QR code inside the frame.</p>
                <video ref={videoRef} className="mt-4 aspect-video w-full rounded-2xl bg-slate-950 object-cover" muted playsInline />
                {scanError && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{scanError}</p>}
                <button type="button" onClick={stopScanner} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700">Cancel scan</button>
              </div>
            </div>
          )}

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
