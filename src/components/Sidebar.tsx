import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { NavLink } from 'react-router-dom'

import { menuItems } from '../data/menuItems'
import BrandLockup from './BrandLockup'
import type { CurrentUser } from '../types/auth'
import { canViewClasses } from '../utils/classAccess'


interface SidebarProps {
  user: CurrentUser
  onLogout: () => void
  mobileOpen: boolean
  onMobileClose: () => void
  collapsed: boolean
  isMobile: boolean
  onToggle: () => void
}


const menuIcons: Record<string, ReactNode> = {
  '/leads': <svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2" /><path d="M20 8v6M17 11h6" /></svg>,
  '/profile': (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </svg>
  ),
  '/': (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),

  '/users': (
    <svg viewBox="0 0 24 24">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),

  '/roles': (
    <svg viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),

  '/courses': (
    <svg viewBox="0 0 24 24">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),

  '/classes': (
    <svg viewBox="0 0 24 24">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  ),

  '/subjects': (
    <svg viewBox="0 0 24 24">
      <path d="M4 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-3H4z" />
      <path d="M13 6a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 3" />
    </svg>
  ),

  '/grades': (
    <svg viewBox="0 0 24 24">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),

  '/tuition': (
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

  '/attendance': (
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
}


function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8" />
      <path d="M17 6l2 2" />
      <path d="M15 8l2 2" />
    </svg>
  )
}


function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}


function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  )
}

const navigationGroups = [
  { title: 'Tổng quan', paths: ['/'] },
  { title: 'Quản lý đào tạo', paths: ['/courses', '/subjects', '/classes', '/grades', '/attendance', '/tuition'] },
  { title: 'Vận hành', paths: ['/leads', '/users', '/roles'] },
  { title: 'Cá nhân', paths: ['/profile'] },
]


function Sidebar({
  user,
  onLogout,
  mobileOpen,
  onMobileClose,
  collapsed,
  isMobile,
  onToggle,
}: SidebarProps) {
  const [
    showLogoutConfirm,
    setShowLogoutConfirm,
  ] = useState(false)
  const logoutDialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showLogoutConfirm) return
    const dialog = logoutDialogRef.current
    const previousFocus = document.activeElement as HTMLElement | null
    dialog?.querySelector<HTMLButtonElement>('.logout-cancel-button')?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setShowLogoutConfirm(false) }
      if (event.key !== 'Tab') return
      const buttons = [...(dialog?.querySelectorAll<HTMLButtonElement>('button') || [])]
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus() }
      if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus()
    }
  }, [showLogoutConfirm])


  const visibleMenuItems = menuItems.filter(
    (item) => {
      if (item.path === '/classes') return canViewClasses(user)
      if (!item.permission) {
        return true
      }

      return user.permissions.includes(
        item.permission,
      )
    },
  )


  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false)
    onMobileClose()
    onLogout()
  }


  return (
    <>
      <aside
        id="app-sidebar"
        aria-label="Menu chính"
        inert={isMobile && !mobileOpen}
        className={
          mobileOpen
            ? 'sidebar mobile-open'
            : 'sidebar'
        }
      >
        <div className="sidebar-header">
          <LinkMark />
          <div className="sidebar-partnership">
            <BrandLockup compact />
            <p>TRAINING MANAGEMENT</p>
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            aria-label={isMobile ? 'Đóng menu điều hướng' : collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            aria-expanded={isMobile ? mobileOpen : !collapsed}
            aria-controls="app-sidebar"
            onClick={isMobile ? onMobileClose : onToggle}
          >
            {isMobile ? <CloseIcon /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d={collapsed ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} /></svg>}
          </button>
        </div>


        <nav className="sidebar-menu" aria-label="Chức năng hệ thống">
          {navigationGroups.map(group => {
            const groupItems = group.paths.flatMap(path => visibleMenuItems.filter(item => item.path === path))
            return groupItems.length > 0 && <div className="sidebar-group" key={group.title}>
              <span className="sidebar-section-title">{group.title}</span>
              {groupItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onMobileClose}
              title={collapsed && !isMobile ? item.name : undefined}
              aria-label={item.name}
              className={({ isActive }) =>
                isActive
                  ? 'menu-item active'
                  : 'menu-item'
              }
            >
              <span className="menu-icon">
                {menuIcons[item.path]}
              </span>

              <span className="menu-label">
                {item.name}
              </span>

              <span className="menu-arrow">
                ›
              </span>
            </NavLink>
          ))}</div>})}


          <div className="sidebar-menu-divider" />


          <NavLink
            to="/change-password"
            title={collapsed && !isMobile ? 'Đổi mật khẩu' : undefined}
            aria-label="Đổi mật khẩu"
            onClick={onMobileClose}
            className={({ isActive }) =>
              isActive
                ? 'menu-item active'
                : 'menu-item'
            }
          >
            <span className="menu-icon">
              <KeyIcon />
            </span>

            <span className="menu-label">
              Đổi mật khẩu
            </span>

            <span className="menu-arrow">
              ›
            </span>
          </NavLink>


          <button
            type="button"
            className="menu-item sidebar-logout-menu"
            title={collapsed && !isMobile ? 'Đăng xuất' : undefined}
            aria-label="Đăng xuất"
            onClick={() => {
              onMobileClose()
              setShowLogoutConfirm(true)
            }}
          >
            <span className="menu-icon">
              <LogoutIcon />
            </span>

            <span className="menu-label">
              Đăng xuất
            </span>
          </button>
        </nav>
        <div className="sidebar-partnership-note">
          <span className="sidebar-note-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m3 8 9-5 9 5-9 5-9-5Zm4 3v6c3 3 7 3 10 0v-6M21 8v7" /></svg></span>
          <div><p>Cùng kiến tạo.<br /><strong>Cùng tiến xa.</strong></p><small>ICTU × CodeGym Việt Nam</small></div>
        </div>
      </aside>


      {showLogoutConfirm && (
        <div
          className="logout-confirm-overlay"
          onMouseDown={(event) => {
            if (
              event.target
              === event.currentTarget
            ) {
              setShowLogoutConfirm(false)
            }
          }}
        >
          <div
            ref={logoutDialogRef}
            className="logout-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
          >
            <div className="logout-confirm-icon">
              <LogoutIcon />
            </div>

            <h2 id="logout-confirm-title">
              Xác nhận đăng xuất
            </h2>

            <p>
              Bạn có chắc chắn muốn đăng xuất
              khỏi hệ thống không?
            </p>

            <div className="logout-confirm-actions">
              <button
                type="button"
                className="logout-cancel-button"
                onClick={() =>
                  setShowLogoutConfirm(false)
                }
              >
                Hủy
              </button>

              <button
                type="button"
                className="logout-confirm-button"
                onClick={handleConfirmLogout}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


export default Sidebar

function LinkMark() {
  return <span className="sidebar-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m2 8 10-5 10 5-10 5L2 8Zm4 3v6c4 3 8 3 12 0v-6M22 8v8" /></svg></span>
}
