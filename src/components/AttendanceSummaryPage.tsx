import { useEffect, useEffectEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAttendanceSummary, getSummaryClasses, SummaryError, summaryStates } from '../services/attendanceSummaryService'
import type { AttendanceSummary, SummaryClass, SummarySort } from '../services/attendanceSummaryService'
import './AttendanceSummaryPage.css'

const memberships = { active: 'Đang học', former: 'Đã rời lớp / bảo lưu', upcoming: 'Chưa vào lớp', historical: 'Hồ sơ lịch sử' }
const displayDate = (value: string) => value.split('-').reverse().join('/')
export default function AttendanceSummaryPage({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [params, setParams] = useSearchParams()
  const classId = /^[1-9]\d*$/.test(params.get('class_id') || '') ? params.get('class_id')! : ''
  const [classes, setClasses] = useState<SummaryClass[]>(), [optionsError, setOptionsError] = useState(''), [optionsRetry, setOptionsRetry] = useState(0)
  const [sort, setSort] = useState<SummarySort>('name'), [page, setPage] = useState(1), [reload, setReload] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: AttendanceSummary; error?: string }>()
  const key = JSON.stringify([classId, sort, page, reload])
  const explain = useEffectEvent((error: unknown) => {
    if (error instanceof SummaryError && error.status === 401) onSessionExpired()
    return error instanceof Error && !(error instanceof TypeError) ? error.message : 'Không thể kết nối đến hệ thống. Vui lòng thử lại.'
  })
  useEffect(() => {
    let active = true
    getSummaryClasses().then(data => { if (active) { setClasses(data.items); setOptionsError('') } }).catch(error => { if (active) setOptionsError(explain(error)) })
    return () => { active = false }
  }, [optionsRetry])
  useEffect(() => {
    if (!classId) return
    let active = true
    getAttendanceSummary(classId, sort, page).then(data => {
      if (active) { if (data.page !== page) setPage(data.page); else setResult({ key, data }) }
    }).catch(error => { if (active) setResult({ key, error: explain(error) }) })
    return () => { active = false }
  }, [classId, sort, page, key])
  const loading = !!classId && result?.key !== key
  const data = !loading && classId ? result?.data : undefined
  const error = !loading && classId ? result?.error : undefined
  return <section className="attendance-summary-page" aria-labelledby="attendance-summary-title">
    <header><span className="summary-eyebrow">THEO DÕI LỚP HỌC</span><h1 id="attendance-summary-title">Bảng chuyên cần</h1><p>Xem quá trình tham gia từng buổi và đưa học viên có tỷ lệ chuyên cần thấp lên đầu danh sách.</p></header>
    <div className="summary-filters">
      <label>Lớp học<select aria-label="Lớp học" value={classId} disabled={!classes || !!optionsError} onChange={event => { setParams(event.target.value ? { class_id: event.target.value } : {}); setPage(1) }}><option value="">Chọn lớp học</option>{classes?.map(item => <option key={item.class_id} value={item.class_id}>{item.class_name}</option>)}{classId && !classes?.some(item => String(item.class_id) === classId) && <option value={classId}>Lớp #{classId}</option>}</select></label>
      <label>Sắp xếp<select aria-label="Sắp xếp" value={sort} onChange={event => { setSort(event.target.value as SummarySort); setPage(1) }}><option value="name">Tên học viên</option><option value="rate_asc">Tỷ lệ chuyên cần tăng dần</option></select></label>
      <button type="button" disabled={!classId || loading} onClick={() => setReload(value => value + 1)}>Làm mới</button>
    </div>
    {optionsError && <p role="alert" className="summary-error">{optionsError} <button onClick={() => setOptionsRetry(value => value + 1)}>Tải lại lớp</button></p>}
    {!classes && !optionsError && <p role="status">Đang tải danh sách lớp…</p>}
    {classes?.length === 0 && !optionsError && <p className="summary-empty">Bạn chưa có lớp được phép xem.</p>}
    {!classId && !!classes?.length && <p className="summary-empty">Chọn một lớp để xem ma trận học viên theo buổi.</p>}
    <details className="summary-method"><summary>Cách tính và chú giải</summary><p>Tỷ lệ chuyên cần = (Có mặt + Đi muộn) / số buổi có kết quả điểm danh × 100%. Tổng vắng gồm cả vắng có phép và không phép. Bỏ qua buổi huỷ, tương lai, chưa điểm danh và thời gian không thuộc lớp. Học viên chưa có kết quả hiển thị “—” và xếp cuối khi sắp theo tỷ lệ.</p><ul className="summary-legend">{Object.entries(summaryStates).map(([state, info]) => <li key={state}><span className={`summary-cell ${state}`}>{info.short}</span>{info.label}</li>)}</ul></details>
    {loading && <p role="status">Đang tải bảng chuyên cần…</p>}
    {error && <p role="alert" className="summary-error">{error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
    {data && <>
      <div className="summary-heading"><h2>{data.class_name}</h2><p>{data.total} học viên · {data.sessions.length} buổi · Tính đến {displayDate(data.today)} (giờ Việt Nam)</p></div>
      {!data.sessions.length && <p className="summary-empty">Lớp chưa có buổi học. Tỷ lệ chuyên cần chưa được tính.</p>}
      {!data.total ? <p className="summary-empty">Lớp chưa có học viên hoặc lịch sử điểm danh.</p> : <>
        <p className="summary-scroll-hint" id="summary-scroll-hint">Cuộn ngang để xem các buổi học. CM: Có mặt · M: Đi muộn · CP/KP: Vắng có phép/không phép. Các ô “?” chưa được tính vào tỷ lệ.</p>
        <div className="summary-table-scroll" tabIndex={0} role="region" aria-label="Ma trận chuyên cần, có thể cuộn ngang" aria-describedby="summary-scroll-hint">
          <table className="summary-matrix"><caption>Chuyên cần lớp {data.class_name} · trang {data.page}</caption><thead><tr>
            <th scope="col" className="summary-student-column">Học viên</th><th scope="col">Tổng vắng</th><th scope="col" aria-sort={sort === 'rate_asc' ? 'ascending' : 'none'}><button onClick={() => { setSort('rate_asc'); setPage(1) }}>Chuyên cần {sort === 'rate_asc' ? '↑' : '↕'}</button></th>
            {data.sessions.map((session, index) => <th scope="col" key={session.session_id} title={`${session.subject_name} · ${session.topic}`}><span>Buổi {index + 1}</span><strong>{displayDate(session.session_date)}</strong><span>{session.start_time}</span><small>{session.subject_name}</small><small>{session.topic}</small>{session.status === 'cancelled' ? <small>Đã huỷ</small> : session.upcoming && <small>Chưa đến ngày</small>}</th>)}
          </tr></thead><tbody>{data.students.map(student => <tr key={student.student_id} data-student-id={student.student_id}>
            <th scope="row" className="summary-student-column"><strong>{student.student_name}</strong><span>{student.student_code}</span><small>{memberships[student.membership]}</small></th>
            <td className="summary-total"><strong>{student.absent_sessions}</strong><small>{student.excused_absences} CP · {student.unexcused_absences} KP</small></td>
            <td className="summary-rate">{student.attendance_rate === null ? <><strong>—</strong><small>Chưa có kết quả</small></> : <><strong>{student.attendance_rate.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%</strong><progress value={student.attendance_rate} max={100} aria-label={`Tỷ lệ chuyên cần ${student.student_name}`} /><small>{student.attended_sessions}/{student.recorded_sessions} buổi</small></>}</td>
            {student.cells.map((state, index) => <td key={data.sessions[index].session_id}><span className={`summary-cell ${state}`} title={summaryStates[state].label} aria-label={`${student.student_name}, buổi ${index + 1}: ${summaryStates[state].label}`}>{summaryStates[state].short}</span></td>)}
          </tr>)}</tbody></table>
        </div>
        <nav className="summary-pagination" aria-label="Phân trang học viên"><button disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Trang trước</button><span>Trang {data.page}/{Math.max(1, Math.ceil(data.total / data.page_size))}</span><button disabled={data.page * data.page_size >= data.total} onClick={() => setPage(data.page + 1)}>Trang sau</button></nav>
      </>}
    </>}
  </section>
}
