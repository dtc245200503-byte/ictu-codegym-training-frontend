import type { ReactNode } from 'react'

const iconPaths: Record<string, ReactNode> = {
  cap: <><path d="m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z" /><path d="M6 11v5c3.7 2.7 8.3 2.7 12 0v-5M21.5 9v6" /></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18m5 5h3m-3 4h4" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
  classes: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h3M8 17h7" /></>,
  teachers: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2M8 8h8" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  filter: <path d="M4 5h16M7 12h10m-7 7h4" />,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  arrow: <path d="M5 12h14m-7-7 7 7-7 7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  downloadFile: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M12 12v6m-3-3 3 3 3-3" /></>,
}

export function UiIcon({
  name,
  size = 18,
}: {
  name: string
  size?: number
}) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name] ?? iconPaths.chevron}
    </svg>
  )
}

export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  size = 'medium',
  presentation = 'dialog',
  backHref,
}: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  size?: 'medium' | 'large'
  presentation?: 'dialog' | 'page'
  backHref?: string
}) {
  if (presentation === 'page') {
    return (
      <section className="page-stack workflow-page">
        <header className="page-title-row">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h1>{title}</h1>
          </div>
          {backHref ? (
            <a className="button button-outline" href={backHref}>Quay lại</a>
          ) : (
            <button className="button button-outline" onClick={onClose} type="button">Quay lại</button>
          )}
        </header>
        <div className="workflow-page-card">{children}</div>
      </section>
    )
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={`modal-card ${size === 'large' ? 'modal-large' : ''}`}
        role="dialog"
      >
        <div className="modal-heading">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            aria-label="Đóng"
            className="icon-button modal-close"
            onClick={onClose}
            type="button"
          >
            <UiIcon name="close" />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function RolePill({ role }: { role: string }) {
  const label: Record<string, string> = {
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    admissions: 'Tuyển sinh',
    accountant: 'Kế toán',
    teacher: 'Giảng viên',
    ta: 'Trợ giảng',
    student: 'Học viên',
    guest: 'Khách',
  }
  return <span className={`role-pill role-${role}`}>{label[role] ?? role}</span>
}

export function StatusPill({ locked }: { locked: boolean }) {
  return (
    <span className={`status-pill ${locked ? 'status-locked' : 'status-active'}`}>
      <i />{locked ? 'Đã khóa' : 'Hoạt động'}
    </span>
  )
}
