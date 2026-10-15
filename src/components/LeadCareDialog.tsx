import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { addLeadCareLog, getLeadCareLogs, updateLeadCallback } from '../services/leadService'
import type { CareLogData, CareLogList, Lead } from '../services/leadService'
import { callbackOverdue, careDate, careInput, careISO, careTypes } from '../utils/leadCare'
import './LeadCareDialog.css'

interface Props { lead: Lead; onClose: () => void; onSaved: () => void; explain: (error: unknown) => string }

export default function LeadCareDialog({ lead, onClose, onSaved, explain }: Props) {
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: CareLogList; error?: string } | null>(null)
  const [type, setType] = useState<CareLogData['interaction_type']>('call')
  const [content, setContent] = useState('')
  const [occurred, setOccurred] = useState(() => careInput())
  const [action, setAction] = useState<CareLogData['callback_action']>('keep')
  const [next, setNext] = useState('')
  const [reminder, setReminder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [now, setNow] = useState(Date.now)
  const panel = useRef<HTMLDivElement>(null)
  const saving = useRef(false)
  const key = `${lead.lead_id}:${page}:${reload}`
  const loading = result?.key !== key
  const data = !loading ? result?.data : undefined
  const loadError = !loading ? result?.error : undefined
  const explainLoad = useEffectEvent(explain)
  useEffect(() => {
    let active = true
    getLeadCareLogs(lead.lead_id, page).then(data => {
      if (active) setResult({ key, data })
    }).catch((error: unknown) => { if (active) setResult({ key, error: explainLoad(error) }) })
    return () => { active = false }
  }, [lead.lead_id, page, key])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('button')?.focus()
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => { window.clearInterval(timer); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  const refresh = () => { setReload(value => value + 1); onSaved() }
  const futureDate = (value: string) => {
    const iso = careISO(value)
    if (!iso || new Date(iso).getTime() <= Date.now()) throw new Error('Vui lòng chọn ngày và giờ nhắc gọi lại ở tương lai.')
    return iso
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (saving.current || !data) return
    setError(''); setSuccess('')
    try {
      const occurredAt = careISO(occurred)
      if (!content.trim() || content.trim().length > 5000) throw new Error('Vui lòng nhập nội dung chăm sóc, tối đa 5.000 ký tự.')
      if (!occurredAt || new Date(occurredAt).getTime() > Date.now()) throw new Error('Thời điểm tương tác không hợp lệ hoặc ở tương lai.')
      const payload: CareLogData = { interaction_type: type, content: content.trim(), occurred_at: occurredAt, callback_action: action }
      if (action === 'schedule') payload.next_callback_at = futureDate(next)
      saving.current = true; setBusy(true)
      await addLeadCareLog(lead.lead_id, payload)
      setContent(''); setOccurred(careInput()); setAction('keep'); setNext(''); setPage(1)
      setSuccess('Đã lưu nhật ký chăm sóc.'); refresh()
    } catch (error) { setError(explain(error)) }
    finally { saving.current = false; setBusy(false) }
  }
  const saveReminder = async (clear: boolean) => {
    if (saving.current || !data) return
    setError(''); setSuccess('')
    try {
      const value = clear ? null : futureDate(reminder)
      saving.current = true; setBusy(true)
      await updateLeadCallback(lead.lead_id, value)
      setReminder(''); setSuccess(clear ? 'Đã bỏ lịch nhắc gọi lại.' : 'Đã cập nhật lịch nhắc gọi lại.'); refresh()
    } catch (error) { setError(explain(error)) }
    finally { saving.current = false; setBusy(false) }
  }
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose() }
    if (event.key !== 'Tab') return
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter(node => !node.closest('fieldset:disabled'))
    if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
    if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
  }
  const overdue = callbackOverdue(data?.next_callback_at, now)
  return createPortal(<div className="program-overlay lead-care-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <div ref={panel} className="program-dialog lead-care-dialog" role="dialog" aria-modal="true" aria-labelledby="lead-care-title" onKeyDown={keyboard}>
      <div className="program-dialog-header"><div><span className="lead-care-eyebrow">NHẬT KÝ CHĂM SÓC</span><h2 id="lead-care-title">{lead.full_name}</h2><p><a href={`tel:${lead.phone}`}>{lead.phone}</a> · Mã lead {lead.lead_id}</p></div><button type="button" aria-label="Đóng nhật ký chăm sóc" disabled={busy} onClick={onClose}>×</button></div>
      <p className="lead-care-timezone">Thời gian theo giờ Việt Nam (UTC+7).</p>
      {error && <p className="program-error" role="alert">{error}</p>}
      {success && <p className="program-success" role="status">{success}</p>}
      {loading && <p role="status">Đang tải nhật ký chăm sóc…</p>}
      {loadError && <p className="program-error" role="alert">{loadError} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
      <div className="lead-care-columns">
        <div>
          <section className={`lead-callback-card${overdue ? ' is-overdue' : ''}`} aria-labelledby="lead-callback-title">
            <h3 id="lead-callback-title">Lịch nhắc gọi lại</h3>
            {data && <p>{data.next_callback_at ? <><span className={`lead-callback-badge${overdue ? ' overdue' : ''}`}>{overdue ? 'Quá hạn gọi lại' : 'Sắp gọi lại'}</span><strong>{careDate(data.next_callback_at)}</strong></> : 'Chưa đặt lịch nhắc gọi lại.'}</p>}
            <form onSubmit={event => { event.preventDefault(); void saveReminder(false) }}>
              <fieldset disabled={busy || !data}><label htmlFor="care-reminder">Đặt hoặc đổi lịch nhắc</label><input id="care-reminder" type="datetime-local" required value={reminder} onChange={event => setReminder(event.target.value)} />
                <div className="lead-care-actions"><button type="submit" disabled={!reminder}>Lưu lịch nhắc</button>{data?.next_callback_at && <button type="button" onClick={() => void saveReminder(true)}>Bỏ lịch nhắc</button>}</div>
              </fieldset>
            </form>
          </section>
          <form className="lead-care-form" onSubmit={event => void save(event)}>
            <h3>Ghi nhận tương tác</h3>
            <fieldset disabled={busy || !data}>
              <div className="lead-care-fields"><div><label htmlFor="care-type">Loại tương tác</label><select id="care-type" value={type} onChange={event => setType(event.target.value as CareLogData['interaction_type'])}>{Object.entries(careTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div><label htmlFor="care-occurred">Thời điểm tương tác *</label><input id="care-occurred" type="datetime-local" required value={occurred} onChange={event => setOccurred(event.target.value)} /></div></div>
              <label htmlFor="care-content">Nội dung chăm sóc *</label><textarea id="care-content" rows={5} required maxLength={5000} placeholder="Trao đổi gì với khách hàng? Đã hẹn bước tiếp theo như thế nào?" value={content} onChange={event => setContent(event.target.value)} /><small>{content.length}/5.000 ký tự</small>
              <label htmlFor="care-action">Sau lần tương tác này</label><select id="care-action" value={action} onChange={event => setAction(event.target.value as CareLogData['callback_action'])}><option value="keep">Giữ nguyên lịch nhắc hiện tại</option><option value="schedule">Đặt lịch gọi lại mới</option><option value="complete">Đã gọi lại — hoàn tất lịch nhắc</option></select>
              {action === 'schedule' && <><label htmlFor="care-next">Ngày, giờ gọi lại *</label><input id="care-next" type="datetime-local" required value={next} onChange={event => setNext(event.target.value)} /></>}
              <button className="program-primary lead-care-submit" type="submit">{busy ? 'Đang lưu…' : 'Lưu nhật ký'}</button>
            </fieldset>
          </form>
        </div>
        <section className="lead-care-history" aria-labelledby="care-history-title" aria-busy={loading}>
          <h3 id="care-history-title">Lịch sử tương tác {data && <span>({data.total})</span>}</h3>
          {data && !data.items.length && <p className="lead-care-empty">Chưa có tương tác. Ghi lại cuộc trao đổi đầu tiên để tiếp nối việc chăm sóc khách hàng.</p>}
          <ol>{data?.items.map(item => <li key={item.log_id}><div className="lead-care-event-heading"><span className={`lead-care-kind ${item.interaction_type}`}>{careTypes[item.interaction_type]}</span><time dateTime={item.occurred_at}>{careDate(item.occurred_at)}</time></div><p className="lead-care-content">{item.content}</p><small>{item.actor_name} · Ghi nhận lúc {careDate(item.created_at)}</small>{item.callback_action === 'schedule' && item.next_callback_at && <p className="lead-care-event-note">Đã hẹn gọi lại: {careDate(item.next_callback_at)}</p>}{item.callback_action === 'complete' && <p className="lead-care-event-note">Đã hoàn tất lịch nhắc gọi lại.</p>}</li>)}</ol>
          {data && data.total > data.page_size && <nav className="lead-care-pagination" aria-label="Trang nhật ký"><button disabled={busy || page === 1} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page}/{Math.ceil(data.total / data.page_size)}</span><button disabled={busy || page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)}>Sau</button></nav>}
        </section>
      </div>
    </div>
  </div>, document.body)
}
