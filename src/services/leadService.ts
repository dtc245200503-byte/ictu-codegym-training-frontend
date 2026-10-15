import { refreshAccessToken } from './authService'
const API_URL = `${window.location.protocol}//${window.location.hostname}:8000/api/leads`
export interface LeadData { full_name: string; phone: string; email: string | null; source: string; interest: string | null; confirm_duplicate?: boolean }
export interface Lead extends LeadData { lead_id: number; message: string | null; status: string; created_at: string; duplicate_count: number; assignee_id: number | null; assignee_name: string | null; next_callback_at: string | null; callback_overdue: boolean }
export interface DuplicateLead { lead_id: number; full_name: string; phone: string; source: string; interest: string | null }
export interface DuplicateCheck { duplicates: DuplicateLead[]; total: number; hidden_match?: boolean }
export interface Advisor { user_id: number; full_name: string; email: string }
export interface LeadFilters { search: string; source: string; status: string; assignee_id: string; date_from: string; date_to: string; callback_status: string }
export interface LeadFilterOptions { sources: string[]; assignees: { user_id: number; full_name: string }[]; can_view_all: boolean }
export interface AssignmentHistory { history_id: number; lead_id: number; from_assignee_id: number | null; to_assignee_id: number | null; actor_id: number; from_assignee_name: string | null; to_assignee_name: string | null; actor_name: string; note: string | null; created_at: string }
export class LeadSessionError extends Error {}
export class LeadPermissionError extends Error {}
export class LeadDuplicateError extends Error {
  details: DuplicateCheck
  constructor(message: string, details: DuplicateCheck) { super(message); this.details = details }
}
const messages: Record<string, string> = {
  full_name: 'Họ và tên cần có từ 1 đến 100 ký tự.', phone: 'Số điện thoại Việt Nam không hợp lệ.',
  email: 'Email không hợp lệ hoặc vượt quá 255 ký tự.', source: 'Nguồn cần có từ 1 đến 100 ký tự.',
  interest: 'Chương trình quan tâm không được vượt quá 255 ký tự.', confirm_duplicate: 'Xác nhận số điện thoại trùng không hợp lệ.',
  lead_ids: 'Hãy chọn từ 1 đến 100 lead khác nhau.', assignee_id: 'Vui lòng chọn tư vấn viên.', note: 'Ghi chú không được vượt quá 1.000 ký tự.',
  status: 'Trạng thái lọc không hợp lệ.', date_from: 'Ngày bắt đầu không hợp lệ.', date_to: 'Ngày kết thúc không hợp lệ.',
  content: 'Nội dung chăm sóc cần có từ 1 đến 5.000 ký tự.', interaction_type: 'Vui lòng chọn gọi, nhắn hoặc gặp.',
  occurred_at: 'Thời điểm tương tác không hợp lệ.', next_callback_at: 'Ngày nhắc gọi lại không hợp lệ.',
  callback_action: 'Thao tác với lịch nhắc không hợp lệ.', callback_status: 'Bộ lọc lịch nhắc không hợp lệ.',
}
async function request<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  let token = localStorage.getItem('access_token')
  const refresh = async () => {
    try { token = (await refreshAccessToken()).access_token }
    catch { throw new LeadSessionError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.') }
  }
  if (!token) await refresh()
  const send = () => fetch(`${API_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  let response = await send()
  if (response.status === 401) { await refresh(); response = await send() }
  if (response.status === 401 || response.status === 423) throw new LeadSessionError('Phiên đăng nhập không còn hiệu lực.')
  if (response.status === 403) throw new LeadPermissionError('Bạn không có quyền thực hiện thao tác này với khách hàng tiềm năng.')
  const result = await response.json()
  if (!response.ok) {
    if (response.status === 409 && typeof result.detail === 'object' && Array.isArray(result.detail?.duplicates)) throw new LeadDuplicateError(result.detail.message, result.detail)
    if (Array.isArray(result.detail)) throw new Error([...new Set(result.detail.map((item: { loc?: string[] }) => messages[item.loc?.[1] || ''] || 'Thông tin khách hàng chưa hợp lệ.'))].join(' '))
    throw new Error(typeof result.detail === 'string' && result.detail !== 'Not Found' ? result.detail : 'Không thể xử lý khách hàng tiềm năng. Vui lòng thử lại.')
  }
  return result
}
export const listLeads = (filters: LeadFilters, page: number) => {
  const query = new URLSearchParams({ page: String(page), page_size: '20' })
  for (const [key, value] of Object.entries(filters)) if (value.trim()) query.set(key, value.trim())
  return request<{ items: Lead[]; total: number }>(`?${query}`)
}
export const getLeadFilterOptions = () => request<LeadFilterOptions>('/filter-options')
export const getLead = (id: number) => request<Lead>(`/${id}`)
export const saveLead = (data: LeadData, id?: number) => request<Lead>(id ? `/${id}` : '', id ? 'PUT' : 'POST', data)
export const deleteLead = (id: number) => request(`/${id}`, 'DELETE')
export const checkLeadPhone = (phone: string, excludeId?: number) => request<DuplicateCheck>(`/check-phone?${new URLSearchParams({ phone, ...(excludeId ? { exclude_lead_id: String(excludeId) } : {}) })}`)
export const listLeadAdvisors = () => request<Advisor[]>('/advisors')
export const assignLeads = (leadIds: number[], assigneeId: number, note: string) => request<{ message: string; changed: number; unchanged: number }>('/assign', 'POST', { lead_ids: leadIds, assignee_id: assigneeId, note: note.trim() || null })
export const getLeadHistory = (id: number, page: number) => request<{ items: AssignmentHistory[]; total: number }>(`/${id}/assignment-history?page=${page}&page_size=20`)

export interface CareLogData {
  interaction_type: 'call' | 'message' | 'meeting'; content: string; occurred_at: string
  callback_action: 'keep' | 'schedule' | 'complete'; next_callback_at?: string
}
export interface CareLog extends Omit<CareLogData, 'next_callback_at'> {
  log_id: number; lead_id: number; actor_id: number; actor_name: string; created_at: string; next_callback_at: string | null
}
export interface CareLogList { items: CareLog[]; total: number; page: number; page_size: number; next_callback_at: string | null; callback_overdue: boolean }
export const getLeadCareLogs = (id: number, page: number) => request<CareLogList>(`/${id}/care-logs?page=${page}&page_size=20`)
export const addLeadCareLog = (id: number, data: CareLogData) => request<CareLog>(`/${id}/care-logs`, 'POST', data)
export const updateLeadCallback = (id: number, next: string | null) => request<Lead>(`/${id}/callback`, 'PUT', { next_callback_at: next })
