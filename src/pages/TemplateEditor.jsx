import Layout from "../components/Layout";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  Save,
  Type,
  Image as ImageIcon,
  QrCode,
  Plus,
  Trash2,
  GripVertical,
  Check,
  Monitor,
  Smartphone,
  Ruler,
  Palette,
  Square,
  Minus,
  CircleDot,
  Undo2,
  Redo2,
  Upload,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { addAuditLog } from "../auditStore";
import { getSessionUser } from "../authStore";

const PAGE = {
  portrait: {
    width: 794,
    height: 1123,
    mmWidth: 210,
    mmHeight: 297,
  },
  landscape: {
    width: 1123,
    height: 794,
    mmWidth: 297,
    mmHeight: 210,
  },
};

const DESIGNS = [
  { id: "blank", name: "Blank", description: "Start completely from scratch" },
  { id: "classic-blue", name: "Classic Blue", description: "Formal academic certificate" },
  { id: "elegant-gold", name: "Elegant Gold", description: "Premium ceremonial style" },
  { id: "academic-green", name: "Academic Green", description: "Traditional institutional style" },
  { id: "modern-navy", name: "Modern Navy", description: "Clean contemporary layout" },
  { id: "royal-purple", name: "Royal Purple", description: "Elegant achievement theme" },
];

const FONT_OPTIONS = [
  "Arial",
  "Helvetica",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Calibri",
  "Segoe UI",
  "Georgia",
  "Times New Roman",
  "Garamond",
  "Cambria",
  "Palatino Linotype",
  "Courier New",
  "Consolas",
  "Impact",
  "Arial Black",
  "Lucida Handwriting",
];

const DEFAULT_BORDER = {
  enabled: false,
  style: "solid",
  width: 2,
  color: "#1d4ed8",
  inset: 28,
  radius: 0,
};

function uid(prefix = "obj") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isTextElement(item) {
  return item?.kind === "text";
}

function designColor(id) {
  return {
    blank: "#cbd5e1",
    "classic-blue": "#1d4ed8",
    "elegant-gold": "#b88917",
    "academic-green": "#166534",
    "modern-navy": "#0f172a",
    "royal-purple": "#6d28d9",
  }[id] || "#1d4ed8";
}

function designBackground(id) {
  return {
    blank: "#ffffff",
    "classic-blue": "#f8fbff",
    "elegant-gold": "#fffdf7",
    "academic-green": "#f8fff9",
    "modern-navy": "#f8fafc",
    "royal-purple": "#fbf8ff",
  }[id] || "#ffffff";
}

function designName(id) {
  return DESIGNS.find((item) => item.id === id)?.name || "Blank";
}

function makeRuns(text, style = {}) {
  const source = String(text || "");
  if (!source) return [];

  return source
    .split(/(\s+)/)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      fontFamily: style.fontFamily || "Georgia",
      fontSize: Number(style.fontSize ?? 20),
      fontWeight: String(style.fontWeight || "400"),
      fill: style.fill || "#334155",
    }));
}

function runsToText(runs) {
  return (runs || []).map((run) => run.text || "").join("");
}

function normalizeRuns(item) {
  const fallback = {
    fontFamily: item?.fontFamily || "Georgia",
    fontSize: item?.fontSize || 20,
    fontWeight: item?.fontWeight || "400",
    fill: item?.fill || "#334155",
  };

  if (Array.isArray(item?.runs) && item.runs.length) {
    return item.runs.map((run) => ({
      text: String(run.text ?? ""),
      fontFamily: run.fontFamily || fallback.fontFamily,
      fontSize: Number(run.fontSize ?? fallback.fontSize),
      fontWeight: String(run.fontWeight || fallback.fontWeight),
      fill: run.fill || fallback.fill,
    }));
  }

  return makeRuns(item?.text || "", fallback);
}

function formattingRuns(item) {
  return normalizeRuns(item).filter(
    (run) => String(run.text || "").trim().length > 0
  );
}


function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeRichHtml(html) {
  if (!html) return "";

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(String(html), "text/html");
  const allowedTags = new Set(["DIV", "P", "BR", "SPAN", "B", "STRONG", "I", "EM", "U"]);

  const cleanNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.nodeValue || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toUpperCase();

    if (tag === "BR") {
      return "<br />";
    }

    const safeTag = allowedTags.has(tag) ? tag.toLowerCase() : "span";

    const text = Array.from(node.childNodes)
      .map(cleanNode)
      .join("");

    if (safeTag === "span" || safeTag === "b" || safeTag === "strong" ||
        safeTag === "i" || safeTag === "em" || safeTag === "u" ||
        safeTag === "div" || safeTag === "p") {
      const styleParts = [];

      const style = node.getAttribute("style") || "";

      const readStyle = (name) => {
        const match = style.match(
          new RegExp(`${name.replace("-", "\\-")}\\s*:\\s*([^;]+)`, "i")
        );
        return match ? match[1].trim() : "";
      };

      const font = readStyle("font-family");
      const size = readStyle("font-size");
      const weight = readStyle("font-weight");
      const color = readStyle("color");
      const align = readStyle("text-align");

      if (font) {
        const safeFont = font
          .replace(/[\r\n]/g, "")
          .replace(/[<>]/g, "")
          .trim();

        if (safeFont) {
          styleParts.push(`font-family:${escapeHtml(safeFont)}`);
        }
      }
      if (size && /^\d+(\.\d+)?px$/.test(size)) {
        const numericSize = Number.parseFloat(size);
        if (Number.isFinite(numericSize) && numericSize >= 0 && numericSize <= 120) {
          styleParts.push(`font-size:${numericSize}px`);
        }
      }
      if (weight && /^(normal|bold|[1-9]00)$/.test(weight)) {
        styleParts.push(`font-weight:${weight}`);
      }
      if (
        color &&
        (
          /^#[0-9a-fA-F]{3,8}$/.test(color) ||
          /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(color) ||
          /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)$/i.test(color)
        )
      ) {
        styleParts.push(`color:${color}`);
      }
      if (align && /^(left|center|right|justify)$/.test(align)) {
        styleParts.push(`text-align:${align}`);
      }

      const attrs = styleParts.length
        ? ` style="${styleParts.join(";")}"`
        : "";

      return `<${safeTag}${attrs}>${text}</${safeTag}>`;
    }

    return text;
  };

  return Array.from(documentNode.body.childNodes)
    .map(cleanNode)
    .join("");
}

function buildPreset(designId, width, height) {
  if (designId === "blank") {
    return { background: "#ffffff", elements: [] };
  }

  const p = {
    "classic-blue": {
      bg: "#f8fbff",
      primary: "#1d4ed8",
      secondary: "#93c5fd",
      text: "#0f172a",
      muted: "#475569",
    },
    "elegant-gold": {
      bg: "#fffdf7",
      primary: "#b88917",
      secondary: "#e8d8a4",
      text: "#302814",
      muted: "#725f31",
    },
    "academic-green": {
      bg: "#f8fff9",
      primary: "#166534",
      secondary: "#86efac",
      text: "#12351f",
      muted: "#365314",
    },
    "modern-navy": {
      bg: "#f8fafc",
      primary: "#0f172a",
      secondary: "#94a3b8",
      text: "#0f172a",
      muted: "#475569",
    },
    "royal-purple": {
      bg: "#fbf8ff",
      primary: "#6d28d9",
      secondary: "#c4b5fd",
      text: "#251044",
      muted: "#6b21a8",
    },
  }[designId];

  const cx = width / 2;
  const safeWidth = width * 0.72;

  const addText = (
    text,
    y,
    size,
    fill,
    fontWeight = "400",
    boxWidth = safeWidth
  ) => ({
    id: uid("text"),
    kind: "text",
    text,
    runs: makeRuns(text, {
      fontFamily: "Georgia",
      fontSize: size,
      fontWeight,
      fill,
    }),
    x: cx,
    y,
    width: boxWidth,
    height: Math.max(50, size * 2.5),
    fontSize: size,
    fontFamily: "Georgia",
    fontWeight,
    fill,
    align: "center",
    lineHeight: 1.2,
    editable: true,
    designElement: true,
  });

  const line = (y, left = 0.28, right = 0.72, stroke = p.secondary) => ({
    id: uid("line"),
    kind: "line",
    x1: width * left,
    y1: y,
    x2: width * right,
    y2: y,
    stroke,
    strokeWidth: Math.max(1.5, width * 0.0018),
    designElement: true,
  });

  const elements = [];

  if (designId === "classic-blue") {
    elements.push(
      addText("CERTIFICATE OF ACHIEVEMENT", height * 0.21, width * 0.023, p.primary, "700"),
      addText("Presented with appreciation for", height * 0.30, width * 0.014, p.secondary, "400", safeWidth * 0.80),
      line(height * 0.38, 0.28, 0.72),
      addText("RECIPIENT NAME", height * 0.45, width * 0.026, p.text, "600", safeWidth * 0.88),
      addText("Program / Course", height * 0.55, width * 0.015, p.muted, "400", safeWidth * 0.70)
    );
  }

  if (designId === "elegant-gold") {
    elements.push(
      {
        id: uid("circle"),
        kind: "circle",
        x: cx,
        y: height * 0.13,
        radius: Math.min(width, height) * 0.026,
        fill: p.primary,
        designElement: true,
      },
      addText("✦", height * 0.13, width * 0.018, "#ffffff", "700", 60),
      addText("CERTIFICATE OF EXCELLENCE", height * 0.23, width * 0.024, p.text, "700"),
      addText("This honour is presented to", height * 0.31, width * 0.014, p.primary, "400", safeWidth * 0.76),
      line(height * 0.39, 0.30, 0.70, p.primary),
      addText("RECIPIENT NAME", height * 0.45, width * 0.026, p.text, "600", safeWidth * 0.88)
    );
  }

  if (designId === "academic-green") {
    const bx = width * 0.13;
    const by = height * 0.075;
    const bw = width * 0.74;
    const bh = height * 0.13;

    elements.push(
      {
        id: uid("rect"),
        kind: "rect",
        x: cx,
        y: by + bh / 2,
        width: bw,
        height: bh,
        fill: p.primary,
        radius: 14,
        designElement: true,
      },
      addText("ACADEMIC CERTIFICATE", by + bh / 2, width * 0.021, "#ffffff", "700", bw * 0.82),
      addText("Presented to", height * 0.30, width * 0.014, p.primary, "400", safeWidth * 0.55),
      addText("RECIPIENT NAME", height * 0.38, width * 0.026, p.text, "600", safeWidth * 0.86),
      line(height * 0.47, 0.31, 0.69, p.secondary),
      addText("Course / Program", height * 0.53, width * 0.015, p.muted, "400", safeWidth * 0.68)
    );
  }

  if (designId === "modern-navy") {
    const bx = width * 0.12;
    const by = height * 0.075;
    const bw = width * 0.76;
    const bh = height * 0.14;

    elements.push(
      {
        id: uid("rect"),
        kind: "rect",
        x: cx,
        y: by + bh / 2,
        width: bw,
        height: bh,
        fill: p.primary,
        radius: 14,
        designElement: true,
      },
      addText("CERTIFICATE", by + bh * 0.40, width * 0.023, "#ffffff", "700", bw * 0.80),
      addText("OF ACHIEVEMENT", by + bh * 0.70, width * 0.011, "#cbd5e1", "600", bw * 0.68),
      addText("Recipient Name", height * 0.36, width * 0.026, p.text, "600", safeWidth * 0.86),
      line(height * 0.44, 0.31, 0.69, p.primary),
      addText("Course / Program", height * 0.50, width * 0.015, p.muted, "400", safeWidth * 0.68)
    );
  }

  if (designId === "royal-purple") {
    elements.push(
      addText("AWARD CERTIFICATE", height * 0.19, width * 0.024, p.primary, "700"),
      addText("In recognition of", height * 0.28, width * 0.014, p.secondary, "400", safeWidth * 0.60),
      addText("Recipient Name", height * 0.36, width * 0.026, p.text, "600", safeWidth * 0.86),
      line(height * 0.44, 0.29, 0.71, p.secondary),
      addText("For outstanding achievement in", height * 0.49, width * 0.014, p.muted, "400", safeWidth * 0.78),
      addText("Course / Program", height * 0.55, width * 0.015, p.text, "400", safeWidth * 0.68)
    );
  }

  return { background: p.bg, elements };
}

export default function TemplateEditor() {
  const { id: templateId } = useParams();
  const navigate = useNavigate();

  const [orientation, setOrientation] = useState(null);
  const [designId, setDesignId] = useState("blank");
  const [background, setBackground] = useState("#ffffff");
  const [elements, setElements] = useState([]);
  const [variables, setVariables] = useState([]);
  const [selectedVariable, setSelectedVariable] = useState(null);
  const [variableKeyDraft, setVariableKeyDraft] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [border, setBorder] = useState(DEFAULT_BORDER);

  const [textContent, setTextContent] = useState("");
  const [fontFamily, setFontFamily] = useState("Arial");
  const paragraphEditorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [fontSize, setFontSize] = useState("24");
  const [fontWeight, setFontWeight] = useState("400");
  const [textColor, setTextColor] = useState("#111827");
  const [textAlign, setTextAlign] = useState("center");
  const [lineHeight, setLineHeight] = useState(1.45);
  const [selectedWidth, setSelectedWidth] = useState(0);
  const [selectedHeight, setSelectedHeight] = useState(0);
  const [selectedRotation, setSelectedRotation] = useState(0);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const imageInputRef = useRef(null);

  const [status, setStatus] = useState("Select orientation to start.");
  const [templateName, setTemplateName] = useState("");
  const [saveNotice, setSaveNotice] = useState(false);
  const [templateLocked, setTemplateLocked] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(Boolean(templateId));

  const page = orientation ? PAGE[orientation] : null;

  const selected = useMemo(
    () => elements.find((item) => item.id === selectedId) || null,
    [elements, selectedId]
  );

  useEffect(() => {
    const node = paragraphEditorRef.current;
    if (!node || !selected?.paragraph) return;

    const html = sanitizeRichHtml(
      selected.html ||
        escapeHtml(selected.text || "").replace(/\n/g, "<br />")
    );

    // Do not interrupt active editing/selection.
    if (document.activeElement === node) return;

    if (node.innerHTML !== html) {
      node.innerHTML = html;
    }
  }, [selectedId, selected?.html, selected?.paragraph]);

  useEffect(() => {
    if (!templateId) return;

    try {
      const stored = JSON.parse(
        localStorage.getItem("certichain-templates") || "[]"
      );

      const list = Array.isArray(stored) ? stored : [];
      const saved = list.find((item) => item.id === templateId);

      if (!saved) {
        setLoadingTemplate(false);
        setStatus("Saved template not found.");
        return;
      }

      const savedOrientation =
        saved.page?.orientation === "portrait" ? "portrait" : "landscape";

      const loadedElements = Array.isArray(saved.elements)
        ? saved.elements
        : [];

      const loadedVariables = Array.isArray(saved.variables)
        ? saved.variables
        : [];

      const loadedBorder = saved.border || DEFAULT_BORDER;
      const loadedDesign = saved.designId || "blank";
      const loadedBackground = saved.background || designBackground(loadedDesign);

      setTemplateName(saved.name || "Untitled certificate");
      setOrientation(savedOrientation);
      setDesignId(loadedDesign);
      setBackground(loadedBackground);
      setElements(loadedElements);
      setVariables(loadedVariables);
      setBorder(loadedBorder);
      setSelectedVariable(null);
      setVariableKeyDraft("");
      setSelectedId(null);
      setSaveNotice(false);
      setTemplateLocked(Boolean(saved.isLocked));

      const snapshot = JSON.stringify({
        elements: loadedElements,
        designId: loadedDesign,
        background: loadedBackground,
        border: loadedBorder,
      });

      setHistory([snapshot]);
      setHistoryIndex(0);
      setStatus(`Loaded "${saved.name}". You can continue editing this template.`);
      setLoadingTemplate(false);
    } catch (error) {
      console.error("Load saved template failed:", error);
      setLoadingTemplate(false);
      setStatus("Unable to load the saved template.");
    }
  }, [templateId]);

  const pushSnapshot = (nextElements, nextDesign = designId, nextBackground = background) => {
    const snapshot = JSON.stringify({
      elements: nextElements,
      designId: nextDesign,
      background: nextBackground,
      border,
    });

    setHistory((current) => [
      ...current.slice(0, historyIndex + 1),
      snapshot,
    ].slice(-60));

    setHistoryIndex((current) => Math.min(current + 1, 59));
  };

  const selectElement = (item) => {
    setSelectedId(item.id);
    setSelectedRotation(Number(item.rotation || 0));
    
    if (isTextElement(item)) {
      const html = item.paragraph
        ? sanitizeRichHtml(
            item.html || escapeHtml(item.text || "").replace(/\n/g, "<br />")
          )
        : "";
            setTextContent(item.text || "");
      setFontFamily(item.fontFamily || "Arial");
      setFontSize(String(item.fontSize ?? ""));
      setFontWeight(String(item.fontWeight || "400"));
      setTextColor(item.fill || "#111827");
      setTextAlign(item.align || "center");
      setLineHeight(Number(item.lineHeight || 1.45));
      setSelectedWidth(Number(item.width || 300));
      setSelectedHeight(
        Number(item.height || item.fontSize * (item.paragraph ? 6 : 2.5))
      );
    } else {
      setSelectedWidth(Number(item.width || item.radius * 2 || 0));
      setSelectedHeight(Number(item.height || item.radius * 2 || 0));
    }
  };

  const restoreSnapshot = (snapshot) => {
    const parsed = JSON.parse(snapshot);
    setElements(parsed.elements || []);
    setDesignId(parsed.designId || "blank");
    setBackground(parsed.background || "#ffffff");
    if (parsed.border) setBorder(parsed.border);
    setSelectedId(null);
      };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    restoreSnapshot(history[nextIndex]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    restoreSnapshot(history[nextIndex]);
  };

  useEffect(() => {
    const keyHandler = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }

      if (
        event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey)
      ) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [historyIndex, history]);

  const selectOrientation = (mode) => {
    setOrientation(mode);
    if (!templateId) {
      setTemplateName(`Untitled ${mode} certificate`);
    }
    setDesignId("blank");
    setBackground("#ffffff");
    setElements([]);
    setVariables([]);
    setBorder(DEFAULT_BORDER);
    setSelectedVariable(null);
    setVariableKeyDraft("");
    setSelectedId(null);
    
    const clean = JSON.stringify({
      elements: [],
      designId: "blank",
      background: "#ffffff",
      border: DEFAULT_BORDER,
    });
    setHistory([clean]);
    setHistoryIndex(0);
    setStatus(`${mode[0].toUpperCase() + mode.slice(1)} selected. Blank sheet is ready.`);
  };

  const useDesign = (idValue) => {
    if (!page) return;

    const preset = buildPreset(idValue, page.width, page.height);
    setDesignId(idValue);
    setBackground(preset.background);
    setElements(preset.elements);
    setSelectedId(null);
    
    const snapshot = JSON.stringify({
      elements: preset.elements,
      designId: idValue,
      background: preset.background,
      border,
    });

    setHistory((current) => [
      ...current.slice(0, historyIndex + 1),
      snapshot,
    ].slice(-60));
    setHistoryIndex((current) => Math.min(current + 1, 59));

    setStatus(
      idValue === "blank"
        ? "Blank sheet restored."
        : `${designName(idValue)} is now visible in the editor.`
    );
  };

  const updateElement = (idValue, patch) => {
    const next = elements.map((item) =>
      item.id === idValue ? { ...item, ...patch } : item
    );
    setElements(next);

    const updated = next.find((item) => item.id === idValue);
    if (updated) selectElement(updated);

    pushSnapshot(next);
  };

  const handleFontSizeInput = (value) => {
    // Allow the user to erase the field completely while retyping.
    setFontSize(value);

    if (value === "") return;

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;

    const safe = clamp(numeric, 0, 120);
    setFontSize(String(safe));

    if (selected) {
      updateSelectedText({ fontSize: safe });
    }
  };

  const applyParagraphColorToHtml = (html, color) => {
    if (!html) return html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(html), "text/html");
      doc.body.querySelectorAll("*").forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          node.style.color = color;
        }
      });
      if (doc.body.childNodes.length) {
        doc.body.style.color = color;
      }
      return sanitizeRichHtml(doc.body.innerHTML);
    } catch {
      return html;
    }
  };

  const handleTextColorChange = (value) => {
    const color = String(value || "").trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    setTextColor(color);
    if (!selected || !isTextElement(selected)) return;

    if (selected.paragraph) {
      const next = elements.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              fill: color,
              html: applyParagraphColorToHtml(
                item.html || escapeHtml(item.text || ""),
                color
              ),
            }
          : item
      );
      setElements(next);
      const updated = next.find((item) => item.id === selected.id);
      setTextContent(updated?.text || "");
      pushSnapshot(next);
      return;
    }

    updateSelectedText({ fill: color });
  };

  const updateSelectedText = (patch) => {
    if (!selected || !isTextElement(selected)) return;

    let next = elements.map((item) =>
      item.id === selected.id ? { ...item, ...patch } : item
    );

    const updated = next.find((item) => item.id === selected.id);

    if (updated?.paragraph && patch.text !== undefined) {
      updated.runs = makeRuns(patch.text, {
        fontFamily: updated.fontFamily,
        fontSize: updated.fontSize,
        fontWeight: updated.fontWeight,
        fill: updated.fill,
      });
      updated.html = escapeHtml(patch.text).replace(/\n/g, "<br />");
    }

    setElements(next);
    setTextContent(updated?.text || "");
    setFontFamily(updated?.fontFamily || fontFamily);
    setFontSize(Number(updated?.fontSize || fontSize));
    setFontWeight(String(updated?.fontWeight || fontWeight));
    setTextColor(updated?.fill || textColor);
    setTextAlign(updated?.align || textAlign);
    setLineHeight(Number(updated?.lineHeight || lineHeight));
    pushSnapshot(next);
  };






  const rememberParagraphSelection = () => {
    const editorNode = paragraphEditorRef.current;
    const selection = window.getSelection();

    if (!editorNode || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (!editorNode.contains(range.commonAncestorContainer)) return;

    // Save both an active text selection and a collapsed caret.
    // A collapsed range is exactly what we need when the user wants to
    // insert a variable between two words.
    savedRangeRef.current = range.cloneRange();
  };

  const restoreParagraphSelection = () => {
    const editorNode = paragraphEditorRef.current;
    const selection = window.getSelection();
    const saved = savedRangeRef.current;

    if (!editorNode || !selection || !saved) return false;
    if (!editorNode.contains(saved.commonAncestorContainer)) return false;

    selection.removeAllRanges();
    selection.addRange(saved.cloneRange());
    return true;
  };

  const syncParagraphFromEditor = () => {
    const editorNode = paragraphEditorRef.current;
    if (!editorNode || !selected?.paragraph) return;

    const cleanHtml = sanitizeRichHtml(editorNode.innerHTML);
    const plainText = editorNode.innerText || "";

    const next = elements.map((item) =>
      item.id === selected.id
        ? {
            ...item,
            html: cleanHtml,
            text: plainText,
          }
        : item
    );

    setElements(next);
    setTextContent(plainText);
  };

  const applyStyleToNativeSelection = () => {
    if (!selected?.paragraph) return;

    if (!restoreParagraphSelection()) {
      setStatus("Select the words you want to format in the paragraph.");
      return;
    }

    const editorNode = paragraphEditorRef.current;
    const selection = window.getSelection();

    if (!editorNode || !selection || selection.rangeCount === 0) {
      setStatus("Select the words you want to format in the paragraph.");
      return;
    }

    const range = selection.getRangeAt(0);

    if (range.collapsed || !editorNode.contains(range.commonAncestorContainer)) {
      setStatus("Select the words you want to format in the paragraph.");
      return;
    }

    const span = document.createElement("span");
    span.style.fontFamily = fontFamily;
    span.style.fontWeight = fontWeight;
    span.style.color = textColor;

    if (fontSize !== "") {
      span.style.fontSize = `${clamp(Number(fontSize) || 0, 0, 120)}px`;
    }

    try {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);

      // Keep the formatted selection active.
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();

      // Read the final HTML after applying the span and immediately store it.
      const cleanHtml = sanitizeRichHtml(editorNode.innerHTML);
      const plainText = editorNode.innerText || "";

      const nextElements = elements.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              html: cleanHtml,
              text: plainText,
            }
          : item
      );

      setElements(nextElements);
      setTextContent(plainText);
      setStatus("Selected text formatted. The certificate workspace has been updated.");

      // Keep the selection editor focused so the user can make another selection.
      requestAnimationFrame(() => {
        editorNode.focus();
        try {
          const activeSelection = window.getSelection();
          if (activeSelection) {
            activeSelection.removeAllRanges();
            activeSelection.addRange(newRange);
          }
        } catch {
          // Browser may reject restoring a detached range after React updates.
        }
      });
    } catch (error) {
      console.error("Text formatting failed:", error);
      setStatus("Unable to format the selected text.");
    }
  };

  const insertVariableAtSelection = (variable) => {
    if (!selected?.paragraph) return;

    const editorNode = paragraphEditorRef.current;
    if (!editorNode) return;

    const selection = window.getSelection();

    // First use the live browser caret/selection if it still belongs to
    // the paragraph editor. This is the most accurate insertion location.
    let range = null;

    if (
      selection &&
      selection.rangeCount > 0 &&
      editorNode.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      range = selection.getRangeAt(0).cloneRange();
    } else if (restoreParagraphSelection()) {
      const restored = window.getSelection();
      if (restored && restored.rangeCount > 0) {
        range = restored.getRangeAt(0).cloneRange();
      }
    }

    // No previous caret/selection: place the token at the end, never at the
    // beginning. This is only a fallback for a brand-new paragraph.
    if (!range) {
      editorNode.focus();
      range = document.createRange();
      range.selectNodeContents(editorNode);
      range.collapse(false);
    }

    const token = document.createTextNode(`{{${variable.key}}}`);

    range.deleteContents();
    range.insertNode(token);

    range.setStartAfter(token);
    range.collapse(true);

    const activeSelection = window.getSelection();
    if (activeSelection) {
      activeSelection.removeAllRanges();
      activeSelection.addRange(range);
    }

    savedRangeRef.current = range.cloneRange();

    syncParagraphFromEditor();
    setStatus(`Inserted {{${variable.key}}} at the selected cursor position.`);
  };

  const addParagraph = () => {
    if (!page) {
      setStatus("Choose an orientation first.");
      return;
    }

    const text = "Type your certificate paragraph here...";

    const item = {
      id: uid("paragraph"),
      kind: "text",
      paragraph: true,
      text,
      html: escapeHtml(text),
      x: page.width / 2,
      y: page.height * 0.68,
      width: page.width * 0.62,
      height: page.height * 0.16,
      fontSize: 20,
      fontFamily: "Georgia",
      fontWeight: "400",
      fill: "#334155",
      align: "center",
      lineHeight: 1.45,
      rotation: 0,
    };

    const next = [...elements, item];

    setElements(next);
    setSelectedId(item.id);
    setTextContent(text);
    setFontFamily(item.fontFamily);
    setFontSize(String(item.fontSize));
    setFontWeight(item.fontWeight);
    setTextColor(item.fill);
    setTextAlign(item.align);
    setLineHeight(item.lineHeight);

    pushSnapshot(next);
    setStatus("Paragraph added. Type your certificate content in the editor.");
  };

  const addVariable = () => {
    let number = variables.length + 1;
    let key = `field${number}`;

    while (variables.some((item) => item.key === key)) {
      number += 1;
      key = `field${number}`;
    }

    const item = {
      key,
      label: `Custom Field ${number}`,
      type: "text",
      required: false,
    };

    setVariables((current) => [...current, item]);
    setSelectedVariable(key);
    setVariableKeyDraft(key);
  };

  const renameVariable = (oldKey, value) => {
    const cleaned = String(value || "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_]/g, "")
      .toLowerCase();

    if (!cleaned) {
      setVariableKeyDraft(oldKey);
      return;
    }

    if (variables.some((item) => item.key !== oldKey && item.key === cleaned)) {
      setVariableKeyDraft(oldKey);
      setStatus(`Variable key "${cleaned}" is already in use.`);
      return;
    }

    const nextVariables = variables.map((item) =>
      item.key === oldKey ? { ...item, key: cleaned } : item
    );
    const nextElements = elements.map((item) => {
      if (item.variableKey === oldKey) {
        return {
          ...item,
          variableKey: cleaned,
          text: `{{${cleaned}}}`,
        };
      }

      if (item.paragraph && item.kind === "text") {
        const oldToken = `{{${oldKey}}}`;
        const newToken = `{{${cleaned}}}`;

        return {
          ...item,
          text: String(item.text || "").split(oldToken).join(newToken),
          html: String(item.html || "").split(oldToken).join(newToken),
        };
      }

      return item;
    });

    setVariables(nextVariables);
    setElements(nextElements);
    setVariableKeyDraft(cleaned);
    setSelectedVariable(cleaned);
  };

  const addVariableToPage = (variable) => {
    if (!page) return;

    const item = {
      id: uid("variable"),
      kind: "text",
      text: `{{${variable.key}}}`,
      x: page.width / 2,
      y: page.height / 2,
      width: page.width * 0.50,
      height: 70,
      fontSize: 25,
      fontFamily: "Arial",
      fontWeight: "400",
      fill: "#1d4ed8",
      align: "center",
      lineHeight: 1.2,
      variableKey: variable.key,
      rotation: 0,
    };

    const next = [...elements, item];
    setElements(next);
    setSelectedId(item.id);
    pushSnapshot(next);
  };

  const insertVariableIntoParagraph = insertVariableAtSelection;


  const removeVariable = (key) => {
    const next = elements.filter((item) => item.variableKey !== key);
    setElements(next);
    setVariables((current) => current.filter((item) => item.key !== key));
    setSelectedVariable(null);
    setVariableKeyDraft("");
    setSelectedId(null);
    pushSnapshot(next);
  };

  const removeSelected = () => {
    if (!selectedId) return;

    const next = elements.filter((item) => item.id !== selectedId);
    setElements(next);
    setSelectedId(null);
        pushSnapshot(next);
    setStatus("Selected element removed.");
  };

  const handleMove = (event, item) => {
    if (!page) return;

    const sheet = event.currentTarget.closest("[data-certificate-sheet]");
    if (!sheet) return;

    const rect = sheet.getBoundingClientRect();
    const startX = ((event.clientX - rect.left) / rect.width) * page.width;
    const startY = ((event.clientY - rect.top) / rect.height) * page.height;

    const original = {
      x: item.x,
      y: item.y,
      x1: item.x1,
      x2: item.x2,
      y1: item.y1,
      y2: item.y2,
    };

    const objectWidth =
      item.kind === "circle"
        ? item.radius * 2
        : Number(item.width || 0);

    const objectHeight =
      item.kind === "circle"
        ? item.radius * 2
        : Number(item.height || 0);

    const move = (moveEvent) => {
      const nextX = ((moveEvent.clientX - rect.left) / rect.width) * page.width;
      const nextY = ((moveEvent.clientY - rect.top) / rect.height) * page.height;
      const dx = nextX - startX;
      const dy = nextY - startY;

      setElements((current) =>
        current.map((object) => {
          if (object.id !== item.id) return object;

          if (object.kind === "line") {
            return {
              ...object,
              x1: clamp(original.x1 + dx, 0, page.width),
              y1: clamp(original.y1 + dy, 0, page.height),
              x2: clamp(original.x2 + dx, 0, page.width),
              y2: clamp(original.y2 + dy, 0, page.height),
            };
          }

          return {
            ...object,
            x: clamp(
              original.x + dx,
              objectWidth / 2,
              page.width - objectWidth / 2
            ),
            y: clamp(
              original.y + dy,
              objectHeight / 2,
              page.height - objectHeight / 2
            ),
          };
        })
      );
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const openImagePicker = () => imageInputRef.current?.click();

  const handleImageFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !page) return;

    if (!file.type.startsWith("image/")) {
      setStatus("Please select an image.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const item = {
        id: uid("image"),
        kind: "image",
        src: String(reader.result),
        x: page.width * 0.25,
        y: page.height * 0.72,
        width: page.width * 0.24,
        height: page.height * 0.18,
        rotation: 0,
      };

      const next = [...elements, item];
      setElements(next);
      setSelectedId(item.id);
      pushSnapshot(next);
      setStatus(`${file.name} added to the sheet.`);
    };

    reader.readAsDataURL(file);
  };

  const addQr = async () => {
    if (!page) return;

    try {
      const src = await QRCode.toDataURL(
        "https://certichain.example/verify/demo",
        { margin: 1, width: 256 }
      );

      const item = {
        id: uid("qr"),
        kind: "qr",
        src,
        x: page.width * 0.82,
        y: page.height * 0.80,
        width: Math.min(page.width, page.height) * 0.14,
        height: Math.min(page.width, page.height) * 0.14,
        rotation: 0,
      };

      const next = [...elements, item];
      setElements(next);
      setSelectedId(item.id);
      pushSnapshot(next);
      setStatus("QR code added.");
    } catch (error) {
      console.error(error);
      setStatus("Unable to create QR code.");
    }
  };


  const getRotatedBounds = (widthValue, heightValue, angle) => {
    const radians = (Number(angle || 0) * Math.PI) / 180;
    return {
      width:
        Math.abs(widthValue * Math.cos(radians)) +
        Math.abs(heightValue * Math.sin(radians)),
      height:
        Math.abs(widthValue * Math.sin(radians)) +
        Math.abs(heightValue * Math.cos(radians)),
    };
  };

  const updateSelectedRotation = (value, save = true) => {
    if (!selected || !page) return;

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;

    const normalized = ((numeric % 360) + 360) % 360;

    if (selected.kind === "line") {
      const dx = selected.x2 - selected.x1;
      const dy = selected.y2 - selected.y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const midX = (selected.x1 + selected.x2) / 2;
      const midY = (selected.y1 + selected.y2) / 2;
      const currentAngle = Math.atan2(dy, dx);
      const targetAngle = currentAngle + (normalized * Math.PI) / 180;
      const halfX = Math.cos(targetAngle) * length / 2;
      const halfY = Math.sin(targetAngle) * length / 2;

      const next = elements.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              x1: clamp(midX - halfX, 0, page.width),
              y1: clamp(midY - halfY, 0, page.height),
              x2: clamp(midX + halfX, 0, page.width),
              y2: clamp(midY + halfY, 0, page.height),
            }
          : item
      );

      setElements(next);
      setSelectedRotation(normalized);
      if (save) pushSnapshot(next);
      return;
    }

    const widthValue = Number(selected.width || selected.radius * 2 || 0);
    const heightValue = Number(selected.height || selected.radius * 2 || 0);
    const bounds = getRotatedBounds(widthValue, heightValue, normalized);

    const x = bounds.width >= page.width
      ? page.width / 2
      : clamp(Number(selected.x || 0), bounds.width / 2, page.width - bounds.width / 2);

    const y = bounds.height >= page.height
      ? page.height / 2
      : clamp(Number(selected.y || 0), bounds.height / 2, page.height - bounds.height / 2);

    const next = elements.map((item) =>
      item.id === selected.id
        ? { ...item, rotation: normalized, x, y }
        : item
    );

    setElements(next);
    setSelectedRotation(normalized);
    if (save) pushSnapshot(next);
  };



  const alignSelectedHorizontal = (position) => {
    if (!selected || !page) return;

    const next = elements.map((item) => {
      if (item.id !== selected.id) return item;

      if (item.kind === "line") {
        const minX = Math.min(item.x1, item.x2);
        const maxX = Math.max(item.x1, item.x2);
        const lineWidth = maxX - minX;

        const targetMin =
          position === "left"
            ? 0
            : position === "right"
              ? page.width - lineWidth
              : (page.width - lineWidth) / 2;

        const dx = targetMin - minX;

        return {
          ...item,
          x1: clamp(item.x1 + dx, 0, page.width),
          x2: clamp(item.x2 + dx, 0, page.width),
        };
      }

      const widthValue = Number(item.width || item.radius * 2 || 0);
      const heightValue = Number(item.height || item.radius * 2 || 0);
      const angle = Number(item.rotation || 0);
      const radians = (angle * Math.PI) / 180;

      const rotatedWidth =
        Math.abs(widthValue * Math.cos(radians)) +
        Math.abs(heightValue * Math.sin(radians));

      const x =
        position === "left"
          ? rotatedWidth >= page.width
            ? page.width / 2
            : rotatedWidth / 2
          : position === "right"
            ? rotatedWidth >= page.width
              ? page.width / 2
              : page.width - rotatedWidth / 2
            : page.width / 2;

      return {
        ...item,
        x: clamp(x, widthValue / 2, page.width - widthValue / 2),
      };
    });

    setElements(next);

    const updated = next.find((item) => item.id === selected.id);
    if (updated) {
      setSelectedWidth(Number(updated.width || updated.radius * 2 || 0));
      setSelectedHeight(Number(updated.height || updated.radius * 2 || 0));
    }

    pushSnapshot(next);
    setStatus(
      position === "left"
        ? "Selected element aligned to the left side of the sheet."
        : position === "right"
          ? "Selected element aligned to the right side of the sheet."
          : "Selected element centered inside the sheet."
    );
  };

  const resizeSelected = (item, nextWidth, nextHeight) => {
    if (!page) return;

    const safeWidth = clamp(Number(nextWidth) || 40, 40, page.width * 0.92);
    const safeHeight = clamp(Number(nextHeight) || 30, 30, page.height * 0.92);

    const angle = Number(item.rotation || 0);
    const bounds = getRotatedBounds(safeWidth, safeHeight, angle);

    const x =
      bounds.width >= page.width
        ? page.width / 2
        : clamp(Number(item.x || 0), bounds.width / 2, page.width - bounds.width / 2);

    const y =
      bounds.height >= page.height
        ? page.height / 2
        : clamp(Number(item.y || 0), bounds.height / 2, page.height - bounds.height / 2);

    const next = elements.map((object) =>
      object.id === item.id
        ? { ...object, width: safeWidth, height: safeHeight, x, y }
        : object
    );

    setElements(next);
    setSelectedWidth(safeWidth);
    setSelectedHeight(safeHeight);
  };

  const toggleBorder = (enabled) => {
    const next = { ...border, enabled };
    setBorder(next);
    pushSnapshot(elements, designId, background);
  };

  const updateBorder = (patch) => {
    const next = { ...border, ...patch, enabled: true };
    setBorder(next);
    pushSnapshot(elements, designId, background);
  };

  const saveTemplate = () => {
    if (templateLocked) {
      setStatus("This template is locked. Unlock it from Templates before editing.");
      return;
    }
    if (!page || !orientation) {
      setStatus("Choose an orientation first.");
      return;
    }

    const cleanedName =
      String(templateName || "").trim() ||
      `${designName(designId)} ${orientation}`;

    try {
      const key = "certichain-templates";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      const list = Array.isArray(existing) ? existing : [];

      const now = new Date().toISOString();

      const prior = list.find((item) => item.id === (templateId || ""));
      const data = {
        id: templateId || `template-${Date.now()}`,
        name: cleanedName,
        page: {
          size: "A4",
          orientation,
          width: page.width,
          height: page.height,
          mmWidth: page.mmWidth,
          mmHeight: page.mmHeight,
        },
        designId,
        background,
        border,
        variables,
        elements,
        category: prior?.category || "Academic",
        status: prior?.status || "Active",
        isDefault: Boolean(prior?.isDefault),
        isLocked: Boolean(prior?.isLocked),
        version: Math.max(1, Number(prior?.version || 0) + 1),
        createdAt: prior?.createdAt || now,
        updatedAt: now,
      };

      const existingIndex = list.findIndex((item) => item.id === data.id);

      const nextList =
        existingIndex >= 0
          ? list.map((item) =>
              item.id === data.id ? data : item
            )
          : [...list, data];

      localStorage.setItem(key, JSON.stringify(nextList));

      // Keep the legacy "latest" copies synchronized for existing project screens.
      localStorage.setItem(
        "certichain-template-v36:latest",
        JSON.stringify(data)
      );
      localStorage.setItem(
        "certichain-template-v35:latest",
        JSON.stringify(data)
      );
      localStorage.setItem(
        "certichain-template-v29:latest",
        JSON.stringify(data)
      );

      setTemplateName(cleanedName);
      addAuditLog(templateId ? "Template updated" : "Template created", { templateId: data.id, templateName: data.name, version: data.version }, getSessionUser()?.email || "Authorized Institution");
      setSaveNotice(true);
      setStatus("Saved");

      window.setTimeout(() => {
        setSaveNotice(false);
      }, 1800);

      // New templates get their stable edit URL after the first save.
      if (!templateId) {
        navigate(`/templates/${data.id}/edit`, { replace: true });
      }
    } catch (error) {
      console.error("Save failed:", error);
      setSaveNotice(false);
      setStatus("Save failed. Browser storage may be unavailable.");
    }
  };

  if (loadingTemplate) {
    return (
      <Layout title="Template Editor" subtitle="Loading saved template">
        <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
            <div className="mt-4 text-sm font-semibold text-slate-700">
              Loading saved template…
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!orientation) {
    return (
      <Layout title="Template Editor" subtitle="Create a certificate">
        <div className="mb-5">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
            Step 1 of 2
          </span>
          <h2 className="mt-3 text-2xl font-bold">Choose orientation</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Choose portrait or landscape. The sheet size is fixed.
          </p>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            <OrientationCard
              title="Landscape"
              subtitle="Horizontal"
              dimensions="297 × 210 mm"
              icon={<Monitor size={22} />}
              onClick={() => selectOrientation("landscape")}
            />
            <OrientationCard
              title="Portrait"
              subtitle="Vertical"
              dimensions="210 × 297 mm"
              icon={<Smartphone size={22} />}
              onClick={() => selectOrientation("portrait")}
            />
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout title="Template Editor" subtitle="Design your certificate">
      <div className="mb-5 flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">
                {templateId ? "Editing saved template" : "Step 2 of 2"}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-600">
                {orientation}
              </span>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                {designName(designId)}
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-bold">{templateId ? "Edit your template" : "Design your template"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select elements to edit, resize, or remove them.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block min-w-[260px]">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Template name
              </span>
              <input
                type="text"
                value={templateName}
                onChange={(event) => {
                  setTemplateName(event.target.value);
                  setSaveNotice(false);
                }}
                placeholder="Enter template name"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={undo}
              disabled={historyIndex <= 0}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold ${
                historyIndex > 0
                  ? "border-slate-200 bg-white text-slate-700"
                  : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
              }`}
            >
              <Undo2 size={17} /> Undo
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold ${
                historyIndex < history.length - 1
                  ? "border-slate-200 bg-white text-slate-700"
                  : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
              }`}
            >
              <Redo2 size={17} /> Redo
            </button>
            <button
              onClick={saveTemplate}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {saveNotice ? <Check size={17} /> : <Save size={17} />}
              {saveNotice ? "Saved" : "Save"}
            </button>
            <Link
              to="/templates"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Back
            </Link>
            </div>
          </div>
        </div>

        {saveNotice && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <Check size={17} />
            Saved
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
          <Ruler size={17} className="text-blue-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Sheet
          </span>
          <span className="font-semibold capitalize text-slate-800">
            {orientation}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-mono text-sm font-semibold text-slate-700">
            {page.mmWidth} × {page.mmHeight} mm
          </span>

          <div className="ml-auto flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => selectOrientation("landscape")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                orientation === "landscape"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Landscape
            </button>
            <button
              onClick={() => selectOrientation("portrait")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                orientation === "portrait"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Portrait
            </button>
          </div>
        </div>
      </div>

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-blue-600" />
              <h3 className="font-bold text-slate-900">Page designs</h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Choose a starting design. The design is rendered directly inside the editing sheet.
            </p>
          </div>

          <button
            onClick={() => useDesign("blank")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
          >
            Blank
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {DESIGNS.map((design) => (
            <DesignCard
              key={design.id}
              design={design}
              selected={designId === design.id}
              orientation={orientation}
              onUse={() => useDesign(design.id)}
            />
          ))}
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[220px_minmax(0,1fr)_370px]">
        <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Elements
          </div>

          <div className="mt-4 space-y-2">
            <button
              onClick={() =>
                setStatus("Create a variable on the right and add it to the sheet.")
              }
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium hover:bg-slate-50"
            >
              <Type size={18} className="text-blue-600" /> Variable text
            </button>

            <button
              onClick={addParagraph}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium hover:bg-slate-50"
            >
              <Type size={18} className="text-blue-600" /> Paragraph text
            </button>

            <button
              onClick={openImagePicker}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium hover:bg-slate-50"
            >
              <ImageIcon size={18} className="text-blue-600" /> Upload image
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleImageFile}
              className="hidden"
            />

            <button
              onClick={addQr}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium hover:bg-slate-50"
            >
              <QrCode size={18} className="text-blue-600" /> QR code
            </button>
          </div>

          <div className="mt-7 rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Border
            </div>

            <button
              onClick={() => toggleBorder(!border.enabled)}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold ${
                border.enabled
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {border.enabled ? <Check size={15} /> : <Square size={15} />}
              {border.enabled ? "Border enabled" : "Add border"}
            </button>

            {border.enabled && (
              <div className="mt-4 space-y-3">
                <select
                  value={border.style}
                  onChange={(e) => updateBorder({ style: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="double">Double</option>
                </select>

                <label className="block text-xs">
                  <span className="font-medium text-slate-500">
                    Line size: {border.width}px
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={border.width}
                    onChange={(e) => updateBorder({ width: Number(e.target.value) })}
                    className="mt-2 w-full"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-medium text-slate-500">Border color</span>
                  <input
                    type="color"
                    value={border.color}
                    onChange={(e) => updateBorder({ color: e.target.value })}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white p-1"
                  />
                </label>

                <label className="block text-xs">
                  <span className="font-medium text-slate-500">
                    Inset: {border.inset}px
                  </span>
                  <input
                    type="range"
                    min="8"
                    max="80"
                    value={border.inset}
                    onChange={(e) => updateBorder({ inset: Number(e.target.value) })}
                    className="mt-2 w-full"
                  />
                </label>
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-100 p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Editor workspace
              </div>
              <div className="mt-1 text-sm font-bold capitalize text-slate-800">
                {orientation} • {page.mmWidth} × {page.mmHeight} mm
              </div>
            </div>

            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
              {designName(designId)}
            </span>
          </div>

          <div className="flex min-h-[640px] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-200 p-4 sm:p-6">
            <div
              data-certificate-sheet
              className="relative w-full max-w-[1123px] overflow-hidden bg-white shadow-2xl"
              style={{
                aspectRatio: `${page.width} / ${page.height}`,
                background,
              }}
              onClick={() => {
                setSelectedId(null);
                
              }}
            >
              {border.enabled && (
                <div
                  className="pointer-events-none absolute z-50 box-border"
                  style={{
                    top: `${(Math.min(border.inset, 80) / page.height) * 100}%`,
                    left: `${(Math.min(border.inset, 80) / page.width) * 100}%`,
                    right: `${(Math.min(border.inset, 80) / page.width) * 100}%`,
                    bottom: `${(Math.min(border.inset, 80) / page.height) * 100}%`,
                    borderStyle: border.style,
                    borderWidth: `${Math.max(1, border.width)}px`,
                    borderColor: border.color,
                    borderRadius: `${Math.max(0, border.radius)}px`,
                  }}
                />
              )}

              {elements.map((item) => (
                <PageElement
                  key={item.id}
                  item={item}
                  page={page}
                  selected={selectedId === item.id}
                  onSelect={() => selectElement(item)}
                  onPointerDown={(event) => handleMove(event, item)}
                  onResize={(target, widthValue, heightValue) =>
                    resizeSelected(target, widthValue, heightValue)
                  }
                  onRotate={(target, rotationValue) =>
                    updateSelectedRotation(rotationValue, false)
                  }
                  onRotateEnd={(target, rotationValue) =>
                    updateSelectedRotation(rotationValue, true)
                  }
                />
              ))}
            </div>
          </div>

          <div className="mt-3 text-center text-xs text-slate-400">
            {orientation} • {page.mmWidth} × {page.mmHeight} mm • select any element to edit
          </div>
        </section>

        <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {selected ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Edit selected
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Change content, formatting, size, rotation, or remove it.
                  </p>
                </div>
                <Palette size={18} className="text-blue-600" />
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Horizontal position
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    { key: "left", label: "Left" },
                    { key: "center", label: "Center" },
                    { key: "right", label: "Right" },
                  ].map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => alignSelectedHorizontal(option.key)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[10px] leading-4 text-slate-400">
                  Places the selected element relative to the A4 sheet: left edge, center, or right edge.
                </div>
              </div>

              {isTextElement(selected) ? (
                <div className="mt-4 space-y-3">
                  <label className="block text-xs">
                    <span className="font-medium text-slate-500">
                      {selected.paragraph ? "Certificate content" : "Text content"}
                    </span>

                    {selected.paragraph ? (
                      <div
                        ref={paragraphEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        role="textbox"
                        aria-multiline="true"
                        onInput={syncParagraphFromEditor}
                        onMouseUp={rememberParagraphSelection}
                        onKeyUp={rememberParagraphSelection}
                        onSelect={rememberParagraphSelection}
                        onFocus={rememberParagraphSelection}
                        className="mt-1.5 min-h-[170px] w-full overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        style={{
                          fontFamily: selected.fontFamily || "Georgia",
                          color: selected.fill || "#334155",
                          textAlign: selected.align || "center",
                          lineHeight: selected.lineHeight || 1.45,
                        }}
                      />
                    ) : (
                      <textarea
                        value={textContent}
                        onChange={(e) => {
                          setTextContent(e.target.value);
                          updateSelectedText({ text: e.target.value });
                        }}
                        rows={3}
                        className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-5"
                        placeholder="Enter certificate content..."
                      />
                    )}
                  </label>

                  {selected.paragraph && (
                    <div className="rounded-lg border border-blue-100 bg-white p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                        Format selected text
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-slate-400">
                        Drag across any words in the paragraph above to select exactly the text you want.
                        Then choose the font, size and colour and apply it.
                      </p>

                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          rememberParagraphSelection();
                        }}
                        onClick={applyStyleToNativeSelection}
                        className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Apply font & colour to selected text
                      </button>

                      <div className="mt-2 text-[10px] leading-4 text-slate-400">
                        You can select part of a word, a single word, several words, or multiple lines.
                        Each selection can have a different style. The styled result appears immediately
                        in the certificate workspace.
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs">
                      <span className="font-medium text-slate-500">Width</span>
                      <input
                        type="number"
                        min="40"
                        max={page.width}
                        value={Math.round(selectedWidth || selected.width || 300)}
                        onChange={(e) =>
                          resizeSelected(
                            selected,
                            Number(e.target.value),
                            selectedHeight || selected.height || 70
                          )
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                      />
                    </label>

                    <label className="block text-xs">
                      <span className="font-medium text-slate-500">Height</span>
                      <input
                        type="number"
                        min="30"
                        max={page.height}
                        value={Math.round(
                          selectedHeight ||
                            selected.height ||
                            selected.fontSize * 2.5
                        )}
                        onChange={(e) =>
                          resizeSelected(
                            selected,
                            selectedWidth || selected.width || 300,
                            Number(e.target.value)
                          )
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                      />
                    </label>
                  </div>

                    
                  <label className="block text-xs">
                    <span className="font-medium text-slate-500">Font family</span>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs">
                      <span className="font-medium text-slate-500">Font size</span>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={fontSize}
                        onChange={(e) => {
                          setFontSize(e.target.value);
                        }}
                        onBlur={(e) => {
                          if (e.target.value === "") return;
                          const safe = clamp(Number(e.target.value) || 0, 0, 120);
                          setFontSize(String(safe));
                          if (!selected.paragraph) {
                            updateSelectedText({ fontSize: safe });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                      />
                    </label>

                    <label className="block text-xs">
                      <span className="font-medium text-slate-500">Weight</span>
                      <select
                        value={fontWeight}
                        onChange={(e) => setFontWeight(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                      >
                        <option value="300">Light</option>
                        <option value="400">Regular</option>
                        <option value="500">Medium</option>
                        <option value="600">Semi Bold</option>
                        <option value="700">Bold</option>
                        <option value="800">Extra Bold</option>
                      </select>
                    </label>
                  </div>

                  <label className="block text-xs">
                    <span className="font-medium text-slate-500">Text colour</span>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => handleTextColorChange(e.target.value)}
                        className="h-10 w-14 rounded-lg border border-slate-200 bg-white p-1"
                      />
                      <input
                        value={textColor}
                        onChange={(e) => handleTextColorChange(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs uppercase"
                      />
                    </div>
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    {["left", "center", "right"].map((align) => (
                      <button
                        key={align}
                        onClick={() => updateSelectedText({ align })}
                        className={`rounded-lg border px-2 py-2 text-xs font-semibold capitalize ${
                          textAlign === align
                            ? "border-blue-400 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>

                  {selected.paragraph && (
                    <label className="block text-xs">
                      <span className="font-medium text-slate-500">
                        Paragraph line spacing: {Number(lineHeight).toFixed(2)}
                      </span>
                      <input
                        type="range"
                        min="1"
                        max="2"
                        step="0.05"
                        value={lineHeight}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setLineHeight(value);
                          updateSelectedText({ lineHeight: value });
                        }}
                        className="mt-2 w-full"
                      />
                    </label>
                  )}

                  <label className="block text-xs">
                    <span className="font-medium text-slate-500">Rotation</span>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        type="number"
                        min="-360"
                        max="360"
                        value={selectedRotation}
                        onChange={(e) => setSelectedRotation(e.target.value)}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (Number.isFinite(value)) {
                            updateSelectedRotation(value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                      />
                      <span className="flex items-center rounded-lg bg-slate-50 px-3 text-xs text-slate-400">
                        °
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Drag the round handle above the element to rotate freely.
                    </div>
                  </label>

                  <button
                    onClick={removeSelected}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={15} /> Remove selected
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs">
                      <span className="font-medium text-slate-500">Width</span>
                      <input
                        type="number"
                        min="20"
                        max={page.width}
                        value={Math.round(selectedWidth || selected.width || 100)}
                        onChange={(e) =>
                          resizeSelected(
                            selected,
                            Number(e.target.value),
                            selectedHeight || selected.height || 100
                          )
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                      />
                    </label>

                    <label className="block text-xs">
                      <span className="font-medium text-slate-500">Height</span>
                      <input
                        type="number"
                        min="20"
                        max={page.height}
                        value={Math.round(selectedHeight || selected.height || 100)}
                        onChange={(e) =>
                          resizeSelected(
                            selected,
                            selectedWidth || selected.width || 100,
                            Number(e.target.value)
                          )
                        }
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                      />
                    </label>
                  </div>

                  <label className="block text-xs">
                    <span className="font-medium text-slate-500">Rotation</span>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        type="number"
                        min="-360"
                        max="360"
                        value={selectedRotation}
                        onChange={(e) => setSelectedRotation(e.target.value)}
                        onBlur={(e) => {
                          const value = Number(e.target.value);
                          if (Number.isFinite(value)) {
                            updateSelectedRotation(value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                      />
                      <span className="flex items-center rounded-lg bg-slate-50 px-3 text-xs text-slate-400">
                        °
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      Drag the round handle above the element to rotate freely.
                    </div>
                  </label>

                  <button
                    onClick={removeSelected}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={15} /> Remove selected
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                Select an element
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Select text, a variable, image, QR code, shape, or paragraph on the sheet.
              </p>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Variables
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Create a variable, then insert it into a paragraph or add it as a separate field.
              </div>
            </div>

            <button
              onClick={addVariable}
              className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-700"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {variables.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-5 text-center">
              <Type className="mx-auto text-slate-300" size={28} />
              <div className="mt-3 text-sm font-semibold text-slate-700">
                No variables yet
              </div>
              <button
                onClick={addVariable}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white"
              >
                <Plus size={14} /> Create first variable
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {variables.map((variable) => (
                <div
                  key={variable.key}
                  className={`rounded-xl border p-3 ${
                    selectedVariable === variable.key
                      ? "border-blue-300 bg-blue-50/30"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={16} className="mt-2 text-slate-300" />

                    <button
                      onClick={() => {
                        setSelectedVariable(variable.key);
                        setVariableKeyDraft(variable.key);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="font-mono text-xs font-semibold text-blue-700">
                        {`{{${variable.key}}}`}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {variable.label}
                      </div>
                    </button>

                    <button
                      onClick={() => removeVariable(variable.key)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {selectedVariable === variable.key && (
                    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                      <label className="block text-xs">
                        <span className="font-medium text-slate-500">Variable key</span>
                        <input
                          value={variableKeyDraft}
                          onChange={(e) => setVariableKeyDraft(e.target.value)}
                          onBlur={(e) => renameVariable(variable.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              renameVariable(variable.key, e.currentTarget.value);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setVariableKeyDraft(variable.key);
                            }
                          }}
                          className="mt-1.5 w-full rounded-lg border border-blue-300 bg-white px-2.5 py-2 font-mono outline-none focus:ring-2 focus:ring-blue-100"
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </label>

                      <label className="block text-xs">
                        <span className="font-medium text-slate-500">Display label</span>
                        <input
                          value={variable.label}
                          onChange={(e) =>
                            updateVariable(variable.key, {
                              label: e.target.value,
                            })
                          }
                          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                        />
                      </label>

                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Token
                        </div>
                        <div className="mt-1 font-mono text-xs font-semibold text-blue-700">
                          {`{{${variable.key}}}`}
                        </div>
                      </div>

                      {selected?.paragraph && (
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            rememberParagraphSelection();
                            insertVariableAtSelection(variable);
                          }}
                          className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Insert into paragraph
                        </button>
                      )}

                      <button
                        onClick={() => addVariableToPage(variable)}
                        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Add to sheet
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
            <b className="text-slate-700">Status:</b> {status}
          </div>
        </aside>
      </div>
    </Layout>
  );
}

function OrientationCard({ title, subtitle, dimensions, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-3xl border-2 border-slate-200 bg-white p-6 text-left transition hover:border-blue-400 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          {icon}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          Select
        </span>
      </div>

      <div className="mt-7 text-xl font-bold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{subtitle}</div>

      <div className="mt-6 flex min-h-[170px] items-center justify-center rounded-2xl bg-slate-50">
        <div
          className={
            title === "Landscape"
              ? "h-24 w-40 rounded-lg bg-white"
              : "h-40 w-24 rounded-lg bg-white"
          }
        />
      </div>

      <div className="mt-5 text-xs font-mono text-slate-400">{dimensions}</div>
      <div className="mt-2 text-sm font-semibold text-blue-600">
        Use {title} →
      </div>
    </button>
  );
}

function DesignCard({ design, selected, orientation, onUse }) {
  return (
    <div
      className={`rounded-2xl border p-2 ${
        selected
          ? "border-blue-400 ring-2 ring-blue-50"
          : "border-slate-200"
      }`}
    >
      <div
        className="relative overflow-hidden rounded-xl border border-slate-100"
        style={{
          background: designBackground(design.id),
          aspectRatio: orientation === "landscape" ? "4/3" : "3/4",
        }}
      >
        {design.id === "blank" ? (
          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold uppercase tracking-wider text-slate-300">
            Blank
          </div>
        ) : (
          <>
            <div
              className="absolute inset-[9%] rounded-lg"
              style={{ border: `2px solid ${designColor(design.id)}` }}
            />
            <div
              className="absolute left-[20%] right-[20%] top-[20%] h-[7%] rounded"
              style={{ background: designColor(design.id) }}
            />
            <div
              className="absolute left-[30%] right-[30%] top-[38%] h-[2.5%] rounded"
              style={{
                background: designColor(design.id),
                opacity: 0.25,
              }}
            />
            <div
              className="absolute left-[34%] right-[34%] top-[50%] h-[5%] rounded"
              style={{
                background: designColor(design.id),
                opacity: 0.78,
              }}
            />
          </>
        )}
      </div>

      <div className="px-1 pb-1 pt-2">
        <div className="truncate text-xs font-semibold text-slate-800">
          {design.name}
        </div>
        <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">
          {design.description}
        </div>
        <button
          onClick={onUse}
          className={`mt-2 w-full rounded-lg px-2 py-1.5 text-[10px] font-semibold ${
            selected
              ? "bg-blue-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
          }`}
        >
          {selected ? "Selected" : "Use design"}
        </button>
      </div>
    </div>
  );
}

function PageElement({
  item,
  selected,
  page,
  onSelect,
  onPointerDown,
  onResize,
  onRotate,
  onRotateEnd,
}) {
  const resizeRef = useRef(null);
  const rotateRef = useRef(null);

  const widthValue = Number(item.width || item.radius * 2 || 0);
  const heightValue = Number(item.height || item.radius * 2 || 0);
  const rotation = Number(item.rotation || 0);

  const leftValue = Number(item.x || 0) - widthValue / 2;
  const topValue = Number(item.y || 0) - heightValue / 2;

  const boxStyle = {
    position: "absolute",
    left: `${(leftValue / page.width) * 100}%`,
    top: `${(topValue / page.height) * 100}%`,
    width: `${(widthValue / page.width) * 100}%`,
    height: `${(heightValue / page.height) * 100}%`,
    boxSizing: "border-box",
    zIndex: selected ? 100 : item.designElement ? 10 : 50,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: "center center",
  };

  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const sheet = event.currentTarget.closest("[data-certificate-sheet]");
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();

    resizeRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: widthValue,
      height: heightValue,
      rectWidth: rect.width,
      rectHeight: rect.height,
    };

    const move = (moveEvent) => {
      if (!resizeRef.current) return;

      const dx =
        ((moveEvent.clientX - resizeRef.current.startX) /
          resizeRef.current.rectWidth) *
        page.width;

      const dy =
        ((moveEvent.clientY - resizeRef.current.startY) /
          resizeRef.current.rectHeight) *
        page.height;

      onResize(
        item,
        resizeRef.current.width + dx,
        resizeRef.current.height + dy
      );
    };

    const up = () => {
      resizeRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startRotate = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const sheet = event.currentTarget.closest("[data-certificate-sheet]");
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();

    const centerX =
      rect.left + (Number(item.x || 0) / page.width) * rect.width;
    const centerY =
      rect.top + (Number(item.y || 0) / page.height) * rect.height;

    const startPointerAngle =
      Math.atan2(event.clientY - centerY, event.clientX - centerX) *
      (180 / Math.PI);

    rotateRef.current = {
      centerX,
      centerY,
      startPointerAngle,
      startRotation: rotation,
      currentRotation: rotation,
    };

    const move = (moveEvent) => {
      if (!rotateRef.current) return;

      const pointerAngle =
        Math.atan2(
          moveEvent.clientY - rotateRef.current.centerY,
          moveEvent.clientX - rotateRef.current.centerX
        ) *
        (180 / Math.PI);

      const nextRotation =
        rotateRef.current.startRotation +
        (pointerAngle - rotateRef.current.startPointerAngle);

      rotateRef.current.currentRotation = nextRotation;
      onRotate(item, nextRotation);
    };

    const up = () => {
      if (rotateRef.current) {
        onRotateEnd(item, rotateRef.current.currentRotation);
      }

      rotateRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const selectionControls =
    selected && item.kind !== "line" ? (
      <>
        <div className="pointer-events-none absolute inset-0 border-2 border-dashed border-blue-500" />

        <div className="pointer-events-none absolute left-1/2 top-[-26px] h-6 -translate-x-1/2 border-l-2 border-dashed border-blue-500" />

        <button
          type="button"
          aria-label="Rotate element"
          title="Drag to rotate"
          onPointerDown={startRotate}
          className="absolute left-1/2 top-[-44px] h-6 w-6 -translate-x-1/2 cursor-grab rounded-full border-2 border-white bg-blue-600 p-0 shadow"
        />

        <button
          type="button"
          aria-label="Resize element"
          title="Drag to resize"
          onPointerDown={startResize}
          className="absolute bottom-[-6px] right-[-6px] h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-blue-600 p-0 shadow"
        />
      </>
    ) : null;

  const select = (event) => {
    event.stopPropagation();
    onSelect();
  };

  if (item.kind === "text") {
    const html =
      item.paragraph && item.html
        ? sanitizeRichHtml(item.html)
        : escapeHtml(item.text || "").replace(/\n/g, "<br />");

    return (
      <div
        style={{
          ...boxStyle,
          overflow: "visible",
          cursor: selected ? "move" : "pointer",
        }}
        onClick={select}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown(event);
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent:
              item.align === "left"
                ? "flex-start"
                : item.align === "right"
                  ? "flex-end"
                  : "center",
            padding: "2px 4px",
            overflow: "hidden",
            boxSizing: "border-box",
            fontFamily: item.fontFamily || "Arial",
            fontSize: `${Math.max(0, Number(item.fontSize ?? 24))}px`,
            fontWeight: item.fontWeight || "400",
            color: item.fill || "#111827",
            lineHeight: item.lineHeight || 1.2,
            textAlign: item.align || "center",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "100%",
              overflow: "hidden",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        {selectionControls}
      </div>
    );
  }

  if (item.kind === "image" || item.kind === "qr") {
    return (
      <div
        style={{
          ...boxStyle,
          cursor: selected ? "move" : "pointer",
        }}
        onClick={select}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown(event);
        }}
      >
        <img
          src={item.src}
          alt={
            item.kind === "qr"
              ? "Verification QR code"
              : "Certificate image"
          }
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: item.objectFit || "contain",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {selectionControls}
      </div>
    );
  }

  if (item.kind === "rect") {
    return (
      <div
        style={{
          ...boxStyle,
          background: item.fill,
          borderRadius: item.radius || 0,
          cursor: selected ? "move" : "pointer",
        }}
        onClick={select}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown(event);
        }}
      >
        {selectionControls}
      </div>
    );
  }

  if (item.kind === "circle") {
    return (
      <div
        style={{
          ...boxStyle,
          borderRadius: "50%",
          background: item.fill,
          cursor: selected ? "move" : "pointer",
        }}
        onClick={select}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown(event);
        }}
      >
        {selectionControls}
      </div>
    );
  }

  if (item.kind === "line") {
    const dx = item.x2 - item.x1;
    const dy = item.y2 - item.y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const lineAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    return (
      <div
        onClick={select}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown(event);
        }}
        style={{
          position: "absolute",
          left: `${(item.x1 / page.width) * 100}%`,
          top: `${(item.y1 / page.height) * 100}%`,
          width: `${(length / page.width) * 100}%`,
          height: `${Math.max(2, Number(item.strokeWidth || 2))}px`,
          background: item.stroke,
          transformOrigin: "0 50%",
          transform: `rotate(${lineAngle}deg)`,
          zIndex: selected ? 100 : item.designElement ? 10 : 50,
          cursor: "pointer",
        }}
      >
        {selected && (
          <button
            type="button"
            aria-label="Rotate line"
            title="Drag to rotate"
            onPointerDown={startRotate}
            className="absolute left-1/2 top-[-28px] h-6 w-6 -translate-x-1/2 cursor-grab rounded-full border-2 border-white bg-blue-600 p-0 shadow"
          />
        )}
      </div>
    );
  }

  return null;
}

