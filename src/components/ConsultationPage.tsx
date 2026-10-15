import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ConsultationError, getConsultationChallenge, sendConsultation } from '../services/consultationService'
import type { ConsultationChallenge, ConsultationReceipt } from '../services/consultationService'
import BrandLockup from './BrandLockup'
import './ConsultationPage.css'

export default function ConsultationPage() {
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', interest: '', message: '', website: '' })
  const [challenge, setChallenge] = useState<ConsultationChallenge | null>(null)
  const [answer, setAnswer] = useState('')
  const [challengeLoading, setChallengeLoading] = useState(true)
  const [challengeError, setChallengeError] = useState('')
  const [challengeReload, setChallengeReload] = useState(0)
  const [readyAt, setReadyAt] = useState(0)
  const [expiresAt, setExpiresAt] = useState(0)
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<ConsultationReceipt | null>(null)
  const successRef = useRef<HTMLDivElement | null>(null)

  const explain = (err: unknown) => {
    if (err instanceof ConsultationError) {
      if (err.retryAfter) setRetryAt(Date.now() + err.retryAfter * 1000)
      return err.message
    }
    return 'Không thể kết nối đến trung tâm. Thông tin bạn nhập vẫn được giữ; vui lòng thử lại.'
  }
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setChallengeLoading(true); setChallenge(null); setAnswer(''); setChallengeError('')
    getConsultationChallenge(controller.signal).then(result => {
      if (controller.signal.aborted) return
      setChallenge(result); setReadyAt(Date.now() + result.min_wait_seconds * 1000); setExpiresAt(Date.now() + result.expires_in * 1000)
    }).catch((err: unknown) => { if (!controller.signal.aborted) setChallengeError(explain(err)) })
      .finally(() => { if (!controller.signal.aborted) setChallengeLoading(false) })
    return () => controller.abort()
  }, [challengeReload])
  useEffect(() => { if (receipt) successRef.current?.focus() }, [receipt])
  const blocked = now < retryAt
  const expired = !!challenge && now >= expiresAt
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (sending.current || !challenge || challengeLoading || blocked || now < readyAt || expired) return
    setError('')
    const full_name = form.full_name.trim(), phone = form.phone.trim(), email = form.email.trim()
    if (!full_name || full_name.length > 100) { setError('Vui lòng nhập họ và tên, tối đa 100 ký tự.'); return }
    if (!/^(?:0|\+84)(?:[35789][0-9]{8}|2[0-9]{9})$/.test(phone)) { setError('Vui lòng nhập số điện thoại Việt Nam hợp lệ, ví dụ 0912345678 hoặc +84912345678.'); return }
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255)) { setError('Vui lòng kiểm tra địa chỉ email.'); return }
    if (!/^[0-9]{1,3}$/.test(answer.trim())) { setError('Vui lòng nhập câu trả lời xác minh bằng số.'); return }
    sending.current = true; setBusy(true)
    try {
      const result = await sendConsultation({ full_name, phone, email: email || null,
        interest: form.interest.trim() || null, message: form.message.trim() || null, website: form.website,
        challenge_token: challenge.challenge_token, challenge_answer: answer.trim() })
      setReceipt(result)
    } catch (err) {
      setError(explain(err))
      if (err instanceof ConsultationError && err.status === 400) setChallengeReload(value => value + 1)
    } finally { sending.current = false; setBusy(false) }
  }

  return <main className="consultation-page">
    <header className="consultation-header"><a className="consultation-brand" href="/dang-ky-tu-van" aria-label="ICTU × CodeGym Việt Nam — Đăng ký tư vấn"><BrandLockup compact /></a><a className="consultation-login" href="/">Đăng nhập hệ thống</a></header>
    <div className="consultation-content"><section className="consultation-intro" aria-labelledby="consultation-title"><span className="consultation-eyebrow">TƯ VẤN ĐÀO TẠO</span><h1 id="consultation-title">Bắt đầu hành trình học <br />phù hợp với bạn.</h1><p>Để lại thông tin và nhu cầu học tập. Trung tâm sẽ gọi lại, giúp bạn chọn chương trình và lộ trình phù hợp.</p><div className="consultation-promise"><span aria-hidden="true">✓</span><div><strong>Liên hệ trong 1 ngày làm việc</strong><p>Bạn không cần đăng nhập hoặc tự tìm số điện thoại của trung tâm.</p></div></div><p className="consultation-privacy">Thông tin bạn cung cấp được dùng để liên hệ tư vấn về nhu cầu học tập.</p></section>
      <section className="consultation-card" aria-labelledby="consultation-form-title">
        {receipt ? <div className="consultation-success" ref={successRef} tabIndex={-1} role="status"><span className="consultation-success-icon" aria-hidden="true">✓</span><h2 id="consultation-form-title">Đăng ký tư vấn thành công</h2><p>{receipt.message}</p><div className="consultation-contact-promise">{receipt.contact_promise}</div><p>Bạn vui lòng giữ điện thoại để trung tâm có thể liên hệ.</p><a className="consultation-login" href="/">Về trang đăng nhập</a></div> : <><h2 id="consultation-form-title">Đăng ký tư vấn</h2><p className="consultation-subtitle">Chỉ cần họ tên và số điện thoại. Các mục có * là bắt buộc.</p>
        <form onSubmit={submit} noValidate><fieldset disabled={busy} className="consultation-fields">
          <div><label htmlFor="consultation-name">Họ và tên *</label><input id="consultation-name" name="full_name" autoComplete="name" maxLength={100} required value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} placeholder="Nhập họ và tên của bạn" /></div>
          <div><label htmlFor="consultation-phone">Số điện thoại *</label><input id="consultation-phone" name="phone" type="tel" autoComplete="tel" maxLength={20} required value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Ví dụ: 0912345678" /></div>
          <div><label htmlFor="consultation-email">Email <small>(không bắt buộc)</small></label><input id="consultation-email" name="email" type="email" autoComplete="email" maxLength={255} value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="Ví dụ: ban@example.com" /></div>
          <div><label htmlFor="consultation-interest">Chương trình quan tâm <small>(không bắt buộc)</small></label><input id="consultation-interest" name="interest" maxLength={255} value={form.interest} onChange={event => setForm({ ...form, interest: event.target.value })} placeholder="Bạn muốn học gì?" /></div>
          <div><label htmlFor="consultation-message">Nhu cầu tư vấn <small>(không bắt buộc)</small></label><textarea id="consultation-message" name="message" rows={3} maxLength={2000} value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} placeholder="Mục tiêu học tập hoặc thời gian bạn muốn được gọi lại" /></div>
          <div className="consultation-trap" aria-hidden="true"><label htmlFor="consultation-website">Website</label><input id="consultation-website" name="website" tabIndex={-1} autoComplete="off" maxLength={255} value={form.website} onChange={event => setForm({ ...form, website: event.target.value })} /></div>
          <div className="consultation-verification"><label htmlFor="consultation-answer">Xác minh trước khi gửi *</label>{challengeLoading ? <p role="status">Đang tải câu hỏi xác minh...</p> : challengeError ? <p className="consultation-error" role="alert">{challengeError}</p> : challenge && <><p id="consultation-question">{challenge.question}</p><input id="consultation-answer" inputMode="numeric" autoComplete="off" maxLength={3} aria-describedby="consultation-question" disabled={expired} value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Nhập kết quả" required /></>}
            {expired && <p className="consultation-error" role="alert">Câu hỏi đã hết hạn. Vui lòng lấy câu hỏi mới; thông tin bạn nhập được giữ nguyên.</p>}<button type="button" className="consultation-refresh" disabled={challengeLoading || blocked} onClick={() => setChallengeReload(value => value + 1)}>{challengeError || expired ? 'Thử lại câu hỏi xác minh' : 'Lấy câu hỏi khác'}</button></div>
        </fieldset>{error && <p className="consultation-error" role="alert">{error}</p>}{blocked && <p className="consultation-error" role="status">Bạn có thể thử lại sau khoảng {Math.ceil((retryAt - now) / 60000)} phút.</p>}<button className="consultation-submit" type="submit" disabled={busy || challengeLoading || !challenge || blocked || now < readyAt || expired}>{busy ? 'Đang gửi đăng ký...' : 'Gửi đăng ký tư vấn'}</button><p className="consultation-form-note">Trung tâm sẽ liên hệ trong vòng 1 ngày làm việc.</p></form></>}
      </section></div><footer className="consultation-footer">ICTU × CodeGym Việt Nam · Hệ thống quản lý đào tạo</footer>
  </main>
}
