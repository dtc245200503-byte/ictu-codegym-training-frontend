import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiBlobRequest, apiRequest, apiRequestWithHeaders } from '../api'
import { formatHoChiMinhDateTime } from '../attendanceExportDate'
import { assignmentCountdown } from '../assignmentCountdown'
import { ListPagination, SearchableSelect } from '../components/ListControls'
import { filterAssignmentRoster, summarizeAssignmentRoster } from '../assignmentRoster'
import { paginationFromHeaders } from '../pagination'
import { showError } from '../format'
import type { Assignment, TrainingClass, User } from '../types'

type AssignmentPageResponse = {
  items: Assignment[]
  total: number
  page: number
  page_size: number
  pages: number
}

type ClassSession = {
  id: number
  session_date: string
  start_time: string
  end_time: string
  lesson_title: string | null
  is_cancelled: boolean
}

type AssignmentSubmission = {
  id: number
  assignment_id: number
  student_id: number
  version_number: number
  repository_url: string | null
  submitted_at: string
}

type AssignmentSubmissionRosterEntry = {
  student_id: number
  student_code: string | null
  full_name: string
  status: 'not_submitted' | 'not_graded' | 'graded' | 'late'
  version_count: number
  is_late: boolean
  late_hours: number | null
  latest_submission: AssignmentSubmission | null
  published_grade: AssignmentGrade | null
}

type AssignmentGrade = {
  id: number
  assignment_id: number
  submission_id: number
  student_id: number
  version_number: number
  score: string
  feedback: string | null
  internal_comment?: string | null
  rubric_scores?: Array<{ criterion_id: number; title: string; weight: string; score_percent: string; comment: string | null }> | null
  status: 'draft' | 'published'
  published_at: string | null
}

type AssignmentReworkRequest = {
  id: number
  request_number: number
  request_type: 'redo' | 'reopen'
  feedback: string | null
  due_at: string | null
  requested_at: string
  status: 'open' | 'completed'
}

type RubricCriterion = { id: number; title: string; description: string | null; weight: string }
type RubricTemplate = { id: number; name: string; version: number; criteria: RubricCriterion[] }
type AssignmentRubric = { template_id: number; template_name: string; template_version: number; criteria: RubricCriterion[] }

async function fetchAssignments(
  canCreate: boolean,
  page: number,
  query: string,
  classId: number | null,
) {
  const params = new URLSearchParams({ page: String(page), page_size: '20', q: query })
  if (classId !== null) params.set('class_id', String(classId))
  const [assignments, classes] = await Promise.all([
    apiRequest<AssignmentPageResponse>(`/assignments?${params.toString()}`),
    canCreate
      ? apiRequest<TrainingClass[]>('/classes')
      : Promise.resolve([] as TrainingClass[]),
  ])
  const rubrics = canCreate ? await apiRequest<RubricTemplate[]>('/rubric-templates') : []
  return { assignments: assignments.items, total: assignments.total, pages: assignments.pages, classes, rubrics }
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
  const [rubrics, setRubrics] = useState<RubricTemplate[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [selectedRubricId, setSelectedRubricId] = useState('')
  const [sessionProblem, setSessionProblem] = useState('')
  const [classFilter, setClassFilter] = useState<number | null>(() => {
    const value = Number(new URLSearchParams(window.location.search).get('class_id'))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [pageCount, setPageCount] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)
  const canCreate = user.roles.some((role) =>
    ['admin', 'manager', 'teacher', 'ta'].includes(role),
  )
  const requestKey = `${canCreate}:${page}:${searchQuery}:${classFilter}:${reloadKey}`
  const [loadedKey, setLoadedKey] = useState('')
  const loading = loadedKey !== requestKey || search.trim() !== searchQuery

  function reloadAssignments() {
    setProblem('')
    setReloadKey((value) => value + 1)
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(search.trim())
      setPage(1)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let active = true
    fetchAssignments(canCreate, page, searchQuery, classFilter)
      .then(({ assignments: nextAssignments, classes: nextClasses, rubrics: nextRubrics, total: nextTotal, pages: nextPages }) => {
        if (!active) return
        setAssignments(nextAssignments)
        setClasses(nextClasses)
        setRubrics(nextRubrics)
        setTotal(nextTotal)
        setPageCount(Math.max(1, nextPages))
        if (page > Math.max(1, nextPages)) setPage(Math.max(1, nextPages))
        setProblem('')
      })
      .catch((error: unknown) => {
        if (active) setProblem(showError(error))
      })
      .finally(() => { if (active) setLoadedKey(requestKey) })
    return () => {
      active = false
    }
  }, [canCreate, classFilter, page, requestKey, searchQuery])

  useEffect(() => {
    if (!selectedClassId) return
    let active = true
    apiRequest<ClassSession[]>(`/classes/${selectedClassId}/sessions`)
      .then((result) => {
        if (active) {
          setSessions(result.filter((item) => !item.is_cancelled))
          setSessionProblem('')
        }
      })
      .catch((error: unknown) => {
        if (active) setSessionProblem(showError(error))
      })
    return () => { active = false }
  }, [selectedClassId])

  function clearClassFilter() {
    setClassFilter(null)
    window.history.replaceState({}, '', '/assignments')
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const instructionFiles = fields.getAll('instruction_files').filter((item): item is File => item instanceof File && item.size > 0)
    if (instructionFiles.some((file) => file.size > 20 * 1024 * 1024)) {
      setProblem('Mỗi tệp hướng dẫn tối đa 20 MB.')
      return
    }
    const dueAt = String(fields.get('due_at') ?? '')
    if (dueAt && new Date(dueAt).getTime() < Date.now()) {
      setProblem('Hạn nộp không được nằm trong quá khứ.')
      return
    }
    setBusy(true)
    setProblem('')
    try {
      const classId = Number(fields.get('class_id'))
      const status = String(fields.get('status') ?? 'published')
      const sessionId = fields.get('session_id')
      const assignment = await apiRequest<{ id: number }>(`/classes/${classId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          title: fields.get('title'),
          description: fields.get('description') || null,
          due_at: fields.get('due_at') || null,
          max_score: fields.get('max_score'),
          late_submission_policy: fields.get('late_submission_policy'),
          status: (selectedRubricId || instructionFiles.length) && status === 'published' ? 'draft' : status,
          session_id: sessionId ? Number(sessionId) : null,
        }),
      })
      for (const file of instructionFiles) {
        const safeName = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(0, 180) || 'assignment-instruction'
        await apiRequest(`/assignments/${assignment.id}/files`, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': safeName },
          body: file,
        })
      }
      if (selectedRubricId) {
        await apiRequest(`/assignments/${assignment.id}/rubric?template_id=${selectedRubricId}`, { method: 'PUT' })
      }
      if (status === 'published' && (selectedRubricId || instructionFiles.length)) await apiRequest(`/assignments/${assignment.id}/publish`, { method: 'POST' })
      form.reset()
      setSelectedClassId('')
      setSelectedSessionId('')
      setSelectedRubricId('')
      setSessions([])
      setSessionProblem('')
      notify(status === 'draft' ? 'Đã lưu bài tập ở dạng nháp.' : 'Đã giao bài tập cho lớp.')
      setPage(1)
      setSearch('')
      setSearchQuery('')
      setReloadKey((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function createRubricTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setProblem('')
    try {
      const criteria = JSON.parse(String(fields.get('criteria_json'))) as Array<{ title: string; description?: string; weight: string | number }>
      const created = await apiRequest<RubricTemplate>('/rubric-templates', {
        method: 'POST',
        body: JSON.stringify({ name: fields.get('name'), criteria }),
      })
      setRubrics((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      form.reset()
      notify('Đã lưu mẫu rubric.')
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function publishAssignment(assignment: Assignment) {
    setProblem('')
    try {
      await apiRequest(`/assignments/${assignment.id}/publish`, { method: 'POST' })
      notify('Đã giao bài tập cho lớp.')
      setReloadKey((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
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
      {problem ? (
        <div className="inline-error" role="alert">
          {problem}
          <button className="text-button" disabled={loading} onClick={reloadAssignments} type="button">
            Thử lại
          </button>
        </div>
      ) : null}
      {canCreate ? (
        <section className="panel assignment-create-panel">
          <div className="panel-heading"><div><span className="eyebrow">CHẤM ĐIỂM</span><h2>Mẫu rubric</h2></div></div>
          <form className="assignment-form" onSubmit={(event) => void createRubricTemplate(event)}>
            <label className="field"><span>Tên mẫu</span><input name="name" maxLength={150} required /></label>
            <label className="field assignment-description"><span>Tiêu chí JSON (trọng số tổng 100)</span><textarea name="criteria_json" defaultValue={'[{"title":"Correctness","weight":"60"},{"title":"Explanation","weight":"40"}]'} rows={4} required /></label>
            <button className="button button-outline" disabled={busy} type="submit">Lưu mẫu rubric</button>
          </form>
        </section>
      ) : null}
      {canCreate ? (
        <section className="panel assignment-create-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">GIAO BÀI</span><h2>Tạo bài tập cho lớp</h2></div>
          </div>
          <form className="assignment-form" onSubmit={createAssignment}>
            <label className="field">
              <span>Lớp học <b>*</b></span>
              <SearchableSelect defaultValue="" name="class_id" onChange={(value) => { setSelectedClassId(value); setSelectedSessionId(''); setSessions([]); if (!value) setSessionProblem('') }} options={classes.map((item) => ({ value: String(item.id), label: `${item.code} - ${item.course_name}` }))} placeholder="Choose a class" required ariaLabel="Class" />
            </label>
            {selectedClassId ? (
              <label className="field">
                <span>Buổi học liên quan</span>
                <SearchableSelect ariaLabel="Related session" name="session_id" onChange={setSelectedSessionId} options={sessions.map((session) => ({ value: String(session.id), label: `${session.session_date} - ${session.start_time}-${session.end_time}${session.lesson_title ? ` - ${session.lesson_title}` : ''}` }))} placeholder="Chọn buổi học liên quan" value={selectedSessionId} required />
                {sessionProblem ? <span role="alert">{sessionProblem}</span> : null}
              </label>
            ) : null}
            <label className="field">
              <span>Tên bài tập <b>*</b></span>
              <input maxLength={150} name="title" required />
            </label>
            <label className="field">
              <span>Hạn nộp</span>
              <input name="due_at" required type="datetime-local" />
            </label>
            <label className="field">
              <span>Điểm tối đa <b>*</b></span>
              <input min="0.01" name="max_score" required step="0.01" type="number" />
            </label>
            <label className="field"><span>Chính sách nộp muộn</span><select defaultValue="BLOCK_LATE" name="late_submission_policy"><option value="BLOCK_LATE">Chặn sau hạn</option><option value="ALLOW_LATE">Cho nộp và gắn nhãn muộn</option></select></label>
            <label className="field assignment-description">
              <span>Mô tả / yêu cầu</span>
              <textarea maxLength={5000} name="description" rows={3} />
            </label>
            <label className="field"><span>Tệp hướng dẫn (tối đa 20 MB mỗi tệp)</span><input accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.csv,.png,.jpg,.jpeg,.webp" multiple name="instruction_files" type="file" /></label>
            <label className="field">
              <span>Trạng thái khi lưu</span>
              <select defaultValue="published" name="status">
                <option value="draft">Lưu nháp</option>
                <option value="published">Giao ngay cho lớp</option>
              </select>
            </label>
            <label className="field">
              <span>Mẫu rubric</span>
              <SearchableSelect ariaLabel="Rubric template" onChange={setSelectedRubricId} options={rubrics.map((rubric) => ({ value: String(rubric.id), label: `${rubric.name} - v${rubric.version}` }))} placeholder="No rubric" value={selectedRubricId} />
            </label>
            <button className="button button-primary" disabled={busy || !classes.length} type="submit">
              {busy ? 'Đang lưu…' : 'Giao bài tập'}
            </button>
          </form>
        </section>
      ) : null}
      <section className="assignment-list">
        {classFilter !== null ? (
          <div className="inline-notice" role="status">
            Đang xem bài tập của lớp được liên kết từ thông báo.
            <button className="text-button" onClick={clearClassFilter} type="button">Xóa lọc lớp</button>
          </div>
        ) : null}
        <label className="field">
          <span>Tìm bài tập</span>
          <input
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Tên bài tập, lớp hoặc môn học"
            type="search"
            value={search}
          />
        </label>
        {loading ? <div className="panel schedule-loading">Đang tải bài tập…</div> : null}
        {!loading && assignments.map((item) => (
          <article className="panel assignment-card" key={item.id}>
            <div className="assignment-card-top">
              <span className="assignment-course">{item.class_code} · {item.course_name}</span>
              {item.due_at ? (
                <span>
                  <time dateTime={item.due_at}>Hạn nộp {formatHoChiMinhDateTime(item.due_at)}</time>
                  <AssignmentCountdownBadge dueAt={item.due_at} />
                </span>
              ) : <span className="muted-cell">Chưa đặt hạn nộp</span>}
            </div>
            <h2>{item.title}</h2>
            {item.description ? <p>{item.description}</p> : null}
            <span className="assignment-class-name">{item.class_name}</span>
            {item.max_score !== null ? <span className="assignment-max-score">Điểm tối đa: {item.max_score}</span> : null}
            {user.roles.includes('student') && !canCreate ? (
              <details className="assignment-details">
                <summary>Bài nộp và kết quả</summary>
                <StudentSubmissionPanel assignmentId={item.id} notify={notify} />
              </details>
            ) : canCreate ? (
              <details className="assignment-details">
                <summary>Danh sách bài nộp và chấm điểm</summary>
                <SubmissionRosterPanel assignmentId={item.id} maxScore={item.max_score} notify={notify} />
              </details>
            ) : null}
            {item.status === 'draft' ? (
              <div className="inline-notice" role="status">
                Bài tập đang ở dạng nháp.
                {canCreate ? (
                  <button className="button button-primary button-small" onClick={() => void publishAssignment(item)} type="button">
                    Giao cho lớp
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
        {!loading && !assignments.length && total === 0 ? (
          <section className="panel schedule-empty">
            <strong>{searchQuery ? 'Không tìm thấy bài tập phù hợp' : 'Chưa có bài tập'}</strong>
            <span>{searchQuery ? 'Thử thay đổi từ khóa tìm kiếm.' : 'Bài tập mới sẽ hiển thị tại đây khi được giao cho lớp.'}</span>
          </section>
        ) : null}
        {!loading && total > 0 ? (
          <nav aria-label="Phân trang bài tập" className="attendance-matrix-pagination">
            <span>Hiển thị {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} trong {total} bài tập</span>
            <div>
              <button aria-label="Trang trước" className="button button-outline button-small" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Trước</button>
              <span>Trang {page} / {pageCount}</span>
              <button aria-label="Trang sau" className="button button-outline button-small" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">Sau</button>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  )
}

function AssignmentCountdownBadge({ dueAt }: { dueAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  const countdown = assignmentCountdown(dueAt, now)
  return <span className={`assignment-countdown assignment-countdown-${countdown.state}`} role="status"> · {countdown.label}</span>
}

function StudentSubmissionPanel({
  assignmentId,
  notify,
}: {
  assignmentId: number
  notify: (message: string) => void
}) {
  const [versions, setVersions] = useState<AssignmentSubmission[]>([])
  const [grades, setGrades] = useState<AssignmentGrade[]>([])
  const [reworkRequests, setReworkRequests] = useState<AssignmentReworkRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest<AssignmentSubmission[]>(`/assignments/${assignmentId}/submissions`),
      apiRequest<AssignmentGrade[]>(`/assignments/${assignmentId}/grades`),
      apiRequest<AssignmentReworkRequest[]>(`/assignments/${assignmentId}/rework-requests?page=1&page_size=100`),
    ])
      .then(([items, publishedGrades, requests]) => {
        if (active) {
          setVersions(items)
          setGrades(publishedGrades)
          setReworkRequests(requests)
          setProblem('')
        }
      })
      .catch((error: unknown) => {
        if (active) setProblem(showError(error))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [assignmentId, reloadKey])

  async function submitRepository(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = new FormData(form)
    const repositoryUrl = String(fields.get('repository_url') ?? '').trim()
    const files = fields.getAll('submission_files').filter((item): item is File => item instanceof File && item.size > 0)
    if (!repositoryUrl && files.length === 0) {
      setProblem('Hãy nhập liên kết repository hoặc chọn ít nhất một tệp nộp.')
      return
    }
    if (files.some((file) => file.size > 20 * 1024 * 1024)) {
      setProblem('Mỗi tệp nộp không được vượt quá 20 MB.')
      return
    }
    setSaving(true)
    setProblem('')
    let createdSubmission: AssignmentSubmission | null = null
    try {
      const created = await apiRequest<AssignmentSubmission>(
        `/assignments/${assignmentId}/submissions`,
        { method: 'POST', body: JSON.stringify({ repository_url: repositoryUrl || null }) },
      )
      createdSubmission = created
      for (const file of files) {
        const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
        const mimeByExtension: Record<string, string> = {
          pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', zip: 'application/zip',
          txt: 'text/plain', csv: 'text/csv', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        }
        const safeHeaderName = file.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w .()-]/g, '_')
        await apiRequest('/assignments/' + assignmentId + '/submissions/' + created.id + '/files', {
          method: 'POST',
          headers: { 'Content-Type': file.type || mimeByExtension[extension] || 'application/octet-stream', 'X-File-Name': safeHeaderName },
          body: file,
        })
      }
      setVersions((current) => [...current, created])
      form.reset()
      notify(`Đã ghi nhận lần nộp ${created.version_number}.`)
      setLoading(true)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
      if (createdSubmission) {
        setLoading(true)
        setReloadKey((value) => value + 1)
      }
    } finally {
      setSaving(false)
    }
  }

  const latestSubmission = versions.at(-1)
  const currentPublishedGrade = latestSubmission
    ? grades.find((grade) => grade.submission_id === latestSubmission.id && grade.status === 'published')
    : undefined
  const openRework = reworkRequests.find((request) => request.status === 'open')
  const canSubmitAgain = !currentPublishedGrade || Boolean(openRework)

  return (
    <section className="assignment-submission-panel" aria-label="Nộp bài tập">
      <h3>Bài nộp</h3>
      {loading ? <p role="status">Đang tải lịch sử nộp bài…</p> : null}
      {!loading && !problem ? <p role="status">{versions.length ? `Đã nộp · ${versions.length} phiên bản` : 'Chưa nộp'}</p> : null}
      {problem ? (
        <div className="inline-error" role="alert">
          {problem}
          <button className="text-button" disabled={saving} onClick={() => { setLoading(true); setReloadKey((value) => value + 1) }} type="button">Thử lại</button>
        </div>
      ) : null}
      {!loading && !problem && versions.length === 0 ? <p role="status">Chưa có lần nộp bài.</p> : null}
      {versions.map((version) => (
        <div className="submission-version" key={version.id}>
          <p>Lần {version.version_number} · {version.repository_url ? <a href={version.repository_url} target="_blank" rel="noreferrer">Mở repository</a> : 'Nộp tệp'} · {formatHoChiMinhDateTime(version.submitted_at)}</p>
          <SubmissionFiles assignmentId={assignmentId} submissionId={version.id} notify={notify} />
        </div>
      ))}
      {grades.map((grade) => (
        <p key={grade.id} role="status">
          Điểm đã công bố: {grade.score}{grade.feedback ? ` · ${grade.feedback}` : ''}
        </p>
      ))}
      {reworkRequests.length ? <section aria-label="Lịch sử yêu cầu làm lại" className="rework-history">
        <strong>Lịch sử làm lại</strong>
        {reworkRequests.map((request) => <p key={request.id}>Lần {request.request_number} · {request.request_type === 'redo' ? 'Yêu cầu làm lại' : 'Mở lại bài'} · {request.status === 'open' ? 'Hạn ' + (request.due_at ? formatHoChiMinhDateTime(request.due_at) : 'không đặt') : 'Đã nộp lại'}{request.feedback ? ' · ' + request.feedback : ''}</p>)}
      </section> : null}
      {canSubmitAgain ? <form className="assignment-form" onSubmit={(event) => void submitRepository(event)}>
        <label className="field"><span>Liên kết repository HTTPS (nếu có)</span><input name="repository_url" type="url" pattern="https://.*" /></label>
        <label className="field"><span>Tệp nộp (tối đa 20 MB mỗi tệp)</span><input accept=".pdf,.docx,.pptx,.xlsx,.zip,.txt,.csv,.png,.jpg,.jpeg" multiple name="submission_files" type="file" /><small>PDF, Office, ZIP, văn bản, CSV và ảnh JPG/PNG.</small></label>
        {openRework?.due_at ? <p className="form-help">Hạn nộp lại: {formatHoChiMinhDateTime(openRework.due_at)}</p> : null}
        <button className="button button-outline" disabled={saving || loading} type="submit">{saving ? 'Đang nộp…' : 'Nộp bài'}</button>
      </form> : <p role="status">Bài đã chấm; bạn chỉ có thể nộp lại khi giảng viên mở lại hoặc yêu cầu làm lại.</p>}
    </section>
  )
}

function SubmissionFiles({ assignmentId, submissionId, notify }: { assignmentId: number; submissionId: number; notify: (message: string) => void }) {
  const [files, setFiles] = useState<{ id: number; filename: string; size_bytes: number }[]>([])
  useEffect(() => {
    let active = true
    apiRequest<{ id: number; filename: string; size_bytes: number }[]>('/assignments/' + assignmentId + '/submissions/' + submissionId + '/files?page=1&page_size=100')
      .then((rows) => { if (active) setFiles(rows) })
      .catch((error: unknown) => { if (active) notify(showError(error)) })
    return () => { active = false }
  }, [assignmentId, notify, submissionId])

  async function download(file: { id: number; filename: string }) {
    try {
      const blob = await apiBlobRequest('/assignment-files/' + file.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.filename
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) { notify(showError(error)) }
  }

  return files.length ? <ul className="submission-file-list">{files.map((file) => <li key={file.id}><button className="text-button" onClick={() => void download(file)} type="button">{file.filename} ({(file.size_bytes / 1024 / 1024).toFixed(1)} MB)</button></li>)}</ul> : null
}

function SubmissionRosterPanel({
  assignmentId,
  maxScore,
  notify,
}: {
  assignmentId: number
  maxScore: string | null
  notify: (message: string) => void
}) {
  const [roster, setRoster] = useState<AssignmentSubmissionRosterEntry[]>([])
  const [rubric, setRubric] = useState<AssignmentRubric | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [rosterSearch, setRosterSearch] = useState('')
  const [rosterStatus, setRosterStatus] = useState<'all' | 'not_graded' | 'graded' | 'late' | 'not_submitted'>('all')
  const [rosterPage, setRosterPage] = useState(1)
  const [rosterTotal, setRosterTotal] = useState(0)
  const [redoStudentId, setRedoStudentId] = useState<number | null>(null)
  const [redoFeedback, setRedoFeedback] = useState('')
  const [redoDeadline, setRedoDeadline] = useState('')
  const [redoBusy, setRedoBusy] = useState(false)
  const [minimumRedoDeadline] = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16))
  const [progress, setProgress] = useState<{ total_recipients: number; submitted_count: number; not_submitted_count: number; graded_count: number; not_graded_count: number; grading_progress_percent: number | null } | null>(null)

  useEffect(() => {
    let active = true
    const statusQuery = rosterStatus === 'all' ? '' : `&status=${rosterStatus}`
    Promise.all([
      apiRequestWithHeaders<AssignmentSubmissionRosterEntry[]>(`/assignments/${assignmentId}/submissions?page=${rosterPage}&page_size=20${statusQuery}`),
      apiRequest<{ total_recipients: number; submitted_count: number; not_submitted_count: number; graded_count: number; not_graded_count: number; grading_progress_percent: number | null }>(`/assignments/${assignmentId}/submissions/progress`),
      apiRequest<AssignmentRubric | null>(`/assignments/${assignmentId}/rubric`),
    ])
      .then(([rosterResponse, assignmentProgress, assignmentRubric]) => {
        if (active) {
          setRoster(rosterResponse.data)
          setRosterTotal(paginationFromHeaders(rosterResponse.headers, { page: rosterPage, pageSize: 20 }).total)
          setProgress(assignmentProgress)
          setRubric(assignmentRubric)
          setProblem('')
        }
      })
      .catch((error: unknown) => { if (active) setProblem(showError(error)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [assignmentId, reloadKey, rosterPage, rosterStatus])

  const fallbackSummary = summarizeAssignmentRoster(roster)
  const totalRecipients = progress?.total_recipients ?? fallbackSummary.total
  const submittedCount = progress?.submitted_count ?? fallbackSummary.submitted
  const notSubmittedCount = progress?.not_submitted_count ?? fallbackSummary.notSubmitted
  const gradedCount = progress?.graded_count ?? 0

  function changeRosterPage(nextPage: number) {
    setLoading(true)
    setRosterPage(nextPage)
  }

  function changeRosterStatus(nextStatus: typeof rosterStatus) {
    setLoading(true)
    setRosterStatus(nextStatus)
    setRosterPage(1)
  }

  async function requestRedo(event: FormEvent<HTMLFormElement>, studentId: number) {
    event.preventDefault()
    setRedoBusy(true)
    setProblem('')
    try {
      await apiRequest('/assignments/' + assignmentId + '/students/' + studentId + '/redo-requests', {
        method: 'POST',
        body: JSON.stringify({ feedback: redoFeedback.trim(), due_at: new Date(redoDeadline).toISOString() }),
      })
      notify('Đã gửi yêu cầu làm lại và lưu hạn nộp mới.')
      setRedoStudentId(null)
      setRedoFeedback('')
      setRedoDeadline('')
      setLoading(true)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setRedoBusy(false)
    }
  }
  const visibleRoster = filterAssignmentRoster(roster, rosterSearch, 'all')

  async function saveDraft(event: FormEvent<HTMLFormElement>, entry: AssignmentSubmissionRosterEntry) {
    event.preventDefault()
    if (!entry.latest_submission) return
    const fields = new FormData(event.currentTarget)
    const rubricScores = rubric?.criteria.map((criterion) => ({
      criterion_id: criterion.id,
      score_percent: fields.get(`criterion_${criterion.id}`),
      comment: fields.get(`criterion_comment_${criterion.id}`) || null,
    }))
    setSaving(true)
    setProblem('')
    try {
      await apiRequest<AssignmentGrade>(
        `/assignments/${assignmentId}/students/${entry.student_id}/grades`,
        {
          method: 'POST',
          body: JSON.stringify({
            submission_id: entry.latest_submission.id,
            ...(rubricScores ? { rubric_scores: rubricScores } : { score: fields.get('score') }),
            feedback: fields.get('feedback') || null,
            internal_comment: fields.get('internal_comment') || null,
          }),
        },
      )
      notify('Đã lưu bản chấm nháp.')
      setLoading(true)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setSaving(false)
    }
  }

  async function publishGrade(gradeId: number) {
    setSaving(true)
    setProblem('')
    try {
      await apiRequest(`/assignments/${assignmentId}/grades/${gradeId}/publish`, { method: 'POST' })
      notify('Đã công bố điểm cho học viên.')
      setLoading(true)
      setReloadKey((value) => value + 1)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="assignment-submission-panel" aria-label="Tình trạng nộp bài của lớp">
      <h3>Tình trạng nộp bài</h3>
      {loading ? <p role="status">Đang tải danh sách…</p> : null}
      {problem ? <p role="alert">{problem}</p> : null}
      {!loading && !problem && roster.length === 0 ? <p role="status">Roster của bài tập chưa có học viên.</p> : null}
      {!loading && !problem && roster.length > 0 ? (
        <>
          <p role="status">Đã nộp {submittedCount}/{totalRecipients} · Chưa nộp {notSubmittedCount} · Đã chấm {gradedCount}/{totalRecipients}</p>
          <div className="assignment-form">
            <label className="field"><span>Tìm học viên trên trang hiện tại</span><input onChange={(event) => setRosterSearch(event.target.value)} type="search" value={rosterSearch} /></label>
            <label className="field"><span>Trạng thái bài nộp</span><select onChange={(event) => changeRosterStatus(event.target.value as typeof rosterStatus)} value={rosterStatus}><option value="all">Tất cả</option><option value="not_graded">Chưa chấm</option><option value="graded">Đã chấm</option><option value="late">Nộp muộn</option><option value="not_submitted">Chưa nộp</option></select></label>
          </div>
        </>
      ) : null}
      {!loading && !problem && roster.length > 0 && visibleRoster.length === 0 ? <p role="status">Không có học viên phù hợp bộ lọc.</p> : null}
      {visibleRoster.map((entry) => {
        const latestGrade = entry.published_grade
        return (
          <div className="assignment-submission-roster-row" key={entry.student_id}>
            <p>
              {entry.student_code || entry.student_id} · {entry.full_name} ·
              {' '}{entry.status === 'not_submitted' ? 'Chưa nộp' : entry.status === 'late' ? `Nộp muộn${entry.late_hours ? ` · trễ ${entry.late_hours} giờ` : ''}` : entry.status === 'graded' ? 'Đã chấm' : `Đã nộp (${entry.version_count} phiên bản) · Chưa chấm`}
            </p>
            {entry.latest_submission ? (
              <>
                {entry.latest_submission.repository_url ? <p><a href={entry.latest_submission.repository_url} target="_blank" rel="noreferrer">Mở repository</a></p> : null}
                <SubmissionFiles assignmentId={assignmentId} submissionId={entry.latest_submission.id} notify={notify} />
              </>
            ) : null}
            {latestGrade ? (
              <p>
                {latestGrade.status === 'published' ? 'Điểm đã công bố' : 'Bản nháp điểm'}:
                {' '}{latestGrade.score}{latestGrade.feedback ? ` · ${latestGrade.feedback}` : ''}
                {latestGrade.status === 'draft' ? (
                  <button className="button button-outline button-small" disabled={saving} onClick={() => void publishGrade(latestGrade.id)} type="button">Công bố điểm</button>
                ) : null}
              </p>
            ) : null}
            {latestGrade?.rubric_scores?.map((item) => (
              <p key={item.criterion_id} className="muted-cell">
                {item.title}: {item.score_percent}% ({item.weight}%){item.comment ? ` · ${item.comment}` : ''}
              </p>
            ))}
            {latestGrade?.status === 'published' ? (
              redoStudentId === entry.student_id ? (
                <form className="assignment-form rework-request-form" onSubmit={(event) => void requestRedo(event, entry.student_id)}>
                  <label className="field"><span>Nhận xét bắt buộc</span><textarea maxLength={5000} minLength={1} onChange={(event) => setRedoFeedback(event.target.value)} required value={redoFeedback} /></label>
      <label className="field"><span>Hạn nộp mới</span><input min={minimumRedoDeadline} onChange={(event) => setRedoDeadline(event.target.value)} required type="datetime-local" value={redoDeadline} /></label>
                  <div className="button-row"><button className="button button-primary" disabled={redoBusy} type="submit">{redoBusy ? 'Đang gửi…' : 'Gửi yêu cầu làm lại'}</button><button className="button button-quiet" onClick={() => setRedoStudentId(null)} type="button">Hủy</button></div>
                </form>
              ) : <button className="button button-outline button-small" disabled={saving || redoBusy} onClick={() => setRedoStudentId(entry.student_id)} type="button">Yêu cầu làm lại</button>
            ) : null}
            {entry.latest_submission && maxScore !== null ? (
              <form className="assignment-form" onSubmit={(event) => void saveDraft(event, entry)}>
                {rubric ? rubric.criteria.map((criterion) => (
                  <div className="field" key={criterion.id}>
                    <span>{criterion.title} · trọng số {criterion.weight}%</span>
                    {criterion.description ? <small>{criterion.description}</small> : null}
                    <input aria-label={`Điểm phần trăm: ${criterion.title}`} defaultValue={latestGrade?.rubric_scores?.find((item) => item.criterion_id === criterion.id)?.score_percent} min="0" max="100" name={`criterion_${criterion.id}`} required step="0.01" type="number" />
                    <input aria-label={`Nhận xét tiêu chí: ${criterion.title}`} defaultValue={latestGrade?.rubric_scores?.find((item) => item.criterion_id === criterion.id)?.comment ?? ''} maxLength={2000} name={`criterion_comment_${criterion.id}`} placeholder="Nhận xét tiêu chí (tùy chọn)" />
                  </div>
                )) : (
                  <label className="field">
                    <span>Điểm / {maxScore}</span>
                    <input min="0" max={maxScore} name="score" required step="0.01" type="number" />
                  </label>
                )}
                <label className="field">
                  <span>Nhận xét cho học viên</span>
                  <input maxLength={5000} name="feedback" />
                </label>
                <label className="field">
                  <span>Ghi chú nội bộ</span>
                  <input maxLength={5000} name="internal_comment" />
                </label>
                <button className="button button-outline" disabled={saving} type="submit">Lưu bản nháp</button>
              </form>
            ) : null}
          </div>
        )
      })}
      {!loading && !problem && rosterTotal > 0 ? <ListPagination page={rosterPage} pageSize={20} total={rosterTotal} onPageChange={changeRosterPage} /> : null}
    </section>
  )
}
