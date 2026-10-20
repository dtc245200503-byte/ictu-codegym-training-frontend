import type { AttendanceRisk } from '../services/attendanceRiskService'
import './AttendanceRisk.css'

export default function AttendanceRiskBadges({ flags, showStudent = false }: { flags?: AttendanceRisk[]; showStudent?: boolean }) {
  if (!flags?.length) return null
  return <div className="attendance-risk-flags" aria-label="Cảnh báo vắng vượt ngưỡng">{flags.map(flag => <div className="attendance-risk-flag" key={`${flag.class_id}:${flag.student_id}`}>
    <strong>⚑ Vắng vượt ngưỡng{showStudent ? ` · ${flag.student_name} (${flag.student_code})` : ''}</strong>
    <span>{flag.class_name}: {flag.absent_sessions}/{flag.scheduled_sessions} buổi ({flag.absence_rate.toLocaleString('vi-VN')}%) · Ngưỡng {flag.threshold_percent.toLocaleString('vi-VN')}%</span>
  </div>)}</div>
}
