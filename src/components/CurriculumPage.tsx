import ChoiceSelect from './ChoiceSelect'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, PointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import ErrorPage from './ErrorPage'
import { addProgramSubject, getAvailableSubjects, getLearningPath, getProgram, ProgramPermissionError, ProgramSessionError, removeProgramSubject, reorderLearningPath, setPrerequisite } from '../services/trainingProgramService'
import type { AvailableSubject, CurriculumItem, TrainingProgram } from '../services/trainingProgramService'
import './TrainingProgramPage.css'
import './CurriculumPage.css'

interface Props { onSessionExpired: () => void }
export default function CurriculumPage({ onSessionExpired }: Props) {
  const { curriculumId } = useParams()
  const id = Number(curriculumId)
  const validId = Number.isSafeInteger(id) && id > 0
  const [program, setProgram] = useState<TrainingProgram | null>(null)
  const [items, setItems] = useState<CurriculumItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [available, setAvailable] = useState<AvailableSubject[]>([])
  const [optionTotal, setOptionTotal] = useState(0)
  const [optionLoading, setOptionLoading] = useState(true)
  const [optionError, setOptionError] = useState('')
  const [optionReload, setOptionReload] = useState(0)
  const [subjectId, setSubjectId] = useState('')
  const [addPrerequisite, setAddPrerequisite] = useState('')
  const [removing, setRemoving] = useState<CurriculumItem | null>(null)
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const drag = useRef<{ id: number; startY: number; target: number; moved: boolean } | null>(null)
  const removeTrigger = useRef<HTMLElement | null>(null)

  const explain = (err: unknown) => {
    if (err instanceof ProgramSessionError) onSessionExpired()
    if (err instanceof ProgramPermissionError) setForbidden(true)
    return err instanceof Error && !(err instanceof TypeError) ? err.message : 'Không thể kết nối đến hệ thống. Vui lòng thử lại.'
  }

  useEffect(() => {
    if (!validId) return
    let active = true
    setLoading(true); setError(''); setProgram(null); setRemoving(null); setSuccess('')
    Promise.all([getProgram(id), getLearningPath(id)]).then(([info, subjects]) => {
      if (active) { setProgram(info); setItems(subjects) }
    }).catch((err: unknown) => { if (active) setError(explain(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reload])

  useEffect(() => {
    if (!validId) return
    let active = true
    setOptionLoading(true); setOptionError('')
    const timer = window.setTimeout(() => {
      getAvailableSubjects(id, search, page).then(result => {
        if (!active) return
        const last = Math.max(1, Math.ceil(result.total / 20))
        if (page > last) { setPage(last); return }
        setAvailable(result.items); setOptionTotal(result.total)
      }).catch((err: unknown) => { if (active) setOptionError(explain(err)) })
        .finally(() => { if (active) setOptionLoading(false) })
    }, 200)
    return () => { active = false; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, search, page, optionReload])

  const mutate = async (operation: () => Promise<unknown>, message: string, optimistic?: CurriculumItem[]) => {
    if (busy) return
    const before = items
    setBusy(true); setError(''); setSuccess('')
    if (optimistic) setItems(optimistic)
    try {
      await operation()
      setItems(await getLearningPath(id)); setSuccess(message)
      setRemoving(null); removeTrigger.current?.focus(); setSubjectId(''); setAddPrerequisite('')
      setOptionReload(value => value + 1)
    } catch (err) {
      setItems(before); setError(explain(err))
      try { setItems(await getLearningPath(id)); setOptionReload(value => value + 1) } catch { /* Keep last known order for retry. */ }
    } finally { setBusy(false) }
  }

  const move = (subject: number, target: number) => {
    if (busy) return
    const from = items.findIndex(item => item.subject_id === subject)
    const to = items.findIndex(item => item.subject_id === target)
    if (from < 0 || to < 0 || from === to) return
    const next = [...items]
    next.splice(to, 0, next.splice(from, 1)[0])
    const positions = new Map(next.map((item, index) => [item.subject_id, index]))
    if (next.some(item => item.prerequisite_subject_id !== null && (positions.get(item.prerequisite_subject_id) ?? Infinity) >= positions.get(item.subject_id)!)) {
      setSuccess(''); setError('Không thể chuyển môn phụ thuộc lên trước môn tiên quyết. Hãy cập nhật môn tiên quyết trước khi đổi thứ tự.'); return
    }
    void mutate(() => reorderLearningPath(id, next), 'Đã lưu thứ tự học.', next.map((item, index) => ({ ...item, sequence_order: index + 1 })))
  }

  const pointerDown = (event: PointerEvent<HTMLButtonElement>, subject: number) => {
    if (busy || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { id: subject, target: subject, startY: event.clientY, moved: false }
    setDraggedId(subject); setOverId(subject)
  }
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    if (Math.abs(event.clientY - drag.current.startY) > 6) drag.current.moved = true
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-route-subject]')
    if (element && items.some(item => item.subject_id === Number(element.dataset.routeSubject))) {
      drag.current.target = Number(element.dataset.routeSubject); setOverId(drag.current.target)
    }
    const panel = event.currentTarget.closest('.curriculum-list')
    if (panel) {
      const bounds = panel.getBoundingClientRect()
      if (event.clientY > bounds.bottom - 45) panel.scrollBy(0, 16)
      if (event.clientY < bounds.top + 45) panel.scrollBy(0, -16)
    }
  }
  const pointerEnd = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const current = drag.current
    drag.current = null; setDraggedId(null); setOverId(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (current?.moved && !cancelled) move(current.id, current.target)
  }
  const add = (event: FormEvent) => {
    event.preventDefault()
    if (!subjectId || !available.some(subject => String(subject.subject_id) === subjectId)) { setError('Vui lòng chọn môn học cần thêm.'); return }
    void mutate(() => addProgramSubject(id, Number(subjectId), addPrerequisite ? Number(addPrerequisite) : null), 'Đã thêm môn vào lộ trình.')
  }
  const closeRemoval = () => { if (!busy) { setRemoving(null); removeTrigger.current?.focus() } }

  if (!validId) return <ErrorPage statusCode={404} title="Không tìm thấy chương trình" message="Mã chương trình trong đường dẫn không hợp lệ." />
  if (forbidden) return <ErrorPage statusCode={403} title="Không có quyền truy cập" message="Bạn không có quyền quản lý lộ trình đào tạo." />
  if (loading) return <p role="status">Đang tải lộ trình đào tạo...</p>
  if (!program) return <section className="program-page"><Link to="/courses">← Chương trình đào tạo</Link><p className="program-error" role="alert">{error || 'Không tìm thấy chương trình đào tạo.'}</p><button onClick={() => setReload(value => value + 1)}>Thử lại</button></section>

  return <section className="program-page curriculum-page" aria-labelledby="curriculum-title">
    <Link className="curriculum-back" to="/courses">← Chương trình đào tạo</Link>
    <div className="program-header"><div><h1 id="curriculum-title">Lộ trình đào tạo</h1><p><strong>{program.code}</strong> — {program.name}</p></div><span className={`program-badge ${program.status}`}>{program.status === 'active' ? 'Đang áp dụng' : 'Ngừng áp dụng'}</span></div>
    {error && <p className="program-error" role="alert">{error}</p>}
    {success && <p className="program-success" role="status">{success}</p>}
    <p className="curriculum-help">Kéo thả nút ⋮⋮ để đổi thứ tự; thay đổi được lưu ngay. Bạn cũng có thể dùng nút lên/xuống. Môn tiên quyết phải đứng trước môn phụ thuộc.</p>
    <div className="curriculum-grid">
      <div className="curriculum-path" aria-busy={busy}><div className="curriculum-summary"><h2>Thứ tự học</h2><span>{items.length} môn · {items.reduce((sum, item) => sum + item.session_count, 0)} buổi</span></div>
        {busy && <p className="curriculum-saving" role="status">Đang lưu lộ trình...</p>}
        {items.length === 0 ? <p className="curriculum-empty">Chưa có môn học trong chương trình. Chọn môn trong danh mục để bắt đầu xây dựng lộ trình.</p> : <ol className="curriculum-list">{items.map((item, index) => {
          const dependents = items.filter(candidate => candidate.prerequisite_subject_id === item.subject_id)
          const earlier = items.slice(0, index)
          return <li key={item.subject_id} data-route-subject={item.subject_id} className={`curriculum-card ${draggedId === item.subject_id ? 'dragging' : ''} ${overId === item.subject_id ? 'drop-target' : ''}`}>
            <div className="curriculum-card-heading"><button className="curriculum-drag" aria-label={`Kéo để đổi thứ tự môn ${item.subject_name}`} title="Kéo thả để đổi thứ tự" disabled={busy} onPointerDown={event => pointerDown(event, item.subject_id)} onPointerMove={pointerMove} onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)} onKeyDown={event => { if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); move(item.subject_id, items[index - 1].subject_id) } if (event.key === 'ArrowDown' && index < items.length - 1) { event.preventDefault(); move(item.subject_id, items[index + 1].subject_id) } }}>⋮⋮</button>
              <span className="curriculum-position">{index + 1}</span><div><strong className="curriculum-subject-name">{item.subject_name}</strong><small>{item.subject_code} · {item.session_count} buổi · Trọng số {Number(item.weight).toLocaleString('vi-VN')}</small></div><button className="curriculum-remove program-delete" disabled={busy || dependents.length > 0} onClick={event => { removeTrigger.current = event.currentTarget; setRemoving(item); setError('') }}>Gỡ môn</button></div>
            {item.learning_outcomes && <p className="curriculum-outcomes">{item.learning_outcomes}</p>}
            <label htmlFor={`prerequisite-${item.subject_id}`}>Môn tiên quyết</label><ChoiceSelect id={`prerequisite-${item.subject_id}`} className="curriculum-prerequisite" disabled={busy} value={item.prerequisite_subject_id ?? ''} onChange={event => void mutate(() => setPrerequisite(id, item.subject_id, event.target.value ? Number(event.target.value) : null), 'Đã lưu môn tiên quyết.')}>
              <option value="">Không có môn tiên quyết</option>{earlier.map(prereq => <option key={prereq.subject_id} value={prereq.subject_id}>{prereq.subject_code} — {prereq.subject_name}</option>)}
              {item.prerequisite_subject_id !== null && !earlier.some(prereq => prereq.subject_id === item.prerequisite_subject_id) && <option value={item.prerequisite_subject_id}>Tiên quyết chưa đứng trước môn này — cần cập nhật</option>}
            </ChoiceSelect>
            <div className="curriculum-card-actions"><button className="curriculum-up" disabled={busy || index === 0} aria-label={`Đưa môn ${item.subject_name} lên`} onClick={() => move(item.subject_id, items[index - 1].subject_id)}>↑ Lên</button><button className="curriculum-down" disabled={busy || index === items.length - 1} aria-label={`Đưa môn ${item.subject_name} xuống`} onClick={() => move(item.subject_id, items[index + 1].subject_id)}>↓ Xuống</button></div>
            {dependents.length > 0 && <small className="curriculum-dependent-note">Đang là tiên quyết của: {dependents.map(dependent => dependent.subject_name).join(', ')}. Cập nhật các môn này trước khi gỡ.</small>}
          </li>
        })}</ol>}
      </div>
      <aside className="curriculum-add"><h2>Thêm môn học</h2><p>Tìm và chọn một môn trong danh mục, kiểm tra môn tiên quyết rồi thêm vào lộ trình. Môn đã thêm sẽ không xuất hiện trong danh sách này.</p>
        <form onSubmit={add}><fieldset disabled={busy}>
          <label htmlFor="route-search">Tìm môn trong danh mục</label><input id="route-search" maxLength={100} placeholder="Nhập mã hoặc tên môn" value={search} onChange={event => { setSearch(event.target.value); setPage(1); setSubjectId('') }} />
          <fieldset className="curriculum-subject-options" disabled={optionLoading || !!optionError}><legend>Môn học có thể thêm</legend>
            {optionLoading ? <p role="status">Đang tải môn học...</p> : !optionError && available.map(subject => <label key={subject.subject_id} className={subjectId === String(subject.subject_id) ? 'selected' : ''}>
              <input type="radio" name="route-subject" value={subject.subject_id} checked={subjectId === String(subject.subject_id)} onChange={event => setSubjectId(event.target.value)} />
              <span><strong>{subject.code} — {subject.name}</strong><small>{subject.session_count} buổi</small></span>
            </label>)}
          </fieldset>
          {optionError && <p className="program-error" role="alert">{optionError} <button type="button" onClick={() => setOptionReload(value => value + 1)}>Thử lại</button></p>}
          {!optionLoading && !optionError && available.length === 0 && <p>Chưa có môn phù hợp để thêm. Có thể môn đã nằm trong lộ trình hoặc chưa được khai báo trong danh mục.</p>}
          <div className="curriculum-option-pages"><small>{optionTotal} môn có thể thêm · Trang {page}/{Math.max(1, Math.ceil(optionTotal / 20))}</small><div><button type="button" disabled={optionLoading || page <= 1} onClick={() => { setPage(page - 1); setSubjectId('') }}>Trước</button><button type="button" disabled={optionLoading || page >= Math.ceil(optionTotal / 20)} onClick={() => { setPage(page + 1); setSubjectId('') }}>Sau</button></div></div>
          <label htmlFor="route-add-prerequisite">Môn tiên quyết</label><ChoiceSelect id="route-add-prerequisite" value={addPrerequisite} onChange={event => setAddPrerequisite(event.target.value)}><option value="">Không có môn tiên quyết</option>{items.map(item => <option key={item.subject_id} value={item.subject_id}>{item.subject_code} — {item.subject_name}</option>)}</ChoiceSelect>
          {subjectId && !optionLoading && !optionError && <p className="curriculum-selection" role="status">Đã chọn: <strong>{available.find(subject => String(subject.subject_id) === subjectId)?.name}</strong><br />Vị trí sau khi thêm: môn thứ {items.length + 1}. {addPrerequisite ? 'Học sau ' + items.find(item => String(item.subject_id) === addPrerequisite)?.subject_name + '.' : 'Không yêu cầu môn tiên quyết.'}</p>}
          <button className="program-primary curriculum-add-button" type="submit" disabled={!subjectId || optionLoading || !!optionError}>Thêm vào cuối lộ trình</button>
        </fieldset></form></aside>
    </div>
    {removing && <div className="program-overlay"><div className="program-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-subject-title" onKeyDown={event => { if (event.key === 'Escape') closeRemoval(); if (event.key === 'Tab') { const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() } if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() } } }}>
      <h2 id="remove-subject-title">Gỡ môn khỏi chương trình</h2><p><strong>{removing.subject_code} — {removing.subject_name}</strong></p><p>Môn vẫn được giữ trong danh mục để dùng cho chương trình khác. Lịch sử các lớp đã học được giữ nguyên.</p>
      {error && <p className="program-error" role="alert">{error}</p>}<div className="program-dialog-actions"><button autoFocus className="program-secondary" disabled={busy} onClick={closeRemoval}>Hủy</button><button className="program-primary curriculum-confirm-remove" disabled={busy} onClick={() => void mutate(() => removeProgramSubject(id, removing.subject_id), 'Đã gỡ môn khỏi chương trình.')}>{busy ? 'Đang gỡ...' : 'Xác nhận gỡ môn'}</button></div>
    </div></div>}
  </section>
}
