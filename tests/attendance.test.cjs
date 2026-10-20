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
const conflictFixture = require('./schedule-conflict-fixture.cjs')
const { ScheduleConflictError } = require(source('services/scheduleConflict.ts'))

const statuses = { present: 'Có mặt', late: 'Đi muộn', excused_absence: 'Vắng có phép', unexcused_absence: 'Vắng không phép' }
const initial = () => ({ session_id: 1, class_id: 4, class_name: 'Lớp Python', subject_name: 'Lập trình', topic: 'Buổi 1', session_date: '2026-10-16', start_time: '08:00', version: 0, saved_at: null, saved_by_name: null, can_edit: true, can_edit_past: false, read_only_reason: null, today: '2026-10-16',
  students: [1, 2, 3, 4].map(id => ({ student_id: id, student_name: 'Học viên ' + id, student_code: 'HV' + id, status: null })) })
let detail, load, save, logs, sessions, options, candidates, enroll, create, calls, closed, expired
class AttendanceError extends Error { constructor(message, status) { super(message); this.status = status } }
const service = source('services/attendanceService.ts')
require.cache[service] = { id: service, filename: service, loaded: true, exports: {
  getAttendanceRoomCapacity: async () => ({ class_size: 4, room_kind: 'physical', room_capacity: 20 }),
  AttendanceError, attendanceStatuses: statuses, attendanceDate: value => value.split('-').reverse().join('/'),
  attendanceTime: value => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
  getAttendance: (...args) => load(...args), saveAttendance: (...args) => save(...args), getAttendanceHistory: (...args) => logs(...args),
  getAttendanceOptions: (...args) => options(...args), listAttendanceSessions: (...args) => sessions(...args),
  findAttendanceStudents: (...args) => candidates(...args), enrollAttendanceStudents: (...args) => enroll(...args),
  createAttendanceSession: (...args) => create(...args),
} }
const AttendanceEditor = require(source('components/AttendanceEditor.tsx')).default
const AttendancePage = require(source('components/AttendancePage.tsx')).default
const AttendancePrepare = require(source('components/AttendancePrepare.tsx')).default
let root
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
beforeEach(() => {
  detail = initial(); closed = expired = 0; calls = []
  load = async () => structuredClone(detail)
  save = async (id, version, items) => { calls.push([id, version, items]); detail = { ...detail, version: version + 1, saved_at: '2026-10-16T03:00:00Z', saved_by_name: 'Giảng viên A', students: detail.students.map(student => ({ ...student, status: items.find(item => item.student_id === student.student_id).status })) }; return { ...structuredClone(detail), changed: 4 } }
  logs = async () => ({ items: [], total: 0 })
  options = async () => ({ today: '2026-10-16', can_prepare: false, subjects: [] })
  sessions = async () => ({ today: '2026-10-16', total: 1, items: [detail] })
  candidates = async () => ({ items: [], total: 0 })
  enroll = async () => ({ added: 0 })
  create = async () => detail
})
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null })
async function mount(component) { root = createRoot(q('#root')); await act(async () => root.render(component)) }
const explain = error => { if (error instanceof AttendanceError && error.status === 401) expired++; return error.message }
async function editor() { await mount(h(AttendanceEditor, { sessionId: 1, onBack: () => closed++, explain })) }
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }
const button = text => all('button').find(node => node.textContent.includes(text))
async function input(node, value) {
  await act(async () => {
    const proto = node.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value)
    node.dispatchEvent(new dom.window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}
async function submit(form) { await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }
async function toggleHistory() { await act(async () => { const panel = q('.attendance-history-panel'); panel.open = true; panel.dispatchEvent(new dom.window.Event('toggle')) }) }

test('creating a conflicting session needs confirmation and carries the reviewed token', async () => {
  create = async data => { calls.push(data); if (calls.length === 1) throw new ScheduleConflictError(conflictFixture()); return initial() }
  await mount(h(AttendancePrepare, { options: { today: '2026-10-16', can_prepare: true, subjects: [{ class_subject_id: 1, class_id: 1, class_name: 'Python', subject_name: 'Python' }] }, explain, onCreated() {} }))
  await input(q('select'), '1'); await input(q('.attendance-create-session input[maxlength]'), 'Bài 1')
  await submit(q('.attendance-create-session'))
  assert.equal(button('Tạo buổi học').disabled, true)
  await submit(q('.attendance-create-session')); assert.equal(calls.length, 1)
  await click(q('.schedule-conflict-confirm input'))
  await submit(q('.attendance-create-session'))
  assert.equal(calls[1].conflict_token, 'a'.repeat(64))
  assert.equal(calls[1].acknowledge_conflicts, true)
})

test('four statuses are explicit and saving is blocked until everyone is marked', async () => {
  await editor()
  assert.equal(all('.attendance-student').length, 4)
  assert.deepEqual(all('.attendance-student:first-child .attendance-status span').map(node => node.textContent), Object.values(statuses))
  assert.ok(button('Lưu điểm danh').disabled)
  await click(q('[name=attendance-1][value=present]'))
  assert.ok(button('Lưu điểm danh').disabled)
  assert.match(q('.attendance-progress').textContent, /1\/4/)
})

test('one-click all-present includes hidden students then exceptions save as one batch', async () => {
  await editor()
  await input(q('.attendance-search input'), 'Học viên 1')
  assert.equal(all('.attendance-student').length, 1)
  await click(button('Tất cả có mặt'))
  await click(q('[name=attendance-1][value=late]'))
  await click(button('Lưu điểm danh'))
  assert.deepEqual(calls, [[1, 0, [1, 2, 3, 4].map(id => ({ student_id: id, status: id === 1 ? 'late' : 'present' }))]])
  assert.match(q('.attendance-success').textContent, /Đã lưu/)
  assert.ok(button('Lưu điểm danh').disabled)
  assert.match(q('.attendance-session-header small').textContent, /Giảng viên A/)
})

test('saved attendance can be edited and sends the current revision', async () => {
  detail.version = 7
  detail.students.forEach(student => { student.status = 'present' })
  await editor()
  await click(q('[name=attendance-2][value=excused_absence]'))
  await click(q('[name=attendance-3][value=unexcused_absence]'))
  await click(button('Lưu điểm danh'))
  assert.equal(calls[0][1], 7)
  assert.equal(calls[0][2][1].status, 'excused_absence')
  assert.equal(calls[0][2][2].status, 'unexcused_absence')
})

test('failed save preserves selections and double click cannot send two requests', async () => {
  let reject
  save = (...args) => { calls.push(args); return new Promise((_, fail) => { reject = fail }) }
  await editor()
  await click(button('Tất cả có mặt'))
  await click(q('[name=attendance-4][value=unexcused_absence]'))
  await click(button('Lưu điểm danh'))
  assert.equal(calls.length, 1)
  assert.ok(button('Đang lưu').disabled)
  assert.ok(q('.attendance-status-options').disabled)
  await act(async () => reject(new Error('Mất kết nối')))
  assert.match(q('[role=alert]').textContent, /Mất kết nối/)
  assert.ok(q('[name=attendance-4][value=unexcused_absence]').checked)
  assert.equal(button('Lưu điểm danh').disabled, false)
})

test('conflict keeps draft; refresh requires explicit discard and obtains new revision', async () => {
  save = async () => { throw new AttendanceError('Người khác đã cập nhật. Tải lại dữ liệu.', 409) }
  await editor()
  await click(button('Tất cả có mặt'))
  await click(button('Lưu điểm danh'))
  assert.match(q('[role=alert]').textContent, /Người khác/)
  detail.version = 4; detail.students.forEach(student => { student.status = 'late' })
  await click(button('Tải dữ liệu mới'))
  assert.ok(button('Bỏ thay đổi'))
  assert.ok(q('[name=attendance-1][value=present]').checked)
  await click(button('Bỏ thay đổi'))
  assert.ok(q('[name=attendance-1][value=late]').checked)
  assert.equal(q('.attendance-error'), null)
})

test('past/future and revoked permissions remain read-only in the UI', async () => {
  detail.can_edit = false
  detail.read_only_reason = 'Chỉ Quản lý đào tạo được sửa buổi quá khứ.'
  await editor()
  assert.match(q('.attendance-warning').textContent, /Quản lý/)
  assert.ok(button('Tất cả có mặt').disabled)
  assert.ok(button('Lưu điểm danh').disabled)
  assert.ok(q('.attendance-status-options').disabled)
  assert.equal(calls.length, 0)
})

test('unsaved back navigation warns and allows continuing or discarding', async () => {
  await editor()
  await click(button('Tất cả có mặt'))
  await click(button('← Buổi học'))
  assert.equal(closed, 0)
  await click(button('Tiếp tục chỉnh'))
  assert.equal(q('.attendance-warning'), null)
  await click(button('← Buổi học'))
  await click(button('Bỏ thay đổi'))
  assert.equal(closed, 1)
})

test('history renders snapshots safely and paginates', async () => {
  const pages = []
  logs = async (_, page) => { pages.push(page); return { total: 21, items: [{ history_id: page, student_name: '<img src=x>', from_status: 'present', to_status: 'late', actor_name: 'Quản lý A', version: 2, created_at: '2026-10-16T03:00:00Z' }] } }
  await editor()
  await toggleHistory()
  assert.match(q('.attendance-history').textContent, /Có mặt → Đi muộn/)
  assert.match(q('.attendance-history').textContent, /Quản lý A/)
  assert.equal(q('.attendance-history img'), null)
  await click(button('Sau'))
  assert.deepEqual(pages, [1, 2])
})

test('load failure offers retry and expires the session when needed', async () => {
  load = async () => { throw new AttendanceError('Hết phiên', 401) }
  await editor()
  assert.equal(expired, 1)
  assert.equal(q('.attendance-students'), null)
  load = async () => detail
  await click(button('Thử lại'))
  assert.equal(all('.attendance-student').length, 4)
})

test('session page defaults to server today and selects an attendance session', async () => {
  let filters
  sessions = async (...args) => { filters = args; return { items: [detail], total: 1, today: '2026-10-16' } }
  await mount(h(MemoryRouter, { initialEntries: ['/attendance?class_id=4'] }, h(AttendancePage, { onSessionExpired: () => expired++ })))
  assert.deepEqual(filters, ['', '4', 1])
  assert.equal(q('[aria-label="Ngày học"]').value, '2026-10-16')
  await click(button('Điểm danh ngay'))
  assert.equal(all('.attendance-student').length, 4)
})

test('empty roster cannot be saved and explains how to prepare it', async () => {
  detail.students = []
  await editor()
  assert.equal(button('Lưu điểm danh'), undefined)
  assert.match(q('.attendance-empty').textContent, /danh sách lớp/)
})

test('manager can enroll selected students and create a dated class session', async () => {
  const opts = { today: '2026-10-16', can_prepare: true, subjects: [{ class_subject_id: 3, class_id: 4, class_name: 'Lớp Python', subject_name: 'Lập trình' }] }
  let enrolled, created, createdDate
  candidates = async () => ({ items: [detail.students[0]], total: 1 })
  enroll = async (...args) => { enrolled = args; return { added: 1 } }
  create = async body => { created = body; return detail }
  await mount(h(AttendancePrepare, { options: opts, explain, onCreated: value => { createdDate = value } }))
  await input(q('select'), '3')
  await submit(q('.attendance-prepare-body section form'))
  await click(q('.attendance-candidates input'))
  await click(button('học viên đã chọn'))
  assert.deepEqual(enrolled, [4, [1]])
  await input(q('.attendance-create-session input[maxlength="255"]'), 'Buổi 1')
  await submit(q('.attendance-create-session'))
  assert.deepEqual(created, { class_subject_id: 3, session_date: '2026-10-16', start_time: '08:00', end_time: '09:30', room_id: null, room_name: null, topic: 'Buổi 1' })
  assert.equal(createdDate, '2026-10-16')
})

test('save denial locks editing while keeping the draft for review', async () => {
  save = async () => { throw new AttendanceError('Chỉ Quản lý đào tạo được sửa buổi quá khứ.', 403) }
  await editor()
  await click(button('Tất cả có mặt'))
  await click(button('Lưu điểm danh'))
  assert.ok(q('[name=attendance-1][value=present]').checked)
  assert.ok(q('.attendance-status-options').disabled)
  assert.ok(button('Lưu điểm danh').disabled)
  assert.match(q('.attendance-warning').textContent, /Quản lý/)
})


test('archived attendance remains read-only and is excluded from current roster submissions', async () => {
  detail.archived_students = [{ student_id: 9, student_name: 'Học viên chuyển lớp', student_code: 'HV9', status: 'late' }]
  await editor()
  assert.match(q('.attendance-history-panel').textContent, /Dữ liệu đã lưu trước điều chỉnh hồ sơ/)
  assert.match(q('.attendance-history-panel').textContent, /Học viên chuyển lớp/)
  assert.match(q('.attendance-history-panel').textContent, /Đi muộn/)
  assert.equal(q('[name=attendance-9]'), null)
  await click(button('Tất cả có mặt'))
  await click(button('Lưu điểm danh'))
  assert.equal(calls[0][2].some(item => item.student_id === 9), false)
})


test('session preparation validates end time and sends the room', async () => {
  let created
  create = async data => { created = data; return detail }
  await mount(h(AttendancePrepare, { options: { rooms: [{ room_id: 201, name: 'P.201', kind: 'physical', capacity: 20, is_active: true }], today: '2026-10-16', can_prepare: true, subjects: [{ class_subject_id: 3, class_id: 4, class_name: 'Lớp A', subject_name: 'Môn A' }] }, explain, onCreated: () => {} }))
  await input(q('select'), '3')
  await input(q('input[maxlength="255"]'), 'Buổi mới')
  await input(all('input[type=time]')[1], '07:00')
  await submit(q('.attendance-create-session'))
  assert.equal(created, undefined)
  assert.match(q('[role=alert]').textContent, /Giờ kết thúc phải sau/)
  await input(all('input[type=time]')[1], '10:00')
  await input(q('[aria-label="Phòng học"]'), '201')
  await submit(q('.attendance-create-session'))
  assert.equal(created.end_time, '10:00')
  assert.equal(created.room_id, 201)
  assert.equal(created.room_name, null)
})


test('all-present preserves approved absence and disables changing that student', async () => {
  detail.absence_prefilled = true; detail.version = 1
  detail.students[0].status = 'excused_absence'; detail.students[0].approved_absence = true
  await editor(); await click(button('Tất cả có mặt (4)'))
  assert.equal(q('[data-student-id="1"] fieldset').disabled, true)
  assert.equal(q('[name=attendance-1][value=excused_absence]').checked, true)
  await click(button('Lưu điểm danh'))
  assert.equal(calls[0][2][0].status, 'excused_absence')
  assert.equal(calls[0][2][1].status, 'present')
})

test('all-excused prefill can be confirmed even without changing a status', async () => {
  detail.absence_prefilled = true; detail.version = 1
  detail.students = detail.students.map(student => ({ ...student, status: 'excused_absence', approved_absence: true }))
  await editor()
  assert.equal(button('Lưu điểm danh').disabled, false)
  await click(button('Lưu điểm danh')); assert.equal(calls.length, 1)
})
