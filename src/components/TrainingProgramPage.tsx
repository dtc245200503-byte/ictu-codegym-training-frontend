import AbsencePolicyDialog from './AbsencePolicyDialog'
import ChoiceSelect from './ChoiceSelect'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import ErrorPage from './ErrorPage'
import { deleteProgram, listPrograms, ProgramPermissionError, ProgramSessionError, saveProgram, setProgramStatus } from '../services/trainingProgramService'
import type { ProgramData, ProgramStatus, TrainingProgram } from '../services/trainingProgramService'
import './TrainingProgramPage.css'

interface Props { onSessionExpired: () => void }
const emptyForm: ProgramData = { code: '', name: '', description: '', total_duration_hours: '', standard_tuition: '', status: 'active' }
const money = (amount: string) => Number(amount).toLocaleString('vi-VN') + ' VNĐ'

export default function TrainingProgramPage({ onSessionExpired }: Props) {
  const [riskProgram, setRiskProgram] = useState<number | null>(null)
  const [items, setItems] = useState<TrainingProgram[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [form, setForm] = useState<ProgramData>(emptyForm)
  const [editing, setEditing] = useState<TrainingProgram | null>(null)
  const [modal, setModal] = useState(false)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState<{ program: TrainingProgram, type: 'delete' | 'status' } | null>(null)
  const firstInput = useRef<HTMLInputElement>(null)
  const lastTrigger = useRef<HTMLElement | null>(null)

  const handleError = (err: unknown) => {
    if (err instanceof ProgramSessionError) onSessionExpired()
    if (err instanceof ProgramPermissionError) setForbidden(true)
    return err instanceof Error && !(err instanceof TypeError) ? err.message : 'Không thể kết nối đến hệ thống. Vui lòng thử lại.'
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    listPrograms(appliedSearch, status, page).then((result) => {
      if (!active) return
      const lastPage = Math.max(1, Math.ceil(result.total / 20))
      if (page > lastPage) { setPage(lastPage); return }
      setItems(result.items); setTotal(result.total)
    }).catch((err: unknown) => { if (active) setError(handleError(err)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // Request only when filters/page change, not on parent authentication updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, status, page, reload])

  useEffect(() => { if (modal) firstInput.current?.focus() }, [modal])

  const closeDialog = () => {
    if (busy) return
    setModal(false); setAction(null); setFormError('')
    lastTrigger.current?.focus()
  }

  const handleDialogKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { closeDialog(); return }
    if (event.key !== 'Tab') return
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled):not([aria-hidden="true"]), textarea:not(:disabled)')]
    const first = nodes[0], last = nodes[nodes.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  const openForm = (trigger: HTMLElement, program?: TrainingProgram) => {
    lastTrigger.current = trigger
    setEditing(program || null)
    setForm(program ? { code: program.code, name: program.name, description: program.description || '',
      total_duration_hours: program.total_duration_hours, standard_tuition: program.standard_tuition, status: program.status } : { ...emptyForm })
    setFormError(''); setSuccess(''); setModal(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const data = { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(), description: form.description?.trim() || null }
    if (!/^[A-Z0-9][A-Z0-9_-]{0,49}$/.test(data.code)) { setFormError('Mã chương trình chỉ gồm chữ không dấu, số, dấu gạch ngang hoặc gạch dưới; tối đa 50 ký tự.'); return }
    if (!data.name || data.name.length > 100) { setFormError('Vui lòng nhập tên chương trình, tối đa 100 ký tự.'); return }
    if (!/^\d+(\.\d{1,2})?$/.test(data.total_duration_hours) || Number(data.total_duration_hours) <= 0 || Number(data.total_duration_hours) > 999999.99) { setFormError('Tổng thời lượng phải lớn hơn 0, tối đa 999.999,99 giờ và có tối đa 2 chữ số thập phân.'); return }
    if (!/^\d+$/.test(data.standard_tuition) || Number(data.standard_tuition) > 999999999999) { setFormError('Học phí phải là số nguyên từ 0 đến 999.999.999.999 VNĐ.'); return }
    setBusy(true); setFormError('')
    try {
      await saveProgram(data, editing?.curriculum_id)
      setModal(false); setSuccess(editing ? 'Cập nhật chương trình thành công.' : 'Thêm chương trình thành công.')
      setReload(value => value + 1); lastTrigger.current?.focus()
    } catch (err) { setFormError(handleError(err)) }
    finally { setBusy(false) }
  }

  const confirmAction = async () => {
    if (!action || busy) return
    setBusy(true); setFormError('')
    try {
      if (action.type === 'delete') await deleteProgram(action.program.curriculum_id)
      else await setProgramStatus(action.program.curriculum_id, action.program.status === 'active' ? 'inactive' : 'active')
      setSuccess(action.type === 'delete' ? 'Đã xóa chương trình khỏi danh mục.' : action.program.status === 'active' ? 'Đã ngừng áp dụng chương trình. Các lớp hiện có tiếp tục được giữ nguyên.' : 'Đã áp dụng lại chương trình.')
      setAction(null); setReload(value => value + 1); lastTrigger.current?.focus()
    } catch (err) { setFormError(handleError(err)); setReload(value => value + 1) }
    finally { setBusy(false) }
  }

  if (forbidden) return <ErrorPage statusCode={403} title="Không có quyền truy cập" message="Bạn không có quyền quản lý chương trình đào tạo." />

  return (
    <section className="program-page" aria-labelledby="program-title">
      <div className="program-header"><div>
        <h1 id="program-title">Chương trình đào tạo</h1>
        <p>Quản lý chương trình có sẵn để sử dụng khi mở lớp mới.</p>
      </div><button className="program-primary" onClick={event => openForm(event.currentTarget)}>Thêm chương trình</button></div>
      <form className="program-filters" onSubmit={event => { event.preventDefault(); setPage(1); setAppliedSearch(search); setReload(value => value + 1) }}>
        <div><label htmlFor="program-search">Tìm chương trình</label><input id="program-search" placeholder="Tìm theo mã hoặc tên chương trình" value={search} maxLength={100} onChange={event => setSearch(event.target.value)} /></div>
        <div><label htmlFor="program-filter-status">Trạng thái</label><ChoiceSelect id="program-filter-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">Tất cả trạng thái</option><option value="active">Đang áp dụng</option><option value="inactive">Ngừng áp dụng</option></ChoiceSelect></div>
        <button className="program-secondary" type="submit">Tìm kiếm</button>
      </form>
      {success && <p className="program-success" role="status">{success}</p>}
      {error && <div className="program-error" role="alert">{error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></div>}
      <div className="program-table-wrap" aria-busy={loading}>
        <table className="program-table"><caption>{total} chương trình đào tạo</caption><thead><tr><th>Mã chương trình</th><th>Tên và mô tả</th><th>Thời lượng</th><th>Học phí chuẩn</th><th>Trạng thái</th><th>Lớp đang chạy</th><th>Thao tác</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={7}>Đang tải chương trình...</td></tr> : items.length === 0 ? <tr><td colSpan={7}>Chưa có chương trình phù hợp.</td></tr> : items.map(program => <tr key={program.curriculum_id}>
            <td><strong>{program.code}</strong></td><td className="program-name"><strong>{program.name}</strong><p>{program.description || 'Chưa có mô tả'}</p></td>
            <td>{Number(program.total_duration_hours) > 0 ? Number(program.total_duration_hours).toLocaleString('vi-VN') + ' giờ' : 'Chưa khai báo'}</td>
            <td>{money(program.standard_tuition)}</td><td><span className={`program-badge ${program.status}`}>{program.status === 'active' ? 'Đang áp dụng' : 'Ngừng áp dụng'}</span></td>
            <td>{program.active_class_count}<small>{program.total_class_count} lớp tổng cộng</small></td>
            <td><div className="program-row-actions"><button onClick={event => openForm(event.currentTarget, program)}>Sửa</button>
              <button onClick={() => setRiskProgram(program.curriculum_id)}>Ngưỡng vắng</button>
              <button onClick={event => { lastTrigger.current = event.currentTarget; setAction({ program, type: 'status' }); setFormError('') }}>{program.status === 'active' ? 'Ngừng áp dụng' : 'Áp dụng lại'}</button>
              <button className="program-delete" disabled={!program.can_delete} title={!program.can_delete ? 'Có lớp đang chạy, chỉ được ngừng áp dụng.' : 'Xóa khỏi danh mục'} onClick={event => { lastTrigger.current = event.currentTarget; setAction({ program, type: 'delete' }); setFormError('') }}>Xóa</button><Link className="program-path-link" to={`/courses/${program.curriculum_id}/curriculum`}>Lộ trình</Link></div>
              {!program.can_delete && <small className="program-delete-note">Có lớp đang chạy, không được xóa.</small>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="program-pagination"><span>Trang {page} / {Math.max(1, Math.ceil(total / 20))}</span><button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Trang trước</button><button disabled={page >= Math.ceil(total / 20) || loading} onClick={() => setPage(page + 1)}>Trang sau</button></div>
      {(modal || action) && <div className="program-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog() }}>
        <div className="program-dialog" role="dialog" aria-modal="true" aria-labelledby="program-dialog-title" onKeyDown={handleDialogKeys}>
          <div className="program-dialog-header"><h2 id="program-dialog-title">{modal ? editing ? 'Sửa chương trình đào tạo' : 'Thêm chương trình đào tạo' : action?.type === 'delete' ? 'Xóa chương trình' : action?.program.status === 'active' ? 'Ngừng áp dụng chương trình' : 'Áp dụng lại chương trình'}</h2><button aria-label="Đóng hộp thoại" disabled={busy} onClick={closeDialog}>×</button></div>
          {modal ? <form onSubmit={submit} noValidate><fieldset disabled={busy} className="program-form">
            <div><label htmlFor="program-code">Mã chương trình *</label><input ref={firstInput} id="program-code" value={form.code} maxLength={50} required onChange={event => setForm({ ...form, code: event.target.value })} /><small>Mã duy nhất, không phân biệt chữ hoa/thường.</small></div>
            <div><label htmlFor="program-name">Tên chương trình *</label><input id="program-name" value={form.name} maxLength={100} required onChange={event => setForm({ ...form, name: event.target.value })} /></div>
            <div className="program-full"><label htmlFor="program-description">Mô tả</label><textarea id="program-description" rows={3} value={form.description || ''} maxLength={5000} onChange={event => setForm({ ...form, description: event.target.value })} /></div>
            <div><label htmlFor="program-hours">Tổng thời lượng (giờ) *</label><input id="program-hours" type="number" min="0.01" max="999999.99" step="0.01" value={form.total_duration_hours} required onChange={event => setForm({ ...form, total_duration_hours: event.target.value })} /></div>
            <div><label htmlFor="program-tuition">Học phí chuẩn (VNĐ) *</label><input id="program-tuition" type="number" min="0" max="999999999999" step="1" value={form.standard_tuition} required onChange={event => setForm({ ...form, standard_tuition: event.target.value })} /></div>
            <div className="program-full"><label htmlFor="program-status">Trạng thái</label><ChoiceSelect id="program-status" value={form.status} onChange={event => setForm({ ...form, status: event.target.value as ProgramStatus })}><option value="active">Đang áp dụng</option><option value="inactive">Ngừng áp dụng</option></ChoiceSelect></div>
          </fieldset>{formError && <p className="program-error" role="alert">{formError}</p>}<div className="program-dialog-actions"><button type="button" className="program-secondary" disabled={busy} onClick={closeDialog}>Hủy</button><button type="submit" className="program-primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu chương trình'}</button></div></form>
            : <><p><strong>{action?.program.code} — {action?.program.name}</strong></p><p>{action?.type === 'delete' ? 'Xóa chương trình khỏi danh mục để không chọn khi mở lớp mới. Lịch sử các lớp đã mở vẫn được giữ.' : action?.program.status === 'active' ? 'Sau khi ngừng áp dụng, chương trình không còn nằm trong danh sách đang áp dụng. Các lớp hiện có vẫn được giữ nguyên.' : 'Chương trình sẽ xuất hiện lại trong danh sách đang áp dụng.'}</p>{formError && <p className="program-error" role="alert">{formError}</p>}<div className="program-dialog-actions"><button autoFocus className="program-secondary" disabled={busy} onClick={closeDialog}>Hủy</button><button className="program-primary program-confirm" disabled={busy} onClick={confirmAction}>{busy ? 'Đang xử lý...' : 'Xác nhận'}</button></div></>}
        </div>
      </div>}
    {riskProgram !== null && <AbsencePolicyDialog key={riskProgram} courseId={riskProgram} explain={handleError} onClose={() => setRiskProgram(null)} onSaved={() => { setRiskProgram(null); setSuccess('Đã lưu ngưỡng vắng và cập nhật cảnh báo cho các lớp của chương trình.') }} />}
    </section>
  )
}
