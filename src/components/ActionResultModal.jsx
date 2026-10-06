import { CheckCircle2, XCircle, Mail, ShieldCheck, X, ExternalLink, Copy } from "lucide-react";

const TONE = {
  success: {
    icon: CheckCircle2,
    iconWrap: "bg-emerald-100 text-emerald-600",
    accent: "from-emerald-500 to-teal-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  error: {
    icon: XCircle,
    iconWrap: "bg-rose-100 text-rose-600",
    accent: "from-rose-500 to-orange-500",
    badge: "bg-rose-50 text-rose-700 border-rose-100",
  },
  info: {
    icon: Mail,
    iconWrap: "bg-blue-100 text-blue-600",
    accent: "from-blue-500 to-indigo-500",
    badge: "bg-blue-50 text-blue-700 border-blue-100",
  },
};

export default function ActionResultModal({
  open,
  onClose,
  tone = "success",
  title,
  message,
  certificateId,
  recipient,
  details = [],
  primaryLabel = "Done",
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  if (!open) return null;
  const style = TONE[tone] || TONE.success;
  const Icon = style.icon;

  return (
    <div className="cc-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cc-modal-card">
        <div className={`h-1.5 w-full bg-gradient-to-r ${style.accent}`} />
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
          <X size={18} />
        </button>

        <div className="px-6 pb-6 pt-8 text-center sm:px-8">
          <div className="cc-modal-icon mx-auto">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${style.iconWrap}`}>
              <Icon size={34} strokeWidth={2.2} />
            </div>
          </div>
          <div className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">CertiChain</div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
          {message && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{message}</p>}

          {(certificateId || recipient || details.length > 0) && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left">
              {certificateId && (
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Certificate ID</div>
                    <div className="mt-1 break-all font-mono text-sm font-bold text-slate-900">{certificateId}</div>
                  </div>
                  <Copy size={16} className="shrink-0 text-slate-300" />
                </div>
              )}
              {recipient && (
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recipient</div>
                  <div className="mt-1 break-all text-sm font-semibold text-slate-800">{recipient}</div>
                </div>
              )}
              {details.length > 0 && (
                <div className="grid gap-2 px-4 py-3 sm:grid-cols-2">
                  {details.map((item) => (
                    <div key={`${item.label}-${item.value}`} className={`rounded-xl border px-3 py-2.5 ${item.tone === "success" ? style.badge : "border-slate-200 bg-white"}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{item.label}</div>
                      <div className="mt-0.5 text-xs font-bold">{item.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            {secondaryLabel && (
              <button type="button" onClick={onSecondary || onClose} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                {secondaryLabel}
              </button>
            )}
            <button type="button" onClick={onPrimary || onClose} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg`}>
              {primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
