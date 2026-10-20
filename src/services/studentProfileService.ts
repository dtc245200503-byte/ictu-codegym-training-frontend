import type { AttendanceRisk } from './attendanceRiskService'
import { refreshAccessToken } from './authService'
export interface LeadConversion {
  lead_id: number; student_id: number; student_code: string; full_name: string; phone: string; email: string
  source: string; interest: string | null; message: string | null; actor_id: number; actor_name: string
  created_at: string; email_status: 'pending' | 'sending' | 'sent' | 'failed'; email_sent_at: string | null
}
const API_URL = `${window.location.protocol}//${window.location.hostname}:8000/api/students`
export const enrollmentActions = { deferred: 'Bảo lưu', transferred: 'Chuyển lớp', withdrawn: 'Thôi học' } as const
export type EnrollmentAction = keyof typeof enrollmentActions
export const enrollmentStatuses: Record<string, string> = { completed: 'Lớp đã kết thúc', cancelled: 'Lớp đã hủy', active: 'Đang học', upcoming: 'Chưa đến ngày học', deferred: 'Bảo lưu', transferred: 'Đã chuyển lớp', withdrawn: 'Thôi học' }
export interface Enrollment { group?: 'current' | 'upcoming' | 'history'; display_status?: string; class_status?: string; registration?: { enrolled_on: string; actor_name: string; actor_id: number; created_at: string } | null; enrollment_id: number | null; class_id: number; class_name: string; started_on: string | null; ended_on: string | null; end_status: EnrollmentAction | null; status: string; can_change: boolean }
export interface StudentProfile { attendance_risks?: AttendanceRisk[]; date_of_birth?: string | null; address?: string | null; entry_level?: string | null; notes?: string | null; profile_token?: string; updated_by_name?: string | null; updated_at?: string | null; student_id: number; student_name: string; student_code: string; today: string; enrollments: Enrollment[]; email?: string; phone?: string | null; admission?: LeadConversion | null }
export interface StudentClassOption { class_id: number; class_name: string; start_date: string | null; status: string }
export interface EnrollmentHistory { history_id: number; operation: EnrollmentAction; effective_date: string; reason: string; from_class_id: number; from_class_name: string; to_class_id: number | null; to_class_name: string | null; actor_name: string; created_at: string }
export interface StudentAttendance { session_id: number; class_id: number; class_name: string; session_date: string; topic: string; status: string }
export interface EnrollmentChange { class_id: number; enrollment_id: number | null; operation: EnrollmentAction; effective_date: string; reason: string; to_class_id?: number }
export class StudentProfileError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let token = localStorage.getItem('access_token')
  const refresh = async () => { try { token = (await refreshAccessToken()).access_token } catch { throw new StudentProfileError('Phiên đăng nhập đã hết hạn.', 401) } }
  if (!token) await refresh()
  const send = () => fetch(API_URL + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  let response = await send()
  if (response.status === 401) { await refresh(); response = await send() }
  if ([401, 423].includes(response.status)) throw new StudentProfileError('Phiên đăng nhập không còn hiệu lực.', 401)
  const data = await response.json()
  if (!response.ok) throw new StudentProfileError(typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail) ? data.detail.map((item: { msg?: string }) => item.msg || 'Dữ liệu không hợp lệ').join(' · ') : 'Không thể lưu. Kiểm tra thông tin và thử lại.', response.status)
  return data
}
export const listStudentProfiles = (search: string, classId: string, page: number) => {
  const params = new URLSearchParams({ search, page: String(page) })
  if (classId) params.set('class_id', classId)
  return request<{ items: StudentProfile[]; total: number }>(`?${params}`)
}
export const getStudentProfile = (id: number) => request<StudentProfile>(`/${id}`)
export const getStudentClasses = () => request<StudentClassOption[]>('/classes')
export const changeStudentEnrollment = (id: number, data: EnrollmentChange) => request<EnrollmentHistory>(`/${id}/changes`, 'POST', data)
export const getStudentProfileHistory = (id: number, page: number) => request<{ items: EnrollmentHistory[]; total: number }>(`/${id}/history?page=${page}`)
export const getStudentAttendanceHistory = (id: number, page: number) => request<{ items: StudentAttendance[]; total: number }>(`/${id}/attendance?page=${page}`)
export const studentDate = (date: string | null) => date ? date.split('-').reverse().join('/') : 'Dữ liệu cũ'
export const studentTime = (date: string) => new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

export interface StudentProfileUpdate { full_name: string; email: string; phone: string | null; date_of_birth: string | null; address: string | null; entry_level: string | null; notes: string | null; expected_token: string }
export const updateStudentProfile = (id: number, data: StudentProfileUpdate) => request<StudentProfile>(`/${id}`, 'PUT', data)
