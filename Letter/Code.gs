const SPREADSHEET_ID = '1FXHHXOZJgAVA9BCCOCy7Jqj8xEOGRg6QCjjA3fMZejU';
const SHEET_NAME = 'ชีต1';
const FIELDS = ['id', 'name', 'phone', 'address1', 'address2', 'province', 'zipcode'];

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.action === 'health') {
      const t = table_(sheet_());
      if (t.rows.length) checkHeaders_(t.headers);
      return jsonResponse({ status: 'success' });
    }
    if (p.action === 'list') {
      return jsonResponse(listAddresses_());
    }
    if (p.action === 'save' || p.action === 'delete') {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        return jsonResponse(p.action === 'save' ? saveAddress_(p.data) : deleteAddress_(p.id));
      } finally {
        lock.releaseLock();
      }
    }
    return jsonResponse({ error: 'Invalid action' });
  } catch (err) {
    return jsonResponse({ error: String(err.message || err) });
  }
}

function sheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('ไม่พบแท็บข้อมูล ' + SHEET_NAME);
  return sheet;
}

function table_(sheet) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length === 1 && rows[0].every(v => String(v).trim() === '')) return { rows: [], headers: [] };
  const headers = rows[0].map(v => String(v).trim().toLowerCase());
  return { rows, headers };
}

function checkHeaders_(headers) {
  const missing = FIELDS.filter(h => !headers.includes(h));
  if (missing.length) throw new Error('หัวคอลัมน์ไม่ครบ: ' + missing.join(', '));
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error('หัวคอลัมน์ซ้ำกัน');
}

function listAddresses_() {
  const t = table_(sheet_());
  if (!t.rows.length) return [];
  checkHeaders_(t.headers);
  const idIndex = t.headers.indexOf('id');
  return t.rows.slice(1).filter(row => String(row[idIndex] || '').trim() !== '').map(row => {
    const item = {};
    t.headers.forEach((h, i) => { if (FIELDS.includes(h)) item[h] = row[i]; });
    return item;
  });
}

function safeCell_(value) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  return /^[=+@\-]/.test(text) ? "'" + text : text;
}

function saveAddress_(rawData) {
  if (!rawData) throw new Error('ไม่มีข้อมูลผู้รับ');
  // e.parameter is decoded by Apps Script. A second decode corrupts percent signs.
  const item = JSON.parse(rawData);
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
  const id = String(item.id || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw new Error('รหัสรายการไม่ถูกต้อง');
  for (const key of ['name', 'address1', 'province', 'zipcode']) {
    if (!String(item[key] || '').trim()) throw new Error('กรุณาระบุ ' + key);
  }
  if (!/^\d{5}$/.test(String(item.zipcode).trim())) throw new Error('รหัสไปรษณีย์ต้องมี 5 หลัก');
  const sheet = sheet_();
  const t = table_(sheet);
  const headers = t.rows.length ? t.headers : FIELDS.slice();
  if (t.rows.length) checkHeaders_(headers);
  else sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const idIndex = headers.indexOf('id');
  const matchingRows = [];
  for (let i = 1; i < t.rows.length; i++) {
    if (String(t.rows[i][idIndex]).trim() === id) matchingRows.push(i + 1);
  }
  if (matchingRows.length > 1) throw new Error('พบรหัสรายการซ้ำใน Sheet');
  const rowData = headers.map(h => FIELDS.includes(h) ? safeCell_(h === 'id' ? id : item[h]) : '');
  if (matchingRows.length) {
    const row = matchingRows[0];
    headers.forEach((h, i) => { if (!FIELDS.includes(h)) rowData[i] = t.rows[row - 1][i]; });
    sheet.getRange(row, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return { status: 'success', id };
}

function deleteAddress_(rawId) {
  const id = String(rawId || '').trim();
  if (!id) throw new Error('ไม่มีรหัสรายการ');
  const sheet = sheet_();
  const t = table_(sheet);
  if (!t.rows.length) throw new Error('ไม่พบรายการที่จะลบ');
  checkHeaders_(t.headers);
  const idIndex = t.headers.indexOf('id');
  const matchingRows = [];
  for (let i = 1; i < t.rows.length; i++) {
    if (String(t.rows[i][idIndex]).trim() === id) matchingRows.push(i + 1);
  }
  if (matchingRows.length > 1) throw new Error('พบรหัสรายการซ้ำใน Sheet');
  if (!matchingRows.length) return { status: 'success', id, alreadyAbsent: true };
  sheet.deleteRow(matchingRows[0]);
  return { status: 'success', id };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
