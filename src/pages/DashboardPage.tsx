import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { UiIcon } from '../components/Ui'
import { showError } from '../format'
import type { DashboardSummary, TrainingClass, User } from '../types'
import { DashboardApiPanel } from './FinanceAcademicPages'

type PageKey = 'accounts' | 'courses' | 'classes' | 'schedule'

const formatDate = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const renderedDate = new Date()

export function DashboardPage({
  user,
  onNavigate,
  notify,
}: {
  user: User
  onNavigate: (page: PageKey) => void
  notify: (message: string) => void
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [loading, setLoading] = useState(true)
  const admin = user.roles.includes('admin') || user.roles.includes('manager')
  const greeting = renderedDate.getHours() < 12 ? 'Chào buổi sáng' : 'Chào buổi chiều'

  useEffect(() => {
    Promise.all([
      apiRequest<DashboardSummary>('/dashboard/summary'),
      apiRequest<TrainingClass[]>('/classes'),
    ])
      .then(([nextSummary, nextClasses]) => {
        setSummary(nextSummary)
        setClasses(nextClasses)
      })
      .catch((error: unknown) => notify(showError(error)))
      .finally(() => setLoading(false))
  }, [notify])

  const cards = admin
    ? [
        { label: 'Tổng học viên', value: summary?.students, icon: 'users', color: 'violet', note: 'Đang theo học' },
        { label: 'Đội ngũ giảng viên', value: summary?.teachers, icon: 'teachers', color: 'blue', note: 'Đang giảng dạy' },
        { label: 'Môn học đào tạo', value: summary?.courses, icon: 'book', color: 'amber', note: 'Trong chương trình' },
        { label: 'Lớp học phần', value: summary?.classes, icon: 'classes', color: 'green', note: 'Đang tổ chức' },
      ]
    : [
        { label: 'Lớp học của bạn', value: summary?.classes, icon: 'classes', color: 'violet', note: 'Trong học kỳ này' },
        { label: 'Môn học đào tạo', value: summary?.courses, icon: 'book', color: 'blue', note: 'Trong chương trình' },
      ]

  const orderedClasses = [...classes].sort((first, second) =>
    first.day_of_week - second.day_of_week ||
    first.start_time.localeCompare(second.start_time),
  )

  return (
    <div className="page-stack">
      <section className="welcome-banner">
        <div className="welcome-copy">
          <span className="eyebrow">CỔNG THÔNG TIN ĐÀO TẠO · ICTU</span>
          <h1>{greeting}, {user.full_name.split(' ').slice(-1)[0]} <span>✦</span></h1>
          <p>Chúc bạn một ngày học tập và làm việc hiệu quả.</p>
          <div className="welcome-date"><UiIcon name="calendar" size={16} /> {formatDate.format(renderedDate)}</div>
        </div>
        <div className="welcome-illustration" aria-hidden="true">
          <div className="welcome-sun" />
          <div className="welcome-book book-back" />
          <div className="welcome-book book-front"><UiIcon name="cap" size={46} /></div>
          <span className="welcome-star star-a">✦</span>
          <span className="welcome-star star-b">✧</span>
        </div>
        <div className="welcome-decoration decoration-one" />
        <div className="welcome-decoration decoration-two" />
      </section>

      <div className="section-heading metric-heading">
        <div><span className="eyebrow">BỨC TRANH ĐÀO TẠO</span><h2>Số liệu tổng quan</h2></div>
        <span className="live-updated"><i /> Dữ liệu trực tiếp</span>
      </div>
      <section className={`metric-grid ${cards.length === 2 ? 'metric-grid-compact' : ''}`}>
        {cards.map((card) => (
          <article className="metric-card" key={card.label}>
            <div className="metric-card-top">
              <span className={`metric-icon metric-${card.color}`}><UiIcon name={card.icon} size={19} /></span>
              <span className="metric-trend"><span>↗</span> Học kỳ mới</span>
            </div>
            <span className="metric-label">{card.label}</span>
            <div className="metric-value">{loading ? <span className="skeleton-number" /> : (card.value ?? 0).toLocaleString('vi-VN')}</div>
            <span className="metric-note">{card.note}</span>
          </article>
        ))}
      </section>

      <DashboardApiPanel roles={user.roles} notify={notify} />

      <div className="dashboard-lower">
        <section className="panel upcoming-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">LỊCH LỚP HỌC</span><h2>Lịch học theo tuần</h2></div>
            <button className="button button-quiet" onClick={() => onNavigate('schedule')} type="button">Xem thời khóa biểu <UiIcon name="arrow" size={16} /></button>
          </div>
          {orderedClasses.length ? (
            <div className="upcoming-list">
              {orderedClasses.slice(0, 4).map((item, index) => (
                <article className="upcoming-row" key={item.id}>
                  <div className={`upcoming-day day-tone-${index % 4}`}>
                    <span>{item.weekday.replace('Thứ ', 'T').replace('Chủ Nhật', 'CN')}</span>
                    <strong>{item.start_time}</strong>
                  </div>
                  <div className="upcoming-info">
                    <strong>{item.course_name}</strong>
                    <div className="upcoming-info-meta">
                      <span className="upcoming-class-chip">{item.code}</span>
                      <span className="upcoming-teacher-chip"><UiIcon name="teachers" size={13} />{item.teacher_name}</span>
                    </div>
                  </div>
                  <div className="upcoming-room"><UiIcon name="location" size={15} /> {item.room}</div>
                  <UiIcon name="chevron" size={18} />
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <div className="empty-icon"><UiIcon name="calendar" size={22} /></div>
              <strong>Chưa có lịch học</strong>
              <span>Lịch lớp học sẽ hiển thị tại đây sau khi được xếp.</span>
              {admin ? <button className="text-button" onClick={() => onNavigate('classes')} type="button">Tạo lớp học đầu tiên <UiIcon name="arrow" size={15} /></button> : null}
            </div>
          )}
        </section>

        <section className="panel shortcuts-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">TRUY CẬP NHANH</span><h2>Công việc của bạn</h2></div>
          </div>
          <div className="shortcut-list">
            {admin ? (
              <>
                <button className="shortcut-row" onClick={() => onNavigate('accounts')} type="button">
                  <span className="shortcut-icon shortcut-violet"><UiIcon name="users" size={18} /></span>
                  <span><strong>Quản lý tài khoản</strong><small>Học viên và giảng viên</small></span>
                  <UiIcon name="chevron" size={17} />
                </button>
                <button className="shortcut-row" onClick={() => onNavigate('courses')} type="button">
                  <span className="shortcut-icon shortcut-blue"><UiIcon name="book" size={18} /></span>
                  <span><strong>Chương trình đào tạo</strong><small>Môn học và tín chỉ</small></span>
                  <UiIcon name="chevron" size={17} />
                </button>
              </>
            ) : null}
            <button className="shortcut-row" onClick={() => onNavigate('classes')} type="button">
              <span className="shortcut-icon shortcut-amber"><UiIcon name="classes" size={18} /></span>
              <span><strong>{admin ? 'Tổ chức lớp học' : 'Lớp học của tôi'}</strong><small>Danh sách lớp và sĩ số</small></span>
              <UiIcon name="chevron" size={17} />
            </button>
            <button className="shortcut-row" onClick={() => onNavigate('schedule')} type="button">
              <span className="shortcut-icon shortcut-green"><UiIcon name="calendar" size={18} /></span>
              <span><strong>Thời khóa biểu</strong><small>Lịch học trong tuần</small></span>
              <UiIcon name="chevron" size={17} />
            </button>
          </div>
          <div className="term-card">
            <div className="term-card-icon"><UiIcon name="book" size={17} /></div>
            <div><span>HỌC KỲ HIỆN TẠI</span><strong>Học kỳ 1 · 2026–2027</strong></div>
            <span className="term-active">Đang diễn ra</span>
          </div>
        </section>
      </div>
    </div>
  )
}
