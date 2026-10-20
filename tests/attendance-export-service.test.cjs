const assert = require('node:assert/strict')
const { test, afterEach, beforeEach } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<body></body>', { url: 'http://localhost:5173' })
global.window = dom.window
global.document = dom.window.document
global.localStorage = dom.window.localStorage
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)
const auth = path.resolve(__dirname, '../src/services/authService.ts')
let refreshes
require.cache[auth] = { id: auth, filename: auth, loaded: true, exports: {
  refreshAccessToken: async () => { refreshes++; return { access_token: 'renewed' } },
} }
const { downloadAttendanceSummary, SummaryError } = require('../src/services/attendanceSummaryService.ts')
const originals = { fetch: global.fetch, create: URL.createObjectURL, revoke: URL.revokeObjectURL, click: window.HTMLAnchorElement.prototype.click, timeout: window.setTimeout }
let requests, clicked, blobs, revoked, timers, respond
beforeEach(() => {
  refreshes = 0; requests = []; clicked = []; blobs = []; revoked = []; timers = []
  localStorage.setItem('access_token', 'old')
  global.fetch = async (url, options) => { requests.push({ url, options }); return respond(requests.length) }
  URL.createObjectURL = blob => { blobs.push(blob); return 'blob:report' }
  URL.revokeObjectURL = url => revoked.push(url)
  window.HTMLAnchorElement.prototype.click = function () { clicked.push({ href: this.href, download: this.download }) }
  window.setTimeout = fn => { timers.push(fn); return 1 }
})
afterEach(() => {
  global.fetch = originals.fetch; URL.createObjectURL = originals.create; URL.revokeObjectURL = originals.revoke
  window.HTMLAnchorElement.prototype.click = originals.click; window.setTimeout = originals.timeout
})

test('downloads binary with server UTF-8 filename, auth and selected sort, releasing the blob', async () => {
  const filename = 'Chuyen-can_LỚP-60_2026-10-21.xlsx'
  respond = () => new Response(new Uint8Array([80, 75, 3, 4]), {
    headers: { 'Content-Disposition': `attachment; filename="fallback.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}` },
  })
  await downloadAttendanceSummary('12', 'rate_asc')
  assert.match(requests[0].url, /\/classes\/12\/export\?sort=rate_asc$/)
  assert.equal(requests[0].options.headers.Authorization, 'Bearer old')
  assert.deepEqual(clicked, [{ href: 'blob:report', download: filename }])
  assert.deepEqual([...new Uint8Array(await blobs[0].arrayBuffer())], [80, 75, 3, 4])
  assert.equal(document.querySelector('a'), null)
  assert.equal(revoked.length, 0)
  timers.forEach(fn => fn())
  assert.deepEqual(revoked, ['blob:report'])
})

test('refreshes once on unauthorized response and retains ASCII filename fallback', async () => {
  respond = count => count === 1 ? new Response('', { status: 401 }) : new Response('xlsx', {
    headers: { 'Content-Disposition': 'attachment; filename="Chuyen-can_LOP-2_2026-10-21.xlsx"' },
  })
  await downloadAttendanceSummary('2', 'name')
  assert.equal(refreshes, 1)
  assert.equal(requests[1].options.headers.Authorization, 'Bearer renewed')
  assert.equal(clicked[0].download, 'Chuyen-can_LOP-2_2026-10-21.xlsx')
})

test('permission and non-JSON errors never download error responses as Excel', async () => {
  respond = () => Response.json({ detail: 'Không có quyền xuất.' }, { status: 403 })
  await assert.rejects(downloadAttendanceSummary('1', 'name'), error => error instanceof SummaryError && error.status === 403)
  respond = () => new Response('Gateway error', { status: 502 })
  await assert.rejects(downloadAttendanceSummary('1', 'name'), error => error instanceof SummaryError && error.status === 502)
  assert.equal(clicked.length, 0)
  assert.equal(blobs.length, 0)
})

test('persistent unauthorized response expires the session instead of repeatedly refreshing', async () => {
  respond = () => new Response('', { status: 401 })
  await assert.rejects(downloadAttendanceSummary('1', 'name'), error => error instanceof SummaryError && error.status === 401)
  assert.equal(refreshes, 1)
  assert.equal(requests.length, 2)
  assert.equal(clicked.length, 0)
})
