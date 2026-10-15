import { useEffect, useRef, useState } from 'react'
import './Toast.css'

interface ToastProps {
  message: string
  type?: 'success' | 'warning'
  onClose: () => void
}

const duration = 4000
const exitDuration = 220

export default function Toast({ message, type = 'success', onClose }: ToastProps) {
  const [closing, setClosing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const remaining = useRef(duration)
  const paused = hovered || focused

  useEffect(() => {
    if (paused || closing) return
    const started = performance.now()
    const timer = window.setTimeout(() => setClosing(true), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (performance.now() - started))
    }
  }, [paused, closing])

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(onClose, exitDuration)
    return () => window.clearTimeout(timer)
  }, [closing, onClose])

  return (
    <div
      className={`notification-toast notification-toast--${type}${closing ? ' notification-toast--closing' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); setClosing(true) }
      }}
    >
      <span className="notification-toast__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          {type === 'success'
            ? <path className="notification-toast__check" pathLength="1" d="m6 12 4 4 8-8" />
            : <><path d="M12 7v6" /><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" /></>}
        </svg>
      </span>
      <div className="notification-toast__content" role="status" aria-live="polite" aria-atomic="true">
        <strong>{type === 'success' ? 'Thành công' : 'Lưu ý'}</strong>
        <p>{message}</p>
      </div>
      <button type="button" className="notification-toast__close" aria-label="Đóng thông báo" onClick={() => setClosing(true)}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
      </button>
      <span className="notification-toast__progress" aria-hidden="true">
        <span style={{ animationDuration: `${duration}ms`, animationPlayState: paused || closing ? 'paused' : 'running' }} />
      </span>
    </div>
  )
}
