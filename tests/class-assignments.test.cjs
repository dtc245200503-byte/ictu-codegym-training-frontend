const assert = require('node:assert/strict')
const { test, afterEach } = require('node:test')
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
const instructor = { user_id: 2, full_name: 'Giảng viên A', email: 'a@example.com', username: 'a' }
const assistants = [3, 4].map(id => ({ user_id: id, full_name: `Trợ giảng ${id}`, email: `ta${id}@example.com`, username: `ta${id}` }))
const subjects = [1, 2].map(id => ({ subject_id: id, code: `MH${id}`, name: `Môn ${id}`, session_count: 3, instructor_id: null, assistants: [] }))
const detail = () => ({ class_id: 1, class_name: 'Lớp Python', subjects: structuredClone(subjects), available_instructors: [instructor], available_assistants: structuredClone(assistants) })
const manager = { user_id: 1, full_name: 'Quản lý', roles: ['TRAINING_MANAGER'], permissions: ['CLASS_MANAGE'] }
let load, save, list, rolesAssigned
function mock(file, exports) { const name = source(file); require.cache[name] = { id: name, filename: name, loaded: true, exports } }
mock('services/classService.ts', {
  ClassPermissionError: class ClassPermissionError extends Error {}, ClassSessionError: class ClassSessionError extends Error {},
  getClassAssignments: (...args) => load(...args), saveBatchClassAssignments: (...args) => save(...args), listClasses: (...args) => list(...args),
})
mock('services/userService.ts', { getUserRoles: async () => ({ roles: [{ role_id: 2, role_name: 'INSTRUCTOR' }] }), assignUserRole: async (_, id) => rolesAssigned.push(id), removeUserRole: async () => {} })
mock('services/rolePermissionService.ts', { getRolePermissions: async () => ({ roles: [{ role_id: 2, role_name: 'INSTRUCTOR' }, { role_id: 23, role_name: 'ASSISTANT' }] }) })
const AssignTeachersModal = require(source('components/AssignTeachersModal.tsx')).default
const ClassPage = require(source('components/ClassPage.tsx')).default
const UserRoleModal = require(source('components/UserRoleModal.tsx')).default
const { canViewClasses, canAssignTeachers } = require(source('utils/classAccess.ts'))
let root
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
async function mount(component) { root = createRoot(q('#root')); await act(async () => root.render(component)) }
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }
async function choose(id, value) { await act(async () => { const select = q('#'+id); select.value = String(value); select.dispatchEvent(new dom.window.Event('change', { bubbles: true })) }) }
const noop = () => {}
async function modal(props = {}) { await mount(h(AssignTeachersModal, { classId: 1, onClose: noop, onSaved: noop, onSessionExpired: noop, ...props })) }
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null })

test('teaching roles can view their classes without management permission but cannot assign', () => {
  for (const role of ['INSTRUCTOR', 'ASSISTANT', 'TEACHER', 'TA']) {
    const user = { ...manager, roles: [role], permissions: [] }
    assert.equal(canViewClasses(user), true)
    assert.equal(canAssignTeachers(user), false)
    assert.equal(canAssignTeachers({ ...user, permissions: ['CLASS_MANAGE'] }), false)
  }
  assert.equal(canViewClasses({ ...manager, roles: ['STUDENT'], permissions: [] }), false)
  assert.equal(canAssignTeachers(manager), true)
})

test('every subject requires a main teacher, multiple assistants serialize correctly and save refreshes parent', async () => {
  load = async () => detail()
  let payload, saved = 0
  save = async (...args) => { payload = args }
  await modal({ onSaved: () => saved++ })
  assert.ok(q('.assign-btn-primary').disabled)
  await choose('assign-instructor-1', 2)
  await choose('assign-assistant-1', 3)
  await choose('assign-assistant-1', 4)
  assert.equal(all('.assign-tag').length, 2)
  assert.ok(q('.assign-btn-primary').disabled)
  await choose('assign-instructor-2', 2)
  await click(q('.assign-btn-primary'))
  assert.equal(saved, 1)
  assert.deepEqual(payload, [1, [{ subject_id: 1, instructor_id: 2, assistant_ids: [3, 4] }, { subject_id: 2, instructor_id: 2, assistant_ids: [] }]])
})

test('changing main teacher removes overlapping assistant and unavailable accounts must be replaced', async () => {
  load = async () => { const data = detail(); data.available_assistants.push(instructor); data.subjects[0].instructor_id = 999; data.subjects[0].instructor_name = 'Tài khoản cũ'; return data }
  await modal()
  assert.ok(q('.assign-invalid'))
  assert.equal(q('#assign-instructor-1').value, '')
  await choose('assign-assistant-1', 2)
  assert.equal(all('.assign-tag').length, 1)
  await choose('assign-instructor-1', 2)
  assert.equal(all('.assign-tag').length, 0)
})

test('failed save retains edits and retry succeeds; pending save prevents duplicate submission and closing', async () => {
  load = async () => detail()
  let rejectSave, calls = 0, closed = 0
  save = () => { calls++; return new Promise((_, reject) => { rejectSave = reject }) }
  await modal({ onClose: () => closed++ })
  await choose('assign-instructor-1', 2); await choose('assign-instructor-2', 2)
  await click(q('.assign-btn-primary')); await click(q('.assign-btn-primary'))
  assert.equal(calls, 1)
  await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  assert.equal(closed, 0)
  await act(async () => rejectSave(new Error('Không thể lưu')))
  assert.match(q('[role="alert"]').textContent, /Không thể lưu/)
  assert.equal(q('#assign-instructor-1').value, '2')
  assert.equal(q('.assign-btn-primary').disabled, false)
  save = async () => { calls++ }
  await click(q('.assign-btn-primary')); assert.equal(calls, 2)
})

test('load failure offers retry and empty class cannot save', async () => {
  load = async () => { throw new Error('Mất kết nối') }
  await modal()
  assert.ok(q('[role="alert"] button'))
  load = async () => ({ ...detail(), subjects: [] })
  await click(q('[role="alert"] button'))
  assert.match(q('.assign-modal-body').textContent, /Lớp chưa có môn học/)
  assert.ok(q('.assign-btn-primary').disabled)
})

test('teacher class list displays subject responsibility without assignment controls', async () => {
  list = async () => ({ total: 1, items: [{ ...detail(), status: 'in_progress', subjects: [{ ...subjects[0], instructor_id: 2, instructor_name: instructor.full_name, assistants }] }] })
  await mount(h(MemoryRouter, null, h(ClassPage, { user: { ...manager, user_id: 2, roles: ['INSTRUCTOR'], permissions: [] }, onSessionExpired: noop, onSuccess: noop })))
  assert.equal(q('h1').textContent, 'Lớp của tôi')
  assert.equal(all('button').some(button => button.textContent === 'Phân công'), false)
  await click(all('button').find(button => button.textContent === 'Xem 1 môn học'))
  assert.match(q('.class-subject-detail').textContent, /Giảng viên A/)
  assert.match(q('.class-subject-detail').textContent, /Trợ giảng 3, Trợ giảng 4/)
  assert.match(q('.class-mine-badge').textContent, /Bạn phụ trách/)
})

test('role management loads assistant role IDs from the API rather than hard-coding them', async () => {
  rolesAssigned = []
  await mount(h(UserRoleModal, { user: { user_id: 20, full_name: 'Tài khoản' }, currentUser: { ...manager, roles: ['ADMIN'], permissions: ['ROLE_MANAGE'] }, onClose: noop, onUpdated: noop }))
  const label = all('label').find(label => label.textContent.includes('Trợ giảng'))
  assert.ok(label)
  await click(label.querySelector('input'))
  await click(all('button').find(button => /Lưu/.test(button.textContent)))
  assert.deepEqual(rolesAssigned, [23])
})
