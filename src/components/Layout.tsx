import NotificationBadge from './NotificationBadge'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { menuItems } from '../data/menuItems'
import type { CurrentUser } from '../types/auth'

interface LayoutProps { user: CurrentUser; onLogout: () => void }
const mobileQuery = '(max-width: 960px)'
const subscribeToViewport = (callback: () => void) => {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
const isMobileViewport = () => window.matchMedia(mobileQuery).matches
const roleNames: Record<string, string> = {
  ADMIN: 'Quản trị viên', MANAGER: 'Quản lý đào tạo', TRAINING_MANAGER: 'Quản lý đào tạo',
  INSTRUCTOR: 'Giảng viên', TEACHER: 'Giảng viên', ASSISTANT: 'Trợ giảng', TA: 'Trợ giảng', STUDENT: 'Học viên', ACCOUNTANT: 'Kế toán',
  ADMISSIONS: 'Tuyển sinh', ACADEMIC_AFFAIRS: 'Giáo vụ', MANAGEMENT: 'Ban quản lý',
}

export default function Layout({ user, onLogout }: LayoutProps) {
  const location = useLocation()
  const isMobile = useSyncExternalStore(subscribeToViewport, isMobileViewport, () => false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('training-sidebar-collapsed') === 'true' } catch { return false }
  })
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null)
  const mobileOpen = isMobile && mobileMenuPath === location.pathname
  const toggleRef = useRef<HTMLButtonElement>(null)
  const displayedRoles = user.roles.map(role => roleNames[role] || role).join(', ')
  const avatarLetter = user.full_name.trim().charAt(0).toUpperCase()
  const currentSection = location.pathname.endsWith('/lessons') ? 'Buổi học trong môn'
    : location.pathname.endsWith('/curriculum') ? 'Lộ trình đào tạo'
      : location.pathname === '/change-password' ? 'Đổi mật khẩu'
        : menuItems.find(item => item.path === location.pathname)?.name || 'Không gian đào tạo'
  const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())

  const toggleMenu = () => {
    if (isMobile) { setMobileMenuPath(mobileOpen ? null : location.pathname); return }
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('training-sidebar-collapsed', String(next)) } catch { /* Still works for this visit. */ }
  }

  useEffect(() => {
    const media = window.matchMedia(mobileQuery)
    const closeOnResize = () => setMobileMenuPath(null)
    media.addEventListener('change', closeOnResize)
    return () => media.removeEventListener('change', closeOnResize)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const panel = document.getElementById('app-sidebar')
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel?.querySelector<HTMLButtonElement>('.sidebar-toggle')?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileMenuPath(null) }
      if (event.key !== 'Tab') return
      const nodes = [...(panel?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') || [])]
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
      if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    const toggle = toggleRef.current
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keyboard); toggle?.focus() }
  }, [mobileOpen])

  return <div className={'app-layout' + (collapsed ? ' sidebar-collapsed' : '') + (mobileOpen ? ' menu-is-open' : '')}>
    <a className="skip-content" href="#main-content">Chuyển tới nội dung</a>
    <Sidebar user={user} onLogout={onLogout} collapsed={collapsed} isMobile={isMobile}
      mobileOpen={mobileOpen} onToggle={toggleMenu} onMobileClose={() => setMobileMenuPath(null)} />
    {mobileOpen && <button type="button" className="mobile-sidebar-overlay" aria-label="Đóng menu điều hướng" tabIndex={-1} onClick={() => setMobileMenuPath(null)} />}
    <div className="app-main" inert={mobileOpen}>
      <header className="topbar">
        <div className="topbar-left">
          <button ref={toggleRef} type="button" className="workspace-menu-toggle" aria-label={isMobile ? mobileOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng' : collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            aria-controls="app-sidebar" aria-expanded={isMobile ? mobileOpen : !collapsed} onClick={toggleMenu}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="topbar-title"><span className="topbar-welcome">Không gian đào tạo</span><span className="topbar-description">{currentSection}</span></div>
        </div>
        <div className="topbar-right">
          <NotificationBadge />
          <span className="topbar-date"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18" /></svg>{today}</span>
          <Link className="topbar-user" to="/profile" aria-label="Mở hồ sơ cá nhân">
            <div className="topbar-avatar">{user.avatar_thumbnail_url || user.avatar_url ? <img src={user.avatar_thumbnail_url || user.avatar_url || ''} alt="" /> : avatarLetter}</div>
            <div className="topbar-user-info"><strong>{user.full_name}</strong><span>{displayedRoles}</span></div>
            <svg className="topbar-user-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
          </Link>
        </div>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        <div key={location.pathname} className="page-transition"><Outlet /></div>
      </main>
      <footer className="app-footer"><span><strong>ICTU</strong> <b>×</b> CodeGym Việt Nam</span><span>Kết nối tri thức · Kiến tạo tương lai</span></footer>
    </div>
  </div>
}
