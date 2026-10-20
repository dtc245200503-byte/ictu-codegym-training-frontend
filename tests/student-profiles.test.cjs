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


window.HTMLDialogElement.prototype.showModal = function () { this.open = true }
window.HTMLDialogElement.prototype.close = function () { this.open = false }
let root, student, update, calls, saved, closed, searches
class StudentProfileError extends Error { constructor(message, status) { super(message); this.status = status } }
const original = () => ({ student_id: 4, student_code: 'HV4', student_name: 'Nguyễn An', email: 'an@example.com', phone: '0912345678', date_of_birth: '2000-01-01', address: 'Hà Nội', entry_level: 'A2', notes: 'Ghi chú cũ', today: '2026-10-16', profile_token: 'a'.repeat(64), enrollments: [] })
const service = source('services/studentProfileService.ts')
require.cache[service] = { id: service, filename: service, loaded: true, exports: {
  StudentProfileError,
  enrollmentActions: { deferred: 'Bảo lưu', transferred: 'Chuyển lớp', withdrawn: 'Thôi học' },
  enrollmentStatuses: { active: 'Đang học', upcoming: 'Sắp học', completed: 'Lớp đã kết thúc', transferred: 'Đã chuyển lớp' },
  studentDate: value => value ? value.split('-').reverse().join('/') : 'Dữ liệu cũ', studentTime: value => value,
  getStudentProfile: async () => structuredClone(student),
  getStudentProfileHistory: async () => ({ items: [], total: 0 }),
  getStudentAttendanceHistory: async () => ({ items: [], total: 0 }),
  getStudentClasses: async () => [],
  listStudentProfiles: async (...args) => { searches.push(args); return { items: [structuredClone(student)], total: 1 } },
  updateStudentProfile: (...args) => { calls.push(args); return update(...args) },
} }
const Editor = require(source('components/StudentProfileEditor.tsx')).default
const Panel = require(source('components/StudentProfilePanel.tsx')).default
const Page = require(source('components/StudentManagementPage.tsx')).default
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
const button = text => all('button').find(node => node.textContent === text)
const field = text => all('dialog label').find(node => node.textContent.startsWith(text)).querySelector('input,textarea')
beforeEach(() => {
  student = original(); calls = []; searches = []; saved = closed = 0
  update = async (id, data) => { student = { ...student, ...data, student_name: data.full_name }; return student }
})
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null })
async function mount(component) { root = createRoot(q('#root')); await act(async () => root.render(component)) }
async function editor() { await mount(h(Editor, { student, explain: error => error.message, onClose: () => closed++, onSaved: () => saved++ })) }
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }
async function input(node, value) {
  await act(async () => {
    const proto = node.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value)
    node.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
}
async function submit(selector = 'dialog form') { await act(async () => q(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }

test('editor prefills fields, trims text and sends identity token with no student code changes', async () => {
  await editor()
  assert.equal(field('Họ và tên').value, 'Nguyễn An')
  assert.equal(field('Trình độ đầu vào').value, 'A2')
  await input(field('Họ và tên'), ' Nguyễn Bình ')
  await input(field('Ghi chú'), ' Cần cấp lại bảng điểm ')
  await submit()
  assert.equal(saved, 1)
  assert.equal(calls[0][0], 4)
  assert.equal(calls[0][1].full_name, 'Nguyễn Bình')
  assert.equal(calls[0][1].notes, 'Cần cấp lại bảng điểm')
  assert.equal(calls[0][1].expected_token, 'a'.repeat(64))
  assert.equal(calls[0][1].student_code, undefined)
})

test('optional fields clear to null and future birthday does not submit', async () => {
  await editor(); await input(field('Ngày sinh'), '2026-10-17'); await submit()
  assert.equal(calls.length, 0); assert.match(q('[role=alert]').textContent, /tương lai/)
  for (const name of ['Ngày sinh', 'Số điện thoại', 'Địa chỉ', 'Trình độ đầu vào', 'Ghi chú']) await input(field(name), '')
  await submit()
  for (const name of ['date_of_birth','phone','address','entry_level','notes']) assert.equal(calls[0][1][name], null)
})

test('network and duplicate-email errors preserve draft for correction', async () => {
  update = async () => { throw new StudentProfileError('Email đã được sử dụng', 409) }
  await editor(); await input(field('Ghi chú'), 'Không mất ghi chú'); await submit()
  assert.equal(field('Ghi chú').value, 'Không mất ghi chú')
  assert.equal(button('Lưu hồ sơ').disabled, false)
  assert.equal(saved, 0)
  update = async () => student
  await input(field('Email'), 'other@example.com'); await submit()
  assert.equal(saved, 1)
})

test('stale profile locks submission and preserves draft for review', async () => {
  update = async () => { throw new StudentProfileError('Hồ sơ đã được cập nhật ở nơi khác', 412) }
  await editor(); await input(field('Ghi chú'), 'Draft'); await submit()
  assert.equal(field('Ghi chú').value, 'Draft')
  assert.equal(button('Lưu hồ sơ').disabled, true)
  await submit(); assert.equal(calls.length, 1)
  await click(button('Đóng để tải lại hồ sơ')); assert.equal(closed, 1)
})

test('pending save blocks double submit and Escape', async () => {
  let finish
  update = () => new Promise(resolve => { finish = resolve })
  await editor(); await submit(); await submit()
  await act(async () => q('dialog').dispatchEvent(new dom.window.Event('cancel', { cancelable: true })))
  assert.equal(closed, 0); assert.equal(calls.length, 1)
  assert.equal(button('Hủy').disabled, true)
  await act(async () => finish(student)); assert.equal(saved, 1)
})

test('panel groups classes and renders notes as plain text, refreshes after editing', async () => {
  student.notes = '<script>alert(1)</script>'
  student.enrollments = [
    { enrollment_id: 1, class_id: 1, class_name: 'Current', status: 'active', group: 'current', can_change: true },
    { enrollment_id: 2, class_id: 2, class_name: 'Finished', status: 'active', display_status: 'completed', group: 'history', can_change: false },
    { enrollment_id: 3, class_id: 3, class_name: 'Next', status: 'upcoming', group: 'upcoming', can_change: true },
  ]
  await mount(h(Panel, { id: 4, classes: [], explain: error => error.message, onBack() {} }))
  assert.match(q('[aria-label="Lớp đang học"]').textContent, /Current/)
  assert.doesNotMatch(q('[aria-label="Lớp đang học"]').textContent, /Finished/)
  assert.match(q('[aria-label="Lịch sử các lớp đã học"]').textContent, /Finished.*Lớp đã kết thúc/)
  assert.match(q('[aria-label="Lớp sắp học"]').textContent, /Next/)
  assert.equal(q('script'), null)
  assert.match(q('.student-personal-info').textContent, /<script>/)
  await click(button('Sửa thông tin học viên'))
  await input(field('Trình độ đầu vào'), 'B1'); await submit()
  assert.equal(q('dialog'), null)
  assert.match(q('.student-personal-info').textContent, /B1/)
  assert.match(q('[role=status]').textContent, /Đã cập nhật hồ sơ/)
})

test('search accepts phone and list displays contact', async () => {
  await mount(h(MemoryRouter, {}, h(Page, { onSessionExpired() {} })))
  assert.match(q('.student-cards').textContent, /0912345678/)
  await input(q('input[type=search]'), ' +84 912-345-678 ')
  await submit('.student-filters')
  assert.equal(searches.at(-1)[0], '+84 912-345-678')
  assert.equal(searches.at(-1)[2], 1)
})
