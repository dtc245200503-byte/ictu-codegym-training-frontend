import ChoiceSelect from './ChoiceSelect'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import ErrorPage from './ErrorPage'
import { cloneSubjectLessons, deleteSubjectLesson, getSubjectLessons, listSubjects, saveSubjectLesson, SubjectPermissionError, SubjectSessionError } from '../services/subjectService'
import type { Subject, SubjectLesson, SubjectLessons } from '../services/subjectService'
import './TrainingProgramPage.css'
import './SubjectLessonsPage.css'

interface Props { onSessionExpired: () => void }
interface LessonForm { sequence_order: string; topic: string; objectives: string }
export default function SubjectLessonsPage({ onSessionExpired }: Props) {
  const { subjectId } = useParams()
  const id = Number(subjectId)
  const validId = Number.isSafeInteger(id) && id > 0
  const [data, setData] = useState<SubjectLessons | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lessonFilter, setLessonFilter] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<'form' | 'delete' | 'clone' | null>(null)
  const [selected, setSelected] = useState<SubjectLesson | null>(null)
  const [form, setForm] = useState<LessonForm>({ sequence_order: '1', topic: '', objectives: '' })
  const [dialogError, setDialogError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sources, setSources] = useState<Subject[]>([])
  const [sourceTotal, setSourceTotal] = useState(0)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [optionReload, setOptionReload] = useState(0)
  const [sourceId, setSourceId] = useState('')
  const [preview, setPreview] = useState<SubjectLessons | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const trigger = useRef<HTMLElement | null>(null)
  const modal = useRef<HTMLDivElement | null>(null)

  const explain = (err: unknown) => {
    if (err instanceof SubjectSessionError) onSessionExpired()
    if (err instanceof SubjectPermissionError) setForbidden(true)
    return err instanceof Error && !(err instanceof TypeError) ? err.message : 'Không thể kết nối đến hệ thống. Vui lòng thử lại.'
  }
  useEffect(() => {
    if (!validId) return
    let active = true
    setLoading(true); setError(''); setData(null); setSuccess(''); setDialog(null); setLessonFilter('')
    getSubjectLessons(id).then(result => { if (active) setData(result) })
      .catch((err: unknown) => { if (active) setError(explain(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reload])
  useEffect(() => {
    if (dialog) modal.current?.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
  }, [dialog])
  useEffect(() => {
    if (dialog !== 'clone') return
    let active = true
    setOptionsLoading(true); setOptionsError('')
    const timer = window.setTimeout(() => {
      listSubjects(search, page).then(result => {
        if (!active) return
        const last = Math.max(1, Math.ceil(result.total / 20))
        if (page > last) { setPage(last); return }
        setSources(result.items.filter(subject => subject.subject_id !== id)); setSourceTotal(result.total)
      }).catch((err: unknown) => { if (active) setOptionsError(explain(err)) })
        .finally(() => { if (active) setOptionsLoading(false) })
    }, 200)
    return () => { active = false; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, search, page, id, optionReload])
  useEffect(() => {
    setPreview(null)
    if (dialog !== 'clone' || !sourceId) { setPreviewLoading(false); return }
    let active = true
    setPreviewLoading(true); setDialogError('')
    getSubjectLessons(Number(sourceId)).then(result => { if (active) setPreview(result) })
      .catch((err: unknown) => { if (active) setDialogError(explain(err)) })
      .finally(() => { if (active) setPreviewLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, dialog])

  const close = () => { if (!busy) { setDialog(null); setDialogError(''); trigger.current?.focus() } }
  const open = (type: 'form' | 'delete' | 'clone', button: HTMLElement, lesson?: SubjectLesson) => {
    trigger.current = button; setSelected(lesson || null); setDialogError(''); setSuccess('')
    const taken = new Set(data?.items.map(item => item.sequence_order))
    let next = 1
    while (taken.has(next)) next++
    setForm(lesson ? { sequence_order: String(lesson.sequence_order), topic: lesson.topic, objectives: lesson.objectives } : { sequence_order: String(next), topic: '', objectives: '' })
    setSearch(''); setPage(1); setSourceId(''); setPreview(null); setMode('append'); setDialog(type)
  }
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { close(); return }
    if (event.key !== 'Tab') return
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled):not([aria-hidden="true"])')]
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
    if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !data) return
    const lesson = { sequence_order: Number(form.sequence_order), topic: form.topic.trim(), objectives: form.objectives.trim() }
    if (dialog === 'form') {
      if (!/^\d+$/.test(form.sequence_order) || lesson.sequence_order < 1 || lesson.sequence_order > data.session_count) { setDialogError(`Số thứ tự phải là số nguyên từ 1 đến ${data.session_count}.`); return }
      if (data.items.some(item => item.lesson_id !== selected?.lesson_id && item.sequence_order === lesson.sequence_order)) { setDialogError('Số thứ tự buổi học đã tồn tại trong môn.'); return }
      if (!lesson.topic || lesson.topic.length > 255) { setDialogError('Vui lòng nhập chủ đề, tối đa 255 ký tự.'); return }
      if (!lesson.objectives || lesson.objectives.length > 5000) { setDialogError('Vui lòng nhập mục tiêu, tối đa 5.000 ký tự.'); return }
    }
    if (dialog === 'clone' && (!preview || previewLoading || !preview.items.length || optionsLoading || optionsError)) return
    setBusy(true); setDialogError('')
    try {
      if (dialog === 'form') await saveSubjectLesson(id, lesson, selected?.lesson_id)
      else if (dialog === 'delete' && selected) await deleteSubjectLesson(id, selected.lesson_id)
      else if (dialog === 'clone') await cloneSubjectLessons(id, Number(sourceId), mode)
      setData(await getSubjectLessons(id))
      if (dialog === 'delete' || dialog === 'clone') setLessonFilter('')
      setSuccess(dialog === 'clone' ? 'Đã nhân bản danh sách buổi học.' : dialog === 'delete' ? 'Đã gỡ buổi học.' : selected ? 'Đã cập nhật buổi học.' : 'Đã thêm buổi học.')
      setDialog(null); trigger.current?.focus()
    } catch (err) {
      setDialogError(explain(err))
      try { setData(await getSubjectLessons(id)) } catch { /* Keep entered values for retry. */ }
    } finally { setBusy(false) }
  }

  if (!validId) return <ErrorPage statusCode={404} title="Không tìm thấy môn học" message="Mã môn trong đường dẫn không hợp lệ." />
  if (forbidden) return <ErrorPage statusCode={403} title="Không có quyền truy cập" message="Bạn không có quyền quản lý buổi học trong môn." />
  if (loading) return <p role="status">Đang tải buổi học...</p>
  if (!data) return <section className="program-page"><Link to="/subjects">← Danh mục môn học</Link><p className="program-error" role="alert">{error || 'Không tìm thấy môn học.'}</p><button onClick={() => setReload(value => value + 1)}>Thử lại</button></section>
  const start = mode === 'append' ? Math.max(0, ...data.items.map(item => item.sequence_order)) : 0
  const cloneTooLarge = !!preview && start + preview.items.length > data.session_count
  const full = data.items.length >= data.session_count
  return <section className="program-page lesson-page" aria-labelledby="lesson-title">
    <Link className="lesson-back" to="/subjects">← Danh mục môn học</Link>
    <div className="program-header"><div><h1 id="lesson-title">Buổi học trong môn</h1><p><strong>{data.code}</strong> — {data.name}</p></div><div className="lesson-header-actions"><button className="program-secondary" onClick={event => open('clone', event.currentTarget)}>Nhân bản từ môn khác</button><button className="program-primary lesson-add" disabled={full} onClick={event => open('form', event.currentTarget)}>Thêm buổi học</button></div></div>
    <p className="lesson-capacity">Đã khai báo <strong>{data.items.length}/{data.session_count}</strong> buổi. Số thứ tự từ 1 đến {data.session_count}, không trùng trong cùng môn.</p>
    {full && <p className="lesson-note">Môn đã khai báo đủ số buổi. Có thể sửa các buổi hiện có hoặc tăng số buổi tại danh mục môn học.</p>}
    {success && <p className="program-success" role="status">{success}</p>}
    <div className="lesson-filter"><label htmlFor="lesson-filter">Chọn buổi học</label><ChoiceSelect id="lesson-filter" value={lessonFilter} onChange={event => setLessonFilter(event.target.value)}><option value="">Tất cả buổi học ({data.items.length})</option>{data.items.map(item => <option key={item.lesson_id} value={item.lesson_id}>Buổi {item.sequence_order} — {item.topic}</option>)}</ChoiceSelect></div>
    <ol className="lesson-list">{data.items.length ? data.items.filter(item => !lessonFilter || String(item.lesson_id) === lessonFilter).map(item => <li key={item.lesson_id} data-lesson-id={item.lesson_id} className="lesson-card"><div className="lesson-card-heading"><span className="lesson-number">Buổi {item.sequence_order}</span><h2>{item.topic}</h2></div><h3>Mục tiêu</h3><p className="lesson-objectives">{item.objectives}</p><div className="program-row-actions"><button className="lesson-edit" onClick={event => open('form', event.currentTarget, item)}>Sửa buổi</button><button className="program-delete lesson-delete" onClick={event => open('delete', event.currentTarget, item)}>Gỡ buổi</button></div></li>) : <li className="lesson-empty">Chưa khai báo buổi học. Thêm buổi mới hoặc nhân bản danh sách từ môn khác.</li>}</ol>
    {dialog && <div className="program-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><div ref={modal} className="program-dialog lesson-dialog" role="dialog" aria-modal="true" aria-labelledby="lesson-dialog-title" onKeyDown={keyboard}>
      <div className="program-dialog-header"><h2 id="lesson-dialog-title">{dialog === 'form' ? selected ? 'Sửa buổi học' : 'Thêm buổi học' : dialog === 'clone' ? 'Nhân bản buổi học' : 'Gỡ buổi học'}</h2><button disabled={busy} aria-label="Đóng hộp thoại" onClick={close}>×</button></div>
      <form onSubmit={submit} noValidate><fieldset disabled={busy} className="lesson-form">
        {dialog === 'form' ? <><label htmlFor="lesson-order">Số thứ tự *</label><ChoiceSelect id="lesson-order" data-initial-focus value={form.sequence_order} onChange={event => setForm({ ...form, sequence_order: event.target.value })}>{Array.from({ length: data.session_count }, (_, index) => index + 1).filter(order => !data.items.some(item => item.lesson_id !== selected?.lesson_id && item.sequence_order === order)).map(order => <option key={order} value={order}>Buổi {order}</option>)}</ChoiceSelect><label htmlFor="lesson-topic">Chủ đề *</label><input id="lesson-topic" maxLength={255} value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })} /><label htmlFor="lesson-objectives">Mục tiêu *</label><textarea id="lesson-objectives" maxLength={5000} rows={5} value={form.objectives} onChange={event => setForm({ ...form, objectives: event.target.value })} /></> : dialog === 'delete' ? <><p><strong>Buổi {selected?.sequence_order} — {selected?.topic}</strong></p><p>Gỡ buổi này khỏi môn học? Các buổi khác giữ nguyên số thứ tự.</p></> : <>
          <label htmlFor="lesson-source-search">Tìm môn nguồn</label><input id="lesson-source-search" data-initial-focus maxLength={100} placeholder="Nhập mã hoặc tên môn" value={search} onChange={event => { setSearch(event.target.value); setPage(1); setSourceId('') }} />
          <label htmlFor="lesson-source">Môn nguồn</label><ChoiceSelect id="lesson-source" disabled={optionsLoading || !!optionsError} value={sourceId} onChange={event => setSourceId(event.target.value)}><option value="">{optionsLoading ? 'Đang tải môn học...' : 'Chọn môn khác để nhân bản'}</option>{sources.map(subject => <option key={subject.subject_id} value={subject.subject_id}>{subject.code} — {subject.name}</option>)}</ChoiceSelect>
          {optionsError && <p className="program-error" role="alert">{optionsError} <button type="button" onClick={() => setOptionReload(value => value + 1)}>Thử lại</button></p>}
          {!optionsLoading && !optionsError && !sources.length && <p>Chưa có môn khác phù hợp. Thử tìm kiếm khác hoặc chuyển trang.</p>}
          <div className="lesson-source-pages"><span>Trang {page}/{Math.max(1, Math.ceil(sourceTotal / 20))}</span><button type="button" disabled={optionsLoading || page <= 1} onClick={() => { setPage(page - 1); setSourceId('') }}>Trước</button><button type="button" disabled={optionsLoading || page >= Math.ceil(sourceTotal / 20)} onClick={() => { setPage(page + 1); setSourceId('') }}>Sau</button></div>
          <label htmlFor="lesson-clone-mode">Cách nhân bản</label><ChoiceSelect id="lesson-clone-mode" value={mode} onChange={event => setMode(event.target.value as 'append' | 'replace')}><option value="append">Thêm vào cuối, giữ buổi hiện có</option><option value="replace">Thay thế toàn bộ danh sách hiện tại</option></ChoiceSelect>
          {previewLoading && <p role="status">Đang tải buổi học của môn nguồn...</p>}
          {preview && <div className="lesson-preview"><h3>{preview.items.length} buổi từ {preview.name}</h3>{!preview.items.length ? <p>Môn nguồn chưa khai báo buổi học.</p> : <><ol>{preview.items.map((item, index) => <li key={item.lesson_id}><strong>Buổi {start + index + 1}: {item.topic}</strong><p>{item.objectives}</p></li>)}</ol><p>{mode === 'replace' ? `Xác nhận thay thế ${data.items.length} buổi hiện tại bằng ${preview.items.length} buổi mới?` : `Giữ ${data.items.length} buổi hiện tại và thêm ${preview.items.length} buổi từ vị trí ${start + 1}.`} Nội dung được sao chép riêng; môn nguồn giữ nguyên.</p></>}
            {cloneTooLarge && <p className="program-error" role="alert">Danh sách nhân bản vượt giới hạn {data.session_count} buổi của môn đích. Chọn thay thế nếu phù hợp hoặc tăng số buổi của môn.</p>}</div>}
        </>}
      </fieldset>{dialogError && <p className="program-error" role="alert">{dialogError}</p>}<div className="program-dialog-actions"><button type="button" data-initial-focus={dialog === 'delete' ? true : undefined} className="program-secondary lesson-cancel" disabled={busy} onClick={close}>Hủy</button><button type="submit" className="program-primary lesson-confirm" disabled={busy || (dialog === 'clone' && (!preview || previewLoading || !preview.items.length || cloneTooLarge || optionsLoading || !!optionsError))}>{busy ? 'Đang lưu...' : dialog === 'clone' ? 'Xác nhận nhân bản' : dialog === 'delete' ? 'Xác nhận gỡ' : 'Lưu buổi học'}</button></div></form>
    </div></div>}
  </section>
}
