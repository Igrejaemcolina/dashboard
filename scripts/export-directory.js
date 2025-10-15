#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const SHEET_ID = "1mDhodf4gOXVNr7JTLr9sLWT-devdC1-pWmmfVoK0RNk";
const SUPPLEMENTAL_SHEET_ID = "1FLPdqmH6xOaMbc2RUjuANDWWNaMpJlc8RGuYiPjC_GQ";
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const SUPPLEMENTAL_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SUPPLEMENTAL_SHEET_ID}/gviz/tq?tqx=out:json`;

async function fetchGvizTable(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const text = await response.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
  if (!match) {
    throw new Error("Unexpected GViz response format");
  }
  const payload = JSON.parse(match[1]);
  return parseTable(payload.table ?? {});
}

function parseTable(table) {
  const rawColumns = Array.isArray(table.cols) ? table.cols : [];
  const rawRows = Array.isArray(table.rows) ? table.rows : [];

  let columns = rawColumns.map((column, index) => {
    const label = column.label?.trim();
    if (label) {
      return label;
    }
    return column.id ? String(column.id).trim() : `Coluna ${index + 1}`;
  });

  let records = rawRows
    .map((row) => buildRecord(row, columns))
    .filter((record) => record && columns.some((col) => String(record[col] ?? "").trim().length > 0));

  const genericPattern = /^(coluna|column)\s+\d+$|^col\d+$|^[A-Z]+$/i;
  const columnsLookGeneric = columns.every((column) =>
    genericPattern.test(column) || normalizeString(column).startsWith("coluna ")
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

    const cleanedRecords = records.slice(1).map((record) => remapRecord(record, columns, renamedColumns));
    columns = renamedColumns;
    records = cleanedRecords;
  }

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

function detectColumn(columns, records, targets) {
  const normalizedTargets = targets.map((target) => normalizeString(target));
  const columnMatch = columns.find((column) => {
    const normalized = normalizeString(column);
    return normalizedTargets.some((target) => normalized.includes(target) || normalized === target);
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
      return normalizedTargets.some((target) => normalized.includes(target) || normalized === target);
    });
    if (matchFromFirstRow) {
      return matchFromFirstRow;
    }
  }

  return null;
}

function parseDate(rawValue) {
  if (!rawValue) return null;
  if (rawValue instanceof Date) {
    return rawValue;
  }
  if (typeof rawValue === "string") {
    const dateFromGviz = rawValue.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
    if (dateFromGviz) {
      const [, year, month, day, hour = "0", minute = "0", second = "0"] = dateFromGviz;
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

function sanitizePhone(value) {
  if (!value) {
    return "";
  }
  return String(value).replace(/\D+/g, "");
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

function isPhoneLikeLabel(label) {
  const normalized = normalizeString(label);
  if (!normalized) return false;
  return (
    normalized.includes("telefone") ||
    normalized.includes("celular") ||
    normalized.includes("whatsapp") ||
    normalized.includes("contato") ||
    normalized.includes("telefono") ||
    normalized.includes("teléfono")
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

function resolveDisplayPhone(record, supplementalEntry, phoneColumn, supplementalPhoneColumn, baseValue = "") {
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

  if (phoneColumn) {
    const rawCandidate = record?.__raw?.[phoneColumn];
    if (rawCandidate != null) {
      pushCandidate(rawCandidate);
    }
  }

  if (supplementalEntry) {
    pushCandidate(supplementalEntry.phone);
    const supplementalRecord = supplementalEntry.record;

    if (supplementalRecord) {
      if (supplementalPhoneColumn) {
        pushCandidate(supplementalRecord[supplementalPhoneColumn]);
        const rawSupplemental = supplementalRecord.__raw?.[supplementalPhoneColumn];
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

      const rawBirth = birthColumn ? record.__raw?.[birthColumn] ?? record[birthColumn] : null;
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
    const list = index.get(entry.normalizedName);
    if (list) {
      list.push(entry);
    } else {
      index.set(entry.normalizedName, [entry]);
    }
  });
  return index;
}

function matchSupplementalRecord(record, birthDate, context) {
  const { index, nameColumn, phoneColumn } = context;
  if (!index || !index.size || !nameColumn) {
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

  const candidates = index.get(normalizedName);
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

  return candidates[0] ?? null;
}

function buildEnrichedRecords(records, context) {
  const {
    nameColumn,
    birthColumn,
    phoneColumn,
    supplementalNameColumn,
    supplementalPhoneColumn,
    supplementalIndex,
  } = context;

  return records.map((record, index) => {
    const rawBirth = birthColumn ? record.__raw?.[birthColumn] ?? record[birthColumn] : null;
    const birthDate = birthColumn ? parseDate(rawBirth) : null;
    const age = birthDate ? calculateAge(birthDate) : null;

    const supplementalEntry = matchSupplementalRecord(record, birthDate, {
      index: supplementalIndex,
      nameColumn: supplementalNameColumn,
      phoneColumn: supplementalPhoneColumn,
    });

    let phoneValue = phoneColumn ? record[phoneColumn] ?? "" : "";
    if (typeof phoneValue !== "string") {
      phoneValue = String(phoneValue ?? "");
    }

    const displayPhone = resolveDisplayPhone(
      record,
      supplementalEntry,
      phoneColumn,
      supplementalPhoneColumn,
      phoneValue
    );

    return {
      record,
      rowIndex: index,
      name: nameColumn ? record[nameColumn] ?? "" : "",
      birthDate,
      age,
      phone: displayPhone,
    };
  });
}

function buildDirectoryEntries(enrichedRecords) {
  if (!Array.isArray(enrichedRecords)) {
    return [];
  }
  const entries = enrichedRecords.map((entry) => ({
    name: entry.name != null ? String(entry.name).trim() : "",
    age: Number.isFinite(entry.age) ? entry.age : null,
    phone: entry.phone != null ? String(entry.phone).trim() : "",
  }));
  const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
  entries.sort((a, b) => collator.compare(a.name ?? "", b.name ?? ""));
  return entries;
}

async function writeDirectoryFile(entries) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputPath = path.resolve(__dirname, "../data/directory.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const payload = `${JSON.stringify(entries, null, 2)}\n`;
  await fs.writeFile(outputPath, payload, "utf8");
  return outputPath;
}

async function main() {
  try {
    const [primaryResult, supplementalResult] = await Promise.allSettled([
      fetchGvizTable(GVIZ_URL),
      fetchGvizTable(SUPPLEMENTAL_GVIZ_URL),
    ]);

    if (primaryResult.status !== "fulfilled") {
      throw primaryResult.reason ?? new Error("Unable to load primary spreadsheet");
    }

    const { columns, records } = primaryResult.value;

    const nameColumn = detectColumn(columns, records, [
      "nome completo do irmao",
      "nome do irmao",
      "nome",
      "name",
    ]);
    const birthColumn = detectColumn(columns, records, [
      "data de nascimento",
      "nascimento",
      "data de aniversario",
      "aniversario",
      "aniversário",
    ]);
    const phoneColumn = detectColumn(columns, records, [
      "telefone",
      "telefone celular",
      "telefone de contato",
      "celular",
      "whatsapp",
      "contato",
    ]);

    let supplementalRecords = [];
    let supplementalNameColumn = null;
    let supplementalBirthColumn = null;
    let supplementalPhoneColumn = null;
    let supplementalIndex = new Map();

    if (supplementalResult.status === "fulfilled") {
      const supplemental = supplementalResult.value;
      supplementalRecords = supplemental.records;
      supplementalNameColumn = detectColumn(supplemental.columns, supplemental.records, [
        "nome do adolescente",
        "nome do adolescente(a)",
        "nome adolescente",
        "nome",
      ]);
      supplementalBirthColumn = detectColumn(supplemental.columns, supplemental.records, [
        "data de aniversario do adolescente",
        "data de aniversário do adolescente",
        "data de nascimento",
        "nascimento",
      ]);
      supplementalPhoneColumn = detectColumn(supplemental.columns, supplemental.records, [
        "telefone do adolescente",
        "telefone adolescente",
        "telefone",
        "contato",
      ]);
      const supplementalEntries = buildSupplementalEntries(
        supplementalRecords,
        supplementalNameColumn,
        supplementalBirthColumn,
        supplementalPhoneColumn
      );
      supplementalIndex = buildSupplementalIndex(supplementalEntries);
    } else {
      console.warn("Supplemental spreadsheet could not be loaded:", supplementalResult.reason);
    }

    const enrichedRecords = buildEnrichedRecords(records, {
      nameColumn,
      birthColumn,
      phoneColumn,
      supplementalNameColumn,
      supplementalPhoneColumn,
      supplementalIndex,
    });

    const directoryEntries = buildDirectoryEntries(enrichedRecords);
    const outputPath = await writeDirectoryFile(directoryEntries);

    console.log(
      `Updated directory with ${directoryEntries.length} entries at ${path.relative(process.cwd(), outputPath)}`
    );
  } catch (error) {
    console.error("Failed to export directory:", error);
    process.exitCode = 1;
  }
}

main();
