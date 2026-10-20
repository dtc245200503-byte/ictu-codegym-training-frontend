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


let list, mark, summary, calls, expired, root, changed
class NotificationError extends Error { constructor(message, status) { super(message); this.status = status } }
const service = source('services/notificationService.ts')
require.cache[service] = { id: service, filename: service, loaded: true, exports: {
  NotificationError, listNotifications: (...args) => list(...args), readNotification: (...args) => mark(...args), notificationSummary: (...args) => summary(...args), notifyInboxChanged: () => changed++,
} }
const Page = require(source('components/NotificationsPage.tsx')).default
const Badge = require(source('components/NotificationBadge.tsx')).default
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
const button = text => all('button').find(node => node.textContent === text)
const sample = () => ({ notification_id: 1, title: 'Buổi học thay đổi lịch', message: 'Lớp Python\nLịch cũ: 08:00\nLịch mới: 13:00 <img src=x>', created_at: '2026-10-16T03:00:00Z', read_at: null })
beforeEach(() => {
  calls = []; expired = changed = 0
  list = async (...args) => { calls.push(args); return { items: [sample()], total: 21, unread: 21 } }
  mark = async () => ({ unread: 20 })
  summary = async () => ({ unread: 21 })
})
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null })
async function mount(component = h(Page, { onSessionExpired: () => expired++ })) { root = createRoot(q('#root')); await act(async () => root.render(h(MemoryRouter, null, component))) }
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }

test('inbox renders snapshots as plain text and paginates', async () => {
  await mount()
  assert.match(q('.inbox-list').textContent, /Lịch cũ: 08:00/)
  assert.match(q('.inbox-list').textContent, /Lịch mới: 13:00/)
  assert.equal(q('.inbox-list img'), null)
  await click(button('Sau'))
  assert.deepEqual(calls, [[1, false], [2, false]])
})

test('read mutation only occurs on explicit click and updates unread filter and badge', async () => {
  let marked
  mark = async id => { marked = id; return { unread: 0 } }
  await mount()
  assert.equal(marked, undefined)
  await click(q('input[type=checkbox]'))
  assert.deepEqual(calls.at(-1), [1, true])
  list = async () => ({ items: [], total: 0, unread: 0 })
  await click(button('Đánh dấu đã đọc'))
  assert.equal(marked, 1)
  assert.equal(changed, 1)
  assert.match(q('.notifications-page').textContent, /Không có thông báo chưa đọc/)
})

test('failed mark keeps notification unread and allows retry', async () => {
  mark = async () => { throw new Error('Mất kết nối') }
  await mount(); await click(button('Đánh dấu đã đọc'))
  assert.match(q('[role=alert]').textContent, /Mất kết nối/)
  assert.ok(q('.inbox-list .is-unread'))
  assert.equal(button('Đánh dấu đã đọc').disabled, false)
})

test('expired auth is handled and load can retry', async () => {
  list = async () => { throw new NotificationError('Hết phiên', 401) }
  await mount()
  assert.equal(expired, 1)
  list = async () => ({ items: [], total: 0, unread: 0 })
  await click(button('Thử lại'))
  assert.match(q('.notifications-page').textContent, /Không có thông báo/)
})

test('badge announces unread count and refreshes on focus or inbox change', async () => {
  await mount(h(Badge))
  assert.equal(q('a').getAttribute('href'), '/notifications')
  assert.match(q('a').getAttribute('aria-label'), /21 chưa đọc/)
  summary = async () => ({ unread: 0 })
  await act(async () => window.dispatchEvent(new dom.window.Event('notifications-changed')))
  assert.match(q('a').getAttribute('aria-label'), /0 chưa đọc/)
  summary = async () => ({ unread: 101 })
  await act(async () => window.dispatchEvent(new dom.window.Event('focus')))
  assert.equal(q('.inbox-badge span').textContent, '99+')
})

test('badge fetch failure remains a usable inbox link without claiming zero unread', async () => {
  summary = async () => { throw new Error('offline') }
  await mount(h(Badge))
  assert.match(q('a').getAttribute('aria-label'), /chưa tải được/)
  assert.equal(q('a').getAttribute('href'), '/notifications')
})


test('absence result notification supports marking string identifier read', async () => {
  list = async () => ({ items: [{ ...sample(), notification_id: 'absence:7', title: 'Kết quả đơn xin phép vắng', message: 'Đã duyệt — Vắng có phép' }], total: 1, unread: 1 })
  let selected
  mark = async id => { selected = id; return { unread: 0 } }
  await mount(); await click(button('Đánh dấu đã đọc'))
  assert.equal(selected, 'absence:7')
})
