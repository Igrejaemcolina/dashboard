/**
 * Google Apps Script que sincroniza a aba "Serviços" com as abas de cada
 * ministério existente, reutilizando os dados adicionais da aba "Forms".
 * Cole este arquivo no editor do Apps Script ligado à planilha.
 */

var SERVICE_TABS_CACHE = null;

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ Sincronização')
    .addItem('Sincronizar agora', 'syncAll')
    .addItem('Mostrar popup da pessoa (linha atual)', 'showPersonPopupFromActiveRow')
    .addToUi();
}

function getConfig() {
  return {
    mainSheetName: 'Serviços',
    formsSheetName: 'Forms',
    nameHeaders: ['nome', 'name'],
    emailHeaders: ['email', 'e-mail'],
    phoneHeaders: ['telefone', 'celular', 'phone', 'telefone celular'],
    timestampHeaders: ['timestamp', 'data', 'data hora', 'data/hora', 'submitted at']
  };
}

function syncAll() {
  try {
    var ss = SpreadsheetApp.getActive();
    var config = getConfig();
    SERVICE_TABS_CACHE = null;
    var servicesData = loadServicesData(ss, config);
    var formsData = loadFormsData(ss, config);
    updateServiceSheets(ss, servicesData, formsData);
    ss.toast('Sincronização concluída.', '⚙️ Sincronização', 5);
  } catch (error) {
    console.error('Erro na sincronização geral:', error);
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
    var cell = sheet.getActiveCell();
    if (!cell || cell.getRow() <= 1) {
      SpreadsheetApp.getUi().alert('Selecione uma linha com dados de pessoa.');
      return;
    }
    var name = sheet.getRange(cell.getRow(), 1).getValue();
    if (!name) {
      SpreadsheetApp.getUi().alert('A linha selecionada não possui nome.');
      return;
    }
    showPersonPopupByName(name);
  } catch (error) {
    console.error('Erro ao abrir popup pela linha ativa:', error);
    SpreadsheetApp.getUi().alert('Erro ao abrir popup: ' + error.message);
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
    var normalizedTarget = normalize(name);
    var person = null;
    for (var i = 0; i < servicesData.people.length; i++) {
      if (servicesData.people[i].normalizedName === normalizedTarget) {
        person = servicesData.people[i];
        break;
      }
    }
    if (!person) {
      SpreadsheetApp.getUi().alert('Pessoa não encontrada na aba "' + config.mainSheetName + '".');
      return;
    }
    var formsData = loadFormsData(ss, config);
    var record = getFormsRecordForName(person.name, formsData);
    var html = buildPersonPopupHtml(person, record, formsData);
    var output = HtmlService.createHtmlOutput(html)
      .setWidth(420)
      .setHeight(520);
    SpreadsheetApp.getUi().showModalDialog(output, 'Dados da pessoa');
  } catch (error) {
    console.error('Erro ao montar popup da pessoa:', error);
    SpreadsheetApp.getUi().alert('Erro ao montar popup: ' + error.message);
  }
}

function loadServicesData(ss, config) {
  var sheet = ss.getSheetByName(config.mainSheetName);
  if (!sheet) {
    throw new Error('A aba "' + config.mainSheetName + '" não foi encontrada.');
  }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return { sheet: sheet, people: [] };
  }
  var range = sheet.getRange(1, 1, lastRow, Math.min(2, lastCol));
  var values = range.getValues();
  var people = [];
  for (var row = 1; row < values.length; row++) {
    var name = values[row][0];
    var servicesCell = values[row][1];
    if (!name && !servicesCell) {
      continue;
    }
    var trimmedName = name ? name.toString().trim() : '';
    if (!trimmedName) {
      continue;
    }
    var servicesList = splitServices(servicesCell);
    people.push({
      name: trimmedName,
      normalizedName: normalize(trimmedName),
      services: servicesList,
      rowIndex: row + 1
    });
  }
  return { sheet: sheet, people: people };
}

function loadFormsData(ss, config) {
  var sheet = ss.getSheetByName(config.formsSheetName);
  if (!sheet) {
    console.log('Aba "' + config.formsSheetName + '" não encontrada. Prosseguindo sem dados adicionais.');
    return {
      sheet: null,
      headers: [],
      normalizedHeaders: [],
      nameIndex: null,
      timestampIndex: null,
      outputColumnIndexes: [],
      outputColumnHeaders: [],
      recordsByName: {}
    };
  }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol === 0) {
    var emptyHeaderInfo = detectHeaders(sheet);
    return {
      sheet: sheet,
      headers: emptyHeaderInfo.headers,
      normalizedHeaders: emptyHeaderInfo.normalizedHeaders,
      nameIndex: null,
      timestampIndex: null,
      outputColumnIndexes: [],
      outputColumnHeaders: [],
      recordsByName: {}
    };
  }
  var dataRange = sheet.getRange(1, 1, lastRow, lastCol);
  var values = dataRange.getValues();
  var headerInfo = detectHeaders(sheet);
  var headers = headerInfo.headers;
  var nameIndex = headerInfo.indexes.name;
  if (nameIndex === null || nameIndex === undefined) {
    throw new Error('Não foi possível localizar a coluna de Nome na aba "' + config.formsSheetName + '".');
  }
  var timestampIndex = headerInfo.indexes.timestamp;
  var recordsByName = {};
  for (var row = 1; row < values.length; row++) {
    var rowValues = values[row];
    var nameValue = rowValues[nameIndex];
    if (!nameValue) {
      continue;
    }
    var key = normalize(nameValue);
    if (!key) {
      continue;
    }
    var record = {
      values: rowValues,
      rowIndex: row + 1
    };
    if (recordsByName[key]) {
      recordsByName[key] = pickMostRecent([recordsByName[key], record], timestampIndex);
    } else {
      recordsByName[key] = record;
    }
  }
  var outputColumnIndexes = [];
  var outputColumnHeaders = [];
  for (var col = 0; col < headers.length; col++) {
    if (col === nameIndex) {
      continue;
    }
    var headerLabel = headers[col];
    if (headerLabel === null || headerLabel === undefined || headerLabel === '') {
      continue;
    }
    outputColumnIndexes.push(col);
    outputColumnHeaders.push(headerLabel);
  }
  return {
    sheet: sheet,
    headers: headers,
    normalizedHeaders: headerInfo.normalizedHeaders,
    nameIndex: nameIndex,
    timestampIndex: timestampIndex,
    outputColumnIndexes: outputColumnIndexes,
    outputColumnHeaders: outputColumnHeaders,
    recordsByName: recordsByName
  };
}

function updateServiceSheets(ss, servicesData, formsData) {
  var serviceTabsMap = getServiceTabsMap();
  var formsIndexes = formsData.outputColumnIndexes || [];
  var groups = {};
  var missingServices = {};
  for (var i = 0; i < servicesData.people.length; i++) {
    var person = servicesData.people[i];
    for (var j = 0; j < person.services.length; j++) {
      var serviceName = person.services[j];
      var variants = buildServiceKeyVariants(serviceName);
      if (!variants.length) {
        continue;
      }
      var matchedKey = null;
      for (var v = 0; v < variants.length; v++) {
        if (serviceTabsMap[variants[v]]) {
          matchedKey = variants[v];
          break;
        }
      }
      var targetKey = matchedKey || variants[0];
      if (!groups[targetKey]) {
        groups[targetKey] = {
          normalized: targetKey,
          displayName: serviceName,
          sheetName: matchedKey ? serviceTabsMap[matchedKey] : null,
          people: [],
          matched: !!matchedKey
        };
      }
      groups[targetKey].people.push(person);
      if (!matchedKey) {
        missingServices[targetKey] = serviceName;
      }
    }
  }
  for (var missingKey in missingServices) {
    if (missingServices.hasOwnProperty(missingKey) && !serviceTabsMap[missingKey]) {
      console.log('Serviço "' + missingServices[missingKey] + '" ignorado: aba correspondente não encontrada.');
    }
  }
  for (var key in serviceTabsMap) {
    if (!serviceTabsMap.hasOwnProperty(key)) {
      continue;
    }
    var sheetName = serviceTabsMap[key];
    var group = groups[key];
    var displayName = group ? group.displayName : sheetName;
    try {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        console.log('Aba "' + sheetName + '" não encontrada para o serviço "' + displayName + '".');
        continue;
      }
      clearSheetBody(sheet);
      if (!group || !group.matched || group.people.length === 0) {
        continue;
      }
      group.people.sort(function(a, b) {
        var na = a.normalizedName;
        var nb = b.normalizedName;
        if (na < nb) return -1;
        if (na > nb) return 1;
        return 0;
      });
      var dataRows = [];
      for (var idx = 0; idx < group.people.length; idx++) {
        var current = group.people[idx];
        var record = getFormsRecordForName(current.name, formsData);
        var row = [current.name];
        for (var c = 0; c < formsIndexes.length; c++) {
          var colIndex = formsIndexes[c];
          var value = record ? record.values[colIndex] : '';
          row.push(value === undefined ? '' : value);
        }
        dataRows.push(row);
      }
      if (dataRows.length > 0) {
        var targetCols = Math.max(sheet.getLastColumn(), dataRows[0].length);
        targetCols = Math.max(targetCols, 1);
        for (var r = 0; r < dataRows.length; r++) {
          while (dataRows[r].length < targetCols) {
            dataRows[r].push('');
          }
          if (dataRows[r].length > targetCols) {
            dataRows[r] = dataRows[r].slice(0, targetCols);
          }
        }
        sheet.getRange(2, 1, dataRows.length, targetCols).setValues(dataRows);
      }
    } catch (error) {
      console.error('Erro ao atualizar a aba do serviço "' + displayName + '":', error);
    }
  }
}

function getServiceTabsMap() {
  if (SERVICE_TABS_CACHE) {
    return SERVICE_TABS_CACHE;
  }
  var ss = SpreadsheetApp.getActive();
  var config = getConfig();
  var sheets = ss.getSheets();
  var map = {};
  var forbidden = {};
  forbidden[normalize(config.mainSheetName)] = true;
  forbidden[normalize(config.formsSheetName)] = true;
  for (var i = 0; i < sheets.length; i++) {
    var sheetName = sheets[i].getName();
    var variants = buildServiceKeyVariants(sheetName);
    if (!variants.length) {
      continue;
    }
    var skip = false;
    for (var f in forbidden) {
      if (forbidden.hasOwnProperty(f) && variants.indexOf(f) !== -1) {
        skip = true;
        break;
      }
    }
    if (skip) {
      continue;
    }
    for (var v = 0; v < variants.length; v++) {
      var key = variants[v];
      if (!map[key]) {
        map[key] = sheetName;
      }
    }
  }
  SERVICE_TABS_CACHE = map;
  return map;
}

function clearSheetBody(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) {
    return;
  }
  sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
}

function splitServices(cellValue) {
  if (cellValue === null || cellValue === undefined) {
    return [];
  }
  var text = cellValue;
  if (Array.isArray(text)) {
    text = text.join(',');
  }
  text = text.toString().replace(/\r?\n/g, ',');
  var rawParts = text.split(',');
  var seen = {};
  var result = [];
  for (var i = 0; i < rawParts.length; i++) {
    var part = rawParts[i];
    if (part === null || part === undefined) {
      continue;
    }
    var cleaned = part.toString().replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      continue;
    }
    var key = normalize(cleaned);
    if (!key || seen[key]) {
      continue;
    }
    seen[key] = true;
    result.push(cleaned);
  }
  return result;
}

function buildServiceKeyVariants(name) {
  if (name === null || name === undefined) {
    return [];
  }
  var raw = name.toString();
  var candidates = [raw, raw.replace(/[_-]+/g, ' ')];
  var seen = {};
  var variants = [];
  for (var i = 0; i < candidates.length; i++) {
    var base = normalize(candidates[i]);
    if (!base || seen[base]) {
      continue;
    }
    seen[base] = true;
    variants.push(base);
    var collapsed = base.replace(/\s+/g, '');
    if (collapsed && !seen[collapsed]) {
      seen[collapsed] = true;
      variants.push(collapsed);
    }
  }
  return variants;
}

function detectHeaders(sheet) {
  var config = getConfig();
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    return {
      headers: [],
      normalizedHeaders: [],
      indexes: {
        name: null,
        email: null,
        phone: null,
        timestamp: null
      }
    };
  }
  var headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var normalizedHeaders = [];
  var indexMap = {};
  for (var i = 0; i < headerValues.length; i++) {
    var header = headerValues[i] === null || headerValues[i] === undefined ? '' : headerValues[i].toString();
    var normalized = normalize(header);
    normalizedHeaders.push(normalized);
    if (normalized && indexMap[normalized] === undefined) {
      indexMap[normalized] = i;
    }
  }
  return {
    headers: headerValues,
    normalizedHeaders: normalizedHeaders,
    indexes: {
      name: findHeaderIndex(normalizedHeaders, config.nameHeaders),
      email: findHeaderIndex(normalizedHeaders, config.emailHeaders),
      phone: findHeaderIndex(normalizedHeaders, config.phoneHeaders),
      timestamp: findHeaderIndex(normalizedHeaders, config.timestampHeaders)
    }
  };
}

function findHeaderIndex(normalizedHeaders, candidates) {
  if (!normalizedHeaders || !candidates) {
    return null;
  }
  for (var i = 0; i < normalizedHeaders.length; i++) {
    var value = normalizedHeaders[i];
    if (!value) {
      continue;
    }
    for (var j = 0; j < candidates.length; j++) {
      var target = normalize(candidates[j]);
      if (value === target) {
        return i;
      }
    }
  }
  for (var k = 0; k < normalizedHeaders.length; k++) {
    var headerValue = normalizedHeaders[k];
    if (!headerValue) {
      continue;
    }
    for (var h = 0; h < candidates.length; h++) {
      var candidate = normalize(candidates[h]);
      if (candidate && headerValue.indexOf(candidate) !== -1) {
        return k;
      }
    }
  }
  return null;
}

function pickMostRecent(records, timestampIndex) {
  if (!records || records.length === 0) {
    return null;
  }
  var chosen = records[0];
  for (var i = 1; i < records.length; i++) {
    chosen = chooseMoreRecentRecord(chosen, records[i], timestampIndex);
  }
  return chosen;
}

function chooseMoreRecentRecord(a, b, timestampIndex) {
  if (timestampIndex !== null && timestampIndex !== undefined) {
    var timeA = parseTimestamp(a.values[timestampIndex]);
    var timeB = parseTimestamp(b.values[timestampIndex]);
    if (timeA && timeB) {
      return timeB.getTime() >= timeA.getTime() ? b : a;
    }
    if (timeB && !timeA) {
      return b;
    }
    if (!timeB && timeA) {
      return a;
    }
  }
  return a.rowIndex >= b.rowIndex ? a : b;
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getFormsRecordForName(name, formsData) {
  if (!formsData || !formsData.recordsByName) {
    return null;
  }
  var key = normalize(name);
  if (!key) {
    return null;
  }
  return formsData.recordsByName[key] || null;
}

function buildPersonPopupHtml(person, record, formsData) {
  var servicesList = person.services && person.services.length ? person.services : ['N.Serviço'];
  var html = [];
  html.push('<div style="font-family:Arial,sans-serif;padding:16px;max-width:480px;">');
  html.push('<h2 style="margin-top:0;">' + escapeHtml(person.name) + '</h2>');
  html.push('<p><strong>Serviços:</strong> ' + escapeHtml(servicesList.join(', ')) + '</p>');
  if (record && formsData && formsData.outputColumnIndexes && formsData.outputColumnIndexes.length) {
    var details = [];
    for (var i = 0; i < formsData.outputColumnIndexes.length; i++) {
      var colIndex = formsData.outputColumnIndexes[i];
      var header = formsData.outputColumnHeaders[i];
      var value = record.values[colIndex];
      if (value === null || value === undefined || value === '') {
        continue;
      }
      details.push({ header: header, value: value });
    }
    if (details.length) {
      html.push('<div style="margin-top:12px;">');
      html.push('<table style="width:100%;border-collapse:collapse;">');
      for (var d = 0; d < details.length; d++) {
        var item = details[d];
        html.push('<tr>');
        html.push('<th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ddd;white-space:nowrap;">' + escapeHtml(item.header) + '</th>');
        html.push('<td style="padding:4px 8px;border-bottom:1px solid #ddd;">' + escapeHtml(formatFieldValue(item.value)) + '</td>');
        html.push('</tr>');
      }
      html.push('</table>');
      html.push('</div>');
    } else {
      html.push('<p style="margin-top:12px;">Sem dados adicionais encontrados na aba "Forms".</p>');
    }
  } else {
    html.push('<p style="margin-top:12px;">Sem dados adicionais encontrados na aba "Forms".</p>');
  }
  html.push('</div>');
  return html.join('');
}

function formatFieldValue(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  }
  return value.toString();
}

function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  return text
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalize(str) {
  if (str === null || str === undefined) {
    return '';
  }
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
