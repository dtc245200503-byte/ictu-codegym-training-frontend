const assert = require('node:assert/strict')
const { test, beforeEach, afterEach } = require('node:test')
const path = require('node:path')
const fs = require('node:fs')
const ts = require('typescript')
const { JSDOM, VirtualConsole } = require('jsdom')
const virtualConsole = new VirtualConsole()
virtualConsole.on('jsdomError', error => { throw error })
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:5173', virtualConsole })
global.window = dom.window; global.document = dom.window.document; global.HTMLElement = dom.window.HTMLElement
global.IS_REACT_ACT_ENVIRONMENT = true
require.extensions['.tsx'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)
require.extensions['.css'] = () => {}
const { createElement: h, act } = require('react')
const { createRoot } = require('react-dom/client')
const { MemoryRouter } = require('react-router-dom')
const source = file => path.resolve(__dirname, '../src', file)
const service = source('services/assignmentService.ts'), real = require(service)
let list, detail, calls, root, expired, timers, monotonic
require.cache[service] = { id: service, filename: service, loaded: true, exports: {
  ...real,
  listMyAssignments: (...args) => { calls.push(['list', ...args]); return list(...args) },
  getMyAssignment: id => { calls.push(['detail', id]); return detail(id) },
} }
const Page = require(source('components/MyAssignmentsPage.tsx')).default
const { assignmentDeadline } = require(source('utils/assignmentDeadline.ts'))
const now = '2026-10-21T03:00:00Z'
const item = (changes = {}) => ({ assignment_id: 1, title: 'Bài Python', class_id: 1, class_name: 'PY01', subject_name: 'Python',
  due_at: '2026-10-21T04:00:00Z', max_points: '10.00', progress_status: 'not_submitted', remaining_seconds: 3600, urgency: 'due_soon', ...changes })
const response = (changes = {}) => ({ items: [item()], counts: { not_submitted: 1, submitted: 2, graded: 3, needs_revision: 4 },
  total: 1, page: 1, page_size: 20, status: 'not_submitted', sort: 'due_asc', now, urgent_window_hours: 24, ...changes })
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
const button = text => all('button').find(node => node.textContent === text)
const group = text => all('.my-assignment-groups button').find(node => node.textContent.startsWith(text))
const originalPerformance = global.performance
beforeEach(() => {
  calls = []; expired = 0; monotonic = 1000; timers = new Map()
  global.performance = new Proxy(originalPerformance, { get(target, name) {
    if (name === 'now') return () => monotonic
    const value = Reflect.get(target, name, target)
    return typeof value === 'function' ? value.bind(target) : value
  } })
  window.setInterval = (callback, delay) => { timers.set(delay, callback); return delay }
  window.clearInterval = id => timers.delete(id)
  list = async (status, sort, page) => response({ status, sort, page })
  detail = async id => ({ ...item(), assignment_id: id, description: '**Đề bài**', attachments: [], status: 'published', can_edit: true,
    version: 1, session_date: '2026-10-21', session_time: '08:00', recipient_count: 1, published_at: now })
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  root = null; global.performance = originalPerformance
  assert.equal(timers.size, 0, 'All polling timers are cleaned up')
})
async function mount(url = '/my-assignments') {
  root = createRoot(q('#root'))
  await act(async () => root.render(h(MemoryRouter, { initialEntries: [url] }, h(Page, { onSessionExpired: () => expired++ }))))
}
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))) }
async function sort(value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(q('select'), value)
    q('select').dispatchEvent(new window.Event('change', { bubbles: true }))
  })
}

test('four groups show global counts, default pending and ascending deadline', async () => {
  await mount()
  assert.deepEqual(calls[0], ['list', 'not_submitted', 'due_asc', 1])
  assert.deepEqual(all('.my-assignment-groups strong').map(node => node.textContent), ['1', '2', '3', '4'])
  assert.equal(group('Chưa nộp').getAttribute('aria-pressed'), 'true')
  assert.equal(q('select').value, 'due_asc')
  assert.match(q('.my-assignment-countdown').textContent, /Còn 1 giờ/)
  assert.equal(q('.my-assignment-warning').textContent, 'Sắp hết hạn')
  assert.match(q('.assignment-card time').textContent, /11:00/)
})

test('group and sort changes reset pagination and preserve selected filter', async () => {
  await mount('/my-assignments?page=3')
  await click(group('Đã nộp'))
  assert.deepEqual(calls.at(-1), ['list', 'submitted', 'due_asc', 1])
  await sort('due_desc')
  assert.deepEqual(calls.at(-1), ['list', 'submitted', 'due_desc', 1])
})

test('pagination keeps filter/sort and backend item order', async () => {
  list = async (status, sort, page) => response({ status, sort, page, total: 25,
    items: [item({ assignment_id: 8 }), item({ assignment_id: 2 })] })
  await mount('/my-assignments?status=needs_revision&sort=due_desc')
  assert.deepEqual(all('article').map(node => node.dataset.assignmentId), ['8', '2'])
  await click(button('Trang sau'))
  assert.deepEqual(calls.at(-1), ['list', 'needs_revision', 'due_desc', 2])
  assert.equal(button('Trang sau').disabled, true)
})

test('deadline boundaries distinguish actionable and completed work', () => {
  const timestamp = Date.parse(now)
  const deadline = (delta, state = 'not_submitted') => assignmentDeadline(new Date(timestamp + delta).toISOString(), state, timestamp)
  assert.equal(deadline(86400000).urgency, 'due_soon')
  assert.equal(deadline(86400001).urgency, 'normal')
  assert.equal(deadline(1, 'needs_revision').text, 'Còn dưới 1 phút')
  assert.equal(deadline(0).urgency, 'overdue')
  assert.match(deadline(-3600000).text, /Quá hạn 1 giờ/)
  for (const state of ['submitted', 'graded']) {
    assert.equal(deadline(1, state).urgency, 'normal')
    assert.equal(deadline(-1, state).urgency, 'normal')
  }
  assert.equal(assignmentDeadline('bad', 'not_submitted', timestamp).text, 'Chưa xác định hạn nộp')
})

test('countdown follows server time and elapsed monotonic time, not client wall clock', async () => {
  list = async () => response({ items: [item({ due_at: '2026-10-21T03:00:10Z' })] })
  await mount()
  assert.equal(q('.my-assignment-countdown').textContent, 'Còn dưới 1 phút')
  await act(async () => { monotonic += 15000; timers.get(15000)() })
  assert.equal(q('.my-assignment-warning').textContent, 'Quá hạn')
  assert.equal(q('.my-assignment-countdown').textContent, 'Đã đến hạn nộp')
})

test('stale group response cannot overwrite new group; empty group is explicit', async () => {
  let resolve
  list = () => new Promise(done => { resolve = done })
  await mount()
  assert.match(q('[role=status]').textContent, /Đang tải/)
  list = async () => response({ total: 0, items: [] })
  await click(group('Đã chấm'))
  await act(async () => resolve(response()))
  assert.match(q('.assignment-empty').textContent, /Đã chấm/)
  assert.equal(q('article'), null)
})

test('errors hide stale list, retry works and revoked session triggers logout', async () => {
  await mount()
  list = async () => { throw new real.AssignmentError('Phiên hết hạn', 401) }
  await click(button('Làm mới'))
  assert.equal(q('article'), null)
  assert.match(q('[role=alert]').textContent, /Phiên hết hạn/)
  assert.equal(expired, 1)
  list = async () => response()
  await click(button('Thử lại'))
  assert.ok(q('article'))
})

test('personal deep link uses personal detail, enforces read-only and returns to same group/page', async () => {
  await mount('/assignments?assignment_id=7&status=graded&page=2')
  assert.deepEqual(calls.find(call => call[0] === 'detail'), ['detail', 7])
  assert.ok(q('.assignment-description'))
  assert.equal(q('form'), null)
  assert.equal(button('Giao cho lớp'), undefined)
  await click(button('Đóng'))
  assert.equal(group('Đã chấm').getAttribute('aria-pressed'), 'true')
  assert.match(q('.assignment-pagination').textContent, /Trang 2/)
})

test('detail denial does not expose prior data and provides return link', async () => {
  detail = async () => { throw new real.AssignmentError('Không tìm thấy bài tập được giao cho bạn.', 404) }
  await mount('/my-assignments?assignment_id=88')
  assert.equal(q('.assignment-description'), null)
  assert.match(q('[role=alert]').textContent, /Không tìm thấy/)
  await click(button('Về danh sách')); assert.ok(q('article'))
})

test('focus refresh obtains latest state; malformed query uses safe defaults', async () => {
  await mount('/my-assignments?status=__proto__&sort=fake&page=-1')
  assert.deepEqual(calls[0], ['list', 'not_submitted', 'due_asc', 1])
  await act(async () => window.dispatchEvent(new window.Event('focus')))
  assert.equal(calls.filter(call => call[0] === 'list').length, 2)
})

test('navigation separates student personal view and instructor management for dual roles', () => {
  const student = { roles: ['STUDENT'], permissions: ['ASSIGNMENT_VIEW', 'ASSIGNMENT_MANAGE'] }
  assert.equal(real.canViewMyAssignments(student), true)
  assert.equal(real.canManageAssignments(student), false)
  const dual = { ...student, roles: ['STUDENT', 'INSTRUCTOR'] }
  assert.equal(real.canViewMyAssignments(dual), true)
  assert.equal(real.canManageAssignments(dual), true)
  assert.equal(real.canViewMyAssignments({ ...student, permissions: [] }), false)
  assert.equal(real.canViewMyAssignments({ ...student, roles: ['INSTRUCTOR'] }), false)
})
