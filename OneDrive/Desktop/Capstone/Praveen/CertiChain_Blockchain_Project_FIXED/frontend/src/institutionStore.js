export const INSTITUTION_SETTINGS_KEY = "certichain-institution-settings";

const DEFAULT_SETTINGS = {
  institutionName: "CertiChain Institution",
  officialEmail: "",
  website: "",
  phone: "",
  address: "",
  authorizedName: "Authorized Institution",
  designation: "Certificate Issuer",
  logoDataUrl: "",
  signatureDataUrl: "",
  certificateNumbering: {
    prefix: "CERT",
    yearEnabled: true,
    startingNumber: 1,
    numberLength: 6,
    nextNumber: 1,
  },
  emailTemplate: {
    subject: "Certificate of Completion – {{name}}",
    body: "Dear {{name}},\n\nCongratulations!\n\nPlease find attached your certificate for {{course}}.\n\nCertificate ID: {{certificate_id}}\n\nVerify your certificate:\n{{verification_url}}\n\nRegards,\n{{institution_name}}",
  },
  blockchain: {
    network: "Ethereum Sepolia",
    contractAddress: "",
    rpcUrl: "",
  },
  ipfs: {
    gateway: "https://ipfs.io/ipfs/",
    uploadEndpoint: "",
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadInstitutionSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INSTITUTION_SETTINGS_KEY) || "null");
    return {
      ...clone(DEFAULT_SETTINGS),
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      certificateNumbering: {
        ...DEFAULT_SETTINGS.certificateNumbering,
        ...(parsed?.certificateNumbering || {}),
      },
      emailTemplate: {
        ...DEFAULT_SETTINGS.emailTemplate,
        ...(parsed?.emailTemplate || {}),
      },
      blockchain: {
        ...DEFAULT_SETTINGS.blockchain,
        ...(parsed?.blockchain || {}),
      },
      ipfs: {
        ...DEFAULT_SETTINGS.ipfs,
        ...(parsed?.ipfs || {}),
      },
    };
  } catch {
    return clone(DEFAULT_SETTINGS);
  }
}

export function saveInstitutionSettings(next) {
  const merged = {
    ...loadInstitutionSettings(),
    ...(next || {}),
  };
  merged.certificateNumbering = {
    ...loadInstitutionSettings().certificateNumbering,
    ...(next?.certificateNumbering || {}),
  };
  merged.emailTemplate = {
    ...loadInstitutionSettings().emailTemplate,
    ...(next?.emailTemplate || {}),
  };
  merged.blockchain = {
    ...loadInstitutionSettings().blockchain,
    ...(next?.blockchain || {}),
  };
  merged.ipfs = {
    ...loadInstitutionSettings().ipfs,
    ...(next?.ipfs || {}),
  };
  localStorage.setItem(INSTITUTION_SETTINGS_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent("certichain:settings-updated"));
  return merged;
}

export function resetInstitutionSettings() {
  localStorage.setItem(INSTITUTION_SETTINGS_KEY, JSON.stringify(clone(DEFAULT_SETTINGS)));
  window.dispatchEvent(new CustomEvent("certichain:settings-updated"));
  return clone(DEFAULT_SETTINGS);
}

export function renderEmailTemplate(text, values) {
  return String(text || "").replace(/{{\s*([^}]+?)\s*}}/g, (_, key) => String(values?.[String(key).trim()] ?? ""));
}

export function getNextCertificateNumber() {
  const settings = loadInstitutionSettings();
  const numbering = settings.certificateNumbering;
  const current = Math.max(1, Number(numbering.nextNumber || numbering.startingNumber || 1));
  const year = numbering.yearEnabled ? `${new Date().getFullYear()}-` : "";
  const serial = String(current).padStart(Math.max(1, Number(numbering.numberLength || 6)), "0");
  const id = `${numbering.prefix || "CERT"}-${year}${serial}`;
  saveInstitutionSettings({ certificateNumbering: { ...numbering, nextNumber: current + 1 } });
  return id;
}

export { DEFAULT_SETTINGS };
