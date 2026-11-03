const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [
  'app.js',
  'family-expenses.js',
  'kids-savings.js',
  'mona-expenses.js'
].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

function findHtmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findHtmlFiles(fullPath);
    return /\.html$/i.test(entry.name) ? [fullPath] : [];
  });
}

test('HTML IDs are unique and static JS references resolve', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);

  const references = [...scripts.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)]
    .map(match => match[1]);
  const missing = [...new Set(references.filter(id => !ids.includes(id)))];
  assert.deepEqual(missing, []);
});

test('interactive cards are keyboard reachable and have no inline div click handlers', () => {
  assert.equal(/\son(?:click|change|submit)=/i.test(html), false);
  const cards = [...html.matchAll(/<div class="(?:portal-card|kid-card)"([^>]*)>/g)];
  assert.ok(cards.length >= 6);
  for (const card of cards) {
    assert.match(card[1], /role="button"/);
    assert.match(card[1], /tabindex="0"/);
  }
});

test('money fields require a positive minimum and iframe has a title', () => {
  for (const id of ['feAmount', 'ksAmount', 'meAmount']) {
    const input = html.match(new RegExp('<input[^>]+id="' + id + '"[^>]*>'))?.[0] || '';
    assert.match(input, /min="0\.01"/);
    assert.match(input, /inputmode="decimal"/);
  }
  assert.match(html, /<iframe[^>]+title="[^"]+"/);
});

test('plain labels target controls', () => {
  const labels = [...html.matchAll(/<label([^>]*)>([\s\S]*?)<\/label>/g)];
  for (const [, attributes, body] of labels) {
    const wrapsControl = /<(?:input|select|textarea)\b/i.test(body);
    assert.ok(/\bfor="[^"]+"/i.test(attributes) || wrapsControl);
  }
});

test('browser dependencies are pinned or stored locally', () => {
  assert.equal(html.includes('lucide@latest'), false);
  assert.equal(html.includes('cdn.jsdelivr.net/npm/chart.js"'), false);
  assert.equal(html.includes('cdn.jsdelivr.net/npm/sweetalert2@11"'), false);

  const menuFiles = findHtmlFiles(path.join(root, 'family-menu'));
  assert.equal(menuFiles.length, 10);
  for (const file of menuFiles) {
    const menuHtml = fs.readFileSync(file, 'utf8');
    assert.equal(menuHtml.includes('https://cdn.tailwindcss.com'), false, file);
    assert.equal(/\son[a-z]+=/i.test(menuHtml), false, file);
    assert.match(menuHtml, /tailwind-play-20260802\.js/, file);
  }

  const vendoredTailwind = path.join(
    root,
    'family-menu',
    'assets',
    'vendor',
    'tailwind-play-20260802.js'
  );
  assert.ok(fs.statSync(vendoredTailwind).size > 100_000);
});
test('Home has no refresh and Family Expenses uses Sheet-only dashboard', () => {
  assert.equal(html.includes('homeRefresh'), false);
  assert.equal(scripts.includes('homeRefresh'), false);
  assert.equal(scripts.includes('api-monthly'), false);
  assert.equal(scripts.includes('loadFamilyExpensesApiSummary'), false);
  assert.match(scripts, /loadFamilyExpensesSheetTransactions/);
});

test('Letter is reachable from navigation and its local assets are present', () => {
  assert.match(html, /class="nav-item" data-target="letter"/);
  assert.match(html, /class="portal-card"[^>]+data-navigate="letter"/);
  assert.match(html, /<section id="letter" class="page-section/);
  assert.match(html, /<iframe src="Letter\/index\.html"[^>]+title="[^"]+"[^>]+style="[^"]*width: 100%; height: 100%/);
  assert.match(html, /<div class="embedded-app-panel" style="[^"]*height: max\(/);
  for (const file of ['index.html', 'thai-addresses.js']) {
    assert.ok(fs.statSync(path.join(root, 'Letter', file)).size > 0);
  }
});
