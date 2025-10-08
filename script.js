const SHEET_ID = "1mDhodf4gOXVNr7JTLr9sLWT-devdC1-pWmmfVoK0RNk";
const REFRESH_INTERVAL = 60_000; // 1 minuto
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

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
};

const state = {
  records: [],
  columns: [],
  nameColumn: null,
  birthColumn: null,
  refreshTimer: null,
};

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
    state.nameColumn = detectColumn(columns, ["nome", "name"]);
    state.birthColumn = detectColumn(columns, [
      "data de nascimento",
      "nascimento",
      "aniversario",
      "aniversário",
    ]);

    const statusFromDashboard = updateDashboard();
    configureAutoRefresh();
    if (statusFromDashboard) {
      setStatus(statusFromDashboard.message, statusFromDashboard.isError);
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

  const columns = rawColumns.map((col, index) => {
    const label = col.label?.trim();
    if (label) return label;
    return col.id ? String(col.id).trim() : `Coluna ${index + 1}`;
  });

  const records = rawRows
    .map((row) => buildRecord(row, columns))
    .filter((record) =>
      record && columns.some((col) => String(record[col] ?? "").trim().length > 0)
    );

  return { columns, records };
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

function detectColumn(columns, targets) {
  const normalizedTargets = targets.map((target) => normalizeString(target));
  return (
    columns.find((column) => {
      const normalized = normalizeString(column);
      return normalizedTargets.some((target) => normalized.includes(target));
    }) ?? null
  );
}

function normalizeString(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function updateDashboard() {
  const { records, birthColumn } = state;

  elements.total.textContent = records.length;

  const counters = {
    children: 0,
    teens: 0,
    captains: 0,
    braves: 0,
    stewards: 0,
  };

  let statusMessage = null;

  if (!birthColumn) {
    statusMessage = {
      message:
        "Não encontramos a coluna de data de nascimento. Certifique-se de que uma coluna tenha esse nome.",
      isError: true,
    };
  } else {
    records.forEach((record) => {
      const rawBirth = record.__raw?.[birthColumn] ?? record[birthColumn];
      const birthDate = parseDate(rawBirth);
      if (!birthDate) return;

      const age = calculateAge(birthDate);
      if (age >= 0 && age <= 10) counters.children += 1;
      else if (age >= 11 && age <= 17) counters.teens += 1;
      else if (age >= 18 && age <= 29) counters.captains += 1;
      else if (age >= 30 && age <= 49) counters.braves += 1;
      else if (age >= 50) counters.stewards += 1;
    });
  }

  elements.children.textContent = counters.children;
  elements.teens.textContent = counters.teens;
  elements.captains.textContent = counters.captains;
  elements.braves.textContent = counters.braves;
  elements.stewards.textContent = counters.stewards;

  buildSuggestions();

  return statusMessage;
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

function setStatus(message, isError = false) {
  if (!message) {
    elements.status.textContent = "";
    elements.status.classList.remove("error");
    return;
  }

  elements.status.textContent = message;
  elements.status.classList.toggle("error", Boolean(isError));
}

function updateLastUpdated() {
  const now = new Date();
  elements.lastUpdated.textContent = `Atualizado em ${new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(now)}`;
}

function buildSuggestions() {
  const { records, nameColumn } = state;
  const list = elements.suggestions;
  list.innerHTML = "";
  list.classList.remove("visible");

  if (!records.length) {
    elements.search.disabled = true;
    elements.search.placeholder = "Nenhum registro disponível";
    return;
  }

  elements.search.disabled = false;
  elements.search.placeholder = "Digite o nome";

  if (!nameColumn) {
    elements.search.disabled = true;
    elements.search.placeholder = "Coluna de nome não encontrada";
    return;
  }
}

function handleSearchInput(event) {
  const query = event.target.value.trim();
  const { records, nameColumn } = state;

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

  renderSuggestions(matches.slice(0, 8));
}

function renderSuggestions(items) {
  const list = elements.suggestions;
  list.innerHTML = "";

  if (!items.length) {
    list.classList.remove("visible");
    return;
  }

  items.forEach((record, index) => {
    const item = document.createElement("li");
    item.textContent = record[state.nameColumn] ?? "(Sem nome)";
    item.setAttribute("role", "option");
    item.tabIndex = 0;
    item.dataset.index = String(state.records.indexOf(record));
    item.addEventListener("click", () => openRecord(record));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openRecord(record);
      }
    });
    list.appendChild(item);
  });

  list.classList.add("visible");
}

function handleSearchKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const firstSuggestion = elements.suggestions.querySelector("li");
    if (firstSuggestion) {
      const index = Number(firstSuggestion.dataset.index);
      openRecord(state.records[index]);
    }
  }
}

function openRecord(record) {
  if (!record) return;
  const { nameColumn } = state;
  elements.modalName.textContent = record[nameColumn] || "Detalhes";
  elements.search.value = record[nameColumn] || "";
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
  elements.suggestions.classList.remove("visible");
}

function closeModal() {
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
  if (!elements.modal.contains(event.target)) {
    return;
  }

  if (event.target === elements.modal) {
    closeModal();
  }
}

function setupEventListeners() {
  elements.search.addEventListener("input", handleSearchInput);
  elements.search.addEventListener("keydown", handleSearchKeydown);
  elements.closeModal.addEventListener("click", closeModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
  document.addEventListener("click", handleDocumentClick);

  document.addEventListener("click", (event) => {
    if (!elements.search.parentElement.contains(event.target)) {
      elements.suggestions.classList.remove("visible");
    }
  });
}

setupEventListeners();
fetchSheetData();
