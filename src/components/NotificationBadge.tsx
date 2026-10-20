import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { notificationSummary } from '../services/notificationService'
import './NotificationsPage.css'

export default function NotificationBadge() {
  const [count, setCount] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true, sequence = 0
    const load = async () => {
      const current = ++sequence
      try { const result = await notificationSummary(); if (active && sequence === current) { setCount(result.unread); setFailed(false) } }
      catch { if (active && sequence === current) setFailed(true) }
    }
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') void load() }, 60000)
    window.addEventListener('focus', load); window.addEventListener('notifications-changed', load)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', load); window.removeEventListener('notifications-changed', load) }
  }, [])
  return <Link to="/notifications" className="inbox-badge" aria-label={failed ? 'Thông báo, chưa tải được số chưa đọc' : 'Thông báo' + (count !== null ? ', ' + count + ' chưa đọc' : '')} title={failed ? 'Chưa tải được thông báo. Bấm để thử lại.' : 'Thông báo'}>
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{failed ? <span>!</span> : !!count && <span>{count > 99 ? '99+' : count}</span>}
  </Link>
}
