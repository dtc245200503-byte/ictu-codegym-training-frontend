import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest } from '../api'
import { Modal, UiIcon } from '../components/Ui'
import { showError } from '../format'
import type { Course, StudyProgram } from '../types'

function CourseEditor({
  course,
  courses,
  onClose,
  onSaved,
}: {
  course: Course | null
  courses: Course[]
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const fields = new FormData(event.currentTarget)
    const data = {
      code: fields.get('code'),
      name: fields.get('name'),
      department: fields.get('department'),
      credits: Number(fields.get('credits')),
      session_count: Number(fields.get('session_count')),
      description: fields.get('description') || null,
      prerequisite_id: fields.get('prerequisite_id') ? Number(fields.get('prerequisite_id')) : null,
    }
    try {
      if (course) {
        await apiRequest(`/courses/${course.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: data.name,
            department: data.department,
            credits: data.credits,
            session_count: data.session_count,
            description: data.description,
            prerequisite_id: data.prerequisite_id,
          }),
        })
      } else {
        await apiRequest('/courses', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      }
      onSaved()
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      eyebrow="DANH MỤC ĐÀO TẠO"
      onClose={onClose}
      title={course ? 'Cập nhật môn học' : 'Thêm môn học'}
    >
      <form className="dialog-form" onSubmit={submit}>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className="form-grid">
          <label className="field">
            <span>Mã môn học <b>*</b></span>
            <input autoFocus defaultValue={course?.code} disabled={Boolean(course)} maxLength={30} minLength={2} name="code" placeholder="VD: IT001" required />
          </label>
          <label className="field">
            <span>Số tín chỉ <b>*</b></span>
            <input defaultValue={course?.credits ?? 3} max={30} min={1} name="credits" required type="number" />
          </label>
          <label className="field">
            <span>Số buổi tối đa <b>*</b></span>
            <input defaultValue={course?.session_count ?? 16} max={500} min={1} name="session_count" required type="number" />
          </label>
          <label className="field field-span-2">
            <span>Tên môn học <b>*</b></span>
            <input defaultValue={course?.name} maxLength={150} minLength={2} name="name" placeholder="Nhập tên môn học" required />
          </label>
          <label className="field">
            <span>Khoa / ngành <b>*</b></span>
            <input defaultValue={course?.department} maxLength={100} minLength={2} name="department" placeholder="VD: Công nghệ thông tin" required />
          </label>
          <label className="field">
            <span>Môn tiên quyết</span>
            <select defaultValue={course?.prerequisite_id ?? ''} name="prerequisite_id">
              <option value="">Không có</option>
              {courses.filter((item) => item.id !== course?.id).map((item) => (
                <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
              ))}
            </select>
          </label>
          <label className="field field-span-2">
            <span>Mô tả</span>
            <textarea defaultValue={course?.description ?? ''} name="description" placeholder="Mục tiêu và nội dung môn học" rows={3} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose} type="button">Hủy</button>
          <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : course ? 'Lưu thay đổi' : 'Tạo môn học'}</button>
        </div>
      </form>
    </Modal>
  )
}

type CourseLesson = {
  id: number
  course_id: number
  sequence: number
  title: string
  objectives: string
  description: string | null
}

function ProgramCoursesModal({
  program,
  courses,
  onClose,
  onSaved,
}: {
  program: StudyProgram
  courses: Course[]
  onClose: () => void
  onSaved: () => void
}) {
  const [orderedIds, setOrderedIds] = useState(program.courses.map((course) => course.id))
  const [prerequisites, setPrerequisites] = useState<Record<number, number | null>>(
    Object.fromEntries(program.courses.map((course) => [course.id, course.prerequisite_course_id])),
  )
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    apiRequest<{
      subject_id: number
      prerequisite_subject_id: number | null
    }[]>(`/study-programs/${program.id}/subjects`)
      .then((subjects) => {
        setOrderedIds(subjects.map((subject) => subject.subject_id))
        setPrerequisites(Object.fromEntries(
          subjects.map((subject) => [subject.subject_id, subject.prerequisite_subject_id]),
        ))
        setProblem('')
      })
      .catch((error: unknown) => setProblem(showError(error)))
      .finally(() => setLoading(false))
  }, [program.id])

  function addCourse() {
    const courseId = Number(selectedCourseId)
    if (!courseId || orderedIds.includes(courseId)) return
    setOrderedIds((current) => [...current, courseId])
    setPrerequisites((current) => ({ ...current, [courseId]: null }))
    setSelectedCourseId('')
  }

  function removeCourse(courseId: number) {
    setOrderedIds((current) => current.filter((id) => id !== courseId))
    setPrerequisites((current) => {
      const next = { ...current }
      delete next[courseId]
      for (const id of Object.keys(next).map(Number)) {
        if (next[id] === courseId) next[id] = null
      }
      return next
    })
  }

  function moveCourse(index: number, offset: -1 | 1) {
    const target = index + offset
    if (target < 0 || target >= orderedIds.length) return
    const next = [...orderedIds]
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrderedIds(next)
    setPrerequisites((current) => Object.fromEntries(
      next.map((id, position) => {
        const prerequisiteId = current[id]
        return [id, prerequisiteId != null && next.indexOf(prerequisiteId) < position
          ? prerequisiteId
          : null]
      }),
    ))
  }

  async function save() {
    if (loading) return
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/study-programs/${program.id}/subjects`, {
        method: 'PUT',
        body: JSON.stringify({
          subjects: orderedIds.map((subject_id) => ({
            subject_id,
            prerequisite_subject_id: prerequisites[subject_id] ?? null,
          })),
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
    <Modal eyebrow="CHƯƠNG TRÌNH ĐÀO TẠO" onClose={onClose} size="large" title={`Môn học · ${program.name}`}>
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      <div className="curriculum-add-row">
        <label className="field">
          <span>Thêm môn học vào chương trình</span>
          <select disabled={loading || busy || courses.every((course) => orderedIds.includes(course.id))} onChange={(event) => setSelectedCourseId(event.target.value)} value={selectedCourseId}>
            <option value="">Chọn môn học</option>
            {courses.filter((course) => !orderedIds.includes(course.id)).map((course) => (
              <option key={course.id} value={course.id}>{course.code} · {course.name}</option>
            ))}
          </select>
        </label>
        <button className="button button-outline" disabled={!selectedCourseId || busy || loading} onClick={addCourse} type="button">Thêm môn học</button>
      </div>
      {loading ? <div className="table-loading">Đang tải khung chương trình…</div> : null}
      {!loading && !orderedIds.length ? <div className="empty-state compact-empty"><strong>Chưa có môn học</strong><span>Chọn môn học ở trên để thêm vào chương trình.</span></div> : null}
      <ol className="syllabus-list curriculum-list">
        {orderedIds.map((id, index) => {
          const course = courses.find((item) => item.id === id)
          if (!course) return null
          return (
            <li className="syllabus-row" key={id}>
              <strong className="curriculum-subject-title">{index + 1}. {course.code} · {course.name}</strong>
              <label className="field">
                <span>Môn tiên quyết trong chương trình</span>
                <select onChange={(event) => setPrerequisites((current) => ({ ...current, [id]: event.target.value ? Number(event.target.value) : null }))} value={prerequisites[id] ?? ''}>
                  <option value="">Không có</option>
                  {orderedIds.slice(0, index).map((prerequisiteId) => {
                    const prerequisite = courses.find((item) => item.id === prerequisiteId)
                    return prerequisite ? <option key={prerequisite.id} value={prerequisite.id}>{prerequisite.code} · {prerequisite.name}</option> : null
                  })}
                </select>
              </label>
              <div className="curriculum-subject-actions">
                <button aria-label={`Chuyển ${course.code} lên`} className="text-button" disabled={index === 0 || busy} onClick={() => moveCourse(index, -1)} type="button">↑</button>
                <button aria-label={`Chuyển ${course.code} xuống`} className="text-button" disabled={index === orderedIds.length - 1 || busy} onClick={() => moveCourse(index, 1)} type="button">↓</button>
                <button className="text-button curriculum-remove" disabled={busy} onClick={() => removeCourse(id)} type="button">Gỡ môn</button>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="modal-actions">
        <button className="button button-outline" onClick={onClose} type="button">Hủy</button>
        <button className="button button-primary" disabled={busy || loading} onClick={() => void save()} type="button">{busy ? 'Đang lưu…' : 'Lưu chương trình'}</button>
      </div>
    </Modal>
  )
}

function CourseLessonsModal({
  course,
  courses,
  onClose,
}: {
  course: Course
  courses: Course[]
  onClose: () => void
}) {
  const [lessons, setLessons] = useState<CourseLesson[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [sourceCourseId, setSourceCourseId] = useState('')

  useEffect(() => {
    apiRequest<CourseLesson[]>(`/courses/${course.id}/lessons`)
      .then(setLessons)
      .catch((error: unknown) => setProblem(showError(error)))
  }, [course.id, refresh])

  async function addLesson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const fields = new FormData(event.currentTarget)
    try {
      await apiRequest(`/courses/${course.id}/lessons`, {
        method: 'POST',
        body: JSON.stringify({
          sequence: Number(fields.get('sequence')),
          title: fields.get('title'),
          objectives: fields.get('objectives'),
          description: fields.get('description') || null,
        }),
      })
      event.currentTarget.reset()
      setRefresh((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function cloneLessons() {
    if (!sourceCourseId) return
    setBusy(true)
    setProblem('')
    try {
      await apiRequest(`/courses/${course.id}/lessons/clone`, {
        method: 'POST',
        body: JSON.stringify({ source_course_id: Number(sourceCourseId) }),
      })
      setRefresh((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function removeLesson(lesson: CourseLesson) {
    try {
      await apiRequest(`/courses/${course.id}/lessons/${lesson.id}`, { method: 'DELETE' })
      setRefresh((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    }
  }

  async function updateLesson(event: FormEvent<HTMLFormElement>, lesson: CourseLesson) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const fields = new FormData(event.currentTarget)
    try {
      await apiRequest(`/courses/${course.id}/lessons/${lesson.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sequence: Number(fields.get('sequence')),
          title: fields.get('title'),
          objectives: fields.get('objectives'),
          description: fields.get('description') || null,
        }),
      })
      setRefresh((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal eyebrow="SYLLABUS MÔN HỌC" onClose={onClose} size="large" title={`${course.code} · ${course.name}`}>
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      <div className="syllabus-list">
        {lessons.map((lesson) => (
          <article className="syllabus-row" key={lesson.id}>
            <form className="dialog-form" onSubmit={(event) => void updateLesson(event, lesson)}>
              <div className="form-grid">
                <label className="field"><span>Buổi số</span><input defaultValue={lesson.sequence} max={course.session_count} min={1} name="sequence" required type="number" /></label>
                <label className="field"><span>Chủ đề</span><input defaultValue={lesson.title} maxLength={150} minLength={2} name="title" required /></label>
                <label className="field field-span-2"><span>Mục tiêu</span><textarea defaultValue={lesson.objectives} maxLength={3000} name="objectives" required rows={2} /></label>
                <label className="field field-span-2"><span>Nội dung</span><textarea defaultValue={lesson.description ?? ''} maxLength={3000} name="description" rows={2} /></label>
              </div>
              <button className="button button-outline button-small" disabled={busy} type="submit">Lưu buổi học</button>
              <button className="text-action text-warning" onClick={() => void removeLesson(lesson)} type="button">Xóa</button>
            </form>
          </article>
        ))}
        {!lessons.length ? <p className="muted-cell">Môn học chưa có nội dung buổi học.</p> : null}
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Nhân bản syllabus từ môn học</span>
          <select onChange={(event) => setSourceCourseId(event.target.value)} value={sourceCourseId}>
            <option value="">Chọn môn nguồn</option>
            {courses.filter((item) => item.id !== course.id).map((item) => (
              <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Giới hạn số buổi</span>
          <strong>{course.session_count} buổi</strong>
        </div>
        <button className="button button-outline" disabled={busy || !sourceCourseId || lessons.length > 0} onClick={() => void cloneLessons()} type="button">Nhân bản syllabus</button>
      </div>
      <form className="dialog-form" onSubmit={addLesson}>
        <div className="form-grid">
          <label className="field">
            <span>Buổi số <b>*</b></span>
            <input max={course.session_count} min={1} name="sequence" required type="number" />
          </label>
          <label className="field">
            <span>Chủ đề <b>*</b></span>
            <input maxLength={150} minLength={2} name="title" required />
          </label>
          <label className="field field-span-2">
            <span>Mục tiêu buổi học <b>*</b></span>
            <textarea maxLength={3000} minLength={1} name="objectives" required rows={2} />
          </label>
          <label className="field field-span-2">
            <span>Nội dung</span>
            <textarea maxLength={3000} name="description" rows={2} />
          </label>
        </div>
        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose} type="button">Đóng</button>
          <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Thêm buổi học'}</button>
        </div>
      </form>
    </Modal>
  )
}

export function CoursesPage({ notify }: { notify: (message: string) => void }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [programs, setPrograms] = useState<StudyProgram[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [editor, setEditor] = useState<Course | null | undefined>(undefined)
  const [syllabusCourse, setSyllabusCourse] = useState<Course | null>(null)
  const [curriculumProgram, setCurriculumProgram] = useState<StudyProgram | null>(null)
  const [department, setDepartment] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      const query = new URLSearchParams()
      if (q.trim()) query.set('q', q.trim())
      if (department) query.set('department', department)
      apiRequest<Course[]>(`/courses${query.toString() ? `?${query}` : ''}`)
        .then((result) => {
          setCourses(result)
          setProblem('')
        })
        .catch((error: unknown) => setProblem(showError(error)))
        .finally(() => setLoading(false))
    }, q ? 220 : 0)
    return () => window.clearTimeout(timer)
  }, [department, q, refresh])

  useEffect(() => {
    apiRequest<StudyProgram[]>('/study-programs')
      .then(setPrograms)
      .catch((error: unknown) => setProblem(showError(error)))
  }, [])

  const departments = [...new Set(courses.map((course) => course.department))].sort()

  async function toggleActive(course: Course) {
    try {
      await apiRequest(`/courses/${course.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !course.is_active }),
      })
      setRefresh((value) => value + 1)
      notify(course.is_active ? 'Môn học đã được ngừng mở.' : 'Môn học đã được kích hoạt.')
    } catch (error) {
      notify(showError(error))
    }
  }

  async function removeCourse(course: Course) {
    if (!window.confirm(`Xóa môn học ${course.code} · ${course.name}?`)) return
    try {
      await apiRequest(`/courses/${course.id}`, { method: 'DELETE' })
      setRefresh((value) => value + 1)
      notify('Đã xóa môn học.')
    } catch (error) {
      notify(showError(error))
    }
  }

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">CHƯƠNG TRÌNH ĐÀO TẠO</span>
          <h1>Danh mục môn học</h1>
          <p>Chuẩn hóa môn học, tín chỉ và các điều kiện học trước.</p>
        </div>
        <button className="button button-primary" onClick={() => setEditor(null)} type="button"><UiIcon name="plus" size={17} /> Thêm môn học</button>
      </div>

      <section className="course-overview">
        <div className="course-overview-mark"><UiIcon name="book" size={22} /></div>
        <div><span>CHƯƠNG TRÌNH ĐÀO TẠO ICTU</span><strong>{courses.length} môn học trong danh mục</strong><small>Các học phần được tổ chức theo khoa, ngành và học kỳ.</small></div>
        <div className="course-overview-stat"><strong>{departments.length}</strong><span>Khoa / ngành</span></div>
        <div className="course-overview-stat"><strong>{courses.filter((item) => item.is_active).length}</strong><span>Đang mở</span></div>
      </section>

      {programs.length ? (
        <section className="study-program-grid" aria-label="Chương trình đào tạo">
          {programs.map((program) => (
            <article className="panel study-program-card" key={program.id}>
              <button className="study-program-heading study-program-open" onClick={() => setCurriculumProgram(program)} type="button">
                <span className="course-mark"><UiIcon name="cap" size={19} /></span>
                <span><small>{program.code} · {program.degree_level}</small><strong>{program.name}</strong></span>
              </button>
              <div className="study-program-metrics">
                <strong>{program.total_credits}<small> tín chỉ</small></strong>
                <span>{program.duration_semesters} học kỳ · {program.courses.length} môn mẫu</span>
              </div>
              <p>{program.description}</p>
              <div className="study-program-courses">
                {program.courses.map((course) => <span key={course.id}>{course.code}</span>)}
              </div>
              <button className="text-action" onClick={() => setCurriculumProgram(program)} type="button">Quản lý môn học & tiên quyết</button>
            </article>
          ))}
        </section>
      ) : null}

      <section className="panel data-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <UiIcon name="search" size={18} />
            <input aria-label="Tìm môn học" onChange={(event) => setQ(event.target.value)} placeholder="Tìm theo mã hoặc tên môn học…" value={q} />
          </div>
          <label className="filter-select">
            <UiIcon name="filter" size={16} />
            <select aria-label="Lọc theo khoa" onChange={(event) => setDepartment(event.target.value)} value={department}>
              <option value="">Tất cả khoa / ngành</option>
              {departments.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <span className="table-total">{courses.length} môn học</span>
        </div>
        {problem ? <div className="inline-error">{problem}</div> : null}
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>MÔN HỌC</th><th>KHOA / NGÀNH</th><th>TÍN CHỈ</th><th>MÔN TIÊN QUYẾT</th><th>TRẠNG THÁI</th><th aria-label="Thao tác" /></tr></thead>
            <tbody>
              {loading ? <tr><td className="table-loading" colSpan={6}>Đang tải danh mục môn học…</td></tr> : null}
              {!loading && courses.map((course, index) => (
                <tr key={course.id}>
                  <td>
                    <div className="course-cell">
                      <span className={`course-mark course-mark-${index % 5}`}><UiIcon name="book" size={18} /></span>
                      <span><strong>{course.name}</strong><small className="mono-code">{course.code}</small></span>
                    </div>
                  </td>
                  <td className="muted-cell">{course.department}</td>
                  <td><span className="credit-count">{course.credits}<small> tín chỉ</small></span></td>
                  <td>{course.prerequisite_name ? <span className="prerequisite-name">{course.prerequisite_name}</span> : <span className="muted-cell">Không yêu cầu</span>}</td>
                  <td><span className={`status-pill ${course.is_active ? 'status-active' : 'status-locked'}`}><i />{course.is_active ? 'Đang mở' : 'Ngừng mở'}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="text-action" onClick={() => setSyllabusCourse(course)} type="button">Syllabus</button>
                      <button aria-label={`Sửa ${course.code}`} className="icon-button row-action" onClick={() => setEditor(course)} title="Chỉnh sửa" type="button"><UiIcon name="edit" size={16} /></button>
                      <button className={`text-action ${course.is_active ? 'text-warning' : 'text-success'}`} onClick={() => void toggleActive(course)} type="button">{course.is_active ? 'Ngừng mở' : 'Mở lại'}</button>
                      <button aria-label={`Xóa ${course.code}`} className="icon-button row-action danger-action" onClick={() => void removeCourse(course)} title="Xóa môn học" type="button"><UiIcon name="trash" size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !courses.length ? <tr><td className="table-empty" colSpan={6}><div className="empty-state"><div className="empty-icon"><UiIcon name="book" size={22} /></div><strong>Chưa có môn học phù hợp</strong><span>Thêm môn học đầu tiên hoặc điều chỉnh bộ lọc.</span></div></td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="table-footnote"><UiIcon name="check" size={15} /> Môn học đang có lớp sẽ không thể xóa. Bạn có thể ngừng mở để giữ lịch sử đào tạo.</div>
      </section>
      {editor !== undefined ? (
        <CourseEditor
          course={editor}
          courses={courses}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined)
            setRefresh((value) => value + 1)
            notify('Danh mục môn học đã được cập nhật.')
          }}
        />
      ) : null}
      {syllabusCourse ? <CourseLessonsModal course={syllabusCourse} courses={courses} onClose={() => setSyllabusCourse(null)} /> : null}
      {curriculumProgram ? (
        <ProgramCoursesModal
          courses={courses}
          onClose={() => setCurriculumProgram(null)}
          onSaved={() => {
            setCurriculumProgram(null)
            apiRequest<StudyProgram[]>('/study-programs').then(setPrograms).catch((error: unknown) => setProblem(showError(error)))
            notify('Chương trình đào tạo đã được cập nhật.')
          }}
          program={curriculumProgram}
        />
      ) : null}
    </div>
  )
}
