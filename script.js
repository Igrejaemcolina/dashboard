const SHEET_LINKS_CONFIG_URL = "sheet-links.json";
// Atualize os links utilizados pela dashboard em sheet-links.json.
const DEFAULT_SHEET_LINKS = {
  mainSheetId: "1mDhodf4gOXVNr7JTLr9sLWT-devdC1-pWmmfVoK0RNk",
  supplementalSheetId: "1FLPdqmH6xOaMbc2RUjuANDWWNaMpJlc8RGuYiPjC_GQ",
  serviceSheetId: "",
  serviceSheetGid: "",
  serviceSheetUrl: "",
  serviceHtmlUrl: "",
  serviceGvizUrl: "",
  serviceCsvUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQxT6NKzLoYEjJcVF-f-Z7llsdhxUHdB6ib3uHrhjnfO2jeD2NK0Ot5abJqSmNThoyt2WRh69yC3wPB/pub?gid=2086743732&single=true&output=csv",
  parentsCsvUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQKe0sITHUBQQ9maOOcKKgAPPdF7v_ZR8Qb1ZdbRLsC5gqeDyhXjOEwbrnronhTSnFPIhlf3_7u-g0O/pub?gid=821736003&single=true&output=csv",
  careNetworkSheetId: "1XWYkdQTUHo5qhcnaYVpexxCxtL9Tifjm2tmDnT6ZTC4",
  careNetworkSheetGid: "457208564",
  careNetworkSheetUrl:
    "https://docs.google.com/spreadsheets/d/1XWYkdQTUHo5qhcnaYVpexxCxtL9Tifjm2tmDnT6ZTC4/edit",
  careNetworkGvizUrl: "",
  careNetworkHtmlUrl: "",
};

const SERVICE_SHEET_HEADERS = {
  name: "Nomes:",
  services: "Serviços",
};

const PARENT_SHEET_HEADERS = {
  childName: "Nome do Adolescente(a)",
  childBirthday: "Aniversário do Adolescente",
  motherName: "Nome da Mãe",
  motherBirthday: "Aniversário da Mãe",
  motherPhone: "Telefone da Mãe",
  fatherName: "Nome do Pai",
  fatherBirthday: "Aniversário do Pai",
  fatherPhone: "Telefone do Pai",
  siblingStatus: "Possui Irmão(s)?",
  siblingParticipation: "Irmão participa na Casa?",
  siblingsList: "Irmãos (nome — data)",
  childPhone: "Telefone do Adolescente",
};

let SHEET_ID = "";
let SUPPLEMENTAL_SHEET_ID = "";
let SERVICE_GVIZ_URL = "";
let SERVICE_HTML_URL = "";
let SERVICE_SHEET_ID = "";
let SERVICE_SHEET_GID = "";
let SERVICE_CSV_URL = "";
let PARENTS_CSV_URL = "";
let CARE_NETWORK_GVIZ_URL = "";
let CARE_NETWORK_HTML_URL = "";
const CARE_NETWORK_PHONE_KEYS = [
  "telefone",
  "telefone principal",
  "telefone cadastrado",
  "telefone do cadastrado",
  "telefone do cuidado",
  "celular",
  "contato",
  "contato principal",
  "phone",
];
const CARE_NETWORK_APPROACH_KEYS = [
  "quem abordou",
  "abordou",
  "abordagem",
  "abordagem feita por",
  "quem fez a abordagem",
  "responsavel pela abordagem",
  "abordado por",
  "responsavel",
  "responsavel direto",
  "quem acompanhou",
  "acompanhador",
  "acompanhante",
];
const REFRESH_INTERVAL = 60_000; // 1 minuto
let GVIZ_URL = "";
let SUPPLEMENTAL_GVIZ_URL = "";

function sanitizeSheetId(value) {
  if (value == null) {
    return "";
  }
  const trimmed = String(value).trim();
  return trimmed || "";
}

function normalizeGid(value) {
  if (value == null) {
    return "";
  }
  const trimmed = String(value).trim();
  return trimmed || "";
}

function isPublishedSheetId(sheetId) {
  if (!sheetId) {
    return false;
  }
  const value = String(sheetId).trim();
  if (!value) {
    return false;
  }
  return /^2pacx-/i.test(value);
}

function extractSheetReference(value) {
  const result = { id: "", gid: "", url: "" };
  if (value == null) {
    return result;
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return result;
  }

  result.url = stringValue;

  if (/^https?:\/\//i.test(stringValue)) {
    try {
      const url = new URL(stringValue);
      const segments = url.pathname.split("/").filter(Boolean);
      const dIndex = segments.indexOf("d");
      if (dIndex >= 0) {
        const next = segments[dIndex + 1] ?? "";
        if (next === "e" && segments.length > dIndex + 2) {
          result.id = segments[dIndex + 2];
        } else if (next) {
          result.id = next;
        }
      }
      const gidParam = url.searchParams.get("gid");
      if (gidParam) {
        result.gid = gidParam;
      }
    } catch (error) {
      return result;
    }
  } else {
    result.id = stringValue;
  }

  return result;
}

function needsPublishedHtmlReplacement(url) {
  if (!url) {
    return true;
  }

  const stringValue = String(url).trim();
  if (!stringValue) {
    return true;
  }

  if (!/^https?:\/\//i.test(stringValue)) {
    return true;
  }

  const normalized = stringValue.toLowerCase();
  if (!normalized.includes("docs.google.com")) {
    return false;
  }
  if (normalized.includes("/pubhtml")) {
    return false;
  }
  if (normalized.includes("/d/e/")) {
    return false;
  }
  if (normalized.includes("/pub") && normalized.includes("output=html")) {
    return false;
  }

  return (
    normalized.includes("/edit") ||
    normalized.includes("/view") ||
    normalized.includes("/preview") ||
    normalized.endsWith("/d") ||
    normalized.endsWith("/d/")
  );
}

function needsGvizReplacement(url) {
  if (!url) {
    return true;
  }

  const stringValue = String(url).trim();
  if (!stringValue) {
    return true;
  }

  if (!/^https?:\/\//i.test(stringValue)) {
    return true;
  }

  const normalized = stringValue.toLowerCase();
  if (!normalized.includes("docs.google.com")) {
    return false;
  }

  return !normalized.includes("/gviz/");
}

function buildPublishedHtmlUrl(sheetId, gid) {
  if (!sheetId) {
    return "";
  }

  const suffix = gid ? `?gid=${gid}&single=true` : "?single=true";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/pubhtml${suffix}`;
}

function buildGvizUrl(sheetId, gid) {
  if (!sheetId) {
    return "";
  }

  const suffix = gid ? `&gid=${gid}` : "";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json${suffix}`;
}

function resolveCareNetworkHtmlUrl(rawUrl) {
  const trimmed = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!trimmed) {
    return "";
  }

  if (!needsPublishedHtmlReplacement(trimmed)) {
    return trimmed;
  }

  const info = extractSheetReference(trimmed);
  const sheetId = sanitizeSheetId(info.id);
  const gid = normalizeGid(info.gid);

  if (sheetId) {
    return buildPublishedHtmlUrl(sheetId, gid);
  }

  return trimmed;
}

function resolveCareNetworkSheetConfig(config) {
  const sheetInfo = extractSheetReference(config.sheetUrl);
  const htmlInfo = extractSheetReference(config.htmlUrl);
  const gvizInfo = extractSheetReference(config.gvizUrl);
  const configId = sanitizeSheetId(config.sheetId);
  const configGid = normalizeGid(config.sheetGid);

  let sheetId = configId || sheetInfo.id || htmlInfo.id || gvizInfo.id;
  if (!sheetId) {
    sheetId = sanitizeSheetId(DEFAULT_SHEET_LINKS.careNetworkSheetId);
  }

  let sheetGid = configGid || sheetInfo.gid || htmlInfo.gid || gvizInfo.gid;
  if (!sheetGid) {
    sheetGid = normalizeGid(DEFAULT_SHEET_LINKS.careNetworkSheetGid);
  }

  let htmlUrl = config.htmlUrl || config.sheetUrl || config.gvizUrl || "";
  if (sheetId && needsPublishedHtmlReplacement(htmlUrl)) {
    htmlUrl = buildPublishedHtmlUrl(sheetId, sheetGid);
  }

  let gvizUrl = config.gvizUrl || "";
  if (!gvizUrl && config.sheetUrl) {
    gvizUrl = config.sheetUrl;
  }
  if (!gvizUrl && config.htmlUrl) {
    gvizUrl = config.htmlUrl;
  }
  if (sheetId && needsGvizReplacement(gvizUrl)) {
    gvizUrl = buildGvizUrl(sheetId, sheetGid);
  }

  return {
    sheetId,
    sheetGid,
    htmlUrl,
    gvizUrl,
  };
}

function resolveServiceSheetConfig(config) {
  const sheetInfo = extractSheetReference(config.serviceSheetUrl);
  const gvizInfo = extractSheetReference(config.serviceGvizUrl);
  const htmlInfo = extractSheetReference(config.serviceHtmlUrl);
  const configId = sanitizeSheetId(config.serviceSheetId);
  const configGid = normalizeGid(config.serviceSheetGid);

  let sheetId = configId || sheetInfo.id || gvizInfo.id || htmlInfo.id;
  if (!sheetId) {
    sheetId = sanitizeSheetId(DEFAULT_SHEET_LINKS.serviceSheetId);
  }

  let sheetGid = "";
  const explicitConfigGid =
    config.serviceSheetGid !== undefined && config.serviceSheetGid !== null;

  if (explicitConfigGid && configGid) {
    sheetGid = configGid;
  } else if (sheetInfo.gid) {
    sheetGid = sheetInfo.gid;
  } else if (gvizInfo.gid) {
    sheetGid = gvizInfo.gid;
  } else if (htmlInfo.gid) {
    sheetGid = htmlInfo.gid;
  }

  if (!sheetGid && sheetId === sanitizeSheetId(DEFAULT_SHEET_LINKS.serviceSheetId)) {
    sheetGid = normalizeGid(DEFAULT_SHEET_LINKS.serviceSheetGid);
  }

  const publishedId = isPublishedSheetId(sheetId);

  let htmlUrl = config.serviceHtmlUrl || config.serviceSheetUrl || config.serviceGvizUrl || "";
  if (sheetId && !publishedId && needsPublishedHtmlReplacement(htmlUrl)) {
    htmlUrl = buildPublishedHtmlUrl(sheetId, sheetGid);
  }

  let gvizUrl = config.serviceGvizUrl;

  if (sheetId && !publishedId && needsGvizReplacement(gvizUrl)) {
    gvizUrl = buildGvizUrl(sheetId, sheetGid);
  }

  return { gvizUrl, htmlUrl, sheetId, sheetGid };
}

function buildServiceGvizCandidates() {
  const candidates = [];
  const seen = new Set();

  const register = (url) => {
    if (!url) {
      return;
    }
    const trimmed = String(url).trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  register(SERVICE_GVIZ_URL);

  if (SERVICE_SHEET_ID && !isPublishedSheetId(SERVICE_SHEET_ID)) {
    register(buildGvizUrl(SERVICE_SHEET_ID, SERVICE_SHEET_GID));
    register(buildGvizUrl(SERVICE_SHEET_ID, ""));
    if (SERVICE_SHEET_GID && SERVICE_SHEET_GID !== "0") {
      register(buildGvizUrl(SERVICE_SHEET_ID, "0"));
    }
  }

  return candidates;
}

function buildServiceHtmlCandidates() {
  const candidates = [];
  const seen = new Set();

  const register = (url) => {
    if (!url) {
      return;
    }
    const trimmed = String(url).trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    candidates.push(trimmed);
  };

  register(SERVICE_HTML_URL);

  if (SERVICE_SHEET_ID && !isPublishedSheetId(SERVICE_SHEET_ID)) {
    register(buildPublishedHtmlUrl(SERVICE_SHEET_ID, SERVICE_SHEET_GID));
    register(buildPublishedHtmlUrl(SERVICE_SHEET_ID, ""));
  }

  return candidates;
}

function updateDerivedSheetLinks() {
  GVIZ_URL = SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`
    : "";
  SUPPLEMENTAL_GVIZ_URL = SUPPLEMENTAL_SHEET_ID
    ? `https://docs.google.com/spreadsheets/d/${SUPPLEMENTAL_SHEET_ID}/gviz/tq?tqx=out:json`
    : "";
}

function applySheetLinksConfig(rawConfig) {
  const config = {
    ...DEFAULT_SHEET_LINKS,
    ...(rawConfig && typeof rawConfig === "object" ? rawConfig : {}),
  };

  const nextMain =
    typeof config.mainSheetId === "string" ? config.mainSheetId.trim() : "";
  const nextSupplemental =
    typeof config.supplementalSheetId === "string"
      ? config.supplementalSheetId.trim()
      : "";
  const nextServiceSheetUrl =
    typeof config.serviceSheetUrl === "string"
      ? config.serviceSheetUrl.trim()
      : "";
  const nextServiceGviz =
    typeof config.serviceGvizUrl === "string"
      ? config.serviceGvizUrl.trim()
      : "";
  const nextServiceHtml =
    typeof config.serviceHtmlUrl === "string"
      ? config.serviceHtmlUrl.trim()
      : "";
  const nextServiceSheetId =
    typeof config.serviceSheetId === "string"
      ? config.serviceSheetId.trim()
      : sanitizeSheetId(config.serviceSheetId);
  const nextServiceSheetGid =
    typeof config.serviceSheetGid === "string" ||
    typeof config.serviceSheetGid === "number"
      ? String(config.serviceSheetGid).trim()
      : normalizeGid(config.serviceSheetGid);
  const nextServiceCsv =
    typeof config.serviceCsvUrl === "string" ? config.serviceCsvUrl.trim() : "";
  const nextParentsCsv =
    typeof config.parentsCsvUrl === "string" ? config.parentsCsvUrl.trim() : "";
  const nextCareNetworkHtml =
    typeof config.careNetworkHtmlUrl === "string"
      ? config.careNetworkHtmlUrl.trim()
      : "";
  const nextCareNetworkSheetUrl =
    typeof config.careNetworkSheetUrl === "string"
      ? config.careNetworkSheetUrl.trim()
      : "";
  const nextCareNetworkGviz =
    typeof config.careNetworkGvizUrl === "string"
      ? config.careNetworkGvizUrl.trim()
      : "";
  const nextCareNetworkSheetId =
    typeof config.careNetworkSheetId === "string"
      ? config.careNetworkSheetId.trim()
      : sanitizeSheetId(config.careNetworkSheetId);
  const nextCareNetworkSheetGid =
    typeof config.careNetworkSheetGid === "string" ||
    typeof config.careNetworkSheetGid === "number"
      ? String(config.careNetworkSheetGid).trim()
      : normalizeGid(config.careNetworkSheetGid);

  SHEET_ID = nextMain || DEFAULT_SHEET_LINKS.mainSheetId;
  SUPPLEMENTAL_SHEET_ID =
    nextSupplemental || DEFAULT_SHEET_LINKS.supplementalSheetId;
  const fallbackServiceConfig = resolveServiceSheetConfig({
    serviceSheetUrl: DEFAULT_SHEET_LINKS.serviceSheetUrl,
    serviceGvizUrl: DEFAULT_SHEET_LINKS.serviceGvizUrl,
    serviceSheetId: DEFAULT_SHEET_LINKS.serviceSheetId,
    serviceSheetGid: DEFAULT_SHEET_LINKS.serviceSheetGid,
    serviceHtmlUrl: DEFAULT_SHEET_LINKS.serviceHtmlUrl,
  });
  const serviceConfig = resolveServiceSheetConfig({
    serviceSheetUrl: nextServiceSheetUrl,
    serviceGvizUrl: nextServiceGviz,
    serviceSheetId: nextServiceSheetId,
    serviceSheetGid: nextServiceSheetGid,
    serviceHtmlUrl: nextServiceHtml,
  });
  SERVICE_SHEET_ID =
    serviceConfig.sheetId || fallbackServiceConfig.sheetId || "";
  SERVICE_SHEET_GID =
    serviceConfig.sheetGid || fallbackServiceConfig.sheetGid || "";
  const fallbackServiceGviz =
    serviceConfig.gvizUrl || fallbackServiceConfig.gvizUrl || "";
  SERVICE_GVIZ_URL = fallbackServiceGviz;
  SERVICE_HTML_URL =
    serviceConfig.htmlUrl || fallbackServiceConfig.htmlUrl || "";
  SERVICE_CSV_URL = nextServiceCsv || DEFAULT_SHEET_LINKS.serviceCsvUrl;
  PARENTS_CSV_URL = nextParentsCsv || DEFAULT_SHEET_LINKS.parentsCsvUrl;
  const fallbackCareConfig = resolveCareNetworkSheetConfig({
    htmlUrl: DEFAULT_SHEET_LINKS.careNetworkHtmlUrl,
    sheetUrl: DEFAULT_SHEET_LINKS.careNetworkSheetUrl,
    gvizUrl: DEFAULT_SHEET_LINKS.careNetworkGvizUrl,
    sheetId: DEFAULT_SHEET_LINKS.careNetworkSheetId,
    sheetGid: DEFAULT_SHEET_LINKS.careNetworkSheetGid,
  });
  const resolvedCareConfig = resolveCareNetworkSheetConfig({
    htmlUrl: nextCareNetworkHtml,
    sheetUrl: nextCareNetworkSheetUrl,
    gvizUrl: nextCareNetworkGviz,
    sheetId: nextCareNetworkSheetId,
    sheetGid: nextCareNetworkSheetGid,
  });
  CARE_NETWORK_HTML_URL =
    resolvedCareConfig.htmlUrl || fallbackCareConfig.htmlUrl || "";
  CARE_NETWORK_GVIZ_URL =
    resolvedCareConfig.gvizUrl || fallbackCareConfig.gvizUrl || "";
  updateDerivedSheetLinks();
}

async function loadSheetLinksConfig() {
  try {
    const response = await fetch(SHEET_LINKS_CONFIG_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    applySheetLinksConfig(payload);
    if (state && state.serviceSheet) {
      state.serviceSheet.config = {
        ...state.serviceSheet.config,
        sheetId: SERVICE_SHEET_ID,
        sheetGid: SERVICE_SHEET_GID,
        htmlUrl: SERVICE_HTML_URL,
        gvizUrl: SERVICE_GVIZ_URL,
        csvUrl: SERVICE_CSV_URL,
      };
    }
    if (state && state.parentSheet) {
      state.parentSheet.csvUrl = PARENTS_CSV_URL;
    }
  } catch (error) {
    console.warn(
      "Failed to load sheet-links.json. Using built-in defaults instead.",
      error
    );
    applySheetLinksConfig(DEFAULT_SHEET_LINKS);
    if (state && state.serviceSheet) {
      state.serviceSheet.config = {
        ...state.serviceSheet.config,
        sheetId: SERVICE_SHEET_ID,
        sheetGid: SERVICE_SHEET_GID,
        htmlUrl: SERVICE_HTML_URL,
        gvizUrl: SERVICE_GVIZ_URL,
        csvUrl: SERVICE_CSV_URL,
      };
    }
    if (state && state.parentSheet) {
      state.parentSheet.csvUrl = PARENTS_CSV_URL;
    }
  }
}

applySheetLinksConfig(DEFAULT_SHEET_LINKS);
const SERVICE_STORAGE_KEY = "igcolina-services";
const SERVICE_FILTER_ALL = "all";
const SERVICE_FILTER_UNASSIGNED = "unassigned";
const SERVICE_CATALOG_URL = "services.json";
const DEFAULT_SERVICE_OPTIONS = [];
const DEFAULT_SERVICE_OPTION_IDS = new Set();
const dynamicServiceOptions = new Map();
let dynamicServiceOptionsDirty = false;
const SERVICE_SELECTION_POSITIVE_VALUES = new Set([
  "true",
  "sim",
  "yes",
  "ativo",
  "activa",
  "active",
  "si",
  "checked",
  "marcado",
  "selecionado",
  "ok",
  "1",
]);

const NO_SERVICE_LABELS = new Set([
  "n servico",
  "n ministerio",
  "n servicio",
  "nenhum servico",
  "nenhum ministerio",
  "ningun servicio",
  "ningun ministerio",
  "sem servico",
  "sem ministerio",
  "semservico",
  "semservicio",
  "semservice",
  "sin servicio",
  "sin ministerio",
  "nao serve",
  "nao servindo",
  "no service",
  "n s",
  "ns",
  "nservico",
  "nservicio",
  "n servicio",
  "nservice",
  "none",
]);

const CUSTOM_SERVICE_STORAGE_KEY = "igcolina-custom-service-options";
const RESERVED_SERVICE_IDS = new Set([
  SERVICE_FILTER_ALL,
  SERVICE_FILTER_UNASSIGNED,
  "active",
]);
const customServiceOptions = new Map();

const EMPTY_SERVICE_ASSIGNMENT = { active: false, services: [] };

function applyDefaultServiceOptions(options) {
  DEFAULT_SERVICE_OPTIONS.length = 0;
  DEFAULT_SERVICE_OPTION_IDS.clear();

  options.forEach((option) => {
    DEFAULT_SERVICE_OPTIONS.push(option);
    DEFAULT_SERVICE_OPTION_IDS.add(option.id);
  });

  refreshDefaultServiceConsumers();
}

function refreshDefaultServiceConsumers() {
  ensureServiceManagerFilterOptions();
  recalculateServiceSummaries();
  refreshActiveServiceInterfaces({ preserveSelection: true });
  if (isServiceManagerPage) {
    renderServiceManager();
  }
}

function registerDynamicServiceOption(value) {
  const normalized = normalizeServiceId(value);
  if (!normalized || RESERVED_SERVICE_IDS.has(normalized)) {
    return "";
  }

  if (
    DEFAULT_SERVICE_OPTION_IDS.has(normalized) ||
    customServiceOptions.has(normalized) ||
    dynamicServiceOptions.has(normalized)
  ) {
    return normalized;
  }

  const rawLabel = typeof value === "string" ? value.trim() : "";
  const fallbackLabel = normalized
    .split("-")
    .map((segment) =>
      segment ? segment.charAt(0).toUpperCase() + segment.slice(1) : ""
    )
    .join(" ")
    .trim();
  const baseLabel = rawLabel || fallbackLabel || normalized;

  const labels = {
    pt: baseLabel,
    en: baseLabel,
    es: baseLabel,
  };

  dynamicServiceOptions.set(normalized, {
    id: normalized,
    label: baseLabel,
    labels,
  });
  dynamicServiceOptionsDirty = true;
  return normalized;
}

function clearDynamicServiceOptions() {
  if (!dynamicServiceOptions.size) {
    return;
  }
  dynamicServiceOptions.clear();
  dynamicServiceOptionsDirty = true;
}

function flushDynamicServiceOptions() {
  if (!dynamicServiceOptionsDirty) {
    return;
  }
  dynamicServiceOptionsDirty = false;
  refreshDefaultServiceConsumers();
}

function normalizeDefaultServiceOption(rawOption) {
  if (typeof rawOption === "string") {
    const base = rawOption.trim();
    if (!base) {
      return null;
    }

    const id = normalizeServiceId(base);
    if (!id || RESERVED_SERVICE_IDS.has(id)) {
      return null;
    }

    return {
      id,
      label: base,
      labels: { pt: base, en: base, es: base },
    };
  }

  if (!rawOption || typeof rawOption !== "object") {
    return null;
  }

  const idSource =
    typeof rawOption.id === "string" && rawOption.id.trim()
      ? rawOption.id.trim()
      : "";

  const preferredPtLabels = [
    typeof rawOption.label === "string" ? rawOption.label.trim() : "",
    typeof rawOption.pt === "string" ? rawOption.pt.trim() : "",
    typeof rawOption.name === "string" ? rawOption.name.trim() : "",
    rawOption.labels && typeof rawOption.labels === "object"
      ? typeof rawOption.labels.pt === "string"
        ? rawOption.labels.pt.trim()
        : ""
      : "",
  ];

  const baseLabel = preferredPtLabels.find((value) => value);
  if (!baseLabel) {
    return null;
  }

  const normalizedId = normalizeServiceId(idSource || baseLabel);
  if (!normalizedId || RESERVED_SERVICE_IDS.has(normalizedId)) {
    return null;
  }

  const extractLabel = (value) =>
    typeof value === "string" && value.trim() ? value.trim() : "";

  const labels = { pt: baseLabel };
  const enCandidate =
    (rawOption.labels && extractLabel(rawOption.labels.en)) ||
    extractLabel(rawOption.en) ||
    extractLabel(rawOption.english) ||
    baseLabel;
  const esCandidate =
    (rawOption.labels && extractLabel(rawOption.labels.es)) ||
    extractLabel(rawOption.es) ||
    extractLabel(rawOption.spanish) ||
    baseLabel;

  labels.en = enCandidate || baseLabel;
  labels.es = esCandidate || baseLabel;

  return { id: normalizedId, label: baseLabel, labels };
}

async function loadDefaultServiceOptions() {
  try {
    const response = await fetch(SERVICE_CATALOG_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const payload = await response.json();
    let entries = [];
    if (Array.isArray(payload)) {
      entries = payload;
    } else if (Array.isArray(payload?.services)) {
      entries = payload.services;
    } else if (payload != null) {
      console.warn(
        "Service catalog payload must be an array or an object with a services array."
      );
    }

    if (!entries.length) {
      applyDefaultServiceOptions([]);
      return;
    }

    const seen = new Set();
    const options = [];

    entries.forEach((rawOption) => {
      const option = normalizeDefaultServiceOption(rawOption);
      if (!option) {
        return;
      }
      if (seen.has(option.id)) {
        return;
      }
      seen.add(option.id);
      options.push(option);
    });

    applyDefaultServiceOptions(options);
  } catch (error) {
    console.warn("Failed to load service catalog:", error);
    refreshDefaultServiceConsumers();
  }
}

function hasActiveServices(entry) {
  return Boolean(
    entry?.service?.active &&
      Array.isArray(entry.service.services) &&
      entry.service.services.length > 0
  );
}

const CAPTAIN_ALLOWED_CATEGORIES = ["teens", "parents", "services"];

const pageType = document.body?.dataset.page ?? "dashboard";
const isDashboardPage = pageType === "dashboard";
const isCategoryPage = pageType === "category";
const isServiceManagerPage = pageType === "service-manager";

const LANGUAGE_STORAGE_KEY = "igcolina-language";
const LANGUAGE_OPTIONS = {
  pt: { code: "pt", label: "PT", name: "Português", locale: "pt-BR" },
  en: { code: "en", label: "EN", name: "English", locale: "en-US" },
  es: { code: "es", label: "ES", name: "Español", locale: "es-ES" },
};

const TRANSLATIONS = {
  pt: {
    app: {
      title: "Dados da IGColina",
      tagline: "Dashboard criada para uso da Igreja em Colina® 2025",
      homeAria: "Início · Dados da IGColina",
      document: ({ page }) =>
        page ? `${page} · Dados da IGColina` : "Dados da IGColina",
    },
    header: {
      lastUpdated: {
        loading: "Carregando dados...",
        text: ({ datetime }) => `Atualizado em ${datetime}`,
      },
    },
    search: {
      label: "Pesquisar Irmão",
      suggestionsAria: "Sugestões",
      placeholder: {
        default: "Digite o nome",
        captain: "Pesquise adolescentes (11-17 anos)",
        noRecords: "Nenhum registro disponível",
        noTeens: "Nenhum adolescente disponível",
        noNameColumn: "Coluna de nome não encontrada",
      },
    },
    cards: {
      hint: "Clique para acessar as informações correspondentes.",
      restrictedHint: "Não está liberado essa função para esse perfil.",
    },
    categories: {
      total: {
        title: "Total de Irmãos",
        description: "Veja todos os irmãos cadastrados na planilha.",
        chartLabel: "Idades de todos os irmãos",
        empty: "Nenhum irmão encontrado nesta categoria.",
      },
      children: {
        title: "Crianças (0-10)",
        description: "Irmãos com idades entre 0 e 10 anos.",
        chartLabel: "Idades das crianças",
        empty: "Nenhuma criança cadastrada até o momento.",
      },
      teens: {
        title: "Adolescentes (11-17)",
        description:
          "Irmãos com idades entre 11 e 17 anos. Ative o filtro \"Idade apta para colportagem\" para destacar apenas 16 e 17 anos.",
        chartLabel: "Idades dos adolescentes",
        empty: "Nenhum adolescente cadastrado até o momento.",
      },
      parents: {
        title: "Pais",
        description:
          "Pais e mães relacionados aos adolescentes cadastrados.",
        chartLabel: "Responsáveis pelos adolescentes",
        empty: "Nenhum pai ou mãe encontrado nesta categoria.",
      },
      careNetwork: {
        title: "Rede de Cuidado",
        description: "Cadastrados da Rede de Cuidado",
        chartLabel: "Registros da Rede de Cuidado",
        empty: "Nenhum registro encontrado na Rede de Cuidado.",
      },
      services: {
        title: "Serviços",
        description:
          "Acompanhe os irmãos que servem e em quais frentes atuam.",
        chartLabel: "Idades dos irmãos que servem",
        empty: "Nenhum irmão serve neste serviço.",
      },
      captains: {
        title: "Capitães de Tropa (18-29)",
        description: "Irmãos com idades entre 18 e 29 anos.",
        chartLabel: "Idades dos capitães de tropa",
        empty: "Nenhum capitão de tropa cadastrado até o momento.",
      },
      braves: {
        title: "Valentes de Davi (30-49)",
        description: "Irmãos com idades entre 30 e 49 anos.",
        chartLabel: "Idades dos valentes de Davi",
        empty: "Nenhum valente cadastrado até o momento.",
      },
      stewards: {
        title: "Intendentes (50+)",
        description: "Irmãos com 50 anos ou mais.",
        chartLabel: "Idades dos intendentes",
        empty: "Nenhum intendente cadastrado até o momento.",
      },
    },
    overview: {
      title: "Distribuição geral de idades",
      description: "Visualize a idade de todos os irmãos cadastrados.",
      empty: "Nenhum dado de idade disponível.",
      datasetLabel: "Quantidade de irmãos",
      captainTitle: "Distribuição de idades dos adolescentes",
      captainDescription:
        "Visualize as idades apenas dos adolescentes entre 11 e 17 anos.",
    },
    birthdays: {
      title: "Aniversariantes de hoje",
      description: "Celebre com os irmãos que comemoram aniversário nesta data.",
      empty: {
        general: "Nenhum aniversariante encontrado para hoje.",
        teens: "Nenhum adolescente aniversariante encontrado para hoje.",
      },
      nameFallback: "Nome não informado",
      age: ({ age }) => `${age} anos`,
      ageMissing: "Idade não informada",
    },
    status: {
      updated: "Dados atualizados.",
      noBirthColumn:
        "Não encontramos a coluna de data de nascimento. Certifique-se de que uma coluna tenha esse nome.",
      noRecords: "Nenhum registro encontrado na planilha ainda.",
      errorLoad:
        "Não foi possível carregar os dados. Verifique se a planilha está publicada para o público e tente novamente.",
      loading: "Atualizando dados...",
    },
    errors: {
      primaryLoad: "Não foi possível carregar a planilha principal.",
      fetchStatus: ({ status }) => `Erro ao acessar a planilha (status ${status})`,
      unexpectedResponse: "Resposta inesperada da API do Google Sheets.",
      serviceLoad: "Não foi possível carregar a aba de serviços.",
    },
    category: {
      loadingTitle: "Carregando categoria...",
      loadingDescription: "Estamos preparando os dados.",
      meta: ({ count, noun, filter }) =>
        `${count} ${noun} nesta categoria${filter ? ` · ${filter}` : ""}`,
      nounSingular: "irmão",
      nounPlural: "irmãos",
      filterNote: 'filtro "Idade apta para colportagem" ativo',
      chartEmpty: "Não há idades disponíveis para esta categoria.",
      navBack: "← Voltar ao painel principal",
      navAria: "Categorias disponíveis",
    },
    filters: {
      teens: {
        label: "Idade apta para colportagem",
        hint: "(mostra apenas 16 e 17 anos)",
      },
    },
    modal: {
      title: "Detalhes",
      close: "Fechar",
      noName: "(Sem nome)",
    },
    format: {
      phoneMissing: "não informado",
      ageMissing: "não informada",
      age: ({ count }) => `${count} ${count === 1 ? "ano" : "anos"}`,
    },
    people: {
      ageLabel: ({ value }) => `Idade: ${value}`,
      phoneLabel: ({ value }) => `Telefone: ${value}`,
      serviceLabel: ({ value }) => `Serviço: ${value}`,
      servingTag: "Servindo",
      you: "Você",
    },
    parents: {
      meta: ({ parents, families }) => {
        const responsavel = parents === 1 ? "responsável" : "responsáveis";
        const familia = families === 1 ? "família" : "famílias";
        return `${parents} ${responsavel} relacionados a ${families} ${familia}.`;
      },
      card: {
        father: ({ name }) => `Pai: ${name}`,
        mother: ({ name }) => `Mãe: ${name}`,
        child: ({ name }) => `Filho(a): ${name}`,
      },
      labels: {
        father: "Pai",
        mother: "Mãe",
        child: "Filho(a)",
        unknown: "Não informado",
      },
      choice: {
        title: "Selecione o responsável",
        question: ({ child }) =>
          child
            ? `Quem você deseja visualizar para ${child}?`
            : "Quem você deseja visualizar?",
        father: "Pai",
        mother: "Mãe",
        cancel: "Cancelar",
      },
      noDetails: "Não encontramos informações para esse responsável.",
      details: {
        childLabel: "Filho(a)",
        ageLabel: "Idade do filho(a)",
        phoneLabel: "Telefone do filho(a)",
        missing: "Nenhuma informação adicional disponível.",
      },
      modalFallback: {
        father: ({ child }) => (child ? `Pai de ${child}` : "Pai"),
        mother: ({ child }) => (child ? `Mãe de ${child}` : "Mãe"),
      },
      chartEmpty: "Este painel não possui gráfico dedicado.",
    },
    services: {
      summaryTitle: "Serviços disponíveis",
      summaryDescription: "Clique em um serviço para filtrar os irmãos que servem.",
      filters: {
        all: "Todos os serviços",
        unassigned: "N.Serviço",
      },
      countLabel: ({ count }) =>
        `${count} ${count === 1 ? "irmão servindo" : "irmãos servindo"}`,
      countLabelUnassigned: ({ count }) =>
        `${count} ${count === 1 ? "irmão sem serviço" : "irmãos sem serviço"}`,
      empty: {
        all: "Nenhum irmão serve na vida da igreja no momento.",
        service: ({ service }) => `Nenhum irmão serve em ${service}.`,
        unassigned: "Todos os irmãos estão servindo no momento.",
      },
      meta: {
        all: "todos os serviços",
        unassigned: "irmãos sem serviço",
        service: ({ service }) => `serviço: ${service}`,
      },
      tagsLabel: "Serviços desempenhados",
      selectLabel: "Selecione os serviços",
      detailLabel: "Onde serve",
      detailValueNone: "N.Serviço",
      feedback: {
        inactive: "N.Serviço",
        active: "Servindo",
      },
      chartLabelUnassigned: "Idades dos irmãos sem serviço",
    },
    careNetwork: {
      meta: ({ assigned, total }) => {
        const assignedLabel =
          assigned === 1
            ? "1 irmão acompanhado"
            : `${assigned} irmãos acompanhados`;
        const totalLabel =
          total === 1 ? "1 registro" : `${total} registros`;
        return `${assignedLabel} · ${totalLabel}`;
      },
      detailLabel: "Rede de cuidado",
      detailValueNone: "N.Serviço",
      servicesTitle: "Serviços atribuídos",
      fieldLabel: ({ field }) => `Rede de cuidado · ${field}`,
      cardPhoneLabel: "Telefone",
      cardApproachedByLabel: "Quem abordou",
      cardValueMissing: "Não informado",
      cardImageAlt: "Rede de Cuidado",
      chartEmpty: "Não há dados disponíveis para a Rede de Cuidado.",
    },
    access: {
      modalTitle: "Selecione a seguir sua função:",
      modalDescription: "Escolha uma opção para continuar:",
      selectedRole: ({ role }) => `Função selecionada: ${role}`,
      passwordLabel: "Digite a senha",
      back: "Voltar",
      confirm: "Confirmar",
      errorInvalid: "Senha incorreta. Tente novamente.",
      errorRequired: "Informe a senha para continuar.",
      restrictionCaptain:
        "Perfil de Capitães de Tropa: acesso disponível apenas para adolescentes (11-17 anos) e seus responsáveis.",
      requireSelection: "Selecione uma função para continuar.",
      selectedRolePrefix: "Função selecionada:",
      roles: {
        responsavel: {
          label: "Irmão Responsável",
          description: "Acesso completo a todas as áreas do painel.",
        },
        capitao: {
          label: "Capitães de Tropa",
          description:
            "Acesso restrito às informações dos adolescentes (11-17 anos) e seus responsáveis.",
        },
        servicos: {
          label: "Serviços",
          description:
            "Perfil dedicado a gerenciar quais irmãos servem e em quais frentes atuam.",
        },
      },
    },
    profile: {
      label: "Perfil",
      title: "Perfil atual",
      switch: "Trocar de usuário",
      manageServices: "Gerenciar serviços",
      openDashboard: "Ir para o painel principal",
      password: {
        changeAction: "Trocar senha",
        title: "Trocar senha",
        description: "Defina uma nova senha para este perfil.",
        newPlaceholder: "Digite a nova senha",
        confirmPlaceholder: "Confirme a nova senha",
        save: "Salvar senha",
        cancel: "Cancelar",
        required: "Digite a nova senha.",
        mismatch: "As senhas informadas não são iguais.",
        invalid: "Informe uma senha válida.",
        success: "Senha atualizada com sucesso.",
        unavailable: "Entre com um perfil válido para alterar a senha.",
      },
      manage: {
        open: "Gerenciar perfis",
        title: "Adicionar perfil",
        description:
          "Cadastre um novo acesso informando o nome, a função e a senha.",
        namePlaceholder: "Digite o nome do perfil",
        rolePlaceholder: "Selecione a função",
        passwordPlaceholder: "Cadastre uma senha",
        confirmPlaceholder: "Confirme a senha",
        save: "Salvar perfil",
        cancel: "Cancelar",
        restricted: "Apenas o perfil ADM pode gerenciar novos acessos.",
        nameRequired: "Informe o nome do perfil.",
        roleRequired: "Selecione a função do perfil.",
        passwordRequired: "Informe uma senha para o novo perfil.",
        passwordMismatch: "As senhas informadas não são iguais.",
        passwordInvalid: "Informe uma senha válida.",
        passwordDuplicate: "Já existe um perfil registrado com essa senha.",
        success: ({ name, role }) =>
          `Perfil "${name}" adicionado na função ${role}.`,
      },
    },
    language: {
      toggleAria: "Selecionar idioma",
    },
    assistant: {
      toggleAlt: "Abrir assistente virtual",
      title: "JP assistant",
      subtitle: "Posso ajudar com dúvidas sobre a dashboard.",
      closeLabel: "Fechar assistente",
      inputLabel: "Descreva sua dúvida",
      inputPlaceholder: "Digite sua dúvida",
      submit: "Enviar",
      typing: "digitando",
      userLabel: "Você",
      greeting: ({ name }) =>
        name
          ? `Olá, ${name}! Eu sou o JP assistant da dashboard. Escolha uma pergunta ou use a opção "Outros" para tirar dúvidas específicas.`
          : "Olá! Eu sou o JP assistant da dashboard. Escolha uma pergunta ou use a opção \"Outros\" para tirar dúvidas específicas.",
      questions: {
        refresh: "Como os dados são atualizados?",
        search: "Como pesquisar um irmão?",
        categories: "Como acessar as categorias?",
        assignService: "Como atribuir um serviço?",
        removeService: "Como remover um serviço?",
        filterServices: "Como filtrar os serviços?",
        custom: "Outros",
      },
      answers: {
        refresh: {
          responsavel:
            "Toda a dashboard é sincronizada com as planilhas a cada minuto. Você pode recarregar a página para atualizar imediatamente.",
          capitao:
            "Os registros de adolescentes são atualizados automaticamente a cada minuto com os dados das planilhas. Recarregue a página se precisar forçar uma nova consulta.",
          servicos:
            "Você tem acesso completo aos dados e pode atualizar a página para sincronizar imediatamente após ajustar os serviços.",
        },
        search: {
          responsavel:
            "Digite parte do nome no campo de pesquisa e selecione uma das sugestões para abrir o cadastro completo do irmão.",
          capitao:
            "No campo de pesquisa, digite o nome do adolescente (11-17 anos). Escolha uma sugestão para abrir os detalhes completos.",
          servicos:
            "Pesquise pelo nome do irmão para revisar o cadastro e atualizar rapidamente o serviço que ele desempenha.",
        },
        categories: {
          responsavel:
            "Use os cartões da página inicial ou o menu de categorias para navegar. Cada aba mostra os irmãos daquele grupo com gráfico e cards detalhados.",
          capitao:
            "Como Capitão de Tropa, você visualiza os cartões de adolescentes e de pais. Clique em um deles para acessar a lista com os detalhes correspondentes.",
          servicos:
            "Utilize os cartões e o gerenciador de serviços para acompanhar quem serve em cada frente e atualizar quando necessário.",
        },
        assignService: {
          responsavel:
            "A atribuição de serviços é exclusiva do perfil Serviços. Procure a equipe responsável para registrar esse ministério.",
          capitao:
            "Somente o perfil Serviços pode atribuir ministérios. Avise o responsável para que registre o serviço correto dos adolescentes.",
        servicos:
            "No gerenciador de serviços, toque no card do irmão para abrir o painel de atribuição. Escolha as frentes em que ele serve e confirme em \"Salvar alterações\".",
      },
      removeService: {
        responsavel:
            "A remoção de serviços também é feita apenas pelo perfil Serviços. Entre em contato com quem administra as escalas para atualizar o cadastro.",
        capitao:
            "Somente o perfil Serviços pode remover um serviço. Avise a equipe responsável para que a alteração seja feita.",
        servicos:
            "Abra o card do irmão, utilize o painel de atribuição para retirar os serviços que não se aplicam e salve para confirmar a alteração.",
      },
        filterServices: {
          responsavel:
            "Você consegue visualizar as tags de serviço nos cards, mas a filtragem avançada e as edições ficam com o perfil Serviços.",
          capitao:
            "Como Capitão de Tropa, você apenas visualiza as tags dos adolescentes e de seus pais; filtros detalhados estão disponíveis para o perfil Serviços.",
          servicos:
            "Use os cartões de resumo ou o filtro do gerenciador para listar apenas quem serve em uma frente específica. Selecione 'Serviços' para alternar entre ativos, N.Serviço ou um ministério determinado.",
        },
        fallback: "Estou aqui para ajudar com as principais dúvidas do painel.",
      },
      customIntro:
        "conte qual é a sua dúvida e eu trarei orientações sobre como resolver no painel.",
      customReceived: ({ question }) =>
        question ? `Entendi sua dúvida: \"${question}\".` : "Recebi sua dúvida.",
      customScope: {
        responsavel:
          "Como Irmão Responsável, você possui acesso completo a todas as categorias da dashboard.",
        capitao:
          "Como Capitão de Tropa, lembre-se de que seu acesso é focado nos adolescentes de 11 a 17 anos.",
        servicos:
          "Como responsável pelos serviços, você pode atribuir ministérios (inclusive mais de um por irmão) e ajustar quem está servindo diretamente pelo gerenciador.",
      },
      customFollowUp:
        "Verifique se os dados estão atualizados na planilha e utilize os cartões ou a busca para localizar rapidamente as informações desejadas. Caso a dúvida persista, entre em contato com a liderança da IGColina.",
    },
    serviceManager: {
      title: "Gerenciar serviços",
      description:
        "Toque no card para abrir o painel de serviços do irmão e salvar as alterações.",
      back: "← Voltar ao painel principal",
      filterLabel: "Filtrar",
      filters: {
        all: "Todos os registros",
        active: "Servindo",
        unassigned: "N.Serviço",
      },
      add: {
        title: "Cadastrar novo serviço",
        label: "Nome do serviço (Português)",
        placeholder: "Digite o nome do serviço em Português",
        labelEn: "Nome do serviço (Inglês)",
        placeholderEn: "Digite o nome em Inglês",
        labelEs: "Nome do serviço (Espanhol)",
        placeholderEs: "Digite o nome em Espanhol",
        helper:
          "Informe o nome nas três línguas para que os serviços apareçam traduzidos em todo o painel.",
        button: "Adicionar serviço",
        success: ({ name }) => `Serviço "${name}" adicionado.`,
        exists: "Esse serviço já está disponível.",
        invalid: "Informe um nome válido para adicionar o serviço.",
        reserved: "Esse nome não pode ser usado como serviço.",
      },
      edit: {
        title: ({ name }) =>
          name ? `Editar serviço ${name}` : "Editar serviço",
        button: "Salvar serviço",
        cancelButton: "Cancelar edição",
        start: ({ name }) =>
          name
            ? `Editando o serviço "${name}". Faça os ajustes e salve.`
            : "Editando serviço. Faça os ajustes e salve.",
        success: ({ name }) =>
          name ? `Serviço atualizado para "${name}".` : "Serviço atualizado.",
        invalid: "Informe nomes válidos para atualizar o serviço.",
        reserved: "Esse nome não pode ser usado como serviço.",
        exists: "Já existe um serviço com esse nome.",
        missing: "Não foi possível localizar o serviço selecionado.",
        cancel: "Edição cancelada.",
      },
      custom: {
        title: "Serviços personalizados",
        description:
          "Edite as traduções ou remova os serviços cadastrados pelo painel.",
        empty: "Nenhum serviço personalizado cadastrado.",
        edit: "Editar",
        delete: "Excluir",
        deleteConfirm: ({ name }) => `Remover o serviço "${name}"?`,
        deleteSuccess: ({ name }) => `Serviço "${name}" removido.`,
        deleteError: "Não foi possível remover o serviço. Tente novamente.",
        language: {
          pt: "Português",
          en: "Inglês",
          es: "Espanhol",
        },
      },
      empty: "Nenhum irmão encontrado para os filtros selecionados.",
      restricted:
        "Atribuição de serviços disponível apenas para o perfil Serviços.",
      sync: {
        title: "Sincronização com planilha",
        description:
          "Conecte com o Google Sheets para compartilhar as atribuições em todos os dispositivos.",
        buttons: {
          connect: "Atualizar planilha",
          authorize: "Autorizar Google",
          syncing: "Sincronizando...",
          configure: "Configurar planilha",
        },
        status: {
          ready: "Planilha conectada e pronta para receber atualizações.",
          syncing: "Enviando dados para a planilha...",
          success: "Serviços atualizados na planilha.",
          error: "Não foi possível atualizar a planilha. Tente novamente.",
          unauthorized: "Autorize o acesso do Google para salvar as alterações.",
          missingClient: "Informe o Client ID OAuth 2.0 para conectar.",
          missingTab: "Informe o nome da aba da planilha.",
        },
        prompt: {
          clientId:
            "Cole o Client ID OAuth 2.0 configurado no console do Google Cloud.",
          tabName:
            "Informe o nome da aba da planilha onde os serviços serão salvos.",
        },
      },
    },
    serviceAssignment: {
      title: ({ name }) => `Gerenciar serviços de ${name}`,
      subtitle:
        "Selecione as frentes de atuação, ajuste o status e confirme para salvar.",
      statusLabel: "Situação atual",
      empty: "Cadastre novos serviços para atribuir.",
      cancel: "Cancelar",
      save: "Salvar alterações",
      close: "Fechar painel de serviços",
      success: ({ name }) => `Serviços atualizados para ${name}.`,
      open: ({ name }) => `Gerenciar serviços de ${name}`,
    },
  },
  en: {
    app: {
      title: "IGColina Data",
      tagline: "Dashboard created for Igreja em Colina® 2025",
      homeAria: "Home · IGColina Data",
      document: ({ page }) =>
        page ? `${page} · IGColina Data` : "IGColina Data",
    },
    header: {
      lastUpdated: {
        loading: "Loading data...",
        text: ({ datetime }) => `Updated on ${datetime}`,
      },
    },
    search: {
      label: "Search Member",
      suggestionsAria: "Suggestions",
      placeholder: {
        default: "Type a name",
        captain: "Search teens (11-17 years)",
        noRecords: "No records available",
        noTeens: "No teens available",
        noNameColumn: "Name column not found",
      },
    },
    cards: {
      hint: "Click to access the corresponding information.",
      restrictedHint: "This function isn't available for this profile.",
    },
    categories: {
      total: {
        title: "All Members",
        description: "View every registered member from the spreadsheet.",
        chartLabel: "Ages of all members",
        empty: "No members found in this category.",
      },
      children: {
        title: "Children (0-10)",
        description: "Members aged between 0 and 10 years.",
        chartLabel: "Ages of children",
        empty: "No children registered so far.",
      },
      teens: {
        title: "Teens (11-17)",
        description:
          "Members aged 11 to 17 years. Enable the \"Age fit for colporteur work\" filter to highlight only 16 and 17 years.",
        chartLabel: "Ages of teens",
        empty: "No teens registered so far.",
      },
      parents: {
        title: "Parents",
        description: "Parents linked to the registered teens.",
        chartLabel: "Guardians of the teens",
        empty: "No parents were found in this category.",
      },
      careNetwork: {
        title: "Care Network",
        description:
          "Review the members listed in the Care Network and see the related follow-up details.",
        chartLabel: "Care Network records",
        empty: "No Care Network records were found.",
      },
      services: {
        title: "Services",
        description: "Track who is serving and in which ministry.",
        chartLabel: "Ages of serving members",
        empty: "No members are serving in this ministry.",
      },
      captains: {
        title: "Troop Captains (18-29)",
        description: "Members aged between 18 and 29 years.",
        chartLabel: "Ages of troop captains",
        empty: "No troop captains registered so far.",
      },
      braves: {
        title: "David's Valiants (30-49)",
        description: "Members aged between 30 and 49 years.",
        chartLabel: "Ages of David's valiant warriors",
        empty: "No valiant warriors registered so far.",
      },
      stewards: {
        title: "Stewards (50+)",
        description: "Members aged 50 years or above.",
        chartLabel: "Ages of stewards",
        empty: "No stewards registered so far.",
      },
    },
    overview: {
      title: "Overall age distribution",
      description: "See the age distribution of every registered member.",
      empty: "No age data available.",
      datasetLabel: "Number of members",
      captainTitle: "Teen age distribution",
      captainDescription:
        "View ages only for teens between 11 and 17 years old.",
    },
    birthdays: {
      title: "Today's birthdays",
      description: "Celebrate the members whose birthday is today.",
      empty: {
        general: "No birthdays found for today.",
        teens: "No teen birthdays found for today.",
      },
      nameFallback: "Name unavailable",
      age: ({ age }) => `${age} years`,
      ageMissing: "Age unavailable",
    },
    status: {
      updated: "Data updated.",
      noBirthColumn:
        "We couldn't find the birthdate column. Make sure one of the columns uses that name.",
      noRecords: "No records have been found in the spreadsheet yet.",
      errorLoad:
        "We couldn't load the data. Check if the spreadsheet is published to the web and try again.",
      loading: "Updating data...",
    },
    errors: {
      primaryLoad: "Unable to load the primary spreadsheet.",
      fetchStatus: ({ status }) => `Spreadsheet request failed (status ${status}).`,
      unexpectedResponse: "Unexpected response from the Google Sheets API.",
      serviceLoad: "Unable to load the services tab.",
    },
    category: {
      loadingTitle: "Loading category...",
      loadingDescription: "We're preparing the data.",
      meta: ({ count, noun, filter }) =>
        `${count} ${noun} in this category${filter ? ` · ${filter}` : ""}`,
      nounSingular: "member",
      nounPlural: "members",
      filterNote: '"Age fit for colporteur work" filter enabled',
      chartEmpty: "No ages available for this category.",
      navBack: "← Back to the main dashboard",
      navAria: "Available categories",
    },
    filters: {
      teens: {
        label: "Age fit for colporteur work",
        hint: "(shows only ages 16 and 17)",
      },
    },
    modal: {
      title: "Details",
      close: "Close",
      noName: "(No name)",
    },
    format: {
      phoneMissing: "not provided",
      ageMissing: "not provided",
      age: ({ count }) => `${count} ${count === 1 ? "year" : "years"}`,
    },
    people: {
      ageLabel: ({ value }) => `Age: ${value}`,
      phoneLabel: ({ value }) => `Phone: ${value}`,
      serviceLabel: ({ value }) => `Service: ${value}`,
      servingTag: "Serving",
      you: "You",
    },
    parents: {
      meta: ({ parents, families }) => {
        const guardian = parents === 1 ? "guardian" : "guardians";
        const family = families === 1 ? "family" : "families";
        return `${parents} ${guardian} linked to ${families} ${family}.`;
      },
      card: {
        father: ({ name }) => `Father: ${name}`,
        mother: ({ name }) => `Mother: ${name}`,
        child: ({ name }) => `Child: ${name}`,
      },
      labels: {
        father: "Father",
        mother: "Mother",
        child: "Child",
        unknown: "Not provided",
      },
      choice: {
        title: "Select a guardian",
        question: ({ child }) =>
          child
            ? `Who would you like to view for ${child}?`
            : "Who would you like to view?",
        father: "Father",
        mother: "Mother",
        cancel: "Cancel",
      },
      noDetails: "No information was found for this guardian.",
      details: {
        childLabel: "Child",
        ageLabel: "Child's age",
        phoneLabel: "Child's phone",
        missing: "No additional information available.",
      },
      modalFallback: {
        father: ({ child }) => (child ? `Father of ${child}` : "Father"),
        mother: ({ child }) => (child ? `Mother of ${child}` : "Mother"),
      },
      chartEmpty: "This section does not include a dedicated chart.",
    },
    services: {
      summaryTitle: "Available services",
      summaryDescription: "Click a ministry to filter the serving members.",
      filters: {
        all: "All services",
        unassigned: "No service",
      },
      countLabel: ({ count }) =>
        `${count} ${count === 1 ? "member serving" : "members serving"}`,
      countLabelUnassigned: ({ count }) =>
        `${count} ${count === 1 ? "member without service" : "members without service"}`,
      empty: {
        all: "No members are currently serving.",
        service: ({ service }) => `No members are serving in ${service}.`,
        unassigned: "Everyone currently has at least one service.",
      },
      meta: {
        all: "all services",
        unassigned: "members without a service",
        service: ({ service }) => `service: ${service}`,
      },
      tagsLabel: "Serving in",
      selectLabel: "Choose the services",
      detailLabel: "Serving in",
      detailValueNone: "No service",
      feedback: {
        inactive: "No service",
        active: "Serving",
      },
      chartLabelUnassigned: "Ages of members without a service",
    },
    careNetwork: {
      meta: ({ assigned, total }) => {
        const assignedLabel =
          assigned === 1
            ? "1 member being followed"
            : `${assigned} members being followed`;
        const totalLabel = total === 1 ? "1 record" : `${total} records`;
        return `${assignedLabel} · ${totalLabel}`;
      },
      detailLabel: "Care Network",
      detailValueNone: "No service",
      servicesTitle: "Assigned services",
      fieldLabel: ({ field }) => `Care Network · ${field}`,
      cardPhoneLabel: "Phone",
      cardApproachedByLabel: "Approached by",
      cardValueMissing: "Not provided",
      cardImageAlt: "Care Network",
      chartEmpty: "No Care Network data is available.",
    },
    access: {
      modalTitle: "Select your role below:",
      modalDescription: "Choose an option to continue:",
      selectedRole: ({ role }) => `Selected role: ${role}`,
      passwordLabel: "Enter the password",
      back: "Back",
      confirm: "Confirm",
      errorInvalid: "Incorrect password. Try again.",
      errorRequired: "Enter the password to continue.",
      restrictionCaptain:
        "Troop Captain profile: access is limited to teens (11-17 years old) and their guardians.",
      requireSelection: "Select a role to continue.",
      selectedRolePrefix: "Selected role:",
      roles: {
        responsavel: {
          label: "Responsible Brother",
          description: "Full access to every area of the dashboard.",
        },
        capitao: {
          label: "Troop Captains",
          description:
            "Restricted access to teen information (ages 11-17) and their guardians.",
        },
        servicos: {
          label: "Services",
          description:
            "Dedicated profile to manage who serves and which ministry they support.",
        },
      },
    },
    profile: {
      label: "Profile",
      title: "Current profile",
      switch: "Switch user",
      manageServices: "Manage services",
      openDashboard: "Go to main dashboard",
      password: {
        changeAction: "Change password",
        title: "Change password",
        description: "Set a new password for this profile.",
        newPlaceholder: "Enter the new password",
        confirmPlaceholder: "Confirm the new password",
        save: "Save password",
        cancel: "Cancel",
        required: "Enter the new password.",
        mismatch: "The passwords don't match.",
        invalid: "Enter a valid password.",
        success: "Password updated successfully.",
        unavailable: "Sign in with a valid profile to change the password.",
      },
      manage: {
        open: "Manage profiles",
        title: "Add profile",
        description:
          "Create a new access by providing the name, role, and password.",
        namePlaceholder: "Enter the profile name",
        rolePlaceholder: "Select the role",
        passwordPlaceholder: "Create a password",
        confirmPlaceholder: "Confirm the password",
        save: "Save profile",
        cancel: "Cancel",
        restricted: "Only the admin profile can manage new accesses.",
        nameRequired: "Enter the profile name.",
        roleRequired: "Select the profile role.",
        passwordRequired: "Provide a password for the new profile.",
        passwordMismatch: "The passwords don't match.",
        passwordInvalid: "Enter a valid password.",
        passwordDuplicate: "There's already a profile registered with this password.",
        success: ({ name, role }) => `Profile "${name}" added as ${role}.`,
      },
    },
    language: {
      toggleAria: "Choose language",
    },
    assistant: {
      toggleAlt: "Open virtual assistant",
      title: "JP assistant",
      subtitle: "I can help with questions about the dashboard.",
      closeLabel: "Close assistant",
      inputLabel: "Describe your question",
      inputPlaceholder: "Type your question",
      submit: "Send",
      typing: "typing",
      userLabel: "You",
      greeting: ({ name }) =>
        name
          ? `Hello, ${name}! I'm the JP assistant for this dashboard. Choose a question or use \"Others\" to ask something specific.`
          : "Hello! I'm the JP assistant for this dashboard. Choose a question or use \"Others\" to ask something specific.",
      questions: {
        refresh: "How is the data updated?",
        search: "How do I search for a member?",
        categories: "How do I access the categories?",
        assignService: "How do I assign a service?",
        removeService: "How do I remove a service?",
        filterServices: "How do I filter services?",
        custom: "Others",
      },
      answers: {
        refresh: {
          responsavel:
            "The entire dashboard syncs with the spreadsheets every minute. You can refresh the page to update immediately.",
          capitao:
            "Teen records are refreshed automatically every minute from the spreadsheets. Reload the page if you need to force an update.",
          servicos:
            "Reload the page after updating assignments to sync all service data instantly.",
        },
        search: {
          responsavel:
            "Type part of the name in the search field and pick one of the suggestions to open the full record.",
          capitao:
            "In the search field, type the teen's name (11-17 years). Choose a suggestion to open the detailed record.",
          servicos:
            "Search for a member's name to review the record and adjust the ministry assignment right away.",
        },
        categories: {
          responsavel:
            "Use the cards on the home page or the categories menu to navigate. Each tab shows that group's members with charts and detailed cards.",
          capitao:
            "As a Troop Captain, you see the teen and parents cards. Click either card to open the matching list with detailed records.",
          servicos:
            "Leverage the cards and the service manager to keep track of every ministry and update assignments whenever necessary.",
        },
        assignService: {
          responsavel:
            "Service assignments are handled only by the Services profile. Reach out to the team in charge so they can record the ministry.",
          capitao:
            "Only the Services profile can assign ministries. Let the responsible team know so they can record the teens' assignments.",
        servicos:
            "In the services manager, select the member's card to open the assignment panel. Choose every ministry that applies and confirm with \"Save changes\".",
      },
      removeService: {
        responsavel:
            "Removing a service also requires the Services profile. Contact the roster team to update the record.",
        capitao:
            "Only the Services profile can remove an assignment. Notify the team so they can apply the change.",
        servicos:
            "Open the member's card, use the assignment panel to uncheck the ministries that no longer apply, and save to confirm the update.",
      },
        filterServices: {
          responsavel:
            "You can view the service tags on each card, but detailed filtering and edits stay with the Services profile.",
          capitao:
            "As a Troop Captain you only view the teen and parent tags; advanced filters live with the Services profile.",
          servicos:
            "Use the summary cards or the manager filter to list only those serving in a specific ministry. The \"Services\" selector lets you switch between active, no service, or a chosen ministry.",
        },
        fallback: "I'm here to help with the main questions about the dashboard.",
      },
      customIntro:
        "tell me your question and I'll guide you on how to solve it inside the dashboard.",
      customReceived: ({ question }) =>
        question ? `I understand your question: \"${question}\".` : "I've received your question.",
      customScope: {
        responsavel:
          "As a Responsible Brother, you have full access to every dashboard category.",
        capitao:
          "As a Troop Captain, remember that your access focuses on teens aged 11 to 17 and their guardians.",
        servicos:
          "As the services coordinator, you can assign ministries (even multiple per member) and maintain serving information directly from the manager.",
      },
      customFollowUp:
        "Make sure the data is up to date in the spreadsheet and use the cards or search to quickly locate the information you need. If the question persists, contact the IGColina leadership.",
    },
    serviceManager: {
      title: "Manage services",
      description:
        "Select a card to open the member's service panel and save the desired changes.",
      back: "← Back to main dashboard",
      filterLabel: "Filter",
      filters: {
        all: "All records",
        active: "Serving",
        unassigned: "No service",
      },
      add: {
        title: "Add new service",
        label: "Service name (Portuguese)",
        placeholder: "Type the Portuguese name",
        labelEn: "Service name (English)",
        placeholderEn: "Type the English name",
        labelEs: "Service name (Spanish)",
        placeholderEs: "Type the Spanish name",
        helper:
          "Provide the name in every language so the service appears translated across the dashboard.",
        button: "Add service",
        success: ({ name }) => `Service "${name}" added.`,
        exists: "That service is already available.",
        invalid: "Enter a valid name to add the service.",
        reserved: "That name cannot be used as a service.",
      },
      edit: {
        title: ({ name }) => (name ? `Edit service ${name}` : "Edit service"),
        button: "Save service",
        cancelButton: "Cancel editing",
        start: ({ name }) =>
          name
            ? `Editing "${name}". Update the names and save.`
            : "Editing service. Update the names and save.",
        success: ({ name }) =>
          name ? `Service updated to "${name}".` : "Service updated.",
        invalid: "Enter valid names to update the service.",
        reserved: "That name cannot be used as a service.",
        exists: "A service with this name already exists.",
        missing: "Couldn't find the selected service.",
        cancel: "Editing canceled.",
      },
      custom: {
        title: "Custom services",
        description:
          "Adjust translations or remove services created from the dashboard.",
        empty: "No custom services registered yet.",
        edit: "Edit",
        delete: "Delete",
        deleteConfirm: ({ name }) => `Remove the service "${name}"?`,
        deleteSuccess: ({ name }) => `Service "${name}" removed.`,
        deleteError: "We couldn't remove the service. Try again.",
        language: {
          pt: "Portuguese",
          en: "English",
          es: "Spanish",
        },
      },
      empty: "No members found for the selected filters.",
      restricted:
        "Service assignments are available only for the Services profile.",
      sync: {
        title: "Spreadsheet sync",
        description:
          "Connect to Google Sheets so every device keeps the latest service assignments.",
        buttons: {
          connect: "Update spreadsheet",
          authorize: "Authorize Google",
          syncing: "Syncing...",
          configure: "Configure sheet",
        },
        status: {
          ready: "Spreadsheet connected and ready for updates.",
          syncing: "Sending data to the spreadsheet...",
          success: "Services updated in the spreadsheet.",
          error: "Unable to update the spreadsheet. Try again.",
          unauthorized: "Authorize Google access to save the changes.",
          missingClient: "Provide the OAuth 2.0 Client ID to connect.",
          missingTab: "Provide the sheet tab name.",
        },
        prompt: {
          clientId: "Paste the OAuth 2.0 Client ID configured in Google Cloud.",
          tabName: "Inform the sheet tab name where services will be stored.",
        },
      },
    },
    serviceAssignment: {
      title: ({ name }) => `Manage services for ${name}`,
      subtitle:
        "Choose the ministries that apply, adjust the status, and save your changes.",
      statusLabel: "Current status",
      empty: "Add new services to make assignments available.",
      cancel: "Cancel",
      save: "Save changes",
      close: "Close service panel",
      success: ({ name }) => `Services updated for ${name}.`,
      open: ({ name }) => `Manage services for ${name}`,
    },
  },
  es: {
    app: {
      title: "Datos de IGColina",
      tagline: "Panel creado para uso de la Iglesia en Colina® 2025",
      homeAria: "Inicio · Datos de IGColina",
      document: ({ page }) =>
        page ? `${page} · Datos de IGColina` : "Datos de IGColina",
    },
    header: {
      lastUpdated: {
        loading: "Cargando datos...",
        text: ({ datetime }) => `Actualizado el ${datetime}`,
      },
    },
    search: {
      label: "Buscar Hermano",
      suggestionsAria: "Sugerencias",
      placeholder: {
        default: "Escriba el nombre",
        captain: "Busque adolescentes (11-17 años)",
        noRecords: "No hay registros disponibles",
        noTeens: "No hay adolescentes disponibles",
        noNameColumn: "No se encontró la columna de nombre",
      },
    },
    cards: {
      hint: "Haz clic para acceder a la información correspondiente.",
      restrictedHint: "Esta función no está liberada para este perfil.",
    },
    categories: {
      total: {
        title: "Total de Hermanos",
        description: "Vea a todos los hermanos registrados en la planilla.",
        chartLabel: "Edades de todos los hermanos",
        empty: "No se encontraron hermanos en esta categoría.",
      },
      children: {
        title: "Niños (0-10)",
        description: "Hermanos con edades entre 0 y 10 años.",
        chartLabel: "Edades de los niños",
        empty: "No hay niños registrados por el momento.",
      },
      teens: {
        title: "Adolescentes (11-17)",
        description:
          "Hermanos con edades entre 11 y 17 años. Active el filtro \"Edad apta para colportaje\" para destacar solo 16 y 17 años.",
        chartLabel: "Edades de los adolescentes",
        empty: "No hay adolescentes registrados por el momento.",
      },
      parents: {
        title: "Padres",
        description:
          "Padres y madres vinculados a los adolescentes registrados.",
        chartLabel: "Responsables de los adolescentes",
        empty: "No se encontraron padres o madres en esta categoría.",
      },
      careNetwork: {
        title: "Red de Cuidado",
        description:
          "Consulta los hermanos registrados en la Red de Cuidado y revisa los datos de acompañamiento.",
        chartLabel: "Registros de la Red de Cuidado",
        empty: "No se encontraron registros en la Red de Cuidado.",
      },
      services: {
        title: "Servicios",
        description: "Revisa quiénes sirven y en qué áreas.",
        chartLabel: "Edades de los hermanos que sirven",
        empty: "No hay hermanos sirviendo en este servicio.",
      },
      captains: {
        title: "Capitanes de Tropa (18-29)",
        description: "Hermanos con edades entre 18 y 29 años.",
        chartLabel: "Edades de los capitanes de tropa",
        empty: "No hay capitanes de tropa registrados por el momento.",
      },
      braves: {
        title: "Valientes de David (30-49)",
        description: "Hermanos con edades entre 30 y 49 años.",
        chartLabel: "Edades de los valientes de David",
        empty: "No hay valientes registrados por el momento.",
      },
      stewards: {
        title: "Intendentes (50+)",
        description: "Hermanos con 50 años o más.",
        chartLabel: "Edades de los intendentes",
        empty: "No hay intendentes registrados por el momento.",
      },
    },
    overview: {
      title: "Distribución general de edades",
      description: "Visualiza la edad de todos los hermanos registrados.",
      empty: "No hay datos de edad disponibles.",
      datasetLabel: "Cantidad de hermanos",
      captainTitle: "Distribución de edades de los adolescentes",
      captainDescription:
        "Visualiza solo las edades de los adolescentes entre 11 y 17 años.",
    },
    birthdays: {
      title: "Cumpleaños de hoy",
      description: "Celebra a los hermanos que cumplen años en esta fecha.",
      empty: {
        general: "No se encontraron cumpleaños para hoy.",
        teens: "No se encontraron cumpleaños de adolescentes para hoy.",
      },
      nameFallback: "Nombre no disponible",
      age: ({ age }) => `${age} años`,
      ageMissing: "Edad no informada",
    },
    status: {
      updated: "Datos actualizados.",
      noBirthColumn:
        "No encontramos la columna de fecha de nacimiento. Asegúrate de que una columna tenga ese nombre.",
      noRecords: "Aún no se encontraron registros en la planilla.",
      errorLoad:
        "No fue posible cargar los datos. Verifica si la planilla está publicada al público e inténtalo nuevamente.",
      loading: "Actualizando datos...",
    },
    errors: {
      primaryLoad: "No se pudo cargar la planilla principal.",
      fetchStatus: ({ status }) => `No fue posible acceder a la planilla (estado ${status}).`,
      unexpectedResponse: "Respuesta inesperada de la API de Google Sheets.",
      serviceLoad: "No fue posible cargar la pestaña de servicios.",
    },
    category: {
      loadingTitle: "Cargando categoría...",
      loadingDescription: "Estamos preparando los datos.",
      meta: ({ count, noun, filter }) =>
        `${count} ${noun} en esta categoría${filter ? ` · ${filter}` : ""}`,
      nounSingular: "hermano",
      nounPlural: "hermanos",
      filterNote: 'filtro "Edad apta para colportaje" activo',
      chartEmpty: "No hay edades disponibles para esta categoría.",
      navBack: "← Volver al panel principal",
      navAria: "Categorías disponibles",
    },
    filters: {
      teens: {
        label: "Edad apta para colportaje",
        hint: "(muestra solo 16 y 17 años)",
      },
    },
    modal: {
      title: "Detalles",
      close: "Cerrar",
      noName: "(Sin nombre)",
    },
    format: {
      phoneMissing: "no informado",
      ageMissing: "no informada",
      age: ({ count }) => `${count} ${count === 1 ? "año" : "años"}`,
    },
    people: {
      ageLabel: ({ value }) => `Edad: ${value}`,
      phoneLabel: ({ value }) => `Teléfono: ${value}`,
      serviceLabel: ({ value }) => `Servicio: ${value}`,
      servingTag: "Sirviendo",
      you: "Tú",
    },
    parents: {
      meta: ({ parents, families }) => {
        const responsable = parents === 1 ? "responsable" : "responsables";
        const familia = families === 1 ? "familia" : "familias";
        return `${parents} ${responsable} vinculados a ${families} ${familia}.`;
      },
      card: {
        father: ({ name }) => `Padre: ${name}`,
        mother: ({ name }) => `Madre: ${name}`,
        child: ({ name }) => `Hijo(a): ${name}`,
      },
      labels: {
        father: "Padre",
        mother: "Madre",
        child: "Hijo(a)",
        unknown: "No informado",
      },
      choice: {
        title: "Seleccione el responsable",
        question: ({ child }) =>
          child
            ? `¿A quién desea ver para ${child}?`
            : "¿A quién desea ver?",
        father: "Padre",
        mother: "Madre",
        cancel: "Cancelar",
      },
      noDetails: "No encontramos información para ese responsable.",
      details: {
        childLabel: "Hijo(a)",
        ageLabel: "Edad del hijo(a)",
        phoneLabel: "Teléfono del hijo(a)",
        missing: "No hay información adicional disponible.",
      },
      modalFallback: {
        father: ({ child }) => (child ? `Padre de ${child}` : "Padre"),
        mother: ({ child }) => (child ? `Madre de ${child}` : "Madre"),
      },
      chartEmpty: "Esta sección no cuenta con un gráfico específico.",
    },
    services: {
      summaryTitle: "Servicios disponibles",
      summaryDescription:
        "Haz clic en un servicio para filtrar a los hermanos que sirven.",
      filters: {
        all: "Todos los servicios",
        unassigned: "Sin servicio",
      },
      countLabel: ({ count }) =>
        `${count} ${count === 1 ? "hermano sirviendo" : "hermanos sirviendo"}`,
      countLabelUnassigned: ({ count }) =>
        `${count} ${count === 1 ? "hermano sin servicio" : "hermanos sin servicio"}`,
      empty: {
        all: "No hay hermanos sirviendo en este momento.",
        service: ({ service }) => `No hay hermanos sirviendo en ${service}.`,
        unassigned: "Todos los hermanos están sirviendo por ahora.",
      },
      meta: {
        all: "todos los servicios",
        unassigned: "hermanos sin servicio",
        service: ({ service }) => `servicio: ${service}`,
      },
      tagsLabel: "Servicios en los que participa",
      selectLabel: "Elige los servicios",
      detailLabel: "Dónde sirve",
      detailValueNone: "Sin servicio",
      feedback: {
        inactive: "Sin servicio",
        active: "Sirviendo",
      },
      chartLabelUnassigned: "Edades de los hermanos sin servicio",
    },
    careNetwork: {
      meta: ({ assigned, total }) => {
        const assignedLabel =
          assigned === 1
            ? "1 hermano acompañado"
            : `${assigned} hermanos acompañados`;
        const totalLabel =
          total === 1 ? "1 registro" : `${total} registros`;
        return `${assignedLabel} · ${totalLabel}`;
      },
      detailLabel: "Red de Cuidado",
      detailValueNone: "Sin servicio",
      servicesTitle: "Servicios asignados",
      fieldLabel: ({ field }) => `Red de Cuidado · ${field}`,
      cardPhoneLabel: "Teléfono",
      cardApproachedByLabel: "Quién abordó",
      cardValueMissing: "No informado",
      cardImageAlt: "Red de Cuidado",
      chartEmpty: "No hay datos disponibles para la Red de Cuidado.",
    },
    access: {
      modalTitle: "Selecciona a continuación tu función:",
      modalDescription: "Elige una opción para continuar:",
      selectedRole: ({ role }) => `Función seleccionada: ${role}`,
      passwordLabel: "Ingresa la contraseña",
      back: "Volver",
      confirm: "Confirmar",
      errorInvalid: "Contraseña incorrecta. Inténtalo nuevamente.",
      errorRequired: "Ingresa la contraseña para continuar.",
      restrictionCaptain:
        "Perfil de Capitanes de Tropa: el acceso está disponible solo para adolescentes (11-17 años) y sus responsables.",
      requireSelection: "Selecciona una función para continuar.",
      selectedRolePrefix: "Función seleccionada:",
      roles: {
        responsavel: {
          label: "Hermano Responsable",
          description: "Acceso completo a todas las áreas del panel.",
        },
        capitao: {
          label: "Capitanes de Tropa",
          description:
            "Acceso restringido a la información de los adolescentes (11-17 años) y sus responsables.",
        },
        servicos: {
          label: "Servicios",
          description:
            "Perfil dedicado a gestionar quién sirve y en qué área lo hace.",
        },
      },
    },
    profile: {
      label: "Perfil",
      title: "Perfil actual",
      switch: "Cambiar usuario",
      manageServices: "Gestionar servicios",
      openDashboard: "Ir al panel principal",
      password: {
        changeAction: "Cambiar contraseña",
        title: "Cambiar contraseña",
        description: "Define una nueva contraseña para este perfil.",
        newPlaceholder: "Ingresa la nueva contraseña",
        confirmPlaceholder: "Confirma la nueva contraseña",
        save: "Guardar contraseña",
        cancel: "Cancelar",
        required: "Ingresa la nueva contraseña.",
        mismatch: "Las contraseñas no coinciden.",
        invalid: "Ingresa una contraseña válida.",
        success: "Contraseña actualizada correctamente.",
        unavailable:
          "Accede con un perfil válido para cambiar la contraseña.",
      },
      manage: {
        open: "Gestionar perfiles",
        title: "Agregar perfil",
        description:
          "Crea un nuevo acceso indicando el nombre, la función y la contraseña.",
        namePlaceholder: "Ingresa el nombre del perfil",
        rolePlaceholder: "Selecciona la función",
        passwordPlaceholder: "Crea una contraseña",
        confirmPlaceholder: "Confirma la contraseña",
        save: "Guardar perfil",
        cancel: "Cancelar",
        restricted: "Solo el perfil ADM puede gestionar nuevos accesos.",
        nameRequired: "Ingresa el nombre del perfil.",
        roleRequired: "Selecciona la función del perfil.",
        passwordRequired: "Ingresa una contraseña para el nuevo perfil.",
        passwordMismatch: "Las contraseñas no coinciden.",
        passwordInvalid: "Ingresa una contraseña válida.",
        passwordDuplicate: "Ya existe un perfil registrado con esa contraseña.",
        success: ({ name, role }) =>
          `Perfil "${name}" agregado como ${role}.`,
      },
    },
    language: {
      toggleAria: "Seleccionar idioma",
    },
    assistant: {
      toggleAlt: "Abrir asistente virtual",
      title: "JP assistant",
      subtitle: "Puedo ayudarte con dudas sobre el panel.",
      closeLabel: "Cerrar asistente",
      inputLabel: "Describe tu duda",
      inputPlaceholder: "Escribe tu duda",
      submit: "Enviar",
      typing: "escribiendo",
      userLabel: "Tú",
      greeting: ({ name }) =>
        name
          ? `¡Hola, ${name}! Soy el JP assistant del panel. Elige una pregunta o usa \"Otros\" para dudas específicas.`
          : "¡Hola! Soy el JP assistant del panel. Elige una pregunta o usa \"Otros\" para dudas específicas.",
      questions: {
        refresh: "¿Cómo se actualizan los datos?",
        search: "¿Cómo buscar a un hermano?",
        categories: "¿Cómo acceder a las categorías?",
        assignService: "¿Cómo asigno un servicio?",
        removeService: "¿Cómo quito un servicio?",
        filterServices: "¿Cómo filtro los servicios?",
        custom: "Otros",
      },
      answers: {
        refresh: {
          responsavel:
            "Todo el panel se sincroniza con las planillas cada minuto. Puedes recargar la página para actualizar al instante.",
          capitao:
            "Los registros de adolescentes se actualizan automáticamente cada minuto con los datos de las planillas. Recarga la página si necesitas forzar una nueva consulta.",
          servicos:
            "Después de ajustar los servicios, recarga la página para sincronizar de inmediato la información.",
        },
        search: {
          responsavel:
            "Escribe parte del nombre en el campo de búsqueda y selecciona una sugerencia para abrir el registro completo.",
          capitao:
            "En el campo de búsqueda, escribe el nombre del adolescente (11-17 años). Elige una sugerencia para abrir los detalles completos.",
          servicos:
            "Busca el nombre del hermano para revisar el registro y actualizar rápidamente el servicio asignado.",
        },
        categories: {
          responsavel:
            "Usa las tarjetas de la página inicial o el menú de categorías para navegar. Cada pestaña muestra a los hermanos de ese grupo con gráficos y tarjetas detalladas.",
          capitao:
            "Como Capitán de Tropa, ves las tarjetas de adolescentes y de padres. Haz clic en cualquiera para abrir la lista con los detalles correspondientes.",
          servicos:
            "Aprovecha las tarjetas y el gestor de servicios para seguir cada área y actualizar las asignaciones cuando sea necesario.",
        },
        assignService: {
          responsavel:
            "Las asignaciones de servicio las gestiona únicamente el perfil Servicios. Contacta al equipo encargado para que registre el ministerio.",
          capitao:
            "Solo el perfil Servicios puede asignar ministerios. Informa al equipo responsable para que registre el servicio de los adolescentes.",
        servicos:
            "En el gestor de servicios, toca la tarjeta del hermano para abrir el panel de asignación. Selecciona los ministerios correspondientes y confirma con \"Guardar cambios\".",
      },
      removeService: {
        responsavel:
            "Quitar un servicio también requiere el perfil Servicios. Comunícate con quienes administran la lista para actualizar el registro.",
        capitao:
            "Solo el perfil Servicios puede eliminar un servicio. Avisa al equipo responsable para que realice el cambio.",
        servicos:
            "Abre la tarjeta del hermano, utiliza el panel de asignación para quitar los ministerios que ya no correspondan y guarda para confirmar la actualización.",
      },
        filterServices: {
          responsavel:
            "Puedes ver las etiquetas de servicio en cada tarjeta, pero los filtros detallados y las ediciones dependen del perfil Servicios.",
          capitao:
            "Como Capitán de Tropa solo visualizas las etiquetas de los adolescentes y sus padres; los filtros avanzados están disponibles para el perfil Servicios.",
          servicos:
            "Utiliza las tarjetas de resumen o el filtro del gestor para listar solo a quienes sirven en un ministerio específico. El selector \"Servicios\" permite alternar entre activos, sin servicio o un ministerio elegido.",
        },
        fallback: "Estoy aquí para ayudarte con las principales dudas del panel.",
      },
      customIntro:
        "cuéntame tu duda y te guiaré sobre cómo resolverla en el panel.",
      customReceived: ({ question }) =>
        question ? `Entendí tu duda: \"${question}\".` : "Recibí tu duda.",
      customScope: {
        responsavel:
          "Como Hermano Responsable, tienes acceso completo a todas las categorías del panel.",
        capitao:
          "Como Capitán de Tropa, recuerda que tu acceso se enfoca en los adolescentes de 11 a 17 años y sus responsables.",
        servicos:
          "Como responsable de los servicios, puedes asignar ministerios (incluso más de uno por hermano) y mantener la información actualizada directamente en el gestor.",
      },
      customFollowUp:
        "Verifica que los datos estén actualizados en la planilla y utiliza las tarjetas o la búsqueda para localizar rápidamente la información deseada. Si la duda persiste, ponte en contacto con la lideranza de IGColina.",
    },
    serviceManager: {
      title: "Gestionar servicios",
      description:
        "Toca la tarjeta para abrir el panel de servicios del hermano y guardar los cambios necesarios.",
      back: "← Volver al panel principal",
      filterLabel: "Filtrar",
      filters: {
        all: "Todos los registros",
        active: "Sirviendo",
        unassigned: "Sin servicio",
      },
      add: {
        title: "Agregar nuevo servicio",
        label: "Nombre del servicio (Portugués)",
        placeholder: "Escribe el nombre en Portugués",
        labelEn: "Nombre del servicio (Inglés)",
        placeholderEn: "Escribe el nombre en Inglés",
        labelEs: "Nombre del servicio (Español)",
        placeholderEs: "Escribe el nombre en Español",
        helper:
          "Completa el nombre en los tres idiomas para que el servicio aparezca traducido en todo el panel.",
        button: "Agregar servicio",
        success: ({ name }) => `Servicio "${name}" agregado.`,
        exists: "Ese servicio ya está disponible.",
        invalid: "Ingresa un nombre válido para agregar el servicio.",
        reserved: "Ese nombre no puede utilizarse como servicio.",
      },
      edit: {
        title: ({ name }) =>
          name ? `Editar servicio ${name}` : "Editar servicio",
        button: "Guardar servicio",
        cancelButton: "Cancelar edición",
        start: ({ name }) =>
          name
            ? `Editando el servicio "${name}". Actualiza los nombres y guarda.`
            : "Editando servicio. Actualiza los nombres y guarda.",
        success: ({ name }) =>
          name ? `Servicio actualizado a "${name}".` : "Servicio actualizado.",
        invalid: "Ingresa nombres válidos para actualizar el servicio.",
        reserved: "Ese nombre no se puede usar como servicio.",
        exists: "Ya existe un servicio con ese nombre.",
        missing: "No fue posible encontrar el servicio seleccionado.",
        cancel: "Edición cancelada.",
      },
      custom: {
        title: "Servicios personalizados",
        description:
          "Ajusta las traducciones o elimina los servicios creados desde el panel.",
        empty: "Aún no hay servicios personalizados registrados.",
        edit: "Editar",
        delete: "Eliminar",
        deleteConfirm: ({ name }) => `¿Eliminar el servicio "${name}"?`,
        deleteSuccess: ({ name }) => `Servicio "${name}" eliminado.`,
        deleteError: "No fue posible eliminar el servicio. Inténtalo nuevamente.",
        language: {
          pt: "Portugués",
          en: "Inglés",
          es: "Español",
        },
      },
      empty: "No se encontraron hermanos para los filtros seleccionados.",
      restricted:
        "La asignación de servicios está disponible solo para el perfil Servicios.",
      sync: {
        title: "Sincronización con planilla",
        description:
          "Conéctate con Google Sheets para que todos los dispositivos reciban las últimas asignaciones.",
        buttons: {
          connect: "Actualizar planilla",
          authorize: "Autorizar Google",
          syncing: "Sincronizando...",
          configure: "Configurar planilla",
        },
        status: {
          ready: "Planilla conectada y lista para recibir actualizaciones.",
          syncing: "Enviando datos a la planilla...",
          success: "Servicios actualizados en la planilla.",
          error: "No fue posible actualizar la planilla. Inténtalo nuevamente.",
          unauthorized: "Autoriza el acceso de Google para guardar los cambios.",
          missingClient: "Informa el Client ID OAuth 2.0 para conectar.",
          missingTab: "Informa el nombre de la pestaña de la planilla.",
        },
        prompt: {
          clientId: "Pega el Client ID OAuth 2.0 configurado en Google Cloud.",
          tabName: "Indica el nombre de la pestaña donde se guardarán los servicios.",
        },
      },
    },
    serviceAssignment: {
      title: ({ name }) => `Gestionar servicios de ${name}`,
      subtitle:
        "Selecciona los ministerios correspondientes, ajusta el estado y guarda los cambios.",
      statusLabel: "Estado actual",
      empty: "Agrega nuevos servicios para poder asignarlos.",
      cancel: "Cancelar",
      save: "Guardar cambios",
      close: "Cerrar panel de servicios",
      success: ({ name }) => `Servicios actualizados para ${name}.`,
      open: ({ name }) => `Gestionar servicios de ${name}`,
    },
  },
};

let collator = new Intl.Collator(LANGUAGE_OPTIONS.pt.locale, {
  sensitivity: "base",
});

const ACCESS_ROLES = {
  RESPONSIBLE: "responsavel",
  CAPTAIN: "capitao",
  SERVICES: "servicos",
};

const ACCESS_METADATA = {
  [ACCESS_ROLES.RESPONSIBLE]: {
    labelKey: "access.roles.responsavel.label",
    descriptionKey: "access.roles.responsavel.description",
  },
  [ACCESS_ROLES.CAPTAIN]: {
    labelKey: "access.roles.capitao.label",
    descriptionKey: "access.roles.capitao.description",
  },
  [ACCESS_ROLES.SERVICES]: {
    labelKey: "access.roles.servicos.label",
    descriptionKey: "access.roles.servicos.description",
  },
};

const FULL_ACCESS_ROLES = new Set([
  ACCESS_ROLES.RESPONSIBLE,
  ACCESS_ROLES.SERVICES,
]);

const NAME_SECRET = "IGCOLINA2025";

const RESPONSIBLE_ROLE_CREDENTIALS = {
  "7a5df5ffa0dec2228d90b8d0a0f1b0767b748b0a41314c123075b8289e4e053f":
    "0426312c2925272f5d10615c253122",
  "73a2af8864fc500fa49048bf3003776c19938f360e56bd03663866fb3087884a":
    "042e2223252a2628",
  "b74b7e3fcb623d805dacf98db27530f845760c47e3b0faa702b84e9ff3902c37":
    "0829273da5691d285e4653",
  "b411746bdf09bde7f1fe70ddc8fa57241a0cb79d14d6e9c27e598635ca7dae4d":
    "1a2231282527262e",
  "3f95b1b8a32c2c0251dfdbc3c8a30aab6d6e680cf0ef03e8af84a65dff0c4a85":
    "0a2e2720",
  "060e33205a731400c2eb92bc12cf921a4e44cf1851d216f144337dd6ec5350a7":
    "0a2631232527262e41",
  "ff4b467b7a593047c46682ecdbf6da36b3f3bb4b50d35f08f17f751ef5f15531":
    "2337252e2f21272f53",
};

const SERVICES_ROLE_CREDENTIALS = Object.freeze({
  "1dfb4b20fb5e68711da6a808cc60651fd78ff853b24778ec292af422e58cd957":
    "1a22313925ae2132",
});

const BASE_ROLE_CREDENTIALS = Object.freeze({
  [ACCESS_ROLES.RESPONSIBLE]: RESPONSIBLE_ROLE_CREDENTIALS,
  [ACCESS_ROLES.SERVICES]: SERVICES_ROLE_CREDENTIALS,
  [ACCESS_ROLES.CAPTAIN]: {
    "892cc7e526dcdacf4f31b35252576b942c802e12db33ee5ba0040d82c0860342":
      "0a26332638aa2b32125457151d352c3f2d",
  },
});

const ROLE_CREDENTIALS_STORAGE_KEY = "igcolina-role-credentials";

const ACCESS_SESSION_KEY = "igcolina-access-role";

const elements = {
  appTitle: document.getElementById("app-title"),
  appTitleLink: document.getElementById("app-title-link"),
  logoLink: document.querySelector(".logo-link"),
  languageSwitcher: document.getElementById("language-switcher"),
  languageToggle: document.getElementById("language-toggle"),
  languageToggleLabel: document.getElementById("language-toggle-label"),
  languageMenu: document.getElementById("language-menu"),
  searchLabel: document.getElementById("search-label"),
  total: document.getElementById("total-count"),
  children: document.getElementById("children-count"),
  teens: document.getElementById("teens-count"),
  parents: document.getElementById("parents-count"),
  careNetwork: document.getElementById("care-network-count"),
  services: document.getElementById("services-count"),
  captains: document.getElementById("captains-count"),
  braves: document.getElementById("braves-count"),
  stewards: document.getElementById("stewards-count"),
  status: document.getElementById("status"),
  lastUpdated: document.getElementById("last-updated"),
  search: document.getElementById("search"),
  suggestions: document.getElementById("suggestions"),
  modal: document.getElementById("details-modal"),
  closeModal: document.getElementById("close-modal"),
  modalName: document.getElementById("modal-name"),
  modalDetails: document.getElementById("modal-details"),
  serviceControls: document.getElementById("service-controls"),
  serviceTagsLabel: document.getElementById("service-tags-label"),
  serviceTags: document.getElementById("service-tags"),
  serviceSelectLabel: document.getElementById("service-select-label"),
  serviceChecklist: document.getElementById("service-checklist"),
  serviceChecklistOptions: document.getElementById(
    "service-checklist-options"
  ),
  serviceFeedback: document.getElementById("service-feedback"),
  detailTemplate: document.getElementById("detail-row-template"),
  summaryCards: Array.from(
    document.querySelectorAll(".cards .card[data-category]")
  ),
  overviewTitle: document.getElementById("overview-title"),
  overviewDescription: document.getElementById("overview-description"),
  categoryTitle: document.getElementById("category-title"),
  categoryDescription: document.getElementById("category-description"),
  categoryMeta: document.getElementById("category-meta"),
  categoryCards: document.getElementById("category-cards"),
  categoryEmpty: document.getElementById("category-empty"),
  categoryChartEmpty: document.getElementById("category-chart-empty"),
  overallEmpty: document.getElementById("overall-empty"),
  overallChart: document.getElementById("overall-age-chart"),
  categoryChart: document.getElementById("category-age-chart"),
  serviceSummary: document.getElementById("service-summary"),
  serviceSummaryTitle: document.getElementById("service-summary-title"),
  serviceSummaryDescription: document.getElementById("service-summary-description"),
  serviceSummaryGrid: document.getElementById("service-summary-grid"),
  birthdaySection: document.getElementById("birthday-section"),
  birthdayList: document.getElementById("birthday-list"),
  birthdayEmpty: document.getElementById("birthday-empty"),
  categoryLinks: Array.from(
    document.querySelectorAll("[data-category-link]")
  ),
  categoryNav: document.getElementById("category-nav"),
  backLink: document.getElementById("back-link"),
  teensFilter: document.getElementById("teens-filter"),
  teensFilterToggle: document.getElementById("teens-filter-toggle"),
  userProfile: document.getElementById("user-profile"),
  userMenuToggle: document.getElementById("user-menu-toggle"),
  userMenu: document.getElementById("user-menu"),
  userProfileLabel: document.getElementById("user-profile-label"),
  userProfileTitle: document.getElementById("user-profile-title"),
  userMenuRole: document.getElementById("user-menu-role"),
  userMenuDetail: document.getElementById("user-menu-detail"),
  switchUser: document.getElementById("switch-user"),
  changePassword: document.getElementById("change-password"),
  manageProfiles: document.getElementById("manage-profiles"),
  manageServices: document.getElementById("manage-services"),
  accessModal: document.getElementById("access-modal"),
  accessOptions: document.getElementById("access-options"),
  accessForm: document.getElementById("access-form"),
  accessPassword: document.getElementById("access-password"),
  accessError: document.getElementById("access-error"),
  accessRoleLabel: document.getElementById("selected-role-label"),
  accessSelectedText: document.getElementById("access-selected-text"),
  accessPasswordLabel: document.getElementById("access-password-label"),
  accessTitle: document.getElementById("access-title"),
  accessDescription: document.getElementById("access-description"),
  accessBack: document.getElementById("access-back"),
  accessConfirm: document.getElementById("access-confirm"),
  accessOptionButtons: Array.from(
    document.querySelectorAll("[data-access-role]")
  ),
  assistantToggle: document.getElementById("assistant-toggle"),
  assistantPanel: document.getElementById("assistant-panel"),
  assistantClose: document.getElementById("assistant-close"),
  assistantQuestions: document.getElementById("assistant-questions"),
  assistantForm: document.getElementById("assistant-form"),
  assistantInput: document.getElementById("assistant-input"),
  assistantConversation: document.getElementById("assistant-conversation"),
  assistantTitle: document.getElementById("assistant-title"),
  assistantSubtitle: document.getElementById("assistant-subtitle"),
  assistantInputLabel: document.getElementById("assistant-input-label"),
  assistantSubmit: document.getElementById("assistant-submit"),
  parentChoice: document.getElementById("parent-choice"),
  parentChoiceContent: document.querySelector("#parent-choice .parent-choice-content"),
  parentChoiceTitle: document.getElementById("parent-choice-title"),
  parentChoiceQuestion: document.getElementById("parent-choice-question"),
  parentChoiceFather: document.getElementById("parent-choice-father"),
  parentChoiceMother: document.getElementById("parent-choice-mother"),
  parentChoiceCancel: document.getElementById("parent-choice-cancel"),
  parentChoiceClose: document.getElementById("parent-choice-close"),
  passwordModal: document.getElementById("password-modal"),
  passwordModalDialog: document.getElementById("password-modal-dialog"),
  passwordModalForm: document.getElementById("password-modal-form"),
  passwordModalClose: document.getElementById("password-modal-close"),
  passwordModalCancel: document.getElementById("password-modal-cancel"),
  passwordModalTitle: document.getElementById("password-modal-title"),
  passwordModalDescription: document.getElementById("password-modal-description"),
  passwordModalSave: document.getElementById("password-modal-save"),
  passwordModalNew: document.getElementById("password-modal-new"),
  passwordModalConfirm: document.getElementById("password-modal-confirm"),
  passwordModalFeedback: document.getElementById("password-modal-feedback"),
  careNetworkImage: document.getElementById("care-network-image"),
  profileModal: document.getElementById("profile-modal"),
  profileModalDialog: document.getElementById("profile-modal-dialog"),
  profileModalForm: document.getElementById("profile-modal-form"),
  profileModalClose: document.getElementById("profile-modal-close"),
  profileModalCancel: document.getElementById("profile-modal-cancel"),
  profileModalTitle: document.getElementById("profile-modal-title"),
  profileModalDescription: document.getElementById("profile-modal-description"),
  profileModalSave: document.getElementById("profile-modal-save"),
  profileModalName: document.getElementById("profile-modal-name"),
  profileModalRole: document.getElementById("profile-modal-role"),
  profileModalPassword: document.getElementById("profile-modal-password"),
  profileModalConfirm: document.getElementById("profile-modal-confirm"),
  profileModalFeedback: document.getElementById("profile-modal-feedback"),
  serviceManagerSection: document.getElementById("service-manager"),
  serviceManagerTitle: document.getElementById("service-manager-title"),
  serviceManagerDescription: document.getElementById("service-manager-description"),
  serviceManagerFilterLabel: document.getElementById("service-manager-filter-label"),
  serviceManagerFilter: document.getElementById("service-manager-filter"),
  serviceManagerList: document.getElementById("service-manager-list"),
  serviceManagerEmpty: document.getElementById("service-manager-empty"),
  serviceManagerBack: document.getElementById("service-manager-back"),
  serviceManagerNotice: document.getElementById("service-manager-notice"),
  serviceAssignmentModal: document.getElementById("service-assignment-modal"),
  serviceAssignmentDialog: document.getElementById("service-assignment-dialog"),
  serviceAssignmentTitle: document.getElementById("service-assignment-title"),
  serviceAssignmentSubtitle: document.getElementById("service-assignment-subtitle"),
  serviceAssignmentMeta: document.getElementById("service-assignment-meta"),
  serviceAssignmentStatusLabel: document.getElementById(
    "service-assignment-status-label"
  ),
  serviceAssignmentStatus: document.getElementById("service-assignment-status"),
  serviceAssignmentOptions: document.getElementById("service-assignment-options"),
  serviceAssignmentEmpty: document.getElementById("service-assignment-empty"),
  serviceAssignmentForm: document.getElementById("service-assignment-form"),
  serviceAssignmentCancel: document.getElementById("service-assignment-cancel"),
  serviceAssignmentSave: document.getElementById("service-assignment-save"),
  serviceAssignmentClose: document.getElementById("service-assignment-close"),
};

const CATEGORY_CONFIG = [
  {
    id: "total",
    titleKey: "categories.total.title",
    descriptionKey: "categories.total.description",
    chartLabelKey: "categories.total.chartLabel",
    emptyMessageKey: "categories.total.empty",
    filter: () => true,
  },
  {
    id: "children",
    titleKey: "categories.children.title",
    descriptionKey: "categories.children.description",
    chartLabelKey: "categories.children.chartLabel",
    emptyMessageKey: "categories.children.empty",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 0 && entry.age <= 10,
  },
  {
    id: "teens",
    titleKey: "categories.teens.title",
    descriptionKey: "categories.teens.description",
    chartLabelKey: "categories.teens.chartLabel",
    emptyMessageKey: "categories.teens.empty",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 11 && entry.age <= 17,
  },
  {
    id: "captains",
    titleKey: "categories.captains.title",
    descriptionKey: "categories.captains.description",
    chartLabelKey: "categories.captains.chartLabel",
    emptyMessageKey: "categories.captains.empty",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 18 && entry.age <= 29,
  },
  {
    id: "braves",
    titleKey: "categories.braves.title",
    descriptionKey: "categories.braves.description",
    chartLabelKey: "categories.braves.chartLabel",
    emptyMessageKey: "categories.braves.empty",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 30 && entry.age <= 49,
  },
  {
    id: "stewards",
    titleKey: "categories.stewards.title",
    descriptionKey: "categories.stewards.description",
    chartLabelKey: "categories.stewards.chartLabel",
    emptyMessageKey: "categories.stewards.empty",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 50,
  },
  {
    id: "parents",
    titleKey: "categories.parents.title",
    descriptionKey: "categories.parents.description",
    chartLabelKey: "categories.parents.chartLabel",
    emptyMessageKey: "categories.parents.empty",
    filter: () => true,
    isParentCategory: true,
  },
  {
    id: "care-network",
    titleKey: "categories.careNetwork.title",
    descriptionKey: "categories.careNetwork.description",
    chartLabelKey: "categories.careNetwork.chartLabel",
    emptyMessageKey: "categories.careNetwork.empty",
    filter: () => true,
    isCareNetworkCategory: true,
  },
  {
    id: "services",
    titleKey: "categories.services.title",
    descriptionKey: "categories.services.description",
    chartLabelKey: "categories.services.chartLabel",
    emptyMessageKey: "categories.services.empty",
    filter: (entry) => hasActiveServices(entry),
    isServiceCategory: true,
  },
];

const CATEGORY_BY_ID = CATEGORY_CONFIG.reduce((acc, category) => {
  acc[category.id] = category;
  return acc;
}, {});

function getInitialCategory() {
  try {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("category");
    if (requested && CATEGORY_BY_ID[requested]) {
      return requested;
    }
  } catch (error) {
    console.warn("Unable to read URL parameters:", error);
  }
  return "total";
}

const SUPPLEMENTAL_EXCLUDED_KEYS = new Set(
  [
    "Nome do Adolescente(a):",
    "Data de aniversário do Adolescente:",
    "Data de aniversario do Adolescente:",
    "Telefone do adolescente:",
  ].map((label) => normalizeColumnLabel(label))
);

const DEFAULT_SERVICE_SHEET_CONFIG = {
  sheetId: "",
  tabName: "",
  clientId: "",
  sheetGid: "",
  htmlUrl: "",
  gvizUrl: "",
  csvUrl: "",
};

function loadServiceSheetConfig() {
  return { ...DEFAULT_SERVICE_SHEET_CONFIG };
}

function saveServiceSheetConfig() {}

function createEmptyCareNetworkState() {
  return {
    columns: [],
    records: [],
    nameColumn: null,
    serviceColumns: [],
    entries: [],
    index: new Map(),
    summary: { total: 0, assigned: 0 },
  };
}

const state = {
  records: [],
  columns: [],
  nameColumn: null,
  birthColumn: null,
  phoneColumn: null,
  supplementalRecords: [],
  supplementalColumns: [],
  supplementalNameColumn: null,
  supplementalBirthColumn: null,
  supplementalPhoneColumn: null,
  supplementalEntries: [],
  supplementalIndex: new Map(),
  enrichedRecords: [],
  parentEntries: [],
  parentSummary: { parents: 0, families: 0 },
  parentChoice: null,
  refreshTimer: null,
  activeCategory: getInitialCategory(),
  charts: {
    overall: null,
    category: null,
  },
  teensFilterActive: false,
  accessRole: null,
  pendingAccessRole: null,
  accessResolver: null,
  searchPool: [],
  activeUserName: null,
  activeUserSecret: null,
  serviceAssignments: new Map(),
  customServiceOptions,
  serviceSummary: { total: 0, unassigned: 0, perService: {} },
  accessibleServiceSummary: { total: 0, unassigned: 0, perService: {} },
  activeServiceFilter: SERVICE_FILTER_ALL,
  activeDetailEntry: null,
  activeServiceModalEntry: null,
  activeServiceModalTrigger: null,
  editingServiceId: null,
  roleCredentials: cloneRoleCredentials(),
  assistant: {
    greeted: false,
    customMode: false,
    typingTimeouts: new Set(),
    questionsRendered: false,
  },
  language: null,
  serviceSheet: {
    columns: [],
    records: [],
    config: loadServiceSheetConfig(),
  },
  parentSheet: {
    columns: [],
    records: [],
    csvUrl: "",
  },
  careNetwork: createEmptyCareNetworkState(),
};

function hasFullAccessRole(role) {
  return FULL_ACCESS_ROLES.has(role);
}

function canManageServices() {
  return state.accessRole === ACCESS_ROLES.SERVICES;
}

const ASSISTANT_QUESTION_SETS = {
  default: [
    {
      id: "refresh",
      labelKey: "assistant.questions.refresh",
    },
    {
      id: "search",
      labelKey: "assistant.questions.search",
    },
    {
      id: "categories",
      labelKey: "assistant.questions.categories",
    },
    {
      id: "custom",
      labelKey: "assistant.questions.custom",
      custom: true,
    },
  ],
  serviceManager: [
    {
      id: "assignService",
      labelKey: "assistant.questions.assignService",
    },
    {
      id: "removeService",
      labelKey: "assistant.questions.removeService",
    },
    {
      id: "filterServices",
      labelKey: "assistant.questions.filterServices",
    },
    {
      id: "custom",
      labelKey: "assistant.questions.custom",
      custom: true,
    },
  ],
};

function getAssistantQuestionSet() {
  if (isServiceManagerPage) {
    return ASSISTANT_QUESTION_SETS.serviceManager;
  }
  return ASSISTANT_QUESTION_SETS.default;
}

function getAssistantQuestionById(questionId) {
  if (!questionId) {
    return null;
  }

  const activeSet = getAssistantQuestionSet();
  let question = activeSet.find((item) => item.id === questionId);
  if (question) {
    return question;
  }

  const fallbackSet = ASSISTANT_QUESTION_SETS.default;
  return fallbackSet.find((item) => item.id === questionId) ?? null;
}

function getValidLanguage(language) {
  if (!language) return null;
  const normalized = language.toLowerCase();
  if (LANGUAGE_OPTIONS[normalized]) {
    return normalized;
  }
  const match = Object.values(LANGUAGE_OPTIONS).find((option) => {
    if (!option.locale) return false;
    return option.locale.toLowerCase().startsWith(normalized);
  });
  return match?.code ?? null;
}

function getDefaultLanguage() {
  const browserLanguage =
    typeof navigator !== "undefined" ? navigator.language : null;
  const detected = getValidLanguage(browserLanguage ?? "");
  return detected ?? "pt";
}

function getLanguageConfig(language) {
  const valid = getValidLanguage(language) ?? "pt";
  return LANGUAGE_OPTIONS[valid] ?? LANGUAGE_OPTIONS.pt;
}

function getTranslationObject(language) {
  const valid = getValidLanguage(language) ?? "pt";
  return TRANSLATIONS[valid] ?? TRANSLATIONS.pt;
}

function formatTranslationString(template, replacements) {
  if (!template || typeof template !== "string") {
    return template ?? "";
  }
  if (!replacements) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(replacements, key)) {
      const value = replacements[key];
      return value == null ? "" : String(value);
    }
    return match;
  });
}

function translate(key, replacements = {}, language = state.language ?? "pt") {
  if (!key) return "";
  const segments = String(key).split(".").filter(Boolean);
  const fallback = getTranslationObject("pt");
  const target = getTranslationObject(language);

  let value = target;
  for (const segment of segments) {
    if (value && Object.prototype.hasOwnProperty.call(value, segment)) {
      value = value[segment];
    } else {
      value = undefined;
      break;
    }
  }

  if (value === undefined) {
    value = fallback;
    for (const segment of segments) {
      if (value && Object.prototype.hasOwnProperty.call(value, segment)) {
        value = value[segment];
      } else {
        value = key;
        break;
      }
    }
  }

  if (typeof value === "function") {
    try {
      return value(replacements ?? {}, { language });
    } catch (error) {
    console.warn(`Failed to evaluate translation for ${key}:`, error);
      return "";
    }
  }

  return formatTranslationString(value, replacements);
}

function translateCategoryField(category, field) {
  if (!category) return "";
  const key = category[`${field}Key`];
  if (!key) return "";
  return translate(key);
}

function getRoleLabel(role) {
  const metadata = ACCESS_METADATA[role];
  return metadata ? translate(metadata.labelKey) : "";
}

function getRoleDescription(role) {
  const metadata = ACCESS_METADATA[role];
  return metadata ? translate(metadata.descriptionKey) : "";
}

function getAppTitle(pageTitle = null) {
  return translate("app.document", { page: pageTitle });
}

function updateCollatorForLanguage(language) {
  const config = getLanguageConfig(language);
  collator = new Intl.Collator(config.locale ?? "pt-BR", {
    sensitivity: "base",
  });
}

function getStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!stored) return null;
    return getValidLanguage(stored);
  } catch (error) {
    console.warn("Unable to read stored language preference:", error);
  }
  return null;
}

function storeLanguage(language) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn("Unable to save language preference:", error);
  }
}

function updateLanguageToggleLabel() {
  if (!elements.languageToggleLabel || !state.language) {
    return;
  }
  const config = getLanguageConfig(state.language);
  elements.languageToggleLabel.textContent = config.label;
}

function renderLanguageMenu() {
  if (!elements.languageMenu) {
    return;
  }

  const current = state.language ?? getDefaultLanguage();
  const fragment = document.createDocumentFragment();

  Object.values(LANGUAGE_OPTIONS).forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.language = option.code;
    button.textContent = option.label;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = option.name;
    button.appendChild(nameSpan);

    if (option.code === current) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      setLanguage(option.code);
      closeLanguageMenu();
      elements.languageToggle?.focus();
    });

    fragment.appendChild(button);
  });

  elements.languageMenu.innerHTML = "";
  elements.languageMenu.appendChild(fragment);
}

function openLanguageMenu() {
  if (!elements.languageMenu || !elements.languageSwitcher) {
    return;
  }
  elements.languageMenu.hidden = false;
  elements.languageSwitcher.classList.add("open");
  elements.languageToggle?.setAttribute("aria-expanded", "true");
}

function closeLanguageMenu() {
  if (!elements.languageMenu || !elements.languageSwitcher) {
    return;
  }
  elements.languageMenu.hidden = true;
  elements.languageSwitcher.classList.remove("open");
  elements.languageToggle?.setAttribute("aria-expanded", "false");
}

function toggleLanguageMenu() {
  if (!elements.languageMenu) return;
  const isHidden = elements.languageMenu.hidden !== false;
  if (isHidden) {
    openLanguageMenu();
  } else {
    closeLanguageMenu();
  }
}

function handleLanguageOutsideClick(event) {
  if (!elements.languageSwitcher) {
    return;
  }
  if (elements.languageSwitcher.contains(event.target)) {
    return;
  }
  closeLanguageMenu();
}

function handleLanguageKeydown(event) {
  if (event.key === "Escape") {
    closeLanguageMenu();
  }
}

function setupLanguageSwitcher() {
  if (!elements.languageSwitcher || !elements.languageToggle) {
    return;
  }

  elements.languageSwitcher.hidden = false;
  elements.languageToggle.setAttribute(
    "aria-label",
    translate("language.toggleAria")
  );
  renderLanguageMenu();
  updateLanguageToggleLabel();

  elements.languageToggle.addEventListener("click", (event) => {
    event.preventDefault();
    toggleLanguageMenu();
  });

  document.addEventListener("click", handleLanguageOutsideClick);
  document.addEventListener("keydown", handleLanguageKeydown);
  closeLanguageMenu();
}

function applyLanguage(options = {}) {
  const { reapplyStatus = true } = options;
  const language = state.language ?? getDefaultLanguage();
  const config = getLanguageConfig(language);

  document.documentElement.lang = config.locale ?? language;

  if (elements.appTitle) {
    elements.appTitle.textContent = translate("app.title");
  }

  if (elements.appTitleLink) {
    elements.appTitleLink.textContent = translate("app.title");
  }

  if (elements.logoLink) {
    elements.logoLink.setAttribute("aria-label", translate("app.homeAria"));
  }

  if (elements.lastUpdated) {
    elements.lastUpdated.textContent = translate("header.lastUpdated.loading");
  }

  if (elements.searchLabel) {
    elements.searchLabel.textContent = translate("search.label");
  }

  if (elements.suggestions) {
    elements.suggestions.setAttribute(
      "aria-label",
      translate("search.suggestionsAria")
    );
  }

  elements.summaryCards.forEach((card) => {
    const categoryId = card.dataset.category;
    const category = CATEGORY_BY_ID[categoryId];
    if (!category) return;
    const titleElement = card.querySelector("h2");
    if (titleElement) {
      titleElement.textContent = translateCategoryField(category, "title");
    }
    const hintElement = card.querySelector(".card-hint");
    if (hintElement) {
      hintElement.textContent = translate("cards.hint");
    }
  });

  if (elements.careNetworkImage) {
    elements.careNetworkImage.alt = translate("careNetwork.cardImageAlt");
  }

  if (elements.overviewTitle) {
    elements.overviewTitle.textContent = translate("overview.title");
  }
  if (elements.overviewDescription) {
    elements.overviewDescription.textContent = translate(
      "overview.description"
    );
  }
  if (elements.overallEmpty) {
    elements.overallEmpty.textContent = translate("overview.empty");
  }

  if (elements.categoryNav) {
    elements.categoryNav.setAttribute(
      "aria-label",
      translate("category.navAria")
    );
  }

  if (elements.backLink) {
    elements.backLink.textContent = translate("category.navBack");
  }

  elements.categoryLinks.forEach((link) => {
    const categoryId = link.dataset.categoryLink;
    const category = CATEGORY_BY_ID[categoryId];
    if (!category) return;
    link.textContent = translateCategoryField(category, "title");
  });

  if (elements.categoryChartEmpty) {
    elements.categoryChartEmpty.textContent = translate("category.chartEmpty");
  }

  if (elements.categoryTitle && !state.enrichedRecords.length) {
    elements.categoryTitle.textContent = translate("category.loadingTitle");
  }
  if (elements.categoryDescription && !state.enrichedRecords.length) {
    elements.categoryDescription.textContent = translate(
      "category.loadingDescription"
    );
  }

  if (elements.birthdaySection) {
    const title = translate("birthdays.title");
    if (title && elements.birthdaySection) {
      const heading = elements.birthdaySection.querySelector("#birthday-title");
      if (heading) heading.textContent = title;
    }
  }

  if (elements.birthdaySection) {
    const descriptionElement = elements.birthdaySection.querySelector(
      ".birthdays-description"
    );
    if (descriptionElement) {
      descriptionElement.textContent = translate("birthdays.description");
    }
  }

  if (elements.birthdayEmpty) {
    elements.birthdayEmpty.textContent = translate("birthdays.empty.general");
  }

  if (elements.status && state.lastStatusMessage) {
    if (reapplyStatus) {
      if (state.lastStatusKey) {
        setStatusFromKey(state.lastStatusKey, {}, state.lastStatusError);
      } else {
        setStatus(state.lastStatusMessage, state.lastStatusError);
      }
    }
  }

  if (elements.userProfileTitle) {
    elements.userProfileTitle.textContent = translate("profile.title");
  }
  if (elements.switchUser) {
    elements.switchUser.textContent = translate("profile.switch");
  }
  if (elements.manageServices) {
    const key = isServiceManagerPage
      ? "profile.openDashboard"
      : "profile.manageServices";
    elements.manageServices.textContent = translate(key);
  }

  if (elements.accessTitle) {
    elements.accessTitle.textContent = translate("access.modalTitle");
  }
  if (elements.accessDescription) {
    elements.accessDescription.textContent = translate(
      "access.modalDescription"
    );
  }
  if (elements.accessPasswordLabel) {
    elements.accessPasswordLabel.textContent = translate(
      "access.passwordLabel"
    );
  }
  if (elements.accessBack) {
    elements.accessBack.textContent = translate("access.back");
  }
  if (elements.accessConfirm) {
    elements.accessConfirm.textContent = translate("access.confirm");
  }
  if (elements.accessOptionButtons.length) {
    elements.accessOptionButtons.forEach((button) => {
      const role = button.dataset.accessRole;
      button.textContent = getRoleLabel(role);
    });
  }

  const pendingRole = state.pendingAccessRole;
  const selectedRoleLabel = pendingRole ? getRoleLabel(pendingRole) : "";
  updateAccessSelectedLabel(selectedRoleLabel);

  if (elements.teensFilter) {
    const span = elements.teensFilter.querySelector("span");
    const small = elements.teensFilter.querySelector("small");
    if (span) {
      span.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.nodeValue = `${translate("filters.teens.label")} `;
        }
      });
    }
    if (small) {
      small.textContent = translate("filters.teens.hint");
    }
  }

  if (elements.assistantTitle) {
    elements.assistantTitle.textContent = translate("assistant.title");
  }
  if (elements.assistantSubtitle) {
    elements.assistantSubtitle.textContent = translate(
      "assistant.subtitle"
    );
  }
  if (elements.assistantToggle) {
    elements.assistantToggle.setAttribute(
      "aria-label",
      translate("assistant.toggleAlt")
    );
    const image = elements.assistantToggle.querySelector("img");
    if (image) {
      image.alt = translate("assistant.toggleAlt");
    }
  }
  if (elements.assistantClose) {
    elements.assistantClose.setAttribute(
      "aria-label",
      translate("assistant.closeLabel")
    );
  }
  if (elements.assistantInputLabel) {
    elements.assistantInputLabel.textContent = translate(
      "assistant.inputLabel"
    );
  }
  if (elements.assistantInput) {
    elements.assistantInput.placeholder = translate(
      "assistant.inputPlaceholder"
    );
  }
  if (elements.assistantSubmit) {
    elements.assistantSubmit.textContent = translate("assistant.submit");
  }

  if (elements.serviceManagerTitle) {
    elements.serviceManagerTitle.textContent = translate(
      "serviceManager.title"
    );
  }
  if (elements.serviceManagerDescription) {
    elements.serviceManagerDescription.textContent = translate(
      "serviceManager.description"
    );
  }
  if (elements.serviceManagerBack) {
    elements.serviceManagerBack.textContent = translate("serviceManager.back");
  }
  if (elements.serviceManagerFilterLabel) {
    elements.serviceManagerFilterLabel.textContent = translate(
      "serviceManager.filterLabel"
    );
  }
  if (elements.serviceManagerEmpty) {
    elements.serviceManagerEmpty.textContent = translate("serviceManager.empty");
  }
  if (elements.serviceManagerNotice) {
    elements.serviceManagerNotice.textContent = translate(
      "serviceManager.restricted"
    );
  }
  renderProfileRoleOptions();

  if (elements.passwordModalTitle) {
    elements.passwordModalTitle.textContent = translate("profile.password.title");
  }
  if (elements.passwordModalDescription) {
    elements.passwordModalDescription.textContent = translate(
      "profile.password.description"
    );
  }
  if (elements.passwordModalNew) {
    elements.passwordModalNew.placeholder = translate(
      "profile.password.newPlaceholder"
    );
  }
  if (elements.passwordModalConfirm) {
    elements.passwordModalConfirm.placeholder = translate(
      "profile.password.confirmPlaceholder"
    );
  }
  if (elements.passwordModalSave) {
    elements.passwordModalSave.textContent = translate("profile.password.save");
  }
  if (elements.passwordModalCancel) {
    elements.passwordModalCancel.textContent = translate(
      "profile.password.cancel"
    );
  }

  if (elements.profileModalTitle) {
    elements.profileModalTitle.textContent = translate("profile.manage.title");
  }
  if (elements.profileModalDescription) {
    elements.profileModalDescription.textContent = translate(
      "profile.manage.description"
    );
  }
  if (elements.profileModalName) {
    elements.profileModalName.placeholder = translate(
      "profile.manage.namePlaceholder"
    );
  }
  if (elements.profileModalPassword) {
    elements.profileModalPassword.placeholder = translate(
      "profile.manage.passwordPlaceholder"
    );
  }
  if (elements.profileModalConfirm) {
    elements.profileModalConfirm.placeholder = translate(
      "profile.manage.confirmPlaceholder"
    );
  }
  if (elements.profileModalSave) {
    elements.profileModalSave.textContent = translate("profile.manage.save");
  }
  if (elements.profileModalCancel) {
    elements.profileModalCancel.textContent = translate("profile.manage.cancel");
  }

  if (elements.serviceAssignmentSubtitle) {
    elements.serviceAssignmentSubtitle.textContent = translate(
      "serviceAssignment.subtitle"
    );
  }
  if (elements.serviceAssignmentStatusLabel) {
    elements.serviceAssignmentStatusLabel.textContent = translate(
      "serviceAssignment.statusLabel"
    );
  }
  if (elements.serviceAssignmentCancel) {
    elements.serviceAssignmentCancel.textContent = translate(
      "serviceAssignment.cancel"
    );
  }
  if (elements.serviceAssignmentSave) {
    elements.serviceAssignmentSave.textContent = translate(
      "serviceAssignment.save"
    );
  }
  if (elements.serviceAssignmentEmpty) {
    elements.serviceAssignmentEmpty.textContent = translate(
      "serviceAssignment.empty"
    );
  }
  if (elements.serviceAssignmentClose) {
    elements.serviceAssignmentClose.setAttribute(
      "aria-label",
      translate("serviceAssignment.close")
    );
  }

  updateServiceSyncUI();

  if (
    elements.serviceAssignmentModal &&
    !elements.serviceAssignmentModal.hidden &&
    state.activeServiceModalEntry
  ) {
    populateServiceAssignmentModal(state.activeServiceModalEntry, {
      preserveSelection: true,
    });
  }

  ensureServiceManagerFilterOptions();
  if (state.activeDetailEntry) {
    renderServiceControls(state.activeDetailEntry);
  }

  if (elements.parentChoiceTitle) {
    elements.parentChoiceTitle.textContent = translate("parents.choice.title");
  }
  if (elements.parentChoiceQuestion) {
    elements.parentChoiceQuestion.textContent = translate(
      "parents.choice.question",
      { child: "" }
    );
  }
  if (elements.parentChoiceFather) {
    elements.parentChoiceFather.textContent = translate("parents.choice.father");
  }
  if (elements.parentChoiceMother) {
    elements.parentChoiceMother.textContent = translate("parents.choice.mother");
  }
  if (elements.parentChoiceCancel) {
    elements.parentChoiceCancel.textContent = translate(
      "parents.choice.cancel"
    );
  }
  if (elements.parentChoiceClose) {
    elements.parentChoiceClose.setAttribute(
      "aria-label",
      translate("modal.close")
    );
  }

  if (elements.languageToggle) {
    elements.languageToggle.setAttribute(
      "aria-label",
      translate("language.toggleAria")
    );
  }
  if (elements.closeModal) {
    elements.closeModal.setAttribute("aria-label", translate("modal.close"));
  }
  updateLanguageToggleLabel();
  renderLanguageMenu();

  if (state.assistant.questionsRendered) {
    renderAssistantQuestions();
  }

  if (!isCategoryPage) {
    document.title = getAppTitle();
  }
}

function setLanguage(language, { persist = true } = {}) {
  const valid = getValidLanguage(language) ?? getDefaultLanguage();
  if (state.language === valid) {
    return;
  }

  state.language = valid;
  updateCollatorForLanguage(valid);

  if (persist) {
    storeLanguage(valid);
  }

  applyLanguage();
  buildSuggestions();
  updateDashboard();
  updateUserProfileUI();
  if (elements.categoryCards || elements.categoryTitle) {
    renderCategory(state.activeCategory);
  }
  applyAccessRestrictions();
  updateBirthdays();
  updateLastUpdated();
}

function initializeLanguage() {
  const stored = getStoredLanguage();
  const initial = stored ?? getDefaultLanguage();
  state.language = initial;
  updateCollatorForLanguage(initial);
  applyLanguage({ reapplyStatus: false });
  setupLanguageSwitcher();
  updateUserProfileUI();
}

function normalizeColumnLabel(label) {
  if (label == null) return "";
  return normalizeString(label)
    .replace(/[:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xorCipher(inputBytes, keyBytes) {
  return inputBytes.map((byte, index) => byte ^ keyBytes[index % keyBytes.length]);
}

function hexToBytes(hexString) {
  if (!hexString || typeof hexString !== "string") return [];
  const matches = hexString.match(/.{1,2}/g);
  if (!matches) return [];
  return matches.map((chunk) => parseInt(chunk, 16));
}

function bytesToString(bytes) {
  return String.fromCharCode(...bytes);
}

function stringToBytes(text) {
  return Array.from(text).map((char) => char.charCodeAt(0));
}

function decryptNameSecret(encrypted) {
  if (!encrypted) return "";
  const keyBytes = stringToBytes(NAME_SECRET);
  const cipherBytes = hexToBytes(encrypted);
  if (!cipherBytes.length || !keyBytes.length) {
    return "";
  }
  const plainBytes = xorCipher(cipherBytes, keyBytes);
  return bytesToString(plainBytes);
}

function encryptNameSecret(plain) {
  if (!plain) return "";
  const keyBytes = stringToBytes(NAME_SECRET);
  const plainBytes = stringToBytes(plain);
  const cipherBytes = xorCipher(plainBytes, keyBytes);
  return cipherBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getStoredAccess() {
  try {
    const stored = sessionStorage.getItem(ACCESS_SESSION_KEY);
    if (!stored) {
      return null;
    }

    if (Object.values(ACCESS_ROLES).includes(stored)) {
      return { role: stored, userSecret: null };
    }

    const parsed = JSON.parse(stored);
    if (parsed && Object.values(ACCESS_ROLES).includes(parsed.role)) {
      const userSecret =
        typeof parsed.userSecret === "string" && parsed.userSecret.trim()
          ? parsed.userSecret.trim()
          : null;

      if (userSecret) {
        return { role: parsed.role, userSecret };
      }

      const legacyUserName =
        typeof parsed.userName === "string" && parsed.userName.trim()
          ? parsed.userName.trim()
          : null;

      if (legacyUserName) {
        return {
          role: parsed.role,
          userSecret: encryptNameSecret(legacyUserName),
        };
      }

      return { role: parsed.role, userSecret: null };
    }
  } catch (error) {
    console.warn("Unable to read access session:", error);
  }
  return null;
}

function storeAccess(role, userSecret) {
  try {
    const payload = JSON.stringify({ role, userSecret: userSecret ?? null });
    sessionStorage.setItem(ACCESS_SESSION_KEY, payload);
  } catch (error) {
    console.warn("Unable to persist access session:", error);
  }
}

function clearStoredAccess() {
  try {
    sessionStorage.removeItem(ACCESS_SESSION_KEY);
  } catch (error) {
    console.warn("Unable to clear access session:", error);
  }
}

function cloneRoleCredentials(source = BASE_ROLE_CREDENTIALS) {
  const clone = {};
  Object.entries(source).forEach(([role, credentials]) => {
    clone[role] = { ...(credentials ?? {}) };
  });
  return clone;
}

function loadRoleCredentials() {
  state.roleCredentials = cloneRoleCredentials();
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const stored = localStorage.getItem(ROLE_CREDENTIALS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return;
    }

    Object.entries(parsed).forEach(([role, credentials]) => {
      if (!role || typeof credentials !== "object" || credentials === null) {
        return;
      }
      if (!state.roleCredentials[role]) {
        state.roleCredentials[role] = {};
      }
      Object.entries(credentials).forEach(([hash, secret]) => {
        if (typeof hash === "string" && hash && typeof secret === "string") {
          state.roleCredentials[role][hash] = secret;
        }
      });
    });
  } catch (error) {
    console.warn("Failed to load role credentials:", error);
  }
}

function persistRoleCredentials() {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const payload = {};
    Object.entries(state.roleCredentials || {}).forEach(([role, credentials]) => {
      if (!role || !credentials) {
        return;
      }
      payload[role] = { ...credentials };
    });
    localStorage.setItem(ROLE_CREDENTIALS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist role credentials:", error);
  }
}

function getRoleCredentials(role) {
  if (!role) {
    return {};
  }
  if (!state.roleCredentials) {
    state.roleCredentials = cloneRoleCredentials();
  }
  if (!state.roleCredentials[role]) {
    state.roleCredentials[role] = {};
  }
  return state.roleCredentials[role];
}

function replaceRoleCredential(role, oldHash, newHash, secret) {
  if (!role || !secret || !newHash) {
    return;
  }
  const credentials = getRoleCredentials(role);
  if (oldHash && oldHash !== newHash) {
    delete credentials[oldHash];
  }
  credentials[newHash] = secret;
  persistRoleCredentials();
}

function addRoleCredential(role, hash, secret) {
  if (!role || !hash || !secret) {
    return false;
  }
  const credentials = getRoleCredentials(role);
  if (credentials[hash]) {
    return false;
  }
  credentials[hash] = secret;
  persistRoleCredentials();
  return true;
}

function removeRoleCredential(role, hash) {
  if (!role || !hash) {
    return;
  }
  const credentials = getRoleCredentials(role);
  if (credentials[hash]) {
    delete credentials[hash];
    persistRoleCredentials();
  }
}

function findCredentialHashForSecret(role, secret) {
  if (!role || !secret) {
    return null;
  }
  const credentials = getRoleCredentials(role);
  const entry = Object.entries(credentials).find(([, value]) => value === secret);
  return entry ? entry[0] : null;
}

async function hashPassword(password) {
  const normalized = password.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (window.crypto?.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      return bufferToHex(new Uint8Array(digest));
    } catch (error) {
      console.warn("Failed to use crypto.subtle, falling back to custom SHA-256:", error);
    }
  }

  return sha256Fallback(normalized);
}

function bufferToHex(buffer) {
  return Array.from(buffer)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

// Adaptado de uma implementação compacta de SHA-256 em JavaScript puro
function sha256Fallback(ascii) {
  const rightRotate = (value, amount) =>
    (value >>> amount) | (value << (32 - amount));

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";

  const words = [];
  const asciiBitLength = ascii.length * 8;

  const hash = (sha256Fallback.h = sha256Fallback.h || []);
  const k = (sha256Fallback.k = sha256Fallback.k || []);
  let primeCounter = k.length;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = mathPow(candidate, 0.5) * maxWord | 0;
      k[primeCounter] = mathPow(candidate, 1 / 3) * maxWord | 0;
      primeCounter += 1;
    }
  }

  ascii += "\u0080";
  while ((ascii.length % 64) !== 56) {
    ascii += "\u0000";
  }

  for (let i = 0; i < ascii.length; i += 1) {
    const j = ascii.charCodeAt(i);
    const shift = (i % 4) * 8;
    words[i >> 2] = words[i >> 2] | (j << (24 - shift));
  }

  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash.pop();
      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j + 1; j -= 1) {
      const shift = j * 8;
      const value = (hash[i] >> shift) & 0xff;
      result += value.toString(16).padStart(2, "0");
    }
  }

  return result;
}

function isCategoryAllowed(categoryId) {
  if (!state.accessRole) {
    return false;
  }

  if (hasFullAccessRole(state.accessRole)) {
    return true;
  }

  if (state.accessRole === ACCESS_ROLES.CAPTAIN) {
    return CAPTAIN_ALLOWED_CATEGORIES.includes(categoryId);
  }

  return false;
}

function ensureAccessibleCategory(categoryId) {
  if (!state.accessRole) {
    return categoryId;
  }

  if (state.accessRole === ACCESS_ROLES.CAPTAIN) {
    if (CAPTAIN_ALLOWED_CATEGORIES.includes(categoryId)) {
      return categoryId;
    }
    return CAPTAIN_ALLOWED_CATEGORIES[0];
  }

  return categoryId;
}

function getAccessibleEntries() {
  if (!state.accessRole) {
    return [];
  }

  if (state.accessRole === ACCESS_ROLES.CAPTAIN) {
    return state.enrichedRecords.filter((entry) =>
      CATEGORY_BY_ID.teens.filter(entry)
    );
  }

  return state.enrichedRecords;
}

function getAccessibleRecords() {
  return getAccessibleEntries().map((entry) => entry.record);
}

function findEntryByRecord(record) {
  return state.enrichedRecords.find((entry) => entry.record === record) ?? null;
}

function findEntryByServiceKey(serviceKey) {
  if (!serviceKey || !Array.isArray(state.enrichedRecords)) {
    return null;
  }

  return (
    state.enrichedRecords.find((entry) => entry.serviceKey === serviceKey) ?? null
  );
}

function canAccessRecord(record) {
  if (!state.accessRole) {
    return false;
  }

  if (hasFullAccessRole(state.accessRole)) {
    return true;
  }

  const entry = findEntryByRecord(record);
  if (!entry) {
    return false;
  }

  return CATEGORY_BY_ID.teens.filter(entry);
}

function showAccessRestrictionMessage() {
  if (state.accessRole === ACCESS_ROLES.CAPTAIN) {
    setStatusFromKey("access.restrictionCaptain");
  }
}

function applyAccessRestrictions() {
  document.body.dataset.accessRole = state.accessRole ?? "";

  elements.summaryCards.forEach((card) => {
    const categoryId = card.dataset.category;
    if (!categoryId) return;

    const allowed = isCategoryAllowed(categoryId);
    const restricted = !allowed;

    card.hidden = false;
    card.classList.toggle("restricted", !allowed);
    const hintElement = card.querySelector(".card-hint");
    if (hintElement) {
      if (restricted && state.accessRole === ACCESS_ROLES.CAPTAIN) {
        hintElement.textContent = translate("cards.restrictedHint");
      } else {
        hintElement.textContent = translate("cards.hint");
      }
    }
    if (restricted) {
      card.setAttribute("aria-disabled", "true");
      card.tabIndex = -1;
    } else {
      card.removeAttribute("aria-disabled");
      card.tabIndex = 0;
    }
  });

  elements.categoryLinks.forEach((link) => {
    const categoryId = link.dataset.categoryLink;
    if (!categoryId) return;
    const listItem = link.closest("li");
    const hideLink =
      state.accessRole === ACCESS_ROLES.CAPTAIN &&
      !CAPTAIN_ALLOWED_CATEGORIES.includes(categoryId);
    if (hideLink) {
      if (listItem) listItem.hidden = true;
      else link.hidden = true;
    } else {
      if (listItem) listItem.hidden = false;
      else link.hidden = false;
    }
    const allowed = isCategoryAllowed(categoryId);
    link.classList.toggle("restricted", !allowed);
    if (!allowed) {
      link.setAttribute("aria-disabled", "true");
      link.tabIndex = -1;
    } else {
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
    }
  });

  ensureActiveServiceFilterValid(state.accessibleServiceSummary);

  if (elements.overviewTitle && elements.overviewDescription) {
    if (state.accessRole === ACCESS_ROLES.CAPTAIN) {
      elements.overviewTitle.textContent = translate("overview.captainTitle");
      elements.overviewDescription.textContent = translate(
        "overview.captainDescription"
      );
    } else {
      elements.overviewTitle.textContent = translate("overview.title");
      elements.overviewDescription.textContent = translate(
        "overview.description"
      );
    }
  }

  if (isServiceManagerPage) {
    renderServiceManager();
  }

  updateUserProfileUI();
  updateBirthdays();
  redirectToServiceManagerIfNeeded();
}

function redirectToServiceManagerIfNeeded() {
  if (state.accessRole !== ACCESS_ROLES.SERVICES) {
    return;
  }
  if (!isDashboardPage) {
    return;
  }

  try {
    window.location.replace("services.html");
  } catch (error) {
    window.location.assign("services.html");
  }
}

function isUserMenuOpen() {
  return elements.userProfile?.classList.contains("open");
}

function isAdminUser() {
  const name = (state.activeUserName || "").toString().trim().toLowerCase();
  return name === "jpfachina";
}

function setUserMenuOpen(open) {
  if (!elements.userProfile || !elements.userMenu || !elements.userMenuToggle) {
    return;
  }

  if (open && elements.userProfile.hidden) {
    open = false;
  }

  elements.userProfile.classList.toggle("open", open);
  elements.userMenuToggle.setAttribute("aria-expanded", open ? "true" : "false");

  if (open) {
    elements.userMenu.removeAttribute("hidden");
  } else {
    elements.userMenu.setAttribute("hidden", "");
  }
}

function closeUserMenu() {
  setUserMenuOpen(false);
}

function toggleUserMenu() {
  setUserMenuOpen(!isUserMenuOpen());
}

function updateUserProfileUI() {
  if (!elements.userProfile) return;

  const { accessRole } = state;
  if (!accessRole || !ACCESS_METADATA[accessRole]) {
    elements.userProfile.hidden = true;
    if (elements.userProfileLabel) {
      elements.userProfileLabel.textContent = translate("profile.label");
    }
    if (elements.userMenuRole) {
      elements.userMenuRole.textContent = "—";
    }
    if (elements.userMenuDetail) {
      elements.userMenuDetail.textContent = "";
    }
    if (elements.manageServices) {
      elements.manageServices.hidden = true;
      elements.manageServices.setAttribute("aria-hidden", "true");
    }
    if (elements.changePassword) {
      elements.changePassword.hidden = true;
      elements.changePassword.setAttribute("aria-hidden", "true");
    }
    if (elements.manageProfiles) {
      elements.manageProfiles.hidden = true;
      elements.manageProfiles.setAttribute("aria-hidden", "true");
    }
    closeUserMenu();
    return;
  }

  const roleLabel = getRoleLabel(accessRole);
  const trimmedName =
    typeof state.activeUserName === "string" ? state.activeUserName.trim() : "";
  const displayName = trimmedName || roleLabel;
  elements.userProfile.hidden = false;
  if (elements.userProfileLabel) {
    elements.userProfileLabel.textContent = displayName;
  }
  if (elements.userMenuRole) {
    elements.userMenuRole.textContent = displayName;
  }
  if (elements.userMenuDetail) {
    elements.userMenuDetail.textContent = getRoleDescription(accessRole);
  }
  if (elements.manageServices) {
    const isServiceManager = accessRole === ACCESS_ROLES.SERVICES;
    elements.manageServices.hidden = !isServiceManager;
    if (isServiceManager) {
      elements.manageServices.removeAttribute("aria-hidden");
    } else {
      elements.manageServices.setAttribute("aria-hidden", "true");
    }
  }
  if (elements.changePassword) {
    elements.changePassword.textContent = translate(
      "profile.password.changeAction"
    );
  }
  if (elements.manageProfiles) {
    elements.manageProfiles.textContent = translate("profile.manage.open");
  }
  if (elements.changePassword) {
    elements.changePassword.hidden = false;
    elements.changePassword.removeAttribute("aria-hidden");
  }
  if (elements.manageProfiles) {
    const isAdmin = isAdminUser();
    elements.manageProfiles.hidden = !isAdmin;
    if (isAdmin) {
      elements.manageProfiles.removeAttribute("aria-hidden");
    } else {
      elements.manageProfiles.setAttribute("aria-hidden", "true");
    }
  }
}

function isElementOpen(element) {
  if (!element) {
    return false;
  }
  if (typeof element.hidden === "boolean") {
    if (element.hidden) {
      return false;
    }
  }
  const ariaHidden = element.getAttribute?.("aria-hidden");
  return ariaHidden === "false";
}

function refreshBodyScrollLock() {
  const detailOpen = isElementOpen(elements.modal);
  const assignmentOpen = Boolean(
    elements.serviceAssignmentModal && !elements.serviceAssignmentModal.hidden
  );
  const parentOpen = Boolean(elements.parentChoice && !elements.parentChoice.hidden);
  const passwordOpen = Boolean(elements.passwordModal && !elements.passwordModal.hidden);
  const profileOpen = Boolean(elements.profileModal && !elements.profileModal.hidden);
  const assistantOpen = Boolean(
    elements.assistantPanel && !elements.assistantPanel.hidden
  );
  if (detailOpen || assignmentOpen || parentOpen || passwordOpen || profileOpen) {
    document.body.style.overflow = "hidden";
  } else if (!assistantOpen) {
    document.body.style.overflow = "";
  }
}

function handleSwitchUser() {
  closeUserMenu();
  state.accessRole = null;
  state.pendingAccessRole = null;
  state.activeUserName = null;
  state.activeUserSecret = null;
  clearStoredAccess();
  applyAccessRestrictions();
  updateDashboard();
  if (isCategoryPage) {
    state.activeCategory = ensureAccessibleCategory(state.activeCategory);
    renderCategory(state.activeCategory);
  }
  buildSuggestions();
  setStatusFromKey("access.requireSelection");
  showAccessModal();
}

function handleManageServicesNavigation() {
  closeUserMenu();
  if (!canManageServices()) {
    return;
  }

  if (!isServiceManagerPage) {
    window.location.assign("services.html");
  }
}

function resetPasswordModal() {
  if (elements.passwordModalNew) {
    elements.passwordModalNew.value = "";
  }
  if (elements.passwordModalConfirm) {
    elements.passwordModalConfirm.value = "";
  }
  if (elements.passwordModalFeedback) {
    elements.passwordModalFeedback.textContent = "";
  }
}

function openPasswordModal() {
  if (!elements.passwordModal) {
    return;
  }
  if (!state.accessRole || !state.activeUserSecret) {
    setStatusFromKey("profile.password.unavailable", {}, true);
    return;
  }

  closeUserMenu();
  resetPasswordModal();
  elements.passwordModal.hidden = false;
  elements.passwordModal.setAttribute("aria-hidden", "false");
  refreshBodyScrollLock();

  setTimeout(() => {
    if (elements.passwordModalNew && typeof elements.passwordModalNew.focus === "function") {
      try {
        elements.passwordModalNew.focus();
      } catch (error) {
        // ignore focus errors
      }
    }
  }, 0);
}

function closePasswordModal() {
  if (!elements.passwordModal) {
    return;
  }
  if (elements.passwordModal.hidden) {
    return;
  }
  elements.passwordModal.hidden = true;
  elements.passwordModal.setAttribute("aria-hidden", "true");
  refreshBodyScrollLock();
  resetPasswordModal();
}

function showPasswordFeedback(key, isError = true) {
  if (!elements.passwordModalFeedback) {
    return;
  }
  elements.passwordModalFeedback.textContent = key
    ? translate(key)
    : "";
  elements.passwordModalFeedback.classList.toggle("error", Boolean(isError));
}

async function handlePasswordFormSubmit(event) {
  event.preventDefault();
  if (!state.accessRole || !state.activeUserSecret) {
    showPasswordFeedback("profile.password.unavailable");
    return;
  }

  const newPassword = elements.passwordModalNew?.value ?? "";
  const confirmPassword = elements.passwordModalConfirm?.value ?? "";

  if (!newPassword.trim()) {
    showPasswordFeedback("profile.password.required");
    elements.passwordModalNew?.focus();
    return;
  }

  if (newPassword.trim() !== confirmPassword.trim()) {
    showPasswordFeedback("profile.password.mismatch");
    elements.passwordModalConfirm?.focus();
    return;
  }

  const hashed = await hashPassword(newPassword);
  if (!hashed) {
    showPasswordFeedback("profile.password.invalid");
    return;
  }

  const role = state.accessRole;
  const secret = state.activeUserSecret;
  const oldHash = findCredentialHashForSecret(role, secret);
  replaceRoleCredential(role, oldHash, hashed, secret);
  closePasswordModal();
  setStatusFromKey("profile.password.success");
}

function resetProfileModal() {
  if (elements.profileModalName) {
    elements.profileModalName.value = "";
  }
  if (elements.profileModalRole) {
    elements.profileModalRole.value = "";
  }
  if (elements.profileModalPassword) {
    elements.profileModalPassword.value = "";
  }
  if (elements.profileModalConfirm) {
    elements.profileModalConfirm.value = "";
  }
  if (elements.profileModalFeedback) {
    elements.profileModalFeedback.textContent = "";
  }
}

function renderProfileRoleOptions() {
  if (!elements.profileModalRole) {
    return;
  }
  const select = elements.profileModalRole;
  const previous = select.value;
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = translate("profile.manage.rolePlaceholder");
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  Object.entries(ACCESS_METADATA).forEach(([role, metadata]) => {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = translate(metadata.labelKey);
    select.appendChild(option);
  });

  if (previous) {
    select.value = previous;
  }
}

function openProfileModal() {
  if (!isAdminUser()) {
    setStatusFromKey("profile.manage.restricted", {}, true);
    return;
  }
  if (!elements.profileModal) {
    return;
  }

  closeUserMenu();
  renderProfileRoleOptions();
  resetProfileModal();
  elements.profileModal.hidden = false;
  elements.profileModal.setAttribute("aria-hidden", "false");
  refreshBodyScrollLock();

  setTimeout(() => {
    if (elements.profileModalName && typeof elements.profileModalName.focus === "function") {
      try {
        elements.profileModalName.focus();
      } catch (error) {
        // ignore
      }
    }
  }, 0);
}

function closeProfileModal() {
  if (!elements.profileModal) {
    return;
  }
  if (elements.profileModal.hidden) {
    return;
  }
  elements.profileModal.hidden = true;
  elements.profileModal.setAttribute("aria-hidden", "true");
  refreshBodyScrollLock();
  resetProfileModal();
}

function showProfileFeedback(key) {
  if (!elements.profileModalFeedback) {
    return;
  }
  elements.profileModalFeedback.textContent = key ? translate(key) : "";
  elements.profileModalFeedback.classList.toggle("error", Boolean(key));
}

async function handleProfileFormSubmit(event) {
  event.preventDefault();
  if (!isAdminUser()) {
    showProfileFeedback("profile.manage.restricted");
    return;
  }

  const nameValue = elements.profileModalName?.value ?? "";
  const roleValue = elements.profileModalRole?.value ?? "";
  const passwordValue = elements.profileModalPassword?.value ?? "";
  const confirmValue = elements.profileModalConfirm?.value ?? "";

  const trimmedName = nameValue.trim();
  if (!trimmedName) {
    showProfileFeedback("profile.manage.nameRequired");
    elements.profileModalName?.focus();
    return;
  }

  if (!roleValue) {
    showProfileFeedback("profile.manage.roleRequired");
    elements.profileModalRole?.focus();
    return;
  }

  if (!passwordValue.trim()) {
    showProfileFeedback("profile.manage.passwordRequired");
    elements.profileModalPassword?.focus();
    return;
  }

  if (passwordValue.trim() !== confirmValue.trim()) {
    showProfileFeedback("profile.manage.passwordMismatch");
    elements.profileModalConfirm?.focus();
    return;
  }

  const hashed = await hashPassword(passwordValue);
  if (!hashed) {
    showProfileFeedback("profile.manage.passwordInvalid");
    return;
  }

  const secret = encryptNameSecret(trimmedName);
  const added = addRoleCredential(roleValue, hashed, secret);
  if (!added) {
    showProfileFeedback("profile.manage.passwordDuplicate");
    return;
  }

  closeProfileModal();
  setStatusFromKey("profile.manage.success", {
    name: trimmedName,
    role: translate(ACCESS_METADATA[roleValue]?.labelKey ?? ""),
  });
}

function handleUserProfileOutsideClick(event) {
  if (!elements.userProfile || elements.userProfile.hidden) {
    return;
  }

  if (elements.userProfile.contains(event.target)) {
    return;
  }

  closeUserMenu();
}

function setupUserProfileEvents() {
  if (elements.userMenuToggle) {
    elements.userMenuToggle.addEventListener("click", () => {
      if (elements.userProfile?.hidden) return;
      toggleUserMenu();
    });
  }

  if (elements.switchUser) {
    elements.switchUser.addEventListener("click", handleSwitchUser);
  }

  if (elements.manageServices) {
    elements.manageServices.addEventListener(
      "click",
      handleManageServicesNavigation
    );
  }

  if (elements.changePassword) {
    elements.changePassword.addEventListener("click", openPasswordModal);
  }

  if (elements.manageProfiles) {
    elements.manageProfiles.addEventListener("click", openProfileModal);
  }

  document.addEventListener("click", handleUserProfileOutsideClick);
}

function resetAccessModal() {
  state.pendingAccessRole = null;
  if (elements.accessError) {
    elements.accessError.textContent = "";
  }
  if (elements.accessPassword) {
    elements.accessPassword.value = "";
  }
  updateAccessSelectedLabel("");
  if (elements.accessOptions) {
    elements.accessOptions.hidden = false;
  }
  if (elements.accessForm) {
    elements.accessForm.hidden = true;
  }
}

function updateAccessSelectedLabel(roleLabel = "") {
  if (!elements.accessSelectedText) {
    if (elements.accessRoleLabel) {
      elements.accessRoleLabel.textContent = roleLabel;
    }
    return;
  }

  const prefix = translate("access.selectedRolePrefix");
  const textNode = Array.from(elements.accessSelectedText.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE
  );

  const textContent = roleLabel ? `${prefix} ` : prefix;
  if (textNode) {
    textNode.textContent = textContent;
  } else {
    elements.accessSelectedText.insertBefore(
      document.createTextNode(textContent),
      elements.accessSelectedText.firstChild || null
    );
  }

  if (elements.accessRoleLabel) {
    elements.accessRoleLabel.textContent = roleLabel;
  }
}

function showAccessModal() {
  if (!elements.accessModal) return;
  resetAccessModal();
  elements.accessModal.setAttribute("aria-hidden", "false");
  elements.accessModal.classList.add("visible");
  document.body.classList.add("access-locked");
  const firstButton = elements.accessOptionButtons?.[0];
  firstButton?.focus();
}

function hideAccessModal() {
  if (!elements.accessModal) return;
  elements.accessModal.setAttribute("aria-hidden", "true");
  elements.accessModal.classList.remove("visible");
  document.body.classList.remove("access-locked");
}

function selectAccessRole(role) {
  if (!ACCESS_METADATA[role]) {
    return;
  }
  state.pendingAccessRole = role;
  const roleLabel = getRoleLabel(role);
  updateAccessSelectedLabel(roleLabel);
  if (elements.accessOptions) {
    elements.accessOptions.hidden = true;
  }
  if (elements.accessForm) {
    elements.accessForm.hidden = false;
  }
  if (elements.accessPassword) {
    elements.accessPassword.value = "";
    elements.accessPassword.focus();
  }
  if (elements.accessError) {
    elements.accessError.textContent = "";
  }
}

async function handleAccessSubmit(event) {
  event.preventDefault();
  const role = state.pendingAccessRole;
  if (!role) {
    return;
  }

  if (!elements.accessPassword) {
    return;
  }

  const password = elements.accessPassword.value;
  if (!password.trim()) {
    if (elements.accessError) {
      elements.accessError.textContent = translate("access.errorRequired");
    }
    return;
  }

  const hashed = await hashPassword(password);
  const allowedUsers = getRoleCredentials(role);
  const userSecret = allowedUsers[hashed];
  const userName = decryptNameSecret(userSecret);

  if (!userSecret || !userName) {
    if (elements.accessError) {
      elements.accessError.textContent = translate("access.errorInvalid");
    }
    elements.accessPassword.value = "";
    elements.accessPassword.focus();
    return;
  }

  state.accessRole = role;
  state.pendingAccessRole = null;
  state.activeUserName = userName;
  state.activeUserSecret = userSecret;
  storeAccess(role, userSecret);
  hideAccessModal();
  applyAccessRestrictions();
  buildSuggestions();
  if (typeof state.accessResolver === "function") {
    const resolver = state.accessResolver;
    state.accessResolver = null;
    resolver();
  }
}

function setupAccessControlEvents() {
  elements.accessOptionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.accessRole;
      selectAccessRole(role);
    });
  });

  if (elements.accessBack) {
    elements.accessBack.addEventListener("click", () => {
      resetAccessModal();
      const firstButton = elements.accessOptionButtons?.[0];
      firstButton?.focus();
    });
  }

  if (elements.accessForm) {
    elements.accessForm.addEventListener("submit", handleAccessSubmit);
  }
}

async function initializeAccessControl() {
  const storedAccess = getStoredAccess();
  if (storedAccess) {
    state.accessRole = storedAccess.role;
    state.activeUserSecret = storedAccess.userSecret ?? null;
    state.activeUserName = storedAccess.userSecret
      ? decryptNameSecret(storedAccess.userSecret)
      : null;
    if (state.accessRole && state.activeUserSecret) {
      storeAccess(state.accessRole, state.activeUserSecret);
    }
    applyAccessRestrictions();
    return;
  }

  if (!elements.accessModal) {
    state.accessRole = ACCESS_ROLES.RESPONSIBLE;
    applyAccessRestrictions();
    return;
  }

  await new Promise((resolve) => {
    state.accessResolver = resolve;
    showAccessModal();
  });
}

async function fetchSheetData() {
  setStatusFromKey("status.loading");
  try {
    let careNetworkPromise;
    if (CARE_NETWORK_GVIZ_URL) {
      careNetworkPromise = fetchGvizTable(CARE_NETWORK_GVIZ_URL);
    } else if (CARE_NETWORK_HTML_URL) {
      careNetworkPromise = fetchCareNetworkHtmlTable(CARE_NETWORK_HTML_URL);
    } else {
      careNetworkPromise = Promise.resolve({ columns: [], records: [] });
    }

    const [
      primaryResult,
      supplementalResult,
      serviceResult,
      careNetworkResult,
      parentResult,
    ] =
      await Promise.allSettled([
        fetchGvizTable(GVIZ_URL),
        fetchGvizTable(SUPPLEMENTAL_GVIZ_URL),
        fetchServiceSheetTable(),
        careNetworkPromise,
        fetchParentSheetTable(),
      ]);

    if (primaryResult.status !== "fulfilled") {
      throw (
        primaryResult.reason ?? new Error(translate("errors.primaryLoad"))
      );
    }

    const { records, columns } = primaryResult.value;

    state.records = records;
    state.columns = columns;
    state.nameColumn = detectColumn(columns, records, [
      "nome completo do irmao",
      "nome do irmao",
      "nome",
      "name",
    ]);
    state.birthColumn = detectColumn(columns, records, [
      "data de nascimento",
      "nascimento",
      "data de aniversario",
      "aniversario",
      "aniversário",
    ]);
    state.phoneColumn = detectColumn(columns, records, [
      "telefone",
      "telefone celular",
      "telefone de contato",
      "celular",
      "whatsapp",
      "contato",
    ]);

    if (supplementalResult.status === "fulfilled") {
      const { records: supplementalRecords, columns: supplementalColumns } =
        supplementalResult.value;
      state.supplementalRecords = supplementalRecords;
      state.supplementalColumns = supplementalColumns;
      state.supplementalNameColumn = detectColumn(
        supplementalColumns,
        supplementalRecords,
        [
          "nome do adolescente",
          "nome do adolescente(a)",
          "nome adolescente",
          "nome",
        ]
      );
      state.supplementalBirthColumn = detectColumn(
        supplementalColumns,
        supplementalRecords,
        [
          "data de aniversario do adolescente",
          "data de aniversário do adolescente",
          "data de nascimento",
          "nascimento",
        ]
      );
      state.supplementalPhoneColumn = detectColumn(
        supplementalColumns,
        supplementalRecords,
        [
          "telefone do adolescente",
          "telefone adolescente",
          "telefone",
          "contato",
        ]
      );
      state.supplementalEntries = buildSupplementalEntries(
        supplementalRecords,
        state.supplementalNameColumn,
        state.supplementalBirthColumn,
        state.supplementalPhoneColumn
      );
      state.supplementalIndex = buildSupplementalIndex(state.supplementalEntries);
    } else {
      console.warn(
        "Unable to load the supplemental spreadsheet:",
        supplementalResult.reason
      );
      state.supplementalRecords = [];
      state.supplementalColumns = [];
      state.supplementalNameColumn = null;
      state.supplementalBirthColumn = null;
      state.supplementalPhoneColumn = null;
      state.supplementalEntries = [];
      state.supplementalIndex = new Map();
    }

    if (serviceResult.status === "fulfilled") {
      const { records: serviceRecords, columns: serviceColumns } =
        serviceResult.value;
      state.serviceSheet.columns = serviceColumns;
      state.serviceSheet.records = serviceRecords;
      state.serviceSheet.config = {
        ...state.serviceSheet.config,
        csvUrl: SERVICE_CSV_URL,
      };
      applyRemoteServiceAssignments(serviceRecords, serviceColumns);
    } else {
      console.warn(
        "Unable to load the services tab:",
        serviceResult.reason
      );
      state.serviceSheet.columns = [];
      state.serviceSheet.records = [];
      state.serviceSheet.config = {
        ...state.serviceSheet.config,
        csvUrl: SERVICE_CSV_URL,
      };
    }

    if (careNetworkResult.status === "fulfilled") {
      const { records: careRecords, columns: careColumns } =
        careNetworkResult.value ?? { records: [], columns: [] };
      applyCareNetworkSheet(careRecords, careColumns);
    } else {
      console.warn(
        "Unable to load the care network table:",
        careNetworkResult.reason
      );
      resetCareNetworkState();
    }

    if (parentResult.status === "fulfilled") {
      const { records: parentRecords, columns: parentColumns } =
        parentResult.value ?? { records: [], columns: [] };
      state.parentSheet.columns = parentColumns;
      state.parentSheet.records = parentRecords;
      state.parentSheet.csvUrl = PARENTS_CSV_URL;
      state.parentEntries = buildParentEntries(parentRecords);
      state.parentSummary = summarizeParentEntries(state.parentEntries);
    } else {
      console.warn(
        "Unable to load the parents tab:",
        parentResult.reason
      );
      state.parentSheet.columns = [];
      state.parentSheet.records = [];
      state.parentSheet.csvUrl = PARENTS_CSV_URL;
      state.parentEntries = [];
      state.parentSummary = { parents: 0, families: 0 };
    }

    state.enrichedRecords = buildEnrichedRecords(records);
    applyServiceAssignmentsToEntries();
    applyCareNetworkDataToEntries();
    buildSuggestions();

    if (!CATEGORY_BY_ID[state.activeCategory]) {
      state.activeCategory = "total";
    }

    updateDashboard();

    if (elements.categoryCards || elements.categoryTitle) {
      renderCategory(state.activeCategory);
    }

    configureAutoRefresh();
    const missingBirthColumn = !state.birthColumn;
    if (missingBirthColumn) {
      setStatusFromKey("status.noBirthColumn", {}, true);
    } else if (records.length) {
      setStatusFromKey("status.updated");
    } else {
      setStatusFromKey("status.noRecords");
    }
    updateLastUpdated();
  } catch (error) {
    console.error(error);
    setStatusFromKey("status.errorLoad", {}, true);
  }
}

async function fetchGvizTable(url) {
  if (!url) {
    throw new Error("Missing GViz URL");
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      translate("errors.fetchStatus", { status: response.status })
    );
  }

  const text = await response.text();
  const payload = extractGvizPayload(text);
  return parseTable(payload.table);
}

async function fetchServiceSheetTable() {
  if (!SERVICE_CSV_URL) {
    return { columns: [], records: [] };
  }

  const table = await fetchCsvTable(SERVICE_CSV_URL);
  ensureRequiredColumns(table.columns, [
    SERVICE_SHEET_HEADERS.name,
    SERVICE_SHEET_HEADERS.services,
  ]);
  return table;
}

async function fetchParentSheetTable() {
  if (!PARENTS_CSV_URL) {
    return { columns: [], records: [] };
  }

  return fetchCsvTable(PARENTS_CSV_URL);
}

async function fetchCsvTable(url) {
  if (!url) {
    return { columns: [], records: [] };
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(translate("errors.fetchStatus", { status: response.status }));
  }

  const text = await response.text();
  return parseCsvTable(text);
}

function ensureRequiredColumns(columns, requiredColumns) {
  if (!Array.isArray(columns) || !Array.isArray(requiredColumns)) {
    return;
  }

  requiredColumns.forEach((header) => {
    if (!header) {
      return;
    }
    if (!columns.includes(header)) {
      throw new Error(`CSV response is missing required column "${header}".`);
    }
  });
}

function parseCsvRows(text) {
  if (typeof text !== "string") {
    return [];
  }

  const normalized = text.replace(/^\ufeff/, "");
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (char === '"') {
      const nextChar = normalized[index + 1];
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      rows.push(currentRow);
      currentRow = [];
      if (char === "\r" && normalized[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);
  rows.push(currentRow);

  while (
    rows.length &&
    rows[rows.length - 1].every((cell) => String(cell ?? "").trim() === "")
  ) {
    rows.pop();
  }

  return rows.map((row) =>
    row.map((cell) => (cell == null ? "" : String(cell)))
  );
}

function parseCsvTable(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) {
    return { columns: [], records: [] };
  }

  const headerLabels = rows[0].map((cell, index) => {
    const trimmed = String(cell ?? "").trim();
    return trimmed || `Coluna ${index + 1}`;
  });
  const columns = ensureUniqueColumnLabels(headerLabels);

  const records = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const values = columns.map((_, columnIndex) => {
      if (columnIndex < row.length) {
        return row[columnIndex] ?? "";
      }
      return "";
    });

    const hasValue = values.some((value) => String(value ?? "").trim() !== "");
    if (!hasValue) {
      continue;
    }

    const entry = {};
    const raw = {};

    columns.forEach((column, columnIndex) => {
      const value = values[columnIndex] ?? "";
      entry[column] = value;
      raw[column] = value;
    });

    entry.__raw = raw;
    records.push(entry);
  }

  return { columns, records };
}

async function fetchPublishedHtmlTable(url, contextLabel = "table") {
  if (!url) {
    throw new Error(`Missing ${contextLabel}`);
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(translate("errors.fetchStatus", { status: response.status }));
  }

  const html = await response.text();
  return parsePublishedHtmlTable(html);
}

async function fetchCareNetworkHtmlTable(url) {
  return fetchPublishedHtmlTable(url, "care network URL");
}

async function fetchServiceHtmlTable(url) {
  return fetchPublishedHtmlTable(url, "services URL");
}

function parsePublishedHtmlTable(html) {
  if (typeof DOMParser === "undefined") {
    throw new Error(translate("errors.unexpectedResponse"));
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  if (!doc) {
    throw new Error(translate("errors.unexpectedResponse"));
  }

  const tables = Array.from(doc.querySelectorAll("table"));
  if (!tables.length) {
    throw new Error(translate("errors.unexpectedResponse"));
  }

  for (const table of tables) {
    const result = extractHtmlTable(table);
    const hasColumns = Array.isArray(result.columns)
      ? result.columns.length > 0
      : false;
    const hasRecords = Array.isArray(result.records)
      ? result.records.length > 0
      : false;

    if (hasColumns || hasRecords) {
      return result;
    }
  }

  throw new Error(translate("errors.unexpectedResponse"));
}

function extractHtmlTable(table) {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (!rows.length) {
    return { columns: [], records: [] };
  }

  let headerRowIndex = -1;
  let columns = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const cells = Array.from(row.querySelectorAll("th,td"));
    if (!cells.length) {
      continue;
    }

    const labels = cells.map((cell, cellIndex) => {
      const label = sanitizeHeaderLabel(cell?.textContent ?? "");
      return label || `Coluna ${cellIndex + 1}`;
    });

    const hasContent = labels.some((label) => label.trim().length);
    if (!hasContent) {
      continue;
    }

    columns = ensureUniqueColumnLabels(labels);
    headerRowIndex = index;
    break;
  }

  if (headerRowIndex === -1) {
    return { columns: [], records: [] };
  }

  const records = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const cells = Array.from(row.querySelectorAll("td,th"));
    if (!cells.length) {
      continue;
    }

    const values = columns.map((_, cellIndex) => sanitizeHtmlCellValue(cells[cellIndex] ?? null));
    const hasValue = values.some((value) => value);
    if (!hasValue) {
      continue;
    }

    const entry = {};
    const raw = {};
    values.forEach((value, cellIndex) => {
      const columnName = columns[cellIndex];
      entry[columnName] = value;
      raw[columnName] = value;
    });
    entry.__raw = raw;
    records.push(entry);
  }

  return { columns, records };
}

function ensureUniqueColumnLabels(labels) {
  const counts = new Map();
  return labels.map((label, index) => {
    const base = label && label.trim() ? label.trim() : `Coluna ${index + 1}`;
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    if (count > 0) {
      return `${base} (${count + 1})`;
    }
    return base;
  });
}

function sanitizeHeaderLabel(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeHtmlCellValue(cell) {
  if (!cell) {
    return "";
  }

  const text = (cell.textContent ?? "").replace(/\u00a0/g, " ").replace(/\r/g, "");
  const segments = text
    .split(/\n+/)
    .map((segment) => segment.replace(/\s+/g, " ").replace(/,\s*$/g, "").trim())
    .filter(Boolean);

  if (!segments.length) {
    return "";
  }

  const combined = segments.join(", ");
  return combined.replace(/\s+,/g, ", ").replace(/,\s+/g, ", ").trim();
}

function extractGvizPayload(rawText) {
  const match = rawText.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
  if (!match) {
    throw new Error(translate("errors.unexpectedResponse"));
  }
  return JSON.parse(match[1]);
}

function parseTable(table) {
  const safeTable = table ?? {};
  const rawColumns = Array.isArray(safeTable.cols) ? safeTable.cols : [];
  const rawRows = Array.isArray(safeTable.rows) ? safeTable.rows : [];

  let columns = rawColumns.map((col, index) => {
    const label = col.label?.trim();
    if (label) return label;
    return col.id ? String(col.id).trim() : `Coluna ${index + 1}`;
  });

  let records = rawRows
    .map((row) => buildRecord(row, columns))
    .filter((record) =>
      record && columns.some((col) => String(record[col] ?? "").trim().length > 0)
    );

  const genericColumnPattern = /^(coluna|column)\s+\d+$|^col\d+$|^[A-Z]+$/i;
  const columnsLookGeneric = columns.every((column) =>
    genericColumnPattern.test(column) || normalizeString(column).startsWith("coluna ")
  );

  if (columnsLookGeneric && records.length) {
    const headerRow = records[0];
    const renamedColumns = columns.map((column, index) => {
      const candidate = headerRow[column];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
      return column;
    });

    const cleanedRecords = records.slice(1).map((record) =>
      remapRecord(record, columns, renamedColumns)
    );

    columns = renamedColumns;
    records = cleanedRecords;
  }

  return { columns, records };
}

function remapRecord(record, sourceColumns, targetColumns) {
  const remapped = {};
  const remappedRaw = {};

  targetColumns.forEach((targetColumn, index) => {
    const sourceColumn = sourceColumns[index];
    remapped[targetColumn] = record[sourceColumn] ?? "";
    if (record.__raw) {
      remappedRaw[targetColumn] = record.__raw[sourceColumn];
    }
  });

  if (record.__raw) {
    remapped.__raw = remappedRaw;
  }

  return remapped;
}

function buildRecord(row, columns) {
  if (!row) return null;
  const entry = {};
  const raw = {};

  columns.forEach((column, index) => {
    const cell = row.c?.[index];
    const value = cell?.v ?? "";
    const formatted = cell?.f ?? value;
    entry[column] = formatted ?? "";
    raw[column] = value;
  });

  entry.__raw = raw;
  return entry;
}

function detectColumn(columns, records, targets) {
  const normalizedTargets = targets.map((target) => normalizeString(target));

  const columnMatch = columns.find((column) => {
    const normalized = normalizeString(column);
    return normalizedTargets.some((target) =>
      normalized.includes(target) || normalized === target
    );
  });

  if (columnMatch) {
    return columnMatch;
  }

  if (records.length) {
    const firstRecord = records[0];
    const matchFromFirstRow = columns.find((column) => {
      const value = firstRecord[column];
      if (typeof value !== "string") return false;
      const normalized = normalizeString(value);
      return normalizedTargets.some((target) =>
        normalized.includes(target) || normalized === target
      );
    });

    if (matchFromFirstRow) {
      return matchFromFirstRow;
    }
  }

  return null;
}

function normalizeString(value) {
  if (value == null) {
    return "";
  }

  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildSupplementalEntries(records, nameColumn, birthColumn, phoneColumn) {
  if (!Array.isArray(records) || !records.length || !nameColumn) {
    return [];
  }

  return records
    .map((record) => {
      const nameValue = record?.[nameColumn];
      if (!nameValue) {
        return null;
      }

      const normalizedName = normalizeString(nameValue);
      if (!normalizedName) {
        return null;
      }

      const rawBirth = birthColumn
        ? record.__raw?.[birthColumn] ?? record[birthColumn]
        : null;
      const birthDate = birthColumn ? parseDate(rawBirth) : null;
      const phoneValue = phoneColumn ? record[phoneColumn] ?? "" : "";

      return {
        record,
        normalizedName,
        birthDate,
        phone: phoneValue != null ? String(phoneValue) : "",
        normalizedPhone: sanitizePhone(phoneValue),
      };
    })
    .filter(Boolean);
}

function buildSupplementalIndex(entries) {
  const index = new Map();

  entries.forEach((entry) => {
    const existing = index.get(entry.normalizedName);
    if (existing) {
      existing.push(entry);
    } else {
      index.set(entry.normalizedName, [entry]);
    }
  });

  return index;
}

function findServiceSheetColumn(columns, labels) {
  if (!Array.isArray(columns) || !columns.length) {
    return null;
  }

  const normalizedTargets = labels
    .map((label) => normalizeColumnLabel(label))
    .filter(Boolean);

  for (const column of columns) {
    const normalized = normalizeColumnLabel(column);
    if (!normalized) continue;
    if (
      normalizedTargets.some(
        (target) => normalized === target || normalized.includes(target)
      )
    ) {
      return column;
    }
  }

  return null;
}

function getKnownServiceIds() {
  const ids = new Set(DEFAULT_SERVICE_OPTION_IDS);
  customServiceOptions.forEach((_, id) => ids.add(id));
  dynamicServiceOptions.forEach((_, id) => ids.add(id));
  return ids;
}

function normalizeServiceCellValue(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value
      .replace(/[\u2713\u2714\u2705✅✔️]/g, "")
      .replace(/[•·]/g, ",")
      .replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/,\s+/g, ",")
      .trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeServiceCellValue(entry))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value || {})
      .map((entry) => normalizeServiceCellValue(entry))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "number" && !Number.isNaN(value)) {
    return String(value);
  }

  return String(value ?? "").trim();
}

function collectServiceIdsFromColumn(record, column) {
  if (!record || !column) {
    return [];
  }

  const values = collectColumnValues(record, column);
  if (!values.length) {
    return [];
  }

  const ids = [];
  values.forEach((value) => {
    const normalized = normalizeServiceCellValue(value);
    if (!normalized) {
      return;
    }
    const parsed = parseServiceList(normalized);
    if (Array.isArray(parsed) && parsed.length) {
      parsed.forEach((serviceId) => ids.push(serviceId));
    }
  });

  return Array.from(new Set(ids)).filter(Boolean);
}

function detectRosterServiceColumn(records, columns, nameColumn) {
  if (!Array.isArray(records) || !records.length) {
    return null;
  }

  if (!Array.isArray(columns) || !columns.length) {
    return null;
  }

  const knownServiceIds = getKnownServiceIds();
  let bestColumn = null;
  let bestScore = 0;

  columns.forEach((column) => {
    if (!column || column === nameColumn) {
      return;
    }

    let recognized = 0;

    records.forEach((record) => {
      const values = collectColumnValues(record, column);
      for (const value of values) {
        const normalized = normalizeServiceCellValue(value);
        if (!normalized) {
          continue;
        }
        const ids = normalized
          .split(/[,;\n]+/)
          .map((chunk) => normalizeServiceId(chunk))
          .filter(Boolean);
        if (ids.some((id) => knownServiceIds.has(id))) {
          recognized += 1;
          break;
        }
      }
    });

    if (recognized > bestScore) {
      bestScore = recognized;
      bestColumn = column;
    }
  });

  return bestColumn;
}

function buildRosterServiceAssignments(records, columns) {
  if (!Array.isArray(records) || !records.length) {
    return null;
  }

  const sheetColumns = Array.isArray(columns) ? columns.filter(Boolean) : [];

  if (!sheetColumns.length) {
    return null;
  }

  let nameColumn = findServiceSheetColumn(sheetColumns, [
    "nome",
    "nome do irmão",
    "nome do irmao",
    "name",
  ]);

  if (!nameColumn) {
    nameColumn = sheetColumns[0];
  }

  if (!nameColumn) {
    return null;
  }

  let servicesColumn = findServiceSheetColumn(sheetColumns, [
    "serviços",
    "servicos",
    "services",
    "serviços (ids)",
    "servicos (ids)",
    "services (ids)",
  ]);

  if (!servicesColumn) {
    servicesColumn = detectRosterServiceColumn(records, sheetColumns, nameColumn);
  }

  if (!servicesColumn && sheetColumns.length > 1) {
    servicesColumn = sheetColumns[1];
  }

  if (!servicesColumn) {
    return null;
  }

  const assignments = new Map();

  records.forEach((record) => {
    if (!record) {
      return;
    }

    const nameValue = extractFirstNonEmptyValue(record, nameColumn);
    const normalizedName = normalizeString(nameValue);
    if (!normalizedName) {
      return;
    }

    const serviceIds = collectServiceIdsFromColumn(record, servicesColumn);
    if (!serviceIds.length) {
      return;
    }

    const normalized = normalizeServiceAssignment({
      active: true,
      services: serviceIds,
    });

    if (!normalized.active || !normalized.services.length) {
      return;
    }

    assignments.set(normalizedName, normalized);
  });

  return assignments.size ? assignments : null;
}

function buildDetailedServiceAssignments(records, columns) {
  if (!Array.isArray(records) || !records.length) {
    return null;
  }

  const sheetColumns = Array.isArray(columns) ? columns.slice() : [];

  let servicesColumn =
    findServiceSheetColumn(sheetColumns, [
      "serviços (ids)",
      "servicos (ids)",
      "serviços",
      "servicos",
      "services",
      "services (ids)",
    ]) ?? null;

  if (!servicesColumn && sheetColumns.length > 1) {
    servicesColumn = sheetColumns[1];
  }

  const checkboxColumns = detectServiceColumnsFromRecords(
    records,
    sheetColumns,
    servicesColumn
  );

  if (!servicesColumn && !checkboxColumns.length) {
    return null;
  }

  const serviceKeyColumn = findServiceSheetColumn(sheetColumns, [
    "service key",
    "chave do serviço",
    "chave do servico",
    "identificador",
  ]);
  const legacyKeyColumn = findServiceSheetColumn(sheetColumns, [
    "legacy key",
    "chave legada",
  ]);
  const activeColumn = findServiceSheetColumn(sheetColumns, [
    "ativo",
    "active",
    "estado",
  ]);
  let nameColumn = findServiceSheetColumn(sheetColumns, [
    "nome",
    "nome do irmão",
    "name",
  ]);
  if (!nameColumn && sheetColumns.length) {
    nameColumn = sheetColumns[0];
  }
  const phoneColumn = findServiceSheetColumn(sheetColumns, [
    "telefone",
    "contato",
    "phone",
  ]);
  const birthColumn = findServiceSheetColumn(sheetColumns, [
    "data de nascimento",
    "nascimento",
    "birth",
    "birthday",
  ]);

  const assignments = new Map();
  const fallbackAssignments = new Map();

  records.forEach((record) => {
    if (!record) {
      return;
    }

    const aggregatedServices = collectServiceIdsFromColumn(record, servicesColumn);
    const columnServices = checkboxColumns.length
      ? extractServiceIdsFromColumns(record, checkboxColumns)
      : [];
    const serviceIds = mergeServiceIdLists(aggregatedServices, columnServices);
    if (!serviceIds.length) {
      return;
    }

    let active = true;
    if (activeColumn) {
      const activeValues = collectColumnValues(record, activeColumn);
      if (activeValues.length) {
        active = activeValues.some((value) => parseBoolean(value));
      }
    }

    const normalized = normalizeServiceAssignment({
      active,
      services: serviceIds,
    });

    if (!normalized.active || !normalized.services.length) {
      return;
    }

    const nameValue = nameColumn
      ? extractFirstNonEmptyValue(record, nameColumn)
      : "";
    const normalizedName = normalizeString(nameValue);

    let serviceKey = serviceKeyColumn
      ? extractFirstNonEmptyValue(record, serviceKeyColumn)
      : "";
    let legacyKey = legacyKeyColumn
      ? extractFirstNonEmptyValue(record, legacyKeyColumn)
      : "";

    if (typeof serviceKey === "string") {
      serviceKey = serviceKey.trim();
    } else {
      serviceKey = String(serviceKey ?? "").trim();
    }

    if (typeof legacyKey === "string") {
      legacyKey = legacyKey.trim();
    } else {
      legacyKey = String(legacyKey ?? "").trim();
    }

    if (serviceKey) {
      assignments.set(serviceKey, normalized);
    }

    if (legacyKey) {
      assignments.set(legacyKey, normalized);
    }

    if (normalizedName) {
      assignments.set(normalizedName, normalized);
    }

    if (!serviceKey && !legacyKey) {
      const fallback = [];
      if (nameColumn) {
        const fallbackName = extractFirstNonEmptyValue(record, nameColumn);
        const normalizedFallback = normalizeString(fallbackName);
        if (normalizedFallback) {
          fallback.push(normalizedFallback);
        }
      }

      if (birthColumn) {
        const birthValues = collectColumnValues(record, birthColumn);
        const rawBirth = birthValues.find((value) => value != null && value !== "");
        const birthDate = parseDate(rawBirth);
        const formattedBirth = formatDateForSheet(birthDate);
        if (formattedBirth) {
          fallback.push(formattedBirth);
        }
      }

      if (phoneColumn) {
        const phoneValues = collectColumnValues(record, phoneColumn);
        const digits = phoneValues
          .map((value) => extractPhoneDigits(value))
          .find((value) => value);
        if (digits) {
          fallback.push(digits);
        }
      }

      if (fallback.length) {
        const fallbackKey = fallback.join("|");
        fallbackAssignments.set(fallbackKey, normalized);
      }
    }
  });

  if (!assignments.size && fallbackAssignments.size) {
    fallbackAssignments.forEach((assignment, key) => {
      assignments.set(key, assignment);
    });
  }

  return assignments.size ? assignments : null;
}

function buildServiceAssignmentsFromSheet(records, columns) {
  if (!Array.isArray(records) || !records.length) {
    clearDynamicServiceOptions();
    return null;
  }

  clearDynamicServiceOptions();

  const rosterAssignments = buildRosterServiceAssignments(records, columns);
  const detailedAssignments = buildDetailedServiceAssignments(records, columns);

  if (detailedAssignments && detailedAssignments.size) {
    if (rosterAssignments && rosterAssignments.size) {
      detailedAssignments.forEach((assignment, key) => {
        rosterAssignments.set(key, assignment);
      });
      return rosterAssignments;
    }
    return detailedAssignments;
  }

  if (rosterAssignments && rosterAssignments.size) {
    return rosterAssignments;
  }

  return null;
}


function applyRemoteServiceAssignments(records, columns) {
  const remoteAssignments = buildServiceAssignmentsFromSheet(records, columns);
  if (!remoteAssignments) {
    flushDynamicServiceOptions();
    return;
  }

  state.serviceAssignments = remoteAssignments;
  persistLocalServiceAssignments();
  setServiceSyncStatus("serviceManager.sync.status.ready");
  flushDynamicServiceOptions();
}

function normalizeServiceId(value) {
  if (value == null) {
    return "";
  }

  const normalizedRaw = normalizeString(value);
  if (!normalizedRaw) {
    return "";
  }

  const compactNormalized = normalizedRaw.replace(/\s+/g, "");

  if (
    NO_SERVICE_LABELS.has(normalizedRaw) ||
    NO_SERVICE_LABELS.has(compactNormalized)
  ) {
    return "";
  }

  return normalizedRaw.replace(/\s+/g, "-");
}

function sanitizeServiceId(value) {
  const normalized = normalizeServiceId(value);
  if (!normalized) {
    return "";
  }

  if (DEFAULT_SERVICE_OPTION_IDS.has(normalized)) {
    return normalized;
  }

  if (customServiceOptions.has(normalized)) {
    return normalized;
  }

  if (dynamicServiceOptions.has(normalized)) {
    return normalized;
  }

  const registered = registerDynamicServiceOption(value);
  if (registered) {
    return registered;
  }

  return "";
}

function translateServiceName(serviceId) {
  const normalized = sanitizeServiceId(serviceId);
  if (!normalized) {
    return "";
  }

  const defaultOption = DEFAULT_SERVICE_OPTIONS.find(
    (option) => option.id === normalized
  );
  if (defaultOption?.nameKey) {
    const translation = translate(defaultOption.nameKey);
    return translation || normalized;
  }

  if (defaultOption) {
    if (defaultOption.labels && typeof defaultOption.labels === "object") {
      const language = state.language ?? getDefaultLanguage();
      const label =
        defaultOption.labels[language] ??
        defaultOption.labels[getDefaultLanguage()] ??
        defaultOption.labels.pt;
      if (label) {
        return label;
      }
    }
    if (defaultOption.label) {
      return defaultOption.label;
    }
  }

  const customOption = customServiceOptions.get(normalized);
  if (customOption) {
    if (customOption.labels && typeof customOption.labels === "object") {
      const language = state.language ?? getDefaultLanguage();
      const label =
        customOption.labels[language] ??
        customOption.labels.pt ??
        customOption.label;
      if (label) {
        return label;
      }
    }
    if (customOption.label) {
      return customOption.label;
    }
  }

  const dynamicOption = dynamicServiceOptions.get(normalized);
  if (dynamicOption) {
    if (dynamicOption.labels && typeof dynamicOption.labels === "object") {
      const language = state.language ?? getDefaultLanguage();
      const label =
        dynamicOption.labels[language] ??
        dynamicOption.labels[getDefaultLanguage()] ??
        dynamicOption.labels.pt;
      if (label) {
        return label;
      }
    }
    if (dynamicOption.label) {
      return dynamicOption.label;
    }
  }

  return normalized;
}

function collectColumnValues(record, column) {
  const values = [];
  if (!record || !column) {
    return values;
  }

  if (Object.prototype.hasOwnProperty.call(record, column)) {
    values.push(record[column]);
  }

  if (record.__raw && Object.prototype.hasOwnProperty.call(record.__raw, column)) {
    values.push(record.__raw[column]);
  }

  return values;
}

function extractFirstNonEmptyValue(record, column) {
  const values = collectColumnValues(record, column);
  for (const value of values) {
    if (value == null) {
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
      continue;
    }
    if (typeof value === "number" && !Number.isNaN(value)) {
      const stringValue = String(value).trim();
      if (stringValue) {
        return stringValue;
      }
    }
  }
  return "";
}

function detectCareNetworkNameColumn(columns) {
  if (!Array.isArray(columns) || !columns.length) {
    return null;
  }

  for (const column of columns) {
    const normalized = normalizeString(column);
    if (!normalized) {
      continue;
    }
    if (normalized.includes("nome") || normalized.includes("name")) {
      return column;
    }
  }

  return columns[0] ?? null;
}

function detectCareNetworkServiceColumns(columns, nameColumn) {
  if (!Array.isArray(columns) || !columns.length) {
    return [];
  }

  const result = [];

  columns.forEach((column, index) => {
    if (!column || column === nameColumn) {
      return;
    }

    const normalized = normalizeString(column);
    if (!normalized) {
      return;
    }

    const matches =
      normalized.includes("servico") ||
      normalized.includes("servicio") ||
      normalized.includes("ministerio") ||
      normalized.includes("ministerial") ||
      normalized.includes("rede") ||
      normalized.includes("cuidado") ||
      normalized.includes("area") ||
      normalized.includes("frente") ||
      normalized.includes("atuacao") ||
      normalized.includes("acompanhamento");

    if (matches) {
      result.push(column);
    }
  });

  if (!result.length) {
    const fallback = columns.find((column, index) => {
      if (!column || column === nameColumn) {
        return false;
      }
      return index > 0;
    });
    if (fallback) {
      result.push(fallback);
    }
  }

  return result;
}

function splitCareNetworkServices(value) {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => splitCareNetworkServices(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) =>
      splitCareNetworkServices(item)
    );
  }

  const text = String(value ?? "").replace(/\r/g, "\n");
  if (!text.trim()) {
    return [];
  }

  const segments = text
    .split(/[,;\/\\\n]+/)
    .map((segment) => segment.replace(/\u00a0/g, " ").trim())
    .filter(Boolean);

  const seen = new Set();
  const results = [];

  const pushSegment = (segment) => {
    if (!segment) {
      return;
    }
    const normalized = normalizeString(segment);
    if (!normalized) {
      return;
    }
    const compact = normalized.replace(/\s+/g, "");
    if (NO_SERVICE_LABELS.has(normalized) || NO_SERVICE_LABELS.has(compact)) {
      return;
    }
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    results.push(segment);
  };

  segments.forEach(pushSegment);

  if (!results.length) {
    pushSegment(text.trim());
  }

  return results;
}

function buildCareNetworkEntries(records, options = {}) {
  const { nameColumn = null, serviceColumns = [], columns = [] } = options;

  if (!Array.isArray(records) || !records.length) {
    return [];
  }

  const normalizedServiceColumns = Array.isArray(serviceColumns)
    ? serviceColumns.filter((column) => typeof column === "string")
    : [];

  const normalizedColumns = Array.isArray(columns)
    ? columns.filter((column) => typeof column === "string")
    : [];

  const entries = [];

  records.forEach((record) => {
    if (!record) {
      return;
    }

    const nameValue = nameColumn
      ? extractFirstNonEmptyValue(record, nameColumn)
      : "";
    const displayName = typeof nameValue === "string"
      ? nameValue.trim()
      : String(nameValue ?? "").trim();

    if (!displayName) {
      return;
    }

    const normalizedName = normalizeString(displayName);
    if (!normalizedName) {
      return;
    }

    const services = [];
    const serviceSeen = new Set();

    normalizedServiceColumns.forEach((column) => {
      const values = collectColumnValues(record, column);
      values.forEach((value) => {
        splitCareNetworkServices(value).forEach((service) => {
          const normalizedService = normalizeString(service);
          if (!normalizedService || serviceSeen.has(normalizedService)) {
            return;
          }
          const compact = normalizedService.replace(/\s+/g, "");
          if (
            NO_SERVICE_LABELS.has(normalizedService) ||
            NO_SERVICE_LABELS.has(compact)
          ) {
            return;
          }
          serviceSeen.add(normalizedService);
          services.push(service);
        });
      });
    });

    const fields = [];
    const fieldMap = new Map();

    normalizedColumns.forEach((column) => {
      if (column === nameColumn) {
        return;
      }
      if (normalizedServiceColumns.includes(column)) {
        return;
      }

      const values = collectColumnValues(record, column);
      const displayValue = values
        .map((value) => {
          if (value == null) {
            return "";
          }
          if (typeof value === "string") {
            return value.trim();
          }
          return String(value).trim();
        })
        .find((value) => value.length > 0);

      if (displayValue) {
        fields.push({ key: column, value: displayValue });
        const normalizedKey = normalizeString(column);
        if (normalizedKey && !fieldMap.has(normalizedKey)) {
          fieldMap.set(normalizedKey, displayValue);
        }
      }
    });

    entries.push({
      name: displayName,
      normalizedName,
      services,
      serviceText: services.join(", "),
      fields,
      fieldMap,
      raw: record,
      person: null,
    });
  });

  return entries;
}

function buildCareNetworkIndex(entries) {
  const index = new Map();
  if (!Array.isArray(entries)) {
    return index;
  }

  entries.forEach((entry) => {
    const normalized = entry?.normalizedName;
    if (!normalized) {
      return;
    }
    const list = index.get(normalized);
    if (list) {
      list.push(entry);
    } else {
      index.set(normalized, [entry]);
    }
  });

  return index;
}

function applyCareNetworkSheet(records, columns) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRecords = Array.isArray(records) ? records : [];

  const nameColumn = detectCareNetworkNameColumn(safeColumns);
  const serviceColumns = detectCareNetworkServiceColumns(
    safeColumns,
    nameColumn
  );

  const entries = buildCareNetworkEntries(safeRecords, {
    nameColumn,
    serviceColumns,
    columns: safeColumns,
  });

  const index = buildCareNetworkIndex(entries);
  const assigned = entries.filter((entry) => entry.services.length > 0).length;

  state.careNetwork = {
    columns: safeColumns,
    records: safeRecords,
    nameColumn,
    serviceColumns,
    entries,
    index,
    summary: { total: entries.length, assigned },
  };
}

function resetCareNetworkState() {
  state.careNetwork = createEmptyCareNetworkState();
}

function collectEntryNameCandidates(entry) {
  const candidates = new Set();
  if (!entry) {
    return [];
  }

  if (entry.name) {
    candidates.add(entry.name);
  }

  const record = entry.record ?? null;
  if (record && state.nameColumn && record[state.nameColumn]) {
    candidates.add(record[state.nameColumn]);
  }
  if (record?.__raw && state.nameColumn && record.__raw[state.nameColumn]) {
    candidates.add(record.__raw[state.nameColumn]);
  }

  const supplemental = entry.supplemental ?? null;
  if (supplemental?.name) {
    candidates.add(supplemental.name);
  }

  const supplementalRecord = supplemental?.record ?? null;
  if (
    supplementalRecord &&
    state.supplementalNameColumn &&
    supplementalRecord[state.supplementalNameColumn]
  ) {
    candidates.add(supplementalRecord[state.supplementalNameColumn]);
  }
  if (
    supplementalRecord?.__raw &&
    state.supplementalNameColumn &&
    supplementalRecord.__raw[state.supplementalNameColumn]
  ) {
    candidates.add(supplementalRecord.__raw[state.supplementalNameColumn]);
  }

  return Array.from(candidates).filter(Boolean);
}

function applyCareNetworkDataToEntries() {
  const entries = Array.isArray(state.enrichedRecords)
    ? state.enrichedRecords
    : [];
  const careState = state.careNetwork ?? createEmptyCareNetworkState();
  const index = careState.index ?? new Map();

  if (Array.isArray(careState.entries)) {
    careState.entries.forEach((entry) => {
      entry.person = null;
    });
  }

  entries.forEach((entry) => {
    const nameCandidates = collectEntryNameCandidates(entry);
    let matchedCare = null;

    for (const candidate of nameCandidates) {
      const normalized = normalizeString(candidate);
      if (!normalized) {
        continue;
      }
      const matches = index.get(normalized);
      if (Array.isArray(matches) && matches.length) {
        matchedCare = matches[0];
        break;
      }
    }

    if (matchedCare) {
      entry.careNetwork = {
        services: [...matchedCare.services],
        fields: matchedCare.fields.map((field) => ({ ...field })),
        name: matchedCare.name,
        serviceText:
          matchedCare.serviceText ?? matchedCare.services.join(", "),
        fieldMap:
          matchedCare.fieldMap instanceof Map
            ? new Map(matchedCare.fieldMap)
            : new Map(),
        raw: matchedCare.raw,
      };
      matchedCare.person = entry;
    } else {
      entry.careNetwork = {
        services: [],
        fields: [],
        name: entry.name ?? "",
        serviceText: "",
        fieldMap: new Map(),
        raw: null,
      };
    }
  });
}

function mergeServiceIdLists(primary, secondary) {
  const result = [];
  const seen = new Set();

  const addList = (list) => {
    if (!Array.isArray(list)) {
      return;
    }
    list.forEach((serviceId) => {
      const sanitized = sanitizeServiceId(serviceId);
      if (!sanitized || seen.has(sanitized)) {
        return;
      }
      seen.add(sanitized);
      result.push(sanitized);
    });
  };

  addList(primary);
  addList(secondary);

  return result;
}

function isTruthyServiceSelection(value, serviceId) {
  if (Array.isArray(value)) {
    return value.some((entry) => isTruthyServiceSelection(entry, serviceId));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((entry) =>
      isTruthyServiceSelection(entry, serviceId)
    );
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (value == null) {
    return false;
  }

  const normalizedValueId = normalizeServiceId(value);
  if (normalizedValueId && serviceId && normalizedValueId === serviceId) {
    return true;
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return false;
  }

  if (serviceId) {
    if (normalized === serviceId) {
      return true;
    }
    const serviceName = serviceId.replace(/-/g, " ");
    if (normalized === serviceName) {
      return true;
    }
  }

  return SERVICE_SELECTION_POSITIVE_VALUES.has(normalized);
}

function detectServiceColumnsFromRecords(records, columns, excludedColumn) {
  if (!Array.isArray(records) || !records.length) {
    return [];
  }

  if (!Array.isArray(columns) || !columns.length) {
    return [];
  }

  const serviceColumns = [];
  const seen = new Set();

  columns.forEach((column) => {
    if (!column || column === excludedColumn) {
      return;
    }

    const serviceId = normalizeServiceId(column);
    if (!serviceId || seen.has(serviceId)) {
      return;
    }

    const hasSelection = records.some((record) => {
      if (!record) {
        return false;
      }
      const values = collectColumnValues(record, column);
      return values.some((value) => isTruthyServiceSelection(value, serviceId));
    });

    if (!hasSelection) {
      return;
    }

    serviceColumns.push({ column, serviceId });
    seen.add(serviceId);
  });

  return serviceColumns;
}

function extractServiceIdsFromColumns(record, serviceColumns) {
  if (!record || !Array.isArray(serviceColumns) || !serviceColumns.length) {
    return [];
  }

  const selected = [];
  serviceColumns.forEach(({ column, serviceId }) => {
    const values = collectColumnValues(record, column);
    if (values.some((value) => isTruthyServiceSelection(value, serviceId))) {
      selected.push(serviceId);
    }
  });

  return selected;
}

function getServiceLabelByLanguage(serviceId, language) {
  const normalized = sanitizeServiceId(serviceId);
  if (!normalized) {
    return "";
  }

  const targetLanguage =
    language && LANGUAGE_OPTIONS[language]?.code
      ? LANGUAGE_OPTIONS[language].code
      : state.language ?? getDefaultLanguage();

  const defaultOption = DEFAULT_SERVICE_OPTIONS.find(
    (option) => option.id === normalized
  );
  if (defaultOption?.nameKey) {
    const translation = translate(
      defaultOption.nameKey,
      {},
      targetLanguage
    );
    return translation || normalized;
  }

  if (defaultOption) {
    if (defaultOption.labels && typeof defaultOption.labels === "object") {
      const preferred =
        defaultOption.labels[targetLanguage] ??
        defaultOption.labels[getDefaultLanguage()] ??
        defaultOption.labels.pt;
      if (preferred) {
        return preferred;
      }
    }
    if (defaultOption.label) {
      return defaultOption.label;
    }
  }

  const customOption = customServiceOptions.get(normalized);
  if (customOption) {
    if (customOption.labels && typeof customOption.labels === "object") {
      const preferred =
        customOption.labels[targetLanguage] ??
        customOption.labels[getDefaultLanguage()] ??
        customOption.labels.pt;
      if (preferred) {
        return preferred;
      }
    }
    if (customOption.label) {
      return customOption.label;
    }
  }

  return normalized;
}

function normalizeServiceAssignment(rawAssignment) {
  if (!rawAssignment) {
    return { active: false, services: [] };
  }

  let services = [];

  if (Array.isArray(rawAssignment.services)) {
    services = rawAssignment.services.slice();
  } else if (Array.isArray(rawAssignment.serviceIds)) {
    services = rawAssignment.serviceIds.slice();
  } else if (typeof rawAssignment.serviceId === "string") {
    services = [rawAssignment.serviceId];
  } else if (typeof rawAssignment === "string") {
    services = [rawAssignment];
  }

  const normalized = Array.from(
    new Set(
      services
        .map((value) => sanitizeServiceId(value))
        .filter(Boolean)
    )
  );

  const isActive =
    (rawAssignment.active ?? normalized.length > 0) && normalized.length > 0;

  if (!isActive) {
    return { active: false, services: [] };
  }

  return { active: true, services: normalized };
}

function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (value == null) {
    return false;
  }

  const normalized = normalizeString(String(value));
  if (!normalized) {
    return false;
  }

  return [
    "true",
    "sim",
    "yes",
    "ativo",
    "activa",
    "active",
    "si",
  ].includes(normalized);
}

function parseServiceList(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeServiceId(entry))
      .filter(Boolean);
  }

  const normalizedString = String(value)
    .split(/[,;\n]+/)
    .map((chunk) => sanitizeServiceId(chunk))
    .filter(Boolean);

  return Array.from(new Set(normalizedString));
}

function formatDateForSheet(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildServiceSignature(record, supplementalRecord, context = {}) {
  const values = new Set();

  const pushValue = (prefix, value) => {
    if (value == null) {
      return;
    }
    const normalizedValue = normalizeString(String(value));
    if (!normalizedValue) {
      return;
    }
    values.add(`${prefix}:${normalizedValue}`);
  };

  if (Number.isInteger(context.rowIndex)) {
    pushValue("row", context.rowIndex);
  }

  if (context.phone) {
    pushValue("context-phone", context.phone);
  }

  const collectFromRecord = (source, prefix) => {
    if (!source || typeof source !== "object") {
      return;
    }
    Object.keys(source)
      .filter((key) => key !== "__raw")
      .forEach((key) => {
        pushValue(`${prefix}-${normalizeString(key)}`, source[key]);
      });
    if (source.__raw && typeof source.__raw === "object") {
      Object.keys(source.__raw).forEach((key) => {
        pushValue(`${prefix}-raw-${normalizeString(key)}`, source.__raw[key]);
      });
    }
  };

  collectFromRecord(record, "primary");
  collectFromRecord(supplementalRecord, "supp");

  if (!values.size) {
    return "";
  }

  const sorted = Array.from(values).sort();

  try {
    return sha256Fallback(sorted.join("|"));
  } catch (error) {
    console.warn("Failed to compute service signature:", error);
    return "";
  }
}

function resolveServiceKeys(record, supplementalEntry, context = {}) {
  if (!record) {
    return { key: null, legacyKey: null };
  }

  const names = [];
  if (context.name) {
    names.push(context.name);
  }
  if (state.nameColumn && record[state.nameColumn]) {
    names.push(record[state.nameColumn]);
  }
  if (supplementalEntry?.record && state.supplementalNameColumn) {
    const supplementalName =
      supplementalEntry.record[state.supplementalNameColumn];
    if (supplementalName) {
      names.push(supplementalName);
    }
  }

  const normalizedName = names
    .map((value) => normalizeString(value))
    .find((value) => value);

  if (!normalizedName) {
    return { key: null, legacyKey: null };
  }

  let birthDate = context.birthDate;
  const hasValidBirth =
    birthDate instanceof Date && !Number.isNaN(birthDate.getTime());
  if (!hasValidBirth) {
    const supplementalBirth = supplementalEntry?.birthDate;
    if (
      supplementalBirth instanceof Date &&
      !Number.isNaN(supplementalBirth.getTime())
    ) {
      birthDate = supplementalBirth;
    }
  }

  let birthKey = "";
  if (birthDate instanceof Date && !Number.isNaN(birthDate.getTime())) {
    const year = birthDate.getFullYear();
    const month = String(birthDate.getMonth() + 1).padStart(2, "0");
    const day = String(birthDate.getDate()).padStart(2, "0");
    birthKey = `${year}-${month}-${day}`;
  }

  const phoneCandidates = [];
  if (context.phone) {
    phoneCandidates.push(context.phone);
  }
  if (state.phoneColumn) {
    phoneCandidates.push(record[state.phoneColumn]);
    if (record.__raw?.[state.phoneColumn] != null) {
      phoneCandidates.push(record.__raw[state.phoneColumn]);
    }
  }
  if (supplementalEntry) {
    phoneCandidates.push(supplementalEntry.phone);
    phoneCandidates.push(supplementalEntry.normalizedPhone);
    const supplementalRecord = supplementalEntry.record;
    if (supplementalRecord && state.supplementalPhoneColumn) {
      phoneCandidates.push(
        supplementalRecord[state.supplementalPhoneColumn]
      );
      if (supplementalRecord.__raw) {
        phoneCandidates.push(
          supplementalRecord.__raw[state.supplementalPhoneColumn]
        );
      }
    }
  }

  const phoneDigits = phoneCandidates
    .map((value) => extractPhoneDigits(value))
    .find((digits) => digits);

  const legacyParts = [normalizedName];
  if (birthKey) legacyParts.push(birthKey);
  if (phoneDigits) legacyParts.push(phoneDigits);

  const legacyKey = legacyParts.filter(Boolean).join("|");
  if (!legacyKey) {
    return { key: null, legacyKey: null };
  }

  let key = legacyKey;

  const needsSignature = !birthKey || !phoneDigits;
  if (needsSignature) {
    const signature = buildServiceSignature(
      record,
      supplementalEntry?.record ?? null,
      context
    );
    if (signature) {
      key = `${legacyKey}|${signature}`;
    }
  }

  return { key, legacyKey };
}

function buildServiceSummary(entries) {
  const summary = { total: 0, unassigned: 0, perService: {} };

  if (!Array.isArray(entries) || !entries.length) {
    return summary;
  }

  entries.forEach((entry) => {
    const assignment = entry?.service ?? EMPTY_SERVICE_ASSIGNMENT;
    const services = Array.isArray(assignment.services)
      ? assignment.services
      : [];

    const normalizedServices = services
      .map((serviceId) => sanitizeServiceId(serviceId))
      .filter(Boolean);

    const isActive = Boolean(assignment.active && normalizedServices.length);

    if (!isActive) {
      summary.unassigned += 1;
      return;
    }

    summary.total += 1;
    normalizedServices.forEach((serviceId) => {
      summary.perService[serviceId] =
        (summary.perService[serviceId] ?? 0) + 1;
    });
  });

  return summary;
}

function getDynamicServiceOptions() {
  return Array.from(dynamicServiceOptions.values()).sort((a, b) =>
    collator.compare(getServiceOptionLabel(a), getServiceOptionLabel(b))
  );
}

function getCustomServiceOptions() {
  return Array.from(customServiceOptions.values()).sort((a, b) =>
    collator.compare(getServiceOptionLabel(a), getServiceOptionLabel(b))
  );
}

function getAllServiceOptions() {
  return [
    ...DEFAULT_SERVICE_OPTIONS,
    ...getDynamicServiceOptions(),
    ...getCustomServiceOptions(),
  ];
}

function getServiceOptionLabel(option) {
  if (!option) {
    return "";
  }
  if (option.nameKey) {
    return translate(option.nameKey);
  }
  if (option.labels && typeof option.labels === "object") {
    const language = state.language ?? getDefaultLanguage();
    const label = option.labels[language] ?? option.labels.pt ?? option.label;
    return label ?? "";
  }
  return option.label ?? "";
}

function loadCustomServices() {
  customServiceOptions.clear();
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const stored = localStorage.getItem(CUSTOM_SERVICE_STORAGE_KEY);
    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return;
    }

    Object.entries(parsed).forEach(([id, value]) => {
      const normalizedId = normalizeServiceId(id);
      const rawLabel =
        typeof value === "string"
          ? value
          : typeof value?.label === "string"
          ? value.label
          : "";
      const baseLabel = rawLabel.trim();
      if (!normalizedId || !baseLabel) {
        return;
      }
      if (RESERVED_SERVICE_IDS.has(normalizedId)) {
        return;
      }
      if (DEFAULT_SERVICE_OPTION_IDS.has(normalizedId)) {
        return;
      }
      if (customServiceOptions.has(normalizedId)) {
        return;
      }
      const labels = {};
      if (value && typeof value === "object" && value.labels) {
        labels.pt = String(value.labels.pt ?? baseLabel).trim() || baseLabel;
        labels.en = String(value.labels.en ?? labels.pt).trim() || labels.pt;
        labels.es = String(value.labels.es ?? labels.pt).trim() || labels.pt;
      } else {
        labels.pt = baseLabel;
        labels.en = baseLabel;
        labels.es = baseLabel;
      }
      customServiceOptions.set(normalizedId, {
        id: normalizedId,
        label: labels.pt,
        labels,
      });
    });
  } catch (error) {
    console.warn("Failed to load custom services:", error);
  }
}

function persistCustomServices() {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const payload = {};
    customServiceOptions.forEach((option, id) => {
      const label = typeof option?.label === "string" ? option.label.trim() : "";
      if (!id || !label) {
        return;
      }
      const labels = option?.labels && typeof option.labels === "object"
        ? {
            pt: String(option.labels.pt ?? label).trim() || label,
            en: String(option.labels.en ?? option.labels.pt ?? label).trim() || label,
            es: String(option.labels.es ?? option.labels.pt ?? label).trim() || label,
          }
        : { pt: label, en: label, es: label };
      payload[id] = { label, labels };
    });
    localStorage.setItem(CUSTOM_SERVICE_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist custom services:", error);
  }
}

function normalizeCustomServiceLabels(rawInput) {
  if (!rawInput) {
    return null;
  }

  if (typeof rawInput === "string") {
    const label = rawInput.trim();
    if (!label) {
      return null;
    }
    return { pt: label, en: label, es: label };
  }

  if (typeof rawInput === "object") {
    const base =
      typeof rawInput.pt === "string"
        ? rawInput.pt.trim()
        : typeof rawInput.label === "string"
        ? rawInput.label.trim()
        : "";
    if (!base) {
      return null;
    }

    const english =
      typeof rawInput.en === "string" ? rawInput.en.trim() : "";
    const spanish =
      typeof rawInput.es === "string" ? rawInput.es.trim() : "";

    return {
      pt: base,
      en: english || base,
      es: spanish || base,
    };
  }

  return null;
}

function registerCustomService(rawInput) {
  const labels = normalizeCustomServiceLabels(rawInput);
  if (!labels) {
    return { success: false, reason: "invalid" };
  }

  const normalizedId = normalizeServiceId(labels.pt);
  if (!normalizedId) {
    return { success: false, reason: "invalid" };
  }

  if (RESERVED_SERVICE_IDS.has(normalizedId)) {
    return { success: false, reason: "reserved" };
  }

  if (DEFAULT_SERVICE_OPTION_IDS.has(normalizedId)) {
    return { success: false, reason: "exists", id: normalizedId };
  }

  if (customServiceOptions.has(normalizedId)) {
    return { success: false, reason: "exists", id: normalizedId };
  }

  const option = { id: normalizedId, label: labels.pt, labels };
  customServiceOptions.set(normalizedId, option);
  persistCustomServices();
  return { success: true, option };
}

function updateAssignmentsForServiceChange(oldId, newId) {
  if (!oldId || !state.serviceAssignments) {
    return false;
  }
  let changed = false;
  const sanitizedOld = sanitizeServiceId(oldId);
  const sanitizedNew = sanitizeServiceId(newId);
  state.serviceAssignments.forEach((assignment) => {
    if (!assignment || !Array.isArray(assignment.services)) {
      return;
    }

    const updated = [];
    let assignmentChanged = false;

    assignment.services.forEach((serviceId) => {
      const normalized = sanitizeServiceId(serviceId);
      if (!normalized) {
        assignmentChanged = true;
        return;
      }
      if (normalized === sanitizedOld) {
        if (sanitizedNew) {
          if (!updated.includes(sanitizedNew)) {
            updated.push(sanitizedNew);
          }
        } else {
          assignmentChanged = true;
        }
        if (sanitizedNew !== sanitizedOld) {
          assignmentChanged = true;
        }
        return;
      }
      if (!updated.includes(normalized)) {
        updated.push(normalized);
      }
    });

    if (updated.length !== assignment.services.length) {
      assignmentChanged = true;
    }

    if (assignmentChanged) {
      assignment.services = updated;
      assignment.active = Boolean(assignment.active && assignment.services.length);
      changed = true;
    }
  });
  if (changed) {
    persistServiceAssignments();
    applyServiceAssignmentsToEntries();
  }
  return changed;
}

function updateCustomService(optionId, rawInput) {
  const current = optionId ? customServiceOptions.get(optionId) : null;
  if (!current) {
    return { success: false, reason: "missing" };
  }

  const labels = normalizeCustomServiceLabels(rawInput);
  if (!labels) {
    return { success: false, reason: "invalid" };
  }

  const normalizedId = normalizeServiceId(labels.pt);
  if (!normalizedId) {
    return { success: false, reason: "invalid" };
  }

  if (RESERVED_SERVICE_IDS.has(normalizedId)) {
    return { success: false, reason: "reserved" };
  }

  if (DEFAULT_SERVICE_OPTION_IDS.has(normalizedId) && normalizedId !== optionId) {
    return { success: false, reason: "exists", id: normalizedId };
  }

  const existing = customServiceOptions.get(normalizedId);
  if (existing && normalizedId !== optionId) {
    return { success: false, reason: "exists", id: normalizedId };
  }

  customServiceOptions.delete(optionId);
  const option = { id: normalizedId, label: labels.pt, labels };
  customServiceOptions.set(normalizedId, option);
  persistCustomServices();

  if (normalizedId !== optionId) {
    updateAssignmentsForServiceChange(optionId, normalizedId);
  }

  return { success: true, option };
}

function deleteCustomService(optionId) {
  if (!optionId || !customServiceOptions.has(optionId)) {
    return false;
  }
  customServiceOptions.delete(optionId);
  persistCustomServices();
  updateAssignmentsForServiceChange(optionId, null);
  return true;
}

function loadServiceAssignments() {
  if (typeof localStorage === "undefined") {
    state.serviceAssignments = new Map();
    flushDynamicServiceOptions();
    return;
  }

  try {
    const stored = localStorage.getItem(SERVICE_STORAGE_KEY);
    if (!stored) {
      state.serviceAssignments = new Map();
      flushDynamicServiceOptions();
      return;
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      state.serviceAssignments = new Map();
      flushDynamicServiceOptions();
      return;
    }

    const map = new Map();
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof key !== "string" || !key) {
        return;
      }
      const normalized = normalizeServiceAssignment(value);
      if (!normalized.active || !normalized.services.length) {
        return;
      }
      map.set(key, normalized);
    });
    state.serviceAssignments = map;
    flushDynamicServiceOptions();
  } catch (error) {
    console.warn("Failed to load service assignments:", error);
    state.serviceAssignments = new Map();
    flushDynamicServiceOptions();
  }
}

function persistLocalServiceAssignments() {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const payload = {};
    state.serviceAssignments.forEach((assignment, key) => {
      if (!key) return;
      const services = Array.isArray(assignment?.services)
        ? assignment.services.filter((serviceId) => sanitizeServiceId(serviceId))
        : [];
      payload[key] = {
        active: Boolean(assignment?.active) && services.length > 0,
        services,
        serviceId: services[0] ?? "",
      };
    });
    localStorage.setItem(SERVICE_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist service assignments:", error);
  }
}

function persistServiceAssignments() {
  persistLocalServiceAssignments();
}

function getServiceSheetConfig() {
  return { ...state.serviceSheet.config };
}

function setServiceSheetConfig(newConfig = {}) {
  state.serviceSheet.config = {
    ...state.serviceSheet.config,
    ...newConfig,
  };
  saveServiceSheetConfig(state.serviceSheet.config);
}

function ensureServiceSyncElements() {}

function setServiceSyncStatus() {}

function updateServiceSyncUI() {}

function ensureServiceSheetConfig() {
  return null;
}

function scheduleServiceSheetSync() {}

function buildServiceSheetRows() {
  return [];
}

async function loadGoogleIdentityScript() {
  throw new Error("Google API disabled");
}

async function requestGoogleAccessToken() {
  throw new Error("Google API disabled");
}

async function getGoogleAccessToken() {
  throw new Error("Google API disabled");
}

async function ensureServiceSheetExists() {}

async function clearServiceSheetRange() {}

async function updateServiceSheetValues() {}

async function performServiceSheetSync() {}

function handleServiceSyncConnectClick() {}

function handleServiceSyncConfigureClick() {}

function applyServiceAssignmentsToEntries() {
  if (!Array.isArray(state.enrichedRecords)) {
    return;
  }

  let migrated = false;

  state.enrichedRecords.forEach((entry) => {
    const { key: serviceKey, legacyKey } = resolveServiceKeys(
      entry.record,
      entry.supplemental,
      {
        name: entry.name,
        birthDate: entry.birthDate,
        phone: entry.phone,
        rowIndex: entry.rowIndex,
      }
    );

    entry.serviceKey = serviceKey;
    entry.legacyServiceKey = legacyKey;

    let assignment = serviceKey
      ? state.serviceAssignments.get(serviceKey)
      : null;

    if (!assignment && legacyKey && legacyKey !== serviceKey) {
      const legacyAssignment = state.serviceAssignments.get(legacyKey);
      if (legacyAssignment && serviceKey) {
        state.serviceAssignments.set(serviceKey, legacyAssignment);
        state.serviceAssignments.delete(legacyKey);
        assignment = legacyAssignment;
        migrated = true;
      } else {
        assignment = legacyAssignment;
      }
    }

    if (!assignment) {
      const fallbackName = normalizeString(
        entry.name ||
          (state.nameColumn && entry.record
            ? entry.record[state.nameColumn]
            : "")
      );

      if (fallbackName) {
        const fallbackAssignment = state.serviceAssignments.get(fallbackName);
        if (fallbackAssignment) {
          assignment = fallbackAssignment;

          if (serviceKey && serviceKey !== fallbackName) {
            state.serviceAssignments.set(serviceKey, fallbackAssignment);
            migrated = true;
          }

          if (
            legacyKey &&
            legacyKey !== serviceKey &&
            legacyKey !== fallbackName &&
            !state.serviceAssignments.has(legacyKey)
          ) {
            state.serviceAssignments.set(legacyKey, fallbackAssignment);
            migrated = true;
          }
        }
      }
    }

    entry.service = normalizeServiceAssignment(assignment);
  });

  if (migrated) {
    persistServiceAssignments();
  }
}

function ensureActiveServiceFilterValid(summary) {
  const validIds = new Set([
    SERVICE_FILTER_ALL,
    SERVICE_FILTER_UNASSIGNED,
    ...getAllServiceOptions().map((option) => option.id),
  ]);

  if (!validIds.has(state.activeServiceFilter)) {
    state.activeServiceFilter = SERVICE_FILTER_ALL;
    return;
  }

  if (state.activeServiceFilter === SERVICE_FILTER_ALL) {
    return;
  }

  if (state.activeServiceFilter === SERVICE_FILTER_UNASSIGNED) {
    const inactiveCount = summary?.unassigned ?? 0;
    if (inactiveCount <= 0) {
      state.activeServiceFilter = SERVICE_FILTER_ALL;
    }
    return;
  }

  const count = summary?.perService?.[state.activeServiceFilter] ?? 0;
  if (count <= 0) {
    state.activeServiceFilter = SERVICE_FILTER_ALL;
  }
}

function recalculateServiceSummaries() {
  state.serviceSummary = buildServiceSummary(state.enrichedRecords);
  const accessibleEntries = getAccessibleEntries();
  state.accessibleServiceSummary = buildServiceSummary(accessibleEntries);
  ensureActiveServiceFilterValid(state.accessibleServiceSummary);

  if (elements.services) {
    const total = state.accessibleServiceSummary?.total ?? 0;
    elements.services.textContent = total;
  }
}

function initializeServiceAssignments() {
  loadServiceAssignments();
}

function initializeCustomServices() {
  loadCustomServices();
}

function matchSupplementalRecord(record, birthDate) {
  const {
    supplementalIndex,
    nameColumn,
    phoneColumn,
  } = state;

  if (!supplementalIndex || !supplementalIndex.size || !nameColumn) {
    return null;
  }

  const nameValue = record?.[nameColumn];
  if (!nameValue) {
    return null;
  }

  const normalizedName = normalizeString(nameValue);
  if (!normalizedName) {
    return null;
  }

  const candidates = supplementalIndex.get(normalizedName);
  if (!candidates?.length) {
    return null;
  }

  if (birthDate instanceof Date && !Number.isNaN(birthDate.getTime())) {
    const matchByBirth = candidates.find(
      (candidate) =>
        candidate.birthDate instanceof Date &&
        !Number.isNaN(candidate.birthDate.getTime()) &&
        isSameDate(candidate.birthDate, birthDate)
    );

    if (matchByBirth) {
      return matchByBirth;
    }
  }

  const phoneValue = phoneColumn ? record?.[phoneColumn] ?? "" : "";
  const normalizedPhone = sanitizePhone(phoneValue);

  if (normalizedPhone) {
    const matchByPhone = candidates.find(
      (candidate) => candidate.normalizedPhone && candidate.normalizedPhone === normalizedPhone
    );

    if (matchByPhone) {
      return matchByPhone;
    }
  }

  return null;
}

function sanitizePhone(value) {
  if (!value) {
    return "";
  }
  return String(value).replace(/\D+/g, "");
}

function isPhoneLikeLabel(label) {
  const normalized = normalizeString(label);
  if (!normalized) return false;

  return (
    normalized.includes("telefone") ||
    normalized.includes("celular") ||
    normalized.includes("whatsapp") ||
    normalized.includes("contato")
  );
}

function extractPhoneDigits(value) {
  if (value == null) {
    return "";
  }

  const digits = String(value).replace(/\D+/g, "");
  return digits.length >= 8 ? digits : "";
}

function formatPhoneDigits(digits) {
  if (!digits) {
    return "";
  }

  const normalized = digits.trim();

  if (normalized.length === 13 && normalized.startsWith("55")) {
    const areaCode = normalized.slice(2, 4);
    const remaining = normalized.slice(4);
    const local = formatPhoneDigits(remaining);
    return `+55 (${areaCode}) ${local}`;
  }

  if (normalized.length === 12 && normalized.startsWith("55")) {
    const areaCode = normalized.slice(2, 4);
    const local = normalized.slice(4);
    return `+55 (${areaCode}) ${formatPhoneDigits(local)}`;
  }

  if (normalized.length === 11) {
    return `(${normalized.slice(0, 2)}) ${normalized.slice(2, 7)}-${normalized.slice(7)}`;
  }

  if (normalized.length === 10) {
    return `(${normalized.slice(0, 2)}) ${normalized.slice(2, 6)}-${normalized.slice(6)}`;
  }

  if (normalized.length === 9) {
    return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
  }

  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }

  return normalized;
}

function resolveDisplayPhone(record, supplementalEntry, baseValue = "") {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (value) => {
    const digits = extractPhoneDigits(value);
    if (!digits || seen.has(digits)) {
      return;
    }
    seen.add(digits);
    candidates.push({ digits });
  };

  if (baseValue) {
    pushCandidate(baseValue);
  }

  if (state.phoneColumn) {
    const rawCandidate = record?.__raw?.[state.phoneColumn];
    if (rawCandidate != null) {
      pushCandidate(rawCandidate);
    }
  }

  if (supplementalEntry) {
    pushCandidate(supplementalEntry.phone);
    const supplementalRecord = supplementalEntry.record;

    if (supplementalRecord) {
      if (state.supplementalPhoneColumn) {
        pushCandidate(supplementalRecord[state.supplementalPhoneColumn]);
        const rawSupplemental = supplementalRecord.__raw?.[state.supplementalPhoneColumn];
        if (rawSupplemental != null) {
          pushCandidate(rawSupplemental);
        }
      }

      Object.entries(supplementalRecord).forEach(([key, value]) => {
        if (key === "__raw") return;
        if (isPhoneLikeLabel(key)) {
          pushCandidate(value);
        }
      });

      if (supplementalRecord.__raw) {
        Object.entries(supplementalRecord.__raw).forEach(([key, value]) => {
          if (isPhoneLikeLabel(key)) {
            pushCandidate(value);
          }
        });
      }
    }
  }

  const primaryRecord = record ?? null;

  if (primaryRecord) {
    Object.entries(primaryRecord).forEach(([key, value]) => {
      if (key === "__raw") return;
      if (isPhoneLikeLabel(key)) {
        pushCandidate(value);
      }
    });

    if (primaryRecord.__raw) {
      Object.entries(primaryRecord.__raw).forEach(([key, value]) => {
        if (isPhoneLikeLabel(key)) {
          pushCandidate(value);
        }
      });
    }
  }

  if (candidates.length) {
    candidates.sort((a, b) => b.digits.length - a.digits.length);
    return formatPhoneDigits(candidates[0].digits);
  }

  if (typeof baseValue === "string") {
    return baseValue.trim();
  }

  return String(baseValue ?? "").trim();
}

function isSameDate(first, second) {
  if (!(first instanceof Date) || !(second instanceof Date)) {
    return false;
  }

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function buildEnrichedRecords(records) {
  const { birthColumn, nameColumn, phoneColumn } = state;

  return records.map((record, index) => {
    const rawBirth = birthColumn
      ? record.__raw?.[birthColumn] ?? record[birthColumn]
      : null;
    const birthDate = birthColumn ? parseDate(rawBirth) : null;
    const age = birthDate ? calculateAge(birthDate) : null;

    const supplementalEntry = matchSupplementalRecord(record, birthDate);

    let phoneValue = phoneColumn ? record[phoneColumn] ?? "" : "";
    if (typeof phoneValue !== "string") {
      phoneValue = String(phoneValue ?? "");
    }

    const displayPhone = resolveDisplayPhone(record, supplementalEntry, phoneValue);

    return {
      record,
      age,
      birthDate,
      name: nameColumn ? record[nameColumn] ?? "" : "",
      phone: displayPhone,
      supplemental: supplementalEntry,
      rowIndex: index,
    };
  });
}

function filterParentDetails(detailList, role) {
  if (!Array.isArray(detailList)) {
    return [];
  }

  const target = role === "father" ? "pai" : "mae";
  const englishTarget = role === "father" ? "father" : "mother";
  const seen = new Set();
  const results = [];

  detailList.forEach(({ key, value }) => {
    const normalizedKey = normalizeColumnLabel(key);
    if (!normalizedKey) {
      return;
    }

    const tokens = normalizedKey.split(" ");
    const matchesTarget =
      tokens.includes(target) || tokens.includes(englishTarget);

    if (!matchesTarget) {
      return;
    }

    const stringValue = value == null ? "" : String(value).trim();
    if (!stringValue) {
      return;
    }

    const uniqueKey = `${role}:${normalizedKey}`;
    if (seen.has(uniqueKey)) {
      return;
    }

    seen.add(uniqueKey);
    results.push({ key, value: stringValue });
  });

  return results;
}

function extractParentName(details, role) {
  if (!Array.isArray(details)) {
    return "";
  }

  let fallback = "";

  for (const { key, value } of details) {
    if (!value) continue;
    const normalizedKey = normalizeColumnLabel(key);
    if (!normalizedKey) continue;
    const tokens = normalizedKey.split(" ");
    if (tokens.includes("nome") || tokens.includes("name")) {
      return value;
    }
    if (!fallback && tokens.includes("responsavel")) {
      fallback = value;
    }
  }

  if (fallback) {
    return fallback;
  }

  const first = details.find((item) => item.value);
  return first ? first.value : "";
}

function createParentProfile(details, role) {
  if (!Array.isArray(details) || !details.length) {
    return null;
  }

  const name = extractParentName(details, role);

  return {
    name,
    details: details.map(({ key, value }) => ({ key, value })),
  };
}

function buildParentEntries(parentRecords) {
  if (!Array.isArray(parentRecords) || !parentRecords.length) {
    return [];
  }

  return parentRecords
    .map((record) => {
      if (!record || typeof record !== "object") {
        return null;
      }

      const childName = String(
        record[PARENT_SHEET_HEADERS.childName] ?? ""
      ).trim();
      const rawBirthday =
        record.__raw?.[PARENT_SHEET_HEADERS.childBirthday] ??
        record[PARENT_SHEET_HEADERS.childBirthday] ??
        "";
      const childBirthday = String(rawBirthday ?? "").trim();
      const birthDate = parseDate(rawBirthday);
      const childAge =
        birthDate instanceof Date && !Number.isNaN(birthDate.getTime())
          ? calculateAge(birthDate)
          : null;
      const childPhone = String(
        record[PARENT_SHEET_HEADERS.childPhone] ?? ""
      ).trim();

      const fatherDetails = [];
      const fatherNameValue = String(
        record[PARENT_SHEET_HEADERS.fatherName] ?? ""
      ).trim();
      if (fatherNameValue) {
        fatherDetails.push({
          key: PARENT_SHEET_HEADERS.fatherName,
          value: fatherNameValue,
        });
      }
      const fatherBirthdayValue = String(
        record[PARENT_SHEET_HEADERS.fatherBirthday] ?? ""
      ).trim();
      if (fatherBirthdayValue) {
        fatherDetails.push({
          key: PARENT_SHEET_HEADERS.fatherBirthday,
          value: fatherBirthdayValue,
        });
      }
      const fatherPhoneValue = String(
        record[PARENT_SHEET_HEADERS.fatherPhone] ?? ""
      ).trim();
      if (fatherPhoneValue) {
        fatherDetails.push({
          key: PARENT_SHEET_HEADERS.fatherPhone,
          value: fatherPhoneValue,
        });
      }
      const father = createParentProfile(fatherDetails, "father");

      const motherDetails = [];
      const motherNameValue = String(
        record[PARENT_SHEET_HEADERS.motherName] ?? ""
      ).trim();
      if (motherNameValue) {
        motherDetails.push({
          key: PARENT_SHEET_HEADERS.motherName,
          value: motherNameValue,
        });
      }
      const motherBirthdayValue = String(
        record[PARENT_SHEET_HEADERS.motherBirthday] ?? ""
      ).trim();
      if (motherBirthdayValue) {
        motherDetails.push({
          key: PARENT_SHEET_HEADERS.motherBirthday,
          value: motherBirthdayValue,
        });
      }
      const motherPhoneValue = String(
        record[PARENT_SHEET_HEADERS.motherPhone] ?? ""
      ).trim();
      if (motherPhoneValue) {
        motherDetails.push({
          key: PARENT_SHEET_HEADERS.motherPhone,
          value: motherPhoneValue,
        });
      }
      const mother = createParentProfile(motherDetails, "mother");

      if (!father && !mother) {
        return null;
      }

      const siblingStatus = String(
        record[PARENT_SHEET_HEADERS.siblingStatus] ?? ""
      ).trim();
      const siblingParticipation = String(
        record[PARENT_SHEET_HEADERS.siblingParticipation] ?? ""
      ).trim();
      const siblingsList = String(
        record[PARENT_SHEET_HEADERS.siblingsList] ?? ""
      ).trim();

      return {
        childName,
        childAge,
        childPhone,
        childBirthday,
        siblingStatus,
        siblingParticipation,
        siblingsList,
        father,
        mother,
      };
    })
    .filter(Boolean);
}

function summarizeParentEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return { parents: 0, families: 0 };
  }

  const families = entries.length;
  const parents = entries.reduce((total, item) => {
    let count = total;
    if (item.father) count += 1;
    if (item.mother) count += 1;
    return count;
  }, 0);

  return { parents, families };
}

function updateDashboard() {
  const { records, birthColumn, enrichedRecords } = state;

  recalculateServiceSummaries();
  const accessibleServiceSummary = state.accessibleServiceSummary ?? {
    total: 0,
  };

  if (elements.total) {
    elements.total.textContent = records.length;
  }

  const counters = {
    children: 0,
    teens: 0,
    captains: 0,
    braves: 0,
    stewards: 0,
  };

  if (birthColumn) {
    enrichedRecords.forEach((entry) => {
      const { age } = entry;
      if (!Number.isFinite(age)) return;

      if (age >= 0 && age <= 10) counters.children += 1;
      else if (age >= 11 && age <= 17) counters.teens += 1;
      else if (age >= 18 && age <= 29) counters.captains += 1;
      else if (age >= 30 && age <= 49) counters.braves += 1;
      else if (age >= 50) counters.stewards += 1;
    });
  }

  if (elements.children) elements.children.textContent = counters.children;
  if (elements.teens) elements.teens.textContent = counters.teens;
  if (elements.parents)
    elements.parents.textContent = state.parentSummary?.parents ?? 0;
  if (elements.careNetwork)
    elements.careNetwork.textContent =
      state.careNetwork?.summary?.assigned ?? 0;
  if (elements.services)
    elements.services.textContent = accessibleServiceSummary.total;
  if (elements.captains) elements.captains.textContent = counters.captains;
  if (elements.braves) elements.braves.textContent = counters.braves;
  if (elements.stewards) elements.stewards.textContent = counters.stewards;

  updateOverallChart(getAccessibleEntries());
  updateBirthdays();
  if (isServiceManagerPage) {
    renderServiceManager();
  }
}

function isBirthdayToday(birthDate, referenceDate) {
  if (!(birthDate instanceof Date)) {
    return false;
  }

  if (Number.isNaN(birthDate.getTime())) {
    return false;
  }

  const reference = referenceDate ?? new Date();
  return (
    birthDate.getMonth() === reference.getMonth() &&
    birthDate.getDate() === reference.getDate()
  );
}

function renderBirthdays(entries) {
  const { birthdaySection, birthdayList, birthdayEmpty } = elements;

  if (!birthdaySection || !birthdayList || !birthdayEmpty) {
    return;
  }

  if (!state.accessRole) {
    birthdaySection.hidden = true;
    birthdayList.innerHTML = "";
    birthdayList.hidden = true;
    birthdayEmpty.hidden = true;
    return;
  }

  birthdaySection.hidden = false;
  birthdayList.innerHTML = "";

  if (!entries.length) {
    birthdayList.hidden = true;
    birthdayEmpty.hidden = false;
    return;
  }

  birthdayList.hidden = false;
  birthdayEmpty.hidden = true;

  const sortedEntries = entries.slice().sort((first, second) => {
    const nameA = typeof first.name === "string" ? first.name : "";
    const nameB = typeof second.name === "string" ? second.name : "";
    return collator.compare(nameA, nameB);
  });

  sortedEntries.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "birthday-item";

    const name = document.createElement("span");
    name.className = "birthday-name";
    name.textContent = entry.name?.trim() || translate("birthdays.nameFallback");
    item.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "birthday-meta";

    const age = Number.isFinite(entry.age) ? entry.age : null;
    const ageSpan = document.createElement("span");
    ageSpan.textContent =
      age != null
        ? translate("birthdays.age", { age })
        : translate("birthdays.ageMissing");
    meta.appendChild(ageSpan);

    if (entry.phone) {
      const phoneSpan = document.createElement("span");
      phoneSpan.textContent = formatPhone(entry.phone);
      meta.appendChild(phoneSpan);
    }

    item.appendChild(meta);

    item.addEventListener("click", () => {
      openRecord(entry.record);
    });

    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openRecord(entry.record);
      }
    });

    birthdayList.appendChild(item);
  });
}

function updateBirthdays() {
  if (!elements.birthdaySection) {
    return;
  }

  if (elements.birthdayEmpty) {
    elements.birthdayEmpty.textContent =
      state.accessRole === ACCESS_ROLES.CAPTAIN
        ? translate("birthdays.empty.teens")
        : translate("birthdays.empty.general");
  }

  if (!state.accessRole) {
    renderBirthdays([]);
    return;
  }

  const today = new Date();
  const accessibleEntries = getAccessibleEntries();
  const birthdayEntries = accessibleEntries.filter((entry) =>
    isBirthdayToday(entry.birthDate, today)
  );

  renderBirthdays(birthdayEntries);
}

function isAssistantOpen() {
  return elements.assistantPanel && !elements.assistantPanel.hasAttribute("hidden");
}

function clearAssistantTypingIndicators() {
  state.assistant.typingTimeouts.forEach((timeout) => {
    clearTimeout(timeout);
  });
  state.assistant.typingTimeouts.clear();

  if (!elements.assistantConversation) {
    return;
  }

  elements.assistantConversation
    .querySelectorAll(".assistant-message.typing")
    .forEach((node) => node.remove());
}

function getAssistantUserPrefix() {
  const name = typeof state.activeUserName === "string"
    ? state.activeUserName.trim()
    : "";
  return name ? `${name}, ` : "";
}

function getAssistantGreetingMessage() {
  const name =
    typeof state.activeUserName === "string"
      ? state.activeUserName.trim()
      : "";
  return translate("assistant.greeting", { name });
}

function withAssistantUserPrefix(message) {
  const prefix = getAssistantUserPrefix();
  if (!prefix) {
    return message;
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return prefix.trimEnd();
  }

  return `${prefix}${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
}

function setAssistantOpen(open) {
  if (!elements.assistantPanel || !elements.assistantToggle) {
    return;
  }

  if (open) {
    if (!state.assistant.questionsRendered) {
      renderAssistantQuestions();
    }

    elements.assistantPanel.hidden = false;
    elements.assistantToggle.setAttribute("aria-expanded", "true");
    if (!state.assistant.greeted) {
      appendAssistantMessage("assistant", getAssistantGreetingMessage());
      state.assistant.greeted = true;
    }
  } else {
    elements.assistantPanel.hidden = true;
    elements.assistantToggle.setAttribute("aria-expanded", "false");
    state.assistant.customMode = false;
    clearAssistantTypingIndicators();
    if (elements.assistantForm) {
      elements.assistantForm.hidden = true;
    }
  }
}

function closeAssistant() {
  setAssistantOpen(false);
}

function appendAssistantMessage(author, message) {
  if (!elements.assistantConversation || !message) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = `assistant-message ${author}`;

  const heading = document.createElement("strong");
  heading.textContent =
    author === "assistant"
      ? translate("assistant.title")
      : state.activeUserName?.trim() || translate("assistant.userLabel");
  wrapper.appendChild(heading);

  const body = document.createElement("p");
  body.textContent = message;
  wrapper.appendChild(body);

  elements.assistantConversation.appendChild(wrapper);
  elements.assistantConversation.scrollTop =
    elements.assistantConversation.scrollHeight;
}

function queueAssistantResponse(message) {
  if (!elements.assistantConversation) {
    return;
  }

  const resolveMessage =
    typeof message === "function" ? message : () => message;

  const wrapper = document.createElement("div");
  wrapper.className = "assistant-message assistant typing";

  const heading = document.createElement("strong");
  heading.textContent = translate("assistant.title");
  wrapper.appendChild(heading);

  const body = document.createElement("p");
  body.className = "assistant-typing";
  body.append(translate("assistant.typing"));

  const dots = document.createElement("span");
  dots.className = "typing-dots";

  for (let index = 0; index < 3; index += 1) {
    const dot = document.createElement("span");
    dots.appendChild(dot);
  }

  body.append(" ");
  body.appendChild(dots);
  wrapper.appendChild(body);

  elements.assistantConversation.appendChild(wrapper);
  elements.assistantConversation.scrollTop =
    elements.assistantConversation.scrollHeight;

  const timeout = setTimeout(() => {
    wrapper.remove();
    state.assistant.typingTimeouts.delete(timeout);
    appendAssistantMessage("assistant", resolveMessage());
  }, 2000);

  state.assistant.typingTimeouts.add(timeout);
}

function renderAssistantQuestions() {
  if (!elements.assistantQuestions) {
    return;
  }

  elements.assistantQuestions.innerHTML = "";

  const questions = getAssistantQuestionSet();

  questions.forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = translate(question.labelKey);
    button.dataset.assistantQuestion = question.id;
    elements.assistantQuestions.appendChild(button);
  });

  state.assistant.questionsRendered = true;
}

function getAssistantRoleKey() {
  if (state.accessRole === ACCESS_ROLES.CAPTAIN) {
    return "capitao";
  }
  if (state.accessRole === ACCESS_ROLES.SERVICES) {
    return "servicos";
  }
  return "responsavel";
}

function translateAssistantForRole(baseKey) {
  const roleKey = getAssistantRoleKey();
  const key = `${baseKey}.${roleKey}`;
  const translation = translate(key);
  if (translation === key && roleKey !== "responsavel") {
    return translate(`${baseKey}.responsavel`);
  }
  return translation;
}

function getAssistantAnswer(questionId) {
  switch (questionId) {
    case "refresh":
      return withAssistantUserPrefix(
        translateAssistantForRole("assistant.answers.refresh")
      );
    case "search":
      return withAssistantUserPrefix(
        translateAssistantForRole("assistant.answers.search")
      );
    case "categories":
      return withAssistantUserPrefix(
        translateAssistantForRole("assistant.answers.categories")
      );
    case "assignService":
      return withAssistantUserPrefix(
        translateAssistantForRole("assistant.answers.assignService")
      );
    case "removeService":
      return withAssistantUserPrefix(
        translateAssistantForRole("assistant.answers.removeService")
      );
    case "filterServices":
      return withAssistantUserPrefix(
        translateAssistantForRole("assistant.answers.filterServices")
      );
    default:
      return withAssistantUserPrefix(translate("assistant.answers.fallback"));
  }
}

function generateCustomAssistantAnswer(questionText) {
  const cleanedQuestion = questionText.trim();
  const scopeMessage = translateAssistantForRole("assistant.customScope");

  return withAssistantUserPrefix(
    [
      translate("assistant.customReceived", { question: cleanedQuestion }),
      scopeMessage,
      translate("assistant.customFollowUp"),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function handleAssistantQuestionSelection(questionId) {
  const question = getAssistantQuestionById(questionId);
  if (!question) {
    return;
  }

  if (question.custom) {
    if (!state.assistant.customMode) {
      appendAssistantMessage(
        "assistant",
        withAssistantUserPrefix(
          translate("assistant.customIntro")
        )
      );
    }
    state.assistant.customMode = true;
    if (elements.assistantForm) {
      elements.assistantForm.hidden = false;
    }
    elements.assistantInput?.focus();
    return;
  }

  state.assistant.customMode = false;
  if (elements.assistantForm) {
    elements.assistantForm.hidden = true;
  }

  appendAssistantMessage("user", translate(question.labelKey));
  queueAssistantResponse(() => getAssistantAnswer(question.id));
}

function handleAssistantFormSubmit(event) {
  event.preventDefault();
  if (!elements.assistantInput) {
    return;
  }

  const value = elements.assistantInput.value.trim();
  if (!value) {
    elements.assistantInput.focus();
    return;
  }

  appendAssistantMessage("user", value);
  queueAssistantResponse(() => generateCustomAssistantAnswer(value));
  elements.assistantInput.value = "";
  state.assistant.customMode = false;
  if (elements.assistantForm) {
    elements.assistantForm.hidden = true;
  }
}

function setupAssistant() {
  if (!elements.assistantToggle || !elements.assistantPanel) {
    return;
  }

  elements.assistantToggle.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest("img")) {
      return;
    }

    event.preventDefault();
    if (isAssistantOpen()) {
      closeAssistant();
      elements.assistantToggle?.focus();
    } else {
      setAssistantOpen(true);
      elements.assistantPanel.focus?.();
    }
  });

  elements.assistantToggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setAssistantOpen(!isAssistantOpen());
      if (isAssistantOpen()) {
        elements.assistantPanel.focus?.();
      } else {
        elements.assistantToggle?.focus();
      }
    }
  });

  if (elements.assistantClose) {
    elements.assistantClose.addEventListener("click", () => {
      closeAssistant();
      elements.assistantToggle?.focus();
    });
  }

  if (elements.assistantQuestions) {
    elements.assistantQuestions.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-assistant-question]");
      if (!button) return;
      if (!isAssistantOpen()) {
        setAssistantOpen(true);
      }
      handleAssistantQuestionSelection(button.dataset.assistantQuestion);
    });
  }

  if (elements.assistantForm) {
    elements.assistantForm.addEventListener("submit", handleAssistantFormSubmit);
  }

  setAssistantOpen(false);
}

function parseDate(rawValue) {
  if (!rawValue) return null;

  if (rawValue instanceof Date) {
    return rawValue;
  }

  if (typeof rawValue === "string") {
    const dateFromGviz = rawValue.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
    if (dateFromGviz) {
      const [_, year, month, day, hour = "0", minute = "0", second = "0"] = dateFromGviz;
      return new Date(
        Number(year),
        Number(month),
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      );
    }

    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof rawValue === "number") {
    // Pode ser um número serial do Google Sheets (dias desde 1899-12-30)
    const baseDate = new Date(Date.UTC(1899, 11, 30));
    const milliseconds = rawValue * 24 * 60 * 60 * 1000;
    return new Date(baseDate.getTime() + milliseconds);
  }

  return null;
}

function calculateAge(date) {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

function buildAgeDistribution(entries) {
  const counts = new Map();

  entries.forEach(({ age }) => {
    if (!Number.isFinite(age) || age < 0) return;
    counts.set(age, (counts.get(age) ?? 0) + 1);
  });

  const ages = Array.from(counts.keys()).sort((a, b) => a - b);

  return {
    labels: ages.map((age) => String(age)),
    data: ages.map((age) => counts.get(age)),
  };
}

function createChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {
          color: "#cbd5f5",
        },
        grid: {
          color: "rgba(148, 163, 184, 0.15)",
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: "#cbd5f5",
        },
        grid: {
          color: "rgba(148, 163, 184, 0.12)",
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "rgba(56, 189, 248, 0.4)",
      },
    },
  };
}

function updateOverallChart(entries) {
  if (!elements.overallChart || !elements.overallEmpty) return;

  const distribution = buildAgeDistribution(entries);
  const hasData = distribution.labels.length > 0;

  elements.overallChart.style.display = hasData ? "block" : "none";
  elements.overallEmpty.classList.toggle("visible", !hasData);

  if (!hasData) {
    if (state.charts.overall) {
      state.charts.overall.destroy();
      state.charts.overall = null;
    }
    return;
  }

  if (typeof Chart === "undefined") {
    console.warn("Chart.js was not loaded. Charts will not be displayed.");
    return;
  }

  const dataset = {
    label: translate("overview.datasetLabel"),
    backgroundColor: "rgba(56, 189, 248, 0.35)",
    borderColor: "#38bdf8",
    borderWidth: 2,
    borderRadius: 8,
    data: distribution.data,
  };

  if (!state.charts.overall) {
    state.charts.overall = new Chart(elements.overallChart.getContext("2d"), {
      type: "bar",
      data: {
        labels: distribution.labels,
        datasets: [dataset],
      },
      options: createChartOptions(),
    });
  } else {
    const chart = state.charts.overall;
    chart.data.labels = distribution.labels;
    chart.data.datasets[0].label = translate("overview.datasetLabel");
    chart.data.datasets[0].data = distribution.data;
    chart.update();
  }
}

function updateCategoryChart(entries, category, options = {}) {
  if (!elements.categoryChart || !elements.categoryChartEmpty) return;

  const validEntries = entries.filter((entry) => Number.isFinite(entry.age));
  const distribution = buildAgeDistribution(validEntries);
  const hasData = distribution.labels.length > 0;

  elements.categoryChart.style.display = hasData ? "block" : "none";
  elements.categoryChartEmpty.classList.toggle("visible", !hasData);

  if (!hasData) {
    if (state.charts.category) {
      state.charts.category.destroy();
      state.charts.category = null;
    }
    const emptyMessage =
      options.emptyMessage ?? translate("category.chartEmpty");
    elements.categoryChartEmpty.textContent = emptyMessage;
    return;
  }

  if (typeof Chart === "undefined") {
    console.warn("Chart.js was not loaded. Charts will not be displayed.");
    return;
  }

  const datasetLabel =
    options.datasetLabel ?? translateCategoryField(category, "chartLabel");
  const dataset = {
    label: datasetLabel,
    backgroundColor: "rgba(56, 189, 248, 0.35)",
    borderColor: "#38bdf8",
    borderWidth: 2,
    borderRadius: 8,
    data: distribution.data,
  };

  if (!state.charts.category) {
    state.charts.category = new Chart(elements.categoryChart.getContext("2d"), {
      type: "bar",
      data: {
        labels: distribution.labels,
        datasets: [dataset],
      },
      options: createChartOptions(),
    });
  } else {
    const chart = state.charts.category;
    chart.data.labels = distribution.labels;
    chart.data.datasets[0].label = datasetLabel;
    chart.data.datasets[0].data = distribution.data;
    chart.update();
  }
}

function ensureServiceManagerFilterOptions() {
  if (!elements.serviceManagerFilter) {
    return;
  }

  const select = elements.serviceManagerFilter;
  const previousValue = select.value;
  const options = [
    { value: "all", label: translate("serviceManager.filters.all") },
    { value: "active", label: translate("serviceManager.filters.active") },
    {
      value: SERVICE_FILTER_UNASSIGNED,
      label: translate("serviceManager.filters.unassigned"),
    },
    ...getAllServiceOptions().map((option) => ({
      value: option.id,
      label: getServiceOptionLabel(option),
    })),
  ];

  select.innerHTML = "";

  options.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });

  const hasPrevious = options.some((option) => option.value === previousValue);
  if (hasPrevious) {
    select.value = previousValue;
  }
}

function updateServiceFeedback(entry) {
  if (!elements.serviceFeedback) {
    return;
  }

  if (!entry) {
    elements.serviceFeedback.textContent = "";
    return;
  }

  const assignment = entry.service ?? EMPTY_SERVICE_ASSIGNMENT;
  if (assignment.active && Array.isArray(assignment.services)) {
    const names = assignment.services
      .map((serviceId) => translateServiceName(serviceId))
      .filter(Boolean);
    if (names.length) {
      elements.serviceFeedback.textContent = translate(
        "services.feedback.active",
        { service: names.join(", ") }
      );
      return;
    }
  }

  elements.serviceFeedback.textContent = translate(
    "services.feedback.inactive"
  );
}

function hideServiceControls() {
  if (!elements.serviceControls) {
    return;
  }
  elements.serviceControls.hidden = true;
  if (elements.serviceTags) {
    elements.serviceTags.innerHTML = "";
    elements.serviceTags.setAttribute("hidden", "");
  }
  if (elements.serviceTagsLabel) {
    elements.serviceTagsLabel.textContent = "";
  }
  if (elements.serviceChecklist) {
    elements.serviceChecklist.setAttribute("disabled", "");
    elements.serviceChecklist.setAttribute("hidden", "");
  }
  if (elements.serviceChecklistOptions) {
    elements.serviceChecklistOptions
      .querySelectorAll('input[type="checkbox"]')
      .forEach((input) => {
        input.checked = false;
      });
    elements.serviceChecklistOptions.innerHTML = "";
  }
  updateServiceFeedback(null);
}

function renderServiceOptions(container, selectedServices, options = {}) {
  if (!container) {
    return;
  }

  const { disabled = false, optionClass = "service-option", onChange } = options;

  const selectedSet = new Set(
    Array.isArray(selectedServices)
      ? selectedServices
          .map((serviceId) => sanitizeServiceId(serviceId))
          .filter(Boolean)
      : []
  );

  container.innerHTML = "";

  getAllServiceOptions().forEach((option) => {
    const label = document.createElement("label");
    label.className = optionClass;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = option.id;
    input.checked = selectedSet.has(option.id);
    input.disabled = disabled;
    input.addEventListener("change", () => {
      if (typeof onChange !== "function") {
        return;
      }
      const services = Array.from(
        container.querySelectorAll('input[type="checkbox"]:checked')
      )
        .map((checkbox) => sanitizeServiceId(checkbox.value))
        .filter(Boolean);
      onChange(services);
    });

    const span = document.createElement("span");
    span.textContent = getServiceOptionLabel(option);

    label.append(input, span);
    container.appendChild(label);
  });
}

function renderServiceControls(entry) {
  if (
    !elements.serviceControls ||
    !elements.serviceSelectLabel ||
    !elements.serviceChecklist ||
    !elements.serviceChecklistOptions ||
    !elements.serviceFeedback ||
    !elements.serviceTags ||
    !elements.serviceTagsLabel
  ) {
    return;
  }

  if (!entry) {
    hideServiceControls();
    return;
  }

  elements.serviceControls.hidden = false;
  elements.serviceTagsLabel.textContent = translate("services.tagsLabel");

  const assignment = entry.service ?? EMPTY_SERVICE_ASSIGNMENT;
  const services = Array.isArray(assignment.services)
    ? assignment.services.map((serviceId) => sanitizeServiceId(serviceId)).filter(Boolean)
    : [];

  elements.serviceTags.innerHTML = "";
  if (services.length) {
    elements.serviceTags.removeAttribute("hidden");
    services.forEach((serviceId) => {
      const tag = document.createElement("span");
      tag.className = "service-tag";
      tag.textContent = translateServiceName(serviceId);
      elements.serviceTags.appendChild(tag);
    });
  } else {
    elements.serviceTags.setAttribute("hidden", "");
  }

  updateServiceFeedback(entry);

  if (!canManageServices()) {
    elements.serviceChecklist.setAttribute("disabled", "");
    elements.serviceChecklist.setAttribute("hidden", "");
    elements.serviceChecklistOptions.innerHTML = "";
    elements.serviceSelectLabel.textContent = translate("services.selectLabel");
    return;
  }

  elements.serviceSelectLabel.textContent = translate("services.selectLabel");
  elements.serviceChecklist.removeAttribute("disabled");
  elements.serviceChecklist.removeAttribute("hidden");

  renderServiceOptions(elements.serviceChecklistOptions, services, {
    disabled: false,
    optionClass: "service-option",
    onChange: (updatedServices) => {
      updateServiceAssignment(entry, {
        active: updatedServices.length > 0,
        services: updatedServices,
      });
      renderServiceControls(entry);
    },
  });
}

function refreshActiveServiceInterfaces({ preserveSelection = true } = {}) {
  const modalVisible =
    elements.serviceAssignmentModal &&
    !elements.serviceAssignmentModal.hidden &&
    state.activeServiceModalEntry;

  if (modalVisible) {
    populateServiceAssignmentModal(state.activeServiceModalEntry, {
      preserveSelection,
    });
  }

  if (state.activeDetailEntry) {
    renderServiceControls(state.activeDetailEntry);
  }
}

function hideServiceSummary() {
  if (elements.serviceSummary) {
    elements.serviceSummary.hidden = true;
  }
  if (elements.serviceSummaryGrid) {
    elements.serviceSummaryGrid.innerHTML = "";
  }
}

function renderServiceSummaryCards(summary) {
  if (!elements.serviceSummary || !elements.serviceSummaryGrid) {
    return;
  }

  elements.serviceSummary.hidden = false;
  if (elements.serviceSummaryTitle) {
    elements.serviceSummaryTitle.textContent = translate(
      "services.summaryTitle"
    );
  }
  if (elements.serviceSummaryDescription) {
    elements.serviceSummaryDescription.textContent = translate(
      "services.summaryDescription"
    );
  }

  const cards = [
    {
      id: SERVICE_FILTER_ALL,
      label: translate("services.filters.all"),
      count: summary?.total ?? 0,
      type: "all",
    },
    {
      id: SERVICE_FILTER_UNASSIGNED,
      label: translate("services.filters.unassigned"),
      count: summary?.unassigned ?? 0,
      type: "unassigned",
    },
    ...getAllServiceOptions().map((option) => ({
      id: option.id,
      label: getServiceOptionLabel(option),
      count: summary?.perService?.[option.id] ?? 0,
      type: "service",
    })),
  ];

  elements.serviceSummaryGrid.innerHTML = "";

  cards.forEach(({ id, label, count, type }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "service-summary-card";
    button.dataset.serviceId = id;
    if (state.activeServiceFilter === id) {
      button.classList.add("active");
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }

    const title = document.createElement("strong");
    title.textContent = label;
    const meta = document.createElement("span");
    const metaKey =
      type === "unassigned"
        ? "services.countLabelUnassigned"
        : "services.countLabel";
    meta.textContent = translate(metaKey, { count });

    button.append(title, meta);
    elements.serviceSummaryGrid.appendChild(button);
  });
}

function updateCategoryCards(entries, category, options = {}) {
  const container = elements.categoryCards;
  if (!container || !elements.categoryEmpty) {
    return;
  }
  container.innerHTML = "";

  if (!entries.length) {
    const emptyMessage =
      options.emptyMessage ?? translateCategoryField(category, "emptyMessage");
    elements.categoryEmpty.textContent = emptyMessage;
    elements.categoryEmpty.classList.add("visible");
    return;
  }

  elements.categoryEmpty.classList.remove("visible");

  const sortedEntries = [...entries].sort((a, b) =>
    collator.compare(a.name || "", b.name || "")
  );

  sortedEntries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "person-card";
    card.tabIndex = 0;

    const nameElement = document.createElement("strong");
    nameElement.textContent = entry.name || translate("modal.noName");

    const ageElement = document.createElement("span");
    ageElement.textContent = translate("people.ageLabel", {
      value: formatAge(entry.age),
    });

    const phoneElement = document.createElement("span");
    phoneElement.textContent = translate("people.phoneLabel", {
      value: formatPhone(entry.phone),
    });

    card.append(nameElement, ageElement, phoneElement);

    if (hasActiveServices(entry)) {
      const tagList = document.createElement("div");
      tagList.className = "service-tags";

      const tag = document.createElement("span");
      tag.className = "service-tag service-tag--status";
      tag.textContent = translate("people.servingTag");
      tagList.appendChild(tag);

      card.appendChild(tagList);
    }

    card.addEventListener("click", () => openRecord(entry.record));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openRecord(entry.record);
      }
    });

    container.appendChild(card);
  });
}

function getAccessibleParentEntries() {
  if (!state.accessRole) {
    return [];
  }

  if (
    state.accessRole === ACCESS_ROLES.RESPONSIBLE ||
    state.accessRole === ACCESS_ROLES.CAPTAIN
  ) {
    return state.parentEntries ?? [];
  }

  return [];
}

async function handleParentCardSelection(entry) {
  if (!entry) {
    return;
  }

  const availableRoles = [];
  if (entry.father) availableRoles.push("father");
  if (entry.mother) availableRoles.push("mother");

  if (!availableRoles.length) {
    setStatus(translate("parents.noDetails"));
    return;
  }

  const selectedRole = await openParentChoice(entry, availableRoles);
  if (!selectedRole) {
    return;
  }

  openParentDetail(entry, selectedRole);
}

function renderParentCards(entries, category) {
  const container = elements.categoryCards;
  if (!container || !elements.categoryEmpty) {
    return;
  }

  container.innerHTML = "";

  if (!entries.length) {
    elements.categoryEmpty.textContent = translateCategoryField(
      category,
      "emptyMessage"
    );
    elements.categoryEmpty.classList.add("visible");
    return;
  }

  elements.categoryEmpty.classList.remove("visible");

  const sortedEntries = [...entries].sort((a, b) =>
    collator.compare(a.childName || "", b.childName || "")
  );

  sortedEntries.forEach((item) => {
    const card = document.createElement("article");
    card.className = "parent-card";
    card.tabIndex = 0;

    const fatherName = item.father?.name?.trim() || translate("parents.labels.unknown");
    const motherName = item.mother?.name?.trim() || translate("parents.labels.unknown");
    const childName = item.childName?.trim() || translate("modal.noName");

    const fatherLine = document.createElement("strong");
    fatherLine.className = "parent-line parent-line-father";
    fatherLine.textContent = translate("parents.card.father", { name: fatherName });

    const motherLine = document.createElement("strong");
    motherLine.className = "parent-line parent-line-mother";
    motherLine.textContent = translate("parents.card.mother", { name: motherName });

    const childLine = document.createElement("span");
    childLine.className = "parent-line parent-line-child";
    childLine.textContent = translate("parents.card.child", { name: childName });

    card.append(fatherLine, motherLine, childLine);

    card.addEventListener("click", () => {
      handleParentCardSelection(item);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleParentCardSelection(item);
      }
    });

    container.appendChild(card);
  });
}

function getCareNetworkEntries() {
  const entries = state.careNetwork?.entries;
  return Array.isArray(entries) ? entries : [];
}

function resolveCareNetworkFieldValue(entry, candidateKeys) {
  if (!entry || !Array.isArray(candidateKeys) || !candidateKeys.length) {
    return "";
  }

  const normalizedCandidates = candidateKeys
    .map((key) => normalizeString(key))
    .filter(Boolean);

  if (!normalizedCandidates.length) {
    return "";
  }

  const map = entry.fieldMap instanceof Map ? entry.fieldMap : null;
  if (map) {
    for (const candidate of normalizedCandidates) {
      for (const [key, value] of map.entries()) {
        if (!key || value == null) {
          continue;
        }

        if (
          key === candidate ||
          key.includes(candidate) ||
          candidate.includes(key)
        ) {
          const stringValue =
            typeof value === "string" ? value.trim() : String(value).trim();
          if (stringValue) {
            return stringValue;
          }
        }
      }
    }
  }

  const fields = Array.isArray(entry.fields) ? entry.fields : [];
  for (const candidate of normalizedCandidates) {
    for (const field of fields) {
      const normalizedKey = normalizeString(field?.key);
      if (!normalizedKey) {
        continue;
      }

      if (
        normalizedKey === candidate ||
        normalizedKey.includes(candidate) ||
        candidate.includes(normalizedKey)
      ) {
        const rawValue = field?.value;
        const stringValue =
          rawValue == null
            ? ""
            : typeof rawValue === "string"
            ? rawValue.trim()
            : String(rawValue).trim();
        if (stringValue) {
          return stringValue;
        }
      }
    }
  }

  return "";
}

function renderCareNetworkCards(entries, category) {
  hideServiceSummary();
  const container = elements.categoryCards;
  if (!container || !elements.categoryEmpty) {
    return;
  }

  container.innerHTML = "";

  if (!entries.length) {
    elements.categoryEmpty.textContent = translateCategoryField(
      category,
      "emptyMessage"
    );
    elements.categoryEmpty.classList.add("visible");
    return;
  }

  elements.categoryEmpty.classList.remove("visible");

  const sortedEntries = [...entries].sort((a, b) =>
    collator.compare(a.name || "", b.name || "")
  );

  sortedEntries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "care-card";

    const hasRecord = Boolean(entry.person?.record);
    const handleOpen = () => {
      if (hasRecord) {
        openRecord(entry.person.record);
      } else {
        openCareNetworkEntryDetail(entry);
      }
    };

    card.classList.add("care-card--interactive");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.removeAttribute("aria-disabled");
    card.addEventListener("click", handleOpen);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleOpen();
      }
    });

    const title = document.createElement("strong");
    title.textContent = entry.name || translate("modal.noName");
    card.appendChild(title);

    const details = document.createElement("dl");
    details.className = "care-card-details";

    const missingText = translate("careNetwork.cardValueMissing");
    const addDetail = (label, value) => {
      const trimmedLabel = typeof label === "string" ? label.trim() : "";
      if (!trimmedLabel) {
        return;
      }

      const dt = document.createElement("dt");
      dt.textContent = trimmedLabel;

      const dd = document.createElement("dd");
      const isString = typeof value === "string";
      const trimmed = isString ? value.trim() : value;
      const displayValue =
        trimmed == null || (isString && !trimmed)
          ? missingText
          : isString
          ? trimmed
          : String(value);
      dd.textContent = displayValue;

      details.append(dt, dd);
    };

    const phoneLabel = translate("careNetwork.cardPhoneLabel");
    if (phoneLabel) {
      const phoneValue = resolveCareNetworkFieldValue(
        entry,
        CARE_NETWORK_PHONE_KEYS
      );
      addDetail(phoneLabel, formatPhone(phoneValue));
    }

    const approachedLabel = translate("careNetwork.cardApproachedByLabel");
    if (approachedLabel) {
      const approachedValue = resolveCareNetworkFieldValue(
        entry,
        CARE_NETWORK_APPROACH_KEYS
      );
      addDetail(
        approachedLabel,
        approachedValue || missingText
      );
    }

    card.appendChild(details);

    container.appendChild(card);
  });
}

function renderCareNetworkCategory(category) {
  if (elements.teensFilter) {
    elements.teensFilter.hidden = true;
  }

  hideServiceSummary();

  if (state.charts.category) {
    state.charts.category.destroy();
    state.charts.category = null;
  }

  if (elements.categoryChart) {
    elements.categoryChart.style.display = "none";
  }

  if (elements.categoryChartEmpty) {
    elements.categoryChartEmpty.textContent = translate("careNetwork.chartEmpty");
    elements.categoryChartEmpty.classList.add("visible");
  }

  const entries = getCareNetworkEntries();

  if (elements.categoryMeta) {
    const assigned = state.careNetwork?.summary?.assigned ?? 0;
    const total = state.careNetwork?.summary?.total ?? entries.length;
    elements.categoryMeta.textContent = translate("careNetwork.meta", {
      assigned,
      total,
    });
  }

  renderCareNetworkCards(entries, category);
}

function openCareNetworkEntryDetail(entry) {
  if (!entry) {
    return;
  }

  const detailItems = [];
  const servicesLabel = translate("careNetwork.servicesTitle");
  if (servicesLabel) {
    const serviceList = Array.isArray(entry.services) ? entry.services : [];
    const combinedText = serviceList.length
      ? serviceList.join(", ")
      : String(entry.serviceText ?? "").trim();
    const displayServices = combinedText
      ? combinedText
      : translate("careNetwork.detailValueNone");
    detailItems.push({ key: servicesLabel, value: displayServices });
  }

  if (Array.isArray(entry.fields)) {
    entry.fields.forEach(({ key, value }) => {
      if (value == null) {
        return;
      }
      const stringValue = typeof value === "string" ? value.trim() : String(value);
      if (!stringValue) {
        return;
      }
      const label = translate("careNetwork.fieldLabel", { field: key }) || key || "";
      detailItems.push({ key: label, value: stringValue });
    });
  }

  state.activeDetailEntry = null;
  hideServiceControls();
  openDetailModal(
    entry.name?.trim() || translate("modal.noName"),
    detailItems,
    { searchValue: entry.name ?? "" }
  );
}

function renderParentsCategory(category) {
  if (elements.teensFilter) {
    elements.teensFilter.hidden = true;
  }

  hideServiceSummary();

  const entries = getAccessibleParentEntries();
  state.parentSummary = summarizeParentEntries(entries);

  if (elements.categoryMeta) {
    const { parents, families } = state.parentSummary;
    elements.categoryMeta.textContent = translate("parents.meta", {
      parents,
      families,
    });
  }

  if (state.charts.category) {
    state.charts.category.destroy();
    state.charts.category = null;
  }

  if (elements.categoryChart) {
    elements.categoryChart.style.display = "none";
  }

  if (elements.categoryChartEmpty) {
    elements.categoryChartEmpty.textContent = translate("parents.chartEmpty");
    elements.categoryChartEmpty.classList.add("visible");
  }

  renderParentCards(entries, category);
}

function renderServicesCategory(category) {
  if (elements.teensFilter) {
    elements.teensFilter.hidden = true;
  }

  const summary =
    state.accessibleServiceSummary ?? { total: 0, unassigned: 0, perService: {} };
  ensureActiveServiceFilterValid(summary);
  renderServiceSummaryCards(summary);

  const accessibleEntries = getAccessibleEntries();
  const servingEntries = accessibleEntries.filter((entry) =>
    category.filter(entry)
  );

  let filteredEntries;
  if (state.activeServiceFilter === SERVICE_FILTER_UNASSIGNED) {
    filteredEntries = accessibleEntries.filter((entry) => !hasActiveServices(entry));
  } else if (state.activeServiceFilter === SERVICE_FILTER_ALL) {
    filteredEntries = servingEntries;
  } else {
    filteredEntries = servingEntries.filter((entry) => {
      const services = Array.isArray(entry.service?.services)
        ? entry.service.services.map((serviceId) => sanitizeServiceId(serviceId)).filter(Boolean)
        : [];
      return services.includes(state.activeServiceFilter);
    });
  }

  if (elements.categoryMeta) {
    const noun =
      filteredEntries.length === 1
        ? translate("category.nounSingular")
        : translate("category.nounPlural");
    const filterLabel =
      state.activeServiceFilter === SERVICE_FILTER_ALL
        ? translate("services.meta.all")
        : state.activeServiceFilter === SERVICE_FILTER_UNASSIGNED
        ? translate("services.meta.unassigned")
        : translate("services.meta.service", {
            service: translateServiceName(state.activeServiceFilter),
          });
    elements.categoryMeta.textContent = translate("category.meta", {
      count: filteredEntries.length,
      noun,
      filter: filterLabel,
    });
  }

  const emptyMessage =
    state.activeServiceFilter === SERVICE_FILTER_ALL
      ? translate("services.empty.all")
      : state.activeServiceFilter === SERVICE_FILTER_UNASSIGNED
      ? translate("services.empty.unassigned")
      : translate("services.empty.service", {
          service: translateServiceName(state.activeServiceFilter),
        });

  const baseChartLabel = translateCategoryField(category, "chartLabel");
  const chartLabel =
    state.activeServiceFilter === SERVICE_FILTER_ALL
      ? baseChartLabel
      : state.activeServiceFilter === SERVICE_FILTER_UNASSIGNED
      ? translate("services.chartLabelUnassigned")
      : `${baseChartLabel} · ${translateServiceName(state.activeServiceFilter)}`;

  updateCategoryCards(filteredEntries, category, { emptyMessage });
  updateCategoryChart(filteredEntries, category, {
    datasetLabel: chartLabel,
    emptyMessage,
  });
}

function formatServiceStatusText(entry) {
  const assignment = entry?.service ?? EMPTY_SERVICE_ASSIGNMENT;
  if (assignment.active && Array.isArray(assignment.services)) {
    const names = assignment.services
      .map((serviceId) => translateServiceName(serviceId))
      .filter(Boolean);
    if (names.length) {
      return translate("services.feedback.active", {
        service: names.join(", "),
      });
    }
  }
  return translate("services.feedback.inactive");
}

function getServiceAssignmentModalSelectedServices() {
  if (!elements.serviceAssignmentOptions) {
    return [];
  }
  return Array.from(
    elements.serviceAssignmentOptions.querySelectorAll(
      'input[type="checkbox"]:checked'
    )
  )
    .map((input) => sanitizeServiceId(input.value))
    .filter(Boolean);
}

function updateServiceAssignmentModalStatus() {
  if (!elements.serviceAssignmentStatus) {
    return;
  }

  const services = getServiceAssignmentModalSelectedServices();
  let statusText = translate("services.feedback.inactive");
  if (services.length) {
    const names = services
      .map((serviceId) => translateServiceName(serviceId))
      .filter(Boolean);
    if (names.length) {
      statusText = translate("services.feedback.active", {
        service: names.join(", "),
      });
    }
  }

  elements.serviceAssignmentStatus.textContent = statusText;
  elements.serviceAssignmentStatus.classList.toggle(
    "service-assignment-status-active",
    services.length > 0
  );
}

function populateServiceAssignmentModal(entry, options = {}) {
  const {
    preserveSelection = false,
  } = options;

  if (!entry || !elements.serviceAssignmentModal) {
    return;
  }

  const targetEntry =
    findEntryByRecord(entry.record) ??
    findEntryByServiceKey(entry.serviceKey) ??
    entry;

  state.activeServiceModalEntry = targetEntry;

  if (elements.serviceAssignmentTitle) {
    elements.serviceAssignmentTitle.textContent = translate(
      "serviceAssignment.title",
      {
        name: targetEntry.name || translate("modal.noName"),
      }
    );
  }

  if (elements.serviceAssignmentMeta) {
    elements.serviceAssignmentMeta.innerHTML = "";

    const ageSpan = document.createElement("span");
    ageSpan.textContent = translate("people.ageLabel", {
      value: formatAge(targetEntry.age),
    });
    elements.serviceAssignmentMeta.appendChild(ageSpan);

    const phoneSpan = document.createElement("span");
    const phoneValue = targetEntry.phone
      ? formatPhone(targetEntry.phone)
      : translate("format.phoneMissing");
    phoneSpan.textContent = translate("people.phoneLabel", {
      value: phoneValue,
    });
    elements.serviceAssignmentMeta.appendChild(phoneSpan);
  }

  if (elements.serviceAssignmentOptions) {
    const assignment = targetEntry.service ?? EMPTY_SERVICE_ASSIGNMENT;
    let selectedServices;
    if (preserveSelection) {
      selectedServices = getServiceAssignmentModalSelectedServices();
    } else if (assignment.active && Array.isArray(assignment.services)) {
      selectedServices = assignment.services
        .map((serviceId) => sanitizeServiceId(serviceId))
        .filter(Boolean);
    } else {
      selectedServices = [];
    }

    renderServiceOptions(elements.serviceAssignmentOptions, selectedServices, {
      disabled: false,
      optionClass: "service-assignment-option",
    });

    const hasOptions = elements.serviceAssignmentOptions.childElementCount > 0;
    if (elements.serviceAssignmentEmpty) {
      elements.serviceAssignmentEmpty.hidden = hasOptions;
    }
    if (elements.serviceAssignmentSave) {
      elements.serviceAssignmentSave.disabled = !hasOptions;
    }
  }

  updateServiceAssignmentModalStatus();
}

function openServiceAssignmentModal(entry, trigger = null) {
  if (!canManageServices()) {
    return;
  }

  if (!elements.serviceAssignmentModal) {
    return;
  }

  const targetEntry =
    findEntryByRecord(entry?.record) ??
    findEntryByServiceKey(entry?.serviceKey) ??
    entry;

  if (!targetEntry) {
    return;
  }

  closeModal();

  if (trigger) {
    state.activeServiceModalTrigger = trigger;
  } else {
    state.activeServiceModalTrigger = document.activeElement;
  }

  populateServiceAssignmentModal(targetEntry, { preserveSelection: false });

  elements.serviceAssignmentModal.hidden = false;
  elements.serviceAssignmentModal.setAttribute("aria-hidden", "false");
  refreshBodyScrollLock();

  setTimeout(() => {
    const firstOption = elements.serviceAssignmentOptions?.querySelector(
      'input[type="checkbox"]'
    );
    const focusTarget = firstOption || elements.serviceAssignmentSave;
    if (focusTarget && typeof focusTarget.focus === "function") {
      try {
        focusTarget.focus();
      } catch (error) {
        // Ignore focus errors
      }
    }
  }, 0);
}

function closeServiceAssignmentModal() {
  if (!elements.serviceAssignmentModal) {
    return;
  }
  if (elements.serviceAssignmentModal.hidden) {
    state.activeServiceModalEntry = null;
    state.activeServiceModalTrigger = null;
    return;
  }

  elements.serviceAssignmentModal.hidden = true;
  elements.serviceAssignmentModal.setAttribute("aria-hidden", "true");

  refreshBodyScrollLock();

  const trigger = state.activeServiceModalTrigger;
  state.activeServiceModalEntry = null;
  state.activeServiceModalTrigger = null;

  if (trigger && document.contains(trigger)) {
    try {
      trigger.focus();
    } catch (error) {
      // Ignore focus errors
    }
  } else if (elements.serviceManagerFilter) {
    try {
      elements.serviceManagerFilter.focus();
    } catch (error) {
      // Ignore focus errors
    }
  }
}

function handleServiceAssignmentOptionsChange(event) {
  if (!event || !event.target) {
    return;
  }
  if (!event.target.matches('input[type="checkbox"]')) {
    return;
  }
  updateServiceAssignmentModalStatus();
}

function handleServiceAssignmentSubmit(event) {
  event.preventDefault();

  if (!canManageServices()) {
    setStatusFromKey("serviceManager.restricted", {}, true);
    closeServiceAssignmentModal();
    return;
  }

  const entry = state.activeServiceModalEntry;
  if (!entry) {
    closeServiceAssignmentModal();
    return;
  }

  const services = getServiceAssignmentModalSelectedServices();
  updateServiceAssignment(entry, {
    active: services.length > 0,
    services,
  });
  setStatusFromKey("serviceAssignment.success", {
    name: entry.name || translate("modal.noName"),
  });
  closeServiceAssignmentModal();
}

function createServiceManagerCard(entry) {
  const card = document.createElement("article");
  card.className = "service-manager-card";

  const interactive = canManageServices();
  if (interactive) {
    card.classList.add("service-manager-card-interactive");
    card.tabIndex = 0;
    card.setAttribute(
      "role",
      "button"
    );
    card.setAttribute(
      "aria-label",
      translate("serviceAssignment.open", {
        name: entry.name || translate("modal.noName"),
      })
    );

    const handleOpen = (event) => {
      if (!canManageServices()) {
        return;
      }
      if (event) {
        event.preventDefault();
      }
      openServiceAssignmentModal(entry, card);
    };

    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) {
        return;
      }
      handleOpen(event);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleOpen();
      }
    });
  } else {
    card.setAttribute("role", "group");
  }

  const header = document.createElement("div");
  header.className = "service-manager-card-header";

  const nameHeading = document.createElement("h3");
  nameHeading.className = "service-manager-name";
  nameHeading.textContent = entry.name || translate("modal.noName");
  header.appendChild(nameHeading);

  const status = document.createElement("span");
  status.className = "service-manager-status";
  status.textContent = formatServiceStatusText(entry);
  header.appendChild(status);

  card.appendChild(header);

  const meta = document.createElement("div");
  meta.className = "service-manager-meta";

  const ageSpan = document.createElement("span");
  ageSpan.textContent = translate("people.ageLabel", {
    value: formatAge(entry.age),
  });
  meta.appendChild(ageSpan);

  const phoneSpan = document.createElement("span");
  const phoneValue = entry.phone
    ? formatPhone(entry.phone)
    : translate("format.phoneMissing");
  phoneSpan.textContent = translate("people.phoneLabel", { value: phoneValue });
  meta.appendChild(phoneSpan);

  card.appendChild(meta);

  const assignment = entry.service ?? EMPTY_SERVICE_ASSIGNMENT;
  const services = Array.isArray(assignment.services)
    ? assignment.services
        .map((serviceId) => sanitizeServiceId(serviceId))
        .filter(Boolean)
    : [];

  if (assignment.active && services.length) {
    const tags = document.createElement("div");
    tags.className = "service-manager-tags";

    services.forEach((serviceId) => {
      const tag = document.createElement("span");
      tag.className = "service-manager-tag";
      tag.textContent = translateServiceName(serviceId);
      tags.appendChild(tag);
    });

    card.appendChild(tags);
  } else {
    const tags = document.createElement("div");
    tags.className = "service-manager-tags";

    const tag = document.createElement("span");
    tag.className = "service-manager-tag";
    tag.textContent = translate("services.detailValueNone");
    tags.appendChild(tag);

    card.appendChild(tags);
  }

  return card;
}

function resetServiceFormFields() {
  if (elements.serviceManagerAddInput) {
    elements.serviceManagerAddInput.value = "";
  }
  if (elements.serviceManagerAddInputEn) {
    elements.serviceManagerAddInputEn.value = "";
  }
  if (elements.serviceManagerAddInputEs) {
    elements.serviceManagerAddInputEs.value = "";
  }
}

function exitServiceEditMode({ preserveValues = false } = {}) {
  state.editingServiceId = null;
  if (!preserveValues) {
    resetServiceFormFields();
  }
  if (elements.serviceManagerAddTitle) {
    elements.serviceManagerAddTitle.textContent = translate(
      "serviceManager.add.title"
    );
  }
  if (elements.serviceManagerAddButton) {
    elements.serviceManagerAddButton.textContent = translate(
      "serviceManager.add.button"
    );
  }
  if (elements.serviceManagerAddCancel) {
    elements.serviceManagerAddCancel.hidden = true;
  }
}

function enterServiceEditMode(optionId) {
  if (!canManageServices()) {
    setStatusFromKey("serviceManager.restricted", {}, true);
    return;
  }
  const option = optionId ? customServiceOptions.get(optionId) : null;
  if (!option) {
    return;
  }
  state.editingServiceId = optionId;
  if (elements.serviceManagerAddInput) {
    elements.serviceManagerAddInput.value = option.labels?.pt ?? option.label ?? "";
  }
  if (elements.serviceManagerAddInputEn) {
    elements.serviceManagerAddInputEn.value = option.labels?.en ?? option.label ?? "";
  }
  if (elements.serviceManagerAddInputEs) {
    elements.serviceManagerAddInputEs.value = option.labels?.es ?? option.label ?? "";
  }
  if (elements.serviceManagerAddTitle) {
    elements.serviceManagerAddTitle.textContent = translate(
      "serviceManager.edit.title",
      { name: option.labels?.pt ?? option.label ?? "" }
    );
  }
  if (elements.serviceManagerAddButton) {
    elements.serviceManagerAddButton.textContent = translate(
      "serviceManager.edit.button"
    );
  }
  if (elements.serviceManagerAddCancel) {
    elements.serviceManagerAddCancel.hidden = false;
  }
  if (elements.serviceManagerAddInput) {
    elements.serviceManagerAddInput.focus();
  }
  setStatusFromKey("serviceManager.edit.start", {
    name: getServiceOptionLabel(option),
  });
}

function renderCustomServiceList() {
  const section = elements.serviceManagerCustomSection;
  const list = elements.serviceManagerCustomList;
  const empty = elements.serviceManagerCustomEmpty;
  if (!section || !list || !empty) {
    return;
  }

  const canManage = Boolean(state.accessRole) && canManageServices();
  section.hidden = !canManage;
  if (!canManage) {
    list.innerHTML = "";
    empty.hidden = true;
    return;
  }

  if (elements.serviceManagerCustomTitle) {
    elements.serviceManagerCustomTitle.textContent = translate(
      "serviceManager.custom.title"
    );
  }
  if (elements.serviceManagerCustomDescription) {
    elements.serviceManagerCustomDescription.textContent = translate(
      "serviceManager.custom.description"
    );
  }

  const options = getCustomServiceOptions();
  list.innerHTML = "";

  if (!options.length) {
    empty.textContent = translate("serviceManager.custom.empty");
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  options.forEach((option) => {
    const item = document.createElement("li");
    item.className = "service-manager-custom-item";
    item.dataset.serviceId = option.id;

    const info = document.createElement("div");
    info.className = "service-manager-custom-info";

    const name = document.createElement("span");
    name.className = "service-manager-custom-name";
    name.textContent = option.labels?.pt ?? option.label ?? "";
    info.appendChild(name);

    const translationsList = document.createElement("ul");
    translationsList.className = "service-manager-custom-translations";

    const languages = [
      { code: "pt", label: translate("serviceManager.custom.language.pt") },
      { code: "en", label: translate("serviceManager.custom.language.en") },
      { code: "es", label: translate("serviceManager.custom.language.es") },
    ];

    languages.forEach(({ code, label }) => {
      const value = option.labels?.[code] ?? option.label ?? "";
      const row = document.createElement("li");
      row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      translationsList.appendChild(row);
    });

    info.appendChild(translationsList);
    item.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "service-manager-custom-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "service-manager-custom-action";
    editButton.dataset.action = "edit";
    editButton.textContent = translate("serviceManager.custom.edit");
    actions.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "service-manager-custom-action danger";
    deleteButton.dataset.action = "delete";
    deleteButton.textContent = translate("serviceManager.custom.delete");
    actions.appendChild(deleteButton);

    item.appendChild(actions);
    list.appendChild(item);
  });
}

function handleCustomServiceListClick(event) {
  if (!event || !event.target) {
    return;
  }
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const item = button.closest("[data-service-id]");
  if (!item) {
    return;
  }
  const serviceId = item.dataset.serviceId;
  if (!serviceId) {
    return;
  }

  const action = button.dataset.action;
  if (action === "edit") {
    enterServiceEditMode(serviceId);
    return;
  }

  if (action === "delete") {
    if (!canManageServices()) {
      setStatusFromKey("serviceManager.restricted", {}, true);
      return;
    }
    const label = translateServiceName(serviceId) || serviceId;
    const confirmMessage = translate("serviceManager.custom.deleteConfirm", {
      name: label,
    });
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) {
      return;
    }
    const removed = deleteCustomService(serviceId);
    if (removed) {
      if (state.editingServiceId === serviceId) {
        exitServiceEditMode();
      }
      renderCustomServiceList();
      ensureServiceManagerFilterOptions();
      recalculateServiceSummaries();
      if (isServiceManagerPage) {
        renderServiceManager();
      }
      refreshActiveServiceInterfaces({ preserveSelection: true });
      setStatusFromKey("serviceManager.custom.deleteSuccess", { name: label });
    } else {
      setStatusFromKey("serviceManager.custom.deleteError", {}, true);
    }
  }
}

function renderServiceManager() {
  if (!isServiceManagerPage) {
    return;
  }

  updateServiceSyncUI();

  const list = elements.serviceManagerList;
  const empty = elements.serviceManagerEmpty;
  if (!list || !empty) {
    return;
  }

  if (elements.serviceManagerBack) {
    if (state.accessRole === ACCESS_ROLES.SERVICES) {
      elements.serviceManagerBack.setAttribute("hidden", "true");
    } else {
      elements.serviceManagerBack.removeAttribute("hidden");
    }
  }

  if (!state.accessRole) {
    list.innerHTML = "";
    hideServiceSummary();
    empty.textContent = translate("serviceManager.restricted");
    empty.hidden = false;
    if (elements.serviceManagerNotice) {
      elements.serviceManagerNotice.hidden = false;
    }
    closeServiceAssignmentModal();
    return;
  }

  if (!canManageServices()) {
    list.innerHTML = "";
    hideServiceSummary();
    empty.textContent = translate("serviceManager.restricted");
    empty.hidden = false;
    if (elements.serviceManagerNotice) {
      elements.serviceManagerNotice.hidden = false;
    }
    if (state.accessRole) {
      setStatusFromKey("serviceManager.restricted", {}, true);
    }
    closeServiceAssignmentModal();
    return;
  }

  if (elements.serviceManagerNotice) {
    elements.serviceManagerNotice.hidden = true;
  }

  ensureServiceManagerFilterOptions();

  const summary =
    state.serviceSummary ?? { total: 0, unassigned: 0, perService: {} };
  renderServiceSummaryCards(summary);

  const filterValue = elements.serviceManagerFilter?.value ?? "all";
  const normalizedFilter = sanitizeServiceId(filterValue);

  if (filterValue === "all" || filterValue === "active") {
    state.activeServiceFilter = SERVICE_FILTER_ALL;
  } else if (filterValue === SERVICE_FILTER_UNASSIGNED) {
    state.activeServiceFilter = SERVICE_FILTER_UNASSIGNED;
  } else if (normalizedFilter) {
    state.activeServiceFilter = normalizedFilter;
  } else {
    state.activeServiceFilter = SERVICE_FILTER_ALL;
  }

  let entries = state.enrichedRecords.slice();

  entries = entries.filter((entry) => {
    const assignment = entry.service ?? EMPTY_SERVICE_ASSIGNMENT;
    const services = Array.isArray(assignment.services)
      ? assignment.services.map((serviceId) => sanitizeServiceId(serviceId)).filter(Boolean)
      : [];
    const active = Boolean(assignment.active && services.length);

    if (filterValue === SERVICE_FILTER_UNASSIGNED) {
      return !active;
    }
    if (filterValue !== "all" && filterValue !== "active" && normalizedFilter) {
      return active && services.includes(normalizedFilter);
    }
    return active;
  });

  entries.sort((a, b) => collator.compare(a.name || "", b.name || ""));

  list.innerHTML = "";

  if (!entries.length) {
    empty.textContent = translate("serviceManager.empty");
    empty.hidden = false;
  } else {
    empty.hidden = true;
    entries.forEach((entry) => {
      list.appendChild(createServiceManagerCard(entry));
    });
  }
}

function handleServiceAddSubmit(event) {
  event.preventDefault();

  if (!canManageServices()) {
    setStatusFromKey("serviceManager.restricted", {}, true);
    return;
  }

  const input = elements.serviceManagerAddInput;
  const inputEn = elements.serviceManagerAddInputEn;
  const inputEs = elements.serviceManagerAddInputEs;
  if (!input) {
    return;
  }

  const payload = {
    pt: input.value,
    en: inputEn?.value,
    es: inputEs?.value,
  };

  if (state.editingServiceId) {
    const result = updateCustomService(state.editingServiceId, payload);
    if (!result.success) {
      const key =
        result.reason === "exists"
          ? "serviceManager.edit.exists"
          : result.reason === "reserved"
          ? "serviceManager.edit.reserved"
          : result.reason === "missing"
          ? "serviceManager.edit.missing"
          : "serviceManager.edit.invalid";
      setStatusFromKey(key, {}, true);
      input.focus();
      return;
    }

    exitServiceEditMode();
    renderCustomServiceList();
    ensureServiceManagerFilterOptions();
    recalculateServiceSummaries();
    if (isServiceManagerPage) {
      renderServiceManager();
    }
    refreshActiveServiceInterfaces({ preserveSelection: true });
    setStatusFromKey("serviceManager.edit.success", {
      name: result.option.label,
    });
    return;
  }

  const result = registerCustomService(payload);
  if (!result.success) {
    const key =
      result.reason === "exists"
        ? "serviceManager.add.exists"
        : result.reason === "reserved"
        ? "serviceManager.add.reserved"
        : "serviceManager.add.invalid";
    const trimmed = typeof input.value === "string" ? input.value.trim() : "";
    input.value = trimmed;
    if (inputEn && typeof inputEn.value === "string") {
      inputEn.value = inputEn.value.trim();
    }
    if (inputEs && typeof inputEs.value === "string") {
      inputEs.value = inputEs.value.trim();
    }
    setStatusFromKey(key, {}, true);
    input.focus();
    return;
  }

  const { option } = result;
  resetServiceFormFields();
  input.focus();
  renderCustomServiceList();
  ensureServiceManagerFilterOptions();
  recalculateServiceSummaries();
  if (isServiceManagerPage) {
    renderServiceManager();
  }
  refreshActiveServiceInterfaces({ preserveSelection: true });
  setStatusFromKey("serviceManager.add.success", { name: option.label });
}

function formatAge(age) {
  if (!Number.isFinite(age)) {
    return translate("format.ageMissing");
  }
  return translate("format.age", { count: age });
}

function formatPhone(phone) {
  if (!phone) {
    return translate("format.phoneMissing");
  }

  const digits = extractPhoneDigits(phone);
  if (digits) {
    return formatPhoneDigits(digits);
  }

  return phone;
}

function setActiveSummaryCard(categoryId) {
  elements.summaryCards.forEach((card) => {
    card.classList.toggle("active", card.dataset.category === categoryId);
  });
}

function renderCategory(categoryId = "total") {
  const enforcedCategoryId = ensureAccessibleCategory(categoryId);
  const category =
    CATEGORY_BY_ID[enforcedCategoryId] ?? CATEGORY_BY_ID.total;
  if (isCategoryPage && enforcedCategoryId !== categoryId) {
    const url = new URL(window.location.href);
    url.searchParams.set("category", category.id);
    window.history.replaceState({}, "", url);
  }
  state.activeCategory = category.id;

  elements.categoryLinks.forEach((link) => {
    const isActive = link.dataset.categoryLink === category.id;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  if (elements.categoryTitle) {
    elements.categoryTitle.textContent = translateCategoryField(
      category,
      "title"
    );
  }
  if (elements.categoryDescription) {
    elements.categoryDescription.textContent = translateCategoryField(
      category,
      "description"
    );
  }
  if (elements.categoryEmpty) {
    elements.categoryEmpty.textContent = translateCategoryField(
      category,
      "emptyMessage"
    );
  }

  setActiveSummaryCard(category.id);

  if (category.isParentCategory) {
    renderParentsCategory(category);
    return;
  }

  if (category.isCareNetworkCategory) {
    renderCareNetworkCategory(category);
    return;
  }

  if (category.isServiceCategory) {
    renderServicesCategory(category);
    return;
  }

  hideServiceSummary();

  if (elements.categoryChart) {
    elements.categoryChart.style.display = "";
  }
  if (elements.categoryChartEmpty) {
    elements.categoryChartEmpty.textContent = translate("category.chartEmpty");
    elements.categoryChartEmpty.classList.remove("visible");
  }

  let filteredEntries = getAccessibleEntries().filter((entry) =>
    category.filter(entry)
  );

  if (category.id === "teens") {
    if (elements.teensFilter) {
      elements.teensFilter.hidden = false;
    }
    if (elements.teensFilterToggle) {
      elements.teensFilterToggle.checked = state.teensFilterActive;
    }

    if (state.teensFilterActive) {
      filteredEntries = filteredEntries.filter(
        (entry) => entry.age >= 16 && entry.age <= 17
      );
    }
  } else {
    if (elements.teensFilter) {
      elements.teensFilter.hidden = true;
    }
  }

  if (elements.categoryMeta) {
    const count = filteredEntries.length;
    const noun =
      count === 1
        ? translate("category.nounSingular")
        : translate("category.nounPlural");
    const filterNote =
      category.id === "teens" && state.teensFilterActive
        ? translate("category.filterNote")
        : "";
    const metaText = translate("category.meta", {
      count,
      noun,
      filter: filterNote,
    });
    elements.categoryMeta.textContent = metaText;
  }

  if (isCategoryPage) {
    const pageTitle = translateCategoryField(category, "title");
    document.title = getAppTitle(pageTitle);
  }

  updateCategoryCards(filteredEntries, category);
  updateCategoryChart(filteredEntries, category);
}

function setStatus(message, isError = false, statusKey = null) {
  if (!elements.status) return;

  elements.status.classList.toggle("error", Boolean(isError));

  state.lastStatusKey = statusKey;
  state.lastStatusMessage = message;
  state.lastStatusError = Boolean(isError);

  if (!message) {
    elements.status.innerHTML = "";
    return;
  }

  elements.status.innerHTML = "";

  const messageElement = document.createElement("p");
  messageElement.className = "status-message";
  messageElement.textContent = message;
  elements.status.append(messageElement);

  const successMessage = translate("status.updated");
  if (
    !isError &&
    (statusKey === "status.updated" || message.trim() === successMessage)
  ) {
    const tagline = document.createElement("p");
    tagline.className = "status-tagline";
    tagline.textContent = translate("app.tagline");
    elements.status.append(tagline);
  }
}

function setStatusFromKey(key, replacements = {}, isError = false) {
  const message = translate(key, replacements);
  setStatus(message, isError, key);
}

function updateLastUpdated() {
  if (!elements.lastUpdated) return;
  const now = new Date();
  const config = getLanguageConfig(state.language);
  const locale = config.locale ?? "pt-BR";
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(now);
  elements.lastUpdated.textContent = translate("header.lastUpdated.text", {
    datetime: formatted,
  });
}

function buildSuggestions() {
  if (!elements.search || !elements.suggestions) {
    return;
  }
  const { nameColumn } = state;
  const records = getAccessibleRecords();
  const list = elements.suggestions;
  list.innerHTML = "";
  list.classList.remove("visible");

  if (!records.length) {
    elements.search.disabled = true;
    elements.search.placeholder =
      state.accessRole === ACCESS_ROLES.CAPTAIN
        ? translate("search.placeholder.noTeens")
        : translate("search.placeholder.noRecords");
    return;
  }

  elements.search.disabled = false;
  elements.search.placeholder =
    state.accessRole === ACCESS_ROLES.CAPTAIN
      ? translate("search.placeholder.captain")
      : translate("search.placeholder.default");

  if (!nameColumn) {
    elements.search.disabled = true;
    elements.search.placeholder = translate("search.placeholder.noNameColumn");
    return;
  }
}

function handleSearchInput(event) {
  if (!elements.suggestions) return;
  const query = event.target.value.trim();
  const { nameColumn } = state;
  const records = getAccessibleRecords();

  if (!nameColumn || !records.length) {
    elements.suggestions.classList.remove("visible");
    return;
  }

  if (!query) {
    elements.suggestions.innerHTML = "";
    elements.suggestions.classList.remove("visible");
    return;
  }

  const normalizedQuery = normalizeString(query);
  const matches = records.filter((record) => {
    const value = record[nameColumn];
    return value && normalizeString(value).includes(normalizedQuery);
  });

  renderSuggestions(matches.slice(0, 8), records);
}

function renderSuggestions(items, pool = []) {
  const list = elements.suggestions;
  if (!list) return;
  list.innerHTML = "";

  state.searchPool = pool;

  if (!items.length) {
    list.classList.remove("visible");
    return;
  }

  items.forEach((record, index) => {
    const item = document.createElement("li");
    item.textContent = record[state.nameColumn] ?? translate("modal.noName");
    item.setAttribute("role", "option");
    item.tabIndex = 0;
    item.dataset.poolIndex = String(pool.indexOf(record));
    item.addEventListener("click", () => {
      const poolIndex = Number(item.dataset.poolIndex);
      const target = state.searchPool?.[poolIndex];
      if (target) {
        openRecord(target);
      }
    });
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const poolIndex = Number(item.dataset.poolIndex);
        const target = state.searchPool?.[poolIndex];
        if (target) {
          openRecord(target);
        }
      }
    });
    list.appendChild(item);
  });

  list.classList.add("visible");
}

function mergeRecordDetails(primaryRecord, supplementalRecord, entry) {
  const merged = [];

  const addValue = (key, value) => {
    if (!key || key === "__raw") {
      return;
    }

    const normalizedKey = normalizeColumnLabel(key);
    if (!normalizedKey) {
      return;
    }

    const existingIndex = merged.findIndex(
      (item) => item.normalizedKey === normalizedKey
    );

    const stringValue = value == null ? "" : String(value).trim();

    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      if (!existing.value && stringValue) {
        merged[existingIndex] = {
          ...existing,
          value: stringValue,
        };
      }
      return;
    }

    merged.push({
      key,
      value: stringValue,
      normalizedKey,
    });
  };

  const addRecord = (record, { skipExcluded = false } = {}) => {
    if (!record) return;

    Object.entries(record).forEach(([key, value]) => {
      if (
        skipExcluded &&
        SUPPLEMENTAL_EXCLUDED_KEYS.has(normalizeColumnLabel(key))
      ) {
        return;
      }
      addValue(key, value);
    });
  };

  addRecord(primaryRecord);
  addRecord(supplementalRecord, { skipExcluded: true });

  const isTeenEntry = Number.isFinite(entry?.age) && entry.age >= 11 && entry.age <= 17;
  if (isTeenEntry && Array.isArray(state.supplementalColumns)) {
    state.supplementalColumns.forEach((column) => {
      const normalized = normalizeColumnLabel(column);
      if (!normalized || SUPPLEMENTAL_EXCLUDED_KEYS.has(normalized)) {
        return;
      }

      const exists = merged.some((item) => item.normalizedKey === normalized);
      if (!exists) {
        const supplementalValue = supplementalRecord ? supplementalRecord[column] : "";
        addValue(column, supplementalValue);
      }
    });
  }

  const serviceLabel = translate("services.detailLabel");
  const assignment = entry?.service ?? EMPTY_SERVICE_ASSIGNMENT;
  const serviceNames = Array.isArray(assignment.services)
    ? assignment.services
        .map((serviceId) => translateServiceName(serviceId))
        .filter(Boolean)
    : [];
  let serviceValue = "";
  if (assignment.active && serviceNames.length) {
    serviceValue = serviceNames.join(", ");
  }
  if (!serviceValue) {
    serviceValue = translate("services.detailValueNone");
  }
  if (serviceLabel) {
    merged.unshift({
      key: serviceLabel,
      value: serviceValue,
      normalizedKey: "__service_detail__",
    });
  }

  const careLabel = translate("careNetwork.detailLabel");
  if (careLabel) {
    const careEntry = entry?.careNetwork ?? null;
    let careValue = translate("careNetwork.detailValueNone");
    if (careEntry) {
      if (Array.isArray(careEntry.services) && careEntry.services.length) {
        careValue = careEntry.services.join(", ");
      } else if (careEntry.serviceText) {
        const trimmed = String(careEntry.serviceText).trim();
        if (trimmed) {
          careValue = trimmed;
        }
      }
    }

    merged.splice(1, 0, {
      key: careLabel,
      value: careValue,
      normalizedKey: "__care_network_detail__",
    });

    if (careEntry && Array.isArray(careEntry.fields)) {
      careEntry.fields.forEach(({ key, value }) => {
        if (!value) {
          return;
        }
        const label = translate("careNetwork.fieldLabel", { field: key });
        addValue(label, value);
      });
    }
  }

  return merged.map(({ key, value }) => ({ key, value }));
}

function handleSearchKeydown(event) {
  if (!elements.suggestions) return;
  if (event.key === "Enter") {
    event.preventDefault();
    const firstSuggestion = elements.suggestions.querySelector("li");
    if (firstSuggestion) {
      const poolIndex = Number(firstSuggestion.dataset.poolIndex);
      const record = state.searchPool?.[poolIndex];
      if (record) {
        openRecord(record);
      }
    }
  }
}

function updateServiceAssignment(entry, assignment) {
  if (!entry) {
    return;
  }

  const normalized = normalizeServiceAssignment(assignment);

  const targetEntry =
    findEntryByServiceKey(entry.serviceKey) ??
    findEntryByRecord(entry.record) ??
    entry;

  targetEntry.service = normalized;
  entry.service = targetEntry.service;

  const { key: serviceKey, legacyKey } = resolveServiceKeys(
    targetEntry.record,
    targetEntry.supplemental,
    {
      name: targetEntry.name,
      birthDate: targetEntry.birthDate,
      phone: targetEntry.phone,
      rowIndex: targetEntry.rowIndex,
    }
  );

  targetEntry.serviceKey = serviceKey;
  entry.serviceKey = serviceKey;
  targetEntry.legacyServiceKey = legacyKey;
  entry.legacyServiceKey = legacyKey;

  if (!serviceKey) {
    if (legacyKey) {
      state.serviceAssignments.delete(legacyKey);
    }
    persistServiceAssignments();
    applyServiceAssignmentsToEntries();
    updateDashboard();
    if (elements.categoryCards || isCategoryPage) {
      renderCategory(state.activeCategory);
    }
    if (isServiceManagerPage) {
      renderServiceManager();
    }
    return;
  }

  if (targetEntry.service.active && targetEntry.service.services.length) {
    state.serviceAssignments.set(serviceKey, targetEntry.service);
    if (legacyKey && legacyKey !== serviceKey) {
      state.serviceAssignments.delete(legacyKey);
    }
  } else {
    state.serviceAssignments.delete(serviceKey);
    if (legacyKey && legacyKey !== serviceKey) {
      state.serviceAssignments.delete(legacyKey);
    }
  }

  persistServiceAssignments();
  applyServiceAssignmentsToEntries();
  updateDashboard();
  if (elements.categoryCards || isCategoryPage) {
    renderCategory(state.activeCategory);
  }
  if (isServiceManagerPage) {
    renderServiceManager();
  }
}

function handleServiceSummaryClick(event) {
  const card = event.target.closest(".service-summary-card");
  if (!card) {
    return;
  }

  const serviceId = card.dataset.serviceId || SERVICE_FILTER_ALL;
  let targetFilter = SERVICE_FILTER_ALL;
  if (serviceId === SERVICE_FILTER_UNASSIGNED) {
    targetFilter = SERVICE_FILTER_UNASSIGNED;
  } else if (serviceId === SERVICE_FILTER_ALL) {
    targetFilter = SERVICE_FILTER_ALL;
  } else {
    const sanitized = sanitizeServiceId(serviceId);
    targetFilter = sanitized || SERVICE_FILTER_ALL;
  }

  state.activeServiceFilter = targetFilter;
  if (isServiceManagerPage) {
    if (elements.serviceManagerFilter) {
      if (state.activeServiceFilter === SERVICE_FILTER_ALL) {
        elements.serviceManagerFilter.value = "all";
      } else if (state.activeServiceFilter === SERVICE_FILTER_UNASSIGNED) {
        elements.serviceManagerFilter.value = SERVICE_FILTER_UNASSIGNED;
      } else {
        elements.serviceManagerFilter.value = state.activeServiceFilter;
      }
    }
    renderServiceManager();
  } else {
    renderCategory("services");
  }
}

function openDetailModal(title, detailItems, { searchValue } = {}) {
  if (
    !elements.modal ||
    !elements.modalDetails ||
    !elements.modalName ||
    !elements.detailTemplate
  ) {
    return;
  }

  const displayTitle = title || translate("modal.title");
  elements.modalName.textContent = displayTitle;

  if (searchValue !== undefined && elements.search) {
    elements.search.value = searchValue ?? "";
  }

  elements.modalDetails.innerHTML = "";

  const items = Array.isArray(detailItems) ? detailItems : [];

  items.forEach(({ key, value }) => {
    const template = elements.detailTemplate.content.cloneNode(true);
    template.querySelector("dt").textContent = key || "";
    const displayValue =
      value == null || value === "" ? "-" : String(value);
    template.querySelector("dd").textContent = displayValue;
    elements.modalDetails.appendChild(template);
  });

  elements.modal.setAttribute("aria-hidden", "false");
  refreshBodyScrollLock();
  elements.suggestions?.classList.remove("visible");
}

function openRecord(record) {
  if (
    !record ||
    !elements.modal ||
    !elements.modalDetails ||
    !elements.modalName ||
    !elements.detailTemplate
  ) {
    return;
  }
  if (!canAccessRecord(record)) {
    showAccessRestrictionMessage();
    state.activeDetailEntry = null;
    hideServiceControls();
    return;
  }
  const { nameColumn } = state;
  const entry = findEntryByRecord(record);
  const supplementalRecord = entry?.supplemental?.record ?? null;
  const supplementalName =
    state.supplementalNameColumn && supplementalRecord
      ? supplementalRecord[state.supplementalNameColumn] ?? ""
      : "";
  const displayName =
    (nameColumn && record[nameColumn]) || supplementalName || translate("modal.title");
  const details = mergeRecordDetails(record, supplementalRecord, entry);

  const searchValue =
    nameColumn ? record[nameColumn] ?? "" : undefined;

  state.activeDetailEntry = entry;
  openDetailModal(displayName, details, { searchValue });
  renderServiceControls(entry);
}

function openParentDetail(entry, role) {
  if (!entry) {
    return;
  }

  state.activeDetailEntry = null;
  hideServiceControls();

  const parent = role === "father" ? entry.father : entry.mother;
  if (!parent) {
    setStatus(translate("parents.noDetails"));
    return;
  }

  const childName = entry.childName?.trim() || translate("modal.noName");
  const details = [
    {
      key: translate("parents.details.childLabel"),
      value: childName,
    },
    {
      key: translate("parents.details.ageLabel"),
      value: Number.isFinite(entry.childAge)
        ? formatAge(entry.childAge)
        : translate("format.ageMissing"),
    },
    {
      key: translate("parents.details.phoneLabel"),
      value: entry.childPhone
        ? formatPhone(entry.childPhone)
        : translate("format.phoneMissing"),
    },
  ];

  if (entry.childBirthday) {
    details.push({
      key: PARENT_SHEET_HEADERS.childBirthday,
      value: entry.childBirthday,
    });
  }
  if (entry.siblingStatus) {
    details.push({
      key: PARENT_SHEET_HEADERS.siblingStatus,
      value: entry.siblingStatus,
    });
  }
  if (entry.siblingParticipation) {
    details.push({
      key: PARENT_SHEET_HEADERS.siblingParticipation,
      value: entry.siblingParticipation,
    });
  }
  if (entry.siblingsList) {
    details.push({
      key: PARENT_SHEET_HEADERS.siblingsList,
      value: entry.siblingsList,
    });
  }

  if (Array.isArray(parent.details) && parent.details.length) {
    parent.details.forEach(({ key, value }) => {
      details.push({ key, value });
    });
  } else {
    setStatus(translate("parents.noDetails"));
  }

  const fallbackTitle = translate(`parents.modalFallback.${role}`, {
    child: childName,
  });
  const title = parent.name?.trim() || fallbackTitle;

  openDetailModal(title, details);
}

function openParentChoice(entry, availableRoles = []) {
  if (!elements.parentChoice) {
    return Promise.resolve(null);
  }

  closeParentChoice();

  const roles = Array.isArray(availableRoles) ? availableRoles : [];

  return new Promise((resolve) => {
    const overlay = elements.parentChoice;
    const fatherButton = elements.parentChoiceFather;
    const motherButton = elements.parentChoiceMother;
    const cancelButton = elements.parentChoiceCancel;
    const closeButton = elements.parentChoiceClose;
    const previousFocus = document.activeElement;

    const cleanup = () => {
      overlay.setAttribute("aria-hidden", "true");
      overlay.hidden = true;
      overlay.removeEventListener("click", onOverlayClick);
      document.removeEventListener("keydown", onKeydown);
      if (fatherButton) fatherButton.removeEventListener("click", onFather);
      if (motherButton) motherButton.removeEventListener("click", onMother);
      if (cancelButton) cancelButton.removeEventListener("click", onCancel);
      if (closeButton) closeButton.removeEventListener("click", onCancel);
      refreshBodyScrollLock();
      if (previousFocus && typeof previousFocus.focus === "function") {
        try {
          previousFocus.focus();
        } catch (error) {
          // ignore focus errors
        }
      }
      state.parentChoice = null;
    };

    const finalize = (value) => {
      if (!state.parentChoice || state.parentChoice.finished) {
        return;
      }
      state.parentChoice.finished = true;
      cleanup();
      resolve(value);
    };

    const onFather = () => finalize("father");
    const onMother = () => finalize("mother");
    const onCancel = () => finalize(null);
    const onOverlayClick = (event) => {
      if (event.target === overlay) {
        finalize(null);
      }
    };
    const onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finalize(null);
      }
    };

    if (elements.parentChoiceTitle) {
      elements.parentChoiceTitle.textContent = translate("parents.choice.title");
    }
    if (elements.parentChoiceQuestion) {
      const childName = entry?.childName?.trim() || translate("modal.noName");
      elements.parentChoiceQuestion.textContent = translate(
        "parents.choice.question",
        { child: childName }
      );
    }

    const showFather = roles.includes("father");
    const showMother = roles.includes("mother");

    if (fatherButton) {
      fatherButton.hidden = !showFather;
      fatherButton.disabled = !showFather;
      fatherButton.removeEventListener("click", onFather);
      if (showFather) {
        fatherButton.addEventListener("click", onFather);
      }
    }

    if (motherButton) {
      motherButton.hidden = !showMother;
      motherButton.disabled = !showMother;
      motherButton.removeEventListener("click", onMother);
      if (showMother) {
        motherButton.addEventListener("click", onMother);
      }
    }

    if (cancelButton) {
      cancelButton.addEventListener("click", onCancel);
    }
    if (closeButton) {
      closeButton.addEventListener("click", onCancel);
    }

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    refreshBodyScrollLock();

    overlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKeydown);

    state.parentChoice = {
      finished: false,
      finalize,
    };

    const focusTarget =
      (showFather && fatherButton) ||
      (showMother && motherButton) ||
      cancelButton ||
      closeButton;
    if (focusTarget && typeof focusTarget.focus === "function") {
      try {
        focusTarget.focus();
      } catch (error) {
        // ignore focus errors
      }
    }
  });
}

function closeParentChoice(value = null) {
  if (state.parentChoice && typeof state.parentChoice.finalize === "function") {
    state.parentChoice.finalize(value);
  }
}

function closeModal() {
  if (!elements.modal) return;
  elements.modal.setAttribute("aria-hidden", "true");
  refreshBodyScrollLock();
  state.activeDetailEntry = null;
  hideServiceControls();
}

function configureAutoRefresh() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
  }
  state.refreshTimer = setInterval(fetchSheetData, REFRESH_INTERVAL);
}

function handleDocumentClick(event) {
  if (elements.modal && elements.modal.contains(event.target)) {
    if (event.target === elements.modal) {
      closeModal();
    }
  }

  if (
    elements.serviceAssignmentModal &&
    !elements.serviceAssignmentModal.hidden &&
    event.target === elements.serviceAssignmentModal
  ) {
    closeServiceAssignmentModal();
  }

  if (
    elements.assistantPanel &&
    !elements.assistantPanel.hidden &&
    !elements.assistantPanel.contains(event.target) &&
    !elements.assistantToggle?.contains(event.target)
  ) {
    closeAssistant();
  }

  if (
    elements.passwordModal &&
    !elements.passwordModal.hidden &&
    event.target === elements.passwordModal
  ) {
    closePasswordModal();
  }

  if (
    elements.profileModal &&
    !elements.profileModal.hidden &&
    event.target === elements.profileModal
  ) {
    closeProfileModal();
  }

  if (
    elements.parentChoice &&
    !elements.parentChoice.hidden &&
    !elements.parentChoice.contains(event.target)
  ) {
    closeParentChoice();
  }
}

function openCategoryView(categoryId) {
  if (!categoryId) return;
  if (!isCategoryAllowed(categoryId)) {
    showAccessRestrictionMessage();
    return;
  }
  const url = new URL("category.html", window.location.href);
  url.searchParams.set("category", categoryId);
  window.location.assign(url.toString());
}

function setupEventListeners() {
  if (elements.search) {
    elements.search.addEventListener("input", handleSearchInput);
    elements.search.addEventListener("keydown", handleSearchKeydown);
  }

  if (elements.serviceSummaryGrid) {
    elements.serviceSummaryGrid.addEventListener("click", handleServiceSummaryClick);
  }

  if (elements.serviceManagerFilter) {
    elements.serviceManagerFilter.addEventListener("change", () => {
      if (!isServiceManagerPage) {
        return;
      }
      renderServiceManager();
    });
  }

  if (elements.serviceManagerBack) {
    elements.serviceManagerBack.addEventListener("click", () => {
      window.location.assign("index.html");
    });
  }

  if (elements.serviceManagerAddForm) {
    elements.serviceManagerAddForm.addEventListener(
      "submit",
      handleServiceAddSubmit
    );
  }
  if (elements.serviceManagerAddCancel) {
    elements.serviceManagerAddCancel.addEventListener("click", () => {
      exitServiceEditMode();
      setStatusFromKey("serviceManager.edit.cancel");
    });
  }

  if (elements.serviceManagerCustomList) {
    elements.serviceManagerCustomList.addEventListener(
      "click",
      handleCustomServiceListClick
    );
  }

  if (elements.serviceAssignmentForm) {
    elements.serviceAssignmentForm.addEventListener(
      "submit",
      handleServiceAssignmentSubmit
    );
  }
  if (elements.serviceAssignmentOptions) {
    elements.serviceAssignmentOptions.addEventListener(
      "change",
      handleServiceAssignmentOptionsChange
    );
  }
  if (elements.serviceAssignmentCancel) {
    elements.serviceAssignmentCancel.addEventListener("click", (event) => {
      event.preventDefault();
      closeServiceAssignmentModal();
    });
  }
  if (elements.serviceAssignmentClose) {
    elements.serviceAssignmentClose.addEventListener("click", (event) => {
      event.preventDefault();
      closeServiceAssignmentModal();
    });
  }

  if (elements.passwordModalClose) {
    elements.passwordModalClose.addEventListener("click", (event) => {
      event.preventDefault();
      closePasswordModal();
    });
  }
  if (elements.passwordModalCancel) {
    elements.passwordModalCancel.addEventListener("click", (event) => {
      event.preventDefault();
      closePasswordModal();
    });
  }
  if (elements.passwordModalForm) {
    elements.passwordModalForm.addEventListener(
      "submit",
      handlePasswordFormSubmit
    );
  }

  if (elements.profileModalClose) {
    elements.profileModalClose.addEventListener("click", (event) => {
      event.preventDefault();
      closeProfileModal();
    });
  }
  if (elements.profileModalCancel) {
    elements.profileModalCancel.addEventListener("click", (event) => {
      event.preventDefault();
      closeProfileModal();
    });
  }
  if (elements.profileModalForm) {
    elements.profileModalForm.addEventListener(
      "submit",
      handleProfileFormSubmit
    );
  }

  if (elements.closeModal) {
    elements.closeModal.addEventListener("click", closeModal);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      closeServiceAssignmentModal();
      closeUserMenu();
      closeAssistant();
      closeParentChoice();
      closePasswordModal();
      closeProfileModal();
    }
  });
  document.addEventListener("click", handleDocumentClick);

  if (elements.search && elements.suggestions) {
    document.addEventListener("click", (event) => {
      if (!elements.search?.parentElement?.contains(event.target)) {
        elements.suggestions?.classList.remove("visible");
      }
    });
  }

  if (elements.teensFilterToggle) {
    elements.teensFilterToggle.addEventListener("change", (event) => {
      state.teensFilterActive = event.target.checked;
      renderCategory(state.activeCategory);
    });
  }

  elements.summaryCards.forEach((card) => {
    const categoryId = card.dataset.category;
    if (!categoryId) return;
    card.addEventListener("click", (event) => {
      event.preventDefault();
      openCategoryView(categoryId);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCategoryView(categoryId);
      }
    });
  });

  elements.categoryLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const categoryId = link.dataset.categoryLink;
      if (!categoryId) return;
      if (!isCategoryAllowed(categoryId)) {
        event.preventDefault();
        showAccessRestrictionMessage();
        return;
      }
      if (isCategoryPage) {
        event.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.set("category", categoryId);
        window.history.replaceState({}, "", url);
      }
      state.activeCategory = categoryId;
      renderCategory(categoryId);
    });
  });
}

loadRoleCredentials();
initializeLanguage();
setupAccessControlEvents();
setupUserProfileEvents();
setupAssistant();

async function bootstrap() {
  await initializeAccessControl();
  applyAccessRestrictions();
  setupEventListeners();
  if (isCategoryPage) {
    state.activeCategory = ensureAccessibleCategory(state.activeCategory);
    renderCategory(state.activeCategory);
  }
  fetchSheetData();
}

async function start() {
  await loadSheetLinksConfig();
  await loadDefaultServiceOptions();
  initializeCustomServices();
  initializeServiceAssignments();
  await bootstrap();
}

start().catch((error) => {
  console.error("Failed to initialize dashboard:", error);
});
