import AttendanceRiskBadges from './AttendanceRiskBadges'
import { useEffect, useEffectEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { enrollmentStatuses, getStudentClasses, listStudentProfiles, StudentProfileError } from '../services/studentProfileService'
import type { StudentClassOption, StudentProfile } from '../services/studentProfileService'
import StudentProfilePanel from './StudentProfilePanel'
import './StudentManagementPage.css'

export default function StudentManagementPage({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState({ search: '', classId: /^[1-9]\d*$/.test(params.get('class_id') || '') ? params.get('class_id')! : '' })
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const key = JSON.stringify([filter, page, reload])
  const [result, setResult] = useState<{ key: string; items?: StudentProfile[]; total?: number; classes?: StudentClassOption[]; error?: string }>()
  const explain = (error: unknown) => {
    if (error instanceof StudentProfileError && error.status === 401) onSessionExpired()
    return error instanceof Error && !(error instanceof TypeError) ? error.message : 'Không thể kết nối đến hệ thống. Vui lòng thử lại.'
  }
  const explainLoad = useEffectEvent(explain)
  useEffect(() => {
    let active = true
    Promise.all([listStudentProfiles(filter.search, filter.classId, page), getStudentClasses()]).then(([data, classes]) => {
      if (active) setResult({ key, ...data, classes })
    }).catch((error: unknown) => { if (active) setResult({ key, error: explainLoad(error) }) })
    return () => { active = false }
  }, [filter, page, key])
  const loading = result?.key !== key
  return <section className="student-management-page" aria-labelledby="student-management-title">
    <header><h1 id="student-management-title">Hồ sơ học viên</h1><p>Tra cứu thông tin cá nhân, trình độ đầu vào và toàn bộ quá trình học.</p></header>
    {selected !== null ? <StudentProfilePanel key={selected} id={selected} classes={result?.classes || []} explain={explain} onBack={() => { setSelected(null); setReload(value => value + 1) }} /> : <>
      <form className="student-filters" onSubmit={event => { event.preventDefault(); setFilter(value => ({ ...value, search: search.trim() })); setPage(1) }}>
        <label>Tìm học viên<input type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Mã học viên, tên hoặc số điện thoại" /></label>
        <label>Lớp đã tham gia<select value={filter.classId} onChange={event => { setFilter({ search: search.trim(), classId: event.target.value }); setPage(1) }}><option value="">Tất cả lớp</option>{result?.classes?.map(item => <option key={item.class_id} value={item.class_id}>{item.class_name}</option>)}</select></label><button type="submit">Tìm kiếm</button>
      </form>
      {loading && <p role="status">Đang tải học viên…</p>}
      {!loading && result?.error && <p className="student-error" role="alert">{result.error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
      {!loading && result?.items && <><p>{result.total} học viên</p><div className="student-cards">{result.items.map(student => <article key={student.student_id}><h2>{student.student_name}</h2><small>{student.student_code}</small><AttendanceRiskBadges flags={student.attendance_risks} /><p>{student.phone || 'Chưa có số điện thoại'}</p><p>{student.enrollments.length ? student.enrollments.map(item => `${item.class_name}: ${enrollmentStatuses[item.display_status || item.status] || item.status}`).join(' · ') : 'Chưa có lớp'}</p><button onClick={() => setSelected(student.student_id)}>Mở hồ sơ</button></article>)}</div>
        {!result.items.length && <p>Không có học viên phù hợp.</p>}
        <div className="student-pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page}/{Math.max(1, Math.ceil((result.total || 0) / 20))}</span><button disabled={page * 20 >= (result.total || 0)} onClick={() => setPage(value => value + 1)}>Sau</button></div>
      </>}
    </>}
  </section>
}
