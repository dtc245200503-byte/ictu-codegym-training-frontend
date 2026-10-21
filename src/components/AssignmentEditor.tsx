import { useEffect, useRef, useState } from 'react'
import { AssignmentError, assignmentTime, downloadAssignmentFile, publishAssignment, removeAssignmentFile, saveAssignment, uploadAssignmentFile, vietnamInputTime } from '../services/assignmentService'
import type { Assignment, AssignmentSession } from '../services/assignmentService'
import AssignmentDescription from './AssignmentDescription'

export default function AssignmentEditor({ saved, sessions, onSaved, onClose, onSessionExpired }: {
  saved?: Assignment; sessions: AssignmentSession[]; onSaved: (row: Assignment, message: string) => void; onClose: () => void; onSessionExpired: () => void
}) {
  const initial = { session: saved ? String(saved.session_id) : '', title: saved?.title || '', description: saved?.description || '',
    due: saved ? vietnamInputTime(saved.due_at) : '', points: saved?.max_points || '10' }
  const [form, setForm] = useState(initial), [pending, setPending] = useState(false), [error, setError] = useState(''), [stale, setStale] = useState(false)
  const busy = useRef(false), descriptionRef = useRef<HTMLTextAreaElement>(null)
  const readonly = !!saved && !saved.can_edit
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  const run = async (action: () => Promise<Assignment | void>, message: string) => {
    if (busy.current) return
    busy.current = true; setPending(true); setError('')
    try { const row = await action(); if (row) onSaved(row, message) }
    catch (failure: unknown) {
      if (failure instanceof AssignmentError) {
        if (failure.status === 401) onSessionExpired()
        if ([403, 404, 409].includes(failure.status)) setStale(true)
      }
      setError(failure instanceof Error && !(failure instanceof TypeError) ? failure.message : 'Không thể kết nối. Vui lòng thử lại.')
    } finally { busy.current = false; setPending(false) }
  }
  const save = () => {
    const session = sessions.find(item => String(item.session_id) === form.session)
    const due = Date.parse(form.due + '+07:00'), points = Number(form.points)
    if (!form.title.trim() || !form.description.trim() || !form.session || (!saved && !session)) { setError('Chọn môn/buổi học và nhập tiêu đề, mô tả.'); return }
    if (!Number.isFinite(due) || due <= Date.now()) { setError('Hạn nộp phải ở tương lai (giờ Việt Nam).'); return }
    if (!/^\d+(\.\d{1,2})?$/.test(form.points) || points <= 0 || points > 10000) { setError('Điểm tối đa phải lớn hơn 0, không quá 10000, tối đa hai chữ số thập phân.'); return }
    void run(() => saveAssignment({ class_subject_id: saved?.class_subject_id || session!.class_subject_id, session_id: Number(form.session),
      title: form.title.trim(), description: form.description.trim(), due_at: new Date(due).toISOString(), max_points: form.points }, saved), 'Đã lưu nháp. Bạn có thể thêm tệp rồi giao cho lớp.')
  }
  const format = (prefix: string, suffix = '') => {
    const input = descriptionRef.current
    if (!input) return
    const start = input.selectionStart, end = input.selectionEnd
    const value = form.description.slice(0, start) + prefix + (form.description.slice(start, end) || 'nội dung') + suffix + form.description.slice(end)
    setForm({ ...form, description: value })
    input.focus()
  }
  const close = () => { if (!pending && (!dirty || window.confirm('Bỏ các thay đổi chưa lưu?'))) onClose() }
  return <article className="assignment-editor" aria-labelledby="assignment-editor-title">
    <header><h2 id="assignment-editor-title">{saved ? saved.status === 'draft' ? 'Bản nháp bài tập' : 'Bài tập đã giao' : 'Soạn bài tập mới'}</h2><button type="button" disabled={pending} onClick={close}>Đóng</button></header>
    {error && <p role="alert" className="assignment-error">{error}</p>}
    {stale && <p>Hãy đóng và mở lại bài để tải phiên bản mới nhất. Nội dung đang nhập vẫn được giữ ở đây.</p>}
    {readonly ? <>
      <h3>{saved!.title}</h3><p>{saved!.class_name} · {saved!.subject_name} · {saved!.session_date} {saved!.session_time} · {saved!.topic}</p>
      <p>Hạn nộp: <strong>{assignmentTime(saved!.due_at)}</strong> (giờ Việt Nam) · Điểm tối đa: {saved!.max_points}</p>
      <AssignmentDescription value={saved!.description} />
    </> : <form onSubmit={event => { event.preventDefault(); save() }}>
      <fieldset disabled={pending || stale}>
        <label>Môn và buổi học<select aria-label="Môn và buổi học" required value={form.session} disabled={!!saved} onChange={event => setForm({ ...form, session: event.target.value })}>
          <option value="">Chọn lớp · môn · buổi học</option>
          {sessions.map(item => <option key={item.session_id} value={item.session_id}>{item.class_name} · {item.subject_name} · {item.session_date} {item.start_time} · {item.topic}</option>)}
          {saved && !sessions.some(item => item.session_id === saved.session_id) && <option value={saved.session_id}>{saved.class_name} · {saved.subject_name} · {saved.topic}</option>}
        </select></label>
        <label>Tiêu đề<input aria-label="Tiêu đề" required maxLength={200} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
        <label htmlFor="assignment-description">Mô tả có định dạng</label>
        <div className="assignment-toolbar" role="group" aria-label="Định dạng mô tả">
          <button type="button" onClick={() => format('**', '**')}><strong>Đậm</strong></button><button type="button" onClick={() => format('*', '*')}><em>Nghiêng</em></button>
          <button type="button" onClick={() => format('\n## ')}>Tiêu đề</button><button type="button" onClick={() => format('\n- ')}>Danh sách</button>
          <button type="button" onClick={() => format('[', '](https://example.com)')}>Liên kết</button>
        </div>
        <textarea ref={descriptionRef} id="assignment-description" required maxLength={20000} rows={7} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} />
        <details><summary>Xem trước mô tả</summary><AssignmentDescription value={form.description} /></details>
        <div className="assignment-fields"><label>Hạn nộp (giờ Việt Nam)<input aria-label="Hạn nộp (giờ Việt Nam)" type="datetime-local" required value={form.due} onChange={event => setForm({ ...form, due: event.target.value })} /></label>
          <label>Điểm tối đa<input aria-label="Điểm tối đa" type="number" min="0.01" max="10000" step="0.01" required value={form.points} onChange={event => setForm({ ...form, points: event.target.value })} /></label></div>
        <button type="submit" className="assignment-primary">{pending ? 'Đang xử lý…' : 'Lưu nháp'}</button>
      </fieldset>
    </form>}
    <section aria-label="Tệp đính kèm"><h3>Tệp đính kèm</h3>
      {!saved && <p>Lưu nháp trước để thêm tệp. Tối đa 5 tệp, mỗi tệp 10 MB, tổng 25 MB.</p>}
      {saved && <><ul className="assignment-files">{saved.attachments.map(file => <li key={file.attachment_id}>
        <button disabled={pending} onClick={() => void run(() => downloadAssignmentFile(saved, file), '')}>{file.filename} ({(file.size / 1024).toFixed(1)} KB)</button>
        {!readonly && <button disabled={pending || dirty || stale} aria-label={`Xoá ${file.filename}`} onClick={() => void run(() => removeAssignmentFile(saved, file.attachment_id), 'Đã xoá tệp.')}>Xoá</button>}
      </li>)}</ul>
        {!readonly && <label>Thêm tệp (tối đa 10 MB)<input type="file" aria-label="Thêm tệp" disabled={pending || dirty || stale || saved.attachments.length >= 5} onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''
          if (!file) return
          if (!file.size || file.size > 10 * 1024 * 1024) { setError('Tệp phải có nội dung và không quá 10 MB.'); return }
          void run(() => uploadAssignmentFile(saved, file), 'Đã thêm tệp đính kèm.')
        }} /></label>}
      </>}
    </section>
    {saved?.can_edit && <div className="assignment-publish"><p>{dirty ? 'Lưu các thay đổi trước khi thêm tệp hoặc giao bài.' : 'Giao bài sẽ thông báo cho toàn bộ học viên đang học trong lớp. Bài đã giao sẽ chuyển sang chỉ đọc.'}</p>
      <button type="button" className="assignment-primary" disabled={pending || dirty || stale} onClick={() => void run(() => publishAssignment(saved), 'Đã giao bài và gửi thông báo cho học viên.')}>Giao cho lớp</button></div>}
    {saved?.status === 'published' && <p>Đã giao lúc {assignmentTime(saved.published_at!)} · {saved.recipient_count} học viên nhận bài.</p>}
  </article>
}
