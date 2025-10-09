const SHEET_ID = "1mDhodf4gOXVNr7JTLr9sLWT-devdC1-pWmmfVoK0RNk";
const REFRESH_INTERVAL = 60_000; // 1 minuto
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
const pageType = document.body?.dataset.page ?? "dashboard";
const isDashboardPage = pageType === "dashboard";
const isCategoryPage = pageType === "category";

const ACCESS_ROLES = {
  RESPONSIBLE: "responsavel",
  CAPTAIN: "capitao",
};

const ACCESS_LABELS = {
  [ACCESS_ROLES.RESPONSIBLE]: "Irmão Responsável",
  [ACCESS_ROLES.CAPTAIN]: "Capitão",
};

const ACCESS_DESCRIPTIONS = {
  [ACCESS_ROLES.RESPONSIBLE]: "Acesso completo a todas as áreas do painel.",
  [ACCESS_ROLES.CAPTAIN]:
    "Acesso restrito às informações e buscas dos adolescentes (11-17 anos).",
};

const PASSWORD_HASHES = {
  [ACCESS_ROLES.RESPONSIBLE]:
    "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
  [ACCESS_ROLES.CAPTAIN]:
    "892cc7e526dcdacf4f31b35252576b942c802e12db33ee5ba0040d82c0860342",
};

const ACCESS_SESSION_KEY = "igcolina-access-role";

const elements = {
  total: document.getElementById("total-count"),
  children: document.getElementById("children-count"),
  teens: document.getElementById("teens-count"),
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
  categoryLinks: Array.from(
    document.querySelectorAll("[data-category-link]")
  ),
  teensFilter: document.getElementById("teens-filter"),
  teensFilterToggle: document.getElementById("teens-filter-toggle"),
  userProfile: document.getElementById("user-profile"),
  userMenuToggle: document.getElementById("user-menu-toggle"),
  userMenu: document.getElementById("user-menu"),
  userProfileLabel: document.getElementById("user-profile-label"),
  userMenuRole: document.getElementById("user-menu-role"),
  userMenuDetail: document.getElementById("user-menu-detail"),
  switchUser: document.getElementById("switch-user"),
  accessModal: document.getElementById("access-modal"),
  accessOptions: document.getElementById("access-options"),
  accessForm: document.getElementById("access-form"),
  accessPassword: document.getElementById("access-password"),
  accessError: document.getElementById("access-error"),
  accessRoleLabel: document.getElementById("selected-role-label"),
  accessBack: document.getElementById("access-back"),
  accessOptionButtons: Array.from(
    document.querySelectorAll("[data-access-role]")
  ),
};

const CATEGORY_CONFIG = [
  {
    id: "total",
    title: "Total de Irmãos",
    description: "Veja todos os irmãos cadastrados na planilha.",
    chartLabel: "Idades de todos os irmãos",
    emptyMessage: "Nenhum irmão encontrado nesta categoria.",
    filter: () => true,
  },
  {
    id: "children",
    title: "Crianças (0-10)",
    description: "Irmãos com idades entre 0 e 10 anos.",
    chartLabel: "Idades das crianças",
    emptyMessage: "Nenhuma criança cadastrada até o momento.",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 0 && entry.age <= 10,
  },
  {
    id: "teens",
    title: "Adolescentes (11-17)",
    description:
      "Irmãos com idades entre 11 e 17 anos. Ative o filtro \"Idade apta para colportagem\" para destacar apenas 16 e 17 anos.",
    chartLabel: "Idades dos adolescentes",
    emptyMessage: "Nenhum adolescente cadastrado até o momento.",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 11 && entry.age <= 17,
  },
  {
    id: "captains",
    title: "Capitães (18-29)",
    description: "Irmãos com idades entre 18 e 29 anos.",
    chartLabel: "Idades dos capitães",
    emptyMessage: "Nenhum capitão cadastrado até o momento.",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 18 && entry.age <= 29,
  },
  {
    id: "braves",
    title: "Valentes de Davi (30-49)",
    description: "Irmãos com idades entre 30 e 49 anos.",
    chartLabel: "Idades dos valentes de Davi",
    emptyMessage: "Nenhum valente cadastrado até o momento.",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 30 && entry.age <= 49,
  },
  {
    id: "stewards",
    title: "Intendentes (50+)",
    description: "Irmãos com 50 anos ou mais.",
    chartLabel: "Idades dos intendentes",
    emptyMessage: "Nenhum intendente cadastrado até o momento.",
    filter: (entry) => Number.isFinite(entry.age) && entry.age >= 50,
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
    console.warn("Não foi possível ler os parâmetros de URL:", error);
  }
  return "total";
}

const state = {
  records: [],
  columns: [],
  nameColumn: null,
  birthColumn: null,
  phoneColumn: null,
  enrichedRecords: [],
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
};

const defaultTexts = {
  overviewTitle: elements.overviewTitle?.textContent ?? "",
  overviewDescription: elements.overviewDescription?.textContent ?? "",
};

function getStoredRole() {
  try {
    const stored = sessionStorage.getItem(ACCESS_SESSION_KEY);
    if (stored && Object.values(ACCESS_ROLES).includes(stored)) {
      return stored;
    }
  } catch (error) {
    console.warn("Não foi possível ler a sessão de acesso:", error);
  }
  return null;
}

function storeRole(role) {
  try {
    sessionStorage.setItem(ACCESS_SESSION_KEY, role);
  } catch (error) {
    console.warn("Não foi possível persistir a sessão de acesso:", error);
  }
}

function clearStoredRole() {
  try {
    sessionStorage.removeItem(ACCESS_SESSION_KEY);
  } catch (error) {
    console.warn("Não foi possível limpar a sessão de acesso:", error);
  }
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
      console.warn("Falha ao usar crypto.subtle, utilizando fallback:", error);
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

  if (state.accessRole === ACCESS_ROLES.RESPONSIBLE) {
    return true;
  }

  if (state.accessRole === ACCESS_ROLES.CAPTAIN) {
    return categoryId === "teens";
  }

  return false;
}

function ensureAccessibleCategory(categoryId) {
  if (!state.accessRole) {
    return categoryId;
  }

  if (state.accessRole === ACCESS_ROLES.CAPTAIN && categoryId !== "teens") {
    return "teens";
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

function canAccessRecord(record) {
  if (!state.accessRole) {
    return false;
  }

  if (state.accessRole === ACCESS_ROLES.RESPONSIBLE) {
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
    setStatus(
      "Perfil de Capitão: acesso disponível apenas para adolescentes (11-17 anos)."
    );
  }
}

function applyAccessRestrictions() {
  document.body.dataset.accessRole = state.accessRole ?? "";

  elements.summaryCards.forEach((card) => {
    const categoryId = card.dataset.category;
    if (!categoryId) return;
    const allowed = isCategoryAllowed(categoryId);
    card.classList.toggle("restricted", !allowed);
    if (!allowed) {
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

  if (elements.overviewTitle && elements.overviewDescription) {
    if (state.accessRole === ACCESS_ROLES.CAPTAIN) {
      elements.overviewTitle.textContent =
        "Distribuição de idades dos adolescentes";
      elements.overviewDescription.textContent =
        "Visualize as idades apenas dos adolescentes entre 11 e 17 anos.";
    } else {
      elements.overviewTitle.textContent = defaultTexts.overviewTitle;
      elements.overviewDescription.textContent = defaultTexts.overviewDescription;
    }
  }

  updateUserProfileUI();
}

function isUserMenuOpen() {
  return elements.userProfile?.classList.contains("open");
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

function getRoleDescription(role) {
  return ACCESS_DESCRIPTIONS[role] ?? "";
}

function updateUserProfileUI() {
  if (!elements.userProfile) return;

  const { accessRole } = state;
  if (!accessRole || !ACCESS_LABELS[accessRole]) {
    elements.userProfile.hidden = true;
    if (elements.userProfileLabel) {
      elements.userProfileLabel.textContent = "Perfil";
    }
    if (elements.userMenuRole) {
      elements.userMenuRole.textContent = "—";
    }
    if (elements.userMenuDetail) {
      elements.userMenuDetail.textContent = "";
    }
    closeUserMenu();
    return;
  }

  const label = ACCESS_LABELS[accessRole];
  elements.userProfile.hidden = false;
  if (elements.userProfileLabel) {
    elements.userProfileLabel.textContent = label;
  }
  if (elements.userMenuRole) {
    elements.userMenuRole.textContent = label;
  }
  if (elements.userMenuDetail) {
    elements.userMenuDetail.textContent = getRoleDescription(accessRole);
  }
}

function handleSwitchUser() {
  closeUserMenu();
  state.accessRole = null;
  state.pendingAccessRole = null;
  clearStoredRole();
  applyAccessRestrictions();
  updateDashboard();
  if (isCategoryPage) {
    state.activeCategory = ensureAccessibleCategory(state.activeCategory);
    renderCategory(state.activeCategory);
  }
  buildSuggestions();
  setStatus("Selecione um perfil para continuar.");
  showAccessModal();
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
  if (elements.accessRoleLabel) {
    elements.accessRoleLabel.textContent = "";
  }
  if (elements.accessOptions) {
    elements.accessOptions.hidden = false;
  }
  if (elements.accessForm) {
    elements.accessForm.hidden = true;
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
  if (!ACCESS_LABELS[role]) {
    return;
  }
  state.pendingAccessRole = role;
  if (elements.accessRoleLabel) {
    elements.accessRoleLabel.textContent = ACCESS_LABELS[role];
  }
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
      elements.accessError.textContent = "Informe a senha para continuar.";
    }
    return;
  }

  const hashed = await hashPassword(password);
  const expected = PASSWORD_HASHES[role];
  if (hashed !== expected) {
    if (elements.accessError) {
      elements.accessError.textContent = "Senha incorreta. Tente novamente.";
    }
    elements.accessPassword.value = "";
    elements.accessPassword.focus();
    return;
  }

  state.accessRole = role;
  storeRole(role);
  applyAccessRestrictions();
  buildSuggestions();
  hideAccessModal();
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
  const storedRole = getStoredRole();
  if (storedRole) {
    state.accessRole = storedRole;
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
  setStatus("Atualizando dados...");
  try {
    const response = await fetch(GVIZ_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Erro ao acessar a planilha (status ${response.status})`);
    }

    const text = await response.text();
    const payload = extractGvizPayload(text);
    const { records, columns } = parseTable(payload.table);

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

    state.enrichedRecords = buildEnrichedRecords(records);
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
      setStatus(
        "Não encontramos a coluna de data de nascimento. Certifique-se de que uma coluna tenha esse nome.",
        true
      );
    } else {
      setStatus(
        records.length
          ? "Dados atualizados."
          : "Nenhum registro encontrado na planilha ainda."
      );
    }
    updateLastUpdated();
  } catch (error) {
    console.error(error);
    setStatus(
      "Não foi possível carregar os dados. Verifique se a planilha está publicada para o público e tente novamente.",
      true
    );
  }
}

function extractGvizPayload(rawText) {
  const match = rawText.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
  if (!match) {
    throw new Error("Resposta inesperada da API do Google Sheets");
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
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildEnrichedRecords(records) {
  const { birthColumn, nameColumn, phoneColumn } = state;

  return records.map((record) => {
    const rawBirth = birthColumn
      ? record.__raw?.[birthColumn] ?? record[birthColumn]
      : null;
    const birthDate = birthColumn ? parseDate(rawBirth) : null;
    const age = birthDate ? calculateAge(birthDate) : null;

    return {
      record,
      age,
      name: nameColumn ? record[nameColumn] ?? "" : "",
      phone: phoneColumn ? record[phoneColumn] ?? "" : "",
    };
  });
}

function updateDashboard() {
  const { records, birthColumn, enrichedRecords } = state;

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
  if (elements.captains) elements.captains.textContent = counters.captains;
  if (elements.braves) elements.braves.textContent = counters.braves;
  if (elements.stewards) elements.stewards.textContent = counters.stewards;

  updateOverallChart(getAccessibleEntries());
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
    console.warn("Chart.js não foi carregado. Gráficos não serão exibidos.");
    return;
  }

  const dataset = {
    label: "Quantidade de irmãos",
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
    chart.data.datasets[0].data = distribution.data;
    chart.update();
  }
}

function updateCategoryChart(entries, category) {
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
    return;
  }

  if (typeof Chart === "undefined") {
    console.warn("Chart.js não foi carregado. Gráficos não serão exibidos.");
    return;
  }

  const dataset = {
    label: category.chartLabel,
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
    chart.data.datasets[0].label = category.chartLabel;
    chart.data.datasets[0].data = distribution.data;
    chart.update();
  }
}

function updateCategoryCards(entries, category) {
  const container = elements.categoryCards;
  if (!container || !elements.categoryEmpty) {
    return;
  }
  container.innerHTML = "";

  if (!entries.length) {
    elements.categoryEmpty.textContent = category.emptyMessage;
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
    nameElement.textContent = entry.name || "(Sem nome)";

    const ageElement = document.createElement("span");
    ageElement.textContent = `Idade: ${formatAge(entry.age)}`;

    const phoneElement = document.createElement("span");
    phoneElement.textContent = `Telefone: ${formatPhone(entry.phone)}`;

    card.append(nameElement, ageElement, phoneElement);

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

function formatAge(age) {
  if (!Number.isFinite(age)) {
    return "não informada";
  }
  return `${age} ${age === 1 ? "ano" : "anos"}`;
}

function formatPhone(phone) {
  if (!phone) {
    return "não informado";
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
    elements.categoryTitle.textContent = category.title;
  }
  if (elements.categoryDescription) {
    elements.categoryDescription.textContent = category.description;
  }
  if (elements.categoryEmpty) {
    elements.categoryEmpty.textContent = category.emptyMessage;
  }

  setActiveSummaryCard(category.id);

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
    const noun = count === 1 ? "irmão" : "irmãos";
    let metaText = `${count} ${noun} nesta categoria`;
    if (category.id === "teens" && state.teensFilterActive) {
      metaText += " · filtro \"Idade apta para colportagem\" ativo";
    }
    elements.categoryMeta.textContent = metaText;
  }

  if (isCategoryPage) {
    document.title = `${category.title} · Dados da IGColina`;
  }

  updateCategoryCards(filteredEntries, category);
  updateCategoryChart(filteredEntries, category);
}

function setStatus(message, isError = false) {
  if (!elements.status) return;

  elements.status.classList.toggle("error", Boolean(isError));

  if (!message) {
    elements.status.innerHTML = "";
    return;
  }

  elements.status.innerHTML = "";

  const messageElement = document.createElement("p");
  messageElement.className = "status-message";
  messageElement.textContent = message;
  elements.status.append(messageElement);

  if (!isError && message.trim() === "Dados atualizados.") {
    const tagline = document.createElement("p");
    tagline.className = "status-tagline";
    tagline.textContent = "Dashboard criada para uso da Igreja em Colina® 2025";
    elements.status.append(tagline);
  }
}

function updateLastUpdated() {
  if (!elements.lastUpdated) return;
  const now = new Date();
  elements.lastUpdated.textContent = `Atualizado em ${new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(now)}`;
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
        ? "Nenhum adolescente disponível"
        : "Nenhum registro disponível";
    return;
  }

  elements.search.disabled = false;
  elements.search.placeholder =
    state.accessRole === ACCESS_ROLES.CAPTAIN
      ? "Pesquise adolescentes (11-17 anos)"
      : "Digite o nome";

  if (!nameColumn) {
    elements.search.disabled = true;
    elements.search.placeholder = "Coluna de nome não encontrada";
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
    item.textContent = record[state.nameColumn] ?? "(Sem nome)";
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
    return;
  }
  const { nameColumn } = state;
  elements.modalName.textContent = record[nameColumn] || "Detalhes";
  if (elements.search) {
    elements.search.value = record[nameColumn] || "";
  }
  elements.modalDetails.innerHTML = "";

  Object.entries(record).forEach(([key, value]) => {
    if (key === "__raw") return;
    const template = elements.detailTemplate.content.cloneNode(true);
    template.querySelector("dt").textContent = key;
    template.querySelector("dd").textContent = value || "-";
    elements.modalDetails.appendChild(template);
  });

  elements.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  elements.suggestions?.classList.remove("visible");
}

function closeModal() {
  if (!elements.modal) return;
  elements.modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function configureAutoRefresh() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
  }
  state.refreshTimer = setInterval(fetchSheetData, REFRESH_INTERVAL);
}

function handleDocumentClick(event) {
  if (!elements.modal) return;
  if (!elements.modal.contains(event.target)) {
    return;
  }

  if (event.target === elements.modal) {
    closeModal();
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

  if (elements.closeModal) {
    elements.closeModal.addEventListener("click", closeModal);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      closeUserMenu();
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

setupAccessControlEvents();
setupUserProfileEvents();

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

bootstrap();
