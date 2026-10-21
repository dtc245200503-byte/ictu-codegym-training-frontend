const assert = require('node:assert/strict')
const { test, afterEach, beforeEach } = require('node:test')
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
const service = source('services/assignmentService.ts')
const real = require(service)
let save, publish, upload, remove, options, list, detail, calls, saved, closed, expired, root
require.cache[service] = { id: service, filename: service, loaded: true, exports: {
  ...real, saveAssignment: (...args) => { calls.push(['save', ...args]); return save(...args) },
  publishAssignment: (...args) => { calls.push(['publish', ...args]); return publish(...args) },
  uploadAssignmentFile: (...args) => { calls.push(['upload', ...args]); return upload(...args) },
  removeAssignmentFile: (...args) => { calls.push(['remove', ...args]); return remove(...args) },
  downloadAssignmentFile: async (...args) => { calls.push(['download', ...args]) },
  assignmentOptions: () => options(), listAssignments: page => list(page), getAssignment: id => detail(id),
} }
const Editor = require(source('components/AssignmentEditor.tsx')).default
const Page = require(source('components/AssignmentsPage.tsx')).default
const Description = require(source('components/AssignmentDescription.tsx')).default
const session = { session_id: 1, class_subject_id: 2, class_id: 3, class_name: 'Python 01', subject_name: 'Python', session_date: '2026-10-16', start_time: '08:00', topic: 'Hàm' }
const row = (changes = {}) => ({ ...session, assignment_id: 10, session_time: '08:00', title: 'Bài Python', description: '**Yêu cầu**\n- Viết hàm', due_at: '2099-01-01T13:00:00Z', max_points: '10.00', status: 'draft', version: 1, can_edit: true, attachments: [], recipient_count: 0, created_at: '2026-10-16T03:00:00Z', published_at: null, ...changes })
const q = selector => document.querySelector(selector)
const all = selector => [...document.querySelectorAll(selector)]
const button = text => all('button').find(node => node.textContent === text)
beforeEach(() => {
  calls = []; saved = []; closed = expired = 0
  save = async () => row(); publish = async () => row({ status: 'published', can_edit: false, recipient_count: 4 })
  upload = remove = async () => row({ version: 2 })
  options = async () => ({ can_create: true, sessions: [session] })
  list = async () => ({ total: 1, items: [row()] }); detail = async () => row()
  window.confirm = () => true
})
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null })
async function mount(component) { root = createRoot(q('#root')); await act(async () => root.render(component)) }
async function editor(item) { await mount(h(Editor, { saved: item, sessions: [session], onSaved: (...args) => saved.push(args), onClose: () => closed++, onSessionExpired: () => expired++ })) }
async function click(node) { assert.ok(node); await act(async () => node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))) }
async function input(label, value) {
  const node = q(`[aria-label="${label}"]`) || q('#assignment-description')
  const proto = node.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value); node.dispatchEvent(new dom.window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })) })
}
async function submit() { await act(async () => q('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }

test('creates a draft bound to subject/session with Vietnamese deadline converted to UTC', async () => {
  await editor()
  assert.match(document.body.textContent, /Lưu nháp trước để thêm tệp/)
  await input('Môn và buổi học', '1'); await input('Tiêu đề', '  Bài mới  ')
  await input('Mô tả', '**Nội dung**'); await input('Hạn nộp (giờ Việt Nam)', '2099-01-01T20:00')
  await input('Điểm tối đa', '12.50'); await submit()
  assert.deepEqual(calls[0][1], { class_subject_id: 2, session_id: 1, title: 'Bài mới', description: '**Nội dung**', due_at: '2099-01-01T13:00:00.000Z', max_points: '12.50' })
  assert.equal(calls[0][2], undefined)
  assert.equal(saved.length, 1)
})

test('rejects past deadline and invalid points without sending requests', async () => {
  await editor(row())
  await input('Hạn nộp (giờ Việt Nam)', '2000-01-01T12:00'); await submit()
  assert.match(q('[role=alert]').textContent, /tương lai/)
  await input('Hạn nộp (giờ Việt Nam)', '2099-01-01T12:00')
  for (const value of ['0', '10.123', '10001']) { await input('Điểm tối đa', value); await submit(); assert.match(q('[role=alert]').textContent, /Điểm tối đa/) }
  assert.equal(calls.length, 0)
})

test('toolbar adds formatting and renderer never executes HTML or unsafe links', async () => {
  await editor()
  await input('Mô tả', 'Text')
  q('textarea').setSelectionRange(0, 4)
  await click(button('Đậm'))
  assert.equal(q('textarea').value, '**Text**')
  assert.equal(q('.assignment-description strong').textContent, 'Text')
  await input('Mô tả', '<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n[bad](javascript:alert(1))\n[good](https://example.com)\n## Heading\n- item\n*italic*')
  assert.equal(q('.assignment-description script'), null); assert.equal(q('.assignment-description img'), null)
  assert.equal(all('.assignment-description a').length, 1)
  assert.equal(q('.assignment-description a').href, 'https://example.com/')
  assert.equal(q('.assignment-description h3').textContent, 'Heading')
  assert.equal(q('.assignment-description li').textContent, 'item')
  assert.equal(q('.assignment-description em').textContent, 'italic')
})

test('dirty edits must be saved before adding files or publishing; cancelling preserves input', async () => {
  await editor(row())
  assert.equal(q('select').disabled, true)
  await input('Tiêu đề', 'Đã sửa')
  assert.equal(button('Giao cho lớp').disabled, true)
  assert.equal(q('input[type=file]').disabled, true)
  window.confirm = () => false; await click(button('Đóng')); assert.equal(closed, 0)
  assert.equal(q('[aria-label="Tiêu đề"]').value, 'Đã sửa')
  await submit(); assert.equal(calls[0][2].version, 1)
})

test('publishing pending blocks duplicate action, failed request retains draft and can retry', async () => {
  let reject
  publish = () => new Promise((resolve, fail) => { reject = fail })
  await editor(row()); await click(button('Giao cho lớp'))
  assert.equal(button('Giao cho lớp').disabled, true); assert.equal(button('Đóng').disabled, true)
  await click(button('Giao cho lớp')); assert.equal(calls.length, 1)
  await act(async () => reject(new TypeError('network')))
  assert.match(q('[role=alert]').textContent, /Không thể kết nối/)
  assert.equal(q('[aria-label="Tiêu đề"]').value, 'Bài Python')
  publish = async () => row({ status: 'published', can_edit: false })
  await click(button('Giao cho lớp')); assert.equal(saved.length, 1)
})

test('conflict or revoked permission locks changes without discarding text', async () => {
  save = async () => { throw new real.AssignmentError('Bản nháp đã thay đổi.', 409) }
  await editor(row()); await input('Tiêu đề', 'Giữ lại'); await submit()
  assert.equal(q('fieldset').disabled, true)
  assert.equal(q('[aria-label="Tiêu đề"]').value, 'Giữ lại')
  assert.match(q('[role=alert]').textContent, /thay đổi/)
})

test('uploads use current version; invalid file stays local and published student view is read-only', async () => {
  await editor(row())
  const inputNode = q('input[type=file]')
  const file = new window.File(['abc'], 'Bài.pdf', { type: 'application/pdf' })
  Object.defineProperty(inputNode, 'files', { configurable: true, value: [file] })
  await act(async () => inputNode.dispatchEvent(new window.Event('change', { bubbles: true })))
  assert.equal(calls[0][0], 'upload'); assert.equal(calls[0][1].version, 1); assert.equal(calls[0][2].name, 'Bài.pdf')
  await act(async () => root.unmount()); root = null
  await editor(row({ status: 'published', can_edit: false, published_at: '2026-10-16T03:00:00Z', attachments: [{ attachment_id: 1, filename: 'Bài.pdf', size: 3 }] }))
  assert.equal(q('form'), null); assert.equal(q('input[type=file]'), null); assert.equal(button('Giao cho lớp'), undefined)
  await click(all('button').find(node => node.textContent.includes('Bài.pdf')))
  assert.equal(calls.at(-1)[0], 'download')
})

test('page opens a draft and notification deep link, errors can retry without exposing stale content', async () => {
  await mount(h(MemoryRouter, { initialEntries: ['/assignments?assignment_id=10'] }, h(Page, { onSessionExpired: () => expired++ })))
  assert.equal(q('[aria-label="Tiêu đề"]').value, 'Bài Python')
  await click(button('Đóng')); assert.ok(button('Tạo bài tập'))
  detail = async () => { throw new real.AssignmentError('Không có quyền.', 404) }
  await click(button('Mở bản nháp')); assert.match(q('[role=alert]').textContent, /Không có quyền/)
  assert.equal(q('form'), null)
  detail = async () => row(); await click(button('Thử lại')); assert.ok(q('form'))
})

test('student list hides creation and opens assigned content only', async () => {
  options = async () => ({ can_create: false, sessions: [] })
  const published = row({ status: 'published', can_edit: false, published_at: '2026-10-16T03:00:00Z' })
  list = async () => ({ total: 1, items: [published] }); detail = async () => published
  await mount(h(MemoryRouter, {}, h(Page, { onSessionExpired: () => expired++ })))
  assert.equal(button('Tạo bài tập'), undefined)
  await click(button('Xem bài tập')); assert.ok(q('.assignment-description')); assert.equal(q('form'), null)
})

test('navigation requires current role and assignment view permission', () => {
  for (const role of ['INSTRUCTOR', 'TEACHER', 'STUDENT']) {
    assert.equal(real.canViewAssignments({ roles: [role], permissions: ['ASSIGNMENT_VIEW'] }), true)
    assert.equal(real.canViewAssignments({ roles: [role], permissions: [] }), false)
  }
  assert.equal(real.canViewAssignments({ roles: ['ADMIN'], permissions: ['ASSIGNMENT_VIEW'] }), false)
})
