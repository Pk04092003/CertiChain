import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

export function getCertificateSheet(container) {
  return container?.querySelector?.('[data-certificate-sheet="true"]') || null;
}

export async function captureCertificatePng(container) {
  const sheet = getCertificateSheet(container);
  if (!sheet) throw new Error("Certificate preview is not ready.");
  try { await document.fonts?.ready; } catch {}
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return toPng(sheet, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
}

export async function certificatePngToPdf(dataUrl, orientation = "landscape") {
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(dataUrl, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
  return pdf.output("blob");
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDataUrl(dataUrl, filename) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}
