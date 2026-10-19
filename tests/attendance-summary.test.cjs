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

const service = source('services/attendanceSummaryService.ts')
const realService = require(service)
const { SummaryError, canViewAttendanceSummary } = realService
let classes, load, calls, expired, root
require.cache[service] = { id: service, filename: service, loaded: true, exports: {
  ...realService, getSummaryClasses: () => classes(), getAttendanceSummary: (...args) => { calls.push(args); return load(...args) },
} }
const Page = require(source('components/AttendanceSummaryPage.tsx')).default
const initial = () => ({ class_id: 1, class_name: 'Lớp Python', today: '2026-10-18', sort: 'name', total: 2, page: 1, page_size: 50,
  sessions: ['present', 'late', 'excused_absence', 'unexcused_absence', 'unmarked', 'not_enrolled', 'upcoming', 'cancelled'].map((state, index) => ({ session_id: index + 1, session_date: '2026-10-18', start_time: '08:00', subject_name: 'Python', topic: `Bài ${index + 1}`, status: state === 'cancelled' ? 'cancelled' : 'scheduled', upcoming: state === 'upcoming' })),
  students: [{ student_id: 4, student_name: 'Học viên An', student_code: 'HV4', membership: 'active', cells: ['present', 'late', 'excused_absence', 'unexcused_absence', 'unmarked', 'not_enrolled', 'upcoming', 'cancelled'], recorded_sessions: 4, attended_sessions: 2, absent_sessions: 2, excused_absences: 1, unexcused_absences: 1, attendance_rate: 50 },
    { student_id: 5, student_name: 'Học viên Bình', student_code: 'HV5', membership: 'upcoming', cells: Array(8).fill('not_enrolled'), recorded_sessions: 0, attended_sessions: 0, absent_sessions: 0, excused_absences: 0, unexcused_absences: 0, attendance_rate: null }] })
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
const button = text => all('button').find(node => node.textContent.includes(text))
beforeEach(() => {
  calls = []; expired = 0
  classes = async () => ({ items: [{ class_id: 1, class_name: 'Lớp Python' }, { class_id: 2, class_name: 'Lớp Java' }] })
  load = async (id, sort, page) => ({ ...initial(), class_id: Number(id), sort, page })
})
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null })
async function mount(path = '/attendance-summary?class_id=1') { root = createRoot(q('#root')); await act(async () => root.render(h(MemoryRouter, { initialEntries: [path] }, h(Page, { onSessionExpired: () => expired++ })))) }
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }
async function select(label, value) {
  const node = q(`select[aria-label="${label}"]`)
  await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event('change', { bubbles: true })) })
}

test('matrix has every status color and text, totals and explicit unknown rate', async () => {
  await mount()
  assert.equal(all('thead th').length, 11)
  assert.deepEqual(all('[data-student-id="4"] .summary-cell').map(node => node.textContent), ['CM', 'M', 'CP', 'KP', '?', '—', 'Sắp', 'Huỷ'])
  assert.equal(all('[data-student-id="4"] .summary-cell[aria-label]').length, 8)
  assert.match(q('[data-student-id="4"] .summary-total').textContent, /2.*1 CP.*1 KP/)
  assert.match(q('[data-student-id="4"] .summary-rate').textContent, /50%.*2\/4/)
  assert.match(q('[data-student-id="5"] .summary-rate').textContent, /—.*Chưa có kết quả/)
  assert.equal(q('.summary-table-scroll').tabIndex, 0)
  assert.match(q('.summary-method').textContent, /Có mặt \+ Đi muộn/)
})

test('ascending sort uses server order across pages and resets to page one', async () => {
  load = async (id, sort, page) => ({ ...initial(), total: 80, sort, page, students: sort === 'rate_asc' ? [...initial().students].reverse() : initial().students })
  await mount(); await click(button('Trang sau')); assert.equal(calls.at(-1)[2], 2)
  await select('Sắp xếp', 'rate_asc')
  assert.deepEqual(calls.at(-1), ['1', 'rate_asc', 1])
  assert.equal(q('tbody tr').dataset.studentId, '5')
  assert.equal(q('th[aria-sort]').getAttribute('aria-sort'), 'ascending')
  await select('Sắp xếp', 'name'); await click(button('Chuyên cần'))
  assert.equal(calls.at(-1)[1], 'rate_asc')
})

test('selecting and clearing a class never leaves the old class matrix visible', async () => {
  await mount(); await select('Lớp học', '2')
  assert.equal(calls.at(-1)[0], '2')
  await select('Lớp học', '')
  assert.equal(q('table'), null)
  assert.match(document.body.textContent, /Chọn một lớp/)
})

test('superseded class response cannot overwrite newly selected class', async () => {
  let finish
  load = id => id === '1' ? new Promise(resolve => { finish = resolve }) : Promise.resolve({ ...initial(), class_name: 'Lớp Java' })
  await mount(); assert.equal(q('table'), null)
  await select('Lớp học', '2')
  await act(async () => finish({ ...initial(), class_name: 'Phản hồi cũ' }))
  assert.equal(q('.summary-heading h2').textContent, 'Lớp Java')
})

test('errors hide stale rows, retry works, authentication expires correctly', async () => {
  await mount()
  load = async () => { throw new SummaryError('Không có quyền xem lớp.', 404) }
  await click(button('Làm mới')); assert.equal(q('table'), null)
  assert.match(q('[role=alert]').textContent, /Không có quyền/)
  load = async () => initial(); await click(button('Thử lại')); assert.ok(q('table'))
  load = async () => { throw new SummaryError('Phiên đã hết hạn.', 401) }
  await click(button('Làm mới')); assert.equal(expired, 1)
})

test('empty classes, no students and no sessions have distinct messages', async () => {
  classes = async () => ({ items: [] })
  await mount('/attendance-summary'); assert.match(document.body.textContent, /chưa có lớp được phép xem/)
  assert.equal(calls.length, 0)
})

test('no sessions produces unknown rates without fabricated absences', async () => {
  load = async () => ({ ...initial(), sessions: [], students: [{ ...initial().students[1], cells: [] }] })
  await mount(); assert.match(document.body.textContent, /Lớp chưa có buổi học/)
  assert.match(q('.summary-rate').textContent, /Chưa có kết quả/)
})

test('options failure can retry and invalid URL class does not request a matrix', async () => {
  classes = async () => { throw new Error('Không tải được lớp') }
  await mount('/attendance-summary?class_id=-1')
  assert.equal(calls.length, 0)
  assert.match(q('[role=alert]').textContent, /Không tải được lớp/)
  classes = async () => ({ items: [{ class_id: 1, class_name: 'Python' }] })
  await click(button('Tải lại lớp')); assert.equal(q('[role=alert]'), null)
})

test('role and permission both required for navigation', () => {
  for (const role of ['INSTRUCTOR', 'TEACHER', 'TRAINING_MANAGER', 'MANAGER', 'ADMIN']) {
    assert.equal(canViewAttendanceSummary({ roles: [role], permissions: ['ATTENDANCE_VIEW'] }), true)
    assert.equal(canViewAttendanceSummary({ roles: [role], permissions: [] }), false)
  }
  assert.equal(canViewAttendanceSummary({ roles: ['STUDENT'], permissions: ['ATTENDANCE_VIEW'] }), false)
  assert.equal(canViewAttendanceSummary({ roles: ['ASSISTANT'], permissions: ['ATTENDANCE_VIEW'] }), false)
})
