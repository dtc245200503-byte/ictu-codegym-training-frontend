import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest, apiRequestWithHeaders, apiUrl } from '../api'
import { Modal, UiIcon } from '../components/Ui'
import { ListPagination, SearchableMultiSelect, SearchableSelect } from '../components/ListControls'
import { initials, showError } from '../format'
import type { AccountPage, Classroom, Course, StudyProgram, TrainingClass, User } from '../types'
import { navigateTo } from '../navigation'
import { paginationFromHeaders } from '../pagination'

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
  presentation = 'dialog',
  notify,
  onClose,
  onSaved,
}: {
  item: TrainingClass
  course: Course
  rooms: Classroom[]
  teachers: User[]
  presentation?: 'dialog' | 'page'
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

  const applyPreset = (days: number[]) => {
    setWeekdays(days)
    setPreview(null)
  }

  return (
    <Modal
      backHref={presentation === 'page' ? '/classes' : undefined}
      eyebrow={`Mã lớp: ${item.code} · ${course.name}`}
      onClose={onClose}
      presentation={presentation}
      size="large"
      title="Thiết lập & Sinh thời khóa biểu lớp học phần"
    >
      <div className="schedule-form-container">
        {/* NHÓM 1: THÔNG TIN LỊCH HỌC / LỚP HỌC PHẦN */}
        <section className="schedule-group schedule-group-info">
          <div className="schedule-group-header">
            <span className="group-step">1</span>
            <div>
              <h4>Thông tin lớp học phần</h4>
              <p>Chi tiết về môn học, tín chỉ và thông số lớp đang thiết lập lịch</p>
            </div>
          </div>
          <div className="schedule-info-grid">
            <div className="schedule-info-card">
              <span className="info-label">Mã lớp học</span>
              <strong className="info-value text-primary">{item.code}</strong>
            </div>
            <div className="schedule-info-card">
              <span className="info-label">Môn học đào tạo</span>
              <strong className="info-value">{course.name} ({course.code})</strong>
            </div>
            <div className="schedule-info-card">
              <span className="info-label">Quy mô đào tạo</span>
              <strong className="info-value">{course.credits} tín chỉ · {course.session_count} buổi học</strong>
            </div>
            <div className="schedule-info-card">
              <span className="info-label">Học kỳ / Phòng mặc định</span>
              <strong className="info-value">{item.term || 'Học kỳ chuẩn'} · {item.room}</strong>
            </div>
          </div>
        </section>

        {/* FORM CHÍNH: NHÓM 2, 3, 4 */}
        <form
          className="schedule-main-form"
          id="schedule-main-form"
          onChange={() => setPreview(null)}
          onSubmit={(event) => void getPreview(event)}
        >
          {/* NHÓM 2: THỜI GIAN HỌC */}
          <section className="schedule-group">
            <div className="schedule-group-header">
              <span className="group-step">2</span>
              <div>
                <h4>Thời gian đào tạo</h4>
                <p>Chọn ngày bắt đầu khóa học và khung giờ cho các buổi học định kỳ</p>
              </div>
            </div>
            <div className="form-grid form-grid-2col">
              <label className="field">
                <span>Ngày bắt đầu đào tạo <b className="required-star">*</b></span>
                <input defaultValue={today} name="start_date" required type="date" />
                <small className="field-hint">Buổi học đầu tiên sẽ được tính từ ngày này</small>
              </label>
              <label className="field">
                <span>Tổng số buổi học <b className="required-star">*</b></span>
                <input defaultValue={course.session_count} max={60} min={1} name="session_count" required type="number" />
                <small className="field-hint">Mặc định theo chương trình môn học ({course.session_count} buổi)</small>
              </label>
              <label className="field">
                <span>Giờ bắt đầu ca học <b className="required-star">*</b></span>
                <input defaultValue={item.start_time} name="start_time" required type="time" />
              </label>
              <label className="field">
                <span>Giờ kết thúc ca học <b className="required-star">*</b></span>
                <input defaultValue={item.end_time} name="end_time" required type="time" />
              </label>
            </div>
          </section>

          {/* NHÓM 3: GIẢNG VIÊN VÀ PHÒNG HỌC */}
          <section className="schedule-group">
            <div className="schedule-group-header">
              <span className="group-step">3</span>
              <div>
                <h4>Giảng viên & Phòng học</h4>
                <p>Phân công nhân sự giảng dạy và địa điểm học tập cho lớp</p>
              </div>
            </div>
            <div className="form-grid form-grid-2col">
              <label className="field">
                <span>Giảng viên phụ trách <b className="required-star">*</b></span>
                <select defaultValue={item.teacher_id} name="teacher_id" required>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name} ({teacher.email})
                    </option>
                  ))}
                </select>
                <small className="field-hint">Hệ thống sẽ kiểm tra trùng lịch dạy của giảng viên</small>
              </label>
              <label className="field">
                <span>Phòng học phân bổ <b className="required-star">*</b></span>
                <select defaultValue={item.room} name="room" required>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.code}>
                      {room.code} ({room.capacity} chỗ)
                    </option>
                  ))}
                  {!rooms.some((room) => room.code === item.room) ? (
                    <option value={item.room}>{item.room}</option>
                  ) : null}
                </select>
                <small className="field-hint">Hệ thống sẽ kiểm tra trùng lịch phòng học</small>
              </label>
            </div>
          </section>

          {/* NHÓM 4: CÁC THỨ HỌC TRONG TUẦN */}
          <section className="schedule-group">
            <div className="schedule-group-header">
              <span className="group-step">4</span>
              <div>
                <h4>Các thứ học trong tuần</h4>
                <p>Chọn các ngày học định kỳ theo tuần (Hệ thống tự động lặp theo các thứ được chọn)</p>
              </div>
            </div>
            <div className="weekday-presets-bar">
              <span className="preset-label">Mẫu chọn nhanh:</span>
              <button className="preset-chip" onClick={() => applyPreset([0, 2, 4])} type="button">T2 - T4 - T6</button>
              <button className="preset-chip" onClick={() => applyPreset([1, 3, 5])} type="button">T3 - T5 - T7</button>
              <button className="preset-chip" onClick={() => applyPreset([0, 1, 2, 3, 4])} type="button">Thứ 2 đến Thứ 6</button>
              <button className="preset-chip" onClick={() => applyPreset([5, 6])} type="button">Cuối tuần (T7, CN)</button>
            </div>
            <div className="schedule-week-picker-grid">
              {weekdayOptions.map((day, index) => {
                const isSelected = weekdays.includes(index)
                return (
                  <button
                    className={`schedule-weekday-btn ${isSelected ? 'selected' : ''}`}
                    key={day}
                    onClick={() => {
                      setWeekdays((curr) =>
                        curr.includes(index) ? curr.filter((v) => v !== index) : [...curr, index].sort()
                      )
                      setPreview(null)
                    }}
                    type="button"
                  >
                    <span className="weekday-badge">{isSelected ? '✓' : ''}</span>
                    <span className="weekday-text">{day}</span>
                  </button>
                )
              })}
            </div>
            {!weekdays.length ? (
              <div className="form-alert warning-alert" style={{ marginTop: '12px' }}>
                Vui lòng chọn ít nhất một thứ trong tuần để có thể tạo thời khóa biểu.
              </div>
            ) : null}
          </section>
        </form>

        {/* NHÓM 5: NGÀY NGHỈ LỄ & NGOẠI LỆ */}
        <section className="schedule-group">
          <div className="schedule-group-header">
            <span className="group-step">5</span>
            <div>
              <h4>Ngày nghỉ lễ & Ngoại lệ</h4>
              <p>Các ngày nghỉ trong kỳ sẽ được tự động bỏ qua và bù sang buổi kế tiếp</p>
            </div>
          </div>
          <form className="holiday-add-form" onSubmit={(event) => void addHoliday(event)}>
            <label className="field field-inline-date">
              <span>Ngày nghỉ</span>
              <input name="holiday_date" required type="date" />
            </label>
            <label className="field field-inline-name">
              <span>Lý do / Tên kỳ nghỉ</span>
              <input maxLength={150} minLength={2} name="holiday_name" placeholder="VD: Nghỉ lễ Quốc khánh" required />
            </label>
            <button className="button button-outline holiday-add-btn" disabled={busy} type="submit">
              <UiIcon name="plus" size={15} /> Thêm ngày nghỉ
            </button>
          </form>
          {holidays.length ? (
            <div className="holiday-tags-list">
              {holidays.map((holiday) => (
                <div className="holiday-tag-item" key={holiday.id}>
                  <span className="holiday-date-text">{holiday.holiday_date}</span>
                  <span className="holiday-name-text">{holiday.name}</span>
                  <button
                    aria-label="Xóa ngày nghỉ"
                    className="holiday-remove-btn"
                    onClick={() => void removeHoliday(holiday.id)}
                    title="Xóa ngày nghỉ này"
                    type="button"
                  >
                    <UiIcon name="close" size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="holiday-empty-note">
              Chưa thiết lập ngày nghỉ nào. Các buổi học sẽ được xếp liên tục theo tuần.
            </div>
          )}
        </section>

        {/* NHÓM 6: XEM TRƯỚC LỊCH & KIỂM TRA XUNG ĐỘT */}
        <section className="schedule-group schedule-group-preview">
          <div className="schedule-group-header">
            <span className="group-step">6</span>
            <div>
              <h4>Xem trước lịch học & Kiểm tra xung đột</h4>
              <p>Tính toán toàn bộ các buổi học và kiểm tra trùng phòng/giảng viên trước khi lưu</p>
            </div>
          </div>

          <div className="preview-action-row">
            <button
              className="button button-primary preview-trigger-btn"
              disabled={busy || !weekdays.length}
              form="schedule-main-form"
              type="submit"
            >
              <UiIcon name="calendar" size={16} />
              {busy ? 'Đang tính toán lịch…' : 'Xem trước lịch học'}
            </button>
            <span className="preview-note-text">
              Nhấn nút trên để thuật toán sinh danh sách buổi học và phát hiện xung đột.
            </span>
          </div>

          {problem ? <div className="form-alert error-alert" style={{ marginTop: '14px' }}>{problem}</div> : null}

          {preview ? (
            <div className="preview-results-box">
              <div className="preview-stats-bar">
                <div className="stat-pill">
                  <span className="stat-pill-label">Số buổi tính toán:</span>
                  <strong className="stat-pill-val">{preview.session_count} buổi</strong>
                </div>
                <div className="stat-pill">
                  <span className="stat-pill-label">Kiểm tra xung đột:</span>
                  {preview.conflict_count > 0 ? (
                    <span className="status-pill status-locked">
                      <i></i> Phát hiện {preview.conflict_count} xung đột!
                    </span>
                  ) : (
                    <span className="status-pill status-active">
                      <i></i> Không có xung đột
                    </span>
                  )}
                </div>
              </div>

              {preview.conflict_count > 0 ? (
                <div className="form-alert warning-alert" style={{ margin: '14px 0' }}>
                  <strong>Cảnh báo:</strong> Có {preview.conflict_count} buổi học bị trùng giảng viên hoặc phòng học với lớp khác. Nếu tiếp tục lưu, bạn cần xác nhận cho phép ghi đè.
                </div>
              ) : null}

              <div className="table-container schedule-preview-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '70px' }}>BUỔI</th>
                      <th>NGÀY & THỨ</th>
                      <th>GIỜ HỌC</th>
                      <th>NỘI DUNG SYLLABUS</th>
                      <th>GIẢNG VIÊN & PHÒNG</th>
                      <th>XUNG ĐỘT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sessions.map((session, index) => (
                      <tr className={session.conflicts.length ? 'table-row-conflict' : ''} key={`${session.session_date}-${index}`}>
                        <td>
                          <strong>#{session.lesson_sequence || index + 1}</strong>
                        </td>
                        <td>
                          <strong>{session.weekday}</strong>
                          <span className="table-secondary">{session.session_date}</span>
                        </td>
                        <td>
                          <span className="time-tag">{session.start_time} – {session.end_time}</span>
                        </td>
                        <td>
                          Buổi {session.lesson_sequence}: {session.lesson_title || 'Nội dung theo tiến độ'}
                        </td>
                        <td>
                          <strong>{session.teacher_name}</strong>
                          <span className="table-secondary">{session.room}</span>
                        </td>
                        <td>
                          {session.conflicts.length ? (
                            session.conflicts.map((conflict, offset) => (
                              <span className="conflict-tag" key={`${conflict.class_code}-${offset}`}>
                                {conflict.class_code}: {[conflict.teacher_conflict ? 'GV' : '', conflict.room_conflict ? 'Phòng' : ''].filter(Boolean).join(', ')}
                              </span>
                            ))
                          ) : (
                            <span className="valid-tag">✓ Hợp lệ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        {/* NHÓM 7: LƯU THỜI KHÓA BIỂU */}
        <section className="schedule-group schedule-group-save">
          <div className="schedule-group-header">
            <span className="group-step">7</span>
            <div>
              <h4>Lưu thời khóa biểu</h4>
              <p>Xác nhận và lưu dữ liệu lịch học chính thức vào hệ thống đào tạo</p>
            </div>
          </div>
          <div className="schedule-save-footer">
            <button className="button button-outline" onClick={onClose} type="button">
              {presentation === 'page' ? 'Quay lại danh sách lớp' : 'Đóng hộp thoại'}
            </button>
            {preview ? (
              <button
                className={`button ${preview.conflict_count ? 'button-danger' : 'button-primary'}`}
                disabled={busy}
                onClick={() => {
                  const form = document.getElementById('schedule-main-form') as HTMLFormElement | null
                  if (form) void saveSchedule(form)
                }}
                type="button"
              >
                <UiIcon name="check" size={16} />
                {busy
                  ? 'Đang lưu vào hệ thống…'
                  : preview.conflict_count
                    ? `Xác nhận ghi đè (${preview.conflict_count} xung đột) & Lưu lịch`
                    : 'Xác nhận lưu thời khóa biểu'}
              </button>
            ) : (
              <button
                className="button button-primary"
                disabled={busy || !weekdays.length}
                onClick={() => {
                  const form = document.getElementById('schedule-main-form') as HTMLFormElement | null
                  if (form) form.requestSubmit()
                }}
                type="button"
              >
                Vui lòng xem trước lịch trước khi lưu
              </button>
            )}
          </div>
        </section>
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
  presentation = 'dialog',
  onClose,
  onSaved,
}: {
  item: TrainingClass | null
  courses: Course[]
  programs: StudyProgram[]
  rooms: Classroom[]
  teachers: User[]
  assistants: User[]
  presentation?: 'dialog' | 'page'
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [programId, setProgramId] = useState(item ? '' : String(programs[0]?.id ?? ''))
  const [selectedRoom, setSelectedRoom] = useState(item?.room ?? (rooms[0]?.code ?? ''))
  const [capacity, setCapacity] = useState(item?.capacity ?? 40)
  const roomObj = rooms.find((r) => r.code === selectedRoom)
  const isRoomExceeded = roomObj && capacity > roomObj.capacity
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
    <Modal
      backHref={presentation === 'page' ? '/classes' : undefined}
      eyebrow="TỔ CHỨC GIẢNG DẠY"
      onClose={onClose}
      presentation={presentation}
      size="large"
      title={item ? 'Cập nhật lớp học phần' : 'Tạo lớp học phần'}
    >
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
              <SearchableSelect ariaLabel="Training program" onChange={setProgramId} options={programs.map((program) => ({ value: String(program.id), label: `${program.code} - ${program.name}` }))} placeholder="Choose a program" required value={programId} />
            </label>
          ) : null}
          <label className="field">
            <span>Môn học <b>*</b></span>
            <SearchableSelect ariaLabel="Course" defaultValue={String(item?.course_id ?? '')} name="course_id" options={visibleCourses.map((course) => ({ value: String(course.id), label: `${course.code} - ${course.name}` }))} placeholder="Choose a course" required />
          </label>
          <label className="field">
            <span>Giảng viên phụ trách <b>*</b></span>
            <SearchableSelect ariaLabel="Instructor" defaultValue={String(item?.teacher_id ?? '')} name="teacher_id" options={teachers.map((teacher) => ({ value: String(teacher.id), label: `${teacher.full_name} (${teacher.email})` }))} placeholder="Choose an instructor" required />
          </label>
          <label className="field">
            <span>Trợ giảng (có thể chọn nhiều)</span>
            <SearchableMultiSelect ariaLabel="Teaching assistants" defaultValue={item?.assistants.map((assistant) => String(assistant.id)) ?? []} name="assistant_ids" options={assistants.map((assistant) => ({ value: String(assistant.id), label: `${assistant.full_name} (${assistant.email})` }))} />
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
            <SearchableSelect ariaLabel="Classroom" name="room" onChange={setSelectedRoom} options={[...(item && !rooms.some((room) => room.code === item.room) ? [{ value: item.room, label: `${item.room} - Legacy room` }] : []), ...rooms.map((room) => ({ value: room.code, label: `${room.code} - ${room.capacity} seats` }))]} placeholder="Choose a classroom" required value={selectedRoom} />
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
            <input
              max={500}
              min={1}
              name="capacity"
              onChange={(event) => setCapacity(Number(event.target.value) || 0)}
              required
              type="number"
              value={capacity}
            />
          </label>
        </div>
        {isRoomExceeded ? (
          <div className="form-alert warning-alert" style={{ marginTop: '12px' }}>
            <UiIcon name="warning" size={16} /> <strong>Cảnh báo sức chứa:</strong> Sĩ số lớp ({capacity} học viên) vượt quá sức chứa của phòng {roomObj?.code} ({roomObj?.capacity} chỗ).
          </div>
        ) : null}
        <p className="form-note">Hệ thống sẽ kiểm tra trùng lịch giảng viên, phòng học và học viên trước khi lưu.</p>
        <div className={presentation === 'page' ? 'page-actions' : 'modal-actions'}>
          {presentation === 'dialog' ? <button className="button button-outline" onClick={onClose} type="button">Hủy</button> : null}
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

function RosterPage({
  item,
  section,
  canEnroll,
  canManageAttendance,
  canManageTuition,
  isAdmin = false,
  notify,
  onUpdated,
}: {
  item: TrainingClass
  section: 'students' | 'enroll' | 'attendance' | 'tuition' | 'schedule'
  canEnroll: boolean
  canManageAttendance: boolean
  canManageTuition: boolean
  isAdmin?: boolean
  notify: (message: string) => void
  onUpdated: () => void
}) {
  const [students, setStudents] = useState<RosterStudent[]>([])
  const [available, setAvailable] = useState<User[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [sessions, setSessions] = useState<ScheduledSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [attendanceData, setAttendanceData] = useState<AttendanceEditorData | null>(null)
  const [attendanceMarks, setAttendanceMarks] = useState<Record<number, string | null>>({})
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceFilter, setAttendanceFilter] = useState('all')
  const [attendanceSearch, setAttendanceSearch] = useState('')
  const [attendancePage, setAttendancePage] = useState(1)
  const [availableSearch, setAvailableSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterPage, setRosterPage] = useState(1)

  const filteredRoster = students.filter((student) => `${student.full_name} ${student.student_code ?? ''} ${student.username} ${student.email}`.toLocaleLowerCase('vi').includes(rosterSearch.trim().toLocaleLowerCase('vi')))
  const rosterPageSize = 10
  const rosterPageCount = Math.max(1, Math.ceil(filteredRoster.length / rosterPageSize))
  const pagedRoster = filteredRoster.slice((rosterPage - 1) * rosterPageSize, rosterPage * rosterPageSize)

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
  }, [canEnroll, canManageAttendance, item.id, refresh])

  useEffect(() => {
    if (!activeSessionId) return
    let active = true
    apiRequest<AttendanceEditorData>(`/attendance/sessions/${activeSessionId}`)
      .then((result) => {
        if (!active) return
        setAttendanceData(result)
        setAttendanceMarks(Object.fromEntries(result.students.map((student) => [student.id, student.status])))
      })
      .catch((error: unknown) => {
        if (!active) return
        setAttendanceData(null)
        setProblem(showError(error))
      })
      .finally(() => { if (active) setAttendanceLoading(false) })
    return () => { active = false }
  }, [activeSessionId])

  const attendanceDirty = useMemo(() => {
    if (!attendanceData) return false
    return attendanceData.students.some((student) => (attendanceMarks[student.id] ?? '') !== (student.status ?? ''))
  }, [attendanceData, attendanceMarks])

  useEffect(() => {
    if (!attendanceDirty) return
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [attendanceDirty])

  const attendanceCounts = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, notRecorded: 0 }
    attendanceData?.students.forEach((student) => {
      const status = attendanceMarks[student.id] ?? ''
      if (status === 'present') counts.present += 1
      else if (status === 'late') counts.late += 1
      else if (status === 'excused_absent' || status === 'unexcused_absent') counts.absent += 1
      else counts.notRecorded += 1
    })
    return counts
  }, [attendanceData, attendanceMarks])

  const visibleAttendanceStudents = attendanceData?.students.filter((student) => {
    const status = attendanceMarks[student.id] ?? ''
    const matchesSearch = `${student.full_name} ${student.student_code ?? ''}`.toLocaleLowerCase('vi').includes(attendanceSearch.trim().toLocaleLowerCase('vi'))
    if (!matchesSearch) return false
    if (attendanceFilter === 'all') return true
    if (attendanceFilter === 'absent') return status === 'excused_absent' || status === 'unexcused_absent'
    if (attendanceFilter === 'not_recorded') return !status
    return status === attendanceFilter
  }) ?? []
  const attendancePageSize = 10
  const attendancePageCount = Math.max(1, Math.ceil(visibleAttendanceStudents.length / attendancePageSize))
  const pagedAttendanceStudents = visibleAttendanceStudents.slice((attendancePage - 1) * attendancePageSize, attendancePage * attendancePageSize)

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
      setSelected([])
      setAvailableSearch('')
      setRefresh((value) => value + 1)
      onUpdated()
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
    const records = attendanceData.students
      .filter((student) => attendanceMarks[student.id] !== student.status)
      .map((student) => ({
        student_id: student.id,
        status: attendanceMarks[student.id] ?? null,
      }))
    if (!records.length) {
      setProblem('Chọn trạng thái ít nhất một học viên hoặc bấm “Tất cả có mặt”.')
      return
    }
    setBusy(true)
    setProblem('')
    try {
      const result = await apiRequest<{ session_id: number; updated_count: number }>(`/attendance/sessions/${activeSessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ records }),
      })
      const updatedStatuses = new Map(records.map((record) => [record.student_id, record.status]))
      setAttendanceData((current) => current ? {
        ...current,
        students: current.students.map((student) => updatedStatuses.has(student.id)
          ? { ...student, status: updatedStatuses.get(student.id) ?? null }
          : student),
      } : current)
      setAttendanceMarks((current) => ({
        ...current,
        ...Object.fromEntries(records.map((record) => [record.student_id, record.status])),
      }))
      notify(`Đã lưu điểm danh (${result.updated_count} thay đổi).`)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  const sectionTitles: Record<'students' | 'enroll' | 'attendance' | 'tuition' | 'schedule', string> = {
    students: 'Danh sách học viên',
    enroll: 'Ghi danh học viên',
    attendance: 'Điểm danh theo buổi',
    tuition: 'Theo dõi học phí',
    schedule: 'Thời khóa biểu & Lịch học của lớp',
  }
  const sections = [
    { key: 'students' as const, label: 'Danh sách học viên', visible: true },
    { key: 'enroll' as const, label: 'Ghi danh', visible: canEnroll },
    { key: 'attendance' as const, label: 'Điểm danh', visible: canManageAttendance },
    { key: 'tuition' as const, label: 'Học phí', visible: canManageTuition },
    { key: 'schedule' as const, label: 'Thời khóa biểu & Lịch', visible: isAdmin || canManageAttendance },
  ]
  const basePath = `/classes/${item.id}`

  return (
    <div className="page-stack class-detail-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">{item.code} · {item.course_name}</span>
          <h1>{sectionTitles[section]}</h1>
          <p>{item.name} · {item.term} · {item.teacher_name}</p>
        </div>
        <a className="button button-outline" href="/classes">Quay lại danh sách lớp</a>
      </div>
      <div className="roster-summary">
        <div><span>SĨ SỐ HIỆN TẠI</span><strong>{students.length}<small> / {item.capacity}</small></strong></div>
        <div><span>GIẢNG VIÊN</span><strong>{item.teacher_name}</strong></div>
        <div><span>THỜI GIAN</span><strong>{item.weekday}, {item.start_time}–{item.end_time}</strong></div>
      </div>
      <nav aria-label="Chức năng của lớp" className="detail-tabs">
        {sections.filter((entry) => entry.visible).map((entry) => (
          <a
            aria-current={section === entry.key ? 'page' : undefined}
            className={section === entry.key ? 'detail-tab active' : 'detail-tab'}
            href={`${basePath}/${entry.key}`}
            key={entry.key}
          >
            {entry.label}
          </a>
        ))}
      </nav>
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      {section === 'enroll' && canEnroll ? (
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
      {section === 'attendance' && canManageAttendance ? (
        <section className="quick-attendance">
          <div className="section-heading">
            <div><span className="eyebrow">ĐIỂM DANH NHANH</span><h2>Chọn buổi học để điểm danh</h2></div>
            <a className="button button-outline button-small" href={`/classes/${item.id}/attendance/matrix`}>Xem ma trận</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            <label className="field" style={{ flex: 1, minWidth: '260px' }}>
              <span>Buổi học đã xếp</span>
              <select onChange={(event) => {
                if (attendanceDirty && !window.confirm('Bạn có thay đổi điểm danh chưa lưu. Rời buổi học này sẽ làm mất các thay đổi đó. Tiếp tục?')) {
                  event.currentTarget.value = activeSessionId
                  return
                }
                setAttendanceData(null)
                setAttendanceMarks({})
                setAttendanceFilter('all')
                setAttendanceSearch('')
                setAttendancePage(1)
                setProblem('')
                setAttendanceLoading(Boolean(event.target.value))
                setActiveSessionId(event.target.value)
              }} value={activeSessionId}>
                <option value="">Chọn buổi học</option>
                {sessions.filter((session) => !session.is_cancelled).map((session) => <option key={session.id} value={session.id}>{session.session_date} · {session.start_time} · {session.lesson_title ?? 'Buổi học'}</option>)}
              </select>
            </label>
            {isAdmin && activeSessionId ? (
              <a
                className="button button-outline button-small"
                href={`/schedule/sessions/${activeSessionId}`}
                style={{ marginBottom: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Sửa giờ, dời ngày, đổi giảng viên dạy thay hoặc hủy buổi học này"
              >
                <UiIcon name="edit" size={14} /> Sửa / Dời / Hủy buổi này
              </a>
            ) : null}
          </div>
          {attendanceLoading ? <div aria-live="polite" className="table-loading">Đang tải danh sách điểm danh…</div> : null}
          {!attendanceLoading && activeSessionId && !attendanceData && !problem ? <div className="empty-state compact-empty">Không có dữ liệu điểm danh cho buổi học này.</div> : null}
          {attendanceData ? (
            <>
              <div className="quick-attendance-actions">
                <button className="button button-outline button-small" disabled={busy} onClick={markAllPresent} type="button">Tất cả có mặt</button>
                <span>{attendanceData.students.length} học viên · {attendanceData.session.session_date}</span>
              </div>
              <div aria-label="Thống kê điểm danh" className="attendance-counts" role="status">
                <span className="count-present">Có mặt <strong>{attendanceCounts.present}</strong></span>
                <span className="count-absent">Vắng <strong>{attendanceCounts.absent}</strong></span>
                <span className="count-late">Đi muộn <strong>{attendanceCounts.late}</strong></span>
                <span className="count-pending">Chưa điểm danh <strong>{attendanceCounts.notRecorded}</strong></span>
              </div>
              <label className="field attendance-filter">
                <span>Search learners</span>
                <input onChange={(event) => { setAttendanceSearch(event.target.value); setAttendancePage(1) }} placeholder="Search name or student ID" type="search" value={attendanceSearch} />
              </label>
              <label className="field attendance-filter">
                <span>Lọc danh sách</span>
                <select onChange={(event) => { setAttendanceFilter(event.target.value); setAttendancePage(1) }} value={attendanceFilter}>
                  <option value="all">Tất cả học viên</option>
                  <option value="present">Có mặt</option>
                  <option value="absent">Vắng (có phép và không phép)</option>
                  <option value="late">Đi muộn</option>
                  <option value="not_recorded">Chưa điểm danh</option>
                </select>
              </label>
              <div className="quick-attendance-list">
                {pagedAttendanceStudents.map((student) => (
                  <label className="quick-attendance-row" key={student.id}>
                    <span className="attendance-student"><strong>{student.full_name}</strong><small>{student.student_code}</small></span>
                    <select aria-label={`Trạng thái ${student.full_name}`} onChange={(event) => setAttendanceMarks((current) => {
                      if (!event.target.value) {
                        const next = { ...current }
                        next[student.id] = null
                        return next
                      }
                      return { ...current, [student.id]: event.target.value }
                    })} value={attendanceMarks[student.id] ?? ''}>
                      <option value="">Chưa điểm danh</option>
                      {student.status === 'absent' ? <option disabled value="absent">Vắng (dữ liệu cũ)</option> : null}
                      {attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                ))}
                {!visibleAttendanceStudents.length ? <div className="empty-state compact-empty">Không có học viên thuộc trạng thái này.</div> : null}
              </div>
              {visibleAttendanceStudents.length > attendancePageSize ? <ListPagination page={attendancePage} pageSize={attendancePageSize} total={visibleAttendanceStudents.length} onPageChange={(nextPage) => setAttendancePage(Math.min(attendancePageCount, nextPage))} /> : null}
              <div className="attendance-save-bar">
                <span>{attendanceDirty ? 'Có thay đổi chưa lưu' : 'Mọi thay đổi đã được lưu'}</span>
                <button className="button button-primary" disabled={busy || !attendanceDirty || !Object.keys(attendanceMarks).length} onClick={() => void saveAttendance()} type="button">{busy ? 'Đang lưu…' : 'Lưu điểm danh'}</button>
              </div>
              <p className="form-note">Buổi quá khứ chỉ Quản lý đào tạo được sửa. Mọi thay đổi sau khi lưu đều được ghi nhật ký.</p>
            </>
          ) : null}
        </section>
      ) : null}
      {section === 'students' ? (
        <section className="panel roster-page-panel">
          <div className="roster-toolbar">
            <div><span className="eyebrow">DANH SÁCH LỚP</span><h2>Học viên đã ghi danh</h2></div>
            <button className="button button-outline" onClick={() => void exportRoster()} type="button"><UiIcon name="download" size={17} /> Xuất Excel</button>
          </div>
          <div className="roster-list-toolbar"><input aria-label="Search class roster" onChange={(event) => { setRosterSearch(event.target.value); setRosterPage(1) }} placeholder="Search name, student ID, or email" type="search" value={rosterSearch} /><span>{filteredRoster.length} students</span></div>
          <div className="roster-list">
        {loading ? <div className="table-loading">Đang tải danh sách…</div> : null}
        {!loading && pagedRoster.map((student, index) => (
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
              {student.tuition_status === 'paid' ? 'Đã đóng học phí' : 'Chưa đóng học phí'}
            </span>
            <span className={`roster-status-pill attendance-${student.attendance_status}`}>
              {student.attendance_status === 'present' ? 'Có mặt' : student.attendance_status === 'absent' ? 'Vắng' : student.attendance_status === 'late' ? 'Đi muộn' : 'Chưa điểm danh'}
            </span>
          </div>
        ))}
        {!loading && !students.length ? <div className="empty-state compact-empty"><strong>Chưa có học viên</strong><span>Thêm học viên từ danh sách tài khoản.</span></div> : null}
          </div>
          {filteredRoster.length > rosterPageSize ? <ListPagination page={rosterPage} pageSize={rosterPageSize} total={filteredRoster.length} onPageChange={(nextPage) => setRosterPage(Math.min(rosterPageCount, nextPage))} /> : null}
        </section>
      ) : null}
      {section === 'tuition' && canManageTuition ? (
        <section className="panel roster-page-panel">
          <div className="roster-toolbar"><div><span className="eyebrow">THEO DÕI TÀI CHÍNH</span><h2>Trạng thái học phí từng học viên</h2></div></div>
          <div className="roster-list-toolbar"><input aria-label="Search tuition list" onChange={(event) => { setRosterSearch(event.target.value); setRosterPage(1) }} placeholder="Search name, student ID, or email" type="search" value={rosterSearch} /><span>{filteredRoster.length} students</span></div>
          <div className="roster-list">
            {loading ? <div className="table-loading">Đang tải danh sách…</div> : null}
            {pagedRoster.map((student) => (
              <div className="roster-row tuition-roster-row" key={student.id}>
                <span><strong>{student.full_name}</strong><small>{student.student_code || student.username} · {student.email}</small></span>
                <span className={`roster-status-pill ${student.tuition_status === 'paid' ? 'paid-status' : 'unpaid-status'}`}>
                  <select aria-label={`Học phí ${student.full_name}`} onChange={(event) => void updateStatus(student.id, 'tuition_status', event.target.value)} value={student.tuition_status}>
                    <option value="paid">Đã đóng học phí</option>
                    <option value="unpaid">Chưa đóng học phí</option>
                  </select>
                </span>
              </div>
            ))}
            {!loading && !filteredRoster.length ? <div className="empty-state compact-empty"><strong>Chưa có học viên</strong><span>Danh sách học phí sẽ hiện sau khi có ghi danh.</span></div> : null}
          </div>
          {filteredRoster.length > rosterPageSize ? <ListPagination page={rosterPage} pageSize={rosterPageSize} total={filteredRoster.length} onPageChange={(nextPage) => setRosterPage(Math.min(rosterPageCount, nextPage))} /> : null}
        </section>
      ) : null}
      {section === 'schedule' && (isAdmin || canManageAttendance) ? (
        <section className="panel roster-page-panel">
          <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span className="eyebrow">QUẢN LÝ LỊCH HỌC CỦA LỚP</span>
              <h2>Thời khóa biểu và danh sách buổi học</h2>
            </div>
            {isAdmin ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <a className="button button-outline button-small" href={`/schedule/generate?class_id=${item.id}`}>
                  <UiIcon name="calendar" size={14} /> Sinh lịch tự động
                </a>
                <a className="button button-primary button-small" href={`/classes/${item.id}/schedule`}>
                  <UiIcon name="edit" size={14} /> Cấu hình / Tạo lịch
                </a>
              </div>
            ) : null}
          </div>

          <div className="class-kpi-bar" style={{ margin: '16px 0' }}>
            <div className="class-kpi-item">
              <span>Tổng số buổi</span>
              <strong>{sessions.length}</strong>
            </div>
            <div className="class-kpi-item">
              <span>Đang diễn ra</span>
              <strong style={{ color: '#16a34a' }}>{sessions.filter((s) => !s.is_cancelled).length}</strong>
            </div>
            <div className="class-kpi-item">
              <span>Đã hủy</span>
              <strong style={{ color: '#dc2626' }}>{sessions.filter((s) => s.is_cancelled).length}</strong>
            </div>
            <div className="class-kpi-item">
              <span>Đã điểm danh</span>
              <strong style={{ color: '#0054a6' }}>{sessions.filter((s) => s.has_attendance).length}</strong>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>BUỔI HỌC</th>
                  <th>NGÀY HỌC</th>
                  <th>THỜI GIAN</th>
                  <th>TRẠNG THÁI</th>
                  <th style={{ textAlign: 'right' }}>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session, idx) => (
                  <tr key={session.id} style={{ opacity: session.is_cancelled ? 0.6 : 1 }}>
                    <td>
                      <strong>Buổi {idx + 1}: {session.lesson_title || 'Bài học'}</strong>
                      {session.is_cancelled ? <span className="status-pill status-cancelled" style={{ marginLeft: 8 }}>Đã hủy</span> : null}
                    </td>
                    <td><span className="mono-code">{session.session_date}</span></td>
                    <td>{session.start_time} – {session.end_time}</td>
                    <td>
                      {session.has_attendance ? (
                        <span className="status-pill status-active">Đã điểm danh</span>
                      ) : (
                        <span className="status-pill status-locked">Chưa điểm danh</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <a className="button button-small button-outline" href={`/schedule/sessions/${session.id}`}>
                          Chi tiết / Sửa
                        </a>
                        {canManageAttendance && !session.is_cancelled ? (
                          <a className="button button-small button-primary" href={`${basePath}/attendance`}>
                            Điểm danh
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!sessions.length ? (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      <div className="empty-state compact-empty">
                        <div className="empty-icon"><UiIcon name="calendar" size={22} /></div>
                        <strong>Lớp học chưa có buổi học nào được xếp</strong>
                        <span>Hãy sử dụng chức năng Sinh lịch tự động hoặc Tạo lịch để lên thời khóa biểu cho lớp.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}

export function ClassRosterPage({
  classId,
  section,
  user,
  notify,
}: {
  classId: number
  section: 'students' | 'enroll' | 'attendance' | 'tuition' | 'schedule'
  user: User
  notify: (message: string) => void
}) {
  const [item, setItem] = useState<TrainingClass | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [refresh, setRefresh] = useState(0)
  const isAdmin = user.roles.includes('admin') || user.roles.includes('manager')
  const isTeacher = user.roles.includes('teacher') || user.roles.includes('ta')
  const canEnroll = isAdmin || user.roles.includes('admissions')
  const canManageTuition = isAdmin || user.roles.includes('accountant')
  const canManageAttendance = isAdmin || isTeacher
  const canViewRoster =
    isAdmin ||
    isTeacher ||
    user.roles.includes('admissions') ||
    user.roles.includes('accountant')

  useEffect(() => {
    let active = true
    apiRequest<TrainingClass[]>('/classes')
      .then((classes) => {
        const found = classes.find((trainingClass) => trainingClass.id === classId)
        if (!found) throw new Error('Không tìm thấy lớp học hoặc bạn không có quyền truy cập.')
        if (active) {
          setItem(found)
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
  }, [classId, refresh])

  if (loading) {
    return <section className="panel detail-loading">Đang tải thông tin lớp học…</section>
  }

  if (problem || !item) {
    return (
      <section className="page-stack">
        <div className="form-alert error-alert">{problem || 'Không tìm thấy lớp học.'}</div>
        <a className="button button-outline" href="/classes">Quay lại danh sách lớp</a>
      </section>
    )
  }

  const allowed =
    (section === 'students' && canViewRoster) ||
    (section === 'enroll' && canEnroll) ||
    (section === 'attendance' && canManageAttendance) ||
    (section === 'tuition' && canManageTuition) ||
    (section === 'schedule' && (isAdmin || isTeacher))

  if (!allowed) {
    return (
      <section className="page-stack">
        <div className="form-alert error-alert">Bạn không có quyền sử dụng chức năng này.</div>
        <a className="button button-outline" href={`/classes/${classId}/students`}>Mở danh sách học viên</a>
      </section>
    )
  }

  return (
    <RosterPage
      canEnroll={canEnroll}
      canManageAttendance={canManageAttendance}
      canManageTuition={canManageTuition}
      isAdmin={isAdmin}
      item={item}
      notify={notify}
      onUpdated={() => setRefresh((value) => value + 1)}
      section={section}
    />
  )
}

type ClassWorkflowMode = 'create' | 'edit' | 'schedule'

type ClassWorkflowData = {
  item: TrainingClass | null
  courses: Course[]
  programs: StudyProgram[]
  rooms: Classroom[]
  teachers: User[]
  assistants: User[]
}

export function ClassWorkflowPage({
  classId,
  mode,
  notify,
}: {
  classId: number | null
  mode: ClassWorkflowMode
  notify: (message: string) => void
}) {
  const [data, setData] = useState<ClassWorkflowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<TrainingClass[]>('/classes'),
      apiRequest<Course[]>('/courses'),
      apiRequest<StudyProgram[]>('/study-programs'),
      apiRequest<Classroom[]>('/rooms'),
      apiRequest<AccountPage>('/accounts?role=teacher&page=1&page_size=100'),
      apiRequest<AccountPage>('/accounts?role=ta&page=1&page_size=100'),
    ])
      .then(([classes, courses, programs, rooms, teachers, assistants]) => {
        const item = mode === 'create' ? null : classes.find((candidate) => candidate.id === classId) ?? null
        if (mode !== 'create' && !item) {
          throw new Error('Không tìm thấy lớp học hoặc bạn không có quyền truy cập.')
        }
        if (mode === 'schedule' && !courses.some((course) => course.id === item?.course_id)) {
          throw new Error('Không tìm thấy môn học của lớp.')
        }
        if (active) {
          setData({
            item,
            courses,
            programs,
            rooms,
            teachers: teachers.items,
            assistants: assistants.items,
          })
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
  }, [classId, mode])

  if (loading) {
    return <section className="panel detail-loading">Đang tải dữ liệu biểu mẫu…</section>
  }

  if (!data) {
    return (
      <section className="page-stack">
        <div className="form-alert error-alert">{problem || 'Không tải được dữ liệu cần thiết.'}</div>
        <a className="button button-outline" href="/classes">Quay lại danh sách lớp</a>
      </section>
    )
  }

  const onClose = () => navigateTo('/classes')
  const onSaved = () => {
    notify(mode === 'schedule' ? 'Đã tạo thời khóa biểu cho lớp.' : mode === 'edit' ? 'Đã cập nhật lớp học.' : 'Đã tạo lớp học.')
    navigateTo('/classes')
  }

  if (mode === 'schedule' && data.item) {
    const course = data.courses.find((candidate) => candidate.id === data.item?.course_id)
    if (!course) {
      return <section className="form-alert error-alert">Không tìm thấy môn học của lớp.</section>
    }
    return (
      <ClassScheduleModal
        course={course}
        item={data.item}
        notify={notify}
        onClose={onClose}
        onSaved={onSaved}
        presentation="page"
        rooms={data.rooms}
        teachers={data.teachers}
      />
    )
  }

  return (
    <ClassEditor
      assistants={data.assistants}
      courses={data.courses}
      item={data.item}
      onClose={onClose}
      onSaved={onSaved}
      presentation="page"
      programs={data.programs}
      rooms={data.rooms}
      teachers={data.teachers}
    />
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
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalClasses, setTotalClasses] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [termFilter, setTermFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [announcementOpen, setAnnouncementOpen] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementClassIds, setAnnouncementClassIds] = useState<number[]>([])
  const [announcementBusy, setAnnouncementBusy] = useState(false)
  const [announcementError, setAnnouncementError] = useState('')
  const [announcementReadCount, setAnnouncementReadCount] = useState<{ recipient_count: number; read_count: number; unread_count: number } | null>(null)
  const isAdmin = user.roles.includes('admin') || user.roles.includes('manager')
  const isTeacher = user.roles.includes('teacher') || user.roles.includes('ta')
  const canManageAttendance = isAdmin || isTeacher
  const canViewRoster =
    isAdmin ||
    isTeacher ||
    user.roles.includes('admissions') ||
    user.roles.includes('accountant')

  useEffect(() => {
    apiRequest<StudyProgram[]>('/study-programs').then(setPrograms).catch(() => {})
    apiRequest<Course[]>('/courses?page=1&page_size=100').then(setCourses).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (q.trim()) params.set('q', q.trim())
    if (termFilter) params.set('term', termFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (teacherFilter) params.set('teacher_id', teacherFilter)
    if (programFilter) params.set('program_id', programFilter)
    if (courseFilter) params.set('course_id', courseFilter)
    if (startDateFilter) params.set('start_date', startDateFilter)
    if (endDateFilter) params.set('end_date', endDateFilter)
    const query = params.size ? `?${params}` : ''
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      apiRequestWithHeaders<TrainingClass[]>(`/classes${query}`)
        .then(({ data, headers }) => {
          if (!active) return
          const pagination = paginationFromHeaders(headers, { page, pageSize })
          setClasses(data)
          setTotalClasses(pagination.total)
          setPageCount(Math.max(1, pagination.pages))
          if (page > pagination.pages && pagination.pages > 0) setPage(pagination.pages)
          setProblem('')
        })
        .catch((error: unknown) => { if (active) setProblem(showError(error)) })
        .finally(() => { if (active) setLoading(false) })
    }, 200)
    return () => { active = false; window.clearTimeout(timer) }
  }, [courseFilter, endDateFilter, isAdmin, page, pageSize, programFilter, q, refresh, startDateFilter, statusFilter, teacherFilter, termFilter])

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

  async function sendAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!announcementClassIds.length) {
      setAnnouncementError('Chọn ít nhất một lớp nhận thông báo.')
      return
    }
    setAnnouncementBusy(true)
    setAnnouncementError('')
    setAnnouncementReadCount(null)
    try {
      const created = await apiRequest<{ id: number; recipient_count: number }>('/announcements', {
        method: 'POST',
        body: JSON.stringify({ class_ids: announcementClassIds, title: announcementTitle, body: announcementBody }),
      })
      const counts = await apiRequest<{ recipient_count: number; read_count: number; unread_count: number }>(`/announcements/${created.id}/read-count`)
      setAnnouncementReadCount(counts)
      notify(`Đã gửi thông báo tới ${created.recipient_count} học viên.`)
      setAnnouncementTitle('')
      setAnnouncementBody('')
      setAnnouncementClassIds([])
    } catch (error) {
      setAnnouncementError(showError(error))
    } finally {
      setAnnouncementBusy(false)
    }
  }

  const activeClasses = classes.filter((c) => c.status === 'active').length
  const preparingClasses = classes.filter((c) => c.status === 'preparing').length
  const completedClasses = classes.filter((c) => c.status === 'completed').length
  const enrolledTotal = classes.reduce((total, item) => total + item.student_count, 0)
  const seatTotal = classes.reduce((total, item) => total + item.capacity, 0)
  const capacityRate = seatTotal > 0 ? Math.round((enrolledTotal / seatTotal) * 100) : 0
  const terms = [...new Set(classes.map((item) => item.term))].sort()
  const teachers = [...new Map(classes.map((c) => [c.teacher_id, { id: c.teacher_id, name: c.teacher_name }])).values()]

  const hasActiveFilters = Boolean(q || termFilter || statusFilter || teacherFilter || programFilter || courseFilter || startDateFilter || endDateFilter)
  const visibleClasses = classes

  return (
    <div className="page-stack">
      <div className="breadcrumb">
        <span>Đào tạo</span>
        <span className="breadcrumb-divider">/</span>
        <strong>Danh sách lớp học</strong>
      </div>

      <div className="page-title-row" style={{ marginBottom: '16px' }}>
        <div>
          <span className="eyebrow">TỔ CHỨC GIẢNG DẠY</span>
          <h1>{isAdmin ? 'Danh sách lớp học' : isTeacher ? 'Lớp học phụ trách' : 'Lớp học của tôi'}</h1>
          <p>{isAdmin ? 'Quản lý toàn bộ danh sách lớp học, phân công giảng viên, bộ lọc đa chiều và theo dõi tiến độ đào tạo.' : 'Theo dõi thông tin lớp học và danh sách học viên.'}</p>
        </div>
        {isAdmin ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="button button-outline" onClick={() => setAnnouncementOpen(true)} type="button">Thông báo lớp</button>
            <a className="button button-outline" href="/schedule/generate">
              <UiIcon name="calendar" size={15} /> Sinh lịch tự động
            </a>
            <a className="button button-primary" href="/classes/new">
              <UiIcon name="plus" size={16} /> Mở lớp mới
            </a>
          </div>
        ) : null}
      </div>

      {/* 1-row KPI Metrics Strip */}
      <div className="class-kpi-bar">
        <div className="class-kpi-item">
          <span>{isAdmin ? 'Tổng số lớp' : 'Lớp tham gia'}</span>
          <strong>{totalClasses}</strong>
        </div>
        <div className="class-kpi-item">
          <span>Đang học · trang này</span>
          <strong style={{ color: '#16a34a' }}>{activeClasses}</strong>
        </div>
        <div className="class-kpi-item">
          <span>Chuẩn bị mở · trang này</span>
          <strong style={{ color: '#d97706' }}>{preparingClasses}</strong>
        </div>
        <div className="class-kpi-item">
          <span>Đã kết thúc · trang này</span>
          <strong>{completedClasses}</strong>
        </div>
        <div className="class-kpi-item">
          <span>Học viên ghi danh · trang này</span>
          <strong style={{ color: '#0054a6' }}>{enrolledTotal}</strong>
        </div>
        <div className="class-kpi-item">
          <span>Tỷ lệ lấp đầy · trang này</span>
          <strong>{capacityRate}%</strong>
        </div>
      </div>

      {/* Filter Toolbar & Data Table */}
      <section className="panel data-panel">
        <div className="table-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <div className="search-box" style={{ minWidth: '220px', flex: 1, height: '38px' }}>
            <UiIcon name="search" size={16} />
            <input aria-label="Tìm lớp học" onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Tìm theo mã lớp, tên môn…" value={q} />
          </div>

          <label className="field filter-field" style={{ margin: 0 }}>
            <span className="visually-hidden">Lọc chương trình đào tạo</span>
            <SearchableSelect ariaLabel="Lọc chương trình" onChange={(value) => { setProgramFilter(value); setPage(1) }} options={programs.map((program) => ({ value: String(program.id), label: `${program.code} - ${program.name}` }))} placeholder="Tất cả chương trình" value={programFilter} />
          </label>

          <label className="field filter-field" style={{ margin: 0 }}>
            <span className="visually-hidden">Lọc môn học</span>
            <SearchableSelect ariaLabel="Course filter" onChange={(value) => { setCourseFilter(value); setPage(1) }} options={courses.map((course) => ({ value: String(course.id), label: `${course.code} - ${course.name}` }))} placeholder="Tất cả môn học" value={courseFilter} />
          </label>

          <label className="field filter-field" style={{ margin: 0 }}>
            <span className="visually-hidden">Từ ngày có lịch học</span>
            <input aria-label="Từ ngày có lịch học" onChange={(event) => { setStartDateFilter(event.target.value); setPage(1) }} type="date" value={startDateFilter} />
          </label>

          <label className="field filter-field" style={{ margin: 0 }}>
            <span className="visually-hidden">Đến ngày có lịch học</span>
            <input aria-label="Đến ngày có lịch học" onChange={(event) => { setEndDateFilter(event.target.value); setPage(1) }} type="date" value={endDateFilter} />
          </label>

          <label className="field filter-field" style={{ margin: 0 }}>
            <span className="visually-hidden">Lọc trạng thái</span>
            <select onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} style={{ height: '38px' }} value={statusFilter}>
              <option value="">Tất cả trạng thái</option>
              <option value="preparing">Chuẩn bị</option>
              <option value="active">Đang học</option>
              <option value="completed">Kết thúc</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </label>

          {teachers.length > 1 ? (
            <label className="field filter-field" style={{ margin: 0 }}>
              <span className="visually-hidden">Lọc giảng viên</span>
              <SearchableSelect ariaLabel="Lọc giảng viên" onChange={(value) => { setTeacherFilter(value); setPage(1) }} options={teachers.map((teacher) => ({ value: String(teacher.id), label: teacher.name }))} placeholder="Tất cả giảng viên" value={teacherFilter} />
            </label>
          ) : null}

          <label className="field filter-field" style={{ margin: 0 }}>
            <span className="visually-hidden">Lọc học kỳ</span>
            <select onChange={(event) => { setTermFilter(event.target.value); setPage(1) }} style={{ height: '38px' }} value={termFilter}>
              <option value="">Tất cả học kỳ</option>
              {terms.map((term) => <option key={term} value={term}>{term}</option>)}
            </select>
          </label>

          {hasActiveFilters ? (
            <button
              className="button button-outline button-small"
              onClick={() => {
                setQ('')
                setTermFilter('')
                setStartDateFilter('')
                setEndDateFilter('')
                setStatusFilter('')
                setTeacherFilter('')
                setProgramFilter('')
                setCourseFilter('')
                setPage(1)
              }}
              style={{ height: '38px', color: '#dc2626', borderColor: '#fca5a5' }}
              type="button"
            >
              ✕ Xóa bộ lọc
            </button>
          ) : null}

          <span className="table-total" style={{ marginLeft: 'auto', fontWeight: 600, color: '#475569', fontSize: '13px' }}>
            {totalClasses} lớp học
          </span>
        </div>

        {problem ? <div className="inline-error">{problem}</div> : null}

        <div className="table-scroll">
          <table className="data-table class-table">
            <thead>
              <tr>
                <th>LỚP HỌC PHẦN</th>
                <th>MÔN HỌC</th>
                <th>GIẢNG VIÊN</th>
                <th>LỊCH HỌC</th>
                <th>SĨ SỐ & TIẾN ĐỘ</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td className="table-loading" colSpan={6}>Đang tải lớp học…</td></tr> : null}
              {!loading && visibleClasses.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <div className="class-name-cell">
                      <span className={`class-code-mark class-mark-${index % 4}`}><UiIcon name="classes" size={17} /></span>
                      <span>
                        <strong>{item.name}</strong>
                        <small className="mono-code">{item.code} · {item.term}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="course-code">{item.course_code}</span>
                    <small className="cell-subtitle">{item.course_name}</small>
                  </td>
                  <td>
                    <span className="teacher-name">{item.teacher_name}</span>
                    {item.assistants.length ? (
                      <small className="cell-subtitle">TA: {item.assistants.map((assistant) => assistant.full_name).join(', ')}</small>
                    ) : null}
                  </td>
                  <td>
                    <span className="schedule-cell">
                      <strong>{item.weekday}</strong>
                      <small>{item.start_time} – {item.end_time} · Phòng {item.room}</small>
                      <small>{{ preparing: 'Chuẩn bị', active: 'Đang học', completed: 'Kết thúc', cancelled: 'Đã hủy' }[item.status]}</small>
                    </span>
                  </td>
                  <td>
                    <div className="capacity-cell">
                      <strong>{item.student_count}<small> / {item.capacity}</small></strong>
                      <span className="capacity-track">
                        <i style={{ width: `${Math.min(100, (item.student_count / item.capacity) * 100)}%` }} />
                      </span>
                    </div>
                    <div className="session-progress-row" style={{ marginTop: '5px', fontSize: '11px', color: 'var(--blue, #0054a6)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <UiIcon name="calendar" size={13} />
                      <span>Tiến độ: <strong>{item.session_progress ?? `${item.completed_sessions ?? 0}/${item.total_sessions ?? 0} buổi`}</strong></span>
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      {canViewRoster ? (
                        <a className="button button-small button-outline" href={`/classes/${item.id}/students`}>
                          {canManageAttendance ? 'Chi tiết lớp' : 'Danh sách'}
                        </a>
                      ) : (
                        <span className="muted-cell enrolled-label">Đã đăng ký</span>
                      )}
                      {isAdmin ? (
                        <a
                          className="button button-small button-outline"
                          href={`/schedule/generate?class_id=${item.id}`}
                          title="Sinh thời khóa biểu tự động cho lớp này"
                        >
                          <UiIcon name="calendar" size={13} /> Xếp lịch
                        </a>
                      ) : null}
                      {isAdmin ? (
                        <a aria-label={`Sửa ${item.code}`} className="icon-button row-action" href={`/classes/${item.id}/edit`} title="Chỉnh sửa lớp">
                          <UiIcon name="edit" size={16} />
                        </a>
                      ) : null}
                      {isAdmin ? (
                        <button aria-label={`Xóa ${item.code}`} className="icon-button row-action danger-action" onClick={() => void removeClass(item)} title="Xóa lớp" type="button">
                          <UiIcon name="trash" size={16} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !classes.length ? (
                <tr>
                  <td className="table-empty" colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-icon"><UiIcon name="classes" size={22} /></div>
                      <strong>Không tìm thấy lớp học nào</strong>
                      <span>{hasActiveFilters ? 'Thử xóa bộ lọc để hiển thị tất cả các lớp.' : isAdmin ? 'Tạo lớp học và phân công giảng viên để bắt đầu.' : 'Lớp học được phân công sẽ hiển thị tại đây.'}</span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!loading ? <ListPagination page={page} pageSize={pageSize} total={totalClasses} onPageChange={(nextPage) => { setLoading(true); setPage(Math.min(pageCount, nextPage)) }} onPageSizeChange={(nextSize) => { setLoading(true); setPageSize(nextSize); setPage(1) }} /> : null}
      </section>

      {announcementOpen ? (
        <Modal eyebrow="THÔNG BÁO LỚP" onClose={() => setAnnouncementOpen(false)} title="Gửi thông báo tới học viên">
          <form className="dialog-form" onSubmit={(event) => void sendAnnouncement(event)}>
            <label className="form-field"><span>Lớp nhận thông báo</span>
              <select multiple required value={announcementClassIds.map(String)} onChange={(event) => setAnnouncementClassIds(Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value)))}>
                {classes.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
              </select>
              <small>Giữ Ctrl hoặc Command để chọn nhiều lớp.</small>
            </label>
            <label className="form-field"><span>Tiêu đề</span><input required maxLength={150} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} /></label>
            <label className="form-field"><span>Nội dung</span><textarea required maxLength={10000} rows={5} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} /></label>
            {announcementError ? <div className="form-alert error-alert" role="alert">{announcementError}</div> : null}
            {announcementReadCount ? <div className="inline-notice" role="status">Đã nhận: {announcementReadCount.recipient_count} · Đã đọc: {announcementReadCount.read_count} · Chưa đọc: {announcementReadCount.unread_count}</div> : null}
            <div className="modal-actions"><button className="button button-outline" onClick={() => setAnnouncementOpen(false)} type="button">Đóng</button><button className="button button-primary" disabled={announcementBusy} type="submit">{announcementBusy ? 'Đang gửi…' : 'Gửi thông báo'}</button></div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
