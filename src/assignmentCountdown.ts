export type AssignmentCountdown = { state: 'none' | 'invalid' | 'due' | 'overdue' | 'remaining'; label: string }

export function assignmentCountdown(dueAt: string | null, nowMs: number): AssignmentCountdown {
  if (!dueAt) return { state: 'none', label: 'Chưa đặt hạn nộp' }
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(dueAt)
  const deadlineMs = new Date(hasTimezone ? dueAt : `${dueAt}+07:00`).getTime()
  if (!Number.isFinite(deadlineMs)) return { state: 'invalid', label: 'Không xác định được hạn nộp' }
  const remainingMs = deadlineMs - nowMs
  if (remainingMs < 0) return { state: 'overdue', label: 'Đã quá hạn' }
  if (remainingMs === 0) return { state: 'due', label: 'Đến hạn' }

  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const days = Math.floor(totalMinutes / 1_440)
  const hours = Math.floor((totalMinutes % 1_440) / 60)
  const minutes = totalMinutes % 60
  const parts = [days ? `${days} ngày` : '', hours ? `${hours} giờ` : '', minutes ? `${minutes} phút` : ''].filter(Boolean)
  return { state: 'remaining', label: `Còn ${parts.join(' ')}` }
}
