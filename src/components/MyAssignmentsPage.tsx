import { useEffect, useEffectEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AssignmentError, assignmentProgressLabels, assignmentTime, getMyAssignment, listMyAssignments } from '../services/assignmentService'
import type { Assignment, AssignmentDueSort, AssignmentProgress, MyAssignmentList } from '../services/assignmentService'
import { assignmentDeadline } from '../utils/assignmentDeadline'
import AssignmentEditor from './AssignmentEditor'
import './AssignmentsPage.css'
import './MyAssignmentsPage.css'

export default function MyAssignmentsPage({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [params, setParams] = useSearchParams()
  const selected = params.get('assignment_id') || ''
  const status: AssignmentProgress = Object.hasOwn(assignmentProgressLabels, params.get('status') || '') ? params.get('status') as AssignmentProgress : 'not_submitted'
  const sort: AssignmentDueSort = params.get('sort') === 'due_desc' ? 'due_desc' : 'due_asc'
  const page = /^[1-9]\d{0,5}$/.test(params.get('page') || '') ? Number(params.get('page')) : 1
  const [reload, setReload] = useState(0), [tick, setTick] = useState(() => performance.now())
  const key = `${status}:${sort}:${page}:${reload}`, detailKey = `${selected}:${reload}`
  const [result, setResult] = useState<{ key: string; data?: MyAssignmentList; receivedAt: number; error?: string }>()
  const [detail, setDetail] = useState<{ key: string; data?: Assignment; error?: string }>()
  const explain = useEffectEvent((failure: unknown) => {
    if (failure instanceof AssignmentError && failure.status === 401) onSessionExpired()
    return failure instanceof Error && !(failure instanceof TypeError) ? failure.message : 'Không thể tải bài tập. Vui lòng thử lại.'
  })
  useEffect(() => {
    let active = true
    listMyAssignments(status, sort, page).then(data => {
      if (active) setResult({ key, data, receivedAt: performance.now() })
    }).catch(error => { if (active) setResult({ key, receivedAt: performance.now(), error: explain(error) }) })
    return () => { active = false }
  }, [status, sort, page, key])
  useEffect(() => {
    const clock = window.setInterval(() => setTick(performance.now()), 15000)
    const refresh = () => { if (document.visibilityState !== 'hidden') { setTick(performance.now()); setReload(value => value + 1) } }
    const poll = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(clock); window.clearInterval(poll); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  useEffect(() => {
    if (!selected) return
    let active = true
    const request = /^[1-9]\d*$/.test(selected) ? getMyAssignment(Number(selected)) : Promise.reject(new Error('Mã bài tập không hợp lệ.'))
    request.then(data => { if (active) setDetail({ key: detailKey, data }) })
      .catch(error => { if (active) setDetail({ key: detailKey, error: explain(error) }) })
    return () => { active = false }
  }, [selected, detailKey])
  const loaded = result?.key === key ? result : undefined
  const data = loaded?.data
  const current = detail?.key === detailKey ? detail : undefined
  const now = data ? Date.parse(data.now) + Math.max(0, tick - loaded!.receivedAt) : 0
  const change = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [name, value] of Object.entries(patch)) { if (value === null) next.delete(name); else next.set(name, value) }
    setParams(next)
  }
  return <section className="assignments-page my-assignments-page" aria-labelledby="my-assignments-title">
    <header className="assignments-heading"><div><span>VIỆC HỌC CỦA BẠN</span><h1 id="my-assignments-title">Bài tập của tôi</h1><p>Theo dõi bài cần làm và hạn nộp theo giờ Việt Nam.</p></div>
      <button onClick={() => setReload(value => value + 1)}>Làm mới</button></header>
    {selected ? <>
      {current?.data ? <AssignmentEditor key={`${current.data.assignment_id}:${current.data.version}`} saved={{ ...current.data, can_edit: false }} sessions={[]} onSaved={() => {}} onClose={() => change({ assignment_id: null })} onSessionExpired={onSessionExpired} />
        : current?.error ? <p role="alert" className="assignment-error">{current.error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button><button onClick={() => change({ assignment_id: null })}>Về danh sách</button></p>
          : <p role="status">Đang tải bài tập…</p>}
    </> : <>
      <nav className="my-assignment-groups" aria-label="Nhóm trạng thái bài tập">
        {Object.entries(assignmentProgressLabels).map(([value, label]) => <button key={value} type="button" aria-pressed={value === status} onClick={() => change({ status: value, page: null })}>
          <span>{label}</span><strong>{data ? data.counts[value as AssignmentProgress] : '—'}</strong>
        </button>)}
      </nav>
      <div className="my-assignment-controls"><h2>{assignmentProgressLabels[status]}</h2><label>Sắp xếp<select aria-label="Sắp xếp bài tập" value={sort} onChange={event => change({ sort: event.target.value, page: null })}>
        <option value="due_asc">Hạn nộp gần nhất</option><option value="due_desc">Hạn nộp xa nhất</option></select></label></div>
      <p className="my-assignment-hint">Bài chưa nộp hoặc cần làm lại còn không quá 24 giờ được đánh dấu “Sắp hết hạn”. Bài quá hạn nằm đầu danh sách khi sắp theo hạn gần nhất.</p>
      {!loaded && <p role="status">Đang tải bài tập…</p>}
      {loaded?.error && <p role="alert" className="assignment-error">{loaded.error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
      {data && !data.total && <p className="assignment-empty">Không có bài tập trong nhóm “{assignmentProgressLabels[status]}”.</p>}
      <div className="assignment-grid">{data?.items.map(item => {
        const deadline = assignmentDeadline(item.due_at, item.progress_status, now, data.urgent_window_hours)
        return <article key={item.assignment_id} data-assignment-id={item.assignment_id} className={`assignment-card my-assignment-card ${deadline.urgency}`}>
          <div className="my-assignment-badges"><span className={`assignment-status progress-${item.progress_status}`}>{assignmentProgressLabels[item.progress_status]}</span>
            {deadline.urgency !== 'normal' && <strong className="my-assignment-warning">{deadline.urgency === 'overdue' ? 'Quá hạn' : 'Sắp hết hạn'}</strong>}</div>
          <h3>{item.title}</h3><p>{item.class_name} · {item.subject_name}</p>
          <p className="my-assignment-countdown">{deadline.text}</p>
          <p>Hạn nộp: <time dateTime={item.due_at}>{assignmentTime(item.due_at)}</time> (VN)</p><p>Điểm tối đa: {item.max_points}</p>
          <button onClick={() => change({ assignment_id: String(item.assignment_id) })}>Xem bài tập</button>
        </article>
      })}</div>
      {!!data?.total && <nav className="assignment-pagination" aria-label="Phân trang bài tập của tôi"><button disabled={data.page <= 1} onClick={() => change({ page: String(data.page - 1) })}>Trang trước</button>
        <span>{data.total} bài · Trang {data.page}/{Math.ceil(data.total / data.page_size)}</span><button disabled={data.page * data.page_size >= data.total} onClick={() => change({ page: String(data.page + 1) })}>Trang sau</button></nav>}
    </>}
  </section>
}
