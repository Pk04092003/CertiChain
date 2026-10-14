import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QRCodeCanvas({ value, size = 120, bgColor = "#ffffff", fgColor = "#111111", level = "H" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: level || "H",
      color: {
        dark: fgColor || "#111111",
        light: bgColor || "#ffffff",
      },
    });
  }, [value, size, bgColor, fgColor, level]);
  return <canvas ref={ref} width={size} height={size} aria-label="Certificate verification QR code" className="rounded-lg bg-white"/>;
}
