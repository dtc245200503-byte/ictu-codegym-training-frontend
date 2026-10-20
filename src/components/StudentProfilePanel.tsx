import AttendanceRiskBadges from './AttendanceRiskBadges'
import StudentProfileEditor from './StudentProfileEditor'
import { useEffect, useEffectEvent, useState } from 'react'
import { enrollmentActions, enrollmentStatuses, getStudentAttendanceHistory, getStudentProfile, getStudentProfileHistory, studentDate, studentTime } from '../services/studentProfileService'
import type { Enrollment, EnrollmentHistory, StudentAttendance, StudentClassOption, StudentProfile } from '../services/studentProfileService'
import EnrollmentChangeDialog from './EnrollmentChangeDialog'

const attendanceLabels: Record<string, string> = { present: 'Có mặt', late: 'Đi muộn', excused_absence: 'Vắng có phép', unexcused_absence: 'Vắng không phép' }
export default function StudentProfilePanel({ id, classes, explain, onBack }: { id: number; classes: StudentClassOption[]; explain: (error: unknown) => string; onBack: () => void }) {
  const [editing, setEditing] = useState(false)
  const [page, setPage] = useState(1)
  const [attendancePage, setAttendancePage] = useState(1)
  const [reload, setReload] = useState(0)
  const key = `${page}:${attendancePage}:${reload}`
  const [result, setResult] = useState<{ key: string; student?: StudentProfile; history?: { items: EnrollmentHistory[]; total: number }; attendance?: { items: StudentAttendance[]; total: number }; error?: string }>()
  const [selected, setSelected] = useState<Enrollment | null>(null)
  const [success, setSuccess] = useState('')
  const explainLoad = useEffectEvent(explain)
  useEffect(() => {
    let active = true
    Promise.all([getStudentProfile(id), getStudentProfileHistory(id, page), getStudentAttendanceHistory(id, attendancePage)])
      .then(([student, history, attendance]) => { if (active) setResult({ key, student, history, attendance }) })
      .catch((error: unknown) => { if (active) setResult({ key, error: explainLoad(error) }) })
    return () => { active = false }
  }, [id, page, attendancePage, key])
  const loading = result?.key !== key
  const student = !loading ? result?.student : undefined
  return <div className="student-profile">
    <div className="student-profile-nav"><button onClick={onBack}>← Danh sách học viên</button><button disabled={loading} onClick={() => { setSuccess(''); setReload(value => value + 1) }}>Tải lại hồ sơ</button></div>
    {loading && <p role="status">Đang tải hồ sơ…</p>}
    {!loading && result?.error && <p className="student-error" role="alert">{result.error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
    {success && <p className="student-success" role="status">{success}</p>}
    {student && <>
      <header className="student-profile-header"><h2>{student.student_name}</h2><p>Mã học viên: {student.student_code}</p><small>Trạng thái tại ngày {studentDate(student.today)} · Giờ Việt Nam</small></header>
      <AttendanceRiskBadges flags={student.attendance_risks} />
      <section className="student-personal-info" aria-labelledby="student-personal-title">
        <h3 id="student-personal-title">Thông tin cá nhân và đầu vào</h3>
        <dl><dt>Email</dt><dd>{student.email || 'Chưa cập nhật'}</dd><dt>Số điện thoại</dt><dd>{student.phone || 'Chưa cập nhật'}</dd><dt>Ngày sinh</dt><dd>{student.date_of_birth ? studentDate(student.date_of_birth) : 'Chưa cập nhật'}</dd><dt>Địa chỉ</dt><dd>{student.address || 'Chưa cập nhật'}</dd><dt>Trình độ đầu vào</dt><dd>{student.entry_level || 'Chưa cập nhật'}</dd><dt>Ghi chú</dt><dd>{student.notes || 'Chưa có ghi chú'}</dd></dl>
        {student.updated_at && <p>Cập nhật bởi {student.updated_by_name} · {studentTime(student.updated_at)}</p>}
        <button className="student-primary" onClick={() => setEditing(true)}>Sửa thông tin học viên</button>
      </section>
      {student.admission && <section className="student-history" aria-label="Thông tin nhập học">
        <h3>Nhập học từ lead #{student.admission.lead_id}</h3>
        <p>Nguồn khách: {student.admission.source}</p><p>Chương trình quan tâm: {student.admission.interest || 'Chưa xác định'}</p>
        <p className="student-history-reason">Nhu cầu tư vấn: {student.admission.message || 'Chưa có nội dung'}</p>
        <small>{student.admission.actor_name} · Tạo hồ sơ lúc {studentTime(student.admission.created_at)}</small>
      </section>}
      <h3>Quá trình học theo lớp</h3>
      {!student.enrollments.length && <p>Học viên chưa có lớp học.</p>}
      {(['current', 'upcoming', 'history'] as const).map(group => {
        const entries = student.enrollments.filter(enrollment => (enrollment.group || (enrollment.status === 'active' ? 'current' : enrollment.status === 'upcoming' ? 'upcoming' : 'history')) === group)
        return <section key={group} aria-label={group === 'current' ? 'Lớp đang học' : group === 'upcoming' ? 'Lớp sắp học' : 'Lịch sử các lớp đã học'}>
        <h3>{group === 'current' ? 'Lớp đang học' : group === 'upcoming' ? 'Lớp sắp học' : 'Lịch sử các lớp đã học'} ({entries.length})</h3>
        {!entries.length && <p>Chưa có lớp trong mục này.</p>}
        <div className="student-enrollments">{entries.map(enrollment => <article key={enrollment.enrollment_id ?? `legacy-${enrollment.class_id}`} className="student-enrollment">
        <div><h4>{enrollment.class_name}</h4><span className={`student-status ${enrollment.status}`}>{enrollmentStatuses[enrollment.display_status || enrollment.status] || enrollment.status}</span></div>
        <p>Bắt đầu: {studentDate(enrollment.started_on)}</p>
        {enrollment.registration && <p>Ghi danh ngày {studentDate(enrollment.registration.enrolled_on)} bởi {enrollment.registration.actor_name} · {studentTime(enrollment.registration.created_at)}</p>}
        {enrollment.ended_on && <p>{enrollment.ended_on > student.today ? 'Đã lên lịch: ' : ''}{enrollmentActions[enrollment.end_status!]} từ {studentDate(enrollment.ended_on)}</p>}
        {enrollment.can_change && <button className="student-primary" onClick={() => setSelected(enrollment)}>Bảo lưu / Chuyển lớp / Thôi học</button>}
      </article>)}</div></section>
      })}
      <section className="student-history" aria-labelledby="student-history-title"><h3 id="student-history-title">Lịch sử hồ sơ học viên</h3><p>{result?.history?.total || 0} thao tác · Lưu cả quyết định có hiệu lực trong tương lai</p>
        {!result?.history?.items.length && <p>Chưa có thao tác bảo lưu, chuyển lớp hoặc thôi học.</p>}
        <ol>{result?.history?.items.map(item => <li key={item.history_id}>
          <strong>{enrollmentActions[item.operation]} · Hiệu lực {studentDate(item.effective_date)}</strong>
          <p>{item.from_class_name}{item.to_class_name ? ` → ${item.to_class_name}` : ''}</p>
          <p className="student-history-reason">Lý do: {item.reason}</p>
          <small>{item.actor_name} · Ghi nhận lúc {studentTime(item.created_at)}</small>
        </li>)}</ol>
        <div className="student-pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page}/{Math.max(1, Math.ceil((result?.history?.total || 0) / 20))}</span><button disabled={page * 20 >= (result?.history?.total || 0)} onClick={() => setPage(value => value + 1)}>Sau</button></div>
      </section>
      <section className="student-attendance-history"><h3>Điểm danh đã lưu ở các lớp</h3><p>Các bản ghi giữ nguyên lớp và buổi học gốc, kể cả sau khi chuyển lớp.</p>
        {!result?.attendance?.items.length && <p>Chưa có điểm danh đã lưu.</p>}
        <ul>{result?.attendance?.items.map(item => <li key={item.session_id}><strong>{item.class_name} · {studentDate(item.session_date)}</strong><p>{item.topic} · {attendanceLabels[item.status] || item.status}</p></li>)}</ul>
        <div className="student-pagination"><button disabled={attendancePage === 1} onClick={() => setAttendancePage(value => value - 1)}>Trước</button><span>Trang {attendancePage}/{Math.max(1, Math.ceil((result?.attendance?.total || 0) / 20))}</span><button disabled={attendancePage * 20 >= (result?.attendance?.total || 0)} onClick={() => setAttendancePage(value => value + 1)}>Sau</button></div>
      </section>
      {editing && <StudentProfileEditor student={student} explain={explain} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setReload(value => value + 1); setSuccess('Đã cập nhật hồ sơ học viên.') }} />}
      {selected && <EnrollmentChangeDialog student={student} enrollment={selected} classes={classes} explain={explain} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); setPage(1); setReload(value => value + 1); setSuccess('Đã ghi nhận thao tác và cập nhật danh sách theo ngày hiệu lực.') }} />}
    </>}
  </div>
}
