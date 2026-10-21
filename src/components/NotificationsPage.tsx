import { Link } from 'react-router-dom'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { listNotifications, NotificationError, notifyInboxChanged, readNotification } from '../services/notificationService'
import type { UserNotification } from '../services/notificationService'
import './NotificationsPage.css'

export default function NotificationsPage({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [page, setPage] = useState(1), [unreadOnly, setUnreadOnly] = useState(false), [reload, setReload] = useState(0)
  const [busy, setBusy] = useState<number | string | null>(null), [actionError, setActionError] = useState('')
  const saving = useRef(false)
  const key = JSON.stringify([page, unreadOnly, reload])
  const [result, setResult] = useState<{ key: string; items?: UserNotification[]; total?: number; unread?: number; error?: string }>()
  const explain = (error: unknown) => {
    if (error instanceof NotificationError && error.status === 401) onSessionExpired()
    return error instanceof Error && !(error instanceof TypeError) ? error.message : 'Không thể tải thông báo. Vui lòng thử lại.'
  }
  const explainLoad = useEffectEvent(explain)
  useEffect(() => {
    let active = true
    listNotifications(page, unreadOnly).then(data => { if (active) setResult({ key, ...data }) })
      .catch((error: unknown) => { if (active) setResult({ key, error: explainLoad(error) }) })
    return () => { active = false }
  }, [page, unreadOnly, key])
  useEffect(() => {
    const load = () => setReload(value => value + 1)
    const timer = window.setInterval(() => { if (document.visibilityState !== 'hidden') load() }, 60000)
    window.addEventListener('focus', load)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', load) }
  }, [])
  const mark = async (id: number | string) => {
    if (saving.current) return
    saving.current = true; setBusy(id); setActionError('')
    try { await readNotification(id); if (unreadOnly) setPage(1); setReload(value => value + 1); notifyInboxChanged() }
    catch (error) { setActionError(explain(error)) }
    finally { saving.current = false; setBusy(null) }
  }
  const loading = result?.key !== key
  return <section className="notifications-page" aria-labelledby="inbox-title"><header><h1 id="inbox-title">Thông báo</h1><p>Bài tập mới, cập nhật lịch học, kết quả xin phép vắng và cảnh báo chuyên cần dành cho bạn · Giờ Việt Nam</p></header>
    <div className="inbox-controls"><label><input type="checkbox" checked={unreadOnly} onChange={event => { setUnreadOnly(event.target.checked); setPage(1) }} /> Chỉ chưa đọc</label><button onClick={() => { setActionError(''); setReload(value => value + 1) }}>Tải lại</button></div>
    {actionError && <p className="inbox-error" role="alert">{actionError}</p>}
    {loading && <p role="status">Đang tải thông báo…</p>}
    {!loading && result?.error && <p className="inbox-error" role="alert">{result.error} <button onClick={() => setReload(value => value + 1)}>Thử lại</button></p>}
    {!loading && result?.items && <><p>{result.unread} chưa đọc · {result.total} thông báo{unreadOnly ? ' chưa đọc' : ''}</p>
      {!result.items.length && <p>Không có thông báo{unreadOnly ? ' chưa đọc' : ''}.</p>}
      <div className="inbox-list">{result.items.map(item => <article className={item.read_at ? '' : 'is-unread'} key={item.notification_id}><h2>{item.title}{!item.read_at && <span>Chưa đọc</span>}</h2><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time><p>{item.message}</p>{String(item.notification_id).startsWith('assignment:') && <p><Link to={item.target_url && /^\/assignments\?assignment_id=[1-9]\d*$/.test(item.target_url) ? item.target_url : '/assignments'}>Xem bài tập</Link></p>}{String(item.notification_id).startsWith('absence:') && <p><Link to="/absence-requests">Xem đơn xin vắng</Link></p>}{!item.read_at && <button disabled={busy !== null} onClick={() => void mark(item.notification_id)}>{busy === item.notification_id ? 'Đang lưu…' : 'Đánh dấu đã đọc'}</button>}</article>)}</div>
      <div className="inbox-pagination"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page}/{Math.max(1, Math.ceil((result.total || 0) / 20))}</span><button disabled={page * 20 >= (result.total || 0)} onClick={() => setPage(value => value + 1)}>Sau</button></div>
    </>}
  </section>
}
