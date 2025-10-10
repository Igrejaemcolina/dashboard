const SHEET_ID = "1mDhodf4gOXVNr7JTLr9sLWT-devdC1-pWmmfVoK0RNk";
const SUPPLEMENTAL_SHEET_ID = "1FLPdqmH6xOaMbc2RUjuANDWWNaMpJlc8RGuYiPjC_GQ";
const REFRESH_INTERVAL = 60_000; // 1 minuto
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const SUPPLEMENTAL_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SUPPLEMENTAL_SHEET_ID}/gviz/tq?tqx=out:json`;
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
  [ACCESS_ROLES.CAPTAIN]: "Capitães de Tropa",
};

const ACCESS_DESCRIPTIONS = {
  [ACCESS_ROLES.RESPONSIBLE]: "Acesso completo a todas as áreas do painel.",
  [ACCESS_ROLES.CAPTAIN]:
    "Acesso restrito às informações e buscas dos adolescentes (11-17 anos).",
};

const NAME_SECRET = "IGCOLINA2025";

const ROLE_CREDENTIALS = {
  [ACCESS_ROLES.RESPONSIBLE]: {
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
  },
  [ACCESS_ROLES.CAPTAIN]: {
    "892cc7e526dcdacf4f31b35252576b942c802e12db33ee5ba0040d82c0860342":
      "0a26332638aa2b32125457151d352c3f2d",
  },
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
  birthdaySection: document.getElementById("birthday-section"),
  birthdayList: document.getElementById("birthday-list"),
  birthdayEmpty: document.getElementById("birthday-empty"),
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
  assistantToggle: document.getElementById("assistant-toggle"),
  assistantPanel: document.getElementById("assistant-panel"),
  assistantClose: document.getElementById("assistant-close"),
  assistantQuestions: document.getElementById("assistant-questions"),
  assistantForm: document.getElementById("assistant-form"),
  assistantInput: document.getElementById("assistant-input"),
  assistantConversation: document.getElementById("assistant-conversation"),
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
    title: "Capitães de Tropa (18-29)",
    description: "Irmãos com idades entre 18 e 29 anos.",
    chartLabel: "Idades dos capitães de tropa",
    emptyMessage: "Nenhum capitão de tropa cadastrado até o momento.",
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

const SUPPLEMENTAL_EXCLUDED_KEYS = new Set(
  [
    "Nome do Adolescente(a):",
    "Data de aniversário do Adolescente:",
    "Data de aniversario do Adolescente:",
    "Telefone do adolescente:",
  ].map((label) => normalizeColumnLabel(label))
);

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
  assistant: {
    greeted: false,
    customMode: false,
    typingTimeouts: new Set(),
    questionsRendered: false,
  },
};

const defaultTexts = {
  overviewTitle: elements.overviewTitle?.textContent ?? "",
  overviewDescription: elements.overviewDescription?.textContent ?? "",
};

const ASSISTANT_QUESTIONS = [
  {
    id: "refresh",
    label: "Como os dados são atualizados?",
    answer:
      "Os dados vêm diretamente das planilhas compartilhadas e são atualizados automaticamente a cada minuto. Você também pode recarregar a página para sincronizar imediatamente.",
  },
  {
    id: "search",
    label: "Como pesquisar um irmão?",
    answer:
      "Use o campo de pesquisa no topo: digite parte do nome e selecione uma das sugestões para abrir os detalhes completos.",
  },
  {
    id: "categories",
    label: "Como acessar as categorias?",
    answer:
      "Clique nos cartões do painel ou utilize o menu de categorias. Cada visão mostra os cards correspondentes com idade e telefone.",
  },
  {
    id: "custom",
    label: "Outros",
    custom: true,
  },
];

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
    console.warn("Não foi possível ler a sessão de acesso:", error);
  }
  return null;
}

function storeAccess(role, userSecret) {
  try {
    const payload = JSON.stringify({ role, userSecret: userSecret ?? null });
    sessionStorage.setItem(ACCESS_SESSION_KEY, payload);
  } catch (error) {
    console.warn("Não foi possível persistir a sessão de acesso:", error);
  }
}

function clearStoredAccess() {
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
      "Perfil de Capitães de Tropa: acesso disponível apenas para adolescentes (11-17 anos)."
    );
  }
}

function applyAccessRestrictions() {
  document.body.dataset.accessRole = state.accessRole ?? "";

  elements.summaryCards.forEach((card) => {
    const categoryId = card.dataset.category;
    if (!categoryId) return;
    const hideCard =
      state.accessRole === ACCESS_ROLES.CAPTAIN && categoryId !== "teens";
    card.hidden = hideCard;
    if (hideCard) {
      card.removeAttribute("aria-disabled");
      card.tabIndex = -1;
      return;
    }

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
    const listItem = link.closest("li");
    const hideLink =
      state.accessRole === ACCESS_ROLES.CAPTAIN && categoryId !== "teens";
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
  updateBirthdays();
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

  const roleLabel = ACCESS_LABELS[accessRole];
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
  setStatus("Selecione uma função para continuar.");
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
  const allowedUsers = ROLE_CREDENTIALS[role] ?? {};
  const userSecret = allowedUsers[hashed];
  const userName = decryptNameSecret(userSecret);

  if (!userSecret || !userName) {
    if (elements.accessError) {
      elements.accessError.textContent = "Senha incorreta. Tente novamente.";
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
  setStatus("Atualizando dados...");
  try {
    const [primaryResult, supplementalResult] = await Promise.allSettled([
      fetchGvizTable(GVIZ_URL),
      fetchGvizTable(SUPPLEMENTAL_GVIZ_URL),
    ]);

    if (primaryResult.status !== "fulfilled") {
      throw primaryResult.reason ?? new Error("Erro ao carregar a planilha principal.");
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
        "Não foi possível carregar a planilha complementar:",
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

async function fetchGvizTable(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Erro ao acessar a planilha (status ${response.status})`);
  }

  const text = await response.text();
  const payload = extractGvizPayload(text);
  return parseTable(payload.table);
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

  return records.map((record) => {
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
  updateBirthdays();
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
    name.textContent = entry.name?.trim() || "Nome não informado";
    item.appendChild(name);

    const meta = document.createElement("div");
    meta.className = "birthday-meta";

    const age = Number.isFinite(entry.age) ? entry.age : null;
    const ageSpan = document.createElement("span");
    ageSpan.textContent = age != null ? `${age} anos` : "Idade não informada";
    meta.appendChild(ageSpan);

    if (entry.phone) {
      const phoneSpan = document.createElement("span");
      phoneSpan.textContent = entry.phone;
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
        ? "Nenhum adolescente aniversariante encontrado para hoje."
        : "Nenhum aniversariante encontrado para hoje.";
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
      appendAssistantMessage(
        "assistant",
        "Olá! Sou a assistente virtual da dashboard. Escolha uma pergunta ou use a opção \"Outros\" para tirar dúvidas específicas."
      );
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
      ? "Assistente"
      : state.activeUserName?.trim() || "Você";
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
  heading.textContent = "Assistente";
  wrapper.appendChild(heading);

  const body = document.createElement("p");
  body.className = "assistant-typing";
  body.append("digitando");

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

  ASSISTANT_QUESTIONS.forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = question.label;
    button.dataset.assistantQuestion = question.id;
    elements.assistantQuestions.appendChild(button);
  });

  state.assistant.questionsRendered = true;
}

function getAssistantAnswer(questionId) {
  switch (questionId) {
    case "refresh":
      return state.accessRole === ACCESS_ROLES.CAPTAIN
        ? "Os registros de adolescentes são atualizados automaticamente a cada minuto com os dados das planilhas. Recarregue a página se precisar forçar uma nova consulta."
        : "Toda a dashboard é sincronizada com as planilhas a cada minuto. Você pode recarregar a página para atualizar imediatamente.";
    case "search":
      return state.accessRole === ACCESS_ROLES.CAPTAIN
        ? "No campo de pesquisa, digite o nome do adolescente (11-17 anos). Escolha uma sugestão para abrir os detalhes completos."
        : "Digite parte do nome no campo de pesquisa e selecione uma das sugestões para abrir o cadastro completo do irmão.";
    case "categories":
      return state.accessRole === ACCESS_ROLES.CAPTAIN
        ? "Como Capitão de Tropa, você visualiza apenas o cartão de adolescentes. Clique nele para abrir a lista com cards e gráfico específicos."
        : "Use os cartões da página inicial ou o menu de categorias para navegar. Cada aba mostra os irmãos daquele grupo com gráfico e cards detalhados.";
    default:
      return "Estou aqui para ajudar com as principais dúvidas do painel.";
  }
}

function generateCustomAssistantAnswer(questionText) {
  const cleanedQuestion = questionText.trim();
  const scopeMessage =
    state.accessRole === ACCESS_ROLES.CAPTAIN
      ? "Como Capitão de Tropa, lembre-se de que seu acesso é focado nos adolescentes de 11 a 17 anos."
      : "Como Irmão Responsável, você possui acesso completo a todas as categorias da dashboard.";

  return [
    cleanedQuestion
      ? `Entendi sua dúvida: "${cleanedQuestion}".`
      : "Recebi sua dúvida.",
    scopeMessage,
    "Verifique se os dados estão atualizados na planilha e utilize os cartões ou a busca para localizar rapidamente as informações desejadas. Caso a dúvida persista, entre em contato com a liderança da IGColina.",
  ]
    .filter(Boolean)
    .join(" ");
}

function handleAssistantQuestionSelection(questionId) {
  const question = ASSISTANT_QUESTIONS.find((item) => item.id === questionId);
  if (!question) {
    return;
  }

  if (question.custom) {
    if (!state.assistant.customMode) {
      appendAssistantMessage(
        "assistant",
        "Conte qual é a sua dúvida e eu trago orientações sobre como resolver no painel."
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

  appendAssistantMessage("user", question.label);
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
  const entry = findEntryByRecord(record);
  const supplementalRecord = entry?.supplemental?.record ?? null;
  const supplementalName =
    state.supplementalNameColumn && supplementalRecord
      ? supplementalRecord[state.supplementalNameColumn] ?? ""
      : "";
  const displayName =
    (nameColumn && record[nameColumn]) || supplementalName || "Detalhes";

  elements.modalName.textContent = displayName;
  if (elements.search && nameColumn) {
    elements.search.value = record[nameColumn] || "";
  }
  elements.modalDetails.innerHTML = "";

  const details = mergeRecordDetails(record, supplementalRecord, entry);

  details.forEach(({ key, value }) => {
    const template = elements.detailTemplate.content.cloneNode(true);
    template.querySelector("dt").textContent = key;
    const displayValue = value ? value : "-";
    template.querySelector("dd").textContent = displayValue;
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
  if (elements.modal && elements.modal.contains(event.target)) {
    if (event.target === elements.modal) {
      closeModal();
    }
  }

  if (
    elements.assistantPanel &&
    !elements.assistantPanel.hidden &&
    !elements.assistantPanel.contains(event.target) &&
    !elements.assistantToggle?.contains(event.target)
  ) {
    closeAssistant();
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
      closeAssistant();
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

bootstrap();
