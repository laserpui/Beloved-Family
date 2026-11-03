// Read-only local checks. Run with: node verify-local.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const geoContext = { window: {} };
vm.createContext(geoContext);
vm.runInContext(fs.readFileSync(__dirname + '/thai-addresses.js', 'utf8'), geoContext);
const geo = geoContext.window.THAI_ADDRESS_DATA;
assert.equal(geo.length, 77);
assert.equal(geo.reduce((n, province) => n + province.districts.length, 0), 930);
assert.equal(geo.reduce((n, province) =>
  n + province.districts.reduce((m, district) => m + district.sub_districts.length, 0), 0), 7436);
assert.ok(geo.every(province => province.name_th &&
  province.districts.every(district => district.name_th &&
    district.sub_districts.every(sub => sub.name_th && sub.zip_code))));

const rows = [
  ['id', 'name', 'phone', 'address1', 'address2', 'province', 'zipcode'],
  ['existing123', 'ชื่อเดิม', '', 'เลขที่ 1', 'ต.เดิม อ.เดิม', 'ลำปาง', '52100']
];
let selectedSheet = '';
const sheet = {
  getDataRange() { return { getValues() { return rows.map(row => row.slice()); } }; },
  getRange(row, col, height, width) {
    return {
      setValue(value) {
        if (!rows[row - 1]) rows[row - 1] = [];
        rows[row - 1][col - 1] = value;
      },
      setValues(values) {
        assert.equal(height, 1);
        assert.equal(values[0].length, width);
        if (!rows[row - 1]) rows[row - 1] = [];
        values[0].forEach((value, index) => { rows[row - 1][col - 1 + index] = value; });
      }
    };
  },
  appendRow(row) { rows.push(row.slice()); },
  deleteRow(row) { rows.splice(row - 1, 1); }
};
const context = {
  SpreadsheetApp: { openById() { return { getSheetByName(name) {
    selectedSheet = name;
    return sheet;
  } }; } },
  LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput(text) { return { text, setMimeType() { return this; } }; }
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), context);
const call = parameter => JSON.parse(context.doGet({ parameter }).text);

const initial = rows.map(row => row.slice());
assert.match(call({ action: 'save', data: '{}' }).error, /รหัสรายการไม่ถูกต้อง/);
assert.deepEqual(rows, initial);
assert.equal(call({ action: 'list' }).length, 1);
assert.equal(call({ action: 'health' }).status, 'success');
assert.equal(selectedSheet, 'ชีต1');

const item = {
  id: 'newaddress123', name: 'ทดสอบ 50%', phone: '', address1: 'เลขที่ 2',
  address2: 'ต.ทดสอบ อ.ทดสอบ', province: 'ลำปาง', zipcode: '52100',
  subject: 'ส่งเอกสารรับประกัน'
};
assert.equal(call({ action: 'save', data: JSON.stringify(item) }).status, 'success');
assert.equal(rows[2][1], 'ทดสอบ 50%');
assert.equal(rows[0].length, 7);
assert.equal(rows[2].length, 7);
assert.equal(Object.hasOwn(call({ action: 'list' }).find(row => row.id === item.id), 'subject'), false);
assert.equal(call({ action: 'delete', id: item.id }).status, 'success');
assert.equal(call({ action: 'delete', id: item.id }).alreadyAbsent, true);
assert.deepEqual(rows[1], initial[1]);
assert.deepEqual(rows[0].slice(0, 7), initial[0]);
rows[0].push('subject');
rows[1].push('ข้อมูลเดิม');
rows.push(['', '', '', '', '', '', '', 'ข้อความเก่าที่ไม่มีผู้รับ']);
assert.equal(call({ action: 'list' }).length, 1);
assert.equal(call({ action: 'save', data: JSON.stringify({ ...item, id: 'existing123' }) }).status, 'success');
assert.equal(rows[1][7], 'ข้อมูลเดิม');
assert.equal(Object.hasOwn(call({ action: 'list' })[0], 'subject'), false);
console.log('Local Apps Script checks passed');
