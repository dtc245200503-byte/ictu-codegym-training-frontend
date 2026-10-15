const API_URL =
  `${window.location.protocol}//${window.location.hostname}:8000`


export interface UserRoleItem {
  role_id: number
  role_name: string
}


export interface UserItem {
  user_id: number
  username: string
  full_name: string
  email: string
  phone: string | null
  role_id: number
  roles: UserRoleItem[]
  status: 'active' | 'locked'
  lock_reason: string | null
}


export interface UserListResponse {
  page: number
  page_size: number
  total: number
  items: UserItem[]
}


export interface GetUsersParams {
  search?: string
  role_id?: number
  status?: string
  page?: number
  page_size?: number
}


export interface CreateUserData {
  username: string
  full_name: string
  email: string
  phone: string
  role_id: number
}


export interface UpdateUserData {
  full_name?: string
  email?: string
  phone?: string
}


export interface UserRolesResponse {
  user_id: number
  full_name: string
  roles: UserRoleItem[]
}


export interface ClassNeedHandover {
  class_id: number
  class_name: string
}


export interface LockUserResponse {
  message: string
  user_id: number
  lock_reason: string
  classes_need_handover: ClassNeedHandover[]
  warning: string | null
}


function getAccessToken(): string {
  const token = localStorage.getItem('access_token')

  if (!token) {
    throw new Error('Bạn chưa đăng nhập.')
  }

  return token
}


export async function getUsers(
  params: GetUsersParams = {},
): Promise<UserListResponse> {
  const query = new URLSearchParams()

  if (params.search) {
    query.set('search', params.search)
  }

  if (params.role_id !== undefined) {
    query.set(
      'role_id',
      String(params.role_id),
    )
  }

  if (params.status) {
    query.set('status', params.status)
  }

  query.set(
    'page',
    String(params.page ?? 1),
  )

  query.set(
    'page_size',
    String(params.page_size ?? 20),
  )

  const response = await fetch(
    `${API_URL}/api/users?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail
        || 'Không thể tải danh sách tài khoản.',
    )
  }

  return data
}


export async function createUser(
  data: CreateUserData,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(data),
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.detail
        || 'Không thể tạo tài khoản.',
    )
  }
}


export async function updateUser(
  userId: number,
  data: UpdateUserData,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/users/${userId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(data),
    },
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      result.detail
        || 'Không thể cập nhật tài khoản.',
    )
  }
}


export async function lockUser(
  userId: number,
  lockReason: string,
): Promise<LockUserResponse> {
  const response = await fetch(
    `${API_URL}/api/users/${userId}/lock`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        lock_reason: lockReason,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail
        || 'Không thể khóa tài khoản.',
    )
  }

  return data
}


export async function unlockUser(
  userId: number,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/users/${userId}/unlock`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail
        || 'Không thể mở khóa tài khoản.',
    )
  }
}


export async function getUserRoles(
  userId: number,
): Promise<UserRolesResponse> {
  const response = await fetch(
    `${API_URL}/api/users/${userId}/roles`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail
        || 'Không thể tải vai trò của người dùng.',
    )
  }

  return data
}


export async function assignUserRole(
  userId: number,
  roleId: number,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/users/${userId}/roles`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        role_id: roleId,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail
        || 'Không thể gán vai trò.',
    )
  }
}


export async function removeUserRole(
  userId: number,
  roleId: number,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/users/${userId}/roles`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        role_id: roleId,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail
        || 'Không thể thu hồi vai trò.',
    )
  }
}


export interface ImportUserRow {
  row_index: number
  full_name: string
  email: string
  phone: string | null
  role_input: string
  role_name: string
  role_id: number | null
  is_valid: boolean
  errors: string[]
}


export interface ImportPreviewResponse {
  total_rows: number
  valid_count: number
  invalid_count: number
  rows: ImportUserRow[]
}


export interface ImportConfirmUserItem {
  row_index: number
  full_name: string
  email: string
  phone?: string | null
  role_id: number
}


export interface ImportSummaryResponse {
  message: string
  total_rows: number
  success_count: number
  failed_count: number
  errors: string[]
  summary_text: string
}


export async function downloadImportTemplate(): Promise<Blob> {
  const response = await fetch(
    `${API_URL}/api/users/import-excel/template`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    },
  )

  if (!response.ok) {
    let errorMsg = 'Không thể tải tệp Excel mẫu.'
    try {
      const data = await response.json()
      if (data.detail) {
        errorMsg = data.detail
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg)
  }

  return response.blob()
}


export async function previewUsersFromExcel(
  file: File,
): Promise<ImportPreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(
    `${API_URL}/api/users/import-excel/preview`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: formData,
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail || 'Không thể kiểm tra tệp Excel.',
    )
  }

  return data
}


export async function confirmImportUsers(
  users: ImportConfirmUserItem[],
): Promise<ImportSummaryResponse> {
  const response = await fetch(
    `${API_URL}/api/users/import-excel/confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({ users }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      typeof data.detail === 'string' ? data.detail : 'Dữ liệu nhập không hợp lệ. Mỗi lô được phép có từ 1 đến 100 tài khoản.',
    )
  }

  return data
}
