import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { apiRequest } from '../api'
import { Modal, UiIcon } from '../components/Ui'
import { showError } from '../format'

type LeadStatus = 'new' | 'contacted' | 'consulting' | 'trial_scheduled' | 'closed' | 'rejected'

type Lead = {
  id: number
  full_name: string
  email: string
  phone: string
  interested_program: string | null
  message: string | null
  status: LeadStatus
  notes: string | null
  rejection_reason: string | null
  assigned_to_user_id: number | null
  converted_user_id: number | null
  created_at: string
  updated_at: string
}

type LeadPage = {
  items: Lead[]
  total: number
  offset: number
  limit: number
}

type LeadActivity = {
  id: number
  message: string
  actor_user_id: number | null
  scheduled_for: string | null
  created_at: string
  is_overdue: boolean
  activity_type: 'call' | 'message' | 'meeting' | 'other'
}

type AdmissionsStaff = { id: number; full_name: string; email: string }

const statusLabels: Record<LeadStatus, string> = {
  new: 'Mới',
  contacted: 'Đã liên hệ',
  consulting: 'Đang tư vấn',
  trial_scheduled: 'Hẹn học thử',
  closed: 'Chốt',
  rejected: 'Từ chối',
}

export function PublicLeadModal({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const values = new FormData(event.currentTarget)
    try {
      await apiRequest('/leads', {
        method: 'POST',
        body: JSON.stringify({
          full_name: values.get('full_name'),
          email: values.get('email'),
          phone: values.get('phone'),
          interested_program: values.get('interested_program') || null,
          message: values.get('message') || null,
        }),
      })
      setSubmitted(true)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal eyebrow="TƯ VẤN TUYỂN SINH" onClose={onClose} title={submitted ? 'Đã nhận đăng ký' : 'Đăng ký tư vấn'}>
      {submitted ? (
        <div className="credential-panel">
          <span className="credential-check"><UiIcon name="check" size={22} /></span>
          <p>Cảm ơn bạn đã quan tâm. Bộ phận tuyển sinh sẽ liên hệ theo thông tin đã đăng ký.</p>
          <button className="button button-primary button-full" onClick={onClose} type="button">Đóng</button>
        </div>
      ) : (
        <form className="dialog-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              <span>Họ và tên <b>*</b></span>
              <input autoFocus maxLength={150} name="full_name" required />
            </label>
            <label className="field">
              <span>Số điện thoại <b>*</b></span>
              <input maxLength={30} minLength={6} name="phone" required type="tel" />
            </label>
            <label className="field field-span-2">
              <span>Email <b>*</b></span>
              <input maxLength={255} name="email" required type="email" />
            </label>
            <label className="field field-span-2">
              <span>Chương trình quan tâm</span>
              <input maxLength={150} name="interested_program" placeholder="VD: Công nghệ thông tin" />
            </label>
            <label className="field field-span-2">
              <span>Nội dung cần tư vấn</span>
              <textarea maxLength={3000} name="message" rows={4} />
            </label>
          </div>
          {problem ? <div className="form-alert error-alert">{problem}</div> : null}
          <div className="modal-actions">
            <button className="button button-outline" onClick={onClose} type="button">Hủy</button>
            <button className="button button-primary" disabled={busy} type="submit">
              {busy ? 'Đang gửi…' : 'Gửi đăng ký'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function LeadEditor({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead
  onClose: () => void
  onSaved: (closeEditor?: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [activityText, setActivityText] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [activityType, setActivityType] = useState<LeadActivity['activity_type']>('call')
  const [status, setStatus] = useState<LeadStatus>(lead.status)
  const [rejectionReason, setRejectionReason] = useState(lead.rejection_reason ?? '')
  const [assignedToUserId, setAssignedToUserId] = useState(
    lead.assigned_to_user_id?.toString() ?? '',
  )
  const [staff, setStaff] = useState<AdmissionsStaff[]>([])
  const [conversion, setConversion] = useState<{
    student_code: string
    email: string
    initial_password?: string
    created: boolean
  } | null>(null)

  useEffect(() => {
    apiRequest<LeadActivity[]>(`/leads/${lead.id}/activities`)
      .then(setActivities)
      .catch((error: unknown) => setProblem(showError(error)))
    apiRequest<AdmissionsStaff[]>('/admissions-staff')
      .then(setStaff)
      .catch((error: unknown) => setProblem(showError(error)))
  }, [lead.id])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const values = new FormData(event.currentTarget)
    try {
      await apiRequest(`/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(status === 'rejected' ? { rejection_reason: rejectionReason } : {}),
          notes: values.get('notes') || null,
          assigned_to_user_id: assignedToUserId
            ? Number(assignedToUserId)
            : null,
        }),
      })
      onSaved()
    } catch (error) {
      setProblem(showError(error))
      setBusy(false)
    }
  }

  async function addActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    try {
      const activity = await apiRequest<LeadActivity>(`/leads/${lead.id}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          message: activityText,
          activity_type: activityType,
          scheduled_for: callbackAt ? new Date(callbackAt).toISOString() : null,
        }),
      })
      setActivities((current) => [activity, ...current])
      setActivityText('')
      setCallbackAt('')
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function convertToStudent() {
    setBusy(true)
    setProblem('')
    try {
      const result = await apiRequest<{
        created: boolean
        initial_password?: string
        student: { student_code: string; email: string }
      }>(`/leads/${lead.id}/convert`, { method: 'POST' })
      setConversion({
        created: result.created,
        student_code: result.student.student_code,
        email: result.student.email,
        initial_password: result.initial_password,
      })
      onSaved(false)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal eyebrow="HỒ SƠ TUYỂN SINH" onClose={onClose} size="large" title={lead.full_name}>
      {conversion ? (
        <div className="credential-panel">
          <span className="credential-check"><UiIcon name="check" size={22} /></span>
          <p>{conversion.created ? 'Đã tạo hồ sơ học viên.' : 'Lead này đã được chuyển thành học viên trước đó.'}</p>
          <label className="field"><span>Mã học viên</span><input readOnly value={conversion.student_code} /></label>
          <label className="field"><span>Email đăng nhập</span><input readOnly value={conversion.email} /></label>
          {conversion.initial_password ? <label className="field"><span>Mật khẩu khởi tạo</span><input readOnly value={conversion.initial_password} /></label> : null}
          {conversion.initial_password ? <div className="form-alert info-alert">Học viên phải đổi mật khẩu sau lần đăng nhập đầu tiên.</div> : null}
        </div>
      ) : null}
      <form className="dialog-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            <span>Email</span>
            <input readOnly value={lead.email} />
          </label>
          <label className="field">
            <span>Số điện thoại</span>
            <input readOnly value={lead.phone} />
          </label>
          <label className="field field-span-2">
            <span>Chương trình quan tâm</span>
            <input readOnly value={lead.interested_program ?? 'Chưa cung cấp'} />
          </label>
          <label className="field field-span-2">
            <span>Nội dung đăng ký</span>
            <textarea readOnly rows={3} value={lead.message ?? 'Không có nội dung bổ sung.'} />
          </label>
          <label className="field">
            <span>Trạng thái</span>
            <select onChange={(event) => setStatus(event.target.value as LeadStatus)} value={status}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {status === 'rejected' ? (
            <label className="field field-span-2">
              <span>Lý do từ chối <b>*</b></span>
              <textarea maxLength={1000} minLength={3} onChange={(event) => setRejectionReason(event.target.value)} required value={rejectionReason} />
            </label>
          ) : null}
          <label className="field">
            <span>Tư vấn viên phụ trách</span>
            <select
              onChange={(event) => setAssignedToUserId(event.target.value)}
              value={assignedToUserId}
            >
              <option value="">Chưa phân công</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>{member.full_name} · {member.email}</option>
              ))}
            </select>
          </label>
          <label className="field field-span-2">
            <span>Ghi chú nội bộ</span>
            <textarea defaultValue={lead.notes ?? ''} maxLength={3000} name="notes" rows={3} />
          </label>
        </div>
        {lead.status === 'closed' && !lead.converted_user_id && !conversion ? (
          <button className="button button-primary" disabled={busy} onClick={() => void convertToStudent()} type="button">
            Chuyển thành học viên
          </button>
        ) : lead.converted_user_id ? <div className="form-alert info-alert">Đã chuyển thành học viên.</div> : null}
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose} type="button">Đóng</button>
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </button>
        </div>
      </form>
      <section className="lead-activity">
        <h3>Nhật ký chăm sóc</h3>
        <form className="lead-activity-form" onSubmit={(event) => void addActivity(event)}>
          <label className="field">
            <span>Ghi nhận lần chăm sóc mới</span>
            <textarea maxLength={3000} onChange={(event) => setActivityText(event.target.value)} required rows={2} value={activityText} />
          </label>
          <label className="field">
            <span>Hẹn gọi lại (không bắt buộc)</span>
            <input onChange={(event) => setCallbackAt(event.target.value)} type="datetime-local" value={callbackAt} />
          </label>
          <label className="field">
            <span>Loại tương tác</span>
            <select onChange={(event) => setActivityType(event.target.value as LeadActivity['activity_type'])} value={activityType}>
              <option value="call">Gọi điện</option>
              <option value="message">Tin nhắn</option>
              <option value="meeting">Gặp trực tiếp</option>
              <option value="other">Khác</option>
            </select>
          </label>
          <button className="button button-outline button-small" disabled={busy || !activityText.trim()} type="submit">
            {callbackAt ? 'Ghi nhật ký & đặt lịch' : 'Ghi nhật ký'}
          </button>
        </form>
        <ol className="lead-activity-list">
          {activities.map((activity) => (
            <li key={activity.id}>
              <span>{new Date(activity.created_at).toLocaleString('vi-VN')}</span>
              <p>{activity.message}</p>
              {activity.scheduled_for ? <small className={activity.is_overdue ? 'text-warning' : undefined}>{activity.is_overdue ? 'Quá hạn · ' : 'Hẹn gọi lại: '}{new Date(activity.scheduled_for).toLocaleString('vi-VN')}</small> : null}
            </li>
          ))}
          {!activities.length ? <li>Chưa có nhật ký chăm sóc.</li> : null}
        </ol>
      </section>
    </Modal>
  )
}

export function LeadsPage() {
  const [items, setItems] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [draggedLead, setDraggedLead] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const limit = 100

  useEffect(() => {
    let active = true
    async function loadLeads() {
      const allLeads: Lead[] = []
      let expectedTotal = 0
      do {
        const params = new URLSearchParams({
          offset: String(allLeads.length),
          limit: String(limit),
        })
        if (query) params.set('q', query)
        const result = await apiRequest<LeadPage>(`/leads?${params}`)
        expectedTotal = result.total
        allLeads.push(...result.items)
        if (!result.items.length) break
      } while (allLeads.length < expectedTotal)
      if (active) {
        setItems(allLeads)
        setTotal(expectedTotal)
      }
    }
    loadLeads()
      .catch((error: unknown) => {
        if (active) setProblem(showError(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [query, refresh])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setProblem('')
    setQuery(search.trim())
    setRefresh((value) => value + 1)
  }

  function saved(closeEditor = true) {
    if (closeEditor) setSelected(null)
    setLoading(true)
    setProblem('')
    setRefresh((value) => value + 1)
  }

  async function moveLead(lead: Lead, nextStatus: LeadStatus) {
    if (lead.status === nextStatus) return
    let rejectionReason: string | null = null
    if (nextStatus === 'rejected') {
      rejectionReason = window.prompt('Nhập lý do từ chối Lead:')
      if (!rejectionReason?.trim()) return
    }
    try {
      await apiRequest(`/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          ...(rejectionReason ? { rejection_reason: rejectionReason.trim() } : {}),
        }),
      })
      saved()
    } catch (error) {
      setProblem(showError(error))
    }
  }

  return (
    <section className="page-section">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">TUYỂN SINH</span>
          <h1>Hồ sơ tư vấn</h1>
          <p>Tiếp nhận và theo dõi yêu cầu tư vấn từ thí sinh.</p>
        </div>
        <span className="role-pill role-admissions">{total} hồ sơ</span>
      </div>
      <div className="page-toolbar">
        <form className="toolbar-search" onSubmit={submitSearch}>
          <UiIcon name="search" />
          <input
            aria-label="Tìm hồ sơ"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên, email, số điện thoại…"
            value={search}
          />
          <button className="button button-outline button-small" type="submit">Tìm</button>
        </form>
      </div>
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      <div className="lead-kanban">
        {Object.entries(statusLabels).map(([statusKey, label]) => {
          const stage = statusKey as LeadStatus
          const stageLeads = items.filter((lead) => lead.status === stage)
          return (
            <section
              aria-label={`${label}: ${stageLeads.length} hồ sơ`}
              className="lead-kanban-column"
              key={stage}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const lead = items.find((item) => item.id === draggedLead)
                if (lead) void moveLead(lead, stage)
                setDraggedLead(null)
              }}
            >
              <header><h2>{label}</h2><span>{stageLeads.length}</span></header>
              {loading ? <div className="table-loading">Đang tải…</div> : null}
              {!loading && stageLeads.map((lead) => (
                <article
                  className="lead-kanban-card"
                  draggable
                  key={lead.id}
                  onClick={() => setSelected(lead)}
                  onDragStart={() => setDraggedLead(lead.id)}
                >
                  <strong>{lead.full_name}</strong>
                  <span>{lead.email}</span>
                  <span>{lead.phone}</span>
                  <small>{lead.interested_program ?? 'Chưa chọn chương trình'}</small>
                  {lead.status === 'rejected' && lead.rejection_reason ? <small>Lý do: {lead.rejection_reason}</small> : null}
                  <div>
                    <select
                      aria-label={`Trạng thái ${lead.full_name}`}
                      onChange={(event) => void moveLead(lead, event.target.value as LeadStatus)}
                      onClick={(event) => event.stopPropagation()}
                      value={lead.status}
                    >
                      {Object.entries(statusLabels).map(([value, text]) => (
                        <option key={value} value={value}>{text}</option>
                      ))}
                    </select>
                    <button className="text-button" onClick={(event) => { event.stopPropagation(); setSelected(lead) }} type="button">Chi tiết</button>
                  </div>
                </article>
              ))}
              {!loading && !stageLeads.length ? <p className="muted-cell">Không có hồ sơ</p> : null}
            </section>
          )
        })}
      </div>
      <p className="form-note">Đang hiển thị {items.length} / {total} hồ sơ · Kéo thẻ sang cột khác hoặc chọn trạng thái để cập nhật.</p>
      {selected ? <LeadEditor lead={selected} onClose={() => setSelected(null)} onSaved={saved} /> : null}
    </section>
  )
}
