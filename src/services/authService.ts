import type { CurrentUser } from '../types/auth'


const API_URL =
  `${window.location.protocol}//${window.location.hostname}:8000`


interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}


interface RefreshResponse {
  access_token: string
  token_type: string
}


export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(
    `${API_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail || 'Đăng nhập thất bại.',
    )
  }

  return data
}


export async function refreshAccessToken():
Promise<RefreshResponse> {
  const refreshToken =
    localStorage.getItem('refresh_token')

  if (!refreshToken) {
    throw new Error(
      'Phiên đăng nhập đã hết hạn.',
    )
  }

  const response = await fetch(
    `${API_URL}/api/auth/refresh`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail
        || 'Phiên đăng nhập đã hết hạn.',
    )
  }

  localStorage.setItem(
    'access_token',
    data.access_token,
  )

  return data
}


export async function logout():
Promise<void> {
  const refreshToken =
    localStorage.getItem('refresh_token')

  if (!refreshToken) {
    return
  }

  const response = await fetch(
    `${API_URL}/api/auth/logout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    },
  )

  if (!response.ok) {
    const data = await response.json()

    throw new Error(
      data.detail
        || 'Không thể đăng xuất.',
    )
  }
}


export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const accessToken =
    localStorage.getItem('access_token')

  const refreshToken =
    localStorage.getItem('refresh_token')

  if (!accessToken || !refreshToken) {
    throw new Error(
      'Phiên đăng nhập đã hết hạn.',
    )
  }

  const response = await fetch(
    `${API_URL}/api/auth/change-password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: newPassword,
        refresh_token: refreshToken,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      typeof data.detail === 'string' ? data.detail : 'Thông tin đổi mật khẩu không hợp lệ. Vui lòng kiểm tra lại các trường.',
    )
  }
}


export async function forgotPassword(
  email: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/auth/forgot-password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.detail ||
        'Không thể gửi yêu cầu đặt lại mật khẩu.',
    )
  }
}


export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const response = await fetch(
    `${API_URL}/api/auth/reset-password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        new_password: newPassword,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      response.status === 422
        ? 'Thông tin đặt lại mật khẩu không hợp lệ. Vui lòng kiểm tra liên kết và mật khẩu mới.'
        : typeof data.detail === 'string' && data.detail !== 'Not Found'
          ? data.detail
          : 'Không thể đặt lại mật khẩu. Vui lòng thử lại sau.',
    )
  }
}


export async function getCurrentUser(
  accessToken: string,
): Promise<CurrentUser> {
  const response = await fetch(
    `${API_URL}/api/me`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error(
      'Không thể lấy thông tin người dùng',
    )
  }

  return response.json()
}
