import { QRCodeCanvas } from "./QRCodeCanvas";
import { getVerificationUrl } from "../verificationUrl";

export default function CertificatePreview({
  certificateId = "CERT-82931",
  name = "Praveen Kumar",
  course = "Software Engineering",
  grade = "A",
  orientation = "landscape",
}) {
  const landscape = orientation === "landscape";

  return (
    <div
      className={`mx-auto overflow-hidden rounded-3xl border-8 border-slate-900 bg-white shadow-2xl ${
        landscape ? "w-full max-w-3xl" : "w-full max-w-xl"
      }`}
    >
      <div className="m-3 rounded-2xl border-2 border-blue-100 p-6 sm:p-10">
        <div className={`flex items-center justify-between gap-4 ${landscape ? "" : "flex-col"}`}>
          <div className="h-12 w-12 rounded-xl bg-slate-900" />
          <div className="text-center flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
              CertiChain University
            </div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              Certificate of Completion
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50" />
        </div>

        <div className={`${landscape ? "py-10" : "py-7"} text-center`}>
          <div className="text-xs uppercase tracking-[0.35em] text-slate-400">
            This certificate is proudly presented to
          </div>
          <div className={`${landscape ? "text-4xl" : "text-3xl"} mt-4 font-serif font-semibold text-slate-900`}>
            {name}
          </div>
          <div className="mx-auto mt-5 h-px w-32 bg-blue-200" />
          <div className="mt-5 text-slate-500">for successful completion of</div>
          <div className="mt-2 text-xl font-semibold text-slate-800">{course}</div>
          <div className="mt-4 inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            Grade: {grade}
          </div>
        </div>

        <div className={`flex items-end justify-between gap-6 ${landscape ? "" : "flex-col"}`}>
          <div>
            <div className="text-xs text-slate-400">Issued by</div>
            <div className="mt-8 border-t border-slate-300 pt-2 text-sm font-semibold">
              Authorized Institution
            </div>
          </div>

          <div className="text-center">
            <QRCodeCanvas
              value={getVerificationUrl(certificateId)}
              size={92}
            />
            <div className="mt-2 text-[10px] text-slate-400">Scan to verify</div>
          </div>

          <div className={landscape ? "text-right" : "text-center"}>
            <div className="text-xs text-slate-400">Certificate ID</div>
            <div className="mt-1 text-sm font-semibold">{certificateId}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
