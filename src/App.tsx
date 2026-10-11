import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode, SetStateAction } from 'react'
import { apiBlobRequest, apiRequest, clearTokens, hasSession, saveTokens } from './api'
import { Modal } from './components/Ui'
import { ProfileModal } from './components/ProfileModal'
import { LeadsPage, PublicLeadModal } from './pages/LeadsPage'
import { StudentRecordsPage } from './pages/StudentRecordsPage'
import { RoomsPage } from './pages/RoomsPage'
import {
  AccountsPage,
  ClassesPage,
  CoursesPage,
  DashboardPage,
  SchedulePage,
  AssignmentsPage,
} from './ManagementPages'
import type { Role, User } from './types'
import './App.css'

type PageKey = 'dashboard' | 'accounts' | 'courses' | 'classes' | 'schedule' | 'assignments' | 'leads' | 'students' | 'rooms' | 'forbidden'

const pageTitle: Record<PageKey, string> = {
  dashboard: 'Tổng quan',
  accounts: 'Quản lý tài khoản',
  courses: 'Chương trình đào tạo',
  classes: 'Lớp học phần',
  schedule: 'Thời khóa biểu',
  assignments: 'Bài tập',
  leads: 'Hồ sơ tư vấn tuyển sinh',
  students: 'Hồ sơ học viên',
  rooms: 'Phòng học',
  forbidden: '403 · Không có quyền truy cập',
}

const pagePaths: Record<PageKey, string> = {
  dashboard: '/',
  accounts: '/accounts',
  courses: '/courses',
  classes: '/classes',
  schedule: '/schedule',
  assignments: '/assignments',
  leads: '/leads',
  students: '/students',
  rooms: '/rooms',
  forbidden: '/403',
}

function pageFromPath(pathname: string): PageKey {
  return (Object.entries(pagePaths).find(([, path]) => path === pathname)?.[0] as PageKey | undefined) ?? 'dashboard'
}

function canAccessPage(page: PageKey, roles: Role[]): boolean {
  if (page === 'dashboard' || page === 'forbidden') return true
  const canManage = roles.includes('admin') || roles.includes('manager')
  if (page === 'accounts' || page === 'courses' || page === 'rooms') return canManage
  if (page === 'leads') return roles.includes('admin') || roles.includes('admissions')
  if (page === 'students') return roles.some((role) => ['admin', 'manager', 'admissions'].includes(role))
  if (page === 'assignments') return roles.some((role) => ['admin', 'manager', 'teacher', 'ta', 'student'].includes(role))
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

function LoginPage({
  onLogin,
  onConsultation,
  initialMessage,
}: {
  onLogin: (user: User) => void
  onConsultation: () => void
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
        window.history.replaceState({}, '', '/')
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
        <div className="brand-lockup">
          <div className="brand-mark">
            <Icon name="cap" size={25} />
          </div>
          <div>
            <strong>ICTU</strong>
            <span>ACADEMIC PORTAL</span>
          </div>
        </div>
        <div className="brand-message">
          <span className="eyebrow light-eyebrow">TRUNG TÂM ĐÀO TẠO</span>
          <h1>Kiến tạo tri thức.<br />Kết nối tương lai.</h1>
          <p>
            Một không gian học tập và quản lý đào tạo hiện đại dành cho giảng
            viên, học viên và nhà trường.
          </p>
          <div className="campus-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-cap"><Icon name="cap" size={92} /></div>
            <span className="art-spark spark-one">✦</span>
            <span className="art-spark spark-two">✧</span>
          </div>
        </div>
        <div className="brand-footer">
          <span>ICTU × CodeGym Vietnam</span>
          <span>© 2026 · Cổng đào tạo</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-mobile-brand">
          <div className="brand-mark"><Icon name="cap" size={22} /></div>
          <strong>ICTU <span>ACADEMIC PORTAL</span></strong>
        </div>
        <div className="login-form-wrap">
          <span className="eyebrow">CỔNG THÔNG TIN ĐÀO TẠO</span>
          <h2>{heading}</h2>
          <p className="login-subtitle">
            {mode === 'login'
              ? 'Đăng nhập để tiếp tục đến không gian học tập của bạn.'
              : mode === 'forgot'
                ? 'Nhập email đã đăng ký. Hướng dẫn khôi phục sẽ được gửi đến bạn.'
                : 'Mật khẩu cần có chữ cái, chữ số và ký tự đặc biệt.'}
          </p>

          <form className="login-form" onSubmit={submit}>
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
              <label className="field">
                <span>Mật khẩu</span>
                <input
                  autoComplete="current-password"
                  name="password"
                  placeholder="Nhập mật khẩu"
                  required
                  type="password"
                />
              </label>
            ) : null}
            {mode === 'reset' ? (
              <>
                <label className="field">
                  <span>Mật khẩu mới</span>
                  <input
                    autoComplete="new-password"
                    minLength={8}
                    name="new_password"
                    placeholder="Ít nhất 8 ký tự, gồm chữ, số và ký tự đặc biệt"
                    required
                    type="password"
                  />
                </label>
                <label className="field">
                  <span>Xác nhận mật khẩu mới</span>
                  <input
                    autoComplete="new-password"
                    minLength={8}
                    name="confirm_password"
                    required
                    type="password"
                  />
                </label>
              </>
            ) : null}
            {error ? <div className="form-alert error-alert">{error}</div> : null}
            {message ? <div className="form-alert success-alert">{message}</div> : null}
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
            <button className="button button-primary login-submit" disabled={busy}>
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
  onSchedule,
}: {
  onClose: () => void
  onUnreadChange: (count: SetStateAction<number>) => void
  onSchedule: () => void
}) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    apiRequest<{ unread_count: number; items: NotificationItem[] }>('/notifications')
      .then((result) => {
        setItems(result.items)
        onUnreadChange(result.unread_count)
      })
      .catch((error: unknown) => {
        setProblem(error instanceof Error ? error.message : 'Không tải được thông báo.')
      })
      .finally(() => setLoading(false))
  }, [onUnreadChange])

  async function markRead(notification: NotificationItem) {
    if (notification.is_read) return
    try {
      await apiRequest(`/notifications/${notification.id}/read`, { method: 'POST' })
      setItems((current) => current.map((item) =>
        item.id === notification.id ? { ...item, is_read: true } : item,
      ))
      onUnreadChange((current) => Math.max(0, current - 1))
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Không thể cập nhật thông báo.')
    }
  }

  return (
    <Modal eyebrow="CẬP NHẬT ĐÀO TẠO" onClose={onClose} size="large" title="Thông báo">
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      <div className="notification-list">
        {loading ? <div className="table-loading">Đang tải thông báo…</div> : null}
        {!loading && items.map((notification) => (
          <article className={`notification-row ${notification.is_read ? 'notification-read' : ''}`} key={notification.id}>
            <span className="notification-row-icon"><Icon name="calendar" size={17} /></span>
            <div className="notification-row-content">
              <div><strong>{notification.title}</strong>{!notification.is_read ? <i /> : null}</div>
              <p>{notification.message}</p>
              {notification.scheduled_for ? (
                <small>Lịch nhắc: {new Date(notification.scheduled_for).toLocaleString('vi-VN')}</small>
              ) : null}
              <span>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.created_at))}</span>
            </div>
            <div className="notification-row-actions">
              {!notification.is_read ? <button className="text-button" onClick={() => void markRead(notification)} type="button">Đã đọc</button> : null}
              {notification.class_id ? <button className="icon-button row-action" onClick={() => {
                void markRead(notification)
                onSchedule()
              }} title="Mở thời khóa biểu" type="button"><Icon name="arrow" size={16} /></button> : null}
            </div>
          </article>
        ))}
        {!loading && !items.length ? <div className="empty-state compact-empty"><div className="empty-icon"><Icon name="bell" size={21} /></div><strong>Bạn đã cập nhật</strong><span>Thông báo về lịch học sẽ xuất hiện tại đây.</span></div> : null}
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
  const [page, setPage] = useState<PageKey>(() => {
    const requestedPage = pageFromPath(window.location.pathname)
    return canAccessPage(requestedPage, user.roles) ? requestedPage : 'forbidden'
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
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

  const roles = user.roles
  const canManage = roles.includes('admin') || roles.includes('manager')
  const canManageLeads = roles.includes('admin') || roles.includes('admissions')
  const canManageStudents = roles.some((role) => ['admin', 'manager', 'admissions'].includes(role))
  const canSeeLearning = roles.some((role) =>
    ['admin', 'manager', 'admissions', 'accountant', 'teacher', 'ta', 'student'].includes(role),
  )
  const canSeeAssignments = roles.some((role) =>
    ['admin', 'manager', 'teacher', 'ta', 'student'].includes(role),
  )
  const navigation: { key: PageKey; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Tổng quan', icon: 'dashboard' },
    ...(canManage
      ? [
          { key: 'accounts' as const, label: 'Tài khoản', icon: 'users' },
          { key: 'courses' as const, label: 'Chương trình đào tạo', icon: 'book' },
          { key: 'rooms' as const, label: 'Phòng học', icon: 'location' },
        ]
      : []),
    ...(canManageStudents
      ? [{ key: 'students' as const, label: 'Hồ sơ học viên', icon: 'users' }]
      : []),
    ...(canSeeLearning
      ? [
          { key: 'classes' as const, label: canManage ? 'Lớp học phần' : 'Lớp của tôi', icon: 'classes' },
          { key: 'schedule' as const, label: 'Thời khóa biểu', icon: 'calendar' },
        ]
      : []),
    ...(canSeeAssignments
      ? [{ key: 'assignments' as const, label: 'Bài tập', icon: 'book' }]
      : []),
    ...(canManageLeads
      ? [{ key: 'leads' as const, label: 'Tuyển sinh', icon: 'users' }]
      : []),
  ]

  useEffect(() => {
    const requestedPage = pageFromPath(window.location.pathname)
    if (!canAccessPage(requestedPage, roles)) {
      window.history.replaceState({ page: 'forbidden' }, '', '/403')
    }
    const handlePopState = () => {
      const target = pageFromPath(window.location.pathname)
      if (canAccessPage(target, roles)) {
        setPage(target)
      } else {
        window.history.replaceState({ page: 'forbidden' }, '', '/403')
        setPage('forbidden')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [roles])

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

  function navigate(nextPage: PageKey) {
    const allowed = canAccessPage(nextPage, roles)
    const destination = allowed ? nextPage : 'forbidden'
    window.history.pushState({ page: destination }, '', pagePaths[destination])
    setPage(destination)
    setMobileMenuOpen(false)
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
      window.history.pushState({}, '', '/login')
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
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Icon name="cap" size={25} /></div>
          <div>
            <strong>ICTU</strong>
            <span>ACADEMIC PORTAL</span>
          </div>
        </div>
        <div className="sidebar-caption">KHÔNG GIAN ĐÀO TẠO</div>
        <nav className="side-navigation" aria-label="Điều hướng chính">
          {navigation.map((item) => (
            <button
              className={`nav-item ${page === item.key ? 'active' : ''}`}
              key={item.key}
              onClick={() => navigate(item.key)}
              type="button"
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {page === item.key ? <span className="nav-active-mark" /> : null}
            </button>
          ))}
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
            className="mobile-menu-button icon-button"
            onClick={() => setMobileMenuOpen(true)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="breadcrumb">
            <span>ICTU Portal</span><span className="breadcrumb-divider">/</span><strong>{pageTitle[page]}</strong>
          </div>
          <div className="topbar-right">
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
                    <strong>Nguyễn Văn Thanh</strong>
                    <span>dtc245200503@ictu.edu.vn</span>
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
          {page === 'forbidden' ? <ForbiddenPage onBack={() => navigate('dashboard')} /> : null}
          {page === 'dashboard' ? <DashboardPage user={user} onNavigate={navigate} notify={notify} /> : null}
          {page === 'accounts' && canManage ? <AccountsPage user={user} notify={notify} /> : null}
          {page === 'courses' && canManage ? <CoursesPage notify={notify} /> : null}
          {page === 'classes' ? <ClassesPage user={user} notify={notify} /> : null}
          {page === 'schedule' ? <SchedulePage user={user} notify={notify} /> : null}
          {page === 'assignments' ? <AssignmentsPage user={user} notify={notify} /> : null}
          {page === 'leads' && canManageLeads ? <LeadsPage /> : null}
          {page === 'students' && canManageStudents ? <StudentRecordsPage /> : null}
          {page === 'rooms' && canManage ? <RoomsPage /> : null}
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
              setPage('dashboard')
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
          onSchedule={() => {
            setNotificationsOpen(false)
            navigate('schedule')
          }}
          onUnreadChange={setUnreadCount}
        />
      ) : null}
    </div>
  )
}

export default function App() {
  const isPasswordResetRoute =
    window.location.pathname === '/reset-password' &&
    Boolean(new URLSearchParams(window.location.search).get('token'))
  const [user, setUser] = useState<User | null>(null)
  const [checkingSession, setCheckingSession] = useState(
    () => hasSession() && !isPasswordResetRoute,
  )
  const [loginMessage, setLoginMessage] = useState('')
  const [consultationOpen, setConsultationOpen] = useState(false)

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
    return <div className="app-loading"><div className="loading-mark"><Icon name="cap" size={28} /></div><span>Đang kết nối cổng đào tạo…</span></div>
  }

  return user ? (
    <AppShell
      user={user}
      onUserUpdate={setUser}
      onLogout={(message) => {
        setUser(null)
        setLoginMessage(message ?? '')
      }}
    />
  ) : (
    <>
      <LoginPage
        initialMessage={loginMessage}
        onLogin={(loggedInUser) => {
          setLoginMessage('')
          setUser(loggedInUser)
        }}
        onConsultation={() => setConsultationOpen(true)}
      />
      {consultationOpen ? <PublicLeadModal onClose={() => setConsultationOpen(false)} /> : null}
    </>
  )
}
