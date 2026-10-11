import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, apiUrl } from '../api'
import { Modal, UiIcon } from '../components/Ui'
import { initials, showError } from '../format'
import type { AccountPage, Classroom, Course, StudyProgram, TrainingClass, User } from '../types'

const weekdayOptions = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']
const attendanceOptions = [
  { value: 'present', label: 'Có mặt' },
  { value: 'late', label: 'Đi muộn' },
  { value: 'excused_absent', label: 'Vắng có phép' },
  { value: 'unexcused_absent', label: 'Vắng không phép' },
] as const

type ScheduledSession = {
  id: number
  session_date: string
  start_time: string
  end_time: string
  lesson_title: string | null
  is_cancelled: boolean
  has_attendance: boolean
}

type AttendanceEditorData = {
  session: ScheduledSession
  students: { id: number; student_code: string; full_name: string; status: string | null }[]
}

function ClassScheduleModal({
  item,
  course,
  rooms,
  teachers,
  notify,
  onClose,
  onSaved,
}: {
  item: TrainingClass
  course: Course
  rooms: Classroom[]
  teachers: User[]
  notify: (message: string) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [weekdays, setWeekdays] = useState([item.day_of_week])
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [preview, setPreview] = useState<{
    session_count: number
    conflict_count: number
    sessions: {
      session_date: string
      weekday: string
      start_time: string
      end_time: string
      teacher_name: string
      room: string
      lesson_sequence: number
      lesson_title: string
      conflicts: { class_code: string; teacher_conflict: boolean; room_conflict: boolean }[]
    }[]
  } | null>(null)
  const [holidays, setHolidays] = useState<{ id: number; holiday_date: string; name: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [refreshHolidays, setRefreshHolidays] = useState(0)

  useEffect(() => {
    apiRequest<typeof holidays>('/schedule/holidays')
      .then(setHolidays)
      .catch((error: unknown) => setProblem(showError(error)))
  }, [refreshHolidays])

  function buildRequest(form: HTMLFormElement) {
    const fields = new FormData(form)
    return {
      weekdays,
      start_date: fields.get('start_date'),
      session_count: Number(fields.get('session_count')),
      start_time: fields.get('start_time'),
      end_time: fields.get('end_time'),
      teacher_id: Number(fields.get('teacher_id')),
      room: fields.get('room'),
      allow_conflicts: false,
    }
  }

  async function getPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    try {
      const result = await apiRequest<typeof preview>(`/classes/${item.id}/sessions/preview`, {
        method: 'POST',
        body: JSON.stringify(buildRequest(event.currentTarget)),
      })
      setPreview(result)
    } catch (error) {
      setProblem(showError(error))
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  async function confirmSave(form: HTMLFormElement, allowConflicts: boolean) {
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/classes/${item.id}/sessions`, {
        method: 'POST',
        body: JSON.stringify({ ...buildRequest(form), allow_conflicts: allowConflicts }),
      })
      notify(`Đã lưu ${preview?.session_count ?? 0} buổi học.`)
      onSaved()
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function saveSchedule(form: HTMLFormElement) {
    if (!preview) return
    if (preview.conflict_count) {
      if (!window.confirm(`Phát hiện ${preview.conflict_count} xung đột. Xác nhận ghi đè lịch này?`)) return
      await confirmSave(form, true)
      return
    }
    await confirmSave(form, false)
  }

  async function addHoliday(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setProblem('')
    try {
      await apiRequest('/schedule/holidays', {
        method: 'POST',
        body: JSON.stringify({ holiday_date: fields.get('holiday_date'), name: fields.get('holiday_name') }),
      })
      form.reset()
      setRefreshHolidays((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function removeHoliday(id: number) {
    try {
      await apiRequest(`/schedule/holidays/${id}`, { method: 'DELETE' })
      setRefreshHolidays((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    }
  }

  return (
    <Modal eyebrow={`${item.code} · ${course.name}`} onClose={onClose} size="large" title="Sinh thời khóa biểu lặp">
      <form className="dialog-form" onChange={() => setPreview(null)} onSubmit={(event) => void getPreview(event)}>
        <div className="form-grid">
          <label className="field"><span>Ngày bắt đầu</span><input defaultValue={today} name="start_date" required type="date" /></label>
          <label className="field"><span>Số buổi <b>*</b></span><input defaultValue={course.session_count} max={60} min={1} name="session_count" required type="number" /></label>
          <label className="field"><span>Giờ bắt đầu</span><input defaultValue={item.start_time} name="start_time" required type="time" /></label>
          <label className="field"><span>Giờ kết thúc</span><input defaultValue={item.end_time} name="end_time" required type="time" /></label>
          <label className="field"><span>Giảng viên</span><select defaultValue={item.teacher_id} name="teacher_id">{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select></label>
          <label className="field"><span>Phòng</span><select defaultValue={item.room} name="room">{rooms.map((room) => <option key={room.id} value={room.code}>{room.code}</option>)}{!rooms.some((room) => room.code === item.room) ? <option value={item.room}>{item.room}</option> : null}</select></label>
          <div className="field field-span-2"><span>Các thứ học trong tuần</span><div className="schedule-week-picker">{weekdayOptions.map((day, index) => <label key={day}><input checked={weekdays.includes(index)} onChange={(event) => setWeekdays((current) => event.target.checked ? [...current, index].sort() : current.filter((value) => value !== index))} type="checkbox" />{day}</label>)}</div></div>
        </div>
        <div className="modal-actions"><button className="button button-primary" disabled={busy || !weekdays.length} type="submit">{busy ? 'Đang tính…' : 'Xem trước lịch'}</button></div>
      </form>
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      {preview ? (
        <section className="schedule-preview">
          <h3>{preview.session_count} buổi xem trước</h3>
          {preview.conflict_count ? <div className="form-alert error-alert">Blocker: có {preview.conflict_count} xung đột. Phải xác nhận ghi đè trước khi lưu.</div> : null}
          <div className="table-scroll"><table className="data-table"><thead><tr><th>NGÀY / GIỜ</th><th>BUỔI SYLLABUS</th><th>GIẢNG VIÊN / PHÒNG</th><th>XUNG ĐỘT</th></tr></thead><tbody>
            {preview.sessions.map((session, index) => <tr key={`${session.session_date}-${index}`}><td>{session.weekday} {session.session_date}<small className="cell-subtitle">{session.start_time}–{session.end_time}</small></td><td>Buổi {session.lesson_sequence}: {session.lesson_title}</td><td>{session.teacher_name}<small className="cell-subtitle">{session.room}</small></td><td>{session.conflicts.map((conflict, offset) => <small className="text-warning" key={`${conflict.class_code}-${offset}`}>{conflict.class_code}: {[conflict.teacher_conflict ? 'giảng viên' : '', conflict.room_conflict ? 'phòng' : ''].filter(Boolean).join(', ')}</small>)}</td></tr>)}
          </tbody></table></div>
        </section>
      ) : null}
      <section className="schedule-holiday-config">
        <h3>Ngày nghỉ lễ</h3>
        <form className="form-grid" onSubmit={(event) => void addHoliday(event)}>
          <label className="field"><span>Ngày nghỉ</span><input name="holiday_date" required type="date" /></label>
          <label className="field"><span>Tên ngày nghỉ</span><input maxLength={150} minLength={2} name="holiday_name" required /></label>
          <button className="button button-outline" disabled={busy} type="submit">Thêm ngày nghỉ</button>
        </form>
        <ul>{holidays.map((holiday) => <li key={holiday.id}>{holiday.holiday_date} · {holiday.name}<button className="text-action text-warning" onClick={() => void removeHoliday(holiday.id)} type="button">Xóa</button></li>)}</ul>
      </section>
      <div className="modal-actions">
        <button className="button button-outline" onClick={onClose} type="button">Đóng</button>
        {preview ? <button className="button button-primary" disabled={busy} onClick={(event) => {
          const form = event.currentTarget.closest('.modal-card')?.querySelector('form')
          if (form instanceof HTMLFormElement) void saveSchedule(form)
        }} type="button">{busy ? 'Đang lưu…' : preview.conflict_count ? 'Xác nhận ghi đè & lưu' : 'Xác nhận lưu lịch'}</button> : null}
      </div>
    </Modal>
  )
}

function ClassEditor({
  item,
  courses,
  programs,
  rooms,
  teachers,
  assistants,
  onClose,
  onSaved,
}: {
  item: TrainingClass | null
  courses: Course[]
  programs: StudyProgram[]
  rooms: Classroom[]
  teachers: User[]
  assistants: User[]
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [programId, setProgramId] = useState(item ? '' : String(programs[0]?.id ?? ''))
  const selectedProgram = programs.find((program) => String(program.id) === programId)
  const visibleCourses = item || !selectedProgram
    ? courses
    : courses.filter((course) => selectedProgram.courses.some((programCourse) => programCourse.id === course.id))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const fields = new FormData(event.currentTarget)
    try {
      await apiRequest(item ? `/classes/${item.id}` : '/classes', {
        method: item ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...(item ? {} : { code: fields.get('code') }),
          name: fields.get('name'),
          course_id: Number(fields.get('course_id')),
          ...(!item && programId ? { program_id: Number(programId) } : {}),
          teacher_id: Number(fields.get('teacher_id')),
          assistant_ids: fields.getAll('assistant_ids').map(Number),
          room: fields.get('room'),
          term: fields.get('term'),
          day_of_week: Number(fields.get('day_of_week')),
          start_time: fields.get('start_time'),
          end_time: fields.get('end_time'),
          capacity: Number(fields.get('capacity')),
          status: fields.get('status'),
        }),
      })
      onSaved()
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal eyebrow="TỔ CHỨC GIẢNG DẠY" onClose={onClose} size="large" title={item ? 'Cập nhật lớp học phần' : 'Tạo lớp học phần'}>
      <form className="dialog-form" onSubmit={submit}>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className="form-grid">
          <label className="field">
            <span>Mã lớp <b>*</b></span>
            <input autoFocus defaultValue={item?.code} disabled={Boolean(item)} maxLength={30} minLength={2} name="code" placeholder="VD: IT001.01" required />
          </label>
          <label className="field">
            <span>Học kỳ <b>*</b></span>
            <input defaultValue={item?.term} maxLength={50} name="term" placeholder="VD: HK1-2026" required />
          </label>
          <label className="field field-span-2">
            <span>Tên lớp <b>*</b></span>
            <input defaultValue={item?.name} maxLength={150} minLength={2} name="name" placeholder="VD: Lập trình cơ bản — Nhóm 01" required />
          </label>
          {!item ? (
            <label className="field">
              <span>Chương trình đào tạo <b>*</b></span>
              <select onChange={(event) => setProgramId(event.target.value)} required value={programId}>
                <option disabled value="">Chọn chương trình</option>
                {programs.map((program) => <option key={program.id} value={program.id}>{program.code} · {program.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>Môn học <b>*</b></span>
            <select defaultValue={item?.course_id ?? ''} name="course_id" required>
              <option disabled value="">Chọn môn học</option>
              {visibleCourses.filter((course) => course.is_active).map((course) => (
                <option key={course.id} value={course.id}>{course.code} · {course.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Giảng viên phụ trách <b>*</b></span>
            <select defaultValue={item?.teacher_id ?? ''} name="teacher_id" required>
              <option disabled value="">Chọn giảng viên</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Trợ giảng (có thể chọn nhiều)</span>
            <select defaultValue={item?.assistants.map((assistant) => String(assistant.id)) ?? []} multiple name="assistant_ids">
              {assistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>{assistant.full_name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Vòng đời lớp</span>
            <select defaultValue={item?.status ?? 'preparing'} disabled={!item} name="status">
              {(item?.status === 'preparing'
                ? ['preparing', 'active', 'cancelled']
                : item?.status === 'active'
                  ? ['active', 'completed', 'cancelled']
                  : [item?.status ?? 'preparing']
              ).map((value) => (
                <option key={value} value={value}>
                  {{ preparing: 'Chuẩn bị', active: 'Đang học', completed: 'Kết thúc', cancelled: 'Hủy' }[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Thứ trong tuần <b>*</b></span>
            <select defaultValue={String(item?.day_of_week ?? 0)} name="day_of_week">
              {weekdayOptions.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Phòng học <b>*</b></span>
            <select defaultValue={item?.room ?? ''} name="room" required>
              <option disabled value="">Chọn phòng học</option>
              {item && !rooms.some((room) => room.code === item.room) ? <option value={item.room}>{item.room} · Phòng cũ</option> : null}
              {rooms.map((room) => <option key={room.id} value={room.code}>{room.code} · {room.capacity} chỗ</option>)}
            </select>
          </label>
          <label className="field">
            <span>Giờ bắt đầu <b>*</b></span>
            <input defaultValue={item?.start_time ?? '08:00'} name="start_time" required type="time" />
          </label>
          <label className="field">
            <span>Giờ kết thúc <b>*</b></span>
            <input defaultValue={item?.end_time ?? '10:00'} name="end_time" required type="time" />
          </label>
          <label className="field">
            <span>Sĩ số tối đa <b>*</b></span>
            <input defaultValue={item?.capacity ?? 40} max={500} min={1} name="capacity" required type="number" />
          </label>
        </div>
        <p className="form-note">Hệ thống sẽ kiểm tra trùng lịch giảng viên, phòng học và học viên trước khi lưu.</p>
        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose} type="button">Hủy</button>
          <button className="button button-primary" disabled={busy || !courses.length || !teachers.length} type="submit">{busy ? 'Đang lưu…' : item ? 'Lưu thay đổi' : 'Tạo lớp học'}</button>
        </div>
      </form>
    </Modal>
  )
}

type RosterStudent = User & {
  tuition_status: 'paid' | 'unpaid'
  attendance_status: 'not_recorded' | 'present' | 'absent' | 'late'
  last_attendance_at: string | null
  attendance_history: { session_date: string; status: 'present' | 'absent' | 'late' | 'not_recorded' }[]
}

function RosterModal({
  item,
  canEnroll,
  canManageAttendance,
  canManageTuition,
  notify,
  onClose,
  onUpdated,
}: {
  item: TrainingClass
  canEnroll: boolean
  canManageAttendance: boolean
  canManageTuition: boolean
  notify: (message: string) => void
  onClose: () => void
  onUpdated: () => void
}) {
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [available, setAvailable] = useState<User[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [sessions, setSessions] = useState<ScheduledSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [attendanceData, setAttendanceData] = useState<AttendanceEditorData | null>(null)
  const [attendanceMarks, setAttendanceMarks] = useState<Record<number, string>>({})
  const [availableSearch, setAvailableSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    const rosterRequest = apiRequest<RosterStudent[]>(`/classes/${item.id}/students`)
    const accountsRequest: Promise<User[]> = canEnroll
      ? (async () => {
          const allStudents: User[] = []
          let total = 0
          do {
            const page = Math.floor(allStudents.length / 100) + 1
            const result = await apiRequest<AccountPage>(
              `/accounts?role=student&page=${page}&page_size=100`,
            )
            allStudents.push(...result.items)
            total = result.total
            if (!result.items.length) break
          } while (allStudents.length < total)
          return allStudents
        })()
      : Promise.resolve([])
    const sessionsRequest: Promise<ScheduledSession[]> = canManageAttendance
      ? apiRequest<ScheduledSession[]>(`/classes/${item.id}/sessions`)
      : Promise.resolve([])
    Promise.all([rosterRequest, accountsRequest, sessionsRequest])
      .then(([roster, accounts, classSessions]) => {
        setStudents(roster)
        const enrolled = new Set(roster.map((student) => student.id))
        setAvailable(accounts.filter((student) => !enrolled.has(student.id)))
        setSessions(classSessions)
      })
      .catch((error: unknown) => setProblem(showError(error)))
      .finally(() => setLoading(false))
  }, [canEnroll, canManageAttendance, item.id])

  useEffect(() => {
    if (!activeSessionId) return
    let active = true
    apiRequest<AttendanceEditorData>(`/attendance/sessions/${activeSessionId}`)
      .then((result) => {
        if (!active) return
        setAttendanceData(result)
        setAttendanceMarks(Object.fromEntries(result.students.filter((student) => student.status).map((student) => [student.id, student.status as string])))
      })
      .catch((error: unknown) => { if (active) setProblem(showError(error)) })
    return () => { active = false }
  }, [activeSessionId])

  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected.length) return
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/classes/${item.id}/students`, {
        method: 'POST',
        body: JSON.stringify({ student_ids: selected }),
      })
      notify(`Đã thêm ${selected.length} học viên vào lớp.`)
      onUpdated()
      onClose()
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function updateStatus(
    studentId: number,
    field: 'tuition_status' | 'attendance_status',
    value: string,
  ) {
    try {
      const result = await apiRequest<
        Pick<RosterStudent, 'tuition_status' | 'attendance_status' | 'last_attendance_at' | 'attendance_history'>
      >(`/classes/${item.id}/students/${studentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value }),
      })
      setStudents((current) =>
        current.map((student) =>
          student.id === studentId ? { ...student, ...result } : student,
        ),
      )
    } catch (error) {
      setProblem(showError(error))
    }
  }

  async function exportRoster() {
    try {
      const token = sessionStorage.getItem('ictu_access_token')
      const response = await fetch(apiUrl(`/classes/${item.id}/students/export`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) throw new Error('Không thể xuất danh sách học viên.')
      const file = await response.blob()
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${item.code}-students.xlsx`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setProblem(showError(error))
    }
  }

  function markAllPresent() {
    if (!attendanceData) return
    setAttendanceMarks(Object.fromEntries(attendanceData.students.map((student) => [student.id, 'present'])))
  }

  async function saveAttendance() {
    if (!attendanceData) return
    const records = Object.entries(attendanceMarks).map(([student_id, status]) => ({
      student_id: Number(student_id),
      status,
    }))
    if (!records.length) {
      setProblem('Chọn trạng thái ít nhất một học viên hoặc bấm “Tất cả có mặt”.')
      return
    }
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/attendance/sessions/${activeSessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ records }),
      })
      notify(`Đã lưu điểm danh ${records.length} học viên.`)
      setActiveSessionId('')
      setAttendanceData(null)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal eyebrow={`${item.code} · ${item.course_name}`} onClose={onClose} size="large" title="Danh sách học viên">
      <div className="roster-toolbar">
        <span className="eyebrow">DANH SÁCH LỚP</span>
        <button className="button button-outline button-small" onClick={() => void exportRoster()} type="button"><UiIcon name="download" size={15} /> Xuất Excel</button>
      </div>
      <div className="roster-summary">
        <div><span>SĨ SỐ HIỆN TẠI</span><strong>{students.length}<small> / {item.capacity}</small></strong></div>
        <div><span>GIẢNG VIÊN</span><strong>{item.teacher_name}</strong></div>
        <div><span>THỜI GIAN</span><strong>{item.weekday}, {item.start_time}–{item.end_time}</strong></div>
      </div>
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      {canEnroll ? (
        <form className="enroll-form" onSubmit={enroll}>
          <div className="field">
            <span>Thêm học viên vào lớp</span>
            <input aria-label="Tìm học viên để ghi danh" onChange={(event) => setAvailableSearch(event.target.value)} placeholder="Tìm mã học viên hoặc họ tên…" value={availableSearch} />
            <div className="student-pick-actions">
              <button className="text-button" disabled={!available.length} onClick={() => setSelected(available.filter((student) => `${student.student_code ?? student.username} ${student.full_name}`.toLowerCase().includes(availableSearch.trim().toLowerCase())).map((student) => student.id))} type="button">Chọn kết quả lọc</button>
              <button className="text-button" onClick={() => setSelected([])} type="button">Bỏ chọn</button>
            </div>
            <div className="student-pick-list">
              {available.filter((student) => `${student.student_code ?? student.username} ${student.full_name}`.toLowerCase().includes(availableSearch.trim().toLowerCase())).map((student) => (
                <label className="student-pick-row" key={student.id}>
                  <input className="student-pick-checkbox" checked={selected.includes(student.id)} disabled={busy} onChange={(event) => setSelected((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} type="checkbox" />
                  <span><strong>{student.student_code || student.username}</strong><span>{student.full_name}</span></span>
                </label>
              ))}
              {!available.length ? <small>Không còn học viên chưa ghi danh.</small> : null}
            </div>
            <small>Chọn một học viên hoặc đánh dấu nhiều học viên để ghi danh hàng loạt.</small>
          </div>
          <button className="button button-outline" disabled={busy || !selected.length} type="submit">{busy ? 'Đang thêm…' : `Thêm ${selected.length || ''} học viên`}</button>
        </form>
      ) : null}
      {canManageAttendance ? (
        <section className="quick-attendance">
          <div className="section-heading">
            <div><span className="eyebrow">ĐIỂM DANH NHANH</span><h2>Chọn buổi học để điểm danh</h2></div>
          </div>
          <label className="field">
            <span>Buổi học đã xếp</span>
            <select onChange={(event) => {
              setAttendanceData(null)
              setAttendanceMarks({})
              setActiveSessionId(event.target.value)
            }} value={activeSessionId}>
              <option value="">Chọn buổi học</option>
              {sessions.filter((session) => !session.is_cancelled).map((session) => <option key={session.id} value={session.id}>{session.session_date} · {session.start_time} · {session.lesson_title ?? 'Buổi học'}</option>)}
            </select>
          </label>
          {attendanceData ? (
            <>
              <div className="quick-attendance-actions">
                <button className="button button-outline button-small" disabled={busy} onClick={markAllPresent} type="button">Tất cả có mặt</button>
                <span>{attendanceData.students.length} học viên · {attendanceData.session.session_date}</span>
              </div>
              <div className="quick-attendance-list">
                {attendanceData.students.map((student) => (
                  <label className="quick-attendance-row" key={student.id}>
                    <span><strong>{student.full_name}</strong><small>{student.student_code}</small></span>
                    <select aria-label={`Trạng thái ${student.full_name}`} onChange={(event) => setAttendanceMarks((current) => {
                      if (!event.target.value) {
                        const next = { ...current }
                        delete next[student.id]
                        return next
                      }
                      return { ...current, [student.id]: event.target.value }
                    })} value={attendanceMarks[student.id] ?? ''}>
                      <option value="">Chưa đánh dấu</option>
                      {attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <button className="button button-primary button-small" disabled={busy || !Object.keys(attendanceMarks).length} onClick={() => void saveAttendance()} type="button">{busy ? 'Đang lưu…' : 'Lưu điểm danh'}</button>
              <p className="form-note">Buổi quá khứ chỉ Quản lý đào tạo được sửa. Mọi thay đổi sau khi lưu đều được ghi nhật ký.</p>
            </>
          ) : null}
        </section>
      ) : null}
      <div className="roster-list">
        {loading ? <div className="table-loading">Đang tải danh sách…</div> : null}
        {!loading && students.map((student, index) => (
          <div className="roster-row" key={student.id}>
            <div className={`avatar table-avatar avatar-tone-${index % 5}`}>{initials(student.full_name)}</div>
            <span>
              <strong>{student.full_name}</strong>
              <small>{student.student_code || student.username} · {student.email}</small>
              {student.attendance_history.length ? (
                <small className="attendance-history">
                  Gần nhất: {student.attendance_history.slice(0, 4).map((entry) => (
                    `${new Date(`${entry.session_date}T00:00:00`).toLocaleDateString('vi-VN')} ${
                      { present: 'Có mặt', absent: 'Vắng', late: 'Muộn', not_recorded: 'Chưa điểm danh' }[entry.status]
                    }`
                  )).join(' · ')}
                </small>
              ) : null}
            </span>
            <span className={`roster-status-pill ${student.tuition_status === 'paid' ? 'paid-status' : 'unpaid-status'}`}>
              {canManageTuition ? (
                <select aria-label={`Học phí ${student.full_name}`} onChange={(event) => void updateStatus(student.id, 'tuition_status', event.target.value)} value={student.tuition_status}>
                  <option value="paid">Đã đóng học phí</option>
                  <option value="unpaid">Chưa đóng học phí</option>
                </select>
              ) : student.tuition_status === 'paid' ? 'Đã đóng học phí' : 'Chưa đóng học phí'}
            </span>
            <span className={`roster-status-pill attendance-${student.attendance_status}`}>
              {canManageAttendance ? (
                <select aria-label={`Điểm danh ${student.full_name}`} onChange={(event) => void updateStatus(student.id, 'attendance_status', event.target.value)} value={student.attendance_status}>
                  <option value="not_recorded">Chưa điểm danh</option>
                  <option value="present">Có mặt</option>
                  <option value="absent">Vắng</option>
                  <option value="late">Đi muộn</option>
                </select>
              ) : student.attendance_status === 'present' ? 'Có mặt' : student.attendance_status === 'absent' ? 'Vắng' : student.attendance_status === 'late' ? 'Đi muộn' : 'Chưa điểm danh'}
            </span>
          </div>
        ))}
        {!loading && !students.length ? <div className="empty-state compact-empty"><strong>Chưa có học viên</strong><span>Thêm học viên từ danh sách tài khoản.</span></div> : null}
      </div>
    </Modal>
  )
}

export function ClassesPage({
  user,
  notify,
}: {
  user: User
  notify: (message: string) => void
}) {
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [rooms, setRooms] = useState<Classroom[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [assistants, setAssistants] = useState<User[]>([])
  const [q, setQ] = useState('')
  const [termFilter, setTermFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [editor, setEditor] = useState<TrainingClass | null | undefined>(undefined)
  const [roster, setRoster] = useState<TrainingClass | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<TrainingClass | null>(null)
  const isAdmin = user.roles.includes('admin') || user.roles.includes('manager')
  const isTeacher = user.roles.includes('teacher') || user.roles.includes('ta')
  const canEnroll =
    isAdmin || user.roles.includes('admissions')
  const canManageTuition =
    isAdmin || user.roles.includes('accountant')
  const canManageAttendance = isAdmin || isTeacher
  const canViewRoster =
    isAdmin ||
    isTeacher ||
    user.roles.includes('admissions') ||
    user.roles.includes('accountant')

  useEffect(() => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (termFilter) params.set('term', termFilter)
    const query = params.size ? `?${params}` : ''
    const requests: Promise<unknown>[] = [apiRequest<TrainingClass[]>(`/classes${query}`)]
    if (isAdmin) {
      requests.push(
        apiRequest<Course[]>('/courses'),
        apiRequest<StudyProgram[]>('/study-programs'),
        apiRequest<Classroom[]>('/rooms'),
        apiRequest<AccountPage>('/accounts?role=teacher&page=1&page_size=100'),
        apiRequest<AccountPage>('/accounts?role=ta&page=1&page_size=100'),
      )
    }
    const timer = window.setTimeout(() => {
      setLoading(true)
      Promise.all(requests)
        .then((results) => {
          setClasses(results[0] as TrainingClass[])
          if (isAdmin) {
            setCourses(results[1] as Course[])
            setPrograms(results[2] as StudyProgram[])
            setRooms(results[3] as Classroom[])
            setTeachers((results[4] as AccountPage).items)
            setAssistants((results[5] as AccountPage).items)
          }
          setProblem('')
        })
        .catch((error: unknown) => setProblem(showError(error)))
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isAdmin, q, refresh, termFilter])

  async function removeClass(item: TrainingClass) {
    if (!window.confirm(`Xóa lớp ${item.code}? Danh sách đăng ký của lớp cũng sẽ bị xóa.`)) return
    try {
      await apiRequest(`/classes/${item.id}`, { method: 'DELETE' })
      setRefresh((value) => value + 1)
      notify('Đã xóa lớp học.')
    } catch (error) {
      notify(showError(error))
    }
  }

  const enrolledTotal = classes.reduce((total, item) => total + item.student_count, 0)
  const seatTotal = classes.reduce((total, item) => total + item.capacity, 0)
  const terms = [...new Set(classes.map((item) => item.term))].sort()

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">TỔ CHỨC GIẢNG DẠY</span>
          <h1>{isAdmin ? 'Quản lý lớp học phần' : isTeacher ? 'Lớp học phụ trách' : 'Lớp học của tôi'}</h1>
          <p>{isAdmin ? 'Lập kế hoạch lớp học, phân công giảng viên và theo dõi sĩ số.' : 'Theo dõi thông tin lớp học và danh sách học viên.'}</p>
        </div>
        {isAdmin ? <button className="button button-primary" onClick={() => setEditor(null)} type="button"><UiIcon name="plus" size={17} /> Tạo lớp học</button> : null}
      </div>
      <section className="class-summary-strip">
        <div className="class-summary-icon"><UiIcon name="classes" size={20} /></div>
        <div className="class-summary-metric"><span>HỌC KỲ</span><strong>{classes[0]?.term ?? 'Chưa xếp lịch'}</strong></div>
        <div className="class-summary-divider" />
        <div className="class-summary-metric"><span>{isTeacher ? 'LỚP ĐƯỢC PHÂN CÔNG' : isAdmin ? 'TỔNG LỚP HỌC' : 'LỚP ĐANG THAM GIA'}</span><strong>{classes.length}</strong></div>
        <div className="class-summary-metric"><span>HỌC VIÊN ĐÃ GHI DANH</span><strong>{enrolledTotal}</strong></div>
        <div className="class-summary-metric"><span>CHỖ CÒN TRỐNG</span><strong>{Math.max(0, seatTotal - enrolledTotal)}</strong></div>
        {isAdmin ? <div className="class-summary-note"><i /> Lịch học được kiểm tra trùng tự động</div> : null}
      </section>
      <section className="panel data-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <UiIcon name="search" size={18} />
            <input aria-label="Tìm lớp học" onChange={(event) => setQ(event.target.value)} placeholder="Tìm theo mã lớp, môn học…" value={q} />
          </div>
          <label className="field filter-field">
            <span className="visually-hidden">Lọc học kỳ</span>
            <select onChange={(event) => setTermFilter(event.target.value)} value={termFilter}>
              <option value="">Tất cả học kỳ</option>
              {terms.map((term) => <option key={term} value={term}>{term}</option>)}
            </select>
          </label>
          <span className="table-total">{classes.length} lớp học</span>
        </div>
        {problem ? <div className="inline-error">{problem}</div> : null}
        <div className="table-scroll">
          <table className="data-table class-table">
            <thead><tr><th>LỚP HỌC PHẦN</th><th>MÔN HỌC</th><th>GIẢNG VIÊN</th><th>LỊCH HỌC</th><th>SĨ SỐ</th><th aria-label="Thao tác" /></tr></thead>
            <tbody>
              {loading ? <tr><td className="table-loading" colSpan={6}>Đang tải lớp học…</td></tr> : null}
              {!loading && classes.map((item, index) => (
                <tr key={item.id}>
                  <td><div className="class-name-cell"><span className={`class-code-mark class-mark-${index % 4}`}><UiIcon name="classes" size={17} /></span><span><strong>{item.name}</strong><small className="mono-code">{item.code} · {item.term}</small></span></div></td>
                  <td><span className="course-code">{item.course_code}</span><small className="cell-subtitle">{item.course_name}</small></td>
                  <td><span className="teacher-name">{item.teacher_name}</span>{item.assistants.length ? <small className="cell-subtitle">TA: {item.assistants.map((assistant) => assistant.full_name).join(', ')}</small> : null}</td>
                  <td>                  <span className="schedule-cell"><strong>{item.weekday}</strong><small>{item.start_time} – {item.end_time}</small><small>{{ preparing: 'Chuẩn bị', active: 'Đang học', completed: 'Kết thúc', cancelled: 'Đã hủy' }[item.status]}</small></span></td>
                  <td>
                    <div className="capacity-cell">
                      <strong>{item.student_count}<small> / {item.capacity}</small></strong>
                      <span className="capacity-track"><i style={{ width: `${Math.min(100, (item.student_count / item.capacity) * 100)}%` }} /></span>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      {canViewRoster ? <button className="button button-small button-outline" onClick={() => setRoster(item)} type="button">{canManageAttendance ? 'Lớp học' : 'Danh sách'}</button> : <span className="muted-cell enrolled-label">Đã đăng ký</span>}
                      {isAdmin ? <button aria-label={`Sửa ${item.code}`} className="icon-button row-action" onClick={() => setEditor(item)} title="Chỉnh sửa lớp" type="button"><UiIcon name="edit" size={16} /></button> : null}
                      {isAdmin ? <button className="text-action" onClick={() => setScheduleTarget(item)} type="button">Xếp lịch</button> : null}
                      {isAdmin ? <button aria-label={`Xóa ${item.code}`} className="icon-button row-action danger-action" onClick={() => void removeClass(item)} title="Xóa lớp" type="button"><UiIcon name="trash" size={16} /></button> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !classes.length ? <tr><td className="table-empty" colSpan={6}><div className="empty-state"><div className="empty-icon"><UiIcon name="classes" size={22} /></div><strong>Chưa có lớp học</strong><span>{isAdmin ? 'Tạo lớp học và phân công giảng viên để bắt đầu.' : 'Lớp học được phân công sẽ hiển thị tại đây.'}</span></div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {editor !== undefined ? (
        <ClassEditor
          item={editor}
          courses={courses}
          programs={programs}
          rooms={rooms}
          teachers={teachers}
          assistants={assistants}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined)
            setRefresh((value) => value + 1)
            notify(editor ? 'Lớp học và thời khóa biểu đã được cập nhật.' : 'Đã tạo lớp học và xếp lịch.')
          }}
        />
      ) : null}
      {roster ? (
        <RosterModal
          canEnroll={canEnroll}
          canManageAttendance={canManageAttendance}
          canManageTuition={canManageTuition}
          item={roster}
          notify={notify}
          onClose={() => setRoster(null)}
          onUpdated={() => setRefresh((value) => value + 1)}
        />
      ) : null}
      {scheduleTarget ? (
        <ClassScheduleModal
          item={scheduleTarget}
          course={courses.find((course) => course.id === scheduleTarget.course_id)!}
          rooms={rooms}
          teachers={teachers}
          notify={notify}
          onClose={() => setScheduleTarget(null)}
          onSaved={() => {
            setScheduleTarget(null)
            setRefresh((value) => value + 1)
          }}
        />
      ) : null}
    </div>
  )
}
