import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CurrentUser } from '../types/auth'
import { listPrograms } from '../services/trainingProgramService'
import { listSubjects } from '../services/subjectService'
import { listClasses } from '../services/classService'
import { getUsers } from '../services/userService'

const metrics = [
  { path: '/courses', label: 'Chương trình đào tạo', permission: 'CURRICULUM_MANAGE', load: () => listPrograms('', '', 1), icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3Z' },
  { path: '/classes', label: 'Lớp học', permission: 'CLASS_MANAGE', load: () => listClasses('', '', 1), icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01' },
  { path: '/subjects', label: 'Môn học', permission: 'SUBJECT_MANAGE', load: () => listSubjects('', 1), icon: 'M3 3h6a3 3 0 0 1 3 3v15a4 4 0 0 0-4-3H3V3Zm9 3a3 3 0 0 1 3-3h6v15h-5a4 4 0 0 0-4 3' },
  { path: '/users', label: 'Tài khoản', permission: 'USER_MANAGE', load: () => getUsers({ page_size: 1 }), icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z' },
]
type MetricValue = { total: number | null; failed: boolean }

export default function DashboardOverview({ user }: { user: CurrentUser }) {
  const permissions = [...user.permissions].sort().join(',')
  const scope = user.user_id + ':' + permissions
  const [stats, setStats] = useState<{ scope: string; values: Record<string, MetricValue> }>({ scope: '', values: {} })
  const [reload, setReload] = useState(0)
  const available = metrics.filter(metric => user.permissions.includes(metric.permission))
  const values = stats.scope === scope ? stats.values : {}

  useEffect(() => {
    let active = true
    metrics.filter(metric => permissions.split(',').includes(metric.permission)).forEach(metric => {
      const update = (value: MetricValue) => {
        if (active) setStats(previous => ({ scope, values: { ...(previous.scope === scope ? previous.values : {}), [metric.path]: value } }))
      }
      metric.load().then(result => update({ total: result.total, failed: false })).catch(() => update({ total: null, failed: true }))
    })
    return () => { active = false }
  }, [permissions, scope, reload])

  if (!available.length) return null
  return <section className="dashboard-overview" aria-label="Tổng quan dữ liệu đào tạo">
    <div className="overview-grid">{available.map(metric => {
      const value = values[metric.path]
      return <Link key={metric.path} to={metric.path} className="overview-card" aria-label={metric.label + ': ' + (value?.failed ? 'chưa tải được dữ liệu' : value?.total ?? 'đang cập nhật')}>
        <div className="overview-card-top"><span>{metric.label}</span><span className="overview-icon"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={metric.icon} /></svg></span></div>
        <strong className={'overview-value' + (!value ? ' metric-loading' : '')}>{!value ? '…' : value.total === null ? '—' : value.total.toLocaleString('vi-VN')}</strong>
        <span className="overview-card-bottom">{value?.failed ? 'Chưa tải được dữ liệu' : 'Xem danh sách'}<span aria-hidden="true">↗</span></span>
      </Link>
    })}</div>
    {Object.values(values).some(value => value.failed) && <p className="overview-error" role="status">Một số thống kê chưa tải được. <button type="button" onClick={() => { setStats({ scope, values: {} }); setReload(value => value + 1) }}>Thử lại</button></p>}
  </section>
}
