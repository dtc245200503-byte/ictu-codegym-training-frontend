import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { updateStudentProfile, StudentProfileError, type StudentProfile } from '../services/studentProfileService'
import './StudentProfileEditor.css'

export default function StudentProfileEditor({ student, explain, onClose, onSaved }: { student: StudentProfile; explain: (error: unknown) => string; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const saving = useRef(false)
  const [busy, setBusy] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ full_name: student.student_name, email: student.email || '', phone: student.phone || '', date_of_birth: student.date_of_birth || '', address: student.address || '', entry_level: student.entry_level || '', notes: student.notes || '' })
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close() }, [])
  const save = async () => {
    if (saving.current || stale) return
    if (!draft.full_name.trim() || !draft.email.trim()) { setError('Vui lòng nhập họ tên và email.'); return }
    if (draft.date_of_birth && (draft.date_of_birth < '1000-01-01' || draft.date_of_birth > student.today)) { setError('Ngày sinh không hợp lệ hoặc ở tương lai.'); return }
    saving.current = true; setBusy(true); setError('')
    try {
      await updateStudentProfile(student.student_id, { ...draft, full_name: draft.full_name.trim(), email: draft.email.trim(), phone: draft.phone.trim() || null, date_of_birth: draft.date_of_birth || null, address: draft.address.trim() || null, entry_level: draft.entry_level.trim() || null, notes: draft.notes.trim() || null, expected_token: student.profile_token! })
      onSaved()
    } catch (err) { setError(explain(err)); if (err instanceof StudentProfileError && err.status === 412) setStale(true) }
    finally { saving.current = false; setBusy(false) }
  }
  const update = (field: keyof typeof draft, value: string) => setDraft(previous => ({ ...previous, [field]: value }))
  return createPortal(<dialog ref={dialog} className="student-profile-editor" aria-labelledby="student-edit-title" onCancel={event => { event.preventDefault(); if (!saving.current) onClose() }}>
    <header><h2 id="student-edit-title">Sửa hồ sơ học viên</h2><button disabled={busy} onClick={onClose} aria-label="Đóng sửa hồ sơ">×</button></header>
    <p>Mã học viên: <strong>{student.student_code}</strong></p>
    <form onSubmit={event => { event.preventDefault(); void save() }}>
      <fieldset disabled={busy}><legend>Thông tin cá nhân và đầu vào</legend>
        <label>Họ và tên *<input autoFocus required maxLength={100} value={draft.full_name} onChange={event => update('full_name', event.target.value)} /></label>
        <label>Email *<input type="email" required maxLength={100} value={draft.email} onChange={event => update('email', event.target.value)} /></label>
        <label>Số điện thoại<input type="tel" maxLength={20} value={draft.phone} placeholder="0912345678 hoặc +84912345678" onChange={event => update('phone', event.target.value)} /></label>
        <label>Ngày sinh<input type="date" min="1000-01-01" max={student.today} value={draft.date_of_birth} onChange={event => update('date_of_birth', event.target.value)} /></label>
        <label className="student-edit-wide">Địa chỉ<input maxLength={255} value={draft.address} onChange={event => update('address', event.target.value)} /></label>
        <label className="student-edit-wide">Trình độ đầu vào<input maxLength={200} value={draft.entry_level} placeholder="Ví dụ: A2, chưa có kiến thức lập trình…" onChange={event => update('entry_level', event.target.value)} /></label>
        <label className="student-edit-wide">Ghi chú<textarea maxLength={5000} rows={5} value={draft.notes} onChange={event => update('notes', event.target.value)} /><small>{draft.notes.length}/5.000 ký tự</small></label>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>{stale ? 'Đóng để tải lại hồ sơ' : 'Hủy'}</button><button type="submit" disabled={busy || stale || !student.profile_token}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></footer>
    </form>
  </dialog>, document.body)
}
