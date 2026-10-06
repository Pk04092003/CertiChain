import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck, Mail, LockKeyhole } from "lucide-react";
import { login, loadUsers } from "../authStore";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@certichain.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    setBusy(true); setError("");
    try { login(email, password); navigate("/dashboard"); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-900">
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
      <section className="hidden bg-blue-600 p-10 text-white md:block"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><ShieldCheck size={26}/></div><div><b className="block text-lg">CertiChain</b><span className="text-xs text-blue-100">Institution certificate platform</span></div></div><h1 className="mt-16 text-4xl font-bold leading-tight">Issue, verify and manage trusted certificates.</h1><p className="mt-5 max-w-sm text-blue-100">Templates, bulk CSV issuance, email delivery, QR verification, audit history and analytics in one portal.</p></section>
      <form onSubmit={submit} className="p-7 sm:p-10"><div className="flex items-center gap-3 md:hidden"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white"><ShieldCheck/></div><div><b>CertiChain</b><div className="text-xs text-slate-400">Institution Portal</div></div></div><h2 className="mt-6 text-2xl font-bold">Sign in</h2><p className="mt-1 text-sm text-slate-500">Use an Institution Admin, Issuer or Viewer account.</p>
        <label className="mt-7 block text-sm font-semibold">Email<div className="relative mt-2"><Mail className="absolute left-3 top-3.5 text-slate-400" size={18}/><input value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 outline-none focus:border-blue-500"/></div></label>
        <label className="mt-4 block text-sm font-semibold">Password<div className="relative mt-2"><LockKeyhole className="absolute left-3 top-3.5 text-slate-400" size={18}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 outline-none focus:border-blue-500"/></div></label>
        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        <button disabled={busy} className="mt-6 w-full rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-500"><b className="text-slate-700">Demo accounts</b><div className="mt-2">Admin: admin@certichain.local / admin123</div><div>Issuer: issuer@certichain.local / issuer123</div><div>Viewer: viewer@certichain.local / viewer123</div></div>
        <Link to="/" className="mt-5 block text-center text-sm font-semibold text-blue-600">Back to public portal</Link>
      </form>
    </div>
  </div>;
}
