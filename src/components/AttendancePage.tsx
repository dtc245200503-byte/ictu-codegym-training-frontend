import { useEffect, useEffectEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AttendanceError, attendanceDate, getAttendanceOptions, listAttendanceSessions } from '../services/attendanceService'
import type { AttendanceOptions, AttendanceSession } from '../services/attendanceService'
import AttendanceEditor from './AttendanceEditor'
import AttendancePrepare from './AttendancePrepare'
import './AttendancePage.css'

export default function AttendancePage({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [params] = useSearchParams()
  const [date, setDate] = useState('')
  const [classId, setClassId] = useState(() => /^[1-9]\d*$/.test(params.get('class_id') || '') ? params.get('class_id')! : '')
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [options, setOptions] = useState<AttendanceOptions>()
  const [optionsError, setOptionsError] = useState('')
  const [optionsRetry, setOptionsRetry] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const key = JSON.stringify([date, classId, page, reload])
  const [result, setResult] = useState<{ key: string; items?: AttendanceSession[]; total?: number; today?: string; error?: string }>()
  const explain = (error: unknown) => {
    if (error instanceof AttendanceError && error.status === 401) onSessionExpired()
    return error instanceof Error && !(error instanceof TypeError) ? error.message : 'Không thể kết nối. Vui lòng thử lại.'
  }
  const explainLoad = useEffectEvent(explain)
  useEffect(() => {
    let active = true
    getAttendanceOptions().then(data => { if (active) { setOptions(data); setOptionsError('') } })
      .catch((err: unknown) => { if (active) setOptionsError(explainLoad(err)) })
    return () => { active = false }
  }, [optionsRetry])
  useEffect(() => {
    if (selected !== null) return
    let active = true
    listAttendanceSessions(date, classId, page).then(data => { if (active) setResult({ key, ...data }) })
      .catch((err: unknown) => { if (active) setResult({ key, error: explainLoad(err) }) })
    return () => { active = false }
  }, [date, classId, page, key, selected])
  const classes = [...new Map(options?.subjects.map(subject => [subject.class_id, { id: subject.class_id, name: subject.class_name }]) || []).values()]
  const loading = result?.key !== key
  const today = result?.today || options?.today || ''
  return <section className="attendance-page" aria-labelledby="attendance-title">
    <header className="attendance-page-header"><div><span className="attendance-eyebrow">LỚP HỌC</span><h1 id="attendance-title">Điểm danh</h1><p>Chọn buổi học, đánh dấu cả lớp và chỉnh vài ngoại lệ.</p></div></header>
    {selected !== null ? <AttendanceEditor key={selected} sessionId={selected} explain={explain} onBack={() => { setSelected(null); setReload(value => value + 1) }} /> : <>
      {optionsError && <p className="attendance-error" role="alert">{optionsError} <button onClick={() => setOptionsRetry(value => value + 1)}>Tải lại bộ lọc</button></p>}
      {options?.can_prepare && <AttendancePrepare options={options} explain={explain} onCreated={value => { setDate(value); setClassId(''); setPage(1); setReload(value => value + 1) }} />}
      <div className="attendance-filters"><label>Ngày học<input aria-label="Ngày học" type="date" value={date || today} onChange={event => { setDate(event.target.value); setPage(1) }} /></label><label>Lớp học<select aria-label="Lớp học" value={classId} onChange={event => { setClassId(event.target.value); setPage(1) }}><option value="">Tất cả lớp được phép xem</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{classId && !classes.some(item => String(item.id) === classId) && <option value={classId}>Lớp đã chọn #{classId}</option>}</select></label><button onClick={() => { setDate(''); setPage(1); setReload(value => value + 1) }}>Hôm nay</button></div>
      <p className="attendance-date-hint">Ngày học theo giờ Việt Nam. Giảng viên chỉ điểm danh buổi hôm nay; Quản lý đào tạo được sửa buổi quá khứ.</p>
      {loading && <p role="status">Đang tải buổi học…</p>}
      {!loading && result?.error && <p className="attendance-error" role="alert">{result.error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
      {!loading && result?.items && <>
        <h2 className="attendance-list-title">{result.total} buổi học · {attendanceDate(date || today)}</h2>
        {!result.items.length && <p className="attendance-empty">Không có buổi học phù hợp. Nếu chưa có lịch, hãy liên hệ Quản lý đào tạo.</p>}
        <div className="attendance-session-list">{result.items.map(session => <article className="attendance-session-card" key={session.session_id}><div className="attendance-session-time"><strong>{session.start_time}</strong><span className={session.version ? 'is-saved' : ''}>{session.version ? 'Đã điểm danh' : 'Chưa điểm danh'}</span></div><h3>{session.class_name}</h3><p>{session.subject_name} · {session.topic}</p>{!session.can_edit && <small>{session.read_only_reason}</small>}<button className={session.can_edit ? 'attendance-primary' : ''} onClick={() => setSelected(session.session_id)}>{session.can_edit ? session.version ? 'Xem / sửa điểm danh' : 'Điểm danh ngay' : 'Xem điểm danh'}</button></article>)}</div>
        <div className="attendance-pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page}/{Math.max(1, Math.ceil((result.total || 0) / 30))}</span><button disabled={page * 30 >= (result.total || 0)} onClick={() => setPage(value => value + 1)}>Sau</button></div>
      </>}
    </>}
  </section>
}
