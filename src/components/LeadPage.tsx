import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FormEvent, KeyboardEvent } from 'react'
import ErrorPage from './ErrorPage'
import LeadAssignmentDialog from './LeadAssignmentDialog'
import LeadCareDialog from './LeadCareDialog'
import { callbackOverdue, careDate } from '../utils/leadCare'
import LeadFilters, { emptyLeadFilters } from './LeadFilters'
import { checkLeadPhone, deleteLead, getLead, getLeadFilterOptions, LeadDuplicateError, LeadPermissionError, LeadSessionError, listLeads, saveLead } from '../services/leadService'
import type { DuplicateCheck, Lead, LeadFilterOptions, LeadFilters as FilterValues } from '../services/leadService'
import './TrainingProgramPage.css'
import './LeadPage.css'

interface Props { canDelete: boolean; onSessionExpired: () => void }
interface LeadForm { full_name: string; phone: string; email: string; source: string; interest: string }
const emptyForm: LeadForm = { full_name: '', phone: '', email: '', source: 'Nhập thủ công', interest: '' }
const validPhone = (phone: string) => /^(?:0|\+84)(?:[35789][0-9]{8}|2[0-9]{9})$/.test(phone.trim())
const statuses: Record<string, string> = { new: 'Mới', contacted: 'Đã liên hệ', qualified: 'Đủ điều kiện', converted: 'Đã chuyển đổi', closed: 'Đã đóng' }

export default function LeadPage({ canDelete, onSessionExpired }: Props) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [careLead, setCareLead] = useState<Lead | null>(null)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const [total, setTotal] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => Object.fromEntries(Object.keys(emptyLeadFilters).map(key => [key, searchParams.get(key) || ''])) as unknown as FilterValues, [searchParams])
  const rawPage = Number(searchParams.get('page') || '1')
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const setPage = (nextPage: number) => { const params = new URLSearchParams(searchParams); if (nextPage === 1) params.delete('page'); else params.set('page', String(nextPage)); setSearchParams(params) }
  const setFilters = useCallback((values: FilterValues) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) if (value.trim()) params.set(key, value.trim())
    setSearchParams(params, { replace: true })
  }, [setSearchParams])
  const unassigned = filters.assignee_id === '0'
  const [filterOptions, setFilterOptions] = useState<LeadFilterOptions | null>(null)
  const [optionsError, setOptionsError] = useState('')
  const [optionsReload, setOptionsReload] = useState(0)
  const [chosenIds, setChosenIds] = useState<number[]>([])
  const [assignment, setAssignment] = useState<{ mode: 'assign' | 'history'; leads: Lead[] } | null>(null)
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [dialog, setDialog] = useState<'form' | 'delete' | 'detail' | null>(null)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [form, setForm] = useState<LeadForm>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [duplicates, setDuplicates] = useState<DuplicateCheck>({ duplicates: [], total: 0 })
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [checkReload, setCheckReload] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const trigger = useRef<HTMLElement | null>(null)
  const modal = useRef<HTMLDivElement | null>(null)
  const loadVersion = useRef(0)
  const explain = (err: unknown, pageError = false) => {
    if (err instanceof LeadSessionError) onSessionExpired()
    if (err instanceof LeadPermissionError && pageError) setForbidden(true)
    return err instanceof Error && !(err instanceof TypeError) ? err.message : 'Không thể kết nối đến hệ thống. Vui lòng thử lại.'
  }
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    setChosenIds([])
    listLeads(filters, page).then(result => {
      if (!active) return
      const last = Math.max(1, Math.ceil(result.total / 20))
      if (page > last) { setPage(last); return }
      setLeads(result.items); setTotal(result.total)
    }).catch((err: unknown) => { if (active) { setLeads([]); setTotal(0); setError(explain(err, true)) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, reload])
  useEffect(() => {
    let active = true
    setOptionsError('')
    getLeadFilterOptions().then(result => { if (active) setFilterOptions(result) })
      .catch((err: unknown) => { if (active) { setFilterOptions(null); setOptionsError(explain(err, true)) } })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, optionsReload])
  useEffect(() => { if (dialog && !dialogLoading) modal.current?.querySelector<HTMLElement>('[data-initial-focus]')?.focus() }, [dialog, dialogLoading])
  useEffect(() => {
    setDuplicates({ duplicates: [], total: 0 }); setConfirmed(false); setCheckError('')
    if (dialog !== 'form' || dialogLoading || !validPhone(form.phone)) { setChecking(false); return }
    let active = true
    setChecking(true)
    const timer = window.setTimeout(() => {
      checkLeadPhone(form.phone.trim(), selected?.lead_id).then(result => { if (active) setDuplicates(result) })
        .catch((err: unknown) => { if (active) setCheckError(explain(err)) })
        .finally(() => { if (active) setChecking(false) })
    }, 350)
    return () => { active = false; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, dialogLoading, form.phone, selected?.lead_id, checkReload])

  const close = () => { if (!busy) { loadVersion.current++; setDialog(null); setDialogError(''); trigger.current?.focus() } }
  const openAssignment = (mode: 'assign' | 'history', items: Lead[], button: HTMLElement) => {
    trigger.current = button; setSuccess(''); setAssignment({ mode, leads: items })
  }
  const closeAssignment = () => { setAssignment(null); trigger.current?.focus() }
  const open = async (type: 'form' | 'delete' | 'detail', button: HTMLElement, lead?: Lead) => {
    trigger.current = button; const version = ++loadVersion.current
    setSelected(lead || null); setDialogError(''); setSuccess(''); setConfirmed(false)
    setForm({ ...emptyForm }); setDialog(type); setDialogLoading(!!lead)
    if (!lead) return
    try {
      const fresh = await getLead(lead.lead_id)
      if (loadVersion.current !== version) return
      setSelected(fresh); setForm({ full_name: fresh.full_name, phone: fresh.phone, email: fresh.email || '', source: fresh.source, interest: fresh.interest || '' })
    } catch (err) { if (loadVersion.current === version) setDialogError(explain(err)) }
    finally { if (loadVersion.current === version) setDialogLoading(false) }
  }
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { close(); return }
    if (event.key !== 'Tab') return
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')]
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
    if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || dialogLoading) return
    const data = { full_name: form.full_name.trim(), phone: form.phone.trim(), email: form.email.trim() || null, source: form.source.trim(), interest: form.interest.trim() || null, confirm_duplicate: confirmed }
    if (dialog === 'form') {
      if (!data.full_name || data.full_name.length > 100) { setDialogError('Vui lòng nhập họ và tên, tối đa 100 ký tự.'); return }
      if (!validPhone(data.phone)) { setDialogError('Số điện thoại Việt Nam không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678.'); return }
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { setDialogError('Email không hợp lệ.'); return }
      if (!data.source || data.source.length > 100) { setDialogError('Vui lòng nhập nguồn khách hàng, tối đa 100 ký tự.'); return }
      if (checking || checkError) return
      if ((duplicates.total || duplicates.hidden_match) && !confirmed) { setDialogError('Hãy kiểm tra các lead trùng số điện thoại và xác nhận trước khi lưu.'); return }
    }
    setBusy(true); setDialogError('')
    try {
      if (dialog === 'form') await saveLead(data, selected?.lead_id)
      else if (dialog === 'delete' && selected && canDelete) await deleteLead(selected.lead_id)
      else return
      setSuccess(dialog === 'delete' ? 'Đã xóa khách hàng tiềm năng khỏi danh sách.' : selected ? 'Đã cập nhật khách hàng tiềm năng.' : 'Đã tạo khách hàng tiềm năng ở trạng thái Mới.')
      setDialog(null); setReload(value => value + 1); trigger.current?.focus()
    } catch (err) {
      if (err instanceof LeadDuplicateError) { setDuplicates(err.details); setConfirmed(false) }
      setDialogError(explain(err)); setReload(value => value + 1)
    } finally { setBusy(false) }
  }
  if (forbidden) return <ErrorPage statusCode={403} title="Không có quyền truy cập" message="Bạn không có quyền quản lý khách hàng tiềm năng." />
  return <section className="program-page lead-page" aria-labelledby="lead-title">
    <div className="program-header"><div><h1 id="lead-title">Khách hàng tiềm năng</h1><p>Theo dõi thông tin liên hệ và nhu cầu tư vấn để không bỏ sót khách hàng.</p></div><button className="program-primary lead-add" onClick={event => void open('form', event.currentTarget)}>Tạo lead</button></div>
    <LeadFilters value={filters} options={filterOptions} optionsError={optionsError} onRetry={() => setOptionsReload(value => value + 1)} onApply={setFilters} />
    {error && <p className="program-error" role="alert">{error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}{success && <p className="program-success" role="status">{success}</p>}
    {canDelete && <div className="lead-bulk-toolbar"><label><input id="lead-unassigned-filter" type="checkbox" checked={unassigned} onChange={event => setFilters({ ...filters, assignee_id: event.target.checked ? '0' : '' })} />Chỉ lead chưa phân công</label><span>Đã chọn {chosenIds.length} lead trên trang này</span><button className="lead-assign-bulk" disabled={loading || !chosenIds.length} onClick={event => openAssignment('assign', leads.filter(lead => chosenIds.includes(lead.lead_id)), event.currentTarget)}>Phân công đã chọn</button></div>}
    <div className="program-table-wrap" aria-busy={loading}><table className="program-table lead-table"><caption>{total} khách hàng tiềm năng</caption><thead><tr>{canDelete && <th className="lead-selection"><input type="checkbox" aria-label="Chọn tất cả lead trên trang" checked={leads.length > 0 && chosenIds.length === leads.length} disabled={loading || !leads.length} onChange={event => setChosenIds(event.target.checked ? leads.map(lead => lead.lead_id) : [])} /></th>}<th>Họ tên</th><th>Liên hệ</th><th>Nguồn</th><th>Chương trình quan tâm</th><th>Trạng thái</th><th>Ngày tạo</th><th>Người phụ trách</th><th>Nhắc gọi lại</th><th>Thao tác</th></tr></thead><tbody>{loading ? <tr><td colSpan={canDelete ? 10 : 9}>Đang tải khách hàng...</td></tr> : !leads.length ? <tr><td colSpan={canDelete ? 10 : 9}>Chưa có khách hàng phù hợp.</td></tr> : leads.map(lead => <tr key={lead.lead_id} data-lead-id={lead.lead_id} className={callbackOverdue(lead.next_callback_at, now) ? 'lead-overdue' : undefined}>{canDelete && <td className="lead-selection"><input type="checkbox" aria-label={`Chọn lead ${lead.full_name}`} checked={chosenIds.includes(lead.lead_id)} onChange={event => setChosenIds(value => event.target.checked ? [...value, lead.lead_id] : value.filter(id => id !== lead.lead_id))} /></td>}<td className="program-name"><strong>{lead.full_name}</strong><small>Mã lead: {lead.lead_id}</small></td><td className="lead-contact"><a href={`tel:${lead.phone}`}>{lead.phone}</a><small>{lead.email || 'Chưa có email'}</small>{lead.duplicate_count > 0 && <small className="lead-duplicate-badge">Trùng số điện thoại với {lead.duplicate_count} lead</small>}</td><td>{lead.source}</td><td className="program-name">{lead.interest || 'Chưa xác định'}</td><td><span className="program-badge active">{statuses[lead.status] || 'Khác'}</span></td><td>{new Date(lead.created_at.endsWith('Z') ? lead.created_at : `${lead.created_at}Z`).toLocaleString('vi-VN')}</td><td className="lead-assignee-name"><span className={lead.assignee_id ? '' : 'lead-unassigned'}>{lead.assignee_name || 'Chưa phân công'}</span></td><td className="lead-callback-cell">{lead.next_callback_at ? <><span className={`lead-callback-badge${callbackOverdue(lead.next_callback_at, now) ? ' overdue' : ''}`}>{callbackOverdue(lead.next_callback_at, now) ? 'Quá hạn gọi lại' : 'Sắp gọi lại'}</span><time dateTime={lead.next_callback_at}>{careDate(lead.next_callback_at)}</time></> : <small>Chưa đặt lịch</small>}</td><td><div className="program-row-actions"><button className="lead-care" onClick={event => { trigger.current = event.currentTarget; setCareLead(lead) }}>Chăm sóc</button><button className="lead-detail" onClick={event => void open('detail', event.currentTarget, lead)}>Chi tiết</button><button className="lead-edit" onClick={event => void open('form', event.currentTarget, lead)}>Sửa</button><button className="lead-history" onClick={event => openAssignment('history', [lead], event.currentTarget)}>Chuyển giao</button>{canDelete && <button className="lead-assign" onClick={event => openAssignment('assign', [lead], event.currentTarget)}>Phân công</button>}{canDelete && <button className="program-delete lead-delete" onClick={event => void open('delete', event.currentTarget, lead)}>Xóa</button>}</div></td></tr>)}</tbody></table></div>
    <div className="program-pagination"><span>Trang {page}/{Math.max(1, Math.ceil(total / 20))}</span><button disabled={loading || page <= 1} onClick={() => setPage(page-1)}>Trang trước</button><button disabled={loading || page >= Math.ceil(total / 20)} onClick={() => setPage(page+1)}>Trang sau</button></div>
    {careLead && <LeadCareDialog key={careLead.lead_id} lead={careLead} onClose={() => { setCareLead(null); trigger.current?.focus() }} onSaved={() => setReload(value => value + 1)} explain={explain} />}
    {assignment && <LeadAssignmentDialog mode={assignment.mode} leads={assignment.leads} explain={err => explain(err)} onClose={closeAssignment} onSaved={message => { closeAssignment(); setSuccess(message); setReload(value => value + 1) }} />}
    {dialog && <div className="program-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><div ref={modal} className="program-dialog" role="dialog" aria-modal="true" aria-labelledby="lead-dialog-title" onKeyDown={keyboard}><div className="program-dialog-header"><h2 id="lead-dialog-title">{dialog === 'detail' ? 'Thông tin khách hàng tiềm năng' : dialog === 'delete' ? 'Xóa khách hàng tiềm năng' : selected ? 'Sửa khách hàng tiềm năng' : 'Tạo khách hàng tiềm năng'}</h2><button disabled={busy} aria-label="Đóng hộp thoại" onClick={close}>×</button></div>
      {dialogLoading ? <p role="status">Đang tải thông tin mới nhất...</p> : <form onSubmit={submit} noValidate>{dialog === 'form' ? <fieldset className="program-form" disabled={busy}>
        <div className="program-full"><label htmlFor="lead-name">Họ và tên *</label><input id="lead-name" data-initial-focus maxLength={100} value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} /></div><div><label htmlFor="lead-phone">Số điện thoại *</label><input id="lead-phone" type="tel" maxLength={20} value={form.phone} onChange={event => { setConfirmed(false); setForm({ ...form, phone: event.target.value }) }} /></div><div><label htmlFor="lead-email">Email</label><input id="lead-email" type="email" maxLength={255} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></div><div className="program-full"><label htmlFor="lead-source">Nguồn khách hàng *</label><input id="lead-source" maxLength={100} list="lead-sources" value={form.source} onChange={event => setForm({ ...form, source: event.target.value })} /><datalist id="lead-sources"><option value="Nhập thủ công" /><option value="Biểu mẫu công khai" /><option value="Facebook" /><option value="Giới thiệu" /><option value="Điện thoại" /></datalist></div><div className="program-full"><label htmlFor="lead-interest">Chương trình quan tâm</label><input id="lead-interest" maxLength={255} value={form.interest} onChange={event => setForm({ ...form, interest: event.target.value })} /></div>
        <div className="program-full">{checking && <p role="status">Đang kiểm tra số điện thoại trùng...</p>}{checkError && <p className="program-error" role="alert">{checkError} <button type="button" onClick={() => setCheckReload(value => value + 1)}>Kiểm tra lại</button></p>}{(duplicates.total > 0 || duplicates.hidden_match) && <div className="lead-duplicate-warning" role="alert"><strong>{duplicates.total > 0 ? `Số điện thoại đã có ở ${duplicates.total} lead bạn được xem` : 'Số điện thoại đã tồn tại trong hệ thống.'}</strong>{duplicates.hidden_match && <p>Có lead trùng số điện thoại nằm ngoài phạm vi bạn được xem. Hãy trao đổi với Quản lý đào tạo trước khi tiếp tục.</p>}<ul>{duplicates.duplicates.map(item => <li key={item.lead_id}>#{item.lead_id} — {item.full_name} · {item.source}{item.interest ? ` · ${item.interest}` : ''}</li>)}</ul><label className="lead-duplicate-confirm"><input id="lead-confirm-duplicate" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Tôi đã kiểm tra và vẫn muốn lưu lead trùng số điện thoại.</span></label></div>}</div>
      </fieldset> : dialog === 'delete' ? <><p><strong>{selected?.full_name} — {selected?.phone}</strong></p><p>Xóa khách hàng này khỏi danh sách? Thao tác chỉ dành cho Quản lý đào tạo.</p></> : <dl className="lead-details"><dt>Họ tên</dt><dd>{selected?.full_name}</dd><dt>Số điện thoại</dt><dd>{selected?.phone}</dd><dt>Email</dt><dd>{selected?.email || 'Chưa có email'}</dd><dt>Nguồn</dt><dd>{selected?.source}</dd><dt>Chương trình quan tâm</dt><dd>{selected?.interest || 'Chưa xác định'}</dd><dt>Người phụ trách</dt><dd>{selected?.assignee_name || 'Chưa phân công'}</dd><dt>Nhu cầu tư vấn</dt><dd>{selected?.message || 'Chưa có nội dung tư vấn'}</dd><dt>Trạng thái</dt><dd>{statuses[selected?.status || ''] || 'Khác'}</dd></dl>}
      {dialogError && <p className="program-error" role="alert">{dialogError}</p>}<div className="program-dialog-actions"><button type="button" className="program-secondary lead-cancel" data-initial-focus={dialog !== 'form' ? true : undefined} disabled={busy} onClick={close}>{dialog === 'detail' ? 'Đóng' : 'Hủy'}</button>{dialog !== 'detail' && <button className="program-primary lead-confirm" type="submit" disabled={busy || dialogLoading || (dialog === 'form' && (checking || !!checkError || ((duplicates.total > 0 || !!duplicates.hidden_match) && !confirmed)))}>{busy ? 'Đang lưu...' : dialog === 'delete' ? 'Xác nhận xóa' : 'Lưu khách hàng'}</button>}</div></form>}
    </div></div>}
  </section>
}
