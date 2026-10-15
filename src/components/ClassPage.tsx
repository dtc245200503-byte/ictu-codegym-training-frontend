import { Fragment, useEffect, useState } from 'react'
import ChoiceSelect from './ChoiceSelect'
import ErrorPage from './ErrorPage'
import { ClassPermissionError, ClassSessionError, listClasses } from '../services/classService'
import type { TrainingClass } from '../services/classService'
import './TrainingProgramPage.css'
import './ClassPage.css'
import AssignTeachersModal from './AssignTeachersModal'
import { canAssignTeachers } from '../utils/classAccess'
import type { CurrentUser } from '../types/auth'

const statuses: Record<string, string> = { planned: 'Sắp khai giảng', in_progress: 'Đang học', completed: 'Đã kết thúc', cancelled: 'Đã hủy' }
export default function ClassPage({ user, onSessionExpired, onSuccess }: { user: CurrentUser; onSessionExpired: () => void; onSuccess: (message: string) => void }) {
  const canAssign = canAssignTeachers(user)
  const [assigning, setAssigning] = useState<number | null>(null)
  const [items, setItems] = useState<TrainingClass[]>([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    listClasses(filters.search, filters.status, page).then(result => {
      if (!active) return
      const last = Math.max(1, Math.ceil(result.total / 20))
      if (page > last) { setPage(last); return }
      setItems(result.items); setTotal(result.total)
    }).catch((err: unknown) => {
      if (!active) return
      if (err instanceof ClassSessionError) onSessionExpired()
      if (err instanceof ClassPermissionError) setForbidden(true)
      setItems([]); setTotal(0); setError(err instanceof Error && !(err instanceof TypeError) ? err.message : 'Không thể kết nối đến hệ thống. Vui lòng thử lại.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, reload])
  const prepareLoad = () => { setLoading(true); setError(''); setExpanded(null) }
  if (forbidden) return <ErrorPage statusCode={403} title="Không có quyền truy cập" message="Bạn không có quyền xem lớp học." />
  return <section className="program-page" aria-labelledby="class-title">
    <div className="program-header"><div><h1 id="class-title">{canAssign ? 'Lớp học' : 'Lớp của tôi'}</h1><p>{canAssign ? 'Phân công giảng viên chính và trợ giảng phụ trách từng môn trong lớp.' : 'Các lớp bạn được phân công giảng dạy hoặc trợ giảng theo môn học.'}</p></div></div>
    <form className="program-filters" onSubmit={event => { event.preventDefault(); prepareLoad(); setFilters({ ...filters, search }); setPage(1); setReload(value => value + 1) }}>
      <div><label htmlFor="class-search">Tìm lớp học</label><input id="class-search" maxLength={100} value={search} placeholder="Tên lớp, chương trình hoặc giảng viên" onChange={event => setSearch(event.target.value)} /></div>
      <div><label htmlFor="class-status">Trạng thái</label><ChoiceSelect id="class-status" value={filters.status} onChange={event => { prepareLoad(); setFilters({ search, status: event.target.value }); setPage(1) }}><option value="">Tất cả trạng thái</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ChoiceSelect></div><button type="submit">Tìm kiếm</button>
    </form>
    {error && <p className="program-error" role="alert">{error} <button onClick={() => { prepareLoad(); setReload(value => value + 1) }}>Thử lại</button></p>}
    <div className="program-table-wrap" aria-busy={loading}><table className="program-table class-table">
      <caption>{total} lớp học</caption><thead><tr><th>Lớp học</th><th>Chương trình</th><th>Phân công theo môn</th><th>Khai giảng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={6}>Đang tải lớp học...</td></tr> : !items.length ? <tr><td colSpan={6}>{canAssign ? 'Chưa có lớp phù hợp.' : 'Bạn chưa được phân công vào lớp nào phù hợp với bộ lọc.'}</td></tr> : items.map(item => <Fragment key={item.class_id}>
        <tr data-class-id={item.class_id}>
          <td className="program-name"><strong>{item.class_name}</strong><small>Mã lớp: {item.class_id}</small></td>
          <td className="program-name">{item.program_name || 'Chưa chọn chương trình'}<small>{item.program_code}</small></td>
          <td><strong>{item.subjects.filter(subject => subject.instructor_id).length}/{item.subjects.length} môn</strong><small>đã có giảng viên chính</small></td>
          <td>{item.start_date ? item.start_date.split('-').reverse().join('/') : 'Chưa có ngày'}</td>
          <td><span className={`program-badge ${item.status === 'in_progress' ? 'active' : 'inactive'}`}>{statuses[item.status] || 'Khác'}</span></td>
          <td><div className="class-row-actions"><button type="button" aria-expanded={expanded === item.class_id} aria-controls={`class-subjects-${item.class_id}`} onClick={() => setExpanded(expanded === item.class_id ? null : item.class_id)}>{expanded === item.class_id ? 'Ẩn môn học' : `Xem ${item.subjects.length} môn học`}</button>{canAssign && <button type="button" className="program-primary" disabled={!item.subjects.length} onClick={() => setAssigning(item.class_id)}>Phân công</button>}</div></td>
        </tr>
        {expanded === item.class_id && <tr id={`class-subjects-${item.class_id}`}><td colSpan={6}><div className="class-subject-grid">{item.subjects.map(subject => <article key={subject.subject_id} className="class-subject-detail">
          <h2><span>{subject.code}</span> {subject.name}</h2><small>{subject.session_count} buổi học</small>
          <p><strong>Giảng viên chính:</strong> {subject.instructor_name || 'Chưa phân công'}{subject.instructor_id === user.user_id && <span className="class-mine-badge">Bạn phụ trách</span>}</p>
          <p><strong>Trợ giảng:</strong> {subject.assistants.length ? subject.assistants.map(assistant => assistant.full_name + (assistant.user_id === user.user_id ? ' (Bạn)' : '')).join(', ') : 'Chưa phân công'}</p>
        </article>)}{!item.subjects.length && <p>Chưa có môn học trong lớp.</p>}</div></td></tr>}
      </Fragment>)}</tbody></table></div>
    <div className="program-pagination"><span>Trang {page}/{Math.max(1, Math.ceil(total / 20))}</span><button disabled={loading || page <= 1} onClick={() => { prepareLoad(); setPage(page - 1) }}>Trang trước</button><button disabled={loading || page >= Math.ceil(total / 20)} onClick={() => { prepareLoad(); setPage(page + 1) }}>Trang sau</button></div>
    {assigning !== null && canAssign && <AssignTeachersModal key={assigning} classId={assigning} onClose={() => setAssigning(null)} onSessionExpired={onSessionExpired} onSaved={() => { setAssigning(null); prepareLoad(); setReload(value => value + 1); onSuccess('Đã lưu phân công giảng viên và trợ giảng theo môn.') }} />}
  </section>
}
