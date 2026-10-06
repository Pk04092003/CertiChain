export default function StatCard({ label, value, note }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="text-sm text-slate-500">{label}</div>
    <div className="mt-3 flex items-end justify-between">
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      <div className="text-xs font-semibold text-emerald-600">{note}</div>
    </div>
  </div>;
}
