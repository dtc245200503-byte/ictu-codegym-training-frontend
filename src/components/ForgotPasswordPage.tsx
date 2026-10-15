import { useState } from 'react'
import type { FormEvent } from 'react'
import AuthShell from './AuthShell'


interface ForgotPasswordPageProps {
  onSubmit: (email: string) => Promise<void>
  onBack: () => void
}


function ForgotPasswordPage({
  onSubmit,
  onBack,
}: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setMessage('')
    setError('')
    setLoading(true)

    try {
      await onSubmit(email.trim())

      setMessage(
        'Đã gửi liên kết đặt lại mật khẩu đến email của bạn. Vui lòng kiểm tra hộp thư.',
      )
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Không thể gửi yêu cầu.')
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <AuthShell>
      <div className="login-card">
        <h1>Quên mật khẩu</h1>

        <p className="login-subtitle">
          Nhập email tài khoản của bạn
        </p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="forgot-email">
              Email
            </label>

            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Nhập email"
              required
            />
          </div>

          {message && (
            <p className="forgot-success" role="status">
              {message}
            </p>
          )}

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? 'Đang gửi...'
              : 'Gửi liên kết đặt lại mật khẩu'}
          </button>

          <button
            type="button"
            className="back-login-button"
            onClick={onBack}
          >
            ← Quay lại đăng nhập
          </button>
        </form>
      </div>
    </AuthShell>
  )
}


export default ForgotPasswordPage
