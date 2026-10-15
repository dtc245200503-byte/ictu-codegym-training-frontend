const assert = require('node:assert/strict')
const { test, afterEach, beforeEach } = require('node:test')
const path = require('node:path')
const fs = require('node:fs')
const { JSDOM, VirtualConsole } = require('jsdom')
const ts = require('typescript')
const virtualConsole = new VirtualConsole()
virtualConsole.on('jsdomError', error => { throw error })
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:5173', virtualConsole })
global.window = dom.window
global.document = dom.window.document
global.HTMLElement = dom.window.HTMLElement
global.IS_REACT_ACT_ENVIRONMENT = true
window.requestAnimationFrame = fn => setTimeout(fn, 0)
window.cancelAnimationFrame = clearTimeout
global.ResizeObserver = class { observe() {} disconnect() {} }
require.extensions['.tsx'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)
require.extensions['.css'] = () => {}
const { createElement: h, act } = require('react')
const { createRoot } = require('react-dom/client')
const { MemoryRouter } = require('react-router-dom')
const source = file => path.resolve(__dirname, '../src', file)
const lead = { lead_id: 12, full_name: 'Khách A', phone: '0912345678', email: null, source: 'Facebook', interest: 'Python', message: null, status: 'new', created_at: '2026-01-01T03:00:00Z', assignee_id: 3, assignee_name: 'Tư vấn A', duplicate_count: 0, next_callback_at: '2026-01-02T03:00:00Z', callback_overdue: true }
let history, save, callback, list, saved, expired, closed
class LeadSessionError extends Error {}
class LeadPermissionError extends Error {}
const service = source('services/leadService.ts')
require.cache[service] = { id: service, filename: service, loaded: true, exports: {
  LeadSessionError, LeadPermissionError, LeadDuplicateError: class extends Error {},
  getLeadCareLogs: (...args) => history(...args), addLeadCareLog: (...args) => save(...args), updateLeadCallback: (...args) => callback(...args),
  listLeads: (...args) => list(...args), getLeadFilterOptions: async () => ({ sources: [], assignees: [], can_view_all: false }),
} }
const LeadCareDialog = require(source('components/LeadCareDialog.tsx')).default
const LeadPage = require(source('components/LeadPage.tsx')).default
const { careInput, careISO, careDate, callbackOverdue } = require(source('utils/leadCare.ts'))
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
let root
const emptyHistory = () => ({ items: [], total: 0, page: 1, page_size: 20, next_callback_at: lead.next_callback_at, callback_overdue: true })
beforeEach(() => {
  history = async () => emptyHistory(); save = async () => ({}); callback = async () => ({}); list = async () => ({ items: [lead], total: 1 })
  saved = expired = closed = 0
})
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null })
async function mount(element) { root = createRoot(q('#root')); await act(async () => root.render(element)) }
async function modal() { await mount(h(LeadCareDialog, { lead, onSaved: () => saved++, onClose: () => closed++, explain: error => { if (error instanceof LeadSessionError) expired++; return error.message } })) }
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }
async function input(selector, value) {
  await act(async () => {
    const node = q(selector)
    const prototype = node.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : node.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value)
    node.dispatchEvent(new dom.window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
async function submit(selector = '.lead-care-form') { await act(async () => q(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }

test('Vietnam datetime conversion is independent of browser timezone and rejects invalid dates', () => {
  assert.equal(careInput('2026-10-07T20:30:00Z'), '2026-10-08T03:30')
  assert.equal(careISO('2026-10-08T03:30'), '2026-10-07T20:30:00.000Z')
  assert.equal(careISO('2026-02-30T12:00'), null)
  assert.equal(careISO('invalid'), null)
  assert.match(careDate('2026-10-07T20:30:00Z'), /08\/10\/2026/)
  assert.equal(callbackOverdue('2026-10-07T20:30:00Z', Date.parse('2026-10-07T20:30:00Z')), false)
  assert.equal(callbackOverdue('2026-10-07T20:30:00Z', Date.parse('2026-10-07T20:30:00Z') + 1), true)
  assert.equal(callbackOverdue(null), false)
})

test('saves interaction with new reminder in one request and refreshes parent', async () => {
  let payload
  save = async (...args) => { payload = args }
  await modal()
  await input('#care-type', 'message')
  await input('#care-content', '  Khách muốn học Python.  ')
  await input('#care-occurred', '2026-01-01T10:00')
  await input('#care-action', 'schedule')
  await input('#care-next', '2099-01-08T10:00')
  await submit()
  assert.deepEqual(payload, [12, { interaction_type: 'message', content: 'Khách muốn học Python.', occurred_at: '2026-01-01T03:00:00.000Z', callback_action: 'schedule', next_callback_at: '2099-01-08T03:00:00.000Z' }])
  assert.equal(saved, 1)
  assert.equal(q('#care-content').value, '')
  assert.equal(q('#care-action').value, 'keep')
  assert.match(q('[role=status]').textContent, /Đã lưu/)
})

test('rejected save preserves draft and cannot resubmit during in-flight request', async () => {
  let reject, calls = 0
  save = () => { calls++; return new Promise((_, fail) => { reject = fail }) }
  await modal()
  await input('#care-content', 'Nội dung cần giữ')
  await input('#care-occurred', '2026-01-01T10:00')
  await submit(); await submit()
  assert.equal(calls, 1)
  assert.ok(q('.lead-care-form fieldset').disabled)
  await act(async () => reject(new Error('Không thể lưu nhật ký.')))
  assert.equal(q('#care-content').value, 'Nội dung cần giữ')
  assert.match(q('[role=alert]').textContent, /Không thể lưu/)
  assert.equal(saved, 0)
})

test('validates blank content, future interaction and past reminder before save', async () => {
  let calls = 0
  save = async () => calls++
  await modal()
  await input('#care-content', ' ')
  await submit()
  assert.match(q('[role=alert]').textContent, /nội dung/)
  await input('#care-content', 'Đã gọi')
  await input('#care-occurred', '2099-01-01T10:00')
  await submit()
  assert.match(q('[role=alert]').textContent, /tương lai/)
  await input('#care-occurred', '2026-01-01T10:00')
  await input('#care-action', 'schedule')
  await input('#care-next', '2026-01-02T10:00')
  await submit()
  assert.match(q('[role=alert]').textContent, /tương lai/)
  assert.equal(calls, 0)
})

test('overdue reminder can be rescheduled or cleared without creating a fake interaction', async () => {
  const calls = []
  callback = async (...args) => calls.push(args)
  save = async () => { throw Error('Unexpected interaction') }
  await modal()
  assert.match(q('.lead-callback-badge.overdue').textContent, /Quá hạn/)
  await input('#care-reminder', '2099-01-01T10:00')
  await submit('.lead-callback-card form')
  await click(all('.lead-care-actions button').find(button => button.textContent === 'Bỏ lịch nhắc'))
  assert.deepEqual(calls, [[12, '2099-01-01T03:00:00.000Z'], [12, null]])
  assert.equal(saved, 2)
})

test('completing callback logs the interaction with explicit complete action', async () => {
  let payload
  save = async (_, data) => { payload = data }
  await modal()
  await input('#care-content', 'Đã gọi theo lịch hẹn')
  await input('#care-action', 'complete')
  await submit()
  assert.equal(payload.callback_action, 'complete')
  assert.equal('next_callback_at' in payload, false)
})

test('history paginates, escapes content and displays author and callback snapshot', async () => {
  const pages = []
  history = async (_, page) => {
    pages.push(page)
    return { ...emptyHistory(), total: 21, page, items: [{ log_id: page, interaction_type: 'meeting', content: '<script>alert(1)</script>\nKhách quan tâm', occurred_at: '2026-01-01T03:00:00Z', created_at: '2026-01-01T04:00:00Z', actor_name: 'Tư vấn B', callback_action: 'schedule', next_callback_at: '2026-01-08T03:00:00Z' }] }
  }
  await modal()
  assert.equal(q('.lead-care-history script'), null)
  assert.match(q('.lead-care-content').textContent, /<script>/)
  assert.match(q('.lead-care-history').textContent, /Tư vấn B/)
  assert.match(q('.lead-care-event-note').textContent, /08\/01\/2026/)
  await click(all('.lead-care-pagination button').find(node => node.textContent === 'Sau'))
  assert.deepEqual(pages, [1, 2])
})

test('load error blocks edits, offers retry, and expired session is propagated', async () => {
  history = async () => { throw new LeadSessionError('Phiên hết hạn') }
  await modal()
  assert.equal(expired, 1)
  assert.ok(q('.lead-care-form fieldset').disabled)
  history = async () => emptyHistory()
  await click(q('[role=alert] button'))
  assert.equal(q('[role=alert]'), null)
  assert.equal(q('.lead-care-form fieldset').disabled, false)
})

test('modal traps keyboard focus and restores scroll on close', async () => {
  document.body.style.overflow = 'auto'
  await modal()
  assert.equal(document.body.style.overflow, 'hidden')
  const close = q('[aria-label="Đóng nhật ký chăm sóc"]')
  assert.equal(document.activeElement, close)
  await act(async () => close.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })))
  assert.equal(document.activeElement, q('.lead-care-submit'))
  await act(async () => q('[role=dialog]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(closed, 1)
  await act(async () => root.unmount()); root = null
  assert.equal(document.body.style.overflow, 'auto')
})

test('lead list highlights overdue callbacks, keeps URL filter and opens care dialog', async () => {
  let filters
  list = async values => { filters = values; return { items: [lead], total: 1 } }
  await mount(h(MemoryRouter, { initialEntries: ['/leads?callback_status=overdue'] }, h(LeadPage, { canDelete: false, onSessionExpired: () => expired++ })))
  assert.equal(filters.callback_status, 'overdue')
  assert.ok(q('tr.lead-overdue'))
  assert.match(q('.lead-callback-cell').textContent, /Quá hạn gọi lại/)
  await click(q('button.lead-care'))
  assert.equal(q('#lead-care-title').textContent, 'Khách A')
})
