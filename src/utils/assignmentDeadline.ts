import type { AssignmentProgress } from '../services/assignmentService'

export function assignmentDeadline(dueAt: string, status: AssignmentProgress, now: number, urgentHours = 24) {
  const milliseconds = Date.parse(dueAt) - now
  if (!Number.isFinite(milliseconds)) return { text: 'Chưa xác định hạn nộp', urgency: 'normal' }
  const actionRequired = status === 'not_submitted' || status === 'needs_revision'
  const duration = (amount: number) => {
    const minutes = Math.max(1, Math.ceil(amount / 60000))
    if (minutes < 60) return `${minutes} phút`
    const hours = Math.floor(minutes / 60), rest = minutes % 60
    if (hours < 24) return `${hours} giờ${rest ? ` ${rest} phút` : ''}`
    const days = Math.floor(hours / 24), remainingHours = hours % 24
    return `${days} ngày${remainingHours ? ` ${remainingHours} giờ` : ''}`
  }
  if (milliseconds <= 0) return {
    text: actionRequired ? milliseconds > -60000 ? 'Đã đến hạn nộp' : `Quá hạn ${duration(-milliseconds)}` : 'Hạn nộp đã qua',
    urgency: actionRequired ? 'overdue' : 'normal',
  }
  return { text: milliseconds < 60000 ? 'Còn dưới 1 phút' : `Còn ${duration(milliseconds)}`,
    urgency: actionRequired && milliseconds <= urgentHours * 3600000 ? 'due_soon' : 'normal' }
}
