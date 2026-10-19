import { refreshAccessToken } from './authService'
import type { CurrentUser } from '../types/auth'

const API_URL = `${window.location.protocol}//${window.location.hostname}:8000/api/attendance-summary`
export const canViewAttendanceSummary = (user: CurrentUser) => user.permissions.includes('ATTENDANCE_VIEW') && user.roles.some(role => ['INSTRUCTOR', 'TEACHER', 'TRAINING_MANAGER', 'MANAGER', 'ADMIN'].includes(role))
export const summaryStates = {
  present: { label: 'Có mặt', short: 'CM' }, late: { label: 'Đi muộn', short: 'M' },
  excused_absence: { label: 'Vắng có phép', short: 'CP' }, unexcused_absence: { label: 'Vắng không phép', short: 'KP' },
  unmarked: { label: 'Chưa điểm danh', short: '?' }, not_enrolled: { label: 'Không thuộc lớp tại ngày học', short: '—' },
  upcoming: { label: 'Buổi tương lai', short: 'Sắp' }, cancelled: { label: 'Buổi đã huỷ', short: 'Huỷ' },
} as const
export type SummaryState = keyof typeof summaryStates
export type SummarySort = 'name' | 'rate_asc'
export interface SummaryClass { class_id: number; class_name: string }
export interface SummarySession { session_id: number; session_date: string; start_time: string; subject_name: string; topic: string; status: string; upcoming: boolean }
export interface SummaryStudent {
  student_id: number; student_name: string; student_code: string; membership: 'active' | 'former' | 'upcoming' | 'historical'
  cells: SummaryState[]; recorded_sessions: number; attended_sessions: number; absent_sessions: number
  excused_absences: number; unexcused_absences: number; attendance_rate: number | null
}
export interface AttendanceSummary extends SummaryClass {
  today: string; sort: SummarySort; students: SummaryStudent[]; sessions: SummarySession[]; total: number; page: number; page_size: number
}
export class SummaryError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
async function request<T>(path: string): Promise<T> {
  let token = localStorage.getItem('access_token')
  const refresh = async () => {
    try { token = (await refreshAccessToken()).access_token }
    catch { throw new SummaryError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401) }
  }
  if (!token) await refresh()
  const send = () => fetch(API_URL + path, { headers: { Authorization: `Bearer ${token}` } })
  let response = await send()
  if (response.status === 401) { await refresh(); response = await send() }
  if ([401, 423].includes(response.status)) throw new SummaryError('Phiên đăng nhập không còn hiệu lực.', 401)
  const data = await response.json()
  if (!response.ok) throw new SummaryError(typeof data.detail === 'string' ? data.detail : 'Không thể tải bảng chuyên cần. Vui lòng thử lại.', response.status)
  return data
}
export const getSummaryClasses = () => request<{ items: SummaryClass[] }>('/classes')
export const getAttendanceSummary = (classId: string, sort: SummarySort, page: number) => request<AttendanceSummary>(`/classes/${encodeURIComponent(classId)}?${new URLSearchParams({ sort, page: String(page), page_size: '50' })}`)
