import { useEffect, useEffectEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AssignmentError, assignmentOptions, assignmentTime, getAssignment, listAssignments } from '../services/assignmentService'
import type { Assignment, AssignmentSession } from '../services/assignmentService'
import AssignmentEditor from './AssignmentEditor'
import './AssignmentsPage.css'

export default function AssignmentsPage({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [params, setParams] = useSearchParams()
  const selected = params.get('assignment_id') || ''
  const [page, setPage] = useState(1), [reload, setReload] = useState(0), [notice, setNotice] = useState('')
  const [options, setOptions] = useState<{ can_create: boolean; sessions: AssignmentSession[] }>(), [optionsError, setOptionsError] = useState('')
  const [listing, setListing] = useState<{ key: string; items?: Assignment[]; total?: number; error?: string }>()
  const [detail, setDetail] = useState<{ key: string; data?: Assignment; error?: string }>()
  const listKey = `${page}:${reload}`, detailKey = `${selected}:${reload}`
  const explain = useEffectEvent((error: unknown) => {
    if (error instanceof AssignmentError && error.status === 401) onSessionExpired()
    return error instanceof Error && !(error instanceof TypeError) ? error.message : 'Không thể kết nối. Vui lòng thử lại.'
  })
  useEffect(() => {
    let active = true
    assignmentOptions().then(data => { if (active) { setOptions(data); setOptionsError('') } })
      .catch(error => { if (active) setOptionsError(explain(error)) })
    return () => { active = false }
  }, [reload])
  useEffect(() => {
    let active = true
    listAssignments(page).then(data => { if (active) setListing({ key: listKey, ...data }) })
      .catch(error => { if (active) setListing({ key: listKey, error: explain(error) }) })
    return () => { active = false }
  }, [page, listKey])
  useEffect(() => {
    if (!selected || selected === 'new') return
    let active = true
    if (!/^[1-9]\d*$/.test(selected)) {
      void Promise.resolve().then(() => { if (active) setDetail({ key: detailKey, error: 'Mã bài tập không hợp lệ.' }) })
    } else getAssignment(Number(selected)).then(data => { if (active) setDetail({ key: detailKey, data }) })
      .catch(error => { if (active) setDetail({ key: detailKey, error: explain(error) }) })
    return () => { active = false }
  }, [selected, detailKey])
  const rows = listing?.key === listKey ? listing : undefined
  const current = detail?.key === detailKey ? detail : undefined
  const changed = (row: Assignment, message: string) => {
    setNotice(message); setParams({ assignment_id: String(row.assignment_id) }); setReload(value => value + 1)
  }
  return <section className="assignments-page">
    <header className="assignments-heading"><div><span>HỌC TẬP</span><h1>Bài tập</h1><p>Soạn nháp, đính kèm tài liệu và giao bài cho lớp.</p></div>
      {options?.can_create && !selected && <button className="assignment-primary" onClick={() => { setNotice(''); setParams({ assignment_id: 'new' }) }}>Tạo bài tập</button>}</header>
    {notice && <p role="status" className="assignment-success">{notice}</p>}
    {optionsError && <p role="alert" className="assignment-error">{optionsError} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
    {selected ? <>
      {selected === 'new' ? options?.can_create ? <AssignmentEditor key="new" sessions={options.sessions} onSaved={changed} onClose={() => setParams({})} onSessionExpired={onSessionExpired} /> : <p>Không có quyền tạo bài tập hoặc đang tải phân công.</p>
        : current?.data ? <AssignmentEditor key={`${current.data.assignment_id}:${current.data.version}`} saved={current.data} sessions={options?.sessions || []} onSaved={changed} onClose={() => setParams({})} onSessionExpired={onSessionExpired} />
          : current?.error ? <p role="alert" className="assignment-error">{current.error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button><button onClick={() => setParams({})}>Về danh sách</button></p>
            : <p role="status">Đang tải bài tập…</p>}
    </> : <>
      {!rows && <p role="status">Đang tải danh sách…</p>}
      {rows?.error && <p role="alert" className="assignment-error">{rows.error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
      {rows?.items?.length === 0 && <p className="assignment-empty">Chưa có bài tập. Bài nháp chỉ hiển thị với tác giả; học viên thấy bài sau khi giảng viên giao.</p>}
      <div className="assignment-grid">{rows?.items?.map(row => <article className="assignment-card" key={row.assignment_id}>
        <span className={`assignment-status ${row.status}`}>{row.status === 'draft' ? 'Bản nháp' : 'Đã giao'}</span>
        <h2>{row.title}</h2><p>{row.class_name} · {row.subject_name}</p><p>{row.session_date} · {row.topic}</p>
        <p>Hạn nộp: {assignmentTime(row.due_at)} (VN)</p><p>{row.max_points} điểm · {row.attachments.length} tệp</p>
        <button onClick={() => { setNotice(''); setParams({ assignment_id: String(row.assignment_id) }) }}>{row.can_edit ? 'Mở bản nháp' : 'Xem bài tập'}</button>
      </article>)}</div>
      {!!rows?.total && <nav className="assignment-pagination" aria-label="Phân trang bài tập"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}/{Math.ceil(rows.total / 20)}</span><button disabled={page * 20 >= rows.total} onClick={() => setPage(page + 1)}>Trang sau</button></nav>}
    </>}
  </section>
}
