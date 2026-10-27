import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { navigateTo } from '../navigation'
import { ApiError, apiBlobRequest, apiRequest, apiRequestWithHeaders } from '../api'
import { Modal, UiIcon } from '../components/Ui'
import { ListPagination, SearchableSelect } from '../components/ListControls'
import { showError } from '../format'
import { paginationFromHeaders } from '../pagination'
import type { TrainingClass, User } from '../types'

type ScheduleSession = {
  id: number
  class_id: number
  class_code: string
  class_name: string
  course_code: string
  course_name: string
  session_date: string
  weekday: string
  start_time: string
  end_time: string
  teacher_id: number
  teacher_name: string
  room: string
  lesson_sequence: number | null
  lesson_title: string | null
  is_cancelled: boolean
  cancellation_reason: string | null
  conflict_override: boolean
  has_attendance: boolean
  materials_open_early?: boolean
}

type SessionMaterial = { id: number; filename: string; content_type: string; size_bytes: number; created_at: string; download_url: string }
type SessionLearningLink = { id: number; title: string; url: string; created_at: string }

type AbsenceRequest = {
  id: number
  session_id: number
  reason: string
  has_evidence?: boolean
  evidence_filename?: string | null
  status: 'pending' | 'approved' | 'rejected'
  decision_reason: string | null
}

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getRange(anchor: Date, view: 'week' | 'month') {
  if (view === 'week') {
    const start = new Date(anchor)
    start.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
  }
  return {
    start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
    end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
  }
}

const calendarDateFormatter = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function AbsenceRequestModal({
  session,
  onClose,
  onSaved,
  notify,
}: {
  session: ScheduleSession
  onClose: () => void
  onSaved: (request: AbsenceRequest) => void
  notify?: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const values = new FormData(event.currentTarget)
    const file = values.get('evidence')
    let evidenceBase64: string | undefined
    if (file instanceof File && file.size) {
      if (file.size > 10 * 1024 * 1024) {
        setProblem('Tệp minh chứng không được vượt quá 10 MB.')
        setBusy(false)
        return
      }
      try {
        evidenceBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = () => reject(new Error('Không đọc được tệp minh chứng.'))
          reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
          reader.readAsDataURL(file)
        })
      } catch (error) {
        setProblem(showError(error))
        setBusy(false)
        return
      }
    }
    try {
      const request = await apiRequest<AbsenceRequest>(`/attendance/sessions/${session.id}/absence-requests`, {
        method: 'POST',
        body: JSON.stringify({
          reason: values.get('reason'),
          ...(evidenceBase64 ? {
            evidence_filename: (file as File).name,
            evidence_content_type: (file as File).type,
            evidence_base64: evidenceBase64,
          } : {}),
        }),
      })
      notify?.('Đã gửi đơn xin vắng thành công!')
      onSaved(request)
    } catch (error) {
      setProblem(showError(error))
      setBusy(false)
    }
  }

  return (
    <Modal eyebrow="ĐƠN XIN VẮNG" onClose={onClose} title={`${session.class_code} · ${session.session_date}`}>
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <label className="field"><span>Lý do xin vắng <b>*</b></span><textarea maxLength={2000} minLength={3} name="reason" required rows={4} /></label>
        <label className="field"><span>Tệp minh chứng (PDF/JPG/PNG/WebP, tối đa 10 MB)</span><input accept=".pdf,image/jpeg,image/png,image/webp" name="evidence" type="file" /></label>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose} type="button">Hủy</button>
          <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Đang gửi…' : 'Gửi đơn xin vắng'}</button>
        </div>
      </form>
    </Modal>
  )
}

function SessionMaterials({ session, canManage, isStudent, notify }: { session: ScheduleSession; canManage: boolean; isStudent: boolean; notify?: (message: string) => void }) {
  const [materials, setMaterials] = useState<SessionMaterial[]>([])
  const [links, setLinks] = useState<SessionLearningLink[]>([])
  const [filePage, setFilePage] = useState(1)
  const [linkPage, setLinkPage] = useState(1)
  const [fileTotal, setFileTotal] = useState(0)
  const [linkTotal, setLinkTotal] = useState(0)
  const [materialsOpenEarly, setMaterialsOpenEarly] = useState(Boolean(session.materials_open_early))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  const load = useCallback(async () => {
    try {
      const [fileResult, linkResult] = await Promise.all([
        apiRequestWithHeaders<SessionMaterial[]>(`/sessions/${session.id}/materials?page=${filePage}&page_size=20`),
        apiRequestWithHeaders<SessionLearningLink[]>(`/sessions/${session.id}/materials/links?page=${linkPage}&page_size=20`),
      ])
      setMaterials(fileResult.data)
      setLinks(linkResult.data)
      setFileTotal(paginationFromHeaders(fileResult.headers, { page: filePage, pageSize: 20 }).total)
      setLinkTotal(paginationFromHeaders(linkResult.headers, { page: linkPage, pageSize: 20 }).total)
      setProblem('')
    } catch (error) {
      setProblem(isStudent && error instanceof ApiError && error.status === 403
        ? 'Học liệu sẽ hiển thị khi buổi học bắt đầu hoặc khi giảng viên mở sớm.'
        : showError(error))
    }
  }, [filePage, isStudent, linkPage, session.id])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function upload(file?: File) {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { setProblem('Tệp học liệu không được vượt quá 20 MB.'); return }
    const safeName = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(0, 180) || 'learning-material'
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/sessions/${session.id}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': safeName },
        body: file,
      })
      notify?.('Đã tải học liệu lên buổi học.')
      setFilePage(1)
      await load()
    } catch (error) { setProblem(showError(error)) } finally { setBusy(false) }
  }

  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const url = String(form.get('url') ?? '').trim()
    let secureUrl = false
    try { secureUrl = new URL(url).protocol === 'https:' } catch { secureUrl = false }
    if (!title || !secureUrl) { setProblem('Liên kết học liệu phải dùng HTTPS.'); return }
    const formElement = event.currentTarget
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/sessions/${session.id}/materials/links`, { method: 'POST', body: JSON.stringify({ title, url }) })
      formElement.reset()
      notify?.('Đã thêm liên kết học liệu.')
      setLinkPage(1)
      await load()
    } catch (error) { setProblem(showError(error)) } finally { setBusy(false) }
  }

  async function setEarlyVisibility(value: boolean) {
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/sessions/${session.id}/materials/visibility`, { method: 'PATCH', body: JSON.stringify({ materials_open_early: value }) })
      setMaterialsOpenEarly(value)
    } catch (error) { setProblem(showError(error)) } finally { setBusy(false) }
  }

  async function download(item: SessionMaterial) {
    try {
      const blob = await apiBlobRequest(`/assignment-files/${item.id}`)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = item.filename
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (error) { setProblem(showError(error)) }
  }

  return <section className="panel session-materials"><div className="panel-heading"><div><span className="eyebrow">TÀI NGUYÊN BUỔI HỌC</span><h2>Học liệu</h2></div></div>
    {canManage ? <><label className="checkbox-field"><input checked={materialsOpenEarly} disabled={busy} onChange={(event) => void setEarlyVisibility(event.target.checked)} type="checkbox" /><span>Cho phép học viên xem học liệu trước giờ học</span></label><label className="button button-outline button-small">Tải tệp học liệu<input accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg,.webp,.txt" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} style={{ display: 'none' }} type="file" /></label><form className="form-inline" onSubmit={(event) => void addLink(event)}><label className="form-field"><span>Tên liên kết</span><input name="title" maxLength={200} required /></label><label className="form-field"><span>URL HTTPS</span><input name="url" pattern="https://.*" required type="url" /></label><button className="button button-outline button-small" disabled={busy} type="submit">Thêm liên kết</button></form></> : null}
    {problem ? <div className="form-alert error-alert" role="alert">{problem}</div> : null}
    <h3>Tệp đính kèm</h3>{materials.length ? <ul className="session-material-list">{materials.map((item) => <li key={item.id}><span>{item.filename} <small>({Math.ceil(item.size_bytes / 1024)} KB)</small></span><button className="text-button" onClick={() => void download(item)} type="button">Tải xuống</button></li>)}</ul> : <p className="muted-cell">Chưa có tệp học liệu.</p>}
    {fileTotal > 20 ? <ListPagination page={filePage} pageSize={20} total={fileTotal} onPageChange={setFilePage} /> : null}
    <h3>Liên kết tham khảo</h3>{links.length ? <ul className="session-material-list">{links.map((item) => <li key={item.id}><span>{item.title}</span><a href={item.url} rel="noreferrer" target="_blank">Mở liên kết</a></li>)}</ul> : <p className="muted-cell">Chưa có liên kết học liệu.</p>}
    {linkTotal > 20 ? <ListPagination page={linkPage} pageSize={20} total={linkTotal} onPageChange={setLinkPage} /> : null}
  </section>
}

function SessionDetailsModal({
  session,
  canManage,
  canManageMaterials,
  isStudent,
  onClose,
  onUpdated,
  notify,
  presentation = 'dialog',
}: {
  session: ScheduleSession
  canManage: boolean
  canManageMaterials: boolean
  isStudent: boolean
  onClose: () => void
  onUpdated: () => void
  notify?: (message: string) => void
  presentation?: 'dialog' | 'page'
}) {
  const [teachers, setTeachers] = useState<User[]>([])
  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([])
  const [myRequests, setMyRequests] = useState<AbsenceRequest[]>([])
  const [requestOpen, setRequestOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [overrideConflicts, setOverrideConflicts] = useState(false)

  useEffect(() => {
    if (canManage) {
      apiRequest<{ items: User[] }>('/accounts?role=teacher&page=1&page_size=100')
        .then((result) => setTeachers(result.items))
        .catch((error: unknown) => setProblem(showError(error)))
    }
    if (isStudent) {
      apiRequest<AbsenceRequest[]>('/me/absence-requests')
        .then((items) => setMyRequests(items.filter((item) => item.session_id === session.id)))
        .catch((error: unknown) => setProblem(showError(error)))
    } else {
      apiRequest<AbsenceRequest[]>(`/classes/${session.class_id}/absence-requests`)
        .then((items) => setAbsenceRequests(items.filter((item) => item.session_id === session.id)))
        .catch((error: unknown) => setProblem(showError(error)))
    }
  }, [canManage, isStudent, session.class_id, session.id])

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const isCancelled = values.get('is_cancelled') === 'true'
    const cancellationReason = String(values.get('cancellation_reason') ?? '')
    if (isCancelled && !cancellationReason.trim()) {
      setProblem('Hủy buổi học bắt buộc nhập lý do.')
      return
    }
    const body = {
      session_date: values.get('session_date'),
      start_time: values.get('start_time'),
      end_time: values.get('end_time'),
      teacher_id: Number(values.get('teacher_id')),
      room: values.get('room'),
      is_cancelled: isCancelled,
      cancellation_reason: isCancelled ? cancellationReason : null,
      allow_conflicts: overrideConflicts,
    }
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/schedule/sessions/${session.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      notify?.(isCancelled ? 'Đã hủy buổi học và gửi thông báo tới cả lớp.' : 'Đã cập nhật thông tin buổi học & thông báo tới lớp.')
      onUpdated()
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && !overrideConflicts) {
        setProblem(showError(error))
        if (window.confirm('Buổi học đang bị trùng. Quản lý có xác nhận ghi đè xung đột này không?')) {
          setOverrideConflicts(true)
        }
      } else {
        setProblem(showError(error))
      }
    } finally {
      setBusy(false)
    }
  }

  async function decide(request: AbsenceRequest, status: 'approved' | 'rejected') {
    const decisionReason = window.prompt(status === 'approved' ? 'Nhập ghi chú duyệt đơn:' : 'Nhập lý do từ chối đơn:')
    if (!decisionReason?.trim()) return
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/absence-requests/${request.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, decision_reason: decisionReason.trim() }),
      })
      notify?.(status === 'approved' ? 'Đã phê duyệt đơn xin vắng.' : 'Đã từ chối đơn xin vắng.')
      setAbsenceRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, decision_reason: decisionReason.trim() } : item))
      onUpdated()
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function downloadEvidence(request: AbsenceRequest) {
    try {
      const file = await apiBlobRequest(`/absence-requests/${request.id}/evidence`)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = request.evidence_filename || `minh-chung-${request.id}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setProblem(showError(error))
    }
  }

  return (
    <>
      <Modal
        backHref={presentation === 'page' ? `/schedule?date=${session.session_date}` : undefined}
        eyebrow={`${session.class_code} · ${session.course_name}`}
        onClose={onClose}
        presentation={presentation}
        size="large"
        title="Chi tiết buổi học"
      >
        <div className="schedule-session-detail" style={{ padding: '4px 0' }}>
          {/* Compact Overview Card with Right-Aligned Absence Button on Desktop */}
          <div
            className="session-hero-card"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="role-pill" style={{ background: '#e0e7ff', color: '#4338ca', fontWeight: 700 }}>
                  {session.class_code}
                </span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  {session.course_name} ({session.course_code})
                </span>
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#0f172a' }}>
                {session.lesson_title
                  ? `Buổi ${session.lesson_sequence}: ${session.lesson_title}`
                  : 'Buổi học theo lịch đào tạo'}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '13px', color: '#334155' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  📅 <strong>{new Date(session.session_date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  ⏰ <strong>{session.start_time} – {session.end_time}</strong>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  📍 Phòng <strong>{session.room}</strong>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  👨‍🏫 GV: <strong>{session.teacher_name}</strong>
                </span>
              </div>
            </div>

            {isStudent && !session.is_cancelled ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <button
                  className="button button-primary button-small"
                  onClick={() => setRequestOpen(true)}
                  style={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                  type="button"
                >
                  <UiIcon name="edit" size={15} /> Gửi đơn xin vắng
                </button>
                {myRequests.length ? (
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Đã nộp {myRequests.length} đơn
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {session.is_cancelled ? (
            <div className="form-alert error-alert" style={{ marginBottom: '16px' }}>
              <strong>Buổi học đã hủy:</strong> {session.cancellation_reason || 'Giảng viên bận đột xuất'}
            </div>
          ) : null}
          {session.conflict_override ? (
            <div className="form-alert info-alert" style={{ marginBottom: '16px' }}>
              Lịch đã được lưu với xác nhận ghi đè xung đột.
            </div>
          ) : null}
          {session.has_attendance ? (
            <div className="form-alert info-alert" style={{ marginBottom: '16px' }}>
              Buổi học đã điểm danh và bị khóa chỉnh sửa.
            </div>
          ) : null}

          {(isStudent || canManageMaterials) ? <SessionMaterials session={session} canManage={canManageMaterials} isStudent={isStudent} notify={notify} /> : null}

          {isStudent && myRequests.length > 0 ? (
            <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                Lịch sử đơn xin vắng buổi này của bạn:
              </strong>
              {myRequests.map((request) => (
                <div key={request.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #e2e8f0', fontSize: '13px' }}>
                  <span>Lý do: <em>{request.reason}</em></span>
                  <span className={`status-pill ${request.status === 'approved' ? 'status-active' : request.status === 'rejected' ? 'status-inactive' : 'status-pending'}`}>
                    {request.status === 'approved' ? '✓ Đã duyệt' : request.status === 'rejected' ? '✕ Từ chối' : '⏳ Chờ duyệt'}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {canManage && !session.has_attendance ? (
            <form className="dialog-form" onSubmit={(event) => void update(event)}>
              <div style={{ margin: '14px 0 8px', padding: '10px 14px', background: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--blue, #0054a6)', display: 'flex' }}><UiIcon name="edit" size={18} /></span>
                <div>
                  <strong style={{ color: '#1e3a8a', fontSize: '14px' }}>ĐIỀU CHỈNH BUỔI HỌC (SỬA GIỜ · DỜI NGÀY · ĐỔI GV · HỦY BUỔI)</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#475569' }}>
                    Dành cho Quản lý đào tạo: Xử lý tình huống giảng viên báo bận đột xuất. Khi lưu thay đổi hoặc hủy buổi, hệ thống sẽ tự động gửi thông báo cập nhật tới toàn bộ học viên trong lớp.
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <label className="field"><span>Ngày học (Dời lịch sang ngày khác) <b>*</b></span><input defaultValue={session.session_date} name="session_date" required type="date" /></label>
                <label className="field"><span>Giảng viên dạy thay (Nếu GV chính bận)</span><SearchableSelect ariaLabel="Substitute instructor" defaultValue={String(session.teacher_id)} name="teacher_id" options={teachers.map((teacher) => ({ value: String(teacher.id), label: teacher.full_name }))} placeholder="Choose an instructor" /></label>
                <label className="field"><span>Giờ bắt đầu <b>*</b></span><input defaultValue={session.start_time} name="start_time" required type="time" /></label>
                <label className="field"><span>Giờ kết thúc <b>*</b></span><input defaultValue={session.end_time} name="end_time" required type="time" /></label>
                <label className="field"><span>Phòng học <b>*</b></span><input defaultValue={session.room} maxLength={80} name="room" required /></label>
                <label className="field"><span>Hủy buổi học này</span><select defaultValue={String(session.is_cancelled)} name="is_cancelled"><option value="false">Không (Buổi học diễn ra bình thường)</option><option value="true">Có (Hủy buổi học - GV bận đột xuất)</option></select></label>
                <label className="field field-span-2"><span>Lý do hủy (bắt buộc khi chọn hủy — sẽ gửi thông báo đến học viên)</span><textarea defaultValue={session.cancellation_reason ?? ''} maxLength={1000} name="cancellation_reason" placeholder="Ví dụ: Giảng viên báo bận đột xuất, lớp sẽ được sắp xếp lịch học bù sau..." rows={2} /></label>
              </div>
              {problem ? <div className="form-alert error-alert">{problem}</div> : null}
              <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu thay đổi & Thông báo cho lớp'}</button>
            </form>
          ) : null}

          {!isStudent ? (
            <section className="lead-activity" style={{ marginTop: '16px' }}>
              <h3>Đơn xin vắng ({absenceRequests.length})</h3>
              {absenceRequests.map((request) => (
                <article className="syllabus-row" key={request.id}>
                  <strong>Đơn #{request.id} · {request.status}</strong><p>{request.reason}</p>
                  {request.decision_reason ? <small>{request.decision_reason}</small> : null}
                  {request.has_evidence ? <button className="text-button" onClick={() => void downloadEvidence(request)} type="button">Tải minh chứng: {request.evidence_filename}</button> : null}
                  {request.status === 'pending' ? (
                    <div className="row-actions">
                      <button className="button button-outline button-small" disabled={busy} onClick={() => void decide(request, 'approved')} type="button">Duyệt</button>
                      <button className="button button-danger button-small" disabled={busy} onClick={() => void decide(request, 'rejected')} type="button">Từ chối</button>
                    </div>
                  ) : null}
                </article>
              ))}
              {!absenceRequests.length ? <p style={{ color: '#94a3b8', fontSize: '13px' }}>Chưa có đơn xin vắng cho buổi này.</p> : null}
            </section>
          ) : null}

          {presentation === 'dialog' ? <div className="modal-actions"><button className="button button-outline" onClick={onClose} type="button">Đóng</button></div> : null}
        </div>
      </Modal>
      {requestOpen ? (
        <AbsenceRequestModal
          notify={notify}
          onClose={() => setRequestOpen(false)}
          onSaved={(request) => {
            setRequestOpen(false)
            setMyRequests((current) => [...current, request])
          }}
          session={session}
        />
      ) : null}
    </>
  )
}

export function SchedulePage({
  user,
  notify,
}: {
  user: User
  notify: (message: string) => void
}) {
  const [sessions, setSessions] = useState<ScheduleSession[]>([])
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(() => {
    const initialDate = new URLSearchParams(window.location.search).get('date')
    return initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
      ? parseDate(initialDate)
      : new Date()
  })
  const [classFilter, setClassFilter] = useState(() => {
    const classId = new URLSearchParams(window.location.search).get('class_id')
    return classId && /^\d+$/.test(classId) ? classId : ''
  })
  const [teacherFilter, setTeacherFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const isStudent = user.roles.includes('student') && !user.roles.some((role) => ['admin', 'manager'].includes(role))
  const range = useMemo(() => getRange(anchor, view), [anchor, view])

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({
      start_date: dateInput(range.start),
      end_date: dateInput(range.end),
    })
    if (classFilter) query.set('class_id', classFilter)
    if (teacherFilter) query.set('teacher_id', teacherFilter)
    if (roomFilter) query.set('room', roomFilter)
    const path = isStudent ? `/me/schedule?${query}` : `/schedule/sessions?${query}`
    Promise.all([
      apiRequest<ScheduleSession[]>(path),
      isStudent ? Promise.resolve([] as TrainingClass[]) : apiRequest<TrainingClass[]>('/classes'),
    ])
      .then(([result, classItems]) => {
        if (!active) return
        setSessions(result)
        setClasses(classItems)
        setProblem('')
      })
      .catch((error: unknown) => {
        if (active) {
          setProblem(showError(error))
          notify(showError(error))
        }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [classFilter, isStudent, notify, range.start, range.end, roomFilter, teacherFilter])

  const teachers = [...new Map(sessions.map((item) => [item.teacher_id, { id: item.teacher_id, name: item.teacher_name }])).values()]
  const rooms = [...new Set(sessions.map((item) => item.room))].sort()
  const [todayStr] = useState(() => dateInput(new Date()))
  const nextUpcomingSession = useMemo(() => {
    if (!isStudent) return null
    return (
      sessions
        .filter((s) => s.session_date >= todayStr && !s.is_cancelled)
        .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.start_time.localeCompare(b.start_time))[0] ?? null
    )
  }, [isStudent, sessions, todayStr])
  const calendarDays = useMemo(() => {
    if (view === 'week') {
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(range.start)
        day.setDate(day.getDate() + index)
        return day
      })
    }
    const start = new Date(range.start)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [range.start, view])

  function moveRange(amount: number) {
    const next = new Date(anchor)
    next.setDate(next.getDate() + (view === 'week' ? amount * 7 : amount * 30))
    setAnchor(next)
  }

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">{isStudent ? 'LỊCH HỌC CÁ NHÂN' : 'KẾ HOẠCH HỌC TẬP'}</span>
          <h1>Thời khóa biểu</h1>
          <p>{isStudent ? 'Chỉ hiển thị các buổi thuộc lớp bạn đang theo học.' : 'Lịch các buổi học thực tế, có thể lọc và xem theo tuần hoặc tháng.'}</p>
        </div>
        <button className="button button-outline" onClick={() => window.print()} type="button"><UiIcon name="download" size={17} /> In thời khóa biểu</button>
      </div>
      {!isStudent ? (
        <div className="schedule-manager-banner" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#4c1d95', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>💡</span>
          <div>
            <strong>Dành cho Quản lý đào tạo:</strong> Để <strong>Sửa giờ, Dời ngày, Chọn giảng viên dạy thay hoặc Hủy buổi học</strong> (khi GV báo bận đột xuất), bạn hãy <u>bấm trực tiếp vào ô buổi học</u> tương ứng trên lịch bên dưới. Hệ thống sẽ mở biểu mẫu cập nhật và tự động gửi thông báo đến học viên của lớp.
          </div>
        </div>
      ) : null}
      {isStudent && nextUpcomingSession ? (
        <section className="next-session-banner" style={{ background: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'var(--blue, #0054a6)', color: 'white', borderRadius: '10px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UiIcon name="calendar" size={24} />
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue, #0054a6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buổi học kế tiếp</span>
              <h3 style={{ margin: '2px 0', fontSize: '16px', color: '#1e1b4b' }}>{nextUpcomingSession.course_name} ({nextUpcomingSession.class_code})</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#4338ca' }}>
                <strong>{nextUpcomingSession.weekday}, {new Date(nextUpcomingSession.session_date).toLocaleDateString('vi-VN')}</strong> · {nextUpcomingSession.start_time}–{nextUpcomingSession.end_time} · Phòng <strong>{nextUpcomingSession.room}</strong> · GV: {nextUpcomingSession.teacher_name}
              </p>
              {nextUpcomingSession.lesson_title ? <small style={{ color: '#6366f1' }}>Nội dung: {nextUpcomingSession.lesson_title}</small> : null}
            </div>
          </div>
          <button
            className="button button-primary button-small"
            onClick={() => navigateTo(`/schedule/sessions/${nextUpcomingSession.id}?date=${nextUpcomingSession.session_date}`)}
            type="button"
          >
            Chi tiết / Xin vắng
          </button>
        </section>
      ) : null}
      {!isStudent ? (
        <div className="page-toolbar schedule-filters">
          <label className="field"><span>Class</span><SearchableSelect ariaLabel="Class filter" onChange={setClassFilter} options={classes.map((item) => ({ value: String(item.id), label: item.code }))} placeholder="All classes" value={classFilter} /></label>
          <label className="field"><span>Instructor</span><SearchableSelect ariaLabel="Instructor filter" onChange={setTeacherFilter} options={teachers.map((item) => ({ value: String(item.id), label: item.name }))} placeholder="All instructors" value={teacherFilter} /></label>
          <label className="field"><span>Classroom</span><SearchableSelect ariaLabel="Classroom filter" onChange={setRoomFilter} options={rooms.map((room) => ({ value: room, label: room }))} placeholder="All classrooms" value={roomFilter} /></label>
        </div>
      ) : null}
      <div className="schedule-top-card schedule-calendar-controls">
        <div className="schedule-week-picker">
          <button aria-label="Khoảng thời gian trước" className="button button-outline button-small" onClick={() => moveRange(-1)} type="button">‹</button>
          <input aria-label="Chọn ngày" onChange={(event) => setAnchor(parseDate(event.target.value))} type="date" value={dateInput(anchor)} />
          <button aria-label="Khoảng thời gian sau" className="button button-outline button-small" onClick={() => moveRange(1)} type="button">›</button>
          <button className={`day-filter ${view === 'week' ? 'day-filter-active' : ''}`} onClick={() => setView('week')} type="button">Tuần</button>
          <button className={`day-filter ${view === 'month' ? 'day-filter-active' : ''}`} onClick={() => setView('month')} type="button">Tháng</button>
        </div>
        <small className="schedule-range-label">
          {view === 'week'
            ? `${calendarDateFormatter.format(range.start)} – ${calendarDateFormatter.format(range.end)}`
            : range.start.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
        </small>
      </div>
      {problem ? <div className="inline-error">{problem}</div> : null}
      {loading ? <div className="panel schedule-loading">Đang tải thời khóa biểu…</div> : null}
      {!loading ? (
        <section className={`schedule-calendar-grid ${view === 'month' ? 'schedule-calendar-month' : ''}`}>
          {calendarDays.map((day) => {
            const dayKey = dateInput(day)
            const daySessions = sessions.filter((item) => item.session_date === dayKey)
            return (
              <article className={`schedule-calendar-day ${view === 'month' && day.getMonth() !== anchor.getMonth() ? 'schedule-day-outside' : ''}`} key={dayKey}>
                <header className="schedule-calendar-day-heading">
                  <span>{day.toLocaleDateString('vi-VN', { weekday: 'long' })}</span>
                  <strong>{day.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                  <small>{daySessions.length} buổi</small>
                </header>
                <div className="schedule-calendar-day-events">
                  {daySessions.map((item, index) => (
                    <button className={`schedule-calendar-event schedule-event-tone-${index % 4} ${item.is_cancelled ? 'schedule-event-cancelled' : ''}`} key={item.id} onClick={() => navigateTo(`/schedule/sessions/${item.id}?date=${item.session_date}`)} type="button">
                      <span className="schedule-event-topline"><time>{item.start_time}–{item.end_time}</time><span>{item.class_code}</span></span>
                      <strong>{item.course_name}</strong>
                      <small className="schedule-course-code">{item.course_code} · {item.lesson_title ? `Buổi ${item.lesson_sequence}: ${item.lesson_title}` : 'Lớp học phần'}</small>
                      <span className="schedule-event-chips">
                        <span className="schedule-event-chip schedule-room-chip"><UiIcon name="location" size={13} />{item.room}</span>
                        <span className="schedule-event-chip schedule-teacher-chip"><UiIcon name="teachers" size={13} />{item.teacher_name}</span>
                      </span>
                      {item.is_cancelled ? (
                        <span className="schedule-event-cancel-tag" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, display: 'inline-block', marginTop: '4px' }}>
                          Đã hủy: {item.cancellation_reason || 'Bận đột xuất'}
                        </span>
                      ) : null}
                      {!isStudent && !item.is_cancelled ? (
                        <span style={{ marginTop: '5px', fontSize: '11px', color: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <UiIcon name="edit" size={12} /> Bấm để Sửa / Dời / Hủy
                        </span>
                      ) : null}
                    </button>
                  ))}
                  {!daySessions.length ? <span className="schedule-calendar-empty">Chưa có buổi học</span> : null}
                </div>
              </article>
            )
          })}
        </section>
      ) : null}
      {!loading && !sessions.length ? <section className="panel schedule-empty"><div className="empty-icon"><UiIcon name="calendar" size={23} /></div><strong>Chưa có buổi học trong khoảng thời gian này</strong><span>{isStudent ? 'Các buổi học đã được xếp của lớp bạn sẽ xuất hiện ở đây.' : 'Chọn khoảng thời gian khác hoặc xếp lịch cho lớp học phần.'}</span></section> : null}
    </div>
  )
}

export function ScheduleSessionPage({
  sessionId,
  user,
  notify,
}: {
  sessionId: number
  user: User
  notify: (message: string) => void
}) {
  const [session, setSession] = useState<ScheduleSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [refresh, setRefresh] = useState(0)
  const isStudent = user.roles.includes('student') && !user.roles.some((role) => ['admin', 'manager'].includes(role))
  const canManage = user.roles.some((role) => ['admin', 'manager'].includes(role))

  useEffect(() => {
    let active = true
    apiRequest<ScheduleSession>(`/schedule/sessions/${sessionId}`)
      .then((data) => {
        if (active) {
          setSession(data)
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
  }, [refresh, sessionId])

  if (loading) return <section className="panel detail-loading">Đang tải chi tiết buổi học…</section>
  if (!session) {
    return (
      <section className="page-stack">
        <div className="form-alert error-alert">{problem || 'Không tìm thấy buổi học.'}</div>
        <button className="button button-outline" onClick={() => navigateTo('/schedule')} type="button">
          Quay lại thời khóa biểu
        </button>
      </section>
    )
  }

  return (
    <SessionDetailsModal
      canManage={canManage}
      canManageMaterials={user.roles.some((role) => ['admin', 'manager', 'teacher', 'ta'].includes(role))}
      isStudent={isStudent}
      notify={notify}
      onClose={() => navigateTo(`/schedule?date=${session.session_date}`)}
      onUpdated={() => {
        setLoading(true)
        setRefresh((current) => current + 1)
      }}
      presentation="page"
      session={session}
    />
  )
}
