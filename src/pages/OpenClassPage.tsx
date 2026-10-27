import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest } from '../api'
import { UiIcon } from '../components/Ui'
import { SearchableMultiSelect, SearchableSelect } from '../components/ListControls'
import { showError } from '../format'
import type { Classroom, Course, StudyProgram, User } from '../types'

const weekdayOptions = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
]

export function OpenClassPage({
  user: _user,
  notify,
}: {
  user?: User
  notify: (msg: string) => void
}) {
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<User[]>([])
  const [assistants, setAssistants] = useState<User[]>([])
  const [rooms, setRooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)

  // Step 1: Selected Program
  const [selectedProgramId, setSelectedProgramId] = useState<number | ''>('')

  // Step 2: Selected Course
  const [selectedCourseId, setSelectedCourseId] = useState<number | ''>('')

  // Step 3: Class info form fields
  const [classCode, setClassCode] = useState('')
  const [className, setClassName] = useState('')
  const [term, setTerm] = useState('HK1-2026')
  const [teacherId, setTeacherId] = useState<number | ''>('')
  const [selectedAssistantIds, setSelectedAssistantIds] = useState<number[]>([])
  const [roomCode, setRoomCode] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState<number>(0)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('10:00')
  const [capacity, setCapacity] = useState<number>(40)

  // Form submission states
  const [submitting, setSubmitting] = useState(false)
  const [problem, setProblem] = useState('')
  const [createdClass, setCreatedClass] = useState<{ id: number; code: string; name: string } | null>(null)

  // Load initial data
  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<StudyProgram[]>('/study-programs'),
      apiRequest<Course[]>('/courses'),
      apiRequest<Classroom[]>('/rooms'),
      apiRequest<{ items: User[] }>('/accounts?role=teacher&page_size=100').then((r) => r.items),
      apiRequest<{ items: User[] }>('/accounts?role=ta&page_size=100').then((r) => r.items),
    ])
      .then(([progList, courseList, roomList, teacherList, taList]) => {
        if (!active) return
        setPrograms(progList)
        setCourses(courseList)
        setRooms(roomList)
        setTeachers(teacherList)
        setAssistants(taList)

        if (progList.length > 0) {
          const firstProg = progList[0]
          setSelectedProgramId(firstProg.id)
          if (firstProg.courses.length > 0) {
            const firstCourse = firstProg.courses[0]
            setSelectedCourseId(firstCourse.id)
            setClassCode(`${firstCourse.code}.01`)
            setClassName(`${firstCourse.name} — Lớp 01`)
          }
        }
        if (teacherList.length > 0) {
          setTeacherId(teacherList[0].id)
        }
        if (roomList.length > 0) {
          setRoomCode(roomList[0].code)
        }
      })
      .catch((err: unknown) => {
        if (active) setProblem(showError(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const selectedProgram = useMemo(() => {
    return programs.find((p) => p.id === selectedProgramId) ?? null
  }, [programs, selectedProgramId])

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) ?? null
  }, [courses, selectedCourseId])

  const selectedRoomObj = useMemo(() => {
    return rooms.find((r) => r.code === roomCode) ?? null
  }, [rooms, roomCode])

  const isCapacityExceeded = selectedRoomObj && capacity > selectedRoomObj.capacity

  // When Program changes
  function handleProgramChange(id: number) {
    setSelectedProgramId(id)
    const prog = programs.find((p) => p.id === id)
    if (prog && prog.courses.length > 0) {
      const firstCourse = prog.courses[0]
      setSelectedCourseId(firstCourse.id)
      setClassCode(`${firstCourse.code}.01`)
      setClassName(`${firstCourse.name} — Lớp 01`)
    } else {
      setSelectedCourseId('')
      setClassCode('')
      setClassName('')
    }
  }

  // When Course changes
  function handleCourseChange(id: number) {
    setSelectedCourseId(id)
    const course = courses.find((c) => c.id === id)
    if (course) {
      setClassCode(`${course.code}.01`)
      setClassName(`${course.name} — Lớp 01`)
    }
  }

  // Submit Handler
  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selectedProgramId) {
      setProblem('Vui lòng chọn chương trình đào tạo.')
      return
    }
    if (!selectedCourseId) {
      setProblem('Vui lòng chọn môn học thuộc chương trình.')
      return
    }
    if (!teacherId) {
      setProblem('Vui lòng chọn giảng viên phụ trách.')
      return
    }
    if (!roomCode) {
      setProblem('Vui lòng chọn phòng học.')
      return
    }
    if (isCapacityExceeded) {
      setProblem(`Sĩ số lớp (${capacity}) vượt quá sức chứa của phòng ${roomCode} (${selectedRoomObj?.capacity} chỗ).`)
      return
    }
    if (endTime <= startTime) {
      setProblem('Giờ kết thúc phải sau giờ bắt đầu.')
      return
    }

    setSubmitting(true)
    setProblem('')

    try {
      const payload = {
        code: classCode.trim(),
        name: className.trim(),
        course_id: Number(selectedCourseId),
        program_id: Number(selectedProgramId),
        teacher_id: Number(teacherId),
        assistant_ids: selectedAssistantIds,
        room: roomCode,
        term: term.trim(),
        day_of_week: Number(dayOfWeek),
        start_time: startTime,
        end_time: endTime,
        capacity: Number(capacity),
      }

      const res = await apiRequest<{ id: number; code: string; name: string }>('/classes', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setCreatedClass(res)
      notify(`Đã mở thành công lớp học phần ${res.code} từ chương trình đào tạo!`)
    } catch (err) {
      setProblem(showError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="page-section">
        <div className="table-loading">Đang tải chương trình đào tạo và dữ liệu mở lớp…</div>
      </section>
    )
  }

  return (
    <section className="page-section open-class-page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <a href="/classes" style={{ color: 'inherit', textDecoration: 'none' }}>Danh sách lớp học</a>
        <span className="breadcrumb-divider">/</span>
        <strong>Mở lớp mới</strong>
      </div>

      {/* Title */}
      <div className="page-title-row" style={{ marginBottom: '16px' }}>
        <div>
          <span className="eyebrow">QUẢN LÝ ĐÀO TẠO & MỞ LỚP</span>
          <h1>Mở lớp mới</h1>
          <p>
            Tạo lớp học phần mới kế thừa tự động danh mục môn học, số tín chỉ và cấu trúc khung chương trình có sẵn.
          </p>
        </div>
        <div className="page-header-actions">
          <a className="button button-outline" href="/classes">
            ← Quay lại danh sách lớp
          </a>
        </div>
      </div>

      {problem ? (
        <div className="form-alert error-alert" style={{ marginBottom: '20px' }}>
          <strong>Lỗi:</strong> {problem}
        </div>
      ) : null}

      {/* Success Notification Banner */}
      {createdClass ? (
        <div
          className="form-alert success-alert"
          style={{
            marginBottom: '24px',
            backgroundColor: '#ecfdf5',
            borderColor: '#a7f3d0',
            color: '#065f46',
            padding: '20px',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🎉</span>
            <div>
              <strong style={{ fontSize: '18px', display: 'block' }}>
                Mở lớp thành công: {createdClass.code} · {createdClass.name}
              </strong>
              <p style={{ margin: '4px 0 12px 0', fontSize: '14px' }}>
                Lớp học đã xuất hiện trong danh sách lớp học và sẵn sàng để xếp thời khóa biểu hoặc xếp học viên vào lớp.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <a
                  className="button button-small button-primary"
                  href={`/schedule/generate?class_id=${createdClass.id}`}
                >
                  <UiIcon name="calendar" size={15} /> Xếp thời khóa biểu tự động ngay
                </a>
                <a
                  className="button button-small button-outline"
                  href={`/classes/${createdClass.id}/students`}
                >
                  Xem chi tiết lớp học
                </a>
                <a
                  className="button button-small button-outline"
                  href="/classes"
                >
                  Về danh sách lớp
                </a>
                <button
                  className="button button-small button-outline"
                  onClick={() => {
                    setCreatedClass(null)
                    setClassCode('')
                    setClassName('')
                  }}
                  type="button"
                >
                  Tiếp tục mở lớp khác
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        {/* BƯỚC 1: CHỌN CHƯƠNG TRÌNH ĐÀO TẠO */}
        <div className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>
              Bước 1: Chọn chương trình đào tạo có sẵn
            </h3>
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              Hệ thống sẽ tải toàn bộ danh mục môn học thuộc khung chương trình này.
            </span>
          </div>

          <div className="form-grid">
            <label className="field field-span-2">
              <span>Chương trình đào tạo <b>*</b></span>
              <SearchableSelect ariaLabel="Training program" onChange={(value) => handleProgramChange(Number(value))} options={programs.map((program) => ({ value: String(program.id), label: `${program.code} - ${program.name} (${program.degree_level})` }))} placeholder="Choose a program" required value={String(selectedProgramId || '')} />
            </label>
          </div>

          {selectedProgram ? (
            <div
              style={{
                marginTop: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Mã chương trình:</span>
                <div style={{ fontWeight: 600, color: 'var(--blue, #0054a6)' }}>{selectedProgram.code}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Tên chương trình:</span>
                <div style={{ fontWeight: 600 }}>{selectedProgram.name}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Hệ đào tạo:</span>
                <div style={{ fontWeight: 600 }}>{selectedProgram.degree_level}</div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Tổng tín chỉ & Thời gian:</span>
                <div style={{ fontWeight: 600 }}>{selectedProgram.total_credits} tín chỉ · {selectedProgram.duration_semesters} học kỳ</div>
              </div>
            </div>
          ) : null}
        </div>

        {/* BƯỚC 2: KẾ THỪA DANH SÁCH MÔN HỌC */}
        <div className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>
              Bước 2: Môn học kế thừa từ chương trình đào tạo
            </h3>
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              Chọn môn học cần mở lớp từ danh sách các môn đã được định nghĩa trong chương trình đào tạo.
            </span>
          </div>

          {selectedProgram && selectedProgram.courses.length > 0 ? (
            <div className="table-scroll" style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '16px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>CHỌN</th>
                    <th style={{ width: '70px' }}>THỨ TỰ</th>
                    <th>MÃ MÔN HỌC</th>
                    <th>TÊN MÔN HỌC</th>
                    <th>SỐ BUỔI / TÍN CHỈ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProgram.courses.map((pc, idx) => {
                    const isChecked = selectedCourseId === pc.id
                    const fullCourse = courses.find((c) => c.id === pc.id)
                    return (
                      <tr
                        key={pc.id}
                        onClick={() => handleCourseChange(pc.id)}
                        style={{
                          backgroundColor: isChecked ? '#eef2ff' : undefined,
                          cursor: 'pointer',
                        }}
                      >
                        <td>
                          <input
                            checked={isChecked}
                            name="selected_course_radio"
                            onChange={() => handleCourseChange(pc.id)}
                            type="radio"
                          />
                        </td>
                        <td><strong>#{pc.sequence || idx + 1}</strong></td>
                        <td><strong className="mono-code text-primary">{pc.code}</strong></td>
                        <td><strong>{pc.name}</strong></td>
                        <td>
                          {fullCourse ? `${fullCourse.credits} tín chỉ (${fullCourse.session_count} buổi)` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#dc2626', fontSize: '14px', padding: '12px' }}>
              Chương trình đào tạo này hiện chưa có môn học nào được gán. Vui lòng vào mục "Khung chương trình" để gán môn học trước.
            </div>
          )}

          {selectedCourse ? (
            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '10px 14px',
                color: '#1d4ed8',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              ✓ Đang mở lớp cho môn học: {selectedCourse.code} · {selectedCourse.name} ({selectedCourse.credits} tín chỉ, {selectedCourse.session_count} buổi đào tạo)
            </div>
          ) : null}
        </div>

        {/* BƯỚC 3: THIẾT LẬP THÔNG TIN LỚP HỌC */}
        <div className="panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>
              Bước 3: Thiết lập thông số lớp học phần
            </h3>
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              Nhập mã lớp, tên lớp, học kỳ, phân công giảng viên và chọn phòng học.
            </span>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Mã lớp học <b>*</b></span>
              <input
                maxLength={30}
                minLength={2}
                onChange={(e) => setClassCode(e.target.value)}
                placeholder="VD: IT001.01"
                required
                value={classCode}
              />
            </label>

            <label className="field">
              <span>Học kỳ <b>*</b></span>
              <input
                maxLength={50}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="VD: HK1-2026"
                required
                value={term}
              />
            </label>

            <label className="field field-span-2">
              <span>Tên lớp học phần <b>*</b></span>
              <input
                maxLength={150}
                minLength={2}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="VD: Lập trình Java cơ bản — Lớp 01"
                required
                value={className}
              />
            </label>

            <label className="field">
              <span>Giảng viên chính <b>*</b></span>
              <SearchableSelect ariaLabel="Primary instructor" onChange={(value) => setTeacherId(value ? Number(value) : '')} options={teachers.map((teacher) => ({ value: String(teacher.id), label: `${teacher.full_name} (${teacher.email})` }))} placeholder="Choose an instructor" required value={String(teacherId)} />
            </label>

            <label className="field">
              <span>Trợ giảng (TA)</span>
              <SearchableMultiSelect ariaLabel="Teaching assistants" onChange={(values) => setSelectedAssistantIds(values.map(Number))} options={assistants.map((assistant) => ({ value: String(assistant.id), label: `${assistant.full_name} (${assistant.email})` }))} value={selectedAssistantIds.map(String)} />
            </label>

            <label className="field">
              <span>Phòng học <b>*</b></span>
              <SearchableSelect ariaLabel="Classroom" onChange={setRoomCode} options={rooms.map((room) => ({ value: room.code, label: `${room.code} (${room.capacity} seats${room.online_url ? ' - Online' : ''})` }))} placeholder="Choose a classroom" required value={roomCode} />
            </label>

            <label className="field">
              <span>Sĩ số tối đa <b>*</b></span>
              <input
                max={500}
                min={1}
                onChange={(e) => setCapacity(Number(e.target.value))}
                required
                type="number"
                value={capacity}
              />
              {isCapacityExceeded ? (
                <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  ⚠️ Sĩ số ({capacity}) vượt quá sức chứa phòng {roomCode} ({selectedRoomObj?.capacity} chỗ)!
                </span>
              ) : null}
            </label>

            <label className="field">
              <span>Thứ trong tuần <b>*</b></span>
              <select
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                value={dayOfWeek}
              >
                {weekdayOptions.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Giờ bắt đầu <b>*</b></span>
              <input
                onChange={(e) => setStartTime(e.target.value)}
                required
                type="time"
                value={startTime}
              />
            </label>

            <label className="field">
              <span>Giờ kết thúc <b>*</b></span>
              <input
                onChange={(e) => setEndTime(e.target.value)}
                required
                type="time"
                value={endTime}
              />
            </label>
          </div>
        </div>

        {/* BƯỚC 4: XÁC NHẬN MỞ LỚP */}
        <div className="panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                Xác nhận tạo lớp học phần
              </h4>
              <span style={{ color: '#64748b', fontSize: '13px' }}>
                Lớp học sẽ kế thừa môn học từ chương trình đào tạo {selectedProgram?.code} và lưu vào hệ thống.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <a className="button button-outline" href="/classes">
                Hủy bỏ
              </a>
              <button
                className="button button-primary"
                disabled={submitting || !selectedCourseId || !selectedProgramId || Boolean(isCapacityExceeded)}
                style={{ padding: '10px 24px', fontSize: '15px' }}
                type="submit"
              >
                <UiIcon name="check" size={18} />
                {submitting ? 'Đang tạo lớp học…' : 'Xác nhận mở lớp học phần'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  )
}
