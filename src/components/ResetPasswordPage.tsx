import { useState } from 'react'
import type { FormEvent } from 'react'
import AuthShell from './AuthShell'


interface ResetPasswordPageProps {
  onSubmit: (
    password: string,
  ) => Promise<void>

  onBack: () => void
}


function ResetPasswordPage({
  onSubmit,
  onBack,
}: ResetPasswordPageProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError(
        'Mật khẩu xác nhận không khớp.',
      )
      return
    }

    if (password.length < 8) {
      setError(
        'Mật khẩu phải có ít nhất 8 ký tự.',
      )
      return
    }

    if (!/[A-Za-z]/.test(password)) {
      setError(
        'Mật khẩu phải có ít nhất một chữ cái.',
      )
      return
    }

    if (!/[0-9]/.test(password)) {
      setError(
        'Mật khẩu phải có ít nhất một chữ số.',
      )
      return
    }

    setLoading(true)

    try {
      await onSubmit(password)

      setMessage(
        'Đặt lại mật khẩu thành công.',
      )

      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(
          'Không thể đặt lại mật khẩu.',
        )
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <AuthShell>
      <div className="login-card">
        <h1>Đặt lại mật khẩu</h1>

        <p className="login-subtitle">
          Nhập mật khẩu mới cho tài khoản
        </p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="new-password">
              Mật khẩu mới
            </label>

            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Nhập mật khẩu mới"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="confirm-password">
              Xác nhận mật khẩu
            </label>

            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              placeholder="Nhập lại mật khẩu"
              required
            />
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="forgot-success" role="status">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? 'Đang xử lý...'
              : 'Đặt lại mật khẩu'}
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


export default ResetPasswordPage
