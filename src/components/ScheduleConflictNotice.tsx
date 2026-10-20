import type { ConflictDetails, ConflictSession } from '../services/scheduleConflict'
import './ScheduleConflictNotice.css'

const reasons: Record<string, string> = { instructor: 'Trùng giảng viên / trợ giảng', room: 'Trùng phòng', class: 'Trùng lịch lớp' }
function SessionInfo({ item, proposed }: { item: ConflictSession; proposed: boolean }) {
  return <div className="schedule-conflict-session"><strong>{proposed ? 'Buổi đang xếp' : 'Buổi xung đột'}{item.session_id ? ` #${item.session_id}` : item.number ? ` ${item.number}` : ''} · {item.class_name}</strong>
    <span>{item.session_date.split('-').reverse().join('/')} · {item.start_time}–{item.end_time || 'Chưa có giờ kết thúc'}</span>
    <span>{item.subject_name} · {item.topic}</span><span>Phòng: {item.room_name || 'Chưa xếp'} · Giảng dạy: {item.staff.map(row => row.name).join(', ') || 'Chưa phân công'}</span>
  </div>
}
export default function ScheduleConflictNotice({ details, acknowledged, onAcknowledge, busy }: {
  details: ConflictDetails; acknowledged: boolean; onAcknowledge: (value: boolean) => void; busy: boolean
}) {
  return <section className="schedule-conflict-notice" aria-label="Xung đột lịch học">
    <p role="alert"><strong>Phát hiện {details.conflicts.length} cặp buổi trùng lịch. Chưa lưu thay đổi.</strong></p>
    <ol>{details.conflicts.map((conflict, index) => <li key={index}>
      <h4>{conflict.reasons.map(reason => reasons[reason] || reason).join(' · ')}</h4>
      {!!conflict.instructors.length && <p>Người bị trùng: {conflict.instructors.map(row => row.name).join(', ')}</p>}
      <div className="schedule-conflict-pair"><SessionInfo item={conflict.candidate} proposed /><SessionInfo item={conflict.existing} proposed={false} /></div>
      {conflict.unknown_duration && <p>Chưa rõ giờ kết thúc: tạm coi buổi kéo dài đến hết ngày để tránh xếp trùng. Hãy bổ sung giờ kết thúc nếu cần.</p>}
    </li>)}</ol>
    {details.can_override ? <label className="schedule-conflict-confirm"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => onAcknowledge(event.target.checked)} /><span>Tôi xác nhận ghi đè và lưu dù có các xung đột trên. Việc xác nhận sẽ được ghi nhật ký; các buổi đang có vẫn được giữ nguyên.</span></label> : <p>Chỉ Quản lý đào tạo được xác nhận ghi đè. Hãy đổi ngày, giờ, phòng hoặc giảng viên.</p>}
  </section>
}
