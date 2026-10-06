import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "./QRCodeCanvas";
import { getVerificationUrl } from "../verificationUrl";

const PAGE = {
  portrait: {
    width: 794,
    height: 1123,
  },
  landscape: {
    width: 1123,
    height: 794,
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPage(template) {
  const orientation =
    template?.page?.orientation === "portrait" ? "portrait" : "landscape";

  return {
    ...PAGE[orientation],
    orientation,
  };
}

function valueForKey(form, key) {
  const exact = form?.[key];
  if (exact !== undefined && exact !== null) return String(exact);

  const lower = String(key).toLowerCase();
  const found = Object.entries(form || {}).find(
    ([formKey]) => String(formKey).toLowerCase() === lower
  );

  return found ? String(found[1] ?? "") : "";
}

function replaceVariables(text, form) {
  return String(text ?? "").replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, key) => escapeHtml(valueForKey(form, key))
  );
}

function replaceVariablesInHtml(html, form) {
  let result = String(html ?? "");

  Object.entries(form || {}).forEach(([key, value]) => {
    const safeValue = escapeHtml(value ?? "");
    const pattern = new RegExp(
      `\\{\\{\\s*${String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`,
      "g"
    );

    result = result.replace(pattern, safeValue);
  });

  return result;
}

function sanitizeHtml(html) {
  if (!html) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html), "text/html");
  const allowedTags = new Set([
    "DIV",
    "P",
    "BR",
    "SPAN",
    "B",
    "STRONG",
    "I",
    "EM",
    "U",
  ]);

  const safe = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.nodeValue || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toUpperCase();
    if (tag === "BR") return "<br />";

    const outputTag = allowedTags.has(tag) ? tag.toLowerCase() : "span";

    const text = Array.from(node.childNodes).map(safe).join("");
    const sourceStyle = node.getAttribute("style") || "";
    const styleParts = [];

    const readStyle = (name) => {
      const match = sourceStyle.match(
        new RegExp(`${name}\\s*:\\s*([^;]+)`, "i")
      );
      return match ? match[1].trim() : "";
    };

    const font = readStyle("font-family");
    const size = readStyle("font-size");
    const weight = readStyle("font-weight");
    const color = readStyle("color");
    const align = readStyle("text-align");

    if (font) {
      styleParts.push(`font-family:${escapeHtml(font.replace(/[<>]/g, ""))}`);
    }

    if (size) {
      const numeric = Number.parseFloat(size);
      if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 120) {
        styleParts.push(`font-size:${numeric}px`);
      }
    }

    if (weight && /^(normal|bold|[1-9]00)$/.test(weight)) {
      styleParts.push(`font-weight:${weight}`);
    }

    if (
      color &&
      (/^#[0-9a-fA-F]{3,8}$/.test(color) ||
        /^rgb\(.*\)$/i.test(color) ||
        /^rgba\(.*\)$/i.test(color))
    ) {
      styleParts.push(`color:${color}`);
    }

    if (align && /^(left|center|right|justify)$/.test(align)) {
      styleParts.push(`text-align:${align}`);
    }

    const attrs = styleParts.length ? ` style="${styleParts.join(";")}"` : "";

    return `<${outputTag}${attrs}>${text}</${outputTag}>`;
  };

  return Array.from(doc.body.childNodes).map(safe).join("");
}

function useSheetScale(ref, page, exportMode) {
  const [scale, setScale] = useState(exportMode ? 1 : 1);

  useEffect(() => {
    if (exportMode) {
      setScale(1);
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    const measure = () => {
      const width = node.clientWidth || page.width;
      setScale(Math.min(width / page.width, 1));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, [exportMode, page.width, page.height]);

  return scale;
}

export default function TemplateCertificatePreview({
  template,
  form = {},
  certificateId = "PREVIEW",
  className = "",
  showQr = true,
  exportMode = false,
}) {
  const outerRef = useRef(null);
  const page = getPage(template);
  const scale = useSheetScale(outerRef, page, exportMode);

  const elements = Array.isArray(template?.elements) ? template.elements : [];
  const background = template?.background || "#ffffff";
  const border = template?.border || {};

  const verificationUrl = getVerificationUrl(certificateId);
  const renderForm = useMemo(() => ({
    ...(form || {}),
    certificate_id: certificateId,
    certificateId,
    id: certificateId,
  }), [form, certificateId]);

  const renderedElements = useMemo(
    () =>
      elements.map((item) => {
        const width = Number(item.width || item.radius * 2 || 0);
        const height = Number(item.height || item.radius * 2 || 0);

        return {
          ...item,
          width,
          height,
        };
      }),
    [elements]
  );

  return (
    <div
      ref={outerRef}
      className={`relative mx-auto overflow-hidden bg-slate-100 ${
        exportMode ? "" : "w-full"
      } ${className}`}
      style={
        exportMode
          ? { width: `${page.width}px`, height: `${page.height}px` }
          : {
              width: "100%",
              aspectRatio: `${page.width} / ${page.height}`,
              minHeight: "260px",
            }
      }
    >
      <div
        data-certificate-sheet="true"
        className="absolute left-0 top-0 overflow-hidden bg-white shadow-2xl"
        style={{
          width: `${page.width}px`,
          height: `${page.height}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background,
        }}
      >
        {border.enabled && (
          <div
            className="pointer-events-none absolute z-[200] box-border"
            style={{
              inset: `${Math.max(0, Number(border.inset || 0))}px`,
              borderStyle: border.style || "solid",
              borderWidth: `${Math.max(1, Number(border.width || 1))}px`,
              borderColor: border.color || "#1d4ed8",
              borderRadius: `${Math.max(0, Number(border.radius || 0))}px`,
            }}
          />
        )}

        {renderedElements.map((item) => {
          const rotation = Number(item.rotation || 0);
          const left = Number(item.x || 0) - item.width / 2;
          const top = Number(item.y || 0) - item.height / 2;

          const style = {
            position: "absolute",
            left: `${left}px`,
            top: `${top}px`,
            width: `${item.width}px`,
            height: `${item.height}px`,
            boxSizing: "border-box",
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "center center",
            zIndex: item.designElement ? 10 : 50,
            overflow: "visible",
          };

          if (item.kind === "text") {
            const richHtml =
              item.paragraph && item.html
                ? replaceVariablesInHtml(sanitizeHtml(item.html), renderForm)
                : replaceVariables(item.text || "", renderForm).replace(
                    /\n/g,
                    "<br />"
                  );

            return (
              <div key={item.id} style={style}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      item.align === "left"
                        ? "flex-start"
                        : item.align === "right"
                          ? "flex-end"
                          : "center",
                    padding: "2px 4px",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    fontFamily: item.fontFamily || "Arial",
                    fontSize: `${Number(item.fontSize ?? 24)}px`,
                    fontWeight: item.fontWeight || "400",
                    color: item.fill || "#111827",
                    lineHeight: item.lineHeight || 1.2,
                    textAlign: item.align || "center",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxHeight: "100%",
                      overflow: "hidden",
                    }}
                    dangerouslySetInnerHTML={{ __html: richHtml }}
                  />
                </div>
              </div>
            );
          }

          if (item.kind === "image") {
            return (
              <div key={item.id} style={style}>
                <img
                  src={item.src}
                  alt="Template image"
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: item.objectFit || "contain",
                    display: "block",
                  }}
                />
              </div>
            );
          }

          if (item.kind === "qr") {
            return (
              <div
                key={item.id}
                style={{
                  ...style,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {showQr ? (
                  <QRCodeCanvas
                    value={verificationUrl}
                    size={Math.max(
                      40,
                      Math.round(
                        Math.min(item.width || 120, item.height || 120)
                      )
                    )}
                    bgColor="#ffffff"
                    fgColor="#111111"
                    level="H"
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "1px dashed #cbd5e1",
                    }}
                  />
                )}
              </div>
            );
          }

          if (item.kind === "rect") {
            return (
              <div
                key={item.id}
                style={{
                  ...style,
                  background: item.fill || "transparent",
                  borderRadius: item.radius || 0,
                }}
              />
            );
          }

          if (item.kind === "circle") {
            return (
              <div
                key={item.id}
                style={{
                  ...style,
                  borderRadius: "50%",
                  background: item.fill || "transparent",
                }}
              />
            );
          }

          if (item.kind === "line") {
            const dx = Number(item.x2 || 0) - Number(item.x1 || 0);
            const dy = Number(item.y2 || 0) - Number(item.y1 || 0);
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  left: `${Number(item.x1 || 0)}px`,
                  top: `${Number(item.y1 || 0)}px`,
                  width: `${length}px`,
                  height: `${Math.max(1, Number(item.strokeWidth || 2))}px`,
                  background: item.stroke || "#111827",
                  transformOrigin: "0 50%",
                  transform: `rotate(${angle}deg)`,
                  zIndex: item.designElement ? 10 : 50,
                }}
              />
            );
          }

          return null;
        })}

        <div
          data-certificate-id="true"
          className="pointer-events-none absolute"
          style={{
            left: `${Math.max(22, page.width * 0.055)}px`,
            bottom: `${Math.max(16, page.height * 0.045)}px`,
            right: `${Math.max(22, page.width * 0.055)}px`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 250,
            fontFamily: "Arial, sans-serif",
            fontSize: `${Math.max(11, Math.round(page.width * 0.0105))}px`,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "#334155",
          }}
        >
          <span style={{ display: "inline-block", padding: "5px 11px", border: "1px solid rgba(100,116,139,.35)", borderRadius: "999px", background: "rgba(255,255,255,.92)", boxShadow: "0 1px 3px rgba(15,23,42,.08)" }}>
            Certificate ID: {certificateId}
          </span>
        </div>
      </div>

      {!exportMode && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white">
          {page.orientation === "portrait" ? "Portrait" : "Landscape"} • A4
        </div>
      )}
    </div>
  );
}
