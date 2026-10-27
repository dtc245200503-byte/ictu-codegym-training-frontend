import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest } from '../api'
import { SearchableSelect } from '../components/ListControls'
import { UiIcon } from '../components/Ui'
import { showError } from '../format'
import type { Classroom, TrainingClass, User } from '../types'

const weekdayOptions = [
  { label: 'Thứ Hai', value: 0 },
  { label: 'Thứ Ba', value: 1 },
  { label: 'Thứ Tư', value: 2 },
  { label: 'Thứ Năm', value: 3 },
  { label: 'Thứ Sáu', value: 4 },
  { label: 'Thứ Bảy', value: 5 },
  { label: 'Chủ Nhật', value: 6 },
]

type PreviewSession = {
  session_date: string
  weekday: string
  start_time: string
  end_time: string
  teacher_id: number
  teacher_name: string
  room: string
  lesson_id: number | null
  lesson_sequence: number
  lesson_title: string
  conflicts: {
    class_id: number
    class_code: string
    teacher_conflict: boolean
    room_conflict: boolean
    start_time: string
    end_time: string
  }[]
}

type PreviewResult = {
  class_id: number
  session_count: number
  conflict_count: number
  sessions: PreviewSession[]
}

type Holiday = {
  id: number
  holiday_date: string
  name: string
}

export function AutoSchedulePage({
  user: _user,
  notify,
  classId,
}: {
  user?: User
  notify: (msg: string) => void
  classId?: number
}) {
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [rooms, setRooms] = useState<Classroom[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loadingInitial, setLoadingInitial] = useState(true)

  // Query param class_id
  const urlClassId = new URLSearchParams(window.location.search).get('class_id')
  const [selectedClassId, setSelectedClassId] = useState<number | null>(
    classId || (urlClassId ? Number(urlClassId) : null),
  )

  // Form states
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().slice(0, 10)
  })
  const [weekdays, setWeekdays] = useState<number[]>([0, 2, 4]) // Default Mon-Wed-Fri
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('10:00')
  const [sessionCount, setSessionCount] = useState<number>(60) // Default 60 sessions
  const [assignedTeacherId, setAssignedTeacherId] = useState<number | ''>('')
  const [assignedRoom, setAssignedRoom] = useState<string>('')
  const [allowConflicts, setAllowConflicts] = useState(false)

  // Holidays
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')
  const [addingHoliday, setAddingHoliday] = useState(false)
  const [holidaysOpen, setHolidaysOpen] = useState(false)

  // Preview & Submit states
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')
  const [successSavedCount, setSuccessSavedCount] = useState<number | null>(null)

  // Load classes, rooms, teachers, holidays
  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<TrainingClass[]>('/classes'),
      apiRequest<Classroom[]>('/rooms'),
      apiRequest<{ items: User[] }>('/accounts?role=teacher&page_size=100').then((r) => r.items),
      apiRequest<Holiday[]>('/schedule/holidays'),
    ])
      .then(([classList, roomList, teacherList, holidayList]) => {
        if (!active) return
        setClasses(classList)
        setRooms(roomList)
        setTeachers(teacherList)
        setHolidays(holidayList)

        // Preselect class if in query param or first available
        const targetId = classId || (urlClassId ? Number(urlClassId) : null)
        if (targetId) {
          const found = classList.find((c) => c.id === targetId)
          if (found) {
            setSelectedClassId(found.id)
            setAssignedTeacherId(found.teacher_id)
            setAssignedRoom(found.room)
            setStartTime(found.start_time)
            setEndTime(found.end_time)
            setWeekdays([found.day_of_week])
          }
        } else if (classList.length > 0) {
          setSelectedClassId(classList[0].id)
          setAssignedTeacherId(classList[0].teacher_id)
          setAssignedRoom(classList[0].room)
          setStartTime(classList[0].start_time)
          setEndTime(classList[0].end_time)
          setWeekdays([classList[0].day_of_week])
        }
      })
      .catch((err: unknown) => {
        if (active) setProblem(showError(err))
      })
      .finally(() => {
        if (active) setLoadingInitial(false)
      })

    return () => {
      active = false
    }
  }, [classId, urlClassId])

  const selectedClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) ?? null
  }, [classes, selectedClassId])

  // When selected class changes
  function handleClassChange(id: number) {
    setSelectedClassId(id)
    setPreview(null)
    setSuccessSavedCount(null)
    const found = classes.find((c) => c.id === id)
    if (found) {
      setAssignedTeacherId(found.teacher_id)
      setAssignedRoom(found.room)
      setStartTime(found.start_time)
      setEndTime(found.end_time)
      if (!weekdays.includes(found.day_of_week)) {
        setWeekdays([found.day_of_week])
      }
    }
  }

  // Weekday presets
  function applyWeekdayPreset(preset: '246' | '357' | 'weekend' | 'all') {
    if (preset === '246') setWeekdays([0, 2, 4])
    else if (preset === '357') setWeekdays([1, 3, 5])
    else if (preset === 'weekend') setWeekdays([5, 6])
    else if (preset === 'all') setWeekdays([0, 1, 2, 3, 4])
    setPreview(null)
  }

  function toggleWeekday(day: number) {
    setWeekdays((curr) =>
      curr.includes(day) ? curr.filter((d) => d !== day) : [...curr, day].sort((a, b) => a - b),
    )
    setPreview(null)
  }

  // Add holiday
  async function handleAddHoliday(event: FormEvent) {
    event.preventDefault()
    if (!newHolidayDate || !newHolidayName.trim()) return
    setAddingHoliday(true)
    setProblem('')
    try {
      const created = await apiRequest<Holiday>('/schedule/holidays', {
        method: 'POST',
        body: JSON.stringify({
          holiday_date: newHolidayDate,
          name: newHolidayName.trim(),
        }),
      })
      setHolidays((prev) => [...prev, created].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)))
      setNewHolidayDate('')
      setNewHolidayName('')
      notify('Đã thêm ngày nghỉ lễ.')
      setPreview(null)
    } catch (err) {
      setProblem(showError(err))
    } finally {
      setAddingHoliday(false)
    }
  }

  // Remove holiday
  async function handleRemoveHoliday(id: number) {
    try {
      await apiRequest(`/schedule/holidays/${id}`, { method: 'DELETE' })
      setHolidays((prev) => prev.filter((h) => h.id !== id))
      notify('Đã xóa ngày nghỉ.')
      setPreview(null)
    } catch (err) {
      setProblem(showError(err))
    }
  }

  // Generate Preview
  async function handlePreview(event: FormEvent) {
    event.preventDefault()
    if (!selectedClassId) {
      setProblem('Vui lòng chọn lớp học cần xếp lịch.')
      return
    }
    if (!weekdays.length) {
      setProblem('Vui lòng chọn ít nhất một thứ trong tuần.')
      return
    }
    if (sessionCount <= 0 || sessionCount > 120) {
      setProblem('Số buổi học phải từ 1 đến 120 buổi.')
      return
    }
    if (endTime <= startTime) {
      setProblem('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }

    setPreviewLoading(true)
    setProblem('')
    setSuccessSavedCount(null)

    try {
      const payload = {
        weekdays,
        start_date: startDate,
        session_count: sessionCount,
        start_time: startTime,
        end_time: endTime,
        teacher_id: assignedTeacherId ? Number(assignedTeacherId) : undefined,
        room: assignedRoom || undefined,
        allow_conflicts: false,
      }
      const result = await apiRequest<PreviewResult>(
        `/classes/${selectedClassId}/sessions/preview`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )
      setPreview(result)
    } catch (err) {
      setProblem(showError(err))
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  // Confirm Save
  async function handleSaveSchedule() {
    if (!selectedClassId || !preview) return
    if (preview.conflict_count > 0 && !allowConflicts) {
      setProblem(
        `Phát hiện ${preview.conflict_count} buổi học có xung đột! Vui lòng tích chọn "Xác nhận ghi đè xung đột" để tiếp tục lưu.`,
      )
      return
    }

    setSaving(true)
    setProblem('')

    try {
      const payload = {
        weekdays,
        start_date: startDate,
        session_count: sessionCount,
        start_time: startTime,
        end_time: endTime,
        teacher_id: assignedTeacherId ? Number(assignedTeacherId) : undefined,
        room: assignedRoom || undefined,
        allow_conflicts: allowConflicts,
      }
      const result = await apiRequest<{ created_count: number }>(
        `/classes/${selectedClassId}/sessions`,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      )
      setSuccessSavedCount(result.created_count)
      notify(`Đã lưu thành công ${result.created_count} buổi học vào cơ sở dữ liệu!`)
      setPreview(null)
    } catch (err) {
      setProblem(showError(err))
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return (
      <section className="page-section">
        <div className="table-loading">Đang tải dữ liệu lớp học và tài nguyên…</div>
      </section>
    )
  }

  return (
    <section className="page-section auto-schedule-page">
      {/* Breadcrumb & Header */}
      <div className="breadcrumb">
        <a href="/schedule" style={{ color: 'inherit', textDecoration: 'none' }}>Thời khóa biểu</a>
        <span className="breadcrumb-divider">/</span>
        <strong>Sinh thời khóa biểu</strong>
      </div>

      <div className="page-title-row" style={{ marginBottom: '16px' }}>
        <div>
          <span className="eyebrow">QUẢN LÝ THỜI KHÓA BIỂU</span>
          <h1>Sinh thời khóa biểu</h1>
          <p>Tạo lịch học định kỳ theo mẫu lặp tuần, tự động liên kết môn học và kiểm tra xung đột phòng/giảng viên.</p>
        </div>
      </div>

      {problem ? (
        <div className="form-alert error-alert" style={{ marginBottom: '16px' }}>
          <strong>Lỗi:</strong> {problem}
        </div>
      ) : null}

      {successSavedCount !== null ? (
        <div
          className="form-alert success-alert"
          style={{
            marginBottom: '16px',
            backgroundColor: '#ecfdf5',
            borderColor: '#a7f3d0',
            color: '#065f46',
            padding: '16px',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>✓</span>
            <div>
              <strong style={{ fontSize: '15px', display: 'block' }}>
                Đã sinh thành công {successSavedCount} buổi học cho lớp {selectedClass?.code}!
              </strong>
              <span style={{ fontSize: '13px' }}>
                Toàn bộ các buổi học đã được ghi nhận vào hệ thống đào tạo và gửi thông báo tới học viên.
              </span>
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
            <a className="button button-small button-primary" href="/schedule">
              Xem Thời khóa biểu
            </a>
            {selectedClass ? (
              <a className="button button-small button-outline" href={`/classes/${selectedClass.id}/students`}>
                Xem chi tiết lớp học
              </a>
            ) : null}
            <button
              className="button button-small button-outline"
              onClick={() => setSuccessSavedCount(null)}
              type="button"
            >
              Tiếp tục xếp lịch
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handlePreview}>
        {/* Bước 1 — Chọn lớp */}
        <div className="workflow-step">
          <div className="workflow-step-header">
            <span className="step-badge">1</span>
            <span className="step-title-text">Chọn lớp học</span>
            <span className="step-desc-text">Chọn lớp học phần để áp dụng lịch học</span>
          </div>
          <div className="workflow-step-body">
            <label className="field" style={{ marginBottom: selectedClass ? '12px' : 0 }}>
              <span>Lớp học phần cần xếp lịch <b className="required-star">*</b></span>
              <SearchableSelect ariaLabel="Class to schedule" onChange={(value) => handleClassChange(Number(value))} options={classes.map((item) => ({ value: String(item.id), label: `${item.code} - ${item.name} (${item.course_name})` }))} placeholder="Choose a class" required value={String(selectedClassId ?? '')} />
            </label>

            {selectedClass ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  flexWrap: 'wrap',
                  padding: '10px 14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#334155',
                }}
              >
                <div><span style={{ color: '#64748b' }}>Môn:</span> <strong>{selectedClass.course_name} ({selectedClass.course_code})</strong></div>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <div><span style={{ color: '#64748b' }}>Học kỳ:</span> <strong>{selectedClass.term}</strong></div>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <div><span style={{ color: '#64748b' }}>GV mặc định:</span> <strong>{selectedClass.teacher_name}</strong></div>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <div><span style={{ color: '#64748b' }}>Phòng mặc định:</span> <strong>{selectedClass.room}</strong></div>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <div><span style={{ color: '#64748b' }}>Tiến độ:</span> <strong style={{ color: '#0054a6' }}>{selectedClass.session_progress}</strong></div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Bước 2 — Cấu hình lịch */}
        <div className="workflow-step">
          <div className="workflow-step-header">
            <span className="step-badge">2</span>
            <span className="step-title-text">Cấu hình lịch học</span>
            <span className="step-desc-text">Thời gian, số lượng buổi và mẫu lặp tuần</span>
          </div>
          <div className="workflow-step-body">
            <div className="form-grid-2col" style={{ marginBottom: '18px' }}>
              <label className="field">
                <span>Ngày bắt đầu xếp lịch <b className="required-star">*</b></span>
                <input
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setPreview(null)
                  }}
                  required
                  type="date"
                  value={startDate}
                />
              </label>

              <label className="field">
                <span>Số buổi cần tạo (ví dụ 60 buổi) <b className="required-star">*</b></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    max={120}
                    min={1}
                    onChange={(e) => {
                      setSessionCount(Number(e.target.value))
                      setPreview(null)
                    }}
                    required
                    style={{ flex: 1 }}
                    type="number"
                    value={sessionCount}
                  />
                  <button
                    className="compact-weekday-pill"
                    onClick={() => { setSessionCount(60); setPreview(null) }}
                    type="button"
                  >
                    60 buổi
                  </button>
                  <button
                    className="compact-weekday-pill"
                    onClick={() => { setSessionCount(30); setPreview(null) }}
                    type="button"
                  >
                    30 buổi
                  </button>
                </div>
              </label>

              <label className="field">
                <span>Giờ bắt đầu <b className="required-star">*</b></span>
                <input
                  onChange={(e) => {
                    setStartTime(e.target.value)
                    setPreview(null)
                  }}
                  required
                  type="time"
                  value={startTime}
                />
              </label>

              <label className="field">
                <span>Giờ kết thúc <b className="required-star">*</b></span>
                <input
                  onChange={(e) => {
                    setEndTime(e.target.value)
                    setPreview(null)
                  }}
                  required
                  type="time"
                  value={endTime}
                />
              </label>
            </div>

            {/* Các thứ trong tuần dạng compact */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  Các thứ trong tuần cần học <b className="required-star">*</b>
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="compact-weekday-pill" onClick={() => applyWeekdayPreset('246')} type="button">Thứ 2-4-6</button>
                  <button className="compact-weekday-pill" onClick={() => applyWeekdayPreset('357')} type="button">Thứ 3-5-7</button>
                  <button className="compact-weekday-pill" onClick={() => applyWeekdayPreset('weekend')} type="button">Cuối tuần (T7, CN)</button>
                  <button className="compact-weekday-pill" onClick={() => applyWeekdayPreset('all')} type="button">Cả tuần (T2-T6)</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {weekdayOptions.map((opt) => {
                  const isChecked = weekdays.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      className={`compact-day-btn ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleWeekday(opt.value)}
                      type="button"
                    >
                      {isChecked ? '✓ ' : ''}{opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Collapsible holidays section */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <button
                className="text-button"
                onClick={() => setHolidaysOpen(!holidaysOpen)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '13px' }}
                type="button"
              >
                <UiIcon name={holidaysOpen ? 'close' : 'plus'} size={14} />
                <strong>Ngày nghỉ lễ cần bỏ qua ({holidays.length} ngày đã thiết lập)</strong>
                <span style={{ color: '#94a3b8', fontWeight: 400 }}>— Click để {holidaysOpen ? 'thu gọn' : 'mở rộng cấu hình'}</span>
              </button>

              {holidaysOpen ? (
                <div style={{ marginTop: '12px', padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
                    <label className="field" style={{ margin: 0, minWidth: '160px' }}>
                      <span>Ngày nghỉ</span>
                      <input
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        required
                        type="date"
                        value={newHolidayDate}
                      />
                    </label>
                    <label className="field" style={{ margin: 0, minWidth: '220px', flex: 1 }}>
                      <span>Dịp lễ / Lý do</span>
                      <input
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        placeholder="VD: Nghỉ lễ Quốc khánh, Tết Nguyên đán…"
                        required
                        value={newHolidayName}
                      />
                    </label>
                    <button
                      className="button button-outline button-small"
                      disabled={addingHoliday || !newHolidayDate || !newHolidayName.trim()}
                      onClick={(e) => {
                        e.preventDefault()
                        void handleAddHoliday(e)
                      }}
                      type="button"
                    >
                      <UiIcon name="plus" size={14} /> Thêm ngày nghỉ
                    </button>
                  </div>

                  {holidays.length ? (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {holidays.map((h) => (
                        <span
                          key={h.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '12px',
                          }}
                        >
                          <strong>{h.holiday_date}</strong>: {h.name}
                          <button
                            aria-label="Xóa ngày nghỉ"
                            onClick={() => void handleRemoveHoliday(h.id)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                            type="button"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Chưa có ngày nghỉ lễ nào.</span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Bước 3 — Phân công */}
        <div className="workflow-step">
          <div className="workflow-step-header">
            <span className="step-badge">3</span>
            <span className="step-title-text">Phân công giảng viên & phòng học</span>
            <span className="step-desc-text">Tùy chọn giảng viên và phòng học cho toàn bộ các buổi học</span>
          </div>
          <div className="workflow-step-body">
            <div className="form-grid-2col">
              <label className="field">
                <span>Giảng viên giảng dạy</span>
                <SearchableSelect ariaLabel="Instructor" onChange={(value) => { setAssignedTeacherId(value ? Number(value) : ''); setPreview(null) }} options={teachers.map((teacher) => ({ value: String(teacher.id), label: `${teacher.full_name} (${teacher.email})` }))} placeholder="Default instructor" value={String(assignedTeacherId)} />
              </label>

              <label className="field">
                <span>Phòng học</span>
                <SearchableSelect ariaLabel="Classroom" onChange={(value) => { setAssignedRoom(value); setPreview(null) }} options={rooms.map((room) => ({ value: room.code, label: `${room.code} (${room.capacity} seats)` }))} placeholder="Default classroom" value={assignedRoom} />
              </label>
            </div>
          </div>
        </div>

        {/* Bước 4 — Xem trước và kiểm tra */}
        <div className="workflow-step">
          <div className="workflow-step-header">
            <span className="step-badge">4</span>
            <span className="step-title-text">Xem trước & kiểm tra xung đột</span>
            <span className="step-desc-text">Tạo lịch tạm thời để rà soát xung đột trước khi lưu</span>
          </div>
          <div className="workflow-step-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                className="button button-primary"
                disabled={previewLoading || !selectedClassId || !weekdays.length}
                type="submit"
              >
                <UiIcon name="calendar" size={16} />
                {previewLoading ? 'Đang tính toán lịch…' : 'Tạo lịch xem trước'}
              </button>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Hệ thống sẽ tính toán toàn bộ {sessionCount} buổi học và kiểm tra xem giảng viên hoặc phòng có bị trùng giờ không.
              </span>
            </div>

            {preview ? (
              <div style={{ marginTop: '20px' }}>
                {/* Summary badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      Danh sách xem trước: {preview.session_count} buổi học
                    </strong>
                    <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '8px' }}>
                      Lớp {selectedClass?.code} ({startDate} đến {preview.sessions[preview.sessions.length - 1]?.session_date})
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="valid-tag">Tổng {preview.session_count} buổi</span>
                    {preview.conflict_count > 0 ? (
                      <span className="conflict-tag">⚠️ {preview.conflict_count} buổi xung đột</span>
                    ) : (
                      <span className="valid-tag">✓ Hợp lệ 100%</span>
                    )}
                  </div>
                </div>

                {/* Conflict Alert Box */}
                {preview.conflict_count > 0 ? (
                  <div
                    style={{
                      padding: '14px 16px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      color: '#991b1b',
                      marginBottom: '16px',
                    }}
                  >
                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                      ⚠️ Phát hiện {preview.conflict_count} buổi học có xung đột giảng viên hoặc phòng học
                    </strong>
                    <p style={{ margin: '0 0 10px', fontSize: '13px', lineHeight: 1.4 }}>
                      Hệ thống bảo vệ lịch đào tạo bằng cách cảnh báo khi có lớp khác trùng ca. Nếu bạn chắc chắn muốn lưu đè lịch này, vui lòng tích chọn xác nhận bên dưới:
                    </p>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        checked={allowConflicts}
                        onChange={(e) => setAllowConflicts(e.target.checked)}
                        type="checkbox"
                      />
                      <span>Tôi xác nhận và đồng ý ghi đè các buổi có xung đột lịch này</span>
                    </label>
                  </div>
                ) : null}

                {/* Preview Table */}
                <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>STT</th>
                        <th style={{ width: '130px' }}>THỨ & NGÀY</th>
                        <th style={{ width: '120px' }}>KHUNG GIỜ</th>
                        <th>BÀI HỌC / CHUYÊN ĐỀ</th>
                        <th>GIẢNG VIÊN</th>
                        <th>PHÒNG</th>
                        <th style={{ width: '160px' }}>TRẠNG THÁI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sessions.map((sess, idx) => {
                        const hasConflict = sess.conflicts.length > 0
                        return (
                          <tr key={`${sess.session_date}-${idx}`} style={{ background: hasConflict ? '#fff7ed' : undefined }}>
                            <td><strong>#{sess.lesson_sequence || idx + 1}</strong></td>
                            <td>
                              <strong>{sess.weekday}</strong>
                              <span className="table-secondary">{sess.session_date}</span>
                            </td>
                            <td>
                              <span className="time-tag">{sess.start_time} – {sess.end_time}</span>
                            </td>
                            <td>
                              <span>{sess.lesson_title}</span>
                              {sess.lesson_id ? (
                                <span style={{ fontSize: '11px', color: '#16a34a', display: 'block' }}>✓ Theo giáo trình</span>
                              ) : null}
                            </td>
                            <td>{sess.teacher_name}</td>
                            <td><span className="time-tag">{sess.room}</span></td>
                            <td>
                              {hasConflict ? (
                                <span className="conflict-tag">
                                  Trùng {sess.conflicts.map((c) => `${c.class_code} (${c.teacher_conflict ? 'GV' : ''}${c.room_conflict ? 'Phòng' : ''})`).join(', ')}
                                </span>
                              ) : (
                                <span className="valid-tag">✓ Hợp lệ</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Confirmation save bar */}
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Sau khi lưu, {preview.session_count} buổi học sẽ chính thức được tạo và thông báo đến học viên.
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="button button-outline"
                      onClick={() => setPreview(null)}
                      type="button"
                    >
                      Hủy xem trước
                    </button>
                    <button
                      className={`button ${preview.conflict_count > 0 ? 'button-danger' : 'button-primary'}`}
                      disabled={saving || (preview.conflict_count > 0 && !allowConflicts)}
                      onClick={handleSaveSchedule}
                      type="button"
                    >
                      <UiIcon name="check" size={16} />
                      {saving
                        ? 'Đang lưu lịch…'
                        : preview.conflict_count > 0
                          ? `Ghi đè & Lưu ${preview.session_count} buổi`
                          : `Xác nhận lưu ${preview.session_count} buổi học`}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  )
}
