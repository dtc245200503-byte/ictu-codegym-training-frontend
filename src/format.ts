export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function showError(error: unknown) {
  if (error instanceof ApiError) {
    if (typeof error.detail === 'string') return error.detail
    if (error.detail && typeof error.detail === 'object') {
      const details = error.detail as { message?: unknown; rows?: unknown[] }
      if (typeof details.message === 'string' && Array.isArray(details.rows)) {
        return `${details.message} ${details.rows
          .map((row) => {
            const value = row as { row?: number; errors?: string[] }
            return `Dòng ${value.row}: ${(value.errors ?? []).join(', ')}`
          })
          .join('; ')}`
      }
      if (typeof details.message === 'string') return details.message
      return JSON.stringify(error.detail)
    }
  }
  if (error instanceof Error) return error.message
  return 'Có lỗi xảy ra. Vui lòng thử lại.'
}
import { ApiError } from './api'
