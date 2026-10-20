import { refreshAccessToken } from './authService'
const API_URL = `${window.location.protocol}//${window.location.hostname}:8000/api/notifications`
export interface UserNotification { notification_id: number | string; title: string; message: string; created_at: string; read_at: string | null }
export class NotificationError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let token = localStorage.getItem('access_token')
  const refresh = async () => { try { token = (await refreshAccessToken()).access_token } catch { throw new NotificationError('Phiên đăng nhập đã hết hạn.', 401) } }
  if (!token) await refresh()
  const send = () => fetch(API_URL + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  let response = await send()
  if (response.status === 401) { await refresh(); response = await send() }
  if ([401, 423].includes(response.status)) throw new NotificationError('Phiên đăng nhập không còn hiệu lực.', 401)
  const data = await response.json()
  if (!response.ok) throw new NotificationError(typeof data.detail === 'string' ? data.detail : 'Không thể xử lý thông báo. Vui lòng thử lại.', response.status)
  return data
}
export const notificationSummary = () => request<{ unread: number }>('/summary')
export const listNotifications = (page: number, unread: boolean) => request<{ items: UserNotification[]; total: number; unread: number }>('?' + new URLSearchParams({ page: String(page), unread_only: String(unread) }))
export const readNotification = (id: number | string) => request<{ unread: number }>('/' + id + '/read', 'POST')
export const notifyInboxChanged = () => window.dispatchEvent(new Event('notifications-changed'))
