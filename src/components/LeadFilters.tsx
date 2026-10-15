import ChoiceSelect from './ChoiceSelect'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LeadFilterOptions, LeadFilters as FilterValues } from '../services/leadService'

export const emptyLeadFilters: FilterValues = { search: '', source: '', status: '', assignee_id: '', date_from: '', date_to: '', callback_status: '' }
const statuses: Record<string, string> = { new: 'Mới', contacted: 'Đã liên hệ', qualified: 'Đủ điều kiện', converted: 'Đã chuyển đổi', closed: 'Đã đóng' }
const dateValid = (value: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0, 10) === value)
const validate = (values: FilterValues) => {
  if (!dateValid(values.date_from) || !dateValid(values.date_to)) return 'Ngày lọc không hợp lệ.'
  if (values.date_from && values.date_to && values.date_from > values.date_to) return 'Ngày bắt đầu không được sau ngày kết thúc.'
  return ''
}
const signature = (values: FilterValues) => JSON.stringify(Object.keys(emptyLeadFilters).map(key => values[key as keyof FilterValues].trim()))
interface Props { value: FilterValues; options: LeadFilterOptions | null; optionsError: string; onRetry: () => void; onApply: (values: FilterValues) => void }

export default function LeadFilters({ value, options, optionsError, onRetry, onApply }: Props) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  const pending = useRef<string[]>([])
  const publish = useCallback((next: FilterValues) => {
    const key = signature(next)
    if (key !== signature(value)) pending.current = [...pending.current, key].slice(-20)
    onApply(next)
  }, [value, onApply])
  useLayoutEffect(() => {
    const index = pending.current.indexOf(signature(value))
    if (index >= 0) {
      // Acknowledge our own URL update without overwriting newer keystrokes.
      pending.current.splice(0, index + 1)
      return
    }
    pending.current = []
    setDraft(value); setError('')
  }, [value])
  useEffect(() => {
    if (draft.search === value.search) return
    const timer = window.setTimeout(() => {
      const message = validate(draft)
      setError(message)
      if (!message) publish(draft)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draft, value, publish])
  const apply = (next: FilterValues) => {
    setDraft(next)
    const message = validate(next)
    setError(message)
    if (!message) publish(next)
  }
  const sources = [...new Set([...(options?.sources || []), ...(draft.source ? [draft.source] : [])])]
  const hasAssignee = options?.assignees.some(item => String(item.user_id) === draft.assignee_id)
  return <form className="program-filters lead-filters" onSubmit={event => { event.preventDefault(); apply(draft) }} noValidate>
    <div className="lead-quick-search"><label htmlFor="lead-search">Tìm nhanh theo tên hoặc số điện thoại</label><input id="lead-search" type="search" maxLength={100} value={draft.search} placeholder="Nhập tên hoặc số điện thoại…" onChange={event => setDraft({ ...draft, search: event.target.value })} /><small>Tự tìm khi nhập; có thể kết hợp với các bộ lọc bên dưới.</small></div>
    <div><label htmlFor="lead-source-filter">Nguồn khách hàng</label><ChoiceSelect id="lead-source-filter" value={draft.source} onChange={event => apply({ ...draft, source: event.target.value })}><option value="">Tất cả nguồn</option>{sources.map(source => <option key={source} value={source}>{source}</option>)}</ChoiceSelect></div>
    <div><label htmlFor="lead-status-filter">Trạng thái</label><ChoiceSelect id="lead-status-filter" value={draft.status} onChange={event => apply({ ...draft, status: event.target.value })}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ChoiceSelect></div>
    <div><label htmlFor="lead-assignee-filter">Người phụ trách</label><ChoiceSelect id="lead-assignee-filter" value={draft.assignee_id} onChange={event => apply({ ...draft, assignee_id: event.target.value })}><option value="">{options?.can_view_all ? 'Tất cả người phụ trách' : 'Lead được giao cho tôi'}</option>{options?.can_view_all && <option value="0">Chưa phân công</option>}{options?.assignees.map(item => <option key={item.user_id} value={item.user_id}>{item.full_name}</option>)}{draft.assignee_id && !hasAssignee && !(draft.assignee_id === '0' && options?.can_view_all) && <option value={draft.assignee_id}>Người phụ trách đã chọn</option>}</ChoiceSelect></div>
    <div><label htmlFor="lead-date-from">Ngày tạo từ</label><input id="lead-date-from" type="date" max="9999-12-31" value={draft.date_from} onChange={event => apply({ ...draft, date_from: event.target.value })} /></div>
    <div><label htmlFor="lead-date-to">Ngày tạo đến</label><input id="lead-date-to" type="date" max="9999-12-31" value={draft.date_to} onChange={event => apply({ ...draft, date_to: event.target.value })} /></div>
    <div><label htmlFor="lead-callback-filter">Lịch gọi lại</label><ChoiceSelect id="lead-callback-filter" value={draft.callback_status} onChange={event => apply({ ...draft, callback_status: event.target.value })}><option value="">Tất cả lịch nhắc</option><option value="overdue">Quá hạn gọi lại</option><option value="upcoming">Sắp gọi lại</option><option value="none">Chưa đặt lịch</option></ChoiceSelect></div>
    <div className="lead-filter-actions"><button type="submit">Tìm kiếm</button><button type="button" className="lead-filter-reset" onClick={() => apply({ ...emptyLeadFilters })}>Xóa bộ lọc</button></div>
    <p className="lead-filter-hint">Khoảng ngày gồm cả ngày bắt đầu và kết thúc, theo giờ Việt Nam.</p>
    {error && <p className="program-error lead-filter-message" role="alert">{error}</p>}
    {optionsError && <p className="program-error lead-filter-message" role="alert">{optionsError} <button type="button" onClick={onRetry}>Tải lại bộ lọc</button></p>}
  </form>
}
