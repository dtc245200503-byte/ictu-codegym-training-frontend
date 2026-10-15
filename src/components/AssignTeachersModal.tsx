import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ChoiceSelect from './ChoiceSelect'
import { ClassPermissionError, ClassSessionError, getClassAssignments, saveBatchClassAssignments } from '../services/classService'
import type { BatchAssignmentItem, ClassAssignmentDetail } from '../services/classService'
import './AssignTeachersModal.css'

interface Props {
  classId: number
  onClose: () => void
  onSaved: () => void
  onSessionExpired: () => void
}

export default function AssignTeachersModal({ classId, onClose, onSaved, onSessionExpired }: Props) {
  const [detail, setDetail] = useState<ClassAssignmentDetail | null>(null)
  const [assignments, setAssignments] = useState<BatchAssignmentItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [reload, setReload] = useState(0)
  const panel = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('.choice-select-popup')) return
      if (event.key === 'Escape' && !pending.current) { event.preventDefault(); closeRef.current() }
      if (event.key !== 'Tab') return
      const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])]
        .filter(node => !node.classList.contains('choice-select-native'))
      if (!nodes.length) { event.preventDefault(); return }
      if (event.shiftKey && (document.activeElement === nodes[0] || document.activeElement === panel.current)) { event.preventDefault(); nodes.at(-1)?.focus() }
      if (!event.shiftKey && (document.activeElement === nodes.at(-1) || document.activeElement === panel.current)) { event.preventDefault(); nodes[0]?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keyboard); previousFocus?.focus() }
  }, [])

  useEffect(() => {
    let active = true
    getClassAssignments(classId).then(result => {
      if (!active) return
      setDetail(result)
      setAssignments(result.subjects.map(subject => ({ subject_id: subject.subject_id, instructor_id: subject.instructor_id ?? null, assistant_ids: subject.assistants.map(user => user.user_id) })))
    }).catch((reason: unknown) => {
      if (!active) return
      if (reason instanceof ClassSessionError) onSessionExpired()
      if (reason instanceof ClassPermissionError) setForbidden(true)
      setError(reason instanceof Error ? reason.message : 'Không thể tải phân công. Vui lòng thử lại.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // Parent re-renders must not erase unsaved assignments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, reload])

  const update = (subjectId: number, changes: Partial<BatchAssignmentItem>) => {
    setAssignments(previous => previous.map(item => item.subject_id === subjectId ? { ...item, ...changes } : item))
    setError('')
  }
  const valid = (item: BatchAssignmentItem) => !!detail?.available_instructors.some(user => user.user_id === item.instructor_id)
    && item.assistant_ids.every(id => id !== item.instructor_id && detail.available_assistants.some(user => user.user_id === id))
  const assignedCount = assignments.filter(valid).length

  const save = async () => {
    if (pending.current || !detail || !assignments.length || assignedCount !== assignments.length || forbidden) return
    pending.current = true
    setSaving(true); setError('')
    try {
      await saveBatchClassAssignments(classId, assignments)
      onSaved()
    } catch (reason) {
      if (reason instanceof ClassSessionError) onSessionExpired()
      if (reason instanceof ClassPermissionError) setForbidden(true)
      setError(reason instanceof Error ? reason.message : 'Không thể lưu phân công. Vui lòng thử lại.')
    } finally { pending.current = false; setSaving(false) }
  }

  return createPortal(<div className="assign-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !pending.current) onClose() }}>
    <div ref={panel} className="assign-modal" role="dialog" aria-modal="true" aria-labelledby="assign-title" tabIndex={-1}>
      <header className="assign-modal-header"><div><h2 id="assign-title">Phân công giảng dạy</h2><p>{detail?.class_name || 'Đang tải lớp học…'}</p></div><button type="button" className="assign-close-btn" aria-label="Đóng phân công" disabled={saving} onClick={onClose}>×</button></header>
      <div className="assign-modal-body" aria-busy={loading || saving}>
        {loading ? <p role="status">Đang tải môn học và danh sách giảng viên…</p> : detail && <>
          <div className="assign-summary-bar"><span className="assign-summary-item">Mỗi môn có một giảng viên chính và nhiều trợ giảng.</span><span className="assign-summary-item"><strong>{assignedCount}/{assignments.length}</strong> môn sẵn sàng</span></div>
          {!assignments.length && <p>Lớp chưa có môn học. Hãy thiết lập môn học của lớp trước khi phân công.</p>}
          {!!assignments.length && !detail.available_instructors.length && <p className="assign-conflict-warning">Chưa có tài khoản giảng viên đủ điều kiện. Vui lòng kiểm tra vai trò và trạng thái tài khoản.</p>}
          {detail.subjects.map(subject => {
            const item = assignments.find(value => value.subject_id === subject.subject_id)!
            const unavailable = item.instructor_id !== null && !detail.available_instructors.some(user => user.user_id === item.instructor_id)
            return <section key={subject.subject_id} className="assign-subject-card" aria-labelledby={`assign-subject-${subject.subject_id}`}>
              <div className="assign-subject-header"><div className="assign-subject-title"><span className="assign-subject-code">{subject.code}</span><h3 id={`assign-subject-${subject.subject_id}`} className="assign-subject-name">{subject.name}</h3></div><span className="assign-subject-meta">{subject.session_count} buổi</span></div>
              <div className="assign-fields-grid">
                <div className="assign-field-group"><label htmlFor={`assign-instructor-${subject.subject_id}`}>Giảng viên chính *</label>
                  <ChoiceSelect id={`assign-instructor-${subject.subject_id}`} value={unavailable ? '' : item.instructor_id ?? ''} disabled={saving || forbidden} onChange={event => {
                    const id = Number(event.target.value) || null
                    update(subject.subject_id, { instructor_id: id, assistant_ids: item.assistant_ids.filter(value => value !== id) })
                  }}><option value="">Chọn giảng viên chính</option>{detail.available_instructors.map(user => <option key={user.user_id} value={user.user_id}>{user.full_name} · {user.email}</option>)}</ChoiceSelect>
                  {unavailable && <small className="assign-invalid">{subject.instructor_name}: tài khoản không còn đủ điều kiện. Hãy chọn lại giảng viên.</small>}
                </div>
                <div className="assign-field-group"><label htmlFor={`assign-assistant-${subject.subject_id}`}>Trợ giảng</label>
                  <ChoiceSelect id={`assign-assistant-${subject.subject_id}`} value="" disabled={saving || forbidden} onChange={event => {
                    const id = Number(event.target.value)
                    if (id && !item.assistant_ids.includes(id)) update(subject.subject_id, { assistant_ids: [...item.assistant_ids, id] })
                  }}><option value="">Thêm trợ giảng</option>{detail.available_assistants.filter(user => user.user_id !== item.instructor_id && !item.assistant_ids.includes(user.user_id)).map(user => <option key={user.user_id} value={user.user_id}>{user.full_name} · {user.email}</option>)}</ChoiceSelect>
                  <div className="assign-assistant-tags">{item.assistant_ids.map(id => {
                    const candidate = detail.available_assistants.find(user => user.user_id === id)
                    const name = candidate?.full_name || subject.assistants.find(user => user.user_id === id)?.full_name || `Tài khoản #${id}`
                    return <span className="assign-tag" key={id}>{name}{!candidate && ' (không còn đủ điều kiện)'}<button type="button" className="assign-tag-remove" disabled={saving || forbidden} aria-label={`Gỡ trợ giảng ${name} khỏi ${subject.name}`} onClick={() => update(subject.subject_id, { assistant_ids: item.assistant_ids.filter(value => value !== id) })}>×</button></span>
                  })}{!item.assistant_ids.length && <span className="assign-tag-empty">Chưa chọn trợ giảng</span>}</div>
                </div>
              </div>
            </section>
          })}
        </>}
        {error && <p className="program-error" role="alert">{error}{!detail && !forbidden && <button type="button" onClick={() => { setLoading(true); setError(''); setReload(value => value + 1) }}>Thử lại</button>}</p>}
      </div>
      <footer className="assign-modal-footer"><button type="button" className="assign-btn-secondary" disabled={saving} onClick={onClose}>Hủy</button><button type="button" className="assign-btn-primary" disabled={loading || saving || forbidden || !assignments.length || assignedCount !== assignments.length} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu phân công'}</button></footer>
    </div>
  </div>, document.body)
}
