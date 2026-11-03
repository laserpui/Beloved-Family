const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getLocalDateInputValue,
  escapeHtml,
  validatePositiveAmount,
  calculateSavingsBalance,
  filterByDateRange,
  fetchWithTimeout
} = require('../core-utils.js');

test('local date input uses local calendar fields', () => {
  const localEarlyMorning = new Date(2026, 7, 2, 1, 0, 0);
  assert.equal(getLocalDateInputValue(localEarlyMorning), '2026-08-02');
});

test('escapeHtml neutralizes markup characters', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
  );
});

test('positive amount validation rejects zero, negatives and invalid text', () => {
  assert.equal(validatePositiveAmount('125.50'), 125.5);
  assert.equal(validatePositiveAmount('0'), null);
  assert.equal(validatePositiveAmount('-1'), null);
  assert.equal(validatePositiveAmount('abc'), null);
});

test('savings balance adds deposits and subtracts withdrawals', () => {
  assert.equal(calculateSavingsBalance([
    { type: 'ฝาก', amount: 500 },
    { type: 'ถอน', amount: 125.5 },
    { type: 'ไม่ทราบ', amount: 999 }
  ]), 374.5);
});

test('date filtering is inclusive and rejects reversed ranges', () => {
  const rows = [
    { date: '2026-08-01', id: 1 },
    { date: '2026-08-02T12:00:00+07:00', id: 2 },
    { date: '2026-08-03', id: 3 }
  ];
  assert.deepEqual(
    filterByDateRange(rows, '2026-08-01', '2026-08-02').map(row => row.id),
    [1, 2]
  );
  assert.throws(
    () => filterByDateRange(rows, '2026-08-03', '2026-08-01'),
    /วันที่เริ่มต้น/
  );
});

test('fetchWithTimeout aborts a stalled request', async () => {
  const originalFetch = global.fetch;
  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
  try {
    await assert.rejects(() => fetchWithTimeout('https://example.invalid', {}, 5), /เวลานานเกินกำหนด/);
  } finally {
    global.fetch = originalFetch;
  }
});
