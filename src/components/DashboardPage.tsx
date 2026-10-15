import { Link } from 'react-router-dom'

import type { CurrentUser } from '../types/auth'
import BrandLockup from './BrandLockup'
import CollaborationVisual from './CollaborationVisual'
import DashboardOverview from './DashboardOverview'
import { canViewClasses } from '../utils/classAccess'


interface DashboardPageProps {
  user: CurrentUser
}


const roleNames: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  INSTRUCTOR: 'Giảng viên', TEACHER: 'Giảng viên', ASSISTANT: 'Trợ giảng', TA: 'Trợ giảng',
  STUDENT: 'Học viên',
  ACCOUNTANT: 'Kế toán',
  TRAINING_MANAGER: 'Quản lý đào tạo',
  ADMISSIONS: 'Tuyển sinh',
  ACADEMIC_AFFAIRS: 'Giáo vụ',
  MANAGEMENT: 'Ban quản lý',
}


interface QuickAction {
  title: string
  description: string
  path: string
  permission?: string
  icon: React.ReactNode
}


const quickActions: QuickAction[] = [
  { title: 'Khách hàng tiềm năng', description: 'Theo dõi thông tin đăng ký tư vấn và khách hàng tuyển sinh.', path: '/leads', permission: 'LEAD_MANAGE', icon: <svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" /><path d="M20 8v6M17 11h6" /></svg> },
  {
    title: 'Quản lý người dùng',
    description: 'Quản lý tài khoản và thông tin người dùng.',
    path: '/users',
    permission: 'USER_MANAGE',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: 'Vai trò & quyền',
    description: 'Phân quyền và quản lý vai trò hệ thống.',
    path: '/roles',
    permission: 'ROLE_MANAGE',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Chương trình đào tạo',
    description: 'Quản lý danh mục chương trình có sẵn để mở lớp.',
    path: '/courses',
    permission: 'CURRICULUM_MANAGE',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    title: 'Môn học',
    description: 'Quản lý môn học và dùng chung giữa các chương trình.',
    path: '/subjects',
    permission: 'SUBJECT_MANAGE',
    icon: <svg viewBox="0 0 24 24"><path d="M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-3H4z" /><path d="M13 6a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 3" /></svg>,
  },
  {
    title: 'Lớp học',
    description: 'Quản lý lớp học và hoạt động đào tạo.',
    path: '/classes',
    permission: 'CLASS_MANAGE',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    title: 'Điểm',
    description: 'Xem và quản lý kết quả học tập.',
    path: '/grades',
    permission: 'GRADE_VIEW',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    title: 'Học phí',
    description: 'Theo dõi thông tin và tình trạng học phí.',
    path: '/tuition',
    permission: 'TUITION_VIEW',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect
          x="2"
          y="5"
          width="20"
          height="14"
          rx="2"
        />
        <path d="M2 10h20" />
        <path d="M6 15h2" />
      </svg>
    ),
  },
  {
    title: 'Điểm danh',
    description: 'Theo dõi và quản lý thông tin điểm danh.',
    path: '/attendance',
    permission: 'ATTENDANCE_VIEW',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect
          x="3"
          y="4"
          width="18"
          height="17"
          rx="2"
        />
        <path d="M16 2v4" />
        <path d="M8 2v4" />
        <path d="M3 10h18" />
        <path d="M8 15l2 2 4-4" />
      </svg>
    ),
  },
]


function DashboardPage({
  user,
}: DashboardPageProps) {
  const displayedRoles = user.roles
    .map((role) => roleNames[role] || role)
    .join(', ')


  const visibleActions = quickActions.filter(
    (action) => {
      if (action.path === '/classes') return canViewClasses(user)
      if (!action.permission) {
        return true
      }

      return user.permissions.includes(
        action.permission
      )
    },
  )


  return (
    <div className="dashboard-page">
      <div className="dashboard-page-heading"><div><span className="workspace-eyebrow">KHÔNG GIAN LÀM VIỆC</span><h1>Tổng quan đào tạo</h1><p>Mọi hoạt động đào tạo, trong một không gian.</p></div><Link to="/profile" className="dashboard-profile-link">Hồ sơ của tôi <span aria-hidden="true">↗</span></Link></div>
      <DashboardOverview user={user} />
      <section className="dashboard-welcome-card">
        <div className="dashboard-welcome-content">
          <span className="dashboard-welcome-label">
            KHÔNG GIAN ĐÀO TẠO SỐ
          </span>

          <h2>
            Xin chào, {user.full_name}
          </h2>

          <p>
            Một không gian kết nối. Nhiều cơ hội phát triển.
            <br />Cùng ICTU × CodeGym Việt Nam tiếp nối hành trình đào tạo.
          </p>

          <div className="dashboard-role">
            <span>Vai trò</span>

            <strong>
              {displayedRoles}
            </strong>
          </div>
        </div>

        <div className="dashboard-partnership-visual">
          <CollaborationVisual />
        </div>
      </section>

      <section className="partnership-strip" aria-label="Hợp tác xây dựng hệ thống">
        <BrandLockup compact />
        <div><h2>Tri thức đại học. Thực hành công nghệ.</h2><p>Hợp tác xây dựng nền tảng quản lý đào tạo, đồng hành cùng mỗi hành trình học tập.</p></div>
        <span className="partnership-strip-mark" aria-hidden="true">↗</span>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <h2>
              Truy cập nhanh
            </h2>

            <p>
              Chọn chức năng bạn muốn sử dụng.
            </p>
          </div>
        </div>


        {visibleActions.length === 0 && <p className="dashboard-empty">Tài khoản của bạn chưa được cấp quyền truy cập các chức năng đào tạo. Bạn có thể xem thông tin cá nhân trong menu hoặc liên hệ quản trị viên để được hỗ trợ.</p>}
        <div className="dashboard-action-grid">
          {visibleActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="dashboard-action-card"
            >
              <div className="dashboard-action-icon">
                {action.icon}
              </div>

              <div className="dashboard-action-content">
                <h3>
                  {action.title}
                </h3>

                <p>
                  {action.description}
                </p>
              </div>

              <span className="dashboard-action-arrow">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>


      <section className="dashboard-info-card">
        <div className="dashboard-info-icon">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5" />
            <path d="M12 8h.01" />
          </svg>
        </div>

        <div>
          <h3>
            Hệ thống quản lý đào tạo
          </h3>

          <p>
            Các chức năng hiển thị trên trang chủ
            được tự động điều chỉnh theo quyền của
            tài khoản đang đăng nhập.
          </p>
        </div>
      </section>
    </div>
  )
}


export default DashboardPage
