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


const actions = { deferred: 'Bảo lưu', transferred: 'Chuyển lớp', withdrawn: 'Thôi học' }
const statuses = { active: 'Đang học', upcoming: 'Chưa đến ngày học', deferred: 'Bảo lưu', transferred: 'Đã chuyển lớp', withdrawn: 'Thôi học' }
const original = () => ({ student_id: 4, student_name: 'Nguyễn An', student_code: 'HV04', today: '2026-10-16', enrollments: [{ enrollment_id: null, class_id: 1, class_name: 'Lớp cũ', started_on: '2026-10-01', ended_on: null, end_status: null, status: 'active', can_change: true }] })
const classes = [{ class_id: 1, class_name: 'Lớp cũ', status: 'in_progress' }, { class_id: 2, class_name: 'Lớp mới', status: 'planned' }, { class_id: 3, class_name: 'Lớp hủy', status: 'cancelled' }]
let student, change, profile, history, attendance, list, calls, closed, saved, expired, root
class StudentProfileError extends Error { constructor(message, status) { super(message); this.status = status } }
const service = source('services/studentProfileService.ts')
require.cache[service] = { id: service, filename: service, loaded: true, exports: {
  StudentProfileError, enrollmentActions: actions, enrollmentStatuses: statuses,
  studentDate: value => value ? value.split('-').reverse().join('/') : 'Dữ liệu cũ', studentTime: value => value,
  changeStudentEnrollment: (...args) => change(...args), getStudentProfile: (...args) => profile(...args),
  getStudentProfileHistory: (...args) => history(...args), getStudentAttendanceHistory: (...args) => attendance(...args),
  getStudentClasses: async () => classes, listStudentProfiles: (...args) => list(...args),
} }
const Dialog = require(source('components/EnrollmentChangeDialog.tsx')).default
const Panel = require(source('components/StudentProfilePanel.tsx')).default
const Page = require(source('components/StudentManagementPage.tsx')).default
const { canManageStudentProfiles } = require(source('utils/studentAccess.ts'))
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
const button = text => all('button').find(node => node.textContent.includes(text))
const explain = error => error.message
beforeEach(() => {
  student = original(); calls = []; closed = saved = expired = 0
  change = async (...args) => { calls.push(args) }
  profile = async () => structuredClone(student)
  history = async () => ({ items: [], total: 0 })
  attendance = async () => ({ items: [], total: 0 })
  list = async (...args) => { calls.push(args); return { items: [structuredClone(student)], total: 1 } }
})
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null })
async function mount(component) { root = createRoot(q('#root')); await act(async () => root.render(component)) }
async function dialog() { await mount(h(Dialog, { student, enrollment: student.enrollments[0], classes, onClose: () => closed++, onSaved: () => saved++, explain })) }
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }
async function input(node, value) {
  await act(async () => {
    const proto = node.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value)
    node.dispatchEvent(new dom.window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
async function submit() { await act(async () => q('.student-change-dialog form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }

test('manager role and explicit permission are both required', () => {
  for (const role of ['TRAINING_MANAGER', 'MANAGER']) {
    assert.equal(canManageStudentProfiles({ roles: [role], permissions: ['STUDENT_MANAGE'] }), true)
    assert.equal(canManageStudentProfiles({ roles: [role], permissions: [] }), false)
  }
  for (const role of ['ADMIN', 'INSTRUCTOR', 'STUDENT']) assert.equal(canManageStudentProfiles({ roles: [role], permissions: ['STUDENT_MANAGE'] }), false)
})

test('defer requires a reason and effective date, and submits a trimmed reason', async () => {
  await dialog()
  assert.deepEqual(all('#enrollment-operation option').map(node => node.textContent), Object.values(actions))
  assert.equal(q('#enrollment-date').value, '2026-10-16')
  assert.ok(button('Xác nhận').disabled)
  await input(q('#enrollment-reason'), '   ')
  await submit()
  assert.equal(calls.length, 0)
  await input(q('#enrollment-reason'), '  Công việc gia đình  ')
  await input(q('#enrollment-date'), '')
  await submit()
  assert.equal(calls.length, 0)
  await input(q('#enrollment-date'), '2026-10-20')
  await submit()
  assert.deepEqual(calls, [[4, { class_id: 1, enrollment_id: null, operation: 'deferred', effective_date: '2026-10-20', reason: 'Công việc gia đình' }]])
  assert.equal(saved, 1)
})

test('transfer requires eligible destination; withdrawal does not send a stale destination', async () => {
  await dialog()
  await input(q('#enrollment-operation'), 'transferred')
  assert.deepEqual(all('#enrollment-target option').map(node => node.value), ['', '2'])
  await input(q('#enrollment-reason'), 'Đổi lịch học')
  await submit()
  assert.equal(calls.length, 0)
  await input(q('#enrollment-target'), '2')
  await submit()
  assert.equal(calls[0][1].to_class_id, 2)
  assert.equal(calls[0][1].operation, 'transferred')
  await input(q('#enrollment-operation'), 'withdrawn')
  assert.equal(q('#enrollment-target'), null)
  await submit()
  assert.equal(calls[1][1].operation, 'withdrawn')
  assert.equal('to_class_id' in calls[1][1], false)
})

test('effective date before enrollment is rejected without a request', async () => {
  await dialog()
  await input(q('#enrollment-reason'), 'Sai ngày')
  await input(q('#enrollment-date'), '2026-09-30')
  await submit()
  assert.match(q('[role=alert]').textContent, /trước ngày bắt đầu/)
  assert.equal(calls.length, 0)
})

test('duplicate submit is blocked and conflict preserves draft for review', async () => {
  let reject
  change = (...args) => { calls.push(args); return new Promise((_, fail) => { reject = fail }) }
  await dialog()
  await input(q('#enrollment-reason'), 'Lý do còn giữ')
  await submit(); await submit()
  assert.equal(calls.length, 1)
  assert.ok(button('Đang lưu').disabled)
  assert.ok(q('#enrollment-operation').disabled)
  await act(async () => reject(new StudentProfileError('Hồ sơ đã thay đổi. Vui lòng tải lại.', 409)))
  assert.match(q('[role=alert]').textContent, /Hồ sơ đã thay đổi/)
  assert.equal(q('#enrollment-reason').value, 'Lý do còn giữ')
  assert.equal(saved, 0)
  await click(button('Hủy'))
  assert.equal(closed, 1)
})

test('dialog traps keyboard focus and Escape cancels without saving', async () => {
  await dialog()
  assert.equal(document.activeElement, q('#enrollment-operation'))
  const first = q('[aria-label="Đóng xử lý học tập"]')
  await act(async () => { first.focus(); first.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })) })
  assert.equal(document.activeElement, button('Hủy'))
  await act(async () => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(closed, 1)
  assert.equal(calls.length, 0)
})

test('profile refreshes after saving and retains original class attendance and audit snapshots', async () => {
  let updated = false
  change = async () => { updated = true; student.enrollments[0] = { ...student.enrollments[0], can_change: false, ended_on: '2026-10-20', end_status: 'deferred' } }
  history = async (_, page) => ({ total: updated ? 21 : 0, items: updated ? [{ history_id: page, operation: 'deferred', effective_date: '2026-10-20', reason: '<img src=x>\nGia đình', from_class_name: 'Lớp cũ', actor_name: 'Quản lý A', created_at: '2026-10-16T03:00:00Z' }] : [] })
  attendance = async () => ({ total: 1, items: [{ session_id: 7, class_name: 'Lớp cũ', session_date: '2026-10-15', topic: 'Buổi cũ', status: 'late' }] })
  await mount(h(Panel, { id: 4, classes, explain, onBack: () => {} }))
  await click(button('Bảo lưu /'))
  await input(q('#enrollment-reason'), 'Gia đình')
  await input(q('#enrollment-date'), '2026-10-20')
  await submit()
  assert.equal(q('[role=dialog]'), null)
  assert.match(q('.student-success').textContent, /Đã ghi nhận/)
  assert.equal(button('Bảo lưu /'), undefined)
  assert.match(q('.student-enrollment').textContent, /Đã lên lịch/)
  assert.match(q('.student-history').textContent, /Quản lý A/)
  assert.match(q('.student-history').textContent, /20\/10\/2026/)
  assert.equal(q('.student-history img'), null)
  assert.match(q('.student-attendance-history').textContent, /Lớp cũ · 15\/10\/2026.*Buổi cũ · Đi muộn/)
  await click(q('.student-history .student-pagination button:last-child'))
  assert.match(q('.student-history .student-pagination').textContent, /Trang 2\/2/)
})

test('student page filters historical class membership and opens a profile', async () => {
  await mount(h(MemoryRouter, { initialEntries: ['/students?class_id=1'] }, h(Page, { onSessionExpired: () => expired++ })))
  assert.deepEqual(calls[0], ['', '1', 1])
  await input(q('input[type=search]'), '  Nguyễn An  ')
  await act(async () => q('.student-filters').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })))
  assert.deepEqual(calls.at(-1), ['Nguyễn An', '1', 1])
  await click(button('Mở hồ sơ'))
  assert.match(q('.student-profile-header').textContent, /Nguyễn An/)
  await click(button('← Danh sách'))
  assert.ok(q('.student-cards'))
})

test('load failures offer retry and expired authentication is reported', async () => {
  list = async () => { throw new StudentProfileError('Hết phiên', 401) }
  await mount(h(MemoryRouter, null, h(Page, { onSessionExpired: () => expired++ })))
  assert.equal(expired, 1)
  assert.match(q('[role=alert]').textContent, /Hết phiên/)
  list = async () => ({ items: [], total: 0 })
  await click(button('Thử lại'))
  assert.match(q('.student-management-page').textContent, /Không có học viên phù hợp/)
})


test('student profile shows immutable enrollment actor and date', async () => {
  student.enrollments[0].registration = { enrolled_on: '2026-10-16', actor_name: 'Quản lý A', actor_id: 1, created_at: '2026-10-16T03:00:00+00:00' }
  await mount(h(Panel, { id: 4, classes, explain, onBack() {} }))
  assert.match(q('.student-enrollment').textContent, /Ghi danh ngày 16\/10\/2026 bởi Quản lý A/)
})
