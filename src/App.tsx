import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode, SetStateAction } from 'react'
import { ApiError, apiBlobRequest, apiRequest, clearTokens, hasSession, saveTokens } from './api'
import { Modal } from './components/Ui'
import { ProfileModal } from './components/ProfileModal'
import { InstitutionBrand } from './components/InstitutionBrand'
import { isLandingPath, navigateTo } from './navigation'
const PublicLeadModal = lazy(() => import('./pages/LeadsPage').then((module) => ({ default: module.PublicLeadModal })))
const LeadDetailPage = lazy(() => import('./pages/LeadsPage').then((module) => ({ default: module.LeadDetailPage })))
const LeadsPage = lazy(() => import('./pages/LeadsPage').then((module) => ({ default: module.LeadsPage })))
const AccountEditPage = lazy(() => import('./pages/AccountsPage').then((module) => ({ default: module.AccountEditPage })))
const AccountsPage = lazy(() => import('./pages/AccountsPage').then((module) => ({ default: module.AccountsPage })))
const ClassRosterPage = lazy(() => import('./pages/ClassesPage').then((module) => ({ default: module.ClassRosterPage })))
const ClassWorkflowPage = lazy(() => import('./pages/ClassesPage').then((module) => ({ default: module.ClassWorkflowPage })))
const ClassesPage = lazy(() => import('./pages/ClassesPage').then((module) => ({ default: module.ClassesPage })))
const StudentRecordsPage = lazy(() => import('./pages/StudentRecordsPage').then((module) => ({ default: module.StudentRecordsPage })))
const StudentWorkflowPage = lazy(() => import('./pages/StudentRecordsPage').then((module) => ({ default: module.StudentWorkflowPage })))
const CourseEditorPage = lazy(() => import('./pages/CoursesPage').then((module) => ({ default: module.CourseEditorPage })))
const CourseLessonsPage = lazy(() => import('./pages/CoursesPage').then((module) => ({ default: module.CourseLessonsPage })))
const ProgramCurriculumPage = lazy(() => import('./pages/CoursesPage').then((module) => ({ default: module.ProgramCurriculumPage })))
const StudyProgramsPage = lazy(() => import('./pages/CoursesPage').then((module) => ({ default: module.StudyProgramsPage })))
const CoursesPage = lazy(() => import('./pages/CoursesPage').then((module) => ({ default: module.CoursesPage })))
const ScheduleSessionPage = lazy(() => import('./pages/SchedulePage').then((module) => ({ default: module.ScheduleSessionPage })))
const SchedulePage = lazy(() => import('./pages/SchedulePage').then((module) => ({ default: module.SchedulePage })))
const RoomsPage = lazy(() => import('./pages/RoomsPage').then((module) => ({ default: module.RoomsPage })))
const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage').then((module) => ({ default: module.AssignmentsPage })))
const AutoSchedulePage = lazy(() => import('./pages/AutoSchedulePage').then((module) => ({ default: module.AutoSchedulePage })))
const ScheduleConflictsPage = lazy(() => import('./pages/ScheduleConflictsPage').then((module) => ({ default: module.ScheduleConflictsPage })))
const StudentDetailPage = lazy(() => import('./pages/StudentDetailPage').then((module) => ({ default: module.StudentDetailPage })))
const OpenClassPage = lazy(() => import('./pages/OpenClassPage').then((module) => ({ default: module.OpenClassPage })))
const AttendanceMatrixPage = lazy(() => import('./pages/AttendanceMatrixPage').then((module) => ({ default: module.AttendanceMatrixPage })))
const StudentAttendanceHistoryPage = lazy(() => import('./pages/StudentAttendanceHistoryPage').then((module) => ({ default: module.StudentAttendanceHistoryPage })))
import type { Role, User } from './types'
import { openNotificationWithPreflight } from './notificationNavigation'
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })))
const GraduationPage = lazy(() => import('./pages/FinanceAcademicPages').then((module) => ({ default: module.GraduationPage })))
const SurveysPage = lazy(() => import('./pages/FinanceAcademicPages').then((module) => ({ default: module.SurveysPage })))
const TranscriptPage = lazy(() => import('./pages/FinanceAcademicPages').then((module) => ({ default: module.TranscriptPage })))
const TuitionPage = lazy(() => import('./pages/FinanceAcademicPages').then((module) => ({ default: module.TuitionPage })))
const DiscountReviewPage = lazy(() => import('./pages/FinanceAcademicPages').then((module) => ({ default: module.DiscountReviewPage })))
import './App.css'
import './frappe-refresh.css'

type PageKey =
  | 'dashboard'
  | 'accounts'
  | 'accountEditor'
  | 'courses'
  | 'courseEditor'
  | 'courseLessons'
  | 'programs'
  | 'programCurriculum'
  | 'classes'
  | 'openClass'
  | 'classRoster'
  | 'attendanceMatrix'
  | 'classEditor'
  | 'classSchedule'
  | 'schedule'
  | 'autoSchedule'
  | 'scheduleConflicts'
  | 'sessionDetail'
  | 'assignments'
  | 'attendanceHistory'
  | 'tuition'
  | 'discountReview'
  | 'transcript'
  | 'graduation'
  | 'surveys'
  | 'leads'
  | 'leadDetail'
  | 'students'
  | 'studentDetail'
  | 'studentEditor'
  | 'studentEnrollment'
  | 'rooms'
  | 'auditLogs'
  | 'forbidden'
  | 'notFound'

const pageTitle: Record<PageKey, string> = {
  dashboard: 'Tổng quan',
  accounts: 'Quản lý tài khoản',
  accountEditor: 'Cập nhật tài khoản',
  courses: 'Danh mục môn học',
  courseEditor: 'Biểu mẫu môn học',
  courseLessons: 'Nội dung môn học',
  programs: 'Chương trình đào tạo',
  programCurriculum: 'Khung chương trình',
  classes: 'Danh sách lớp học',
  openClass: 'Mở lớp mới',
  classRoster: 'Quản lý lớp học',
  attendanceMatrix: 'Ma trận điểm danh',
  classEditor: 'Biểu mẫu lớp học',
  classSchedule: 'Xếp thời khóa biểu',
  schedule: 'Thời khóa biểu',
  autoSchedule: 'Sinh thời khóa biểu tự động',
  scheduleConflicts: 'Cảnh báo xung đột lịch',
  sessionDetail: 'Chi tiết buổi học',
  assignments: 'Bài tập',
  attendanceHistory: 'Lịch sử điểm danh',
  tuition: 'Học phí và giao dịch',
  discountReview: 'Duyệt giảm học phí',
  transcript: 'Bảng điểm cá nhân',
  graduation: 'Điều kiện tốt nghiệp',
  surveys: 'Khảo sát cuối khóa',
  leads: 'Hồ sơ tư vấn tuyển sinh',
  leadDetail: 'Chi tiết hồ sơ tuyển sinh',
  students: 'Danh sách học viên',
  studentDetail: 'Hồ sơ chi tiết học viên',
  studentEditor: 'Cập nhật hồ sơ học viên',
  studentEnrollment: 'Biến động ghi danh',
  rooms: 'Phòng học',
  auditLogs: 'Nhật ký thao tác',
  forbidden: '403 · Không có quyền truy cập',
  notFound: '404 · Không tìm thấy trang',
}

const pagePaths: Record<PageKey, string> = {
  dashboard: '/dashboard',
  accounts: '/accounts',
  accountEditor: '/accounts',
  courses: '/courses',
  courseEditor: '/courses',
  courseLessons: '/courses',
  programs: '/programs',
  programCurriculum: '/programs',
  classes: '/classes',
  openClass: '/classes/new',
  classRoster: '/classes',
  attendanceMatrix: '/classes',
  classEditor: '/classes',
  classSchedule: '/classes',
  schedule: '/schedule',
  autoSchedule: '/schedule/generate',
  scheduleConflicts: '/schedule/conflicts',
  sessionDetail: '/schedule',
  assignments: '/assignments',
  attendanceHistory: '/my/attendance',
  tuition: '/tuition',
  discountReview: '/tuition/discount-review',
  transcript: '/my/transcript',
  graduation: '/graduation',
  surveys: '/surveys',
  leads: '/leads',
  leadDetail: '/leads',
  students: '/students',
  studentDetail: '/students',
  studentEditor: '/students',
  studentEnrollment: '/students',
  rooms: '/rooms',
  auditLogs: '/audit-logs',
  forbidden: '/403',
  notFound: '/404',
}

function pageFromPath(pathname: string): PageKey {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  if (normalizedPath === '/' || normalizedPath === '/dashboard') return 'dashboard'
  if (/^\/accounts\/\d+\/edit$/.test(normalizedPath)) return 'accountEditor'
  if (/^\/courses\/\d+\/lessons$/.test(normalizedPath)) return 'courseLessons'
  if (normalizedPath === '/courses/new' || /^\/courses\/\d+\/edit$/.test(normalizedPath)) return 'courseEditor'
  if (/^\/programs\/\d+\/courses$/.test(normalizedPath)) return 'programCurriculum'
  if (/^\/leads\/\d+$/.test(normalizedPath)) return 'leadDetail'
  if (/^\/students\/\d+\/edit$/.test(normalizedPath)) return 'studentEditor'
  if (/^\/students\/\d+\/enrollment$/.test(normalizedPath)) return 'studentEnrollment'
  if (/^\/students\/\d+$/.test(normalizedPath)) return 'studentDetail'
  if (/^\/classes\/\d+\/attendance\/matrix$/.test(normalizedPath)) return 'attendanceMatrix'
  if (/^\/classes\/\d+(\/(students|enroll|attendance|tuition))?$/.test(normalizedPath)) return 'classRoster'
  if (normalizedPath === '/classes/new') return 'openClass'
  if (/^\/classes\/\d+\/edit$/.test(normalizedPath)) return 'classEditor'
  if (/^\/classes\/\d+\/schedule$/.test(normalizedPath)) return 'classSchedule'
  if (normalizedPath === '/schedule/generate') return 'autoSchedule'
  if (normalizedPath === '/schedule/conflicts') return 'scheduleConflicts'
  if (/^\/schedule\/sessions\/\d+$/.test(normalizedPath)) return 'sessionDetail'
  if (normalizedPath === '/my/attendance') return 'attendanceHistory'
  if (normalizedPath === '/my/transcript') return 'transcript'
  return (Object.entries(pagePaths).find(([, path]) => path === normalizedPath)?.[0] as PageKey | undefined) ?? 'notFound'
}

function canAccessPage(page: PageKey, roles: Role[]): boolean {
  if (page === 'dashboard' || page === 'forbidden' || page === 'notFound') return true
  const canManage = roles.includes('admin') || roles.includes('manager')
  if (page === 'accountEditor') return roles.includes('admin')
  if (page === 'auditLogs') return roles.includes('admin')
  if (page === 'leadDetail') return roles.includes('admin') || roles.includes('admissions')
  if (page === 'sessionDetail') return canAccessPage('schedule', roles)
  if (page === 'autoSchedule' || page === 'scheduleConflicts') return canManage
  if (page === 'openClass') return canManage
  if (page === 'studentDetail') return canAccessPage('students', roles)
  if (page === 'studentEditor' || page === 'studentEnrollment') return canAccessPage('students', roles)
  if (page === 'attendanceMatrix') return roles.some((role) => ['admin', 'manager', 'teacher', 'ta'].includes(role))
  if (page === 'classRoster' || page === 'classEditor' || page === 'classSchedule') return canAccessPage('classes', roles)
  if (page === 'accounts' || page === 'courses' || page === 'courseEditor' || page === 'courseLessons' || page === 'programs' || page === 'programCurriculum' || page === 'rooms') return canManage
  if (page === 'leads') return roles.includes('admin') || roles.includes('admissions')
  if (page === 'students') return roles.some((role) => ['admin', 'manager', 'admissions'].includes(role))
  if (page === 'assignments') return roles.some((role) => ['admin', 'manager', 'teacher', 'ta', 'student'].includes(role))
  if (page === 'attendanceHistory') return roles.includes('student')
  if (page === 'tuition') return roles.some((role) => ['admin', 'accountant', 'student'].includes(role))
  if (page === 'discountReview') return roles.includes('manager')
  if (page === 'transcript') return roles.includes('student')
  if (page === 'graduation') return canManage
  if (page === 'surveys') return roles.some((role) => ['admin', 'manager', 'student'].includes(role))
  return roles.some((role) => ['admin', 'manager', 'admissions', 'accountant', 'teacher', 'ta', 'student'].includes(role))
}

function ForbiddenPage({ onBack }: { onBack: () => void }) {
  return (
    <section className="forbidden-page">
      <span className="eyebrow">403 · FORBIDDEN</span>
      <h1>Bạn không có quyền truy cập trang này</h1>
      <p>Vai trò hiện tại không được cấp quyền cho chức năng bạn vừa mở.</p>
      <button className="button button-primary" onClick={onBack} type="button">Quay lại trang chính</button>
    </section>
  )
}

function NotFoundPage({ onBack }: { onBack: () => void }) {
  return (
    <section className="forbidden-page">
      <span className="eyebrow">404 · NOT FOUND</span>
      <h1>Không tìm thấy trang bạn cần</h1>
      <p>Đường dẫn có thể đã thay đổi hoặc không tồn tại.</p>
      <button className="button button-primary" onClick={onBack} type="button">Về trang tổng quan</button>
    </section>
  )
}

const roleLabels: Record<Role, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý đào tạo',
  admissions: 'Tuyển sinh',
  accountant: 'Kế toán',
  teacher: 'Giảng viên',
  ta: 'Trợ giảng',
  student: 'Học viên',
  guest: 'Khách',
}

function Icon({
  name,
  size = 20,
}: {
  name: string
  size?: number
}) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  }
  const paths: Record<string, ReactNode> = {
    cap: (
      <>
        <path d="m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z" />
        <path d="M6 11v5c3.7 2.7 8.3 2.7 12 0v-5" />
        <path d="M21.5 9v6" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    classes: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18M8 14h3M8 17h7" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m8 15 2 2 5-5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m17 8-5-5-5 5M12 3v12" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5M12 15V3" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
      </>
    ),
    chevronDown: <path d="m7 10 5 5 5-5" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    arrow: <path d="M5 12h14m-7-7 7 7-7 7" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    location: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
      </>
    ),
    filter: (
      <>
        <path d="M4 5h16M7 12h10m-7 7h4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...common}
    >
      {paths[name] ?? paths.dashboard}
    </svg>
  )
}

function PasswordField({
  id,
  label,
  name,
  autoComplete,
  placeholder,
  minLength,
}: {
  id: string
  label: string
  name: string
  autoComplete: string
  placeholder?: string
  minLength?: number
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input
          autoComplete={autoComplete}
          id={id}
          minLength={minLength}
          name={name}
          placeholder={placeholder}
          required
          type={visible ? 'text' : 'password'}
        />
        <button
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          className="password-toggle"
          onClick={() => setVisible((value) => !value)}
          type="button"
        >
          {visible ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
    </div>
  )
}

function LoginPage({
  onLogin,
  onConsultation,
  onBackToHome,
  initialMessage,
}: {
  onLogin: (user: User) => void
  onConsultation: () => void
  onBackToHome?: () => void
  initialMessage?: string
}) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(() =>
    new URLSearchParams(window.location.search).get('token') ? 'reset' : 'login',
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(initialMessage ?? '')
  const [error, setError] = useState('')
  const resetToken = new URLSearchParams(window.location.search).get('token')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    const fields = new FormData(event.currentTarget)
    try {
      if (mode === 'login') {
        const result = await apiRequest<{
          access_token: string
          refresh_token: string
          user: User
        }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            identifier: fields.get('identifier'),
            password: fields.get('password'),
          }),
        })
        saveTokens(result)
        onLogin(result.user)
      } else if (mode === 'forgot') {
        const result = await apiRequest<{ message: string }>('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: fields.get('email') }),
        })
        setMessage(result.message)
      } else {
        if (fields.get('new_password') !== fields.get('confirm_password')) {
          throw new Error('Mật khẩu xác nhận không khớp.')
        }
        await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            token: resetToken,
            new_password: fields.get('new_password'),
          }),
        })
        window.history.replaceState({}, '', '/login')
        setMode('login')
        setMessage('Mật khẩu đã được cập nhật. Hãy đăng nhập lại.')
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Không thể kết nối hệ thống. Vui lòng thử lại.',
      )
    } finally {
      setBusy(false)
    }
  }

  const heading =
    mode === 'login'
      ? 'Chào mừng trở lại'
      : mode === 'forgot'
        ? 'Khôi phục mật khẩu'
        : 'Tạo mật khẩu mới'

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div
          className="brand-lockup"
          onClick={onBackToHome}
          onKeyDown={onBackToHome ? (e) => { if (e.key === 'Enter' || e.key === ' ') onBackToHome() } : undefined}
          role={onBackToHome ? 'button' : undefined}
          style={onBackToHome ? { cursor: 'pointer' } : undefined}
          tabIndex={onBackToHome ? 0 : undefined}
          title={onBackToHome ? 'Về trang giới thiệu' : undefined}
        >
          <InstitutionBrand className="login-institution-brand" />
        </div>
        <div className="brand-message">
          <span className="eyebrow light-eyebrow">TRUNG TÂM ĐÀO TẠO</span>
          <h1>Kiến tạo tri thức.<br />Kết nối tương lai.</h1>
          <p>
            Một không gian học tập và quản lý đào tạo hiện đại dành cho giảng
            viên, học viên và nhà trường.
          </p>
        </div>
        <div className="brand-footer">
          <span>ICTU × CodeGym Vietnam</span>
          <span>© 2026 · Cổng đào tạo</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div
          className="login-mobile-brand"
          onClick={onBackToHome}
          onKeyDown={onBackToHome ? (e) => { if (e.key === 'Enter' || e.key === ' ') onBackToHome() } : undefined}
          role={onBackToHome ? 'button' : undefined}
          style={onBackToHome ? { cursor: 'pointer' } : undefined}
          tabIndex={onBackToHome ? 0 : undefined}
          title={onBackToHome ? 'Về trang giới thiệu' : undefined}
        >
          <InstitutionBrand className="login-mobile-institution-brand" />
        </div>
        <div className="login-form-wrap">
          {onBackToHome ? (
            <button
              className="text-button"
              onClick={onBackToHome}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--purple)',
                padding: '0 0 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
              type="button"
            >
              ← Quay lại trang giới thiệu
            </button>
          ) : null}
          <span className="eyebrow">CỔNG THÔNG TIN ĐÀO TẠO</span>
          <h2>{heading}</h2>
          <p className="login-subtitle">
            {mode === 'login'
              ? 'Đăng nhập để tiếp tục đến không gian học tập của bạn.'
              : mode === 'forgot'
                ? 'Nhập email đã đăng ký. Hướng dẫn khôi phục sẽ được gửi đến bạn.'
                : 'Mật khẩu cần có chữ cái, chữ số và ký tự đặc biệt.'}
          </p>

          <form aria-busy={busy} className="login-form" onSubmit={submit}>
            {mode !== 'reset' ? (
              <label className="field">
                <span>{mode === 'login' ? 'Email hoặc tên đăng nhập' : 'Email'}</span>
                <input
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  autoFocus
                  name={mode === 'login' ? 'identifier' : 'email'}
                  placeholder={mode === 'login' ? 'Email hoặc tên đăng nhập' : 'tenban@ictu.edu.vn'}
                  required
                  type={mode === 'login' ? 'text' : 'email'}
                />
              </label>
            ) : null}
            {mode === 'login' ? (
              <PasswordField autoComplete="current-password" id="login-password" label="Mật khẩu" name="password" placeholder="Nhập mật khẩu" />
            ) : null}
            {mode === 'reset' ? (
              <>
                <PasswordField autoComplete="new-password" id="new-password" label="Mật khẩu mới" minLength={8} name="new_password" placeholder="Ít nhất 8 ký tự, gồm chữ, số và ký tự đặc biệt" />
                <PasswordField autoComplete="new-password" id="confirm-password" label="Xác nhận mật khẩu mới" minLength={8} name="confirm_password" />
              </>
            ) : null}
            {error ? <div className="form-alert error-alert" role="alert">{error}</div> : null}
            {message ? <div className="form-alert success-alert" role="status">{message}</div> : null}
            {mode === 'login' ? (
              <button
                className="text-button forgot-link"
                onClick={() => {
                  setMode('forgot')
                  setError('')
                  setMessage('')
                }}
                type="button"
              >
                Quên mật khẩu?
              </button>
            ) : null}
            <button className="button button-primary login-submit" disabled={busy} type="submit">
              {busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : mode === 'forgot' ? 'Gửi yêu cầu' : 'Đặt lại mật khẩu'}
              {!busy && mode === 'login' ? <Icon name="arrow" size={18} /> : null}
            </button>
          </form>

          {mode === 'login' ? (
            <button className="text-button consultation-link" onClick={onConsultation} type="button">
              Bạn cần tư vấn tuyển sinh? Đăng ký tại đây
            </button>
          ) : null}

          {mode !== 'login' ? (
            <button
              className="text-button back-login"
              onClick={() => {
                setMode('login')
                setError('')
                setMessage('')
              }}
              type="button"
            >
              Quay lại đăng nhập
            </button>
          ) : (
            <div className="login-security-note">
              <Icon name="shield" size={17} />
              <span>Đăng nhập bảo mật · Phiên làm việc được mã hóa</span>
            </div>
          )}
        </div>
        <div className="login-bottom">Cần hỗ trợ? Liên hệ phòng đào tạo</div>
      </section>
    </main>
  )
}

function PasswordChangeModal({
  forced = false,
  onClose,
  onChanged,
}: {
  forced?: boolean
  onClose?: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!forced) return

    function keepFocusInside(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'input:not(:disabled), button:not(:disabled)',
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', keepFocusInside)
    return () => document.removeEventListener('keydown', keepFocusInside)
  }, [forced])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const values = new FormData(event.currentTarget)
    const newPassword = String(values.get('new_password') ?? '')
    if (newPassword !== values.get('confirm_password')) {
      setProblem('Mật khẩu xác nhận không khớp.')
      setBusy(false)
      return
    }
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: values.get('current_password'),
          new_password: newPassword,
        }),
      })
      onChanged()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Không thể đổi mật khẩu.')
      setBusy(false)
    }
  }

  return (
    <div className={`modal-backdrop ${forced ? 'forced-password-backdrop' : ''}`}>
      <section ref={dialogRef} aria-labelledby="password-modal-title" aria-modal="true" className="modal-card" role="dialog">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">BẢO MẬT TÀI KHOẢN</span>
            <h2 id="password-modal-title">{forced ? 'Yêu cầu đổi mật khẩu lần đầu' : 'Đổi mật khẩu'}</h2>
            {forced ? <p className="modal-description">Vì lý do bảo mật, hãy tạo mật khẩu mới để tiếp tục sử dụng hệ thống.</p> : null}
          </div>
          {!forced && onClose ? (
            <button aria-label="Đóng" className="icon-button modal-close" onClick={onClose} type="button"><Icon name="close" size={18} /></button>
          ) : null}
        </div>
        <form className="dialog-form" onSubmit={submit}>
          <label className="field"><span>Mật khẩu hiện tại <b>*</b></span><input autoComplete="current-password" autoFocus name="current_password" required type="password" /></label>
          <label className="field"><span>Mật khẩu mới <b>*</b></span><input autoComplete="new-password" minLength={8} name="new_password" placeholder="Ít nhất 8 ký tự, gồm chữ, số và ký tự đặc biệt" required type="password" /></label>
          <label className="field"><span>Xác nhận mật khẩu mới <b>*</b></span><input autoComplete="new-password" minLength={8} name="confirm_password" required type="password" /></label>
          {problem ? <div className="form-alert error-alert">{problem}</div> : null}
          <div className="modal-actions">
            {!forced && onClose ? <button className="button button-outline" onClick={onClose} type="button">Hủy</button> : null}
            <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

type NotificationItem = {
  id: number
  class_id: number | null
  lead_id: number | null
  title: string
  message: string
  scheduled_for: string | null
  is_read: boolean
  created_at: string
}

function NotificationsModal({
  onClose,
  onUnreadChange,
  onOpen,
}: {
  onClose: () => void
  onUnreadChange: (count: SetStateAction<number>) => void
  onOpen: (notification: NotificationItem, path: string) => void
}) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [unreadCount, setLocalUnreadCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<{ created_at: string; id: number } | null>(null)
  const [problem, setProblem] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    apiRequest<{
      unread_count: number
      items: NotificationItem[]
      has_more: boolean
      next_cursor: { created_at: string; id: number } | null
    }>('/notifications?limit=20')
      .then((result) => {
        if (active) {
          setItems(result.items)
          setHasMore(result.has_more)
          setNextCursor(result.next_cursor)
          setLocalUnreadCount(result.unread_count)
          onUnreadChange(result.unread_count)
        }
      })
      .catch((error: unknown) => {
        if (active) setProblem(error instanceof Error ? error.message : 'Không tải được thông báo.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [onUnreadChange, reloadKey])

  async function markRead(notification: NotificationItem): Promise<boolean> {
    if (notification.is_read) return true
    try {
      await apiRequest(`/notifications/${notification.id}/read`, { method: 'POST' })
      setItems((current) => current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item,
      ))
      setLocalUnreadCount((current) => Math.max(0, current - 1))
      onUnreadChange((current) => Math.max(0, current - 1))
      return true
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Không thể cập nhật thông báo.')
      return false
    }
  }

  async function loadMore() {
    if (!hasMore || loadingMore || !nextCursor) return
    setLoadingMore(true)
    setProblem('')
    const params = new URLSearchParams({
      limit: '20',
      cursor_created_at: nextCursor.created_at,
      cursor_id: String(nextCursor.id),
    })
    try {
      const result = await apiRequest<{
        unread_count: number
        items: NotificationItem[]
        has_more: boolean
        next_cursor: { created_at: string; id: number } | null
      }>(`/notifications?${params.toString()}`)
      setItems((current) => {
        const existing = new Set(current.map((item) => item.id))
        return [...current, ...result.items.filter((item) => !existing.has(item.id))]
      })
      setHasMore(result.has_more)
      setNextCursor(result.next_cursor)
      setLocalUnreadCount(result.unread_count)
      onUnreadChange(result.unread_count)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Không thể tải thêm thông báo.')
    } finally {
      setLoadingMore(false)
    }
  }

  async function markAllRead() {
    if (markingAll || unreadCount === 0) return
    setMarkingAll(true)
    setProblem('')
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' })
      setItems((current) => current.map((item) => ({ ...item, is_read: true })))
      setLocalUnreadCount(0)
      onUnreadChange(0)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Không thể đánh dấu thông báo đã đọc.')
    } finally {
      setMarkingAll(false)
    }
  }

  async function openNotification(notification: NotificationItem) {
    try {
      const result = await openNotificationWithPreflight(notification, {
        apiRequest,
        markRead: () => markRead(notification),
        onOpen: (path) => onOpen(notification, path),
      })
      if (result === 'unavailable') {
        setProblem('Nội dung liên quan không còn khả dụng hoặc thông báo thiếu thông tin đích. Thông báo vẫn ở trong hộp thư.')
      }
    } catch (error) {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        setProblem('Nội dung liên quan không còn khả dụng hoặc bạn không có quyền truy cập. Thông báo vẫn ở trong hộp thư.')
      } else {
        setProblem(error instanceof Error ? error.message : 'Không thể kiểm tra nội dung thông báo.')
      }
    }
  }

  return (
    <Modal eyebrow="CẬP NHẬT ĐÀO TẠO" onClose={onClose} size="large" title="Thông báo">
      {problem ? <div className="form-alert error-alert" role="alert">{problem}</div> : null}
      {unreadCount > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="text-button" disabled={markingAll} onClick={() => void markAllRead()} type="button">
            {markingAll ? 'Đang cập nhật…' : 'Đánh dấu tất cả đã đọc'}
          </button>
        </div>
      ) : null}
      <div
        className="notification-list"
        role="region"
        aria-label="Danh sách thông báo"
        tabIndex={0}
        onScroll={(event) => {
          const list = event.currentTarget
          if (list.scrollHeight - list.scrollTop - list.clientHeight < 60) void loadMore()
        }}
      >
        {loading ? <div className="table-loading">Đang tải thông báo…</div> : null}
        {!loading && items.map((notification) => (
          <article className={`notification-row ${notification.is_read ? 'notification-read' : ''}`} key={notification.id}>
            <span className="notification-row-icon"><Icon name="calendar" size={17} /></span>
            <div className="notification-row-content">
              <div>
                <button className="notification-open-link" onClick={() => void openNotification(notification)} type="button">
                  {notification.title}
                </button>
                {!notification.is_read ? <i /> : null}
              </div>
              <p>{notification.message}</p>
              {notification.scheduled_for ? (
                <small>Lịch nhắc: {new Date(notification.scheduled_for).toLocaleString('vi-VN')}</small>
              ) : null}
              <span>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.created_at))}</span>
            </div>
            <div className="notification-row-actions">
              {!notification.is_read ? <button className="text-button" onClick={() => void markRead(notification)} type="button">Đã đọc</button> : null}
              <button aria-label="Mở nội dung liên quan" className="icon-button row-action" onClick={() => void openNotification(notification)} title="Mở nội dung liên quan" type="button"><Icon name="arrow" size={16} /></button>
            </div>
          </article>
        ))}
        {!loading && !items.length && !problem ? <div className="empty-state compact-empty" role="status"><div className="empty-icon"><Icon name="bell" size={21} /></div><strong>Bạn đã cập nhật</strong><span>Thông báo về lịch học sẽ xuất hiện tại đây.</span></div> : null}
        {!loading && !items.length && problem ? (
          <button className="button button-outline" onClick={() => {
            setProblem('')
            setLoading(true)
            setReloadKey((value) => value + 1)
          }} type="button">
            Thử tải lại thông báo
          </button>
        ) : null}
        {hasMore ? <button className="button button-outline" disabled={loadingMore} onClick={() => void loadMore()} type="button">{loadingMore ? 'Đang tải…' : 'Tải thêm thông báo'}</button> : null}
      </div>
    </Modal>
  )
}

function AppShell({
  user,
  onLogout,
  onUserUpdate,
}: {
  user: User
  onLogout: (message?: string) => void
  onUserUpdate: (user: User) => void
}) {
  const [routePath, setRoutePath] = useState(() => window.location.pathname)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarCloseButtonRef = useRef<HTMLButtonElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notice, setNotice] = useState('')
  const notify = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 4200)
  }, [])

  useEffect(() => {
    if (user.must_change_password) return
    apiRequest<{ unread_count: number }>('/notifications')
      .then((result) => setUnreadCount(result.unread_count))
      .catch((error: unknown) => notify(error instanceof Error ? error.message : 'Không tải được số lượng thông báo.'))
  }, [notify, user.must_change_password])

  const [activeRoleView, setActiveRoleView] = useState<Role | 'all'>('all')
  const roles = useMemo(() => activeRoleView === 'all' ? user.roles : [activeRoleView], [activeRoleView, user.roles])
  const requestedPage = pageFromPath(routePath)
  const page: PageKey = canAccessPage(requestedPage, roles) ? requestedPage : 'forbidden'
  const canManage = roles.includes('admin') || roles.includes('manager')
  const canManageLeads = roles.includes('admin') || roles.includes('admissions')
  const canManageStudents = roles.some((role) => ['admin', 'manager', 'admissions'].includes(role))
  const canSeeLearning = roles.some((role) =>
    ['admin', 'manager', 'admissions', 'accountant', 'teacher', 'ta', 'student'].includes(role),
  )
  const canSeeAssignments = roles.some((role) =>
    ['admin', 'manager', 'teacher', 'ta', 'student'].includes(role),
  )

  type NavItem = { key: PageKey; label: string; icon: string }
  type NavGroup = { title: string; items: NavItem[] }

  const navGroups: NavGroup[] = [
    {
      title: 'TỔNG QUAN',
      items: [
        { key: 'dashboard', label: 'Tổng quan', icon: 'dashboard' },
      ],
    },
    ...(canManageLeads || canManageStudents
      ? [
          {
            title: 'TUYỂN SINH & HỌC VIÊN',
            items: [
              ...(canManageLeads ? [{ key: 'leads' as const, label: 'Danh sách Lead', icon: 'users' }] : []),
              ...(canManageStudents ? [{ key: 'students' as const, label: 'Danh sách học viên', icon: 'users' }] : []),
            ],
          },
        ]
      : []),
    ...(canManage
      ? [
          {
            title: 'CHƯƠNG TRÌNH & HỌC PHẦN',
            items: [
              { key: 'programs' as const, label: 'Chương trình đào tạo', icon: 'cap' },
              { key: 'courses' as const, label: 'Môn học', icon: 'book' },
              { key: 'rooms' as const, label: 'Phòng học', icon: 'location' },
            ],
          },
        ]
      : []),
    ...(canSeeLearning || canSeeAssignments
      ? [
          {
            title: 'LỚP HỌC & ĐÀO TẠO',
            items: [
              ...(canSeeLearning
                ? [{ key: 'classes' as const, label: canManage ? 'Danh sách lớp học' : 'Lớp của tôi', icon: 'classes' }]
                : []),
              ...(canSeeLearning
                ? [{ key: 'schedule' as const, label: 'Lịch tuần / tháng', icon: 'calendar' }]
                : []),
              ...(canSeeAssignments
                ? [{ key: 'assignments' as const, label: 'Bài tập', icon: 'book' }]
                : []),
              ...(roles.includes('student')
                ? [{ key: 'attendanceHistory' as const, label: 'Lịch sử điểm danh', icon: 'calendar' }]
                : []),
            ],
          },
        ]
      : []),
    ...(roles.some((role) => ['admin', 'manager', 'accountant', 'student'].includes(role))
      ? [{ title: 'TÀI CHÍNH & HỌC VỤ', items: [
          ...(roles.some((role) => ['admin', 'accountant', 'student'].includes(role)) ? [{ key: 'tuition' as const, label: 'Học phí và giao dịch', icon: 'book' }] : []),
          ...(roles.includes('student') ? [{ key: 'transcript' as const, label: 'Bảng điểm của tôi', icon: 'history' }] : []),
          ...(canManage ? [{ key: 'graduation' as const, label: 'Xét tốt nghiệp', icon: 'cap' }] : []),
          ...(roles.includes('manager') ? [{ key: 'discountReview' as const, label: 'Duyệt giảm học phí', icon: 'book' }] : []),
          ...(roles.some((role) => ['admin', 'manager', 'student'].includes(role)) ? [{ key: 'surveys' as const, label: 'Khảo sát cuối khóa', icon: 'book' }] : []),
        ] }]
      : []),
    ...(canManage
      ? [
          {
            title: 'QUẢN TRỊ HỆ THỐNG',
            items: [
              { key: 'accounts' as const, label: 'Tài khoản hệ thống', icon: 'shield' },
              ...(roles.includes('admin')
                ? [{ key: 'auditLogs' as const, label: 'Nhật ký thao tác', icon: 'history' }]
                : []),
            ],
          },
        ]
      : []),
  ]

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  function isItemActive(itemKey: PageKey): boolean {
    return (
      page === itemKey ||
      (page === 'accountEditor' && itemKey === 'accounts') ||
      (page === 'leadDetail' && itemKey === 'leads') ||
      (['studentEditor', 'studentEnrollment', 'studentDetail'].includes(page) && itemKey === 'students') ||
      (['courseEditor', 'courseLessons'].includes(page) && itemKey === 'courses') ||
      (page === 'programCurriculum' && itemKey === 'programs') ||
      (page === 'sessionDetail' && itemKey === 'schedule') ||
      (['classRoster', 'attendanceMatrix', 'classEditor', 'classSchedule'].includes(page) && itemKey === 'classes')
    )
  }

  function isGroupActive(group: NavGroup): boolean {
    return group.items.some((item) => isItemActive(item.key))
  }

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }))
  }

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return
      if (href.startsWith('/') && !href.startsWith('//') && !anchor.hasAttribute('download') && anchor.target !== '_blank') {
        event.preventDefault()
        navigateTo(href)
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  useEffect(() => {
    const handlePopState = () => setRoutePath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (user.must_change_password) return
    let active = true
    let objectUrl: string | null = null
    apiBlobRequest('/me/avatar')
      .then((blob) => {
        if (!active || blob.size === 0) {
          if (active) setAvatarUrl(null)
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setAvatarUrl(objectUrl)
      })
      .catch((error: unknown) => {
        if (active) {
          notify(error instanceof Error ? error.message : 'Không tải được ảnh đại diện.')
        }
        if (active) setAvatarUrl(null)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [avatarVersion, notify, user.id, user.must_change_password])

  useEffect(() => {
    if (!profileMenuOpen) return
    function dismissMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setProfileMenuOpen(false)
        return
      }
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', dismissMenu)
    document.addEventListener('keydown', dismissMenu)
    return () => {
      document.removeEventListener('mousedown', dismissMenu)
      document.removeEventListener('keydown', dismissMenu)
    }
  }, [profileMenuOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const returnFocusButton = mobileMenuButtonRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebarCloseButtonRef.current?.focus()

    function manageDrawerKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileMenuOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', manageDrawerKeyboard)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', manageDrawerKeyboard)
      returnFocusButton?.focus()
    }
  }, [mobileMenuOpen])

  function navigate(nextPage: PageKey) {
    const allowed = canAccessPage(nextPage, roles)
    const destination = allowed ? nextPage : 'forbidden'
    navigateTo(pagePaths[destination])
  }

  async function logout() {
    const refreshToken = sessionStorage.getItem('ictu_refresh_token')
    try {
      if (refreshToken) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
      }
    } catch {
      notify('Không thể liên hệ máy chủ để thu hồi phiên. Phiên trên thiết bị đã được xóa.')
    } finally {
      clearTokens()
      navigateTo('/login')
      onLogout()
    }
  }

  return (
    <div className="app-layout">
      <button
        aria-label="Đóng menu"
        className={`mobile-scrim ${mobileMenuOpen ? 'visible' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        type="button"
      />
      <aside
        aria-label="Menu điều hướng"
        aria-modal={mobileMenuOpen ? 'true' : undefined}
        className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}
        id="primary-navigation"
        ref={sidebarRef}
        role={mobileMenuOpen ? 'dialog' : undefined}
      >
        <button
          aria-label="Đóng menu"
          className="sidebar-close-button icon-button"
          onClick={() => setMobileMenuOpen(false)}
          ref={sidebarCloseButtonRef}
          type="button"
        >
          <Icon name="close" size={20} />
        </button>
        <InstitutionBrand className="sidebar-brand" />
        <div className="sidebar-caption">KHÔNG GIAN ĐÀO TẠO</div>
        <nav className="side-navigation" aria-label="Điều hướng chính">
          {navGroups.map((group) => {
            const hasActiveItem = isGroupActive(group)
            const isCollapsed = Boolean(collapsedGroups[group.title]) && !hasActiveItem
            return (
              <div className="nav-group" key={group.title}>
                <div
                  className="nav-group-header"
                  onClick={() => toggleGroup(group.title)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleGroup(group.title)
                    }
                  }}
                >
                  <span className="nav-group-label">{group.title}</span>
                  <button
                    aria-expanded={!isCollapsed}
                    aria-label={`Thu gọn/mở rộng nhóm ${group.title}`}
                    className="nav-group-toggle"
                    type="button"
                  >
                    <Icon name="chevronDown" size={13} />
                  </button>
                </div>
                {!isCollapsed ? (
                  <div className="nav-group-items">
                    {group.items.map((item) => {
                      const isCurrentPage = isItemActive(item.key)
                      return (
                        <a
                          aria-current={isCurrentPage ? 'page' : undefined}
                          className={`nav-item ${isCurrentPage ? 'active' : ''}`}
                          href={pagePaths[item.key]}
                          key={item.key}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Icon name={item.icon} size={19} />
                          <span>{item.label}</span>
                          {isCurrentPage ? <span className="nav-active-mark" /> : null}
                        </a>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Icon name="shield" size={18} /></div>
            <strong>Hỗ trợ đào tạo</strong>
            <span>Luôn sẵn sàng đồng hành cùng bạn</span>
            <a href="mailto:daotao@ictu.edu.vn">Liên hệ hỗ trợ <Icon name="arrow" size={14} /></a>
          </div>
          <div className="sidebar-user">
            <div className="avatar avatar-purple">
              {avatarUrl ? <img alt="" className="avatar-image" src={avatarUrl} /> : user.full_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <strong>{user.full_name}</strong>
              <span>{roles.map((role) => roleLabels[role]).join(' · ') || 'Người dùng'}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            aria-label="Mở menu"
            aria-controls="primary-navigation"
            aria-expanded={mobileMenuOpen}
            className="mobile-menu-button icon-button"
            onClick={() => setMobileMenuOpen(true)}
            ref={mobileMenuButtonRef}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="breadcrumb">
            <a href="/dashboard">ICTU Portal</a>
            <span className="breadcrumb-divider">/</span>
            {page === 'classRoster' || page === 'attendanceMatrix' || page === 'classEditor' || page === 'classSchedule' ? (
              <>
                <a href="/classes">Lớp học</a>
                <span className="breadcrumb-divider">/</span>
                <strong>{pageTitle[page]}</strong>
              </>
            ) : page === 'openClass' ? (
              <>
                <a href="/classes">Lớp học</a>
                <span className="breadcrumb-divider">/</span>
                <strong>Mở lớp mới</strong>
              </>
            ) : page === 'studentDetail' || page === 'studentEditor' || page === 'studentEnrollment' ? (
              <>
                <a href="/students">Học viên</a>
                <span className="breadcrumb-divider">/</span>
                <strong>{pageTitle[page]}</strong>
              </>
            ) : page === 'leadDetail' ? (
              <>
                <a href="/leads">Tuyển sinh</a>
                <span className="breadcrumb-divider">/</span>
                <strong>Chi tiết hồ sơ</strong>
              </>
            ) : page === 'courseEditor' || page === 'courseLessons' ? (
              <>
                <a href="/courses">Môn học</a>
                <span className="breadcrumb-divider">/</span>
                <strong>{pageTitle[page]}</strong>
              </>
            ) : page === 'programCurriculum' ? (
              <>
                <a href="/programs">Chương trình đào tạo</a>
                <span className="breadcrumb-divider">/</span>
                <strong>Khung chương trình</strong>
              </>
            ) : page === 'sessionDetail' || page === 'autoSchedule' || page === 'scheduleConflicts' ? (
              <>
                <a href="/schedule">Thời khóa biểu</a>
                <span className="breadcrumb-divider">/</span>
                <strong>{pageTitle[page]}</strong>
              </>
            ) : page === 'accountEditor' ? (
              <>
                <a href="/accounts">Tài khoản</a>
                <span className="breadcrumb-divider">/</span>
                <strong>Chỉnh sửa tài khoản</strong>
              </>
            ) : (
              <strong>{pageTitle[page]}</strong>
            )}
          </div>
          <div className="topbar-right">
            {user.roles.length > 1 ? (
              <div className="role-switcher" title="Chuyển góc nhìn theo vai trò được cấp">
                <span className="role-switcher-icon"><Icon name="shield" size={14} /></span>
                <span className="role-switcher-label">Xem với vai trò:</span>
                <select
                  aria-label="Chuyển góc nhìn vai trò"
                  className="role-switcher-select"
                  onChange={(e) => {
                    const nextRole = e.target.value as Role | 'all'
                    setActiveRoleView(nextRole)
                    const nextRoles = nextRole === 'all' ? user.roles : [nextRole]
                    const currentTarget = pageFromPath(window.location.pathname)
                    if (!canAccessPage(currentTarget, nextRoles)) {
                      navigateTo('/dashboard')
                    }
                  }}
                  value={activeRoleView}
                >
                  <option value="all">Tất cả vai trò ({user.roles.length})</option>
                  {user.roles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <span className="academic-year"><span className="status-dot" /> Năm học 2026–2027</span>
            <div className="topbar-divider" />
            <button className="icon-button notification-button" aria-label="Thông báo" onClick={() => setNotificationsOpen(true)} title="Thông báo" type="button">
              <Icon name="bell" size={19} />{unreadCount > 0 ? <i /> : null}
            </button>
            <div className="profile-menu-anchor" ref={profileMenuRef}>
              <button
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                aria-label="Mở menu tài khoản"
                className={`profile-button ${profileMenuOpen ? 'profile-button-open' : ''}`}
                onClick={() => setProfileMenuOpen((open) => !open)}
                title="Tài khoản cá nhân"
                type="button"
              >
                <div className="topbar-avatar avatar">
                  {avatarUrl ? <img alt="" className="avatar-image" src={avatarUrl} /> : user.full_name.slice(0, 1).toUpperCase()}
                </div>
                <Icon name="chevronDown" size={15} />
              </button>
              {profileMenuOpen ? (
                <div aria-label="Menu tài khoản" className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-heading">
                    <strong>{user.full_name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <button className="profile-dropdown-item" onClick={() => {
                    setProfileMenuOpen(false)
                    setProfileOpen(true)
                  }} role="menuitem" type="button">
                    <Icon name="users" size={17} /> Cài đặt hồ sơ
                  </button>
                  <button className="profile-dropdown-item" onClick={() => {
                    setProfileMenuOpen(false)
                    setChangePasswordOpen(true)
                  }} role="menuitem" type="button">
                    <Icon name="shield" size={17} /> Đổi mật khẩu
                  </button>
                  <div className="profile-dropdown-divider" />
                  <button className="profile-dropdown-item profile-dropdown-logout" onClick={() => {
                    setProfileMenuOpen(false)
                    void logout()
                  }} role="menuitem" type="button">
                    <Icon name="logout" size={17} /> Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="content-area">
          <Suspense fallback={<div aria-live="polite" className="panel loading-panel">Đang mở chức năng…</div>}>
          {page === 'forbidden' ? <ForbiddenPage onBack={() => navigate('dashboard')} /> : null}
          {page === 'notFound' ? <NotFoundPage onBack={() => navigate('dashboard')} /> : null}
          {page === 'dashboard' ? <DashboardPage user={user} onNavigate={navigate} notify={notify} /> : null}
          {page === 'accounts' && canManage ? <AccountsPage user={user} notify={notify} /> : null}
          {page === 'accountEditor' ? (
            <AccountEditPage
              accountId={Number(window.location.pathname.match(/^\/accounts\/(\d+)\/edit$/)?.[1])}
              notify={notify}
            />
          ) : null}
          {page === 'courses' && canManage ? <CoursesPage notify={notify} /> : null}
          {page === 'courseEditor' ? (
            <CourseEditorPage
              courseId={Number(window.location.pathname.match(/^\/courses\/(\d+)\/edit$/)?.[1]) || null}
              notify={notify}
            />
          ) : null}
          {page === 'courseLessons' ? (
            <CourseLessonsPage courseId={Number(window.location.pathname.match(/^\/courses\/(\d+)\/lessons$/)?.[1])} />
          ) : null}
          {page === 'programs' && canManage ? <StudyProgramsPage /> : null}
          {page === 'programCurriculum' ? (
            <ProgramCurriculumPage
              notify={notify}
              programId={Number(window.location.pathname.match(/^\/programs\/(\d+)\/courses$/)?.[1])}
            />
          ) : null}
          {page === 'classes' ? <ClassesPage user={user} notify={notify} /> : null}
          {page === 'openClass' && canManage ? <OpenClassPage user={user} notify={notify} /> : null}
          {page === 'classEditor' ? (
            <ClassWorkflowPage
              classId={Number(window.location.pathname.match(/^\/classes\/(\d+)\/edit$/)?.[1]) || null}
              mode={window.location.pathname === '/classes/new' ? 'create' : 'edit'}
              notify={notify}
            />
          ) : null}
          {page === 'classSchedule' ? (
            <ClassWorkflowPage
              classId={Number(window.location.pathname.match(/^\/classes\/(\d+)\/schedule$/)?.[1]) || null}
              mode="schedule"
              notify={notify}
            />
          ) : null}
          {page === 'classRoster' ? (
            <ClassRosterPage
              classId={Number(window.location.pathname.match(/^\/classes\/(\d+)/)?.[1])}
              section={(window.location.pathname.match(/^\/classes\/\d+\/(students|enroll|attendance|tuition|schedule)$/)?.[1] || 'students') as any}
              notify={notify}
              user={user}
            />
          ) : null}
          {page === 'attendanceMatrix' ? (
            <AttendanceMatrixPage
              canExport={user.roles.some((role) => role === 'admin' || role === 'manager')}
              classId={Number(window.location.pathname.match(/^\/classes\/(\d+)\/attendance\/matrix$/)?.[1])}
            />
          ) : null}
          {page === 'schedule' ? (
            <SchedulePage
              key={new URLSearchParams(window.location.search).get('class_id') ?? 'all-classes'}
              user={user}
              notify={notify}
            />
          ) : null}
          {page === 'autoSchedule' && canManage ? (
            <AutoSchedulePage
              classId={Number(new URLSearchParams(window.location.search).get('class_id')) || undefined}
              notify={notify}
              user={user}
            />
          ) : null}
          {page === 'scheduleConflicts' && canManage ? (
            <ScheduleConflictsPage notify={notify} user={user} />
          ) : null}
          {page === 'sessionDetail' ? (
            <ScheduleSessionPage
              notify={notify}
              sessionId={Number(window.location.pathname.match(/^\/schedule\/sessions\/(\d+)$/)?.[1])}
              user={user}
            />
          ) : null}
          {page === 'assignments' ? <AssignmentsPage user={user} notify={notify} /> : null}
          {page === 'attendanceHistory' ? <StudentAttendanceHistoryPage /> : null}
          {page === 'tuition' ? <TuitionPage user={user} notify={notify} /> : null}
          {page === 'discountReview' ? <DiscountReviewPage user={user} notify={notify} /> : null}
          {page === 'transcript' ? <TranscriptPage user={user} notify={notify} /> : null}
          {page === 'graduation' ? <GraduationPage user={user} notify={notify} /> : null}
          {page === 'surveys' ? <SurveysPage user={user} notify={notify} /> : null}
          {page === 'leads' && canManageLeads ? <LeadsPage /> : null}
          {page === 'leadDetail' ? (
            <LeadDetailPage
              leadId={Number(window.location.pathname.match(/^\/leads\/(\d+)$/)?.[1])}
            />
          ) : null}
          {page === 'students' && canManageStudents ? <StudentRecordsPage /> : null}
          {page === 'studentDetail' ? (
            <StudentDetailPage
              notify={notify}
              studentId={Number(window.location.pathname.match(/^\/students\/(\d+)$/)?.[1])}
              user={user}
            />
          ) : null}
          {page === 'studentEditor' || page === 'studentEnrollment' ? (
            <StudentWorkflowPage
              action={page === 'studentEditor' ? 'edit' : 'enrollment'}
              studentId={Number(window.location.pathname.match(/^\/students\/(\d+)\/(?:edit|enrollment)$/)?.[1])}
            />
          ) : null}
          {page === 'rooms' && canManage ? <RoomsPage /> : null}
          {page === 'auditLogs' && roles.includes('admin') ? <AuditLogsPage /> : null}
          </Suspense>
        </div>
        <footer className="app-footer">
          <span>ICTU × CodeGym Vietnam</span>
          <span>Hệ thống quản lý đào tạo <i /> Phiên bản 1.0</span>
        </footer>
      </main>
      {notice ? <div className="toast-message" role="status">{notice}</div> : null}
      {profileOpen ? (
        <ProfileModal
          avatarUrl={avatarUrl}
          onAvatarChanged={() => setAvatarVersion((value) => value + 1)}
          onClose={() => setProfileOpen(false)}
          onPasswordChange={() => {
            setProfileOpen(false)
            setChangePasswordOpen(true)
          }}
          onUserUpdated={onUserUpdate}
          user={user}
        />
      ) : null}
      {changePasswordOpen || user.must_change_password ? (
        <PasswordChangeModal
          forced={user.must_change_password}
          onChanged={() => {
            if (user.must_change_password) {
              onUserUpdate({ ...user, must_change_password: false })
              navigateTo('/dashboard')
              notify('Đổi mật khẩu thành công. Chào mừng bạn đến với hệ thống.')
              return
            }
            clearTokens()
            onLogout('Mật khẩu đã được thay đổi. Hãy đăng nhập lại bằng mật khẩu mới.')
          }}
          onClose={user.must_change_password ? undefined : () => setChangePasswordOpen(false)}
        />
      ) : null}
      {notificationsOpen ? (
        <NotificationsModal
          onClose={() => setNotificationsOpen(false)}
          onOpen={(_notification, path) => {
            setNotificationsOpen(false)
            navigateTo(path)
          }}
          onUnreadChange={setUnreadCount}
        />
      ) : null}
    </div>
  )
}

export default function App() {
  useEffect(() => {
    document.title = 'Hệ thống Quản lý Đào tạo'
  }, [])

  const isPasswordResetRoute =
    window.location.pathname === '/reset-password' &&
    Boolean(new URLSearchParams(window.location.search).get('token'))
  const [user, setUser] = useState<User | null>(null)
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [checkingSession, setCheckingSession] = useState(
    () => hasSession() && !isPasswordResetRoute,
  )
  const [loginMessage, setLoginMessage] = useState('')
  const [consultationOpen, setConsultationOpen] = useState(false)

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (isPasswordResetRoute) {
      clearTokens()
      return
    }
    if (!hasSession()) {
      return
    }
    apiRequest<User>('/me')
      .then(setUser)
      .catch(() => {
        clearTokens()
        setUser(null)
      })
      .finally(() => setCheckingSession(false))
  }, [isPasswordResetRoute])

  if (checkingSession) {
    return (
      <div className="app-loading">
        <div className="loading-mark"><img alt="Logo ICTU" src="/ictu-logo.png" /></div>
        <span>Đang kết nối cổng đào tạo…</span>
      </div>
    )
  }


  // Trang chủ mặc định công khai: hiển thị Landing Page
  if (isLandingPath(currentPath)) {
    return (
      <>
        <Suspense fallback={<div aria-live="polite" className="app-loading">Đang tải trang…</div>}>
          <LandingPage
            user={user}
            onLoginClick={() => navigateTo('/login')}
            onGoToDashboard={() => navigateTo('/dashboard')}
            onConsultationClick={() => setConsultationOpen(true)}
          />
          {consultationOpen ? <PublicLeadModal onClose={() => setConsultationOpen(false)} /> : null}
        </Suspense>
      </>
    )
  }

  // Khi đã đăng nhập và truy cập trang quản lý nghiệp vụ
  if (user) {
    return (
      <AppShell
        user={user}
        onUserUpdate={setUser}
        onLogout={(message) => {
          setUser(null)
          setLoginMessage(message ?? '')
          navigateTo('/login')
        }}
      />
    )
  }

  // Khi chưa đăng nhập (tại /login, /reset-password hoặc chuyển hướng từ trang quản lý)
  return (
    <>
      <LoginPage
        initialMessage={loginMessage}
        onBackToHome={() => navigateTo('/')}
        onLogin={(loggedInUser) => {
          setLoginMessage('')
          setUser(loggedInUser)
          navigateTo('/dashboard')
        }}
        onConsultation={() => setConsultationOpen(true)}
      />
      {consultationOpen ? <PublicLeadModal onClose={() => setConsultationOpen(false)} /> : null}
    </>
  )
}
