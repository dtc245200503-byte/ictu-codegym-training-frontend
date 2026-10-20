import type { Room, RoomInfo } from './roomService'
import { refreshAccessToken } from './authService'
import { throwScheduleConflict } from './scheduleConflict'
import type { ConflictConfirmation } from './scheduleConflict'
const API_URL = `${window.location.protocol}//${window.location.hostname}:8000/api/timetable`
export interface CalendarOption { id: number; name: string }
export interface TimetableOptions { today: string; classes: CalendarOption[]; instructors: CalendarOption[]; rooms: string[] }
export interface TimetableSession extends RoomInfo {
  lesson_id?: number | null; lesson_sequence?: number | null; lesson_objectives?: string | null
  schedule_version: number; status: string; cancellation_reason: string | null; substitute_instructor_id: number | null
  can_manage?: boolean; manage_reason?: string | null
  session_id: number; session_date: string; start_time: string; end_time: string | null; room_name: string | null
  class_id: number; class_name: string; class_status: string; subject_name: string; topic: string
  instructor_id: number | null; instructor_name: string | null; attendance_saved: boolean
  staff: { user_id: number; name: string; is_main: boolean }[]
  conflicts: { session_id: number; class_name: string; topic: string; start_time: string; end_time: string | null; reasons: string[] }[]
}
export interface TimetableFilters { classId: string; instructorId: string; room: string }
export class TimetableError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let token = localStorage.getItem('access_token')
  const refresh = async () => { try { token = (await refreshAccessToken()).access_token } catch { throw new TimetableError('Phiên đăng nhập đã hết hạn.', 401) } }
  if (!token) await refresh()
  const send = () => fetch(API_URL + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  let response = await send()
  if (response.status === 401) { await refresh(); response = await send() }
  if ([401, 423].includes(response.status)) throw new TimetableError('Phiên đăng nhập không còn hiệu lực.', 401)
  const data = await response.json()
  if (!response.ok) throwScheduleConflict(data.detail)
  if (!response.ok) throw new TimetableError(typeof data.detail === 'string' ? data.detail : 'Không thể tải lịch. Vui lòng kiểm tra bộ lọc và khoảng ngày.', response.status)
  return data
}
export const getTimetableOptions = () => request<TimetableOptions>('/options')
export const getTimetableSession = (id: number) => request<TimetableSession>('/sessions/' + id)
export const listTimetableSessions = (from: string, to: string, filters: TimetableFilters) => {
  const params = new URLSearchParams({ date_from: from, date_to: to })
  if (filters.classId) params.set('class_id', filters.classId)
  if (filters.instructorId) params.set('instructor_id', filters.instructorId)
  if (filters.room === '__unassigned') params.set('unassigned_room', 'true')
  else if (filters.room) params.set('room', filters.room)
  return request<{ items: TimetableSession[]; total: number }>('/sessions?' + params)
}

export interface SessionEdit extends ConflictConfirmation { room_id?: number | null; expected_version: number; session_date: string; start_time: string; end_time: string | null; room_name: string | null; substitute_instructor_id: number | null }
export interface SessionChangeResult extends RoomInfo { changed: boolean; notified: number; schedule_version: number }
export const getTimetableEditOptions = () => request<{ instructors: CalendarOption[]; rooms?: Room[] }>('/edit-options')
export const updateTimetableSession = (id: number, data: SessionEdit) => request<SessionChangeResult>('/sessions/' + id, 'PUT', data)
export const cancelTimetableSession = (id: number, version: number, reason: string) => request<SessionChangeResult>('/sessions/' + id + '/cancel', 'POST', { expected_version: version, reason })

export { request as timetableRequest }
