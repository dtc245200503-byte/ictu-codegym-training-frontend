import { refreshAccessToken } from './authService'
import { ProgramPermissionError, ProgramSessionError } from './trainingProgramService'
export interface AttendanceRisk {
  class_id: number; class_name: string; student_id: number; student_name: string; student_code: string
  absent_sessions: number; scheduled_sessions: number; threshold_percent: number; absence_rate: number; activated_at: string
}
export interface AbsencePolicy { course_id: number; program_name: string; threshold_percent: number | string; can_edit: boolean }
export class RiskPolicyConflict extends Error {}
async function request(id: number, data?: { threshold_percent: number; expected_threshold_percent: number }): Promise<AbsencePolicy> {
  let token = localStorage.getItem('access_token')
  const refresh = async () => { try { token = (await refreshAccessToken()).access_token } catch { throw new ProgramSessionError('Phiên đăng nhập đã hết hạn.') } }
  if (!token) await refresh()
  const send = () => fetch(`${window.location.protocol}//${window.location.hostname}:8000/api/attendance-risks/programs/${id}/policy`, {
    method: data ? 'PUT' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}),
  })
  let response = await send()
  if (response.status === 401) { await refresh(); response = await send() }
  if ([401, 423].includes(response.status)) throw new ProgramSessionError('Phiên đăng nhập không còn hiệu lực.')
  if (response.status === 403) throw new ProgramPermissionError('Chỉ Quản lý đào tạo có quyền cấu hình ngưỡng vắng.')
  const result = await response.json()
  if (!response.ok) {
    const message = typeof result.detail === 'string' ? result.detail : 'Ngưỡng phải từ 0 đến 100%, có tối đa hai chữ số thập phân.'
    if (response.status === 409) throw new RiskPolicyConflict(message)
    throw new Error(message)
  }
  return result
}
export const getAbsencePolicy = (id: number) => request(id)
export const saveAbsencePolicy = (id: number, threshold: number, expected: number) => request(id, { threshold_percent: threshold, expected_threshold_percent: expected })
