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
const programService = source('services/trainingProgramService.ts')
const realPrograms = require(programService)
require.cache[programService] = { id: programService, filename: programService, loaded: true, exports: {
  ...realPrograms, listPrograms: async () => ({ items: [{ curriculum_id: 10, code: 'CT10', name: 'Python', description: '', total_duration_hours: '60', standard_tuition: '1000', status: 'active', total_class_count: 1, active_class_count: 1, can_delete: false }], total: 1 }),
} }
const service = source('services/attendanceRiskService.ts')
const real = require(service)
let load, save, saved, closed, calls, root
require.cache[service] = { id: service, filename: service, loaded: true, exports: {
  ...real, getAbsencePolicy: () => load(), saveAbsencePolicy: (...args) => { calls.push(args); return save(...args) },
} }
const Dialog = require(source('components/AbsencePolicyDialog.tsx')).default
const Badges = require(source('components/AttendanceRiskBadges.tsx')).default
const Programs = require(source('components/TrainingProgramPage.tsx')).default
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
const button = text => all('button').find(node => node.textContent === text)
const flag = { class_id: 1, class_name: 'Python 01', student_id: 4, student_name: 'Nguyễn An', student_code: 'HV4', absent_sessions: 3, scheduled_sessions: 10, threshold_percent: 20, absence_rate: 30, activated_at: '2026-10-20T03:00:00Z' }
beforeEach(() => {
  saved = closed = 0; calls = []
  load = async () => ({ course_id: 10, program_name: 'Python', threshold_percent: '20.00', can_edit: true })
  save = async () => ({})
})
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null })
async function mount(component = h(Dialog, { courseId: 10, explain: error => error.message, onClose: () => closed++, onSaved: () => saved++ })) {
  root = createRoot(q('#root')); await act(async () => root.render(component))
}
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }
async function input(value) { await act(async () => { const node=q('#absence-threshold'); Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event('input', { bubbles: true })) }) }
async function submit() { await act(async () => q('dialog form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }

test('program page opens threshold configuration and shows successful save', async () => {
  await mount(h(MemoryRouter, {}, h(Programs, { onSessionExpired() {} })))
  await click(button('Ngưỡng vắng'))
  assert.equal(q('#absence-threshold').value, '20.00')
  assert.match(q('dialog').textContent, /buổi vắng thứ 3/)
  await input('25.5'); await submit()
  assert.deepEqual(calls, [[10, 25.5, 20]])
  assert.equal(q('dialog'), null)
  assert.match(q('.program-success').textContent, /cập nhật cảnh báo/)
})

test('invalid, fractional precision and out-of-range thresholds cannot be submitted', async () => {
  await mount()
  for (const value of ['-1', '100.01', '20.123', '']) { await input(value); await submit(); assert.match(q('[role=alert]').textContent, /0 đến 100/); }
  assert.equal(calls.length, 0)
  await input('0'); await submit(); assert.equal(calls[0][1], 0)
})

test('default reset and read-only administrator policy', async () => {
  load = async () => ({ course_id: 10, program_name: 'Python', threshold_percent: '35', can_edit: false })
  await mount()
  assert.equal(q('#absence-threshold').disabled, true)
  assert.equal(button('Lưu ngưỡng').disabled, true)
  assert.equal(button('Mặc định 20%').disabled, true)
  await submit(); assert.equal(calls.length, 0)
})

test('reset to 20 keeps optimistic expected threshold', async () => {
  load = async () => ({ course_id: 10, program_name: 'Python', threshold_percent: '35', can_edit: true })
  await mount(); await click(button('Mặc định 20%')); await submit()
  assert.deepEqual(calls[0], [10, 20, 35])
})

test('stale policy cannot overwrite another manager and reload allows a fresh save', async () => {
  save = async () => { throw new real.RiskPolicyConflict('Ngưỡng đã thay đổi.') }
  await mount(); await input('10'); await submit()
  assert.equal(button('Lưu ngưỡng').disabled, true)
  assert.equal(q('#absence-threshold').disabled, true)
  load = async () => ({ course_id: 10, program_name: 'Python', threshold_percent: '30', can_edit: true })
  save = async () => ({})
  await click(button('Tải lại cấu hình')); await input('10'); await submit()
  assert.deepEqual(calls.at(-1), [10, 10, 30])
  assert.equal(saved, 1)
})

test('pending save blocks double submission, close and Escape', async () => {
  let finish
  save = () => new Promise(resolve => { finish = resolve })
  await mount(); await submit(); await submit()
  assert.equal(calls.length, 1)
  assert.equal(button('Đóng').disabled, true)
  const cancel = new dom.window.Event('cancel', { bubbles: true, cancelable: true })
  await act(async () => q('dialog').dispatchEvent(cancel))
  assert.equal(closed, 0)
  await act(async () => finish({})); assert.equal(saved, 1)
})

test('failed load blocks save and can retry without inventing saved configuration', async () => {
  load = async () => { throw new Error('Không tải được cấu hình.') }
  await mount(); assert.equal(button('Lưu ngưỡng').disabled, true)
  load = async () => ({ course_id: 10, program_name: 'Python', threshold_percent: 40, can_edit: true })
  await click(button('Tải lại cấu hình'))
  assert.equal(q('#absence-threshold').value, '40')
})

test('flag explains student, class, counted absences, threshold and hides when cleared', async () => {
  await mount(h(Badges, { flags: [flag], showStudent: true }))
  assert.match(q('.attendance-risk-flag').textContent, /Nguyễn An \(HV4\)/)
  assert.match(q('.attendance-risk-flag').textContent, /3\/10 buổi \(30%\).*Ngưỡng 20%/)
  await act(async () => root.render(h(Badges, { flags: [] })))
  assert.equal(q('.attendance-risk-flag'), null)
})
