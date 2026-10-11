import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiRequest } from '../api'
import { showError } from '../format'
import type { Assignment, TrainingClass, User } from '../types'

async function fetchAssignments(canCreate: boolean) {
  const [assignments, classes] = await Promise.all([
    apiRequest<Assignment[]>('/assignments'),
    canCreate
      ? apiRequest<TrainingClass[]>('/classes')
      : Promise.resolve([] as TrainingClass[]),
  ])
  return { assignments, classes }
}

export function AssignmentsPage({
  user,
  notify,
}: {
  user: User
  notify: (message: string) => void
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const canCreate = user.roles.some((role) =>
    ['admin', 'manager', 'teacher', 'ta'].includes(role),
  )

  useEffect(() => {
    let active = true
    fetchAssignments(canCreate)
      .then(({ assignments: nextAssignments, classes: nextClasses }) => {
        if (!active) return
        setAssignments(nextAssignments)
        setClasses(nextClasses)
        setProblem('')
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
  }, [canCreate])

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setProblem('')
    try {
      const classId = Number(fields.get('class_id'))
      await apiRequest(`/classes/${classId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          title: fields.get('title'),
          description: fields.get('description') || null,
          due_at: fields.get('due_at') || null,
        }),
      })
      form.reset()
      notify('Đã giao bài tập cho lớp.')
      const next = await fetchAssignments(canCreate)
      setAssignments(next.assignments)
      setClasses(next.classes)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">KẾ HOẠCH HỌC TẬP</span>
          <h1>Bài tập</h1>
          <p>Bài tập của các lớp bạn đang phụ trách hoặc tham gia.</p>
        </div>
      </div>
      {problem ? <div className="inline-error">{problem}</div> : null}
      {canCreate ? (
        <section className="panel assignment-create-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">GIAO BÀI</span><h2>Tạo bài tập cho lớp</h2></div>
          </div>
          <form className="assignment-form" onSubmit={createAssignment}>
            <label className="field">
              <span>Lớp học <b>*</b></span>
              <select defaultValue="" name="class_id" required>
                <option disabled value="">Chọn lớp</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.code} · {item.course_name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tên bài tập <b>*</b></span>
              <input maxLength={150} name="title" required />
            </label>
            <label className="field">
              <span>Hạn nộp</span>
              <input name="due_at" type="datetime-local" />
            </label>
            <label className="field assignment-description">
              <span>Mô tả / yêu cầu</span>
              <textarea maxLength={5000} name="description" rows={3} />
            </label>
            <button className="button button-primary" disabled={busy || !classes.length} type="submit">
              {busy ? 'Đang lưu…' : 'Giao bài tập'}
            </button>
          </form>
        </section>
      ) : null}
      <section className="assignment-list">
        {loading ? <div className="panel schedule-loading">Đang tải bài tập…</div> : null}
        {!loading && assignments.map((item) => (
          <article className="panel assignment-card" key={item.id}>
            <div className="assignment-card-top">
              <span className="assignment-course">{item.class_code} · {item.course_name}</span>
              {item.due_at ? (
                <time dateTime={item.due_at}>
                  Hạn nộp {new Date(item.due_at).toLocaleString('vi-VN')}
                </time>
              ) : <span className="muted-cell">Chưa đặt hạn nộp</span>}
            </div>
            <h2>{item.title}</h2>
            {item.description ? <p>{item.description}</p> : null}
            <span className="assignment-class-name">{item.class_name}</span>
          </article>
        ))}
        {!loading && !assignments.length ? (
          <section className="panel schedule-empty">
            <strong>Chưa có bài tập</strong>
            <span>Bài tập mới sẽ hiển thị tại đây khi được giao cho lớp.</span>
          </section>
        ) : null}
      </section>
    </div>
  )
}
