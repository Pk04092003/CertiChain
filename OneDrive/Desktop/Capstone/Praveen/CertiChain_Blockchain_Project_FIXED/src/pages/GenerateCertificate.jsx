import Layout from "../components/Layout";
import CertificatePreview from "../components/CertificatePreview";
import { demoCertificates } from "../data";
import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, ArrowRight, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getVerificationUrl } from "../verificationUrl";

const STORAGE_KEY = "certichain-template-v2";

function makeId(name, course) {
  const clean = `${name}-${course}-${Date.now()}`.replace(/[^a-zA-Z0-9-]/g, "-").toUpperCase();
  return `CERT-${clean.slice(0, 18)}`;
}

export default function GenerateCertificate() {
  const [orientation, setOrientation] = useState("landscape");
  const [variables, setVariables] = useState([]);
  const [form, setForm] = useState({
    name: "Praveen Kumar",
    email: "praveen@example.com",
    course: "Software Engineering",
    grade: "A",
  });
  const [generatedId, setGeneratedId] = useState("");
  const previewRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      setOrientation(saved.orientation || "landscape");
      const vars = Array.isArray(saved.variables) ? saved.variables : [];
      setVariables(vars);
      setForm((current) => {
        const next = { ...current };
        vars.forEach(v => { if (next[v.key] === undefined) next[v.key] = ""; });
        return next;
      });
    } catch {}
  }, []);

  const update = (key, value) => setForm(v => ({ ...v, [key]: value }));
  const id = generatedId || demoCertificates[0].id;

  const generate = () => setGeneratedId(makeId(form.name || "Recipient", form.course || "Certificate"));

  const downloadPng = async () => {
    if (!previewRef.current) return;
    const dataUrl = await toPng(previewRef.current, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.download = `${id}.png`;
    a.href = dataUrl;
    a.click();
  };

  return <Layout title="Generate Certificate" subtitle="Personalized certificate rendering">
    <div className="mb-5 flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex items-center gap-3">
        <Settings2 size={19} className="text-blue-600"/>
        <div><b className="text-sm">Template settings</b><p className="text-xs text-slate-500">{orientation === "landscape" ? "Landscape" : "Portrait"} • {variables.length} customizable variables</p></div>
      </div>
      <Link to="/templates/new" className="text-sm font-semibold text-blue-700">Edit template</Link>
    </div>

    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Participant data</h2>
        <p className="mt-1 text-sm text-slate-500">Only variables defined by the issuer appear here.</p>
        <div className="mt-6 space-y-4">
          {(variables.length ? variables : [
            {key:"name",label:"Recipient Name",type:"text",required:true},
            {key:"email",label:"Email Address",type:"email",required:true},
            {key:"course",label:"Course",type:"text",required:true},
            {key:"grade",label:"Grade",type:"text",required:false}
          ]).map(v => <label key={v.key} className="block text-sm"><span className="font-medium text-slate-600">{v.label} <span className="font-mono text-xs text-blue-600">{`{{${v.key}}}`}</span></span><input type={v.type==="email"?"email":v.type==="number"?"number":v.type==="date"?"date":"text"} value={form[v.key] || ""} onChange={e=>update(v.key,e.target.value)} required={v.required} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400"/></label>)}
        </div>
        <button onClick={generate} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white hover:bg-blue-500">Generate certificate <ArrowRight size={17}/></button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-bold text-slate-900">Live certificate preview</h2><p className="text-xs text-slate-500">The QR target uses the certificate ID and public verification route.</p></div>
          <div className="flex gap-2"><button onClick={downloadPng} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Download size={16}/> PNG</button><Link to={`/verify/${id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Verify</Link></div>
        </div>
        <div ref={previewRef} className="rounded-3xl bg-slate-100 p-2 sm:p-4">
          <CertificatePreview certificateId={id} name={form.name || "Recipient"} course={form.course || "Course"} grade={form.grade || "—"} orientation={orientation}/>
        </div>
        <div className="mt-4 text-center text-xs text-slate-400">QR target: <span className="font-mono text-slate-600">{getVerificationUrl(id)}</span></div>
      </section>
    </div>
  </Layout>;
}
