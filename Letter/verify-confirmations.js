// Check that confirmation dialogs gate recipient mutations and sync operations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1];
const callbacks = new Map();
const values = new Map();
const storage = new Map();
const classList = { add() {}, remove() {}, toggle() {} };
function element(id) {
  if (!values.has(id)) values.set(id, {
    value: '', textContent: '', classList, required: true,
    addEventListener(event, callback) { callbacks.set(`${id}:${event}`, callback); },
    reset() {}
  });
  return values.get(id);
}
const document = { getElementById: element, addEventListener() {} };
const localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, value); }
};
const context = {
  document, localStorage, window: { addEventListener() {} },
  crypto: { randomUUID() { return 'newaddress123'; } },
  Intl, URL, console, setTimeout
};
vm.createContext(context);
vm.runInContext(script, context);
vm.runInContext('renderList = () => {}; updateStats = () => {}; showToast = () => {};', context);

Object.entries({
  selectProvince: 'กรุงเทพมหานคร', selectDistrict: 'เขตบางเขน',
  selectSubDistrict: 'แขวงท่าแร้ง', selectZipcode: '10220',
  inputName: 'ผู้รับทดสอบ', inputPhone: '0812345678', inputAddr1: 'เลขที่ 1'
}).forEach(([id, value]) => { element(id).value = value; });

const submit = callbacks.get('addressForm:submit');
const confirmSave = callbacks.get('btnConfirmSave:click');
const confirmDelete = callbacks.get('btnConfirmDelete:click');
assert.ok(submit && confirmSave && confirmDelete);
const count = () => vm.runInContext('addresses.length', context);
const queueCount = () => JSON.parse(storage.get('github_address_labels_sync_queue') || '[]').length;

(async () => {
  submit({ preventDefault() {} });
  assert.equal(element('saveConfirmName').textContent, 'ผู้รับทดสอบ');
  assert.equal(count(), 0);
  vm.runInContext('cancelSaveConfirmation()', context);
  await confirmSave();
  assert.equal(count(), 0);
  assert.equal(queueCount(), 0);

  submit({ preventDefault() {} });
  await confirmSave();
  assert.equal(count(), 1);
  assert.equal(queueCount(), 1);
  await confirmSave();
  assert.equal(queueCount(), 1);

  Object.entries({
    selectProvince: 'กรุงเทพมหานคร', selectDistrict: 'เขตบางเขน',
    selectSubDistrict: 'แขวงท่าแร้ง', selectZipcode: '10220'
  }).forEach(([id, value]) => { element(id).value = value; });
  element('editId').value = 'newaddress123';
  element('inputName').value = 'ผู้รับแก้ไข';
  submit({ preventDefault() {} });
  assert.equal(element('saveConfirmTitle').textContent, 'ยืนยันการแก้ไขข้อมูล');
  vm.runInContext('cancelSaveConfirmation()', context);
  assert.equal(vm.runInContext('addresses[0].name', context), 'ผู้รับทดสอบ');
  assert.equal(queueCount(), 1);
  submit({ preventDefault() {} });
  await confirmSave();
  assert.equal(vm.runInContext('addresses[0].name', context), 'ผู้รับแก้ไข');
  assert.equal(queueCount(), 2);

  vm.runInContext("deleteAddress('newaddress123')", context);
  assert.equal(element('deleteConfirmName').textContent, 'ผู้รับแก้ไข');
  vm.runInContext('cancelDeleteConfirmation()', context);
  await confirmDelete();
  assert.equal(count(), 1);
  assert.equal(queueCount(), 2);

  vm.runInContext("deleteAddress('newaddress123')", context);
  await confirmDelete();
  assert.equal(count(), 0);
  assert.equal(queueCount(), 3);
  console.log('Confirmation and cancellation checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
