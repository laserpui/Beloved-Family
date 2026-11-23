/**
 * Family Bank Manager — Google Apps Script / Google Sheets backend
 * 1. Paste into a spreadsheet-bound Apps Script project.
 * 2. Run setupFamilyBank() once. No existing account rows are cleared.
 * 3. No API key is required. Access is determined by the Web app deployment.
 * 4. Deploy as Web app. See APPS_SCRIPT_SETUP.md for the API contract.
 * All account operations use POST; GET exposes health information only.
 */
const FAMILY_BANK = Object.freeze({
  build: '2026-11-23.audit1',
  sheetName: 'FamilyBank_Accounts',
  idProperty: 'FAMILY_BANK_SPREADSHEET_ID',
  maxAccounts: 10000,
  maxBodyChars: 2000000,
  headers: ['id', 'nickname', 'bank', 'number', 'owner', 'type', 'category', 'branch', 'note', 'status', 'favorite', 'createdAt', 'updatedAt'],
  banks: ['kbank', 'scb', 'bbl', 'ktb', 'bay', 'ttb', 'gsb', 'baac', 'ghb', 'cimb', 'uob', 'other'],
  types: ['ออมทรัพย์', 'กระแสรายวัน', 'ฝากประจำ', 'อื่น ๆ'],
  // Legacy values remain valid for existing records and backups; the form offers the four family roles.
  categories: ['พ่อ', 'แม่', 'ลูกชาย', 'ลูกสาว', 'ส่วนตัว', 'ครอบครัว', 'ธุรกิจ', 'อื่น ๆ']
});

/** Run from the editor; setup never deletes existing rows. */
function setupFamilyBank() {
  return withFamilyBankLock_(function () {
    const props = PropertiesService.getScriptProperties();
    const configuredId = props.getProperty(FAMILY_BANK.idProperty);
    const ss = configuredId ? SpreadsheetApp.openById(configuredId) : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) failFamilyBank_('NOT_CONFIGURED', 'กรุณาเปิด Apps Script จาก Google Sheet หรือกำหนด FAMILY_BANK_SPREADSHEET_ID ใน Script properties');
    let sheet = ss.getSheetByName(FAMILY_BANK.sheetName);
    if (!sheet) sheet = ss.insertSheet(FAMILY_BANK.sheetName);
    if (sheet.getLastRow() === 0) {
      ensureFamilyBankGrid_(sheet, 1);
      sheet.getRange(1, 1, 1, FAMILY_BANK.headers.length).setValues([FAMILY_BANK.headers]);
    }
    assertFamilyBankHeaders_(sheet);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, FAMILY_BANK.headers.length)
      .setBackground('#146a68').setFontColor('#ffffff').setFontWeight('bold');
    props.setProperty(FAMILY_BANK.idProperty, ss.getId());
    SpreadsheetApp.flush();
    const result = { ok: true, sheetName: FAMILY_BANK.sheetName, message: 'ตั้งค่า Google Sheets แล้ว ระบบนี้ไม่ใช้ API key' };
    console.log(result.message);
    return result;
  });
}

/** Public health endpoint: never exposes accounts, spreadsheet ID or API key. */
function doGet() {
  return familyBankJson_({ ok: true, service: 'Family Bank Manager', apiVersion: 1, build: FAMILY_BANK.build, message: 'Use POST with action for account operations. No API key is required.' });
}

/** JSON or text/plain containing JSON. No API key is required. */
function doPost(e) {
  const startedAt = Date.now();
  try {
    const raw = e && e.postData && e.postData.contents;
    if (typeof raw !== 'string' || !raw.length) failFamilyBank_('INVALID_REQUEST', 'ต้องส่ง JSON ใน request body');
    if (raw.length > FAMILY_BANK.maxBodyChars) failFamilyBank_('PAYLOAD_TOO_LARGE', 'ข้อมูลที่ส่งมีขนาดใหญ่เกินกำหนด');
    let request;
    try { request = JSON.parse(raw); } catch (error) { failFamilyBank_('INVALID_JSON', 'อ่าน JSON ไม่สำเร็จ'); }
    if (!request || typeof request !== 'object' || Array.isArray(request)) failFamilyBank_('INVALID_REQUEST', 'รูปแบบคำขอไม่ถูกต้อง');
    const data = withFamilyBankLock_(function () {
      const sheet = getFamilyBankSheet_();
      switch (request.action) {
        case 'list': return { version: 1, accounts: readFamilyBankAccounts_(sheet) };
        case 'saveAccount': return saveFamilyBankAccount_(sheet, request.account, request.expectedUpdatedAt);
        case 'setFavorite': return setFamilyBankFavorite_(sheet, request);
        case 'deleteAccount': return deleteFamilyBankAccount_(sheet, request);
        case 'importAccounts': return importFamilyBankAccounts_(sheet, request.backup);
        default: failFamilyBank_('UNKNOWN_ACTION', 'รองรับ list, saveAccount, setFavorite, deleteAccount และ importAccounts');
      }
    });
    return familyBankJson_({ ok: true, data: data, meta: { build: FAMILY_BANK.build, serverMs: Date.now() - startedAt } });
  } catch (error) {
    // Never log request bodies or return internal exceptions containing financial data.
    return familyBankJson_({ ok: false, error: { code: error.familyBankCode || 'INTERNAL_ERROR', message: error.familyBankCode ? error.message : 'ระบบทำรายการไม่สำเร็จ กรุณาตรวจการตั้งค่าและสิทธิ์ของ Apps Script' } });
  }
}

function withFamilyBankLock_(work) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) failFamilyBank_('BUSY', 'มีผู้ใช้งานกำลังบันทึกข้อมูล กรุณาลองใหม่');
  try { return work(); } finally { lock.releaseLock(); }
}

function getFamilyBankSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(FAMILY_BANK.idProperty);
  if (!spreadsheetId) failFamilyBank_('NOT_CONFIGURED', 'กรุณารัน setupFamilyBank() ก่อน');
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(FAMILY_BANK.sheetName);
  if (!sheet) failFamilyBank_('NOT_CONFIGURED', 'ไม่พบชีตบัญชี กรุณารัน setupFamilyBank()');
  return sheet;
}

function assertFamilyBankHeaders_(sheet, suppliedHeader) {
  if (!suppliedHeader && sheet.getMaxColumns() < FAMILY_BANK.headers.length) failFamilyBank_('SCHEMA_MISMATCH', 'คอลัมน์ชีตไม่ตรงกับระบบ ระบบไม่ได้แก้ไขข้อมูลเดิม');
  const actual = suppliedHeader || sheet.getRange(1, 1, 1, FAMILY_BANK.headers.length).getDisplayValues()[0];
  if (actual.some(function (value, index) { return value !== FAMILY_BANK.headers[index]; })) {
    failFamilyBank_('SCHEMA_MISMATCH', 'หัวตารางของ FamilyBank_Accounts ไม่ตรงกับระบบ กรุณาตรวจสอบโดยไม่ลบข้อมูลเดิม');
  }
}

function readFamilyBankAccounts_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1 || sheet.getMaxColumns() < FAMILY_BANK.headers.length) failFamilyBank_('SCHEMA_MISMATCH', 'หัวตารางบัญชีไม่ครบ กรุณาตรวจการตั้งค่า');
  if (lastRow - 1 > FAMILY_BANK.maxAccounts) failFamilyBank_('LIMIT_EXCEEDED', 'จำนวนแถวเกิน 10,000 บัญชี');
  // Read headers and account data together, rather than two separate Sheet round trips.
  const matrix = sheet.getRange(1, 1, lastRow, FAMILY_BANK.headers.length).getDisplayValues();
  assertFamilyBankHeaders_(sheet, matrix[0]);
  const rows = matrix.slice(1);
  const ids = new Set(), pairs = new Set();
  return rows.map(function (row, index) {
    if (row.every(function (value) { return value === ''; })) return null;
    const raw = {};
    FAMILY_BANK.headers.forEach(function (key, column) { raw[key] = row[column]; });
    const favorite = raw.favorite.toLowerCase();
    if (favorite !== 'true' && favorite !== 'false') failFamilyBank_('INVALID_SHEET_DATA', 'ค่า favorite ในแถว ' + (index + 2) + ' ต้องเป็น true หรือ false');
    raw.favorite = favorite === 'true';
    let account;
    try { account = validateFamilyBankAccount_(raw, false); }
    catch (error) { failFamilyBank_('INVALID_SHEET_DATA', 'ข้อมูลบัญชีในแถว ' + (index + 2) + ' ไม่ถูกต้อง กรุณาตรวจชื่อ ธนาคาร เลขบัญชี และสถานะ'); }
    if (!raw.createdAt || !raw.updatedAt) failFamilyBank_('INVALID_SHEET_DATA', 'แถว ' + (index + 2) + ' ไม่มี createdAt หรือ updatedAt');
    if (ids.has(account.id) || pairs.has(account.bank + ':' + account.number)) failFamilyBank_('INVALID_SHEET_DATA', 'พบ ID หรือเลขบัญชีซ้ำในชีต กรุณาตรวจแถว ' + (index + 2));
    ids.add(account.id); pairs.add(account.bank + ':' + account.number);
    return Object.assign(account, { createdAt: raw.createdAt, updatedAt: raw.updatedAt, _row: index + 2 });
  }).filter(function (account) { return account !== null; });
}

function validateFamilyBankAccount_(raw, generateId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) failFamilyBank_('VALIDATION_ERROR', 'ข้อมูลบัญชีไม่ถูกต้อง');
  const account = {};
  const limits = { nickname: 100, owner: 120, number: 40, branch: 100, note: 500 };
  Object.keys(limits).forEach(function (key) {
    const value = raw[key] === undefined && (key === 'branch' || key === 'note') ? '' : raw[key];
    if (typeof value !== 'string' || value.length > limits[key]) failFamilyBank_('VALIDATION_ERROR', 'กรุณาตรวจข้อมูลช่อง ' + key);
    account[key] = value.trim();
  });
  account.number = account.number.replace(/[\s-]/g, '');
  if (!account.nickname || !account.owner || !/^\d{6,20}$/.test(account.number)) failFamilyBank_('VALIDATION_ERROR', 'ต้องระบุชื่อเรียก เจ้าของบัญชี และเลขบัญชี 6–20 หลัก โดยส่งเลขบัญชีเป็นข้อความ');
  if (FAMILY_BANK.banks.indexOf(raw.bank) < 0 || FAMILY_BANK.types.indexOf(raw.type) < 0 || FAMILY_BANK.categories.indexOf(raw.category) < 0 || ['active', 'inactive'].indexOf(raw.status) < 0 || typeof raw.favorite !== 'boolean') {
    failFamilyBank_('VALIDATION_ERROR', 'กรุณาตรวจธนาคาร ประเภท หมวดหมู่ สถานะ และ favorite');
  }
  const accountId = raw.id === undefined && generateId ? Utilities.getUuid() : raw.id;
  if (typeof accountId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(accountId)) failFamilyBank_('VALIDATION_ERROR', 'id ต้องเป็นข้อความ 1–100 ตัว ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข ขีดกลาง หรือขีดล่าง');
  return Object.assign(account, { id: accountId, bank: raw.bank, type: raw.type, category: raw.category, status: raw.status, favorite: raw.favorite });
}

function saveFamilyBankAccount_(sheet, raw, expectedUpdatedAt, knownAccounts) {
  const account = validateFamilyBankAccount_(raw, true);
  const accounts = knownAccounts || readFamilyBankAccounts_(sheet);
  const existing = accounts.find(function (item) { return item.id === account.id; });
  if (accounts.some(function (item) { return item.id !== account.id && item.bank === account.bank && item.number === account.number; })) failFamilyBank_('DUPLICATE_ACCOUNT', 'มีเลขบัญชีนี้ในธนาคารที่เลือกแล้ว');
  if (existing) {
    if (typeof expectedUpdatedAt !== 'string' || expectedUpdatedAt !== existing.updatedAt) failFamilyBank_('CONFLICT', 'ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไข');
  } else {
    if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== null && expectedUpdatedAt !== '') failFamilyBank_('NOT_FOUND', 'ไม่พบบัญชีเดิม กรุณาโหลดข้อมูลล่าสุด');
    if (accounts.length >= FAMILY_BANK.maxAccounts || sheet.getLastRow() >= FAMILY_BANK.maxAccounts + 1) failFamilyBank_('LIMIT_EXCEEDED', 'เพิ่มได้สูงสุด 10,000 บัญชี');
  }
  const now = nextFamilyBankTimestamp_(existing && existing.updatedAt);
  const saved = Object.assign(account, { createdAt: existing ? existing.createdAt : now, updatedAt: now });
  writeFamilyBankRows_(sheet, existing ? existing._row : sheet.getLastRow() + 1, [saved], !!existing);
  return { account: saved, created: !existing };
}

function setFamilyBankFavorite_(sheet, request) {
  if (typeof request.favorite !== 'boolean') failFamilyBank_('VALIDATION_ERROR', 'favorite ต้องเป็น true หรือ false');
  const accounts = readFamilyBankAccounts_(sheet);
  const existing = accounts.find(function (account) { return account.id === request.id; });
  if (!existing) failFamilyBank_('NOT_FOUND', 'ไม่พบบัญชี');
  return saveFamilyBankAccount_(sheet, Object.assign({}, existing, { favorite: request.favorite }), request.expectedUpdatedAt, accounts);
}

/** Deletes exactly one row under the script lock, checking the current account version. */
function deleteFamilyBankAccount_(sheet, request) {
  if (typeof request.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(request.id)) failFamilyBank_('VALIDATION_ERROR', 'กรุณาระบุ ID บัญชีที่ต้องการลบ');
  const account = readFamilyBankAccounts_(sheet).find(function (item) { return item.id === request.id; });
  if (!account) failFamilyBank_('NOT_FOUND', 'ไม่พบบัญชีที่ต้องการลบ กรุณาโหลดข้อมูลล่าสุด');
  if (typeof request.expectedUpdatedAt !== 'string' || request.expectedUpdatedAt !== account.updatedAt) failFamilyBank_('CONFLICT', 'บัญชีนี้ถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดและตรวจสอบก่อนลบ');
  sheet.deleteRow(account._row);
  SpreadsheetApp.flush();
  return { id: account.id, deleted: true };
}

/** Append-only import: validates the whole backup before writing, skips bank+number duplicates. */
function importFamilyBankAccounts_(sheet, backup) {
  if (!backup || backup.version !== 1 || !Array.isArray(backup.accounts) || backup.accounts.length > FAMILY_BANK.maxAccounts) failFamilyBank_('VALIDATION_ERROR', 'ต้องใช้ไฟล์สำรอง version 1 จาก Family Bank');
  const incoming = backup.accounts.map(function (account) { return validateFamilyBankAccount_(account, true); });
  const existing = readFamilyBankAccounts_(sheet);
  const seen = new Set(existing.map(function (account) { return account.bank + ':' + account.number; }));
  const added = [];
  incoming.forEach(function (account) {
    const key = account.bank + ':' + account.number;
    if (seen.has(key)) return;
    seen.add(key);
    // Always generate new IDs for imports so an imported ID cannot overwrite another account.
    added.push(Object.assign({}, account, { id: Utilities.getUuid(), createdAt: nextFamilyBankTimestamp_(), updatedAt: nextFamilyBankTimestamp_() }));
  });
  if (sheet.getLastRow() + added.length > FAMILY_BANK.maxAccounts + 1) failFamilyBank_('LIMIT_EXCEEDED', 'จำนวนบัญชีหลังนำเข้าจะเกิน 10,000 แถว');
  if (added.length) writeFamilyBankRows_(sheet, sheet.getLastRow() + 1, added);
  return { imported: added.length, skipped: incoming.length - added.length };
}

function nextFamilyBankTimestamp_(previous) {
  const parsed = previous ? Date.parse(previous) : NaN;
  return new Date(Math.max(Date.now(), Number.isFinite(parsed) ? parsed + 1 : 0)).toISOString();
}

function ensureFamilyBankGrid_(sheet, lastRow) {
  if (sheet.getMaxColumns() < FAMILY_BANK.headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), FAMILY_BANK.headers.length - sheet.getMaxColumns());
  if (sheet.getMaxRows() < lastRow) sheet.insertRowsAfter(sheet.getMaxRows(), lastRow - sheet.getMaxRows());
}

function writeFamilyBankRows_(sheet, firstRow, accounts, existingRows) {
  if (!existingRows) ensureFamilyBankGrid_(sheet, firstRow + accounts.length - 1);
  const range = sheet.getRange(firstRow, 1, accounts.length, FAMILY_BANK.headers.length);
  // RichTextValue writes literal text, including leading '='. No sheet formula is executed.
  const rows = accounts.map(function (account) {
    return FAMILY_BANK.headers.map(function (key) {
      return SpreadsheetApp.newRichTextValue().setText(String(account[key])).build();
    });
  });
  range.setNumberFormat('@');
  range.setRichTextValues(rows);
  SpreadsheetApp.flush();
}

function familyBankJson_(value) {
  // Never expose internal physical row numbers to clients.
  const json = JSON.stringify(value, function (key, item) { return key === '_row' ? undefined : item; });
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function failFamilyBank_(code, message) {
  const error = new Error(message);
  error.familyBankCode = code;
  throw error;
}
