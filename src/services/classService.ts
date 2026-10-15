import { refreshAccessToken } from './authService'

const API_URL = `${window.location.protocol}//${window.location.hostname}:8000/api/classes`

export interface AssistantItem {
  user_id: number
  full_name: string
  email: string
  username?: string | null
}

export interface ClassSubjectDetail {
  subject_id: number
  code: string
  name: string
  session_count: number
  instructor_id?: number | null
  instructor_name?: string | null
  instructor_email?: string | null
  assistants: AssistantItem[]
}

export interface TrainingClass {
  class_id: number
  class_name: string
  course_id: number | null
  program_code: string | null
  program_name: string | null
  instructor_id: number | null
  instructor_name: string | null
  start_date: string | null
  status: string
  subjects: ClassSubjectDetail[]
}

export interface CandidateUser {
  user_id: number
  full_name: string
  email: string
  username: string
}

export interface ClassCandidates {
  instructors: CandidateUser[]
  assistants: CandidateUser[]
}

export interface ClassAssignmentDetail {
  class_id: number
  class_name: string
  course_id: number | null
  program_code: string | null
  program_name: string | null
  subjects: ClassSubjectDetail[]
  available_instructors: CandidateUser[]
  available_assistants: CandidateUser[]
}

export interface BatchAssignmentItem {
  subject_id: number
  instructor_id: number | null
  assistant_ids: number[]
}

export class ClassSessionError extends Error {}
export class ClassPermissionError extends Error {}

async function makeAuthRequest(path: string, options: RequestInit = {}): Promise<Response> {
  let token = localStorage.getItem('access_token')
  const refresh = async () => {
    try {
      token = (await refreshAccessToken()).access_token
    } catch {
      throw new ClassSessionError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }
  }

  if (!token) await refresh()

  const send = () =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })

  let response = await send()
  if (response.status === 401) {
    await refresh()
    response = await send()
  }

  if (response.status === 401 || response.status === 423) {
    throw new ClassSessionError('Phiên đăng nhập không còn hiệu lực.')
  }
  if (response.status === 403) {
    throw new ClassPermissionError('Bạn không có quyền thực hiện thao tác này.')
  }

  return response
}

export async function listClasses(search: string, status: string, page: number): Promise<{ items: TrainingClass[]; total: number }> {
  const query = new URLSearchParams({ search, page: String(page), page_size: '20', ...(status ? { status } : {}) })
  const response = await makeAuthRequest(`?${query}`)
  const result = await response.json()
  if (!response.ok) {
    throw new Error(typeof result.detail === 'string' ? result.detail : 'Không thể tải lớp học. Vui lòng thử lại.')
  }
  return result
}

export async function getClassCandidates(): Promise<ClassCandidates> {
  const response = await makeAuthRequest('/candidates')
  const result = await response.json()
  if (!response.ok) {
    throw new Error(typeof result.detail === 'string' ? result.detail : 'Không thể tải danh sách giảng viên & trợ giảng.')
  }
  return result
}

export async function getClassAssignments(classId: number): Promise<ClassAssignmentDetail> {
  const response = await makeAuthRequest(`/${classId}/assignments`)
  const result = await response.json()
  if (!response.ok) {
    throw new Error(typeof result.detail === 'string' ? result.detail : 'Không thể tải chi tiết phân công lớp học.')
  }
  return result
}

export async function assignSubjectTeachers(
  classId: number,
  subjectId: number,
  instructorId: number | null,
  assistantIds: number[]
): Promise<ClassSubjectDetail> {
  const response = await makeAuthRequest(`/${classId}/subjects/${subjectId}/assignment`, {
    method: 'PUT',
    body: JSON.stringify({ instructor_id: instructorId, assistant_ids: assistantIds }),
  })
  const result = await response.json()
  if (!response.ok) {
    throw new Error(typeof result.detail === 'string' ? result.detail : 'Không thể phân công môn học.')
  }
  return result
}

export async function saveBatchClassAssignments(
  classId: number,
  assignments: BatchAssignmentItem[]
): Promise<ClassAssignmentDetail> {
  const response = await makeAuthRequest(`/${classId}/assignments`, {
    method: 'PUT',
    body: JSON.stringify({ assignments }),
  })
  const result = await response.json()
  if (!response.ok) {
    throw new Error(typeof result.detail === 'string' ? result.detail : 'Không thể lưu phân công giảng dạy.')
  }
  return result
}
