// Run locally with the intended settings password as the first argument.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const password = process.argv[2];
if (!password) throw new Error('Pass the intended settings password as an argument');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1];
const elements = new Map();
function element(id) {
  if (!elements.has(id)) {
    const classes = new Set(['hidden']);
    elements.set(id, {
      value: '', textContent: '', disabled: false,
      classList: {
        add(value) { classes.add(value); },
        remove(value) { classes.delete(value); },
        contains(value) { return classes.has(value); },
        toggle(value, force) { if (force) classes.add(value); else classes.delete(value); }
      },
      addEventListener() {}, focus() {}
    });
  }
  return elements.get(id);
}
const context = {
  document: { getElementById: element, addEventListener() {} },
  window: { addEventListener() {} },
  localStorage: { getItem() { return null; } },
  crypto: webcrypto, TextEncoder, Intl, URL, console, setTimeout
};
vm.createContext(context);
vm.runInContext(script, context);
const isOpen = id => !element(id).classList.contains('hidden');
const submit = () => vm.runInContext('unlockSettings({ preventDefault() {} })', context);

(async () => {
  vm.runInContext('requestSettingsAccess()', context);
  assert.equal(isOpen('settingsPasswordModal'), true);
  assert.equal(isOpen('settingsModal'), false);
  element('settingsPasswordInput').value = 'incorrect-password';
  await submit();
  assert.equal(isOpen('settingsModal'), false);
  assert.match(element('settingsPasswordError').textContent, /ไม่ถูกต้อง/);

  element('settingsPasswordInput').value = password;
  await submit();
  assert.equal(isOpen('settingsPasswordModal'), false);
  assert.equal(isOpen('settingsModal'), true);
  assert.equal(element('settingsPasswordInput').value, '');

  vm.runInContext("closeModal('settingsModal'); openModal('settingsModal')", context);
  assert.equal(isOpen('settingsModal'), false);
  assert.equal(isOpen('settingsPasswordModal'), true);
  vm.runInContext('cancelSettingsAccess()', context);
  assert.equal(isOpen('settingsPasswordModal'), false);
  console.log('Settings access checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
