import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Eye } from "lucide-react";
import { login } from "../authStore";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="mx-auto grid min-h-[80vh] max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">
        <div className="hidden bg-blue-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <ShieldCheck size={25} />
              </span>
              <div>
                <b className="block text-lg">CertiChain</b>
                <small className="text-blue-100">Administrator Portal</small>
              </div>
            </div>
            <h1 className="mt-20 text-5xl font-bold leading-tight">Issue trusted certificates.</h1>
            <p className="mt-5 max-w-md text-blue-100">
              Create templates, issue certificates, email PDF credentials, and manage the immutable registry.
            </p>
          </div>
          <div className="text-sm text-blue-100">
            Public viewers do not need an account. They verify certificates using the certificate ID or QR code.
          </div>
        </div>

        <div className="flex items-center p-7 sm:p-10">
          <form onSubmit={submit} className="w-full">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <ShieldCheck />
              </span>
              <div>
                <b>CertiChain</b>
                <div className="text-xs text-slate-400">Admin Portal</div>
              </div>
            </div>

            <h2 className="mt-8 text-2xl font-bold">Admin sign in</h2>
            <p className="mt-1 text-sm text-slate-500">
              Only the administrator has an account. Certificate viewers verify publicly without signing in.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">
                Admin email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-500"
                  placeholder="admin@certichain.local"
                  required
                />
              </label>

              <label className="block text-sm font-semibold">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-500"
                  placeholder="••••••••"
                  required
                />
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button disabled={busy} className="mt-6 flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
              {busy ? "Signing in…" : "Sign in as Admin"}
            </button>

            <Link
              to="/verify"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-semibold text-slate-700"
            >
              <Eye size={17} /> Viewer: Verify a certificate
            </Link>

            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
              <b className="text-slate-700">Administrator access</b>
              <div className="mt-2">Use the administrator email and password configured in the Render Environment Variables.</div>
            </div>

            <Link to="/" className="mt-5 block text-center text-sm font-semibold text-blue-600">
              Back to public portal
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
