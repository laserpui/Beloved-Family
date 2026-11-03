// Approximate canvas layout checks without a browser or live Sheet.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1];
const draws = [];
const canvas = {
  width: 960, height: 441,
  getContext() { return graphics; }
};
const graphics = {
  font: '16px Prompt',
  measureText(text) {
    const size = Number(this.font.match(/(\d+)px/)?.[1] || 16);
    const width = Array.from(String(text)).reduce((sum, char) =>
      sum + size * (/\s/.test(char) ? 0.3 : /[ก-๙]/.test(char) ? 0.7 : 0.55), 0);
    return { width };
  },
  fillText(text, x, y, maxWidth) { draws.push({ text, x, y, maxWidth, font: this.font }); },
  fillRect() {}, strokeRect() {}, scale() {}, save() {}, beginPath() {}, rect() {}, clip() {}, restore() {}
};
const classList = { toggle() {}, add() {}, remove() {} };
const elements = new Map([
  ['labelCanvas', canvas],
  ['previewFitNotice', { textContent: '', classList }],
  ['btnDownloadPng', { disabled: false, classList }],
  ['btnDownloadSvg', { disabled: false, classList }],
  ['previewSubjectInput', { value: 'ส่งเอกสารรับประกัน' }],
  ['addressForm', { addEventListener() {} }],
  ['btnConfirmDelete', { addEventListener() {} }]
]);
const localStorage = {
  getItem(key) {
    return key === 'sender_profile' ? JSON.stringify({
      name: 'บริษัท ตัวอย่าง จำกัด',
      address: '123/45 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพมหานคร 10100',
      phone: '02-123-4567'
    }) : null;
  }
};
const context = {
  document: {
    getElementById(id) { return elements.get(id) || { classList, addEventListener() {} }; },
    addEventListener() {}
  },
  window: { addEventListener() {} },
  localStorage,
  Intl,
  console,
  setTimeout,
  URL,
  crypto: { randomUUID() { return 'test-id'; } }
};
vm.createContext(context);
vm.runInContext(script, context);
vm.runInContext(`addresses = [{
  id: 'test-id',
  name: 'บริษัท ตัวอย่างอุตสาหกรรมและบริการครบวงจร จำกัด',
  phone: '02-123-4567',
  address1: '123/45 ถนนตัวอย่าง อาคารสำนักงานใหญ่ ชั้น 2',
  address2: 'แขวงตัวอย่าง เขตตัวอย่าง',
  province: 'กรุงเทพมหานคร',
  zipcode: '10100'
}]; currentPreviewReceiverId = 'test-id';`, context);

(async () => {
  for (const id of ['standard-dl', 'sticker', 'c6', 'c5', 'a4']) {
    draws.length = 0;
    vm.runInContext(`currentEnvelopeSizeId = '${id}'`, context);
    const fits = await vm.runInContext('renderLabelCanvas()', context);
    assert.equal(fits, true, `${id} layout should fit a representative long address`);
    assert.ok(draws.some(draw => draw.text.includes('ส่งเอกสารรับประกัน')), `${id} missing subject`);
    assert.equal(draws.some(draw => draw.text.includes('เรื่อง:')), false, `${id} adds an unwanted prefix`);
    if (['c6', 'c5', 'a4'].includes(id)) {
      const receiverTitle = draws.find(draw => draw.text.includes('ผู้รับ (Receiver)'));
      assert.ok(receiverTitle.x <= logicalWidthFor(id) * 0.36, `${id} recipient starts too far right`);
      const senderLines = draws.filter(draw => draw.x < receiverTitle.x);
      assert.ok(senderLines.length > 0);
      assert.ok(senderLines.every(draw => draw.y < receiverTitle.y), `${id} sender overlaps recipient`);
    }
    const logicalHeight = vm.runInContext('ENVELOPE_SIZES[currentEnvelopeSizeId].height', context);
    const logicalWidth = vm.runInContext('ENVELOPE_SIZES[currentEnvelopeSizeId].width', context);
    assert.ok(draws.every(draw => draw.x >= 0 && draw.y >= 0 && draw.y < logicalHeight - 20),
      `${id} has text outside the printable canvas`);
    assert.ok(draws.every(draw => draw.x + draw.maxWidth <= logicalWidth - 20),
      `${id} has text outside the right margin`);
    assert.equal(canvas.width, logicalWidth * 3);
    assert.equal(elements.get('btnDownloadPng').disabled, false);
  }
  elements.get('previewSubjectInput').value = '';
  draws.length = 0;
  assert.equal(await vm.runInContext('renderLabelCanvas()', context), true);
  assert.equal(draws.some(draw => draw.text.includes('ส่งเอกสารรับประกัน')), false);
  elements.get('previewSubjectInput').value = 'เอกสาร'.repeat(250);
  vm.runInContext(`currentEnvelopeSizeId = 'standard-dl';`, context);
  assert.equal(await vm.runInContext('renderLabelCanvas()', context), false);
  assert.equal(elements.get('btnDownloadPng').disabled, true);
  console.log('Local envelope layout checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });

function logicalWidthFor(id) {
  return { c6: 800, c5: 920, a4: 1000 }[id];
}
