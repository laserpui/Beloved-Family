(function initBelovedUtils(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BelovedUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createBelovedUtils() {
  function getLocalDateInputValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function validatePositiveAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }

  function calculateSavingsBalance(transactions = []) {
    return transactions.reduce((balance, transaction) => {
      const amount = Number(transaction.amount) || 0;
      if (transaction.type === 'ฝาก') return balance + amount;
      if (transaction.type === 'ถอน') return balance - amount;
      return balance;
    }, 0);
  }

  function parseDateValue(value, endOfDay = false) {
    if (!value) return null;
    const text = String(value).trim();
    const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
    const date = new Date(isoDateOnly
      ? `${text}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
      : text);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  function filterByDateRange(items = [], startValue = '', endValue = '', dateSelector = item => item.date) {
    const startTime = parseDateValue(startValue);
    const endTime = parseDateValue(endValue, true);
    if (startTime !== null && endTime !== null && startTime > endTime) {
      throw new RangeError('วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด');
    }

    return items.filter(item => {
      const itemTime = parseDateValue(dateSelector(item));
      if (itemTime === null) return false;
      if (startTime !== null && itemTime < startTime) return false;
      if (endTime !== null && itemTime > endTime) return false;
      return true;
    });
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const upstreamSignal = options.signal;
    const abortFromUpstream = () => controller.abort();

    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort();
      else upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
    }

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('การเชื่อมต่อใช้เวลานานเกินกำหนด กรุณาลองใหม่');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener?.('abort', abortFromUpstream);
    }
  }

  function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  return {
    getLocalDateInputValue,
    escapeHtml,
    validatePositiveAmount,
    calculateSavingsBalance,
    parseDateValue,
    filterByDateRange,
    fetchWithTimeout,
    delay
  };
});
