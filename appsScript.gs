/**
 * Google Apps Script to synchronize "serviços" and "forms" sheets, generate
 * per-service tabs, and display popups with a person's information.
 * Paste this file into the Apps Script editor attached to your spreadsheet.
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ Sincronização')
    .addItem('Sincronizar agora', 'syncAll')
    .addItem('Mostrar popup da pessoa (linha atual)', 'showPersonPopupFromActiveRow')
    .addToUi();
}

function getConfig() {
  return {
    mainSheetName: 'serviços',
    formsSheetName: 'forms',
    nameHeaders: ['nome', 'name'],
    emailHeaders: ['email', 'e-mail'],
    timestampHeaders: ['timestamp', 'data', 'data/hora', 'submitted at']
  };
}

function syncAll() {
  try {
    var ss = SpreadsheetApp.getActive();
    var config = getConfig();
    var servicesData = loadServicesData(ss, config);
    var formsData = loadFormsData(ss, config);
    updateServiceSheets(ss, servicesData, formsData);
    ss.toast('Sincronização concluída.', '⚙️ Sincronização', 5);
  } catch (error) {
    console.error('Erro na sincronização:', error);
    SpreadsheetApp.getUi().alert('Erro na sincronização: ' + error.message);
    throw error;
  }
}

function showPersonPopupFromActiveRow() {
  try {
    var ss = SpreadsheetApp.getActive();
    var config = getConfig();
    var sheet = ss.getActiveSheet();
    if (sheet.getName() !== config.mainSheetName) {
      SpreadsheetApp.getUi().alert('Selecione uma linha na aba "' + config.mainSheetName + '".');
      return;
    }
    var activeCell = sheet.getActiveCell();
    if (!activeCell || activeCell.getRow() <= 1) {
      SpreadsheetApp.getUi().alert('Selecione uma linha com dados de pessoa.');
      return;
    }
    var name = sheet.getRange(activeCell.getRow(), 1).getValue();
    if (!name) {
      SpreadsheetApp.getUi().alert('Linha sem nome.');
      return;
    }
    showPersonPopupByName(name);
  } catch (error) {
    console.error('Erro ao mostrar popup pela linha ativa:', error);
    SpreadsheetApp.getUi().alert('Erro ao mostrar popup: ' + error.message);
  }
}

function showPersonPopupByName(name) {
  if (!name) {
    SpreadsheetApp.getUi().alert('Nome inválido.');
    return;
  }
  try {
    var ss = SpreadsheetApp.getActive();
    var config = getConfig();
    var servicesData = loadServicesData(ss, config);
    var normalizedTarget = normalizePersonKey(name);
    var person = null;
    for (var i = 0; i < servicesData.people.length; i++) {
      var current = servicesData.people[i];
      if (normalizePersonKey(current.name) === normalizedTarget) {
        person = current;
        break;
      }
    }
    if (!person) {
      SpreadsheetApp.getUi().alert('Pessoa não encontrada na aba "' + config.mainSheetName + '".');
      return;
    }
    var formsData = loadFormsData(ss, config);
    var record = getFormsRecordForName(person.name, formsData);
    var popupHtml = buildPersonPopupHtml(person, record, formsData);
    var htmlOutput = HtmlService.createHtmlOutput(popupHtml)
      .setWidth(420)
      .setHeight(520);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Dados da pessoa');
  } catch (error) {
    console.error('Erro ao mostrar popup da pessoa:', error);
    SpreadsheetApp.getUi().alert('Erro ao mostrar popup: ' + error.message);
  }
}

function loadServicesData(ss, config) {
  var sheet = ss.getSheetByName(config.mainSheetName);
  if (!sheet) {
    throw new Error('A aba "' + config.mainSheetName + '" não foi encontrada.');
  }
  var values = sheet.getDataRange().getValues();
  if (values.length === 0) {
    return { sheet: sheet, serviceHeaders: [], people: [], mapping: {} };
  }
  var headerRow = values[0];
  var mapping = getServiceSheetNameMap();
  var usedSheetNames = {};
  var serviceHeaders = [];
  for (var col = 1; col < headerRow.length; col++) {
    var serviceName = (headerRow[col] || '').toString().trim();
    if (!serviceName) {
      continue;
    }
    var mappedName = mapping[serviceName];
    var sanitized = mappedName || sanitizeSheetName(serviceName);
    if (!sanitized) {
      sanitized = 'Servico_' + (col + 1);
    }
    sanitized = ensureUniqueSheetName(sanitized, usedSheetNames);
    if (!mappedName || mappedName !== sanitized) {
      mapping[serviceName] = sanitized;
    }
    serviceHeaders.push({
      name: serviceName,
      columnIndex: col,
      sheetName: sanitized
    });
  }
  saveServiceSheetNameMap(mapping);

  var people = [];
  for (var row = 1; row < values.length; row++) {
    var name = (values[row][0] || '').toString().trim();
    if (!name) {
      continue;
    }
    var assignedServices = [];
    for (var s = 0; s < serviceHeaders.length; s++) {
      var header = serviceHeaders[s];
      var cell = values[row][header.columnIndex];
      if (cell === true || cell === 'TRUE') {
        assignedServices.push(header);
      }
    }
    people.push({
      name: name,
      services: assignedServices,
      rowIndex: row + 1
    });
  }

  return {
    sheet: sheet,
    serviceHeaders: serviceHeaders,
    people: people,
    mapping: mapping
  };
}

function loadFormsData(ss, config) {
  var sheet = ss.getSheetByName(config.formsSheetName);
  if (!sheet) {
    throw new Error('A aba "' + config.formsSheetName + '" não foi encontrada.');
  }
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length === 0) {
    return {
      headers: [],
      normalizedHeaders: [],
      recordsByName: {},
      recordsByKey: {},
      timestampHeader: null
    };
  }
  var headers = values[0].map(function (header) {
    return header ? header.toString().trim() : '';
  });
  var normalizedHeaders = headers.map(function (header) {
    return normalizeHeader(header);
  });

  var emailHeader = findHeader(headers, config.emailHeaders);
  var nameHeader = findHeader(headers, config.nameHeaders);
  var timestampHeader = findHeader(headers, config.timestampHeaders);

  var records = [];
  for (var row = 1; row < values.length; row++) {
    var rowValues = values[row];
    if (isRowEmpty(rowValues)) {
      continue;
    }
    var record = {};
    for (var col = 0; col < headers.length; col++) {
      record[headers[col]] = rowValues[col];
    }
    record.__rowIndex = row + 1;
    record.__name = nameHeader ? (record[nameHeader] || '').toString().trim() : '';
    record.__email = emailHeader ? (record[emailHeader] || '').toString().trim() : '';
    record.__timestamp = timestampHeader ? record[timestampHeader] : null;
    records.push(record);
  }

  var emailIndex = emailHeader ? indexByKey(records, '__email', normalizeEmail) : {};
  var nameIndex = nameHeader ? indexByKey(records, '__name', normalizePersonKey) : {};
  var keyIndex = Object.keys(emailIndex).length ? emailIndex : nameIndex;

  var flattenedByKey = {};
  for (var key in keyIndex) {
    if (keyIndex.hasOwnProperty(key)) {
      flattenedByKey[key] = getMostRecent(keyIndex[key], timestampHeader);
    }
  }
  var flattenedByName = {};
  for (var nameKey in nameIndex) {
    if (nameIndex.hasOwnProperty(nameKey)) {
      flattenedByName[nameKey] = getMostRecent(nameIndex[nameKey], timestampHeader);
    }
  }

  return {
    headers: headers,
    normalizedHeaders: normalizedHeaders,
    emailHeader: emailHeader,
    nameHeader: nameHeader,
    timestampHeader: timestampHeader,
    recordsByName: flattenedByName,
    recordsByKey: flattenedByKey
  };
}

function updateServiceSheets(ss, servicesData, formsData) {
  var formsHeaders = getFormsOutputHeaders(formsData);
  var headerRow = ['Nome'].concat(formsHeaders);
  var serviceRowsMap = {};
  for (var i = 0; i < servicesData.serviceHeaders.length; i++) {
    var serviceHeader = servicesData.serviceHeaders[i];
    serviceRowsMap[serviceHeader.sheetName] = [];
  }

  for (var p = 0; p < servicesData.people.length; p++) {
    var person = servicesData.people[p];
    if (!person.services.length) {
      continue;
    }
    var record = getFormsRecordForName(person.name, formsData);
    var baseRow = [person.name];
    for (var fh = 0; fh < formsHeaders.length; fh++) {
      var headerName = formsHeaders[fh];
      baseRow.push(record && record.hasOwnProperty(headerName) ? record[headerName] : '');
    }
    for (var s = 0; s < person.services.length; s++) {
      var service = person.services[s];
      if (!serviceRowsMap.hasOwnProperty(service.sheetName)) {
        serviceRowsMap[service.sheetName] = [];
      }
      serviceRowsMap[service.sheetName].push(baseRow.slice());
    }
  }

  for (var svc = 0; svc < servicesData.serviceHeaders.length; svc++) {
    var svcHeader = servicesData.serviceHeaders[svc];
    var rows = serviceRowsMap[svcHeader.sheetName] || [];
    rows.sort(function (a, b) {
      return a[0].toString().localeCompare(b[0].toString());
    });
    upsertServiceSheet(ss, svcHeader.sheetName, headerRow, rows);
  }
}

function upsertServiceSheet(ss, sheetName, headerRow, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  }
  ensureColumnCapacity(sheet, headerRow.length);
  sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headerRow.length).setValues(rows);
  }
}

function getFormsOutputHeaders(formsData) {
  if (!formsData || !formsData.headers || !formsData.headers.length) {
    return [];
  }
  var output = [];
  for (var i = 0; i < formsData.headers.length; i++) {
    var header = formsData.headers[i];
    var normalized = formsData.normalizedHeaders[i];
    if (!header) {
      continue;
    }
    if (!normalized) {
      continue;
    }
    if (normalized === 'nome' || normalized === 'name') {
      continue;
    }
    output.push(header);
  }
  return output;
}

function buildPersonPopupHtml(person, record, formsData) {
  var servicesList = person.services.map(function (service) {
    return service.name;
  });
  if (!servicesList.length) {
    servicesList.push('N.Serviço');
  }
  var detailRows = [];
  if (record) {
    for (var i = 0; i < formsData.headers.length; i++) {
      var header = formsData.headers[i];
      var normalized = formsData.normalizedHeaders[i];
      if (!header || !normalized) {
        continue;
      }
      if (normalized === 'nome' || normalized === 'name') {
        continue;
      }
      var value = record[header];
      if (value === null || value === undefined || value === '') {
        continue;
      }
      detailRows.push({ label: header, value: value });
    }
  }

  var html = [];
  html.push('<!DOCTYPE html>');
  html.push('<html>');
  html.push('<head>');
  html.push('<meta charset="utf-8" />');
  html.push('<style>');
  html.push('body { font-family: "Roboto", Arial, sans-serif; margin: 0; padding: 16px; background: #121212; color: #f1f1f1; }');
  html.push('h1 { font-size: 20px; margin: 0 0 12px; }');
  html.push('section { margin-bottom: 16px; }');
  html.push('.tag-list { display: flex; flex-wrap: wrap; gap: 8px; }');
  html.push('.tag { background: linear-gradient(135deg, #4f46e5, #9333ea); padding: 6px 12px; border-radius: 999px; font-size: 13px; }');
  html.push('.row { margin-bottom: 10px; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,0.06); }');
  html.push('.row span { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; margin-bottom: 4px; }');
  html.push('.empty { color: #a1a1aa; font-style: italic; }');
  html.push('</style>');
  html.push('</head>');
  html.push('<body>');
  html.push('<section>');
  html.push('<h1>' + sanitizeHtml(person.name) + '</h1>');
  html.push('<div class="tag-list">');
  for (var s = 0; s < servicesList.length; s++) {
    html.push('<div class="tag">' + sanitizeHtml(servicesList[s]) + '</div>');
  }
  html.push('</div>');
  html.push('</section>');
  html.push('<section>');
  html.push('<h2 style="font-size:16px;margin-bottom:10px;">Dados do formulário</h2>');
  if (!detailRows.length) {
    html.push('<p class="empty">Sem dados adicionais do formulário.</p>');
  } else {
    for (var d = 0; d < detailRows.length; d++) {
      var row = detailRows[d];
      html.push('<div class="row"><span>' + sanitizeHtml(row.label) + '</span>' + sanitizeHtml(formatValue(row.value)) + '</div>');
    }
  }
  html.push('</section>');
  html.push('</body>');
  html.push('</html>');
  return html.join('');
}

function getFormsRecordForName(name, formsData) {
  if (!formsData) {
    return null;
  }
  var normalizedName = normalizePersonKey(name);
  if (formsData.recordsByName && formsData.recordsByName.hasOwnProperty(normalizedName)) {
    return formsData.recordsByName[normalizedName];
  }
  if (formsData.recordsByKey && formsData.recordsByKey.hasOwnProperty(normalizedName)) {
    return formsData.recordsByKey[normalizedName];
  }
  return null;
}

function indexByKey(rows, key, normalizer) {
  var index = {};
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rawKey = row[key];
    if (!rawKey) {
      continue;
    }
    var normalized = normalizer ? normalizer(rawKey) : normalizePersonKey(rawKey);
    if (!normalized) {
      continue;
    }
    if (!index[normalized]) {
      index[normalized] = [];
    }
    index[normalized].push(row);
  }
  return index;
}

function getMostRecent(records, timestampHeader) {
  if (!records || !records.length) {
    return null;
  }
  if (!timestampHeader) {
    return records[records.length - 1];
  }
  var bestRecord = records[records.length - 1];
  var bestTimestamp = parseTimestamp(bestRecord[timestampHeader]);
  for (var i = records.length - 2; i >= 0; i--) {
    var candidate = records[i];
    var candidateTimestamp = parseTimestamp(candidate[timestampHeader]);
    if (candidateTimestamp && (!bestTimestamp || candidateTimestamp > bestTimestamp)) {
      bestRecord = candidate;
      bestTimestamp = candidateTimestamp;
    }
  }
  return bestRecord;
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value;
  }
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeHeader(str) {
  if (!str) {
    return '';
  }
  return str.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function normalizePersonKey(value) {
  if (!value) {
    return '';
  }
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeEmail(value) {
  if (!value) {
    return '';
  }
  return value.toString().trim().toLowerCase();
}

function findHeader(headers, candidates) {
  if (!headers || !headers.length) {
    return null;
  }
  var normalizedHeaders = headers.map(normalizeHeader);
  for (var i = 0; i < candidates.length; i++) {
    var candidate = normalizeHeader(candidates[i]);
    for (var col = 0; col < normalizedHeaders.length; col++) {
      if (normalizedHeaders[col] === candidate) {
        return headers[col];
      }
    }
  }
  return null;
}

function ensureColumnCapacity(sheet, requiredColumns) {
  var current = sheet.getMaxColumns();
  if (current < requiredColumns) {
    sheet.insertColumnsAfter(current, requiredColumns - current);
  }
}

function sanitizeSheetName(name) {
  if (!name) {
    return '';
  }
  var cleaned = name.toString().trim().replace(/[\\/?*\[\]:]/g, '_');
  if (!cleaned) {
    cleaned = 'Servico';
  }
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100);
  }
  return cleaned;
}

function ensureUniqueSheetName(baseName, used) {
  var name = baseName;
  var counter = 2;
  while (used[name]) {
    var suffix = ' (' + counter + ')';
    var trimmedBase = baseName;
    if (trimmedBase.length + suffix.length > 100) {
      trimmedBase = trimmedBase.substring(0, 100 - suffix.length);
    }
    name = trimmedBase + suffix;
    counter++;
  }
  used[name] = true;
  return name;
}

function getServiceSheetNameMap() {
  var props = PropertiesService.getDocumentProperties();
  var raw = props.getProperty('SERVICE_SHEET_MAP');
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Não foi possível interpretar o mapa de serviços salvo:', error);
    return {};
  }
}

function saveServiceSheetNameMap(map) {
  var props = PropertiesService.getDocumentProperties();
  props.setProperty('SERVICE_SHEET_MAP', JSON.stringify(map));
}

function sanitizeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return value.toString().replace(/[&<>\"]/g, function (char) {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return char;
    }
  });
}

function formatValue(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  }
  return value;
}

function isRowEmpty(row) {
  if (!row) {
    return true;
  }
  for (var i = 0; i < row.length; i++) {
    if (row[i] !== null && row[i] !== '') {
      return false;
    }
  }
  return true;
}
