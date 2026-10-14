import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, UploadCloud, ShieldCheck, Settings, LogOut, Menu, X,
  BarChart3, ClipboardList, UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getSessionUser, logout } from "../authStore";

const items = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/templates", "Templates", FileText],
  ["/issue-certificate", "Issue Certificate", UploadCloud],
  ["/certificates", "Issued Certificates", ShieldCheck],
  ["/analytics", "Analytics", BarChart3],
  ["/audit-logs", "Audit Logs", ClipboardList],
  ["/settings", "Settings", Settings],
];

export default function Layout({ children, title = "Dashboard", subtitle = "Institution certificate management" }) {
  const [open, setOpen] = useState(false);
  const session = getSessionUser();
  const [authorized, setAuthorized] = useState(Boolean(session));
  const [user, setUser] = useState(session || { name: "CertiChain Admin", email: "Local session", role: "Admin" });
  const navigate = useNavigate();

  useEffect(() => {
    const refresh = () => {
      const current = getSessionUser();
      setAuthorized(Boolean(current));
      setUser(current || { name: "CertiChain Admin", email: "Local session", role: "Admin" });
      if (!current) navigate("/login", { replace: true });
    };
    if (!getSessionUser()) navigate("/login", { replace: true });
    window.addEventListener("certichain:auth-updated", refresh);
    return () => window.removeEventListener("certichain:auth-updated", refresh);
  }, [navigate]);

  const signOut = () => {
    logout();
    navigate("/login");
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] border-r border-slate-200 bg-white transition-transform ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-5">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><ShieldCheck size={22} /></span>
            <span className="min-w-0"><b className="block truncate text-sm text-slate-900">CertiChain</b><small className="block truncate text-xs text-slate-400">Admin Portal</small></span>
          </Link>
        </div>
        <nav className="space-y-1 overflow-y-auto p-4 pb-24">
          {items.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2"><UserRound size={16} className="text-slate-400" /><div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-800">{user.name}</div><div className="truncate text-[10px] text-slate-400">{user.role}</div></div></div>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50"><LogOut size={18} /> Sign out</button>
        </div>
      </aside>

      <div className="w-full min-w-0 md:pl-64">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 w-full items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button className="shrink-0 rounded-lg p-2 hover:bg-slate-100 md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
              <div className="min-w-0"><div className="truncate text-xs font-medium text-slate-400">{subtitle}</div><h1 className="truncate text-xl font-bold text-slate-900">{title}</h1></div>
            </div>
            <div className="hidden shrink-0 items-center gap-3 sm:flex"><span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Sepolia</span><div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600"><b>{user.name}</b><span className="ml-2 text-slate-400">{user.role}</span></div></div>
          </div>
        </header>
        <main className="w-full min-w-0 overflow-x-hidden p-3 sm:p-4 lg:p-5">{children}</main>
      </div>
    </div>
  );
}
