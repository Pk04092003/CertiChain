import { Link } from "react-router-dom";
import { ArrowRight, Blocks, QrCode, ShieldCheck, UploadCloud, CheckCircle2, Smartphone } from "lucide-react";

export default function Landing() {
  return <div className="min-h-screen bg-slate-950 text-white">
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600"><ShieldCheck size={22}/></span><span><b className="block">CertiChain</b><small className="text-xs text-slate-400">Blockchain Credential Platform</small></span></Link>
        <div className="flex items-center gap-3"><Link to="/verify" className="hidden rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 sm:block">Verify Certificate</Link><Link to="/login" className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950">Admin Login</Link></div>
      </div>
    </header>
    <main>
      <section className="relative overflow-hidden"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,.24),transparent_42%)]"/>
        <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-24 lg:pt-32">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm text-blue-200"><Blocks size={16}/>Blockchain-powered certificates</div>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">Issue certificates.<br/><span className="text-blue-400">Verify instantly — no login required.</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400">Generate, issue, store and verify digital certificates with Ethereum, IPFS and QR-based authentication in one workflow.</p>
            <div className="mt-9 flex flex-wrap gap-4"><Link to="/login" className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 font-semibold hover:bg-blue-500">Admin: Start issuing <ArrowRight size={18}/></Link><Link to="/verify" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 font-semibold hover:bg-white/10"><QrCode size={18}/> Viewer: Verify certificate</Link></div>
          </div>
          <div className="mt-20 grid gap-5 md:grid-cols-3">
            {[["Template builder","Design reusable certificates with logos, signatures and placeholders.",Blocks],["Bulk issuance","Upload CSV or Excel participant data and generate certificates at scale.",UploadCloud],["Scan to verify","A phone camera or Google Lens opens the public verification page with no account required.",Smartphone]].map(([t,d,I])=><div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><I size={21}/></div><h3 className="font-semibold">{t}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{d}</p></div>)}
          </div>
        </div>
      </section>
      <section className="bg-white py-24 text-slate-900"><div className="mx-auto max-w-7xl px-6"><div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Workflow</p><h2 className="mt-3 text-4xl font-bold">From template to trusted credential</h2></div><div className="mt-12 grid gap-6 md:grid-cols-4">{["Design","Generate","Issue","Verify"].map((x,i)=><div key={x} className="rounded-2xl border border-slate-200 p-6"><div className="text-sm font-bold text-blue-600">0{i+1}</div><div className="mt-7 text-xl font-bold">{x}</div><p className="mt-2 text-sm leading-6 text-slate-500">{["Create a reusable certificate template.","Import participant data and render personalized certificates.","Store on IPFS and anchor identity on Ethereum.","Scan the QR code and check the blockchain-backed record."][i]}</p></div>)}</div></div></section>
    </main>
  </div>;
}
