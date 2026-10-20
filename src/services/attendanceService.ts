import type { Room, RoomInfo } from './roomService'
import { refreshAccessToken } from './authService'
import { throwScheduleConflict } from './scheduleConflict'
import type { ConflictConfirmation } from './scheduleConflict'

const API_URL = `${window.location.protocol}//${window.location.hostname}:8000/api/attendance`
export const attendanceStatuses = { present: 'Có mặt', late: 'Đi muộn', excused_absence: 'Vắng có phép', unexcused_absence: 'Vắng không phép' } as const
export type AttendanceStatus = keyof typeof attendanceStatuses
export interface AttendanceStudent { approved_absence?: boolean; student_id: number; student_name: string; student_code: string; status: AttendanceStatus | null }
export interface AttendanceSession extends RoomInfo {
  absence_prefilled?: boolean;
  room_name?: string | null;
  session_id: number; class_id: number; class_name: string; subject_name: string; topic: string
  session_date: string; start_time: string; version: number; saved_at: string | null; saved_by_name: string | null
  can_edit: boolean; can_edit_past: boolean; read_only_reason: string | null; today: string
}
export interface AttendanceDetail extends AttendanceSession { students: AttendanceStudent[]; archived_students?: AttendanceStudent[] }
export interface AttendanceOptions {
  rooms?: Room[]
  today: string; can_prepare: boolean; can_enroll?: boolean
  subjects: { class_subject_id: number; class_id: number; class_name: string; subject_name: string }[]
}
export interface AttendanceLog { history_id: number; version: number; student_id: number; student_name: string; from_status: AttendanceStatus | null; to_status: AttendanceStatus; actor_name: string; actor_id: number; created_at: string }
export class AttendanceError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
async function request<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  let token = localStorage.getItem('access_token')
  const refresh = async () => {
    try { token = (await refreshAccessToken()).access_token }
    catch { throw new AttendanceError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401) }
  }
  if (!token) await refresh()
  const send = () => fetch(API_URL + path, { method, headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) })
  let response = await send()
  if (response.status === 401) { await refresh(); response = await send() }
  if ([401, 423].includes(response.status)) throw new AttendanceError('Phiên đăng nhập không còn hiệu lực.', 401)
  const result = await response.json()
  if (!response.ok) throwScheduleConflict(result.detail)
  if (!response.ok) {
    const message = typeof result.detail === 'string' ? result.detail : 'Thông tin chưa hợp lệ. Kiểm tra ngày, giờ, danh sách và trạng thái điểm danh.'
    throw new AttendanceError(message, response.status)
  }
  return result
}
export const getAttendanceOptions = () => request<AttendanceOptions>('/options')
export const listAttendanceSessions = (date: string, classId: string, page: number) => {
  const query = new URLSearchParams({ page: String(page) })
  if (date) query.set('on_date', date)
  if (classId) query.set('class_id', classId)
  return request<{ items: AttendanceSession[]; total: number; today: string }>(`/sessions?${query}`)
}
export const getAttendance = (id: number) => request<AttendanceDetail>(`/sessions/${id}`)
export const saveAttendance = (id: number, version: number, items: { student_id: number; status: AttendanceStatus }[]) =>
  request<AttendanceDetail & { changed: number }>(`/sessions/${id}`, 'PUT', { expected_version: version, items })
export const getAttendanceHistory = (id: number, page: number) => request<{ items: AttendanceLog[]; total: number }>(`/sessions/${id}/history?page=${page}`)
export const createAttendanceSession = (data: ConflictConfirmation & { room_id?: number | null; class_subject_id: number; session_date: string; start_time: string; end_time?: string; room_name?: string | null; topic: string }) => request<AttendanceSession>('/sessions', 'POST', data)
export const findAttendanceStudents = (search: string) => request<{ items: Omit<AttendanceStudent, 'status'>[]; total: number }>(`/students?${new URLSearchParams({ search })}`)
export const enrollAttendanceStudents = (classId: number, ids: number[]) => request<{ added: number }>(`/classes/${classId}/students`, 'POST', { student_ids: ids })
export const attendanceDate = (date: string) => date.split('-').reverse().join('/')
export const attendanceTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

export const getAttendanceRoomCapacity = (id: number, classId: number, date: string) => request<RoomInfo>('/rooms/' + id + '/capacity?' + new URLSearchParams({ class_id: String(classId), on_date: date }))
