import { safeMeetingUrl } from '../services/roomService'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { AttendanceError, attendanceDate, attendanceStatuses, attendanceTime, getAttendance, getAttendanceHistory, saveAttendance } from '../services/attendanceService'
import type { AttendanceDetail, AttendanceLog, AttendanceStatus } from '../services/attendanceService'

function AttendanceHistory({ sessionId, version, explain }: { sessionId: number; version: number; explain: (error: unknown) => string }) {
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const key = `${page}:${version}:${retry}`
  const [result, setResult] = useState<{ key: string; items?: AttendanceLog[]; total?: number; error?: string }>()
  const explainLoad = useEffectEvent(explain)
  useEffect(() => {
    let active = true
    getAttendanceHistory(sessionId, page).then(data => { if (active) setResult({ key, ...data }) })
      .catch((error: unknown) => { if (active) setResult({ key, error: explainLoad(error) }) })
    return () => { active = false }
  }, [sessionId, page, key])
  if (result?.key !== key) return <p role="status">Đang tải nhật ký…</p>
  return <div className="attendance-history">
    {result.error && <p role="alert">{result.error} <button onClick={() => setRetry(value => value + 1)}>Thử lại</button></p>}
    {result.items && <><p>{result.total} thay đổi · Giờ Việt Nam</p>
      {!result.items.length && <p>Chưa có nhật ký điểm danh.</p>}
      <ol>{result.items.map(item => <li key={item.history_id}><strong>{item.student_name}</strong><p>{item.from_status ? attendanceStatuses[item.from_status] : 'Chưa điểm danh'} → <b>{attendanceStatuses[item.to_status]}</b></p><small>{item.actor_name} · {attendanceTime(item.created_at)} · Lần lưu {item.version}</small></li>)}</ol>
      <div className="attendance-pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page}/{Math.max(1, Math.ceil((result.total || 0) / 20))}</span><button disabled={page * 20 >= (result.total || 0)} onClick={() => setPage(value => value + 1)}>Sau</button></div>
    </>}
  </div>
}

export default function AttendanceEditor({ sessionId, onBack, explain }: { sessionId: number; onBack: () => void; explain: (error: unknown) => string }) {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ version: number; data?: AttendanceDetail; error?: string }>()
  const [draft, setDraft] = useState<Record<number, AttendanceStatus | null>>({})
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [discard, setDiscard] = useState<'back' | 'reload' | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const explainLoad = useEffectEvent(explain)
  useEffect(() => {
    let active = true
    getAttendance(sessionId).then(data => {
      if (active) { setResult({ version: retry, data }); setDraft(Object.fromEntries(data.students.map(item => [item.student_id, item.status]))) }
    }).catch((err: unknown) => { if (active) setResult({ version: retry, error: explainLoad(err) }) })
    return () => { active = false }
  }, [sessionId, retry])
  const loading = result?.version !== retry
  const data = loading ? undefined : result?.data
  const dirty = !!data?.students.some(student => draft[student.student_id] !== student.status)
  const marked = data?.students.filter(student => draft[student.student_id]).length || 0
  const total = data?.students.length || 0
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const refresh = () => { setError(''); setSuccess(''); setDiscard(null); setRetry(value => value + 1) }
  const leave = (action: 'back' | 'reload') => { if (saving.current) return; if (dirty) setDiscard(action); else if (action === 'back') onBack(); else refresh() }
  const save = async () => {
    if (!data || !data.can_edit || saving.current || (!dirty && !data.absence_prefilled) || marked !== total || !total) return
    saving.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      const fresh = await saveAttendance(sessionId, data.version, data.students.map(student => ({ student_id: student.student_id, status: draft[student.student_id] as AttendanceStatus })))
      setResult({ version: retry, data: fresh })
      setDraft(Object.fromEntries(fresh.students.map(student => [student.student_id, student.status])))
      setSuccess(`Đã lưu điểm danh ${fresh.students.length} học viên. ${fresh.changed} trạng thái được cập nhật.`)
    } catch (err) {
      const message = explain(err)
      setError(message)
      if (err instanceof AttendanceError && err.status === 403) setResult(current => current?.data ? { ...current, data: { ...current.data, can_edit: false, read_only_reason: message } } : current)
    }
    finally { saving.current = false; setBusy(false) }
  }
  const update = (id: number, status: AttendanceStatus) => { setDraft(value => ({ ...value, [id]: status })); setSuccess('') }
  const filtered = data?.students.filter(student => `${student.student_name} ${student.student_code}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))) || []
  return <div className="attendance-editor">
    <div className="attendance-editor-nav"><button disabled={busy} onClick={() => leave('back')}>← Buổi học</button><button disabled={busy || loading} onClick={() => leave('reload')}>Tải lại</button></div>
    {discard && <div className="attendance-warning" role="alert"><p>Bạn còn thay đổi chưa lưu. Bỏ thay đổi để {discard === 'back' ? 'quay lại danh sách' : 'tải dữ liệu mới'}?</p><div className="attendance-actions"><button onClick={() => setDiscard(null)}>Tiếp tục chỉnh</button><button onClick={() => { if (discard === 'back') onBack(); else refresh() }}>Bỏ thay đổi</button></div></div>}
    {loading && <p role="status">Đang tải danh sách học viên…</p>}
    {!loading && result?.error && <p className="attendance-error" role="alert">{result.error} <button onClick={refresh}>Thử lại</button></p>}
    {data && <>
      <header className="attendance-session-header"><span className="attendance-eyebrow">{data.subject_name}</span><h2>{data.class_name}</h2><p>{data.topic}</p><p>{data.room_name || 'Chưa xếp phòng'}{safeMeetingUrl(data.meeting_url) && <> · <a href={safeMeetingUrl(data.meeting_url)} target="_blank" rel="noopener noreferrer">Mở phòng trực tuyến ↗</a></>}</p>{data.capacity_warning && <p className="room-warning">⚠ {data.capacity_warning}</p>}<p><strong>{data.start_time} · {attendanceDate(data.session_date)}</strong> · Giờ Việt Nam</p>
        <small>{data.saved_at ? `Đã lưu bởi ${data.saved_by_name} lúc ${attendanceTime(data.saved_at)}` : 'Buổi học chưa được điểm danh'}</small>
      </header>
      {!data.can_edit && <p className="attendance-warning" role="status">{data.read_only_reason}</p>}
      {error && <div className="attendance-error" role="alert"><p>{error}</p><p>Các lựa chọn của bạn vẫn được giữ. Có thể thử lưu lại hoặc tải dữ liệu mới.</p><button disabled={busy} onClick={() => leave('reload')}>Tải dữ liệu mới</button></div>}
      {success && <p className="attendance-success" role="status">{success}</p>}
      {!total ? <p className="attendance-empty">Không có học viên đang học trong buổi này. Quản lý đào tạo có thể kiểm tra danh sách lớp và các quyết định học tập.</p> : <>
        <div className="attendance-quick-actions"><button className="attendance-primary" disabled={busy || !data.can_edit} onClick={() => { setDraft(Object.fromEntries(data.students.map(student => [student.student_id, student.approved_absence ? 'excused_absence' : 'present']))); setSuccess('') }}>Tất cả có mặt ({total})</button><p>Đánh dấu cả lớp, rồi chỉnh các trường hợp ngoại lệ.</p></div>
        <div className="attendance-summary" aria-label="Tổng hợp điểm danh">{Object.entries(attendanceStatuses).map(([status, label]) => <span key={status} className={`attendance-count ${status}`}><b>{data.students.filter(student => draft[student.student_id] === status).length}</b> {label}</span>)}</div>
        <label className="attendance-search">Tìm học viên<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc mã học viên" /></label>
        <p className="attendance-progress" aria-live="polite">{marked}/{total} đã chọn · {total - marked} chưa điểm danh{dirty ? ' · Chưa lưu thay đổi' : ''}</p>
        {!filtered.length && <p>Không có học viên phù hợp.</p>}
        <div className="attendance-students">{filtered.map(student => <article className="attendance-student" key={student.student_id} data-student-id={student.student_id}>
          <div className="attendance-student-name"><h3>{student.student_name}</h3><span>{student.student_code}</span>{student.approved_absence && <small>Đã duyệt xin vắng · Vắng có phép</small>}</div>
          <fieldset disabled={busy || !data.can_edit || student.approved_absence} className="attendance-status-options"><legend className="attendance-sr-only">Điểm danh {student.student_name}</legend>
            {Object.entries(attendanceStatuses).map(([status, label]) => <label key={status} className={`attendance-status ${status}${draft[student.student_id] === status ? ' is-selected' : ''}`}>
              <input type="radio" name={`attendance-${student.student_id}`} value={status} checked={draft[student.student_id] === status} onChange={() => update(student.student_id, status as AttendanceStatus)} /><span>{label}</span>
            </label>)}
          </fieldset>
        </article>)}</div>
        <div className="attendance-save-bar"><div><strong>{marked}/{total} học viên</strong><small>{dirty ? 'Có thay đổi chưa lưu' : data.absence_prefilled ? 'Cần xác nhận điểm danh cả buổi' : data.version ? 'Đã lưu điểm danh' : 'Chọn trạng thái để lưu'}</small></div><button className="attendance-primary" disabled={busy || !data.can_edit || (!dirty && !data.absence_prefilled) || marked !== total} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu điểm danh'}</button></div>
      </>}
      {!!data.archived_students?.length && <details className="attendance-history-panel"><summary>Dữ liệu đã lưu trước điều chỉnh hồ sơ ({data.archived_students.length})</summary><div className="attendance-history"><p>Các bản ghi được giữ để tra cứu, không thuộc danh sách cần điểm danh của buổi này.</p><ul>{data.archived_students.map(student => <li key={student.student_id}><strong>{student.student_name}</strong> · {student.student_code}<p>{student.status ? attendanceStatuses[student.status] : 'Chưa điểm danh'}</p></li>)}</ul></div></details>}
      <details className="attendance-history-panel" onToggle={event => setShowHistory(event.currentTarget.open)}><summary>Nhật ký điểm danh</summary>{showHistory && <AttendanceHistory key={data.version} sessionId={sessionId} version={data.version} explain={explain} />}</details>
    </>}
  </div>
}
