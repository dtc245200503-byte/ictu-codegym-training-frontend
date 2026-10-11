import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { ApiError, apiBlobRequest, apiRequest } from '../api'
import { Modal, UiIcon } from '../components/Ui'
import { showError } from '../format'
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
}

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
}: {
  session: ScheduleSession
  onClose: () => void
  onSaved: (request: AbsenceRequest) => void
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

function SessionDetailsModal({
  session,
  canManage,
  isStudent,
  onClose,
  onUpdated,
}: {
  session: ScheduleSession
  canManage: boolean
  isStudent: boolean
  onClose: () => void
  onUpdated: () => void
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
      <Modal eyebrow={`${session.class_code} · ${session.course_name}`} onClose={onClose} size="large" title="Chi tiết buổi học">
        <div className="schedule-session-detail">
          <p><strong>{session.session_date}</strong> · {session.start_time}–{session.end_time} · {session.room}</p>
          <p>{session.lesson_title ? `Buổi ${session.lesson_sequence}: ${session.lesson_title}` : 'Chưa gắn bài học syllabus'}</p>
          <p>Giảng viên: {session.teacher_name}</p>
          {session.is_cancelled ? <div className="form-alert error-alert">Đã hủy: {session.cancellation_reason}</div> : null}
          {session.conflict_override ? <div className="form-alert info-alert">Lịch đã được lưu với xác nhận ghi đè xung đột.</div> : null}
          {canManage && !session.has_attendance ? (
            <form className="dialog-form" onSubmit={(event) => void update(event)}>
              <div className="form-grid">
                <label className="field"><span>Ngày</span><input defaultValue={session.session_date} name="session_date" required type="date" /></label>
                <label className="field"><span>Giảng viên dạy thay</span><select defaultValue={session.teacher_id} name="teacher_id">{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select></label>
                <label className="field"><span>Bắt đầu</span><input defaultValue={session.start_time} name="start_time" required type="time" /></label>
                <label className="field"><span>Kết thúc</span><input defaultValue={session.end_time} name="end_time" required type="time" /></label>
                <label className="field"><span>Phòng</span><input defaultValue={session.room} maxLength={80} name="room" required /></label>
                <label className="field"><span>Hủy buổi học</span><select defaultValue={String(session.is_cancelled)} name="is_cancelled"><option value="false">Không</option><option value="true">Có</option></select></label>
                <label className="field field-span-2"><span>Lý do hủy (bắt buộc khi hủy)</span><textarea defaultValue={session.cancellation_reason ?? ''} maxLength={1000} name="cancellation_reason" rows={2} /></label>
              </div>
              {session.has_attendance ? <div className="form-alert info-alert">Buổi học đã điểm danh và bị khóa chỉnh sửa.</div> : null}
              {problem ? <div className="form-alert error-alert">{problem}</div> : null}
              <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu thay đổi buổi học'}</button>
            </form>
          ) : null}
          {session.has_attendance && canManage ? <div className="form-alert info-alert">Buổi đã điểm danh, không thể sửa hoặc hủy.</div> : null}
          {isStudent && !session.is_cancelled ? (
            <div className="panel">
              <button className="button button-outline" onClick={() => setRequestOpen(true)} type="button">Gửi đơn xin vắng</button>
              {myRequests.map((request) => <p key={request.id}>Đơn: {request.status}{request.decision_reason ? ` · ${request.decision_reason}` : ''}</p>)}
            </div>
          ) : null}
          {!isStudent ? (
            <section className="lead-activity">
              <h3>Đơn xin vắng</h3>
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
              {!absenceRequests.length ? <p>Chưa có đơn xin vắng cho buổi này.</p> : null}
            </section>
          ) : null}
          <div className="modal-actions"><button className="button button-outline" onClick={onClose} type="button">Đóng</button></div>
        </div>
      </Modal>
      {requestOpen ? <AbsenceRequestModal session={session} onClose={() => setRequestOpen(false)} onSaved={(request) => { setRequestOpen(false); setMyRequests((current) => [...current, request]) }} /> : null}
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
  const [anchor, setAnchor] = useState(() => new Date())
  const [classFilter, setClassFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState('')
  const [selected, setSelected] = useState<ScheduleSession | null>(null)
  const [refresh, setRefresh] = useState(0)
  const isStudent = user.roles.includes('student') && !user.roles.some((role) => ['admin', 'manager'].includes(role))
  const canManage = user.roles.some((role) => ['admin', 'manager'].includes(role))
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
  }, [classFilter, isStudent, notify, range.start, range.end, refresh, roomFilter, teacherFilter])

  const teachers = [...new Map(sessions.map((item) => [item.teacher_id, { id: item.teacher_id, name: item.teacher_name }])).values()]
  const rooms = [...new Set(sessions.map((item) => item.room))].sort()
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
        <div className="page-toolbar schedule-filters">
          <label className="field"><span>Lớp học</span><select onChange={(event) => setClassFilter(event.target.value)} value={classFilter}><option value="">Tất cả lớp</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label className="field"><span>Giảng viên</span><select onChange={(event) => setTeacherFilter(event.target.value)} value={teacherFilter}><option value="">Tất cả giảng viên</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="field"><span>Phòng học</span><select onChange={(event) => setRoomFilter(event.target.value)} value={roomFilter}><option value="">Tất cả phòng</option>{rooms.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
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
                    <button className={`schedule-calendar-event schedule-event-tone-${index % 4} ${item.is_cancelled ? 'schedule-event-cancelled' : ''}`} key={item.id} onClick={() => setSelected(item)} type="button">
                      <span className="schedule-event-topline"><time>{item.start_time}–{item.end_time}</time><span>{item.class_code}</span></span>
                      <strong>{item.course_name}</strong>
                      <small className="schedule-course-code">{item.course_code} · {item.lesson_title ? `Buổi ${item.lesson_sequence}: ${item.lesson_title}` : 'Lớp học phần'}</small>
                      <span className="schedule-event-chips">
                        <span className="schedule-event-chip schedule-room-chip"><UiIcon name="location" size={13} />{item.room}</span>
                        <span className="schedule-event-chip schedule-teacher-chip"><UiIcon name="teachers" size={13} />{item.teacher_name}</span>
                      </span>
                      {item.is_cancelled ? <span className="schedule-event-cancel-tag">Đã hủy</span> : null}
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
      {selected ? <SessionDetailsModal
        canManage={canManage}
        isStudent={isStudent}
        onClose={() => setSelected(null)}
        onUpdated={() => {
          setSelected(null)
          setRefresh((current) => current + 1)
        }}
        session={selected}
      /> : null}
    </div>
  )
}
