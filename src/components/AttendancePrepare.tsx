import RoomPicker from './RoomPicker'
import ScheduleConflictNotice from './ScheduleConflictNotice'
import { ScheduleConflictError } from '../services/scheduleConflict'
import type { ConflictDetails } from '../services/scheduleConflict'
import { useRef, useState } from 'react'
import { createAttendanceSession, getAttendanceRoomCapacity, enrollAttendanceStudents, findAttendanceStudents } from '../services/attendanceService'
import type { AttendanceOptions, AttendanceStudent } from '../services/attendanceService'

export default function AttendancePrepare({ options, explain, onCreated }: { options: AttendanceOptions; explain: (error: unknown) => string; onCreated: (date: string) => void }) {
  const [subjectId, setSubjectId] = useState('')
  const [date, setDate] = useState(options.today)
  const [time, setTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:30')
  const [room, setRoom] = useState('')
  const [capacityRevision, setCapacityRevision] = useState(0)
  const [topic, setTopic] = useState('')
  const [query, setQuery] = useState('')
  const [students, setStudents] = useState<Omit<AttendanceStudent, 'status'>[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [ids, setIds] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [conflict, setConflict] = useState<ConflictDetails>()
  const [acknowledged, setAcknowledged] = useState(false)
  const clearConflict = () => { setConflict(undefined); setAcknowledged(false) }
  const subject = options.subjects.find(item => String(item.class_subject_id) === subjectId)
  const perform = async (action: () => Promise<void>) => {
    if (working.current) return
    working.current = true; setBusy(true); setError(''); setSuccess('')
    try { await action() } catch (err) {
      if (err instanceof ScheduleConflictError) { setConflict(err.details); setAcknowledged(false) }
      else setError(explain(err))
    }
    finally { working.current = false; setBusy(false) }
  }
  return <details className="attendance-prepare"><summary>Chuẩn bị buổi học · Quản lý đào tạo</summary>
    <div className="attendance-prepare-body">
      <label>Lớp / môn học<select value={subjectId} disabled={busy} onChange={event => { setSubjectId(event.target.value); clearConflict(); setSuccess(''); setError('') }}><option value="">Chọn lớp và môn</option>{options.subjects.map(item => <option key={item.class_subject_id} value={item.class_subject_id}>{item.class_name} · {item.subject_name}</option>)}</select></label>
      {!options.subjects.length && <p>Chưa có môn học trong lớp. Hãy thiết lập lớp và phân công giảng dạy trước.</p>}
      {error && <p className="attendance-error" role="alert">{error}</p>}
      {success && <p className="attendance-success" role="status">{success}</p>}
      {options.can_enroll !== false && <section><h3>1. Bổ sung học viên vào lớp</h3><p>Học viên đã ở trong lớp hoặc vượt sĩ số sẽ bị chặn; cả nhóm chỉ được lưu khi hợp lệ. Học viên bổ sung có hiệu lực từ hôm nay; danh sách của buổi đã lưu không thay đổi.</p>
        <form onSubmit={event => { event.preventDefault(); void perform(async () => { const result = await findAttendanceStudents(query.trim()); setStudents(result.items); setTotal(result.total); setIds([]) }) }}>
          <label>Tìm tài khoản học viên<input disabled={busy} maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên hoặc mã học viên" /></label><button disabled={busy || !subject}>Tìm học viên</button>
        </form>
        {total !== null && <p>{students.length}/{total} học viên{total > 50 ? ' · Nhập tên hoặc mã cụ thể để thu hẹp kết quả.' : ''}</p>}
        <div className="attendance-candidates">{students.map(student => <label key={student.student_id}><input type="checkbox" disabled={busy} checked={ids.includes(student.student_id)} onChange={event => setIds(value => event.target.checked ? [...value, student.student_id] : value.filter(id => id !== student.student_id))} /><span>{student.student_name}<small>{student.student_code}</small></span></label>)}</div>
        <button type="button" disabled={busy || !subject || !ids.length} onClick={() => void perform(async () => { const result = await enrollAttendanceStudents(subject!.class_id, ids); setSuccess(`Đã thêm ${result.added} học viên vào lớp.`); setIds([]); setCapacityRevision(value => value + 1) })}>Thêm {ids.length || ''} học viên đã chọn</button>
      </section>}
      <form className="attendance-create-session" onChange={event => { if (!(event.target as HTMLElement).closest('.schedule-conflict-notice')) clearConflict() }} onSubmit={event => { event.preventDefault(); if (!subject || !topic.trim() || (conflict && (!conflict.can_override || !acknowledged))) return; if (!endTime || endTime <= time) { setError('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày.'); return } void perform(async () => { const created = await createAttendanceSession({ class_subject_id: subject.class_subject_id, session_date: date, start_time: time, end_time: endTime, room_id: room ? Number(room) : null, room_name: null, topic: topic.trim(), ...(conflict?.conflict_token && acknowledged ? { acknowledge_conflicts: true, conflict_token: conflict.conflict_token } : {}) }); clearConflict(); setTopic(''); setSuccess('Đã tạo buổi học. ' + (created.capacity_warning || 'Chọn buổi bên dưới để điểm danh.')); onCreated(date) }) }}>
        <h3>2. Tạo buổi học</h3><div className="attendance-date-time"><label>Ngày học<input type="date" required disabled={busy} value={date} onChange={event => setDate(event.target.value)} /></label><label>Giờ bắt đầu<input type="time" required disabled={busy} value={time} onChange={event => setTime(event.target.value)} /></label></div>
        <div className="attendance-date-time"><label>Giờ kết thúc<input type="time" required disabled={busy} value={endTime} onChange={event => setEndTime(event.target.value)} /></label><RoomPicker key={capacityRevision} rooms={options.rooms || []} value={room} onChange={value => { setRoom(value); clearConflict() }} classId={subject?.class_id} date={date} disabled={busy} explain={explain} getCapacity={getAttendanceRoomCapacity} /></div>
        <label>Nội dung buổi học<input required maxLength={255} disabled={busy} value={topic} onChange={event => setTopic(event.target.value)} placeholder="Ví dụ: Buổi 1 · Giới thiệu Python" /></label>
        {conflict && <ScheduleConflictNotice details={conflict} acknowledged={acknowledged} busy={busy} onAcknowledge={setAcknowledged} />}
        <button className="attendance-primary" disabled={busy || !subject || !topic.trim() || (!!conflict && (!conflict.can_override || !acknowledged))}>Tạo buổi học</button>
      </form>
    </div>
  </details>
}
