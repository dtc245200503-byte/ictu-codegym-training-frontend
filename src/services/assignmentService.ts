import { refreshAccessToken } from './authService'
import type { CurrentUser } from '../types/auth'

const API = `${window.location.protocol}//${window.location.hostname}:8000/api/assignments`
export const canViewAssignments = (user: CurrentUser) => user.permissions.includes('ASSIGNMENT_VIEW') && user.roles.some(role => ['INSTRUCTOR', 'TEACHER', 'STUDENT'].includes(role))
export const canViewMyAssignments = (user: CurrentUser) => user.permissions.includes('ASSIGNMENT_VIEW') && user.roles.includes('STUDENT')
export const canManageAssignments = (user: CurrentUser) => canViewAssignments(user) && user.permissions.includes('ASSIGNMENT_MANAGE') && user.roles.some(role => ['INSTRUCTOR', 'TEACHER'].includes(role))
export interface AssignmentSession {
  session_id: number; class_subject_id: number; session_date: string; start_time: string
  topic: string; class_id: number; class_name: string; subject_name: string
}
export interface AssignmentInput {
  class_subject_id: number; session_id: number; title: string; description: string; due_at: string; max_points: string
}
export interface Assignment extends AssignmentInput {
  assignment_id: number; class_id: number; class_name: string; subject_name: string; session_date: string; session_time: string; topic: string
  status: 'draft' | 'published'; version: number; created_at: string; published_at: string | null; can_edit: boolean; recipient_count: number
  attachments: { attachment_id: number; filename: string; size: number }[]
}
export class AssignmentError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
async function responseFor(path: string, method = 'GET', body?: object | FormData) {
  let token = localStorage.getItem('access_token')
  const refresh = async () => {
    try { token = (await refreshAccessToken()).access_token }
    catch { throw new AssignmentError('Phiên đăng nhập đã hết hạn.', 401) }
  }
  if (!token) await refresh()
  const multipart = body instanceof FormData
  const send = () => fetch(API + path, { method, headers: { Authorization: `Bearer ${token}`, ...(!multipart && body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) })
  let response = await send()
  if (response.status === 401) { await refresh(); response = await send() }
  if ([401, 423].includes(response.status)) throw new AssignmentError('Phiên đăng nhập không còn hiệu lực.', 401)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new AssignmentError(typeof error.detail === 'string' ? error.detail : 'Thông tin chưa hợp lệ. Kiểm tra hạn nộp, điểm tối đa và nội dung bài tập.', response.status)
  }
  return response
}
async function request<T>(path: string, method = 'GET', body?: object | FormData): Promise<T> { return (await responseFor(path, method, body)).json() }
export const assignmentOptions = () => request<{ can_create: boolean; now: string; sessions: AssignmentSession[] }>('/options')
export const listAssignments = (page: number) => request<{ items: Assignment[]; total: number }>(`?page=${page}`)
export const getAssignment = (id: number) => request<Assignment>(`/${id}`)
export const saveAssignment = (data: AssignmentInput, saved?: Assignment) => saved
  ? request<Assignment>(`/${saved.assignment_id}`, 'PUT', { ...data, expected_version: saved.version })
  : request<Assignment>('', 'POST', data)
export const publishAssignment = (saved: Assignment) => request<Assignment>(`/${saved.assignment_id}/publish`, 'POST', { expected_version: saved.version })
export const uploadAssignmentFile = (saved: Assignment, file: File) => {
  const data = new FormData(); data.append('file', file)
  return request<Assignment>(`/${saved.assignment_id}/attachments?expected_version=${saved.version}`, 'POST', data)
}
export const removeAssignmentFile = (saved: Assignment, id: number) => request<Assignment>(
  `/${saved.assignment_id}/attachments/${id}?expected_version=${saved.version}`, 'DELETE')
export async function downloadAssignmentFile(saved: Assignment, file: Assignment['attachments'][number]) {
  const response = await responseFor(`/${saved.assignment_id}/attachments/${file.attachment_id}`)
  const url = URL.createObjectURL(await response.blob()), link = document.createElement('a')
  link.href = url; link.download = file.filename; document.body.appendChild(link)
  try { link.click() } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
}
export const assignmentTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
export const vietnamInputTime = (value: string) => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16)

export const assignmentProgressLabels = { not_submitted: 'Chưa nộp', submitted: 'Đã nộp', graded: 'Đã chấm', needs_revision: 'Cần làm lại' } as const
export type AssignmentProgress = keyof typeof assignmentProgressLabels
export type AssignmentDueSort = 'due_asc' | 'due_desc'
export interface MyAssignmentItem {
  assignment_id: number; title: string; class_id: number; class_name: string; subject_name: string
  due_at: string; max_points: string; progress_status: AssignmentProgress; remaining_seconds: number; urgency: 'normal' | 'overdue' | 'due_soon'
}
export interface MyAssignmentList {
  items: MyAssignmentItem[]; counts: Record<AssignmentProgress, number>; total: number; page: number; page_size: number
  status: AssignmentProgress; sort: AssignmentDueSort; now: string; urgent_window_hours: number
}
export const listMyAssignments = (status: AssignmentProgress, sort: AssignmentDueSort, page: number) => request<MyAssignmentList>(
  '/mine?' + new URLSearchParams({ status, sort, page: String(page) }))
export const getMyAssignment = (id: number) => request<Assignment>(`/mine/${id}`)
