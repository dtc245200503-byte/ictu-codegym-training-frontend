import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { changeStudentEnrollment, enrollmentActions, studentDate } from '../services/studentProfileService'
import type { Enrollment, EnrollmentAction, StudentClassOption, StudentProfile } from '../services/studentProfileService'

export default function EnrollmentChangeDialog({ student, enrollment, classes, onClose, onSaved, explain }: {
  student: StudentProfile; enrollment: Enrollment; classes: StudentClassOption[]
  onClose: () => void; onSaved: () => void; explain: (error: unknown) => string
}) {
  const [operation, setOperation] = useState<EnrollmentAction>('deferred')
  const [date, setDate] = useState(student.today)
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const panel = useRef<HTMLDivElement>(null)
  const destinations = classes.filter(item => item.class_id !== enrollment.class_id && ['planned', 'in_progress'].includes(item.status))
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLSelectElement>('select')?.focus()
    return () => { document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  const keyboard = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !saving.current) onClose()
    if (event.key !== 'Tab') return
    const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled)') || [])]
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
    if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
  }
  const save = async () => {
    if (saving.current) return
    if (!reason.trim() || reason.trim().length > 1000 || !date || (operation === 'transferred' && !target)) { setError('Chọn ngày hiệu lực, nhập lý do và chọn lớp đích nếu chuyển lớp.'); return }
    if (enrollment.started_on && date < enrollment.started_on) { setError('Ngày hiệu lực không được trước ngày bắt đầu học tại lớp.'); return }
    saving.current = true; setBusy(true); setError('')
    try {
      await changeStudentEnrollment(student.student_id, { class_id: enrollment.class_id, enrollment_id: enrollment.enrollment_id, operation, effective_date: date, reason: reason.trim(), ...(operation === 'transferred' ? { to_class_id: Number(target) } : {}) })
      onSaved()
    } catch (err) { setError(explain(err)) }
    finally { saving.current = false; setBusy(false) }
  }
  return createPortal(<div className="student-dialog-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !saving.current) onClose() }}>
    <div ref={panel} className="student-change-dialog" role="dialog" aria-modal="true" aria-labelledby="enrollment-change-title" onKeyDown={keyboard}>
      <header><h2 id="enrollment-change-title">Xử lý học tập</h2><button disabled={busy} aria-label="Đóng xử lý học tập" onClick={onClose}>×</button></header>
      <p><strong>{student.student_name}</strong> · {student.student_code}<br />Lớp hiện tại: <strong>{enrollment.class_name}</strong></p>
      <form onSubmit={event => { event.preventDefault(); void save() }} noValidate>
        <label htmlFor="enrollment-operation">Loại thao tác *</label><select id="enrollment-operation" disabled={busy} value={operation} onChange={event => setOperation(event.target.value as EnrollmentAction)}>{Object.entries(enrollmentActions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        {operation === 'transferred' && <><label htmlFor="enrollment-target">Lớp chuyển đến *</label><select id="enrollment-target" disabled={busy} required value={target} onChange={event => setTarget(event.target.value)}><option value="">Chọn lớp đích</option>{destinations.map(item => <option key={item.class_id} value={item.class_id}>{item.class_name}</option>)}</select>{!destinations.length && <p>Chưa có lớp đích phù hợp.</p>}</>}
        <label htmlFor="enrollment-date">Ngày hiệu lực *</label><input id="enrollment-date" type="date" required min={enrollment.started_on || undefined} disabled={busy} value={date} onChange={event => setDate(event.target.value)} />
        <label htmlFor="enrollment-reason">Lý do *</label><textarea id="enrollment-reason" required maxLength={1000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} placeholder="Nhập lý do cụ thể cho thao tác này" />
        <p className="student-impact">Từ {studentDate(date)}, học viên không còn trong danh sách cần điểm danh tại {enrollment.class_name}.{operation === 'transferred' && ' Học viên bắt đầu xuất hiện tại lớp đích từ ngày hiệu lực.'} Dữ liệu điểm và điểm danh ở lớp cũ được giữ nguyên. Thao tác được ghi vào lịch sử hồ sơ.</p>
        {error && <p className="student-error" role="alert">{error}</p>}
        <footer><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="student-primary" disabled={busy || !reason.trim() || !date || (operation === 'transferred' && !target)}>{busy ? 'Đang lưu…' : 'Xác nhận ' + enrollmentActions[operation].toLocaleLowerCase('vi')}</button></footer>
      </form>
    </div>
  </div>, document.body)
}
