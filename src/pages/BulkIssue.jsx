import Layout from "../components/Layout";
import TemplateCertificatePreview from "../components/TemplateCertificatePreview";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  UserRound,
  UsersRound,
  ArrowRight,
  Download,
  QrCode,
  FileText,
  Mail,
  Send,
  Loader2,
  Archive,
  RefreshCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toPng } from "html-to-image";
import { certificatePngToPdf } from "../certificateExport";
import { upsertIssuedCertificates, getCurrentIssuer, updateIssuedCertificate, loadIssuedCertificates } from "../certificateStore";
import { getNextCertificateNumber, loadInstitutionSettings, renderEmailTemplate } from "../institutionStore";
import { addAuditLog } from "../auditStore";
import { getSessionUser } from "../authStore";
import { certificateBytes32 } from "../blockchainService";
import { getVerificationUrl, publishCertificateForPublicVerification } from "../verificationUrl";

const EMAIL_KEY_FALLBACK = "email";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://certichain-1-xc8l.onrender.com").replace(/\/$/, "");

function makeId(name, course) {
  return getNextCertificateNumber();
}

function normaliseRow(row) {
  const indexed = {};

  Object.entries(row || {}).forEach(([key, value]) => {
    const cleanKey = String(key).replace(/^\uFEFF/, "").trim().toLowerCase();
    indexed[cleanKey] = typeof value === "string" ? value.trim() : value;
  });

  return indexed;
}

function getCsvEmail(row) {
  const indexed = normaliseRow(row);
  return String(indexed.email ?? "").trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function isPlaceholderEmail(email) {
  const domain = String(email || "").trim().toLowerCase().split("@").pop() || "";
  return ["example.com", "example.org", "example.net", "invalid", "localhost", "test"].includes(domain) ||
    domain.endsWith(".invalid") || domain.endsWith(".localhost") || domain.endsWith(".test") || domain.endsWith(".example");
}

function valueForVariable(data, key) {
  const exact = data?.[key];
  if (exact !== undefined && exact !== null) return String(exact);
  const found = Object.entries(data || {}).find(
    ([entryKey]) => String(entryKey).toLowerCase() === String(key).toLowerCase()
  );
  return found ? String(found[1] ?? "") : "";
}

function getEmailVariable(variables) {
  return (
    variables.find((variable) => String(variable.key).toLowerCase() === "email") ||
    variables.find((variable) => String(variable.type).toLowerCase() === "email") ||
    null
  );
}

function getRecipientVariable(variables) {
  return (
    variables.find((variable) =>
      ["name", "student_name", "recipient_name"].includes(
        String(variable.key).toLowerCase()
      )
    ) || variables[0] || null
  );
}

function getCourseVariable(variables) {
  return variables.find((variable) => String(variable.key).toLowerCase() === "course");
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPreviewSheet(container) {
  return container?.querySelector?.('[data-certificate-sheet="true"]') || null;
}

async function waitForCertificateRender() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    await document.fonts?.ready;
  } catch {
    // Font readiness is optional.
  }

  const images = Array.from(document.images || []).filter((img) => !img.complete);
  if (images.length) {
    await Promise.allSettled(images.map((img) => new Promise((resolve) => {
      const done = () => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
        resolve();
      };
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      window.setTimeout(done, 15000);
    })));
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function captureCertificate(container) {
  const sheet = getPreviewSheet(container);
  if (!sheet) throw new Error("Certificate preview is not ready.");

  await waitForCertificateRender();
  return toPng(sheet, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
  });
}


async function getEmailServerStatus() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/email/status`, { signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to check the email server.");
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Cannot reach the email backend at ${API_BASE_URL} (request timed out).`);
    }
    throw new Error(`Cannot reach the email backend at ${API_BASE_URL}. ${error.message}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

async function sendCertificateEmail({ record, dataUrl, verificationUrl, orientation }) {
  const png = dataUrl;
  const pdf = await certificatePngToPdf(png, orientation || record?.template?.page?.orientation || "landscape");
  const pdfArray = new Uint8Array(await pdf.arrayBuffer());
  let binary = "";
  for (let i = 0; i < pdfArray.length; i += 1) binary += String.fromCharCode(pdfArray[i]);
  const pdfBase64 = btoa(binary);

  const recipientName =
    valueForVariable(record.data, "name") ||
    valueForVariable(record.data, "student_name") ||
    valueForVariable(record.data, "recipient_name") ||
    "Participant";
  const course = valueForVariable(record.data, "course") || record.templateName;
  const subject = `Certificate issued — ${recipientName}`;
  const safeName = escapeText(recipientName);
  const safeCourse = escapeText(course);
  const safeId = escapeText(record.id);
  const safeVerificationUrl = escapeText(verificationUrl);

  const response = await fetch(`${API_BASE_URL}/api/email/certificate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: record.email,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2 style="margin:0 0 12px">Your certificate has been issued</h2>
          <p>Hello ${safeName},</p>
          <p>Your certificate for <strong>${safeCourse}</strong> has been issued through CertiChain.</p>
          <p><strong>Certificate ID:</strong> ${safeId}</p>
          <p>You will find the PDF certificate attached to this email.</p>
          <p><a href="${safeVerificationUrl}" target="_blank" rel="noreferrer">Open public verification page</a></p>
          <p style="color:#64748b;font-size:12px">This email was sent by CertiChain.</p>
        </div>
      `,
      filename: `${record.id}.pdf`,
      contentType: "application/pdf",
      contentBase64: pdfBase64,
      attachments: [],
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const prefix = data?.code === "EMAIL_NOT_CONFIGURED" ? "Email setup required: " : "Email service error: ";
    throw new Error(`${prefix}${data.error || "Email service returned an error."}`);
  }

  return data;
}

async function sendOnePreparedMessage(item, maxAttempts = 2) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 120000);
    try {
      const response = await fetch(`${API_BASE_URL}/api/email/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.message),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.error || "Certificate email failed.");
        error.httpStatus = response.status;
        throw error;
      }
      return {
        certificateId: item.record.id,
        to: item.record.email,
        sent: Boolean(data.sent),
        messageId: data.messageId || null,
      };
    } catch (error) {
      lastError = error;
      const retryable = error?.name === "AbortError" ||
        error?.httpStatus >= 500 || error?.httpStatus === 429 ||
        /timed out|timeout|network|failed to fetch|connection|socket/i.test(String(error?.message || ""));
      if (!retryable || attempt >= maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  return {
    certificateId: item.record.id,
    to: item.record.email,
    sent: false,
    error: lastError?.name === "AbortError" ? "Email request timed out." : (lastError?.message || "Certificate email failed."),
  };
}

async function sendPreparedMessagesIndividually(preparedItems) {
  const results = await Promise.all(
    preparedItems.map((item) => sendOnePreparedMessage(item))
  );
  return results;
}

export default function BulkIssue() {
  const input = useRef(null);
  const previewRef = useRef(null);
  const bulkPreviewRefs = useRef({});

  const [mode, setMode] = useState("single");
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [variables, setVariables] = useState([]);
  const [form, setForm] = useState({});
  const [generatedId, setGeneratedId] = useState("");
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState(
    "Select a saved template to load its variables."
  );
  const [bulkIssued, setBulkIssued] = useState(false);
  const [issuedBulkRecords, setIssuedBulkRecords] = useState([]);
  const [singleEmailState, setSingleEmailState] = useState("idle");
  const [bulkEmailState, setBulkEmailState] = useState({ status: "idle", sent: 0, failed: 0, total: 0 });
  const [emailStatus, setEmailStatus] = useState({});
  const [zipBusy, setZipBusy] = useState(false);
  const singleAutoEmailStartedRef = useRef(new Set());
  const bulkAutoEmailStartedRef = useRef(new Set());

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("certichain-templates") || "[]");
      const templates = Array.isArray(stored) ? stored : [];
      setSavedTemplates(templates);
      if (templates.length > 0) setSelectedTemplateId(templates[0].id);
    } catch {
      setSavedTemplates([]);
      setSelectedTemplateId("");
    }
  }, []);

  const selectedTemplate =
    savedTemplates.find((template) => template.id === selectedTemplateId) || null;

  useEffect(() => {
    if (!selectedTemplate) {
      setVariables([]);
      setForm({});
      setGeneratedId("");
      setRows([]);
      setIssuedBulkRecords([]);
      setBulkIssued(false);
      setEmailStatus({});
      return;
    }

    const nextVariables = Array.isArray(selectedTemplate.variables)
      ? selectedTemplate.variables
      : [];
    setVariables(nextVariables);

    const nextForm = {};
    nextVariables.forEach((variable) => {
      nextForm[variable.key] = "";
    });

    setForm(nextForm);
    setGeneratedId("");
    setRows([]);
    setIssuedBulkRecords([]);
    setBulkIssued(false);
    setSingleEmailState("idle");
    setBulkEmailState({ status: "idle", sent: 0, failed: 0, total: 0 });
    setEmailStatus({});
    setMessage(
      nextVariables.length
        ? `"${selectedTemplate.name}" selected. Its variables are ready.`
        : `"${selectedTemplate.name}" has no variables. Add variables in the template editor first.`
    );
  }, [selectedTemplateId, savedTemplates]);

  const activeVariables = variables;
  const emailVariable = useMemo(() => getEmailVariable(activeVariables), [activeVariables]);
  const emailKey = emailVariable?.key || EMAIL_KEY_FALLBACK;

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setGeneratedId("");
    setSingleEmailState("idle");
  };

  const persistRecords = (records) => upsertIssuedCertificates(records);

  const generateSingle = () => {
    if (!selectedTemplate) {
      setMessage("Select a saved template before issuing a certificate.");
      return;
    }

    const missingRequired = activeVariables
      .filter((variable) => variable.required)
      .filter((variable) => String(form[variable.key] ?? "").trim() === "");

    if (missingRequired.length > 0) {
      setMessage(
        `Please fill the required field${missingRequired.length > 1 ? "s" : ""}: ${missingRequired
          .map((variable) => variable.label)
          .join(", ")}.`
      );
      return;
    }

    const enteredEmail = valueForVariable(form, emailKey).trim();
    if (!enteredEmail) {
      setMessage("Enter the participant email address before issuing the certificate. New certificates are emailed automatically after issuance.");
      return;
    }
    if (!isValidEmail(enteredEmail) || isPlaceholderEmail(enteredEmail)) {
      setMessage("Enter a valid participant email address before issuing the certificate.");
      return;
    }

    const firstText = valueForVariable(form, getRecipientVariable(activeVariables)?.key || "") || "Certificate";
    const course = valueForVariable(form, getCourseVariable(activeVariables)?.key || "") || selectedTemplate.name;
    const id = makeId(firstText, course);

    const record = {
      id,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      template: selectedTemplate,
      data: { ...form },
      email: enteredEmail,
      issuedAt: new Date().toISOString(),
      status: "Issued",
      emailStatus: "Not sent",
      createdBy: getCurrentIssuer(),
      createdByName: getSessionUser()?.name || "Authorized Institution",
      immutable: true,
      documentHash: certificateBytes32(`${id}:${JSON.stringify(form)}:${selectedTemplate.id}`),
      blockchainStatus: "Not registered",
      ipfsStatus: "Not uploaded",
      history: [{ action: "Created", at: new Date().toISOString(), actor: getSessionUser()?.email || getCurrentIssuer() }],
    };

    try {
      persistRecords([record]);
      void publishCertificateForPublicVerification(record);
      setGeneratedId(id);
        setEmailStatus({ [id]: "Preparing…" });
      setSingleEmailState("sending");
      setMessage(`Certificate ${id} was issued successfully. Sending it to ${enteredEmail}…`);
    } catch (error) {
      setMessage(error?.message || "Unable to save the issued certificate.");
    }
  };

  const downloadSinglePng = async () => {
    if (!generatedId || !previewRef.current) return;
    try {
      const dataUrl = await captureCertificate(previewRef.current);
      const anchor = document.createElement("a");
      anchor.download = `${generatedId}.png`;
      anchor.href = dataUrl;
      anchor.click();
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Unable to download the certificate.");
    }
  };

  const emailSingle = async (recordOverride = null) => {
    const record = recordOverride || loadIssuedCertificates().find((item) => item.id === generatedId);
    if (!record) return;
    const email = String(record.email || valueForVariable(record.data, emailKey) || "").trim();
    if (!isValidEmail(email) || isPlaceholderEmail(email)) {
      updateRecordEmailStatus(record.id, "Failed", { emailError: "Invalid or missing email address." });
      setSingleEmailState("error");
      setEmailStatus((current) => ({ ...current, [record.id]: "Failed" }));
      setMessage(`Certificate ${record.id} was issued, but the participant email address is invalid.`);
      return;
    }
    try {
      setSingleEmailState("sending");
      setEmailStatus((current) => ({ ...current, [record.id]: "Sending…" }));
      const serverStatus = await getEmailServerStatus();
      if (!serverStatus.configured || !serverStatus.connected) {
        const reason = serverStatus.message || "Gmail is not connected.";
        updateRecordEmailStatus(record.id, "Failed", { emailError: reason });
        setSingleEmailState("error");
        setEmailStatus((current) => ({ ...current, [record.id]: "Failed" }));
        setMessage(`Certificate ${record.id} was issued, but the automatic email was not sent: ${reason}`);
        return;
      }
      const dataUrl = await captureCertificate(previewRef.current);
      const verificationUrl = getVerificationUrl(record.id);
      const result = await sendCertificateEmail({ record, dataUrl, verificationUrl, orientation: record?.template?.page?.orientation });
      const sent = Boolean(result.sent);
      updateRecordEmailStatus(record.id, sent ? "Sent" : "Failed", {
        email,
        emailSentAt: sent ? new Date().toISOString() : null,
        emailError: sent ? null : (result.error || "Email service did not confirm delivery."),
      });
      appendHistorySafe(record.id, sent ? "Email sent automatically" : "Automatic email failed", { to: email, error: sent ? null : (result.error || null) });
      addAuditLog(sent ? "Certificate email sent automatically" : "Automatic certificate email failed", { certificateId: record.id, to: email });
      setEmailStatus((current) => ({ ...current, [record.id]: sent ? "Sent" : "Failed" }));
      setSingleEmailState(sent ? "sent" : "error");
      setMessage(sent ? `Certificate ${record.id} was issued and emailed to ${email}.` : `Certificate ${record.id} was issued, but the email failed.`);
    } catch (error) {
      console.error(error);
      updateRecordEmailStatus(record.id, "Failed", { emailError: error.message || "Certificate email failed." });
      appendHistorySafe(record.id, "Automatic email failed", { to: email, error: error.message || "Certificate email failed." });
      addAuditLog("Automatic certificate email failed", { certificateId: record.id, to: email, error: error.message || "Certificate email failed." });
      setSingleEmailState("error");
      setEmailStatus((current) => ({ ...current, [record.id]: "Failed" }));
      setMessage(`Certificate ${record.id} was issued, but the email failed: ${error.message || "Certificate email failed."}`);
    }
  };

  const appendHistorySafe = (id, action, details = {}) => {
    try {
      const current = loadIssuedCertificates().find((item) => item.id === id);
      if (!current) return;
      const history = Array.isArray(current.history) ? current.history : [];
      updateIssuedCertificate(id, { history: [...history, { action, at: new Date().toISOString(), ...details }] });
    } catch {
      // Supplemental audit history must never block email delivery.
    }
  };

  const updateRecordEmailStatus = (recordId, statusText, extra = {}) => {
    setEmailStatus((current) => ({ ...current, [recordId]: statusText }));
    try {
      updateIssuedCertificate(recordId, { emailStatus: statusText, ...extra });
    } catch (error) {
      console.error("Unable to persist certificate email status:", error);
    }
  };

  useEffect(() => {
    if (!generatedId || !selectedTemplate) return;
    if (singleAutoEmailStartedRef.current.has(generatedId)) return;
    singleAutoEmailStartedRef.current.add(generatedId);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled) return;
      const record = loadIssuedCertificates().find((item) => item.id === generatedId);
      if (record) await emailSingle(record);
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [generatedId, selectedTemplateId]);

  const handleCsv = (file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("Please upload a CSV file for bulk certificate issuance.");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const imported = Array.isArray(result.data) ? result.data : [];
        const headers = Array.isArray(result.meta?.fields) ? result.meta.fields : [];
        const hasEmailColumn = headers.some(
          (header) => String(header || "").replace(/^\uFEFF/, "").trim().toLowerCase() === "email"
        );

        if (!hasEmailColumn) {
          setRows([]);
          setBulkIssued(false);
          setIssuedBulkRecords([]);
          setMessage(
            'CSV upload rejected: an "email" column is required. Download the CSV template and fill one email address per participant row.'
          );
          return;
        }

        if (!imported.length) {
          setRows([]);
          setBulkIssued(false);
          setMessage("The CSV file contains no participant records.");
          return;
        }

        setRows(imported);
        setIssuedBulkRecords([]);
        setBulkIssued(false);
        setMessage(
          `Loaded ${imported.length} participant ${imported.length === 1 ? "record" : "records"} from ${file.name}. The email column will be used to send each participant only their own certificate.`
        );
      },
      error: () => {
        setRows([]);
        setBulkIssued(false);
        setMessage("Unable to read this CSV file.");
      },
    });
  };

  const getDisplayData = (row) => {
    const indexed = normaliseRow(row);
    const csvEmail = getCsvEmail(row);
    const displayData = {};

    activeVariables.forEach((variable) => {
      const variableKey = String(variable.key).toLowerCase();
      const isEmailVariable =
        variableKey === "email" || String(variable.type || "").toLowerCase() === "email";

      displayData[variable.key] = isEmailVariable
        ? csvEmail
        : indexed[variableKey] ?? "";
    });

    // Keep the CSV email available to the certificate/email workflow even
    // when the saved template does not define an Email variable.
    displayData.email = csvEmail;

    return displayData;
  };

  const issueBulk = () => {
    if (!selectedTemplate) {
      setMessage("Select a saved template before issuing bulk certificates.");
      return;
    }

    if (!rows.length) {
      setMessage("Upload a CSV file with participant rows before issuing bulk certificates.");
      return;
    }

    // Certificate creation is independent from email delivery. A participant
    // record can be issued even when its email is a test/placeholder address
    // or needs correction later. Email validation is handled by the email
    // sending step so issuance itself cannot be blocked by email delivery/test data.
    const rowsWithMissingEmail = rows
      .map((row, index) => ({ row, index, email: getCsvEmail(row) }))
      .filter(({ email }) => !email);

    if (rowsWithMissingEmail.length > 0) {
      const first = rowsWithMissingEmail[0];
      setMessage(`Row ${first.index + 2} is missing the required email column value. Add an email address and upload the CSV again.`);
      return;
    }

    const existing = loadIssuedCertificates();
    const duplicateRows = rows
      .map((row, index) => {
        const indexed = normaliseRow(row);
        const email = getCsvEmail(row).toLowerCase();
        const course = String(indexed.course || selectedTemplate.name).trim().toLowerCase();
        return { index, email, course };
      })
      .filter(({ email, course }) => existing.some((record) => String(record.email || '').toLowerCase() === email && String(record.data?.course || record.templateName || '').trim().toLowerCase() === course));

    if (duplicateRows.length) {
      const preview = duplicateRows.slice(0, 5).map((item) => `Row ${item.index + 2}: ${item.email}`).join('\n');
      const proceed = window.confirm(`Duplicate certificate candidates were found.\n\n${preview}${duplicateRows.length > 5 ? `\n…and ${duplicateRows.length - 5} more.` : ''}\n\nIssued certificates are immutable, so an existing record will not be replaced. Click OK to issue new certificate IDs, or Cancel to stop.`);
      if (!proceed) {
        setMessage('Bulk issuance cancelled because duplicate certificate candidates were found.');
        return;
      }
    }

    try {
      const issuedAt = new Date().toISOString();
      const indexedRows = rows.map((row) => normaliseRow(row));
      const issuedRecords = indexedRows.map((row, index) => {
        const displayData = getDisplayData(row);
        const recipient =
          displayData.name ||
          displayData.student_name ||
          displayData.recipient_name ||
          valueForVariable(displayData, activeVariables[0]?.key || "") ||
          `Recipient-${index + 1}`;
        const course =
          displayData.course ||
          valueForVariable(displayData, getCourseVariable(activeVariables)?.key || "") ||
          selectedTemplate.name;
        const id = makeId(recipient, course);
        const participantEmail = getCsvEmail(row);

        return {
          id,
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
          template: selectedTemplate,
          data: displayData,
          email: participantEmail,
          issuedAt,
          status: "Issued",
          emailStatus: "Not sent",
          createdBy: getCurrentIssuer(),
          createdByName: getSessionUser()?.name || "Authorized Institution",
          immutable: true,
          documentHash: certificateBytes32(`${id}:${JSON.stringify(displayData)}:${selectedTemplate.id}`),
          blockchainStatus: "Not registered",
          ipfsStatus: "Not uploaded",
          history: [{ action: "Created", at: new Date().toISOString(), actor: getSessionUser()?.email || getCurrentIssuer() }],
        };
      });

      // Persist before switching the UI into the issued state. The certificate
      // store deduplicates the template snapshot, so a large certificate design
      // (especially one containing images) is stored once rather than once per
      // CSV row. This keeps bulk issuance reliable for larger CSV files.
      persistRecords(issuedRecords);
      // Mirror non-sensitive certificate metadata to the public verification registry.
      // A sync failure never blocks issuance; the QR remains valid and can be synced again later.
      void Promise.allSettled(issuedRecords.map((record) => publishCertificateForPublicVerification(record)));
      addAuditLog('Bulk certificates issued', { count: issuedRecords.length, template: selectedTemplate.name, certificateIds: issuedRecords.map((record) => record.id) });

      setIssuedBulkRecords(issuedRecords);
      setEmailStatus(Object.fromEntries(issuedRecords.map((record) => [record.id, "Not sent"])));
      setBulkIssued(true);
      setBulkEmailState({ status: "idle", sent: 0, failed: 0, total: issuedRecords.length });
      setMessage(
        `${issuedRecords.length} certificates were created successfully using "${selectedTemplate.name}". Automatic email delivery is starting now. Email status will be recorded for each certificate.`
      );
    } catch (error) {
      console.error("Bulk certificate issuance failed:", error);
      setIssuedBulkRecords([]);
      setBulkIssued(false);
      setBulkEmailState({ status: "idle", sent: 0, failed: 0, total: 0 });
      setMessage(error?.message || "Bulk certificate issuance failed. No certificates were created.");
    }
  };

  const downloadCsvTemplate = () => {
    const variableKeys = activeVariables.map((variable) => variable.key);
    const keys = ["email", ...variableKeys.filter((key) => String(key).toLowerCase() !== "email")];
    const csv = `${keys.join(",")}\n${keys.map(() => "").join(",")}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "certichain-participants-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const expectedKeys = activeVariables
    .map((variable) => variable.key)
    .filter((key) => String(key).toLowerCase() !== "email");

  const getValidation = (row) => {
    const indexed = normaliseRow(row);
    const missing = expectedKeys.filter((key) => {
      const value = indexed[String(key).trim().toLowerCase()];
      return value === undefined || String(value ?? "").trim() === "";
    });

    const email = getCsvEmail(row);
    const emailProblem = !email
      ? "Email is required"
      : !isValidEmail(email)
        ? "Invalid email"
        : "";

    if (!emailProblem && missing.length === 0) {
      return { ok: true, text: "Ready" };
    }

    const problems = emailProblem ? [emailProblem, ...missing] : missing;
    return {
      ok: false,
      text: `${problems.slice(0, 2).join(", ")}${problems.length > 2 ? "…" : ""}`,
    };
  };

  const sendBulkEmails = async (recordsToSend = issuedBulkRecords, isRetry = false) => {
    if (!recordsToSend.length) return;

    const total = recordsToSend.length;
    if (!isRetry) {
      setBulkEmailState({ status: "sending", sent: 0, failed: 0, total });
      setEmailStatus((current) => ({ ...current, ...Object.fromEntries(recordsToSend.map((record) => [record.id, "Preparing…"])) }));
    } else {
      setBulkEmailState({ status: "sending", sent: 0, failed: 0, total });
      setEmailStatus((current) => ({ ...current, ...Object.fromEntries(recordsToSend.map((record) => [record.id, "Retrying…"])) }));
    }
    setMessage(`${isRetry ? "Retrying" : "Preparing"} ${total} participant certificates. They will be dispatched through Gmail API immediately in parallel…`);

    try {
      const serverStatus = await getEmailServerStatus();
      if (!serverStatus.configured || !serverStatus.connected) {
        const statusText = "Not sent — email service not configured";
        recordsToSend.forEach((record) => updateRecordEmailStatus(record.id, statusText));
        setEmailStatus((current) => ({ ...current, ...Object.fromEntries(recordsToSend.map((record) => [record.id, statusText])) }));
        setBulkEmailState({ status: "failed", sent: 0, failed: total, total });
        setMessage("Email was not sent because Gmail is not connected. Open Settings, configure Google OAuth, authorize the Gmail account, add GMAIL_REFRESH_TOKEN to Render, and redeploy the backend.");
        return;
      }

      const sendable = recordsToSend.filter((record) => isValidEmail(record.email) && !isPlaceholderEmail(record.email));
      const missing = recordsToSend.filter((record) => !isValidEmail(record.email) || isPlaceholderEmail(record.email));

      if (sendable.length === 0) {
        missing.forEach((record) => updateRecordEmailStatus(record.id, "Failed", {
        emailError: isPlaceholderEmail(record.email)
          ? "Placeholder email address. Replace example.com/test/localhost with a real participant email."
          : "Missing or invalid email address.",
      }));
        setBulkEmailState({ status: "failed", sent: 0, failed: total, total });
        setMessage("No valid participant email addresses were available in the issued batch.");
        return;
      }

      setMessage(`Preparing ${sendable.length} certificate attachments in parallel…`);
      const prepared = await Promise.all(sendable.map(async (record) => {
        try {
          const container = bulkPreviewRefs.current[record.id];
          if (!container) throw new Error("Certificate preview is not available.");
          const dataUrl = await captureCertificate(container);
          const pdf = await certificatePngToPdf(dataUrl, record?.template?.page?.orientation || "landscape");
          const pdfArray = new Uint8Array(await pdf.arrayBuffer());
          let binary = "";
          for (let i = 0; i < pdfArray.length; i += 1) binary += String.fromCharCode(pdfArray[i]);
          const pdfBase64 = btoa(binary);
          const verificationUrl = getVerificationUrl(record.id);
          const recipientName = valueForVariable(record.data, "name") || valueForVariable(record.data, "student_name") || valueForVariable(record.data, "recipient_name") || "Participant";
          const course = valueForVariable(record.data, "course") || record.templateName;
          return {
            ok: true,
            record,
            message: {
              to: record.email,
              subject: `Certificate issued — ${recipientName}`,
              html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><h2 style="margin:0 0 12px">Your certificate has been issued</h2><p>Hello ${escapeText(recipientName)},</p><p>Your certificate for <strong>${escapeText(course)}</strong> has been issued through CertiChain.</p><p><strong>Certificate ID:</strong> ${escapeText(record.id)}</p><p>You will find the PDF certificate attached to this email.</p><p><a href="${escapeText(verificationUrl)}" target="_blank" rel="noreferrer">Open public verification page</a></p><p style="color:#64748b;font-size:12px">This email was sent by CertiChain.</p></div>`,
              filename: `${record.id}.pdf`,
              contentType: "application/pdf",
              contentBase64: pdfBase64,
              attachments: [],
              certificateId: record.id,
            },
          };
        } catch (error) {
          return { ok: false, record, error: error?.message || "Certificate attachment preparation failed." };
        }
      }));

      const preparationFailures = prepared.filter((item) => !item.ok);
      preparationFailures.forEach((item) => updateRecordEmailStatus(item.record.id, "Failed", { emailError: item.error }));

      const ready = prepared.filter((item) => item.ok);
      ready.forEach((item) => updateRecordEmailStatus(item.record.id, "Sending…"));
      setMessage(`Sending ${ready.length} participant certificates in parallel. Each participant receives only the certificate from their own CSV row.`);

      // Use one HTTP request per certificate and launch all requests together.
      // This avoids a large JSON payload containing every PNG attachment, while
      // preserving parallel delivery and independent results for every recipient.
      const individualResults = await sendPreparedMessagesIndividually(ready);
      const serverResult = { results: individualResults };

      const resultById = new Map((serverResult.results || []).map((item) => [item.certificateId, item]));
      let sent = 0;
      let failed = preparationFailures.length + missing.length;

      ready.forEach((item) => {
        const outcome = resultById.get(item.record.id);
        if (outcome?.sent) {
          sent += 1;
          updateRecordEmailStatus(item.record.id, "Sent", { emailSentAt: new Date().toISOString(), emailError: null });
        } else {
          failed += 1;
          updateRecordEmailStatus(item.record.id, "Failed", {
            emailError: outcome?.error || "Certificate email failed.",
            emailErrorCode: outcome?.errorCode || null,
            emailResponseCode: outcome?.responseCode || null,
          });
        }
      });

      missing.forEach((record) => updateRecordEmailStatus(record.id, "Failed", {
        emailError: isPlaceholderEmail(record.email)
          ? "Placeholder email address. Replace example.com/test/localhost with a real participant email."
          : "Missing or invalid email address.",
      }));
      setEmailStatus((current) => ({
        ...current,
        ...Object.fromEntries(preparationFailures.map((item) => [item.record.id, "Failed"])),
        ...Object.fromEntries(missing.map((record) => [record.id, "Failed"])),
        ...Object.fromEntries(ready.map((item) => [item.record.id, resultById.get(item.record.id)?.sent ? "Sent" : "Failed"])),
      }));

      setBulkEmailState({ status: failed === 0 ? "sent" : sent > 0 ? "partial" : "failed", sent, failed, total });
      setMessage(
        failed === 0
          ? `All ${sent} participant certificates were handed to the Gmail API for parallel delivery.`
          : `${sent} email${sent === 1 ? "" : "s"} sent, ${failed} failed. Emails were submitted in parallel; the recipient mail provider may still queue or deliver them at different times.`
      );
    } catch (error) {
      console.error(error);
      setBulkEmailState({ status: "failed", sent: 0, failed: total, total });
      setMessage(error.message || "Bulk certificate email failed.");
    }
  };

  useEffect(() => {
    if (!bulkIssued || !issuedBulkRecords.length) return;
    const batchKey = issuedBulkRecords.map((record) => record.id).join("|");
    if (bulkAutoEmailStartedRef.current.has(batchKey)) return;
    bulkAutoEmailStartedRef.current.add(batchKey);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (cancelled) return;
      await sendBulkEmails(issuedBulkRecords, false);
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [bulkIssued, issuedBulkRecords]);

  const downloadBulkZip = async () => {
    if (!issuedBulkRecords.length) return;

    try {
      setZipBusy(true);
      const zip = new JSZip();
      const folder = zip.folder("certichain-certificates");
      if (!folder) throw new Error("Unable to create ZIP folder.");

      const manifest = [["certificate_id", "recipient_email", "recipient_name", "course", "issued_at", "email_status"]];

      for (const record of issuedBulkRecords) {
        const container = bulkPreviewRefs.current[record.id];
        if (!container) throw new Error(`Preview not available for ${record.id}.`);

        const dataUrl = await captureCertificate(container);
        const base64 = dataUrl.split(",")[1];
        const recipient =
          valueForVariable(record.data, "name") ||
          valueForVariable(record.data, "student_name") ||
          valueForVariable(record.data, "recipient_name") ||
          "Participant";
        const course = valueForVariable(record.data, "course") || record.templateName;
        const safeFileName = `${record.id}-${String(recipient).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "participant"}.png`;
        folder.file(safeFileName, base64, { base64: true });
        manifest.push([
          record.id,
          record.email,
          recipient,
          course,
          record.issuedAt,
          emailStatus[record.id] || record.emailStatus || "Not sent",
        ]);
      }

      const manifestCsv = manifest
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n");
      folder.file("manifest.csv", manifestCsv);
      folder.file(
        "README.txt",
        `CertiChain certificate batch\nTemplate: ${selectedTemplate?.name || "Unknown"}\nCertificates: ${issuedBulkRecords.length}\nEach PNG uses the selected saved A4 template with participant variables and verification QR code.\n`
      );

      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `CertiChain-Certificates-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`Full ZIP downloaded with ${issuedBulkRecords.length} certificates and a manifest.csv file.`);
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Unable to create the full certificate ZIP.");
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <Layout
      title="Issue Certificate"
      subtitle="Create a single certificate or issue certificates in bulk"
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Step 1 • Select saved template</div>
              <h3 className="mt-1 text-lg font-bold text-slate-900">Choose the certificate template</h3>
              <p className="mt-1 text-sm text-slate-500">The template controls the fields available for single and bulk issuance.</p>
            </div>

            <div className="w-full lg:max-w-md">
              <label className="block text-sm font-medium text-slate-600">Saved template</label>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select a saved template</option>
                {savedTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} • {template.page?.orientation === "portrait" ? "Portrait" : "Landscape"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedTemplate && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-bold text-blue-900">{selectedTemplate.name}</div>
                <div className="mt-1 text-xs text-blue-700">
                  {selectedTemplate.page?.orientation === "portrait" ? "Portrait" : "Landscape"} • A4 • {activeVariables.length} variable{activeVariables.length === 1 ? "" : "s"} loaded
                </div>
              </div>
              <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700">Template selected</div>
            </div>
          )}

          {savedTemplates.length === 0 && (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">No saved templates are available. Create and save a template first.</div>
          )}
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Certificate issuance</div>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">Issue Certificate</h2>
              <p className="mt-1 text-sm text-slate-500">Create a certificate and automatically email the PDF to the participant. Bulk certificates are also emailed automatically after issuance.</p>
            </div>

            <div className="grid w-full max-w-xl grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => setMode("single")} className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${mode === "single" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                <UserRound size={17} /> Single certificate
              </button>
              <button type="button" onClick={() => setMode("bulk")} className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${mode === "bulk" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                <UsersRound size={17} /> Bulk certificates
              </button>
            </div>
          </div>
        </div>

        {!selectedTemplate ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <FileText className="mx-auto text-blue-500" size={40} />
            <h3 className="mt-4 text-lg font-bold text-slate-900">Select a saved template to continue</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Once a template is selected, its variables will automatically appear here for single certificate entry and will define the CSV columns for bulk issuance.</p>
          </section>
        ) : mode === "single" ? (
          <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Create one certificate</h3>
                  <p className="mt-1 text-sm text-slate-500">Enter the values for the variables defined in your template.</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><UserRound size={19} /></div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">Using <span className="font-semibold">{selectedTemplate.name}</span> • {selectedTemplate.page?.orientation === "portrait" ? "Portrait" : "Landscape"} • A4</div>

              <div className="mt-6 space-y-4">
                {activeVariables.map((variable) => (
                  <label key={variable.key} className="block text-sm">
                    <span className="font-medium text-slate-600">{variable.label}<span className="ml-2 font-mono text-xs text-blue-600">{`{{${variable.key}}}`}</span></span>
                    <input
                      type={variable.type === "email" ? "email" : variable.type === "number" ? "number" : variable.type === "date" ? "date" : "text"}
                      value={form[variable.key] || ""}
                      onChange={(event) => updateField(variable.key, event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                ))}
                {!emailVariable && (
                  <label className="block text-sm">
                    <span className="font-medium text-slate-600">Email Address <span className="ml-2 text-xs font-semibold text-rose-600">Required for automatic delivery</span></span>
                    <input
                      type="email"
                      value={form.email || ""}
                      onChange={(event) => updateField("email", event.target.value)}
                      placeholder="participant@gmail.com"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </label>
                )}
              </div>

              <button type="button" onClick={generateSingle} disabled={!selectedTemplate} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Issue single certificate <ArrowRight size={17} /></button>

              {generatedId && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <Mail size={18} className="mt-0.5 shrink-0 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900">Certificate issued</div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">The participant email was provided before issuance. CertiChain automatically sends the certificate after creation.</p>
                      <div className={`mt-3 rounded-xl px-3 py-2.5 text-xs font-semibold ${emailStatus[generatedId] === "Sent" ? "bg-emerald-50 text-emerald-700" : emailStatus[generatedId] === "Failed" ? "bg-rose-50 text-rose-700" : "bg-white text-blue-700"}`}>
                        Email status: {emailStatus[generatedId] || "Preparing…"}
                      </div>
                      {emailStatus[generatedId] === "Failed" && (
                        <button type="button" onClick={() => emailSingle(loadIssuedCertificates().find((item) => item.id === generatedId))} disabled={singleEmailState === "sending"} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">
                          <RefreshCcw size={15} /> Retry email
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <Link to="/templates/new" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><FileText size={16} /> Edit certificate template</Link>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">Live certificate preview</h3>
                  <p className="text-xs text-slate-500">The preview and issued certificate use the exact selected saved template, including design, positions, sizes, rotation, rich paragraph formatting, images, borders, variables and QR code.</p>
                </div>

                {generatedId && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={downloadSinglePng} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Download size={16} /> PNG</button>
                    <Link to={`/verify/${generatedId}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"><QrCode size={16} /> Verify</Link>
                  </div>
                )}
              </div>

              <div ref={previewRef} className="rounded-3xl bg-slate-100 p-2 sm:p-4">
                <TemplateCertificatePreview template={selectedTemplate} form={form} certificateId={generatedId || "PREVIEW"} />
              </div>

              {generatedId && (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 text-emerald-600" size={19} />
                    <div>
                      <div className="text-sm font-semibold text-emerald-800">Certificate ready</div>
                      <div className="mt-1 text-xs text-emerald-700">Certificate ID: <span className="font-mono">{generatedId}</span></div>
                      <div className="mt-1 text-xs text-emerald-700">Email status: <span className="font-semibold">{emailStatus[generatedId] || "Not sent"}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Issue certificates in bulk</h3>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500">Upload one CSV with one participant per row. The CSV must contain an <strong>email</strong> column. Each row creates its own certificate, and CertiChain automatically emails each newly issued certificate to that row's recipient.</p>
                </div>
                <button type="button" onClick={downloadCsvTemplate} className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download size={16} /> Download CSV template</button>
              </div>

              <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; handleCsv(file); }} />

              <button type="button" onClick={() => { if (!selectedTemplate) { setMessage("Select a saved template before uploading CSV data."); return; } input.current?.click(); }} className="mt-6 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center hover:border-blue-300 hover:bg-blue-50/30">
                <UploadCloud size={36} className="text-blue-600" />
                <b className="mt-4 text-base text-slate-800">Upload CSV file</b>
                <span className="mt-1 text-sm text-slate-400">One participant per row • required column: email</span>
                <span className="mt-4 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500">CSV only</span>
              </button>

              <div className="mt-5 flex items-start gap-2 text-sm text-slate-500"><FileSpreadsheet size={18} className="mt-0.5 shrink-0" /><span>{message}</span></div>
            </section>

            {rows.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">CSV data preview</h3>
                    <p className="mt-1 text-sm text-slate-500">{rows.length} records loaded. The <strong>email</strong> column is used as the individual recipient address for each certificate.</p>
                  </div>
                  <button type="button" onClick={issueBulk} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"><ArrowRight size={17} /> Issue & email bulk certificates</button>
                </div>

                <div className="border-b border-slate-100 bg-slate-50 p-5 sm:p-6">
                  <div className="mb-3">
                    <h4 className="text-sm font-bold text-slate-800">Certificate preview from selected template</h4>
                    <p className="mt-1 text-xs text-slate-500">The first CSV row is rendered using the exact saved template before bulk issuance.</p>
                  </div>
                  <TemplateCertificatePreview template={selectedTemplate} form={getDisplayData(rows[0])} certificateId="BULK-PREVIEW" />
                </div>

                <div className="overflow-auto">
                  <table className="w-full min-w-[900px]">
                    <thead><tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-400"><th className="px-5 py-4">Email</th>{activeVariables.filter((variable) => String(variable.key).toLowerCase() !== "email").map((variable) => <th key={variable.key} className="px-5 py-4">{variable.label}</th>)}<th className="px-5 py-4">Validation</th></tr></thead>
                    <tbody>{rows.slice(0, 50).map((row, index) => { const validation = getValidation(row); const indexed = normaliseRow(row); return <tr key={index} className="border-b border-slate-100 last:border-0"><td className="px-5 py-4 text-sm font-medium text-slate-700">{getCsvEmail(row) || "—"}</td>{activeVariables.filter((variable) => String(variable.key).toLowerCase() !== "email").map((variable) => <td key={variable.key} className="px-5 py-4 text-sm text-slate-700">{indexed[String(variable.key).toLowerCase()] ?? "—"}</td>)}<td className="px-5 py-4">{validation.ok ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={15} /> Ready</span> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><AlertCircle size={15} /> {validation.text}</span>}</td></tr>; })}</tbody>
                  </table>
                </div>

                {rows.length > 50 && <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">Showing the first 50 rows in the preview.</div>}
              </section>
            )}


          </div>
        )}

        {issuedBulkRecords.length > 0 && (
          <div className="pointer-events-none fixed left-[-25000px] top-0 opacity-0" aria-hidden="true">
            {issuedBulkRecords.map((record) => (
              <div key={record.id} ref={(node) => { if (node) bulkPreviewRefs.current[record.id] = node; }} style={{ width: 1123 }}>
                <TemplateCertificatePreview template={record.template} form={record.data || {}} certificateId={record.id} exportMode />
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
