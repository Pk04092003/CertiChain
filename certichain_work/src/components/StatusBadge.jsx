export default function StatusBadge({ status }) {
  const map = {
    Issued: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Pending: "bg-amber-50 text-amber-700 border-amber-100",
    Revoked: "bg-rose-50 text-rose-700 border-rose-100",
    Disqualified: "bg-rose-50 text-rose-700 border-rose-100",
    Failed: "bg-slate-100 text-slate-700 border-slate-200"
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${map[status] || map.Failed}`}>{status}</span>;
}
