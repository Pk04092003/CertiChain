import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import JSZip from "jszip";
import Papa from "papaparse";
import { verifyCertificatePublicly } from "../verificationUrl";
import { ShieldCheck, Search, ArrowLeft, ScanLine, Camera, X, FileArchive, Upload, Download, LoaderCircle } from "lucide-react";

export default function VerificationSearch() {
  const [id, setId] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const [zipFile, setZipFile] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkResults, setBulkResults] = useState([]);
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

  const verifyZip = async () => {
    if (!zipFile) { setBulkError("Choose a ZIP file containing certificate PDFs or a manifest.csv file."); return; }
    if (zipFile.size > 50 * 1024 * 1024) { setBulkError("ZIP file is larger than 50 MB. Please upload a smaller ZIP."); return; }
    setBulkBusy(true); setBulkError(""); setBulkResults([]);
    try {
      const archive = await JSZip.loadAsync(zipFile, { checkCRC32: true });
      const entries = Object.values(archive.files).filter((f) => !f.dir && !f.name.startsWith("__MACOSX/") && !f.name.split("/").pop().startsWith("."));
      if (entries.length > 200) throw new Error("The ZIP contains more than 200 files. Please split it into smaller ZIP files.");
      const manifest = entries.find((f) => /(^|\/)manifest\.csv$/i.test(f.name));
      const candidates = [];
      if (manifest) {
        const csv = await manifest.async("text");
        const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
        if (parsed.errors?.length && !parsed.data.length) throw new Error("manifest.csv could not be read. Use a header named certificateId, certificate_id, id, or Certificate ID.");
        for (const row of parsed.data) {
          const key = Object.keys(row).find((k) => /^(certificate\s*id|certificate_id|certificateid|id)$/i.test(k.trim()));
          const value = key ? String(row[key] || "").trim() : "";
          if (value) candidates.push({ id: value, file: "manifest.csv" });
        }
        if (!candidates.length) throw new Error("No certificate IDs were found in manifest.csv. Add a certificateId column and one ID per row.");
      } else {
        for (const entry of entries.filter((f) => /\.pdf$/i.test(f.name))) {
          const stem = entry.name.split("/").pop().replace(/\.pdf$/i, "").trim();
          // Accept IDs as the PDF filename, e.g. CERT-2026-000001.pdf.
          if (/^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$/.test(stem)) candidates.push({ id: stem, file: entry.name });
        }
        if (!candidates.length) throw new Error("No certificate IDs found. Name each PDF with its exact certificate ID (for example CERT-2026-000001.pdf), or include a manifest.csv with a certificateId column.");
      }
      const unique = [...new Map(candidates.map((x) => [x.id.toUpperCase(), x])).values()];
      if (unique.length > 200) throw new Error("The ZIP contains more than 200 certificate IDs. Please split it into smaller ZIP files.");
      const results = [];
      for (let i = 0; i < unique.length; i += 5) {
        const batch = unique.slice(i, i + 5);
        const checked = await Promise.all(batch.map(async (item) => {
          const response = await verifyCertificatePublicly(item.id);
          const state = response.ok ? String(response.state || response.certificate?.verificationStatus || "UNREGISTERED").toUpperCase() : response.state === "NOT_FOUND" ? "NOT FOUND" : "UNAVAILABLE";
          return { ...item, state, name: response.certificate?.name || response.certificate?.publicFields?.name || "—", course: response.certificate?.course || "—", message: response.ok ? "" : (response.error || "Verification request failed") };
        }));
        results.push(...checked); setBulkResults([...results]);
      }
    } catch (error) {
      setBulkError(error?.message || "Could not read this ZIP file.");
    } finally { setBulkBusy(false); }
  };

  const downloadBulkReport = () => {
    const csv = Papa.unparse(bulkResults.map(({ id, file, state, name, course, message }) => ({ certificateId: id, sourceFile: file, result: state, recipient: name, certificate: course, details: message })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "certichain-bulk-verification-report.csv"; a.click(); URL.revokeObjectURL(url);
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

          <section className="mt-10 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5 text-left sm:p-7">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-indigo-600 p-3 text-white"><FileArchive size={23} /></div>
              <div><h2 className="text-xl font-bold text-slate-900">Bulk verify certificates</h2><p className="mt-1 text-sm leading-6 text-slate-600">Upload one ZIP file to check many certificate IDs against CertiChain’s public verification service and download a CSV report.</p></div>
            </div>
            <label className="mt-5 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-indigo-200 bg-white px-4 py-7 text-center hover:border-indigo-400">
              <Upload size={25} className="text-indigo-600" />
              <span className="mt-2 font-semibold text-slate-800">{zipFile ? zipFile.name : "Choose a ZIP file"}</span>
              <span className="mt-1 text-xs text-slate-500">ZIP only · maximum 50 MB · up to 200 certificate IDs</span>
              <input type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => { setZipFile(e.target.files?.[0] || null); setBulkError(""); setBulkResults([]); }} />
            </label>
            <div className="mt-4 rounded-xl bg-white/80 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">ZIP format</p>
              <ul className="mt-2 list-disc space-y-1 pl-5"><li>Option 1: PDFs named with their exact IDs, such as <code>CERT-2026-000001.pdf</code>.</li><li>Option 2: Include <code>manifest.csv</code> with a <code>certificateId</code> column and one ID per row.</li><li>Checks status against the live public verification service; it does not validate the visual contents of each PDF.</li></ul>
            </div>
            {bulkError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{bulkError}</p>}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" disabled={!zipFile || bulkBusy} onClick={verifyZip} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{bulkBusy ? <><LoaderCircle size={18} className="animate-spin" /> Verifying…</> : <><ShieldCheck size={18} /> Verify ZIP certificates</>}</button>
              {bulkResults.length > 0 && <button type="button" onClick={downloadBulkReport} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700"><Download size={18} /> Download CSV report</button>}
            </div>
            {bulkResults.length > 0 && <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4"><h3 className="font-bold text-slate-900">Bulk verification results</h3><span className="text-xs text-slate-500">{bulkResults.length} checked · {bulkResults.filter((r) => r.state === "VERIFIED").length} verified</span></div>
              <div className="max-h-96 overflow-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Certificate ID</th><th className="p-3">Recipient</th><th className="p-3">Status</th><th className="p-3">Details</th></tr></thead><tbody>{bulkResults.map((r, i) => <tr key={`${r.id}-${i}`} className="border-t border-slate-100"><td className="p-3 font-mono text-xs">{r.id}</td><td className="p-3">{r.name}</td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.state === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : r.state === "REVOKED" || r.state === "DISQUALIFIED" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{r.state}</span></td><td className="max-w-56 p-3 text-xs text-slate-500">{r.message || r.course}</td></tr>)}</tbody></table></div>
            </div>}
          </section>

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
