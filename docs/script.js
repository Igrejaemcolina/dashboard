const SHEET_ID = "1mDhodf4gOXVNr7JTLr9sLWT-devdC1-pWmmfVoK0RNk";
const REFRESH_INTERVAL = 60_000; // 1 minuto
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
const pageType = document.body?.dataset.page ?? "dashboard";
const isDashboardPage = pageType === "dashboard";
const isCategoryPage = pageType === "category";

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
    description: "Irmãos com idades entre 11 e 17 anos.",
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

  updateOverallChart(enrichedRecords);
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
  const category = CATEGORY_BY_ID[categoryId] ?? CATEGORY_BY_ID.total;
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

  const filteredEntries = state.enrichedRecords.filter((entry) =>
    category.filter(entry)
  );

  if (elements.categoryMeta) {
    const count = filteredEntries.length;
    const noun = count === 1 ? "irmão" : "irmãos";
    elements.categoryMeta.textContent = `${count} ${noun} nesta categoria`;
  }

  if (isCategoryPage) {
    document.title = `${category.title} · Dados da IGColina`;
  }

  updateCategoryCards(filteredEntries, category);
  updateCategoryChart(filteredEntries, category);
}

function setStatus(message, isError = false) {
  if (!elements.status) return;
  if (!message) {
    elements.status.textContent = "";
    elements.status.classList.remove("error");
    return;
  }

  elements.status.textContent = message;
  elements.status.classList.toggle("error", Boolean(isError));
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
  if (!elements.suggestions) return;
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
  if (!list) return;
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
  if (!elements.suggestions) return;
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
  if (
    !record ||
    !elements.modal ||
    !elements.modalDetails ||
    !elements.modalName ||
    !elements.detailTemplate
  ) {
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

setupEventListeners();
if (isCategoryPage) {
  renderCategory(state.activeCategory);
}
fetchSheetData();
