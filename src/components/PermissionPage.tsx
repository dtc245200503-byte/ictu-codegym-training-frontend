import ErrorPage from './ErrorPage'
import { Link } from 'react-router-dom'
import type { CurrentUser } from '../types/auth'


interface PermissionPageProps {
  user: CurrentUser
  permission: string
  title: string
}


function PermissionPage({
  user,
  permission,
  title,
}: PermissionPageProps) {
  const hasPermission = user.permissions.includes(
    permission,
  )

  if (!hasPermission) {
    return (
      <ErrorPage
        statusCode={403}
        title="Không có quyền truy cập"
        message={
          'Bạn không có quyền truy cập chức năng này.'
        }
      />
    )
  }

  return (
    <div className="permission-placeholder">
      <span className="placeholder-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h4" /></svg></span>
      <h1>{title}</h1>

      <p>
        Nội dung chức năng đang được phát triển.
      </p>
      <Link to="/" className="dashboard-profile-link">Về trang tổng quan <span aria-hidden="true">→</span></Link>
    </div>
  )
}


export default PermissionPage
