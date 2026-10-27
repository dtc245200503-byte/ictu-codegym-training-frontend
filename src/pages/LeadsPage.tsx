import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { navigateTo } from '../navigation'
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
  has_overdue_callback?: boolean
  next_callback_at?: string | null
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
  presentation = 'dialog',
}: {
  lead: Lead
  onClose: () => void
  onSaved: (closeEditor?: boolean) => void
  presentation?: 'dialog' | 'page'
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [activityText, setActivityText] = useState('')
  const [callbackDate, setCallbackDate] = useState('')
  const [callbackTime, setCallbackTime] = useState('09:00')
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [activityType, setActivityType] = useState<LeadActivity['activity_type']>('call')

  function setPreset(key: string, daysOffset: number, timeStr: string) {
    const target = new Date()
    target.setDate(target.getDate() + daysOffset)
    const yyyy = target.getFullYear()
    const mm = String(target.getMonth() + 1).padStart(2, '0')
    const dd = String(target.getDate()).padStart(2, '0')
    setCallbackDate(`${yyyy}-${mm}-${dd}`)
    setCallbackTime(timeStr)
    setActivePreset(key)
  }
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
      const scheduledIso = callbackDate
        ? new Date(`${callbackDate}T${callbackTime || '09:00'}:00`).toISOString()
        : null
      const activity = await apiRequest<LeadActivity>(`/leads/${lead.id}/activities`, {
        method: 'POST',
        body: JSON.stringify({
          message: activityText,
          activity_type: activityType,
          scheduled_for: scheduledIso,
        }),
      })
      setActivities((current) => [activity, ...current])
      setActivityText('')
      setCallbackDate('')
      setCallbackTime('09:00')
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
      if (lead.status !== 'closed' && status === 'closed') {
        await apiRequest(`/leads/${lead.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'closed' }),
        })
      }
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
    <Modal
      backHref={presentation === 'page' ? '/leads' : undefined}
      eyebrow="HỒ SƠ TUYỂN SINH"
      onClose={onClose}
      presentation={presentation}
      size="large"
      title={lead.full_name}
    >
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
        {(status === 'closed' || lead.status === 'closed') && !lead.converted_user_id && !conversion ? (
          <div
            className="convert-student-banner"
            style={{
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              padding: '14px',
              margin: '14px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <strong style={{ color: '#166534', fontSize: '13px', display: 'block', marginBottom: '3px' }}>
                🎓 Chuyển đổi thành Học viên chính thức (S3-03)
              </strong>
              <span style={{ color: '#15803d', fontSize: '12px', lineHeight: 1.4, display: 'block' }}>
                Hồ sơ đang ở trạng thái <strong>Chốt</strong>. Nhấn nút để tự động kế thừa toàn bộ thông tin (họ tên, email, SĐT, chương trình học), tự sinh mã sinh viên và tài khoản đăng nhập mà không cần nhập lại!
              </span>
            </div>
            <button
              className="button button-primary"
              style={{ background: '#16a34a', borderColor: '#16a34a', whiteSpace: 'nowrap', fontWeight: 600, padding: '8px 16px' }}
              disabled={busy}
              onClick={() => void convertToStudent()}
              type="button"
            >
              🎓 Chuyển thành học viên
            </button>
          </div>
        ) : lead.converted_user_id ? (
          <div className="form-alert info-alert" style={{ margin: '14px 0' }}>
            ✅ Hồ sơ này đã được chuyển đổi thành Học viên chính thức thành công.
          </div>
        ) : (
          <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px 14px', margin: '12px 0', fontSize: '12px', color: '#64748b' }}>
            💡 <em>Mẹo (S3-03): Để chuyển đổi Lead thành hồ sơ Học viên chính thức, bạn chỉ cần chọn trạng thái <strong>Chốt</strong> ở ô Trạng thái bên trên. Nút chuyển đổi sẽ tự động xuất hiện!</em>
          </div>
        )}
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className={presentation === 'page' ? 'page-actions' : 'modal-actions'}>
          {presentation === 'dialog' ? <button className="button button-outline" onClick={onClose} type="button">Đóng</button> : null}
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </button>
        </div>
      </form>
      <section className="lead-activity">
        <h3>Nhật ký chăm sóc & Đặt lịch hẹn gọi lại</h3>
        <form className="lead-activity-form" onSubmit={(event) => void addActivity(event)}>
          <label className="field" style={{ width: '100%' }}>
            <span>Nội dung trao đổi / tư vấn <b>*</b></span>
            <textarea
              maxLength={3000}
              onChange={(event) => setActivityText(event.target.value)}
              placeholder="Nhập nội dung tư vấn, thông tin khóa học, mong muốn của thí sinh..."
              required
              rows={2}
              value={activityText}
            />
          </label>

          <div className="callback-presets">
            <span className="preset-label">Hẹn gọi lại nhanh:</span>
            <button
              type="button"
              className={`preset-btn ${activePreset === 'tomorrow_morning' ? 'active' : ''}`}
              onClick={() => setPreset('tomorrow_morning', 1, '09:00')}
            >
              ⚡ Sáng mai (09:00)
            </button>
            <button
              type="button"
              className={`preset-btn ${activePreset === 'tomorrow_afternoon' ? 'active' : ''}`}
              onClick={() => setPreset('tomorrow_afternoon', 1, '14:30')}
            >
              ⚡ Chiều mai (14:30)
            </button>
            <button
              type="button"
              className={`preset-btn ${activePreset === 'in_3_days' ? 'active' : ''}`}
              onClick={() => setPreset('in_3_days', 3, '09:00')}
            >
              ⚡ Sau 3 ngày
            </button>
            <button
              type="button"
              className={`preset-btn preset-overdue ${activePreset === 'yesterday' ? 'active' : ''}`}
              onClick={() => setPreset('yesterday', -1, '09:00')}
              title="Đặt hẹn vào hôm qua để thử nghiệm cờ cảnh báo quá hạn"
            >
              ⚠️ Hôm qua (Test quá hạn)
            </button>
            {callbackDate ? (
              <button
                type="button"
                className="preset-btn preset-clear"
                onClick={() => {
                  setCallbackDate('')
                  setCallbackTime('09:00')
                  setActivePreset(null)
                }}
              >
                ✕ Hủy hẹn
              </button>
            ) : null}
          </div>

          <div className="lead-activity-grid">
            <label className="field">
              <span>Hình thức</span>
              <select onChange={(event) => setActivityType(event.target.value as LeadActivity['activity_type'])} value={activityType}>
                <option value="call">📞 Gọi điện</option>
                <option value="message">💬 Tin nhắn</option>
                <option value="meeting">🤝 Gặp trực tiếp</option>
                <option value="other">📌 Khác</option>
              </select>
            </label>

            <label className="field">
              <span>Ngày hẹn gọi</span>
              <input
                type="date"
                value={callbackDate}
                onChange={(event) => {
                  setCallbackDate(event.target.value)
                  setActivePreset(null)
                }}
              />
            </label>

            <label className="field">
              <span>Giờ hẹn</span>
              <select
                disabled={!callbackDate}
                value={callbackTime}
                onChange={(event) => {
                  setCallbackTime(event.target.value)
                  setActivePreset(null)
                }}
              >
                <option value="08:00">08:00 Sáng</option>
                <option value="08:30">08:30 Sáng</option>
                <option value="09:00">09:00 Sáng</option>
                <option value="09:30">09:30 Sáng</option>
                <option value="10:00">10:00 Sáng</option>
                <option value="10:30">10:30 Sáng</option>
                <option value="11:00">11:00 Sáng</option>
                <option value="13:30">13:30 Chiều</option>
                <option value="14:00">14:00 Chiều</option>
                <option value="14:30">14:30 Chiều</option>
                <option value="15:00">15:00 Chiều</option>
                <option value="15:30">15:30 Chiều</option>
                <option value="16:00">16:00 Chiều</option>
                <option value="16:30">16:30 Chiều</option>
                <option value="17:00">17:00 Chiều</option>
                <option value="18:30">18:30 Tối</option>
                <option value="19:00">19:00 Tối</option>
                <option value="19:30">19:30 Tối</option>
                <option value="20:00">20:00 Tối</option>
              </select>
            </label>

            <button
              className="button button-primary"
              disabled={busy || !activityText.trim()}
              type="submit"
              style={{ minHeight: '38px', padding: '0 16px', fontSize: '13px' }}
            >
              {callbackDate ? 'Lưu & đặt lịch hẹn' : 'Ghi nhật ký'}
            </button>
          </div>
        </form>

        <ol className="lead-activity-list">
          {activities.map((activity) => (
            <li key={activity.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{new Date(activity.created_at).toLocaleString('vi-VN')}</span>
                {activity.scheduled_for ? (
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: activity.is_overdue ? '#fee2e2' : '#dbeafe',
                      color: activity.is_overdue ? '#b91c1c' : '#1d4ed8',
                    }}
                  >
                    {activity.is_overdue ? '⚠️ Quá hạn gọi lại: ' : '📅 Lịch hẹn: '}
                    {new Date(activity.scheduled_for).toLocaleString('vi-VN')}
                  </span>
                ) : null}
              </div>
              <p>{activity.message}</p>
            </li>
          ))}
          {!activities.length ? <li style={{ textAlign: 'center', color: '#94a3b8' }}>Chưa có nhật ký chăm sóc.</li> : null}
        </ol>
      </section>
    </Modal>
  )
}

export function LeadDetailPage({ leadId }: { leadId: number }) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    let active = true
    apiRequest<Lead>(`/leads/${leadId}`)
      .then((found) => {
        if (active) {
          setLead(found)
          setProblem('')
        }
      })
      .catch((error: unknown) => {
        if (active) setProblem(showError(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [leadId])

  if (loading) return <section className="panel detail-loading">Đang tải hồ sơ tư vấn…</section>
  if (!lead) {
    return (
      <section className="page-stack">
        <div className="form-alert error-alert">{problem || 'Không tìm thấy hồ sơ tư vấn.'}</div>
        <button
          className="button button-outline"
          onClick={() => navigateTo('/leads')}
          type="button"
        >
          Quay lại danh sách
        </button>
      </section>
    )
  }

  return (
    <LeadEditor
      lead={lead}
      onClose={() => navigateTo('/leads')}
      onSaved={(closeEditor = true) => {
        if (closeEditor) navigateTo('/leads')
      }}
      presentation="page"
    />
  )
}

export function LeadsPage() {
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  const [items, setItems] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(20)
  const [refresh, setRefresh] = useState(0)
  const [draggedLead, setDraggedLead] = useState<number | null>(null)
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null)
  const [rejectLeadTarget, setRejectLeadTarget] = useState<Lead | null>(null)
  const [rejectionInput, setRejectionInput] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const [rejectingBusy, setRejectingBusy] = useState(false)
  const [convertSuccess, setConvertSuccess] = useState<{
    fullName: string
    studentCode: string
    email: string
    initialPassword?: string
    created: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')

  async function handleQuickConvert(lead: Lead) {
    setLoading(true)
    setProblem('')
    try {
      const result = await apiRequest<{
        created: boolean
        initial_password?: string
        student: { student_code: string; email: string }
      }>(`/leads/${lead.id}/convert`, { method: 'POST' })
      setConvertSuccess({
        fullName: lead.full_name,
        studentCode: result.student.student_code,
        email: result.student.email,
        initialPassword: result.initial_password ?? '123456',
        created: result.created,
      })
      saved()
    } catch (err) {
      setProblem(showError(err))
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    async function loadLeads() {
      setLoading(true)
      if (viewMode === 'table') {
        const params = new URLSearchParams({
          offset: String(page * pageSize),
          limit: String(pageSize),
        })
        if (query) params.set('q', query)
        if (statusFilter) params.set('status', statusFilter)
        const result = await apiRequest<LeadPage>(`/leads?${params}`)
        if (active) {
          setItems(result.items)
          setTotal(result.total)
          setProblem('')
        }
      } else {
        // Kanban view loads all leads matching query/filter
        const allLeads: Lead[] = []
        let expectedTotal = 0
        const batchSize = 100
        do {
          const params = new URLSearchParams({
            offset: String(allLeads.length),
            limit: String(batchSize),
          })
          if (query) params.set('q', query)
          if (statusFilter) params.set('status', statusFilter)
          const result = await apiRequest<LeadPage>(`/leads?${params}`)
          expectedTotal = result.total
          allLeads.push(...result.items)
          if (!result.items.length) break
        } while (allLeads.length < expectedTotal)
        if (active) {
          setItems(allLeads)
          setTotal(expectedTotal)
          setProblem('')
        }
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
  }, [page, pageSize, query, refresh, statusFilter, viewMode])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(0)
    setQuery(search.trim())
  }

  function clearFilters() {
    setSearch('')
    setQuery('')
    setStatusFilter('')
    setPage(0)
  }

  function saved() {
    setRefresh((value) => value + 1)
  }

  async function moveLead(lead: Lead, nextStatus: LeadStatus) {
    if (lead.status === nextStatus) return
    if (nextStatus === 'rejected') {
      setRejectLeadTarget(lead)
      setRejectionInput('')
      setRejectionError('')
      return
    }
    try {
      await apiRequest(`/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
        }),
      })
      saved()
    } catch (error) {
      setProblem(showError(error))
    }
  }

  async function submitRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rejectLeadTarget) return
    if (!rejectionInput.trim()) {
      setRejectionError('Vui lòng nhập lý do từ chối.')
      return
    }
    setRejectingBusy(true)
    setRejectionError('')
    try {
      await apiRequest(`/leads/${rejectLeadTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: rejectionInput.trim(),
        }),
      })
      setRejectLeadTarget(null)
      saved()
    } catch (error) {
      setRejectionError(showError(error))
    } finally {
      setRejectingBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasActiveFilters = Boolean(query || statusFilter)

  return (
    <section className="page-section">
      <div className="breadcrumb">
        <span>Tuyển sinh</span>
        <span className="breadcrumb-divider">/</span>
        <strong>{viewMode === 'table' ? 'Danh sách Lead' : 'Bảng Kanban Lead'}</strong>
      </div>

      <div className="page-title-row" style={{ marginBottom: '16px' }}>
        <div>
          <span className="eyebrow">TUYỂN SINH</span>
          <h1>Quản lý Lead tuyển sinh</h1>
          <p>Theo dõi tiến trình tư vấn thí sinh, nhắc lịch gọi lại và chuyển đổi thành học viên chính thức.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="button-group" style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
            <button
              className={`button button-small ${viewMode === 'table' ? 'button-primary' : 'button-ghost'}`}
              onClick={() => { setViewMode('table'); setPage(0); }}
              style={{ borderRadius: 0, border: 'none', fontWeight: 600 }}
              type="button"
            >
              📋 Danh sách
            </button>
            <button
              className={`button button-small ${viewMode === 'kanban' ? 'button-primary' : 'button-ghost'}`}
              onClick={() => { setViewMode('kanban'); }}
              style={{ borderRadius: 0, border: 'none', fontWeight: 600 }}
              type="button"
            >
              📊 Kanban
            </button>
          </div>
          <span className="role-pill role-admissions">{total} hồ sơ</span>
        </div>
      </div>

      <div className="page-toolbar" style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <form className="toolbar-search" onSubmit={submitSearch} style={{ flex: 1, minWidth: '260px' }}>
          <UiIcon name="search" />
          <input
            aria-label="Tìm hồ sơ"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên, email, số điện thoại…"
            value={search}
          />
          <button className="button button-outline button-small" type="submit">Tìm kiếm</button>
        </form>

        <label className="field filter-field" style={{ margin: 0, minWidth: '170px' }}>
          <span className="visually-hidden">Lọc trạng thái</span>
          <select
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(0)
            }}
            value={statusFilter}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>

        {hasActiveFilters ? (
          <button
            className="button button-ghost button-small"
            onClick={clearFilters}
            style={{ color: '#dc2626', fontWeight: 600 }}
            type="button"
          >
            ✕ Xóa bộ lọc
          </button>
        ) : null}
      </div>

      {problem ? <div className="form-alert error-alert" style={{ marginBottom: '16px' }}>{problem}</div> : null}

      {viewMode === 'table' ? (
        <div className="leads-table-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '180px' }}>THÍ SINH</th>
                  <th style={{ minWidth: '125px' }}>SỐ ĐIỆN THOẠI</th>
                  <th style={{ minWidth: '180px' }}>EMAIL</th>
                  <th style={{ minWidth: '150px' }}>CHƯƠNG TRÌNH</th>
                  <th style={{ minWidth: '140px' }}>TRẠNG THÁI</th>
                  <th style={{ minWidth: '150px' }}>LỊCH HẸN / QUÁ HẠN</th>
                  <th style={{ minWidth: '150px', textAlign: 'right' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="table-loading" colSpan={7}>Đang tải danh sách hồ sơ…</td>
                  </tr>
                ) : null}

                {!loading && !items.length ? (
                  <tr>
                    <td className="table-empty" colSpan={7}>
                      <div className="empty-state">
                        <div className="empty-icon"><UiIcon name="users" size={24} /></div>
                        <strong>Không tìm thấy hồ sơ lead nào</strong>
                        <span>Thử điều chỉnh từ khóa tìm kiếm hoặc bỏ chọn bộ lọc trạng thái.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}

                {!loading && items.map((lead) => (
                  <tr key={lead.id}>
                    <td data-label="Thí sinh">
                      <a
                        href={`/leads/${lead.id}`}
                        onClick={(e) => {
                          e.preventDefault()
                          navigateTo(`/leads/${lead.id}`)
                        }}
                        style={{ fontWeight: 600, color: 'var(--blue, #0054a6)', textDecoration: 'none', display: 'block' }}
                      >
                        {lead.full_name}
                      </a>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Tạo ngày {new Date(lead.created_at).toLocaleDateString('vi-VN')}
                      </span>
                    </td>
                    <td data-label="Số điện thoại">
                      <span style={{ fontFamily: 'Consolas, monospace', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {lead.phone}
                      </span>
                    </td>
                    <td data-label="Email">
                      <div style={{ maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a
                          href={`mailto:${lead.email}`}
                          style={{ fontSize: '13px', color: '#0054a6', textDecoration: 'none' }}
                          title={lead.email}
                        >
                          {lead.email}
                        </a>
                      </div>
                    </td>
                    <td data-label="Chương trình">
                      <span style={{ fontSize: '12px', color: '#0369a1', background: '#e0f2fe', padding: '3px 8px', borderRadius: '4px' }}>
                        {lead.interested_program || 'Chưa chọn'}
                      </span>
                    </td>
                    <td data-label="Trạng thái">
                      <select
                        aria-label={`Trạng thái ${lead.full_name}`}
                        onChange={(event) => void moveLead(lead, event.target.value as LeadStatus)}
                        style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}
                        value={lead.status}
                      >
                        {Object.entries(statusLabels).map(([value, text]) => (
                          <option key={value} value={value}>{text}</option>
                        ))}
                      </select>
                      {lead.status === 'rejected' && lead.rejection_reason ? (
                        <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '2px' }} title={lead.rejection_reason}>
                          Lý do: {lead.rejection_reason}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Lịch hẹn">
                      {lead.has_overdue_callback ? (
                        <span className="lead-tag lead-tag-overdue" style={{ fontSize: '11px' }}>⚠️ Quá hạn gọi</span>
                      ) : lead.next_callback_at ? (
                        <span className="lead-tag lead-tag-scheduled" style={{ fontSize: '11px' }}>
                          📅 {new Date(lead.next_callback_at).toLocaleDateString('vi-VN')}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td data-label="Thao tác">
                      <div className="row-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                        <a
                          className="button button-outline button-small"
                          href={`/leads/${lead.id}`}
                          onClick={(e) => {
                            e.preventDefault()
                            navigateTo(`/leads/${lead.id}`)
                          }}
                        >
                          Chi tiết
                        </a>

                        {lead.status === 'closed' && !lead.converted_user_id ? (
                          <button
                            className="button button-primary button-small"
                            onClick={() => void handleQuickConvert(lead)}
                            style={{
                              background: '#16a34a',
                              borderColor: '#16a34a',
                              fontSize: '12px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                            type="button"
                          >
                            🎓 Chuyển học viên
                          </button>
                        ) : lead.converted_user_id ? (
                          <span
                            className="lead-tag"
                            style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              borderColor: '#86efac',
                              fontSize: '11px',
                            }}
                          >
                            ✓ Đã chuyển
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '8px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Hiển thị {total === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} trong tổng {total} hồ sơ
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                Số dòng:
                <select
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(0)
                  }}
                  style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  value={pageSize}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="button button-page"
                disabled={page <= 0}
                onClick={() => setPage(0)}
                title="Trang đầu"
                type="button"
              >
                « Đầu
              </button>
              <button
                className="button button-page"
                disabled={page <= 0}
                onClick={() => setPage((v) => Math.max(0, v - 1))}
                type="button"
              >
                ‹ Trước
              </button>
              <span className="page-current" style={{ padding: '0 8px', fontSize: '13px', fontWeight: 600 }}>
                {page + 1} / {totalPages}
              </span>
              <button
                className="button button-page"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((v) => Math.min(totalPages - 1, v + 1))}
                type="button"
              >
                Tiếp ›
              </button>
              <button
                className="button button-page"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(totalPages - 1)}
                title="Trang cuối"
                type="button"
              >
                Cuối »
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="lead-kanban">
            {Object.entries(statusLabels).map(([statusKey, label]) => {
              const stage = statusKey as LeadStatus
              const stageLeads = items.filter((lead) => lead.status === stage)
              return (
                <section
                  aria-label={`${label}: ${stageLeads.length} hồ sơ`}
                  className={`lead-kanban-column ${dragOverStage === stage ? 'drag-over' : ''}`}
                  key={stage}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return
                    if (dragOverStage === stage) setDragOverStage(null)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    if (dragOverStage !== stage) setDragOverStage(stage)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragOverStage(null)
                    const transferId = event.dataTransfer.getData('text/plain')
                    const targetId = transferId ? Number(transferId) : draggedLead
                    const lead = items.find((item) => item.id === targetId)
                    if (lead) void moveLead(lead, stage)
                    setDraggedLead(null)
                  }}
                >
                  <header>
                    <h2>{label}</h2>
                    <span>{stageLeads.length}</span>
                  </header>

                  {loading ? <div className="table-loading" style={{ padding: '20px 0' }}>Đang tải…</div> : null}

                  {!loading && stageLeads.map((lead) => (
                    <article
                      className="lead-kanban-card"
                      draggable
                      key={lead.id}
                      onDragEnd={() => {
                        setDraggedLead(null)
                        setDragOverStage(null)
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', String(lead.id))
                        event.dataTransfer.effectAllowed = 'move'
                        setDraggedLead(lead.id)
                      }}
                    >
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{lead.full_name}</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0 6px 0', border: 'none', padding: 0 }}>
                        <span style={{ fontSize: '13px', color: '#1e293b', fontFamily: 'Consolas, monospace', fontWeight: 600 }}>
                          📞 {lead.phone}
                        </span>
                        <span style={{ fontSize: '12px', color: '#475569', wordBreak: 'break-all' }}>
                          ✉️ {lead.email}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#0054a6', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px', width: 'fit-content' }}>
                        {lead.interested_program ?? 'Chưa chọn chương trình'}
                      </span>

                      {lead.has_overdue_callback ? (
                        <span className="lead-tag lead-tag-overdue">⚠️ Quá hạn gọi lại</span>
                      ) : lead.next_callback_at ? (
                        <span className="lead-tag lead-tag-scheduled">
                          📅 Hẹn gọi: {new Date(lead.next_callback_at).toLocaleDateString('vi-VN')}
                        </span>
                      ) : null}

                      {lead.status === 'rejected' && lead.rejection_reason ? (
                        <div style={{ fontSize: '12px', color: '#b91c1c', background: '#fef2f2', padding: '4px 8px', borderRadius: '4px' }}>
                          Lý do: {lead.rejection_reason}
                        </div>
                      ) : null}

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
                        <a
                          className="text-button"
                          href={`/leads/${lead.id}`}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            navigateTo(`/leads/${lead.id}`)
                          }}
                        >
                          Chi tiết
                        </a>
                      </div>

                      {lead.status === 'closed' && !lead.converted_user_id ? (
                        <button
                          className="button button-primary button-small"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleQuickConvert(lead)
                          }}
                          style={{
                            width: '100%',
                            marginTop: '4px',
                            background: '#16a34a',
                            borderColor: '#16a34a',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                          type="button"
                        >
                          🎓 Chuyển thành học viên
                        </button>
                      ) : lead.converted_user_id ? (
                        <span
                          className="lead-tag"
                          style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            borderColor: '#86efac',
                            marginTop: '4px',
                            alignSelf: 'center',
                          }}
                        >
                          ✓ Đã chuyển thành học viên
                        </span>
                      ) : null}
                    </article>
                  ))}

                  {!loading && !stageLeads.length ? (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      Chưa có hồ sơ
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
          <p className="form-note" style={{ marginTop: '12px', color: '#64748b', fontSize: '13px' }}>
            Đang hiển thị {items.length} / {total} hồ sơ · Kéo thẻ sang cột khác hoặc chọn trạng thái trong danh sách để cập nhật.
          </p>
        </>
      )}

      {rejectLeadTarget ? (
        <Modal
          eyebrow="TỪ CHỐI HỒ SƠ"
          onClose={() => setRejectLeadTarget(null)}
          size="medium"
          title={`Từ chối tư vấn: ${rejectLeadTarget.full_name}`}
        >
          <form onSubmit={submitRejection}>
            <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '13px' }}>
              Vui lòng nhập lý do từ chối để lưu vào nhật ký tư vấn cho thí sinh <strong>{rejectLeadTarget.full_name}</strong>.
            </p>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="rejection-reason-textarea" style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '13px' }}>
                Lý do từ chối <span style={{ color: '#e11d48' }}>*</span>
              </label>
              <textarea
                autoFocus
                className="field-textarea"
                id="rejection-reason-textarea"
                onChange={(e) => setRejectionInput(e.target.value)}
                placeholder="Ví dụ: Không phù hợp lịch học, học phí ngoài dự kiến, đã đăng ký trường khác..."
                required
                rows={3}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                value={rejectionInput}
              />
            </div>
            {rejectionError ? (
              <div className="form-alert error-alert" style={{ marginBottom: '12px' }}>{rejectionError}</div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                className="button button-outline"
                disabled={rejectingBusy}
                onClick={() => setRejectLeadTarget(null)}
                type="button"
              >
                Hủy bỏ
              </button>
              <button
                className="button button-danger"
                disabled={rejectingBusy || !rejectionInput.trim()}
                type="submit"
              >
                {rejectingBusy ? 'Đang lưu…' : 'Xác nhận từ chối'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {convertSuccess ? (
        <Modal
          eyebrow="CHUYỂN ĐỔI THÀNH CÔNG (S3-03)"
          onClose={() => setConvertSuccess(null)}
          size="medium"
          title={`Hồ sơ học viên: ${convertSuccess.fullName}`}
        >
          <div className="credential-panel" style={{ padding: '16px' }}>
            <span className="credential-check"><UiIcon name="check" size={24} /></span>
            <p style={{ fontWeight: 700, color: '#15803d', fontSize: '15px', margin: '4px 0 8px' }}>
              {convertSuccess.created ? '🎉 Đã chuyển đổi thành Học viên chính thức!' : 'Hồ sơ này đã được chuyển thành học viên trước đó.'}
            </p>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.4 }}>
              Toàn bộ thông tin cá nhân đã được kế thừa tự động sang hồ sơ học viên mới mà không cần nhập lại. Dưới đây là thông tin tài khoản được cấp:
            </p>
            <label className="field"><span>Mã học viên (Student Code)</span><input readOnly style={{ fontWeight: 700, color: '#0054a6' }} value={convertSuccess.studentCode} /></label>
            <label className="field"><span>Email / Tài khoản đăng nhập</span><input readOnly value={convertSuccess.email} /></label>
            <label className="field"><span>Mật khẩu ban đầu</span><input readOnly value={convertSuccess.initialPassword} /></label>
            <div className="form-alert info-alert" style={{ marginTop: '12px' }}>
              Học viên có thể sử dụng thông tin trên để đăng nhập ngay vào hệ thống (yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên).
            </div>
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <a
                className="button button-outline"
                href="/students"
                onClick={(e) => {
                  e.preventDefault()
                  setConvertSuccess(null)
                  navigateTo('/students')
                }}
              >
                Xem danh sách Học viên
              </a>
              <button className="button button-primary" onClick={() => setConvertSuccess(null)} type="button">Xong</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
