import { useState } from 'react'
import type { FormEvent } from 'react'
import AuthShell from './AuthShell'


interface LoginPageProps {
  onLogin: (
    email: string,
    password: string,
  ) => Promise<void>

  onForgotPassword: () => void
}


function LoginPage({
  onLogin,
  onForgotPassword,
}: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] =
    useState(false)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      await onLogin(email, password)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Đăng nhập thất bại.')
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <AuthShell>
      <div className="login-card login-card--welcome">
        <div className="login-heading">
          <span className="login-heading-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2 9 10-5 10 5-10 5L2 9Z" />
              <path d="M6 11v6c3 3 9 3 12 0v-6M22 9v6" />
            </svg>
          </span>
          <p className="login-eyebrow">KHÔNG GIAN ĐÀO TẠO SỐ</p>
          <h1>Chào mừng trở lại<span className="login-heading-dot">.</span></h1>

          <p className="login-subtitle">
            Đăng nhập để tiếp tục hành trình của bạn.
          </p>
        </div>


        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">
              Địa chỉ email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="ban@example.com"
              required
            />
          </div>


          <div className="login-field">
            <label htmlFor="password">
              Mật khẩu
            </label>

            <div className="password-input-wrapper">
              <input
                id="password"
                autoComplete="current-password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                placeholder="Nhập mật khẩu"
                required
              />

              <button
                type="button"
                className="password-toggle-button"
                onClick={() =>
                  setShowPassword(
                    !showPassword,
                  )
                }
                aria-label={
                  showPassword
                    ? 'Ẩn mật khẩu'
                    : 'Hiện mật khẩu'
                }
                aria-pressed={showPassword}
                title={
                  showPassword
                    ? 'Ẩn mật khẩu'
                    : 'Hiện mật khẩu'
                }
              >
                {showPassword ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3l18 18" />

                    <path
                      d="
                        M10.6 10.6
                        a2 2 0 0 0
                        2.8 2.8
                      "
                    />

                    <path
                      d="
                        M9.9 4.2
                        A10.5 10.5 0 0 1
                        12 4
                        c5 0 9 4 10 8
                        a11.8 11.8 0 0 1
                        -2 4.2
                      "
                    />

                    <path
                      d="
                        M6.6 6.6
                        A11.5 11.5 0 0 0
                        2 12
                        c1 4 5 8 10 8
                        a10.7 10.7 0 0 0
                        5.4-1.5
                      "
                    />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path
                      d="
                        M2 12
                        s3.5-7 10-7
                        10 7 10 7
                        -3.5 7-10 7
                        S2 12 2 12z
                      "
                    />

                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>


          <div className="forgot-password-row">
            <button
              type="button"
              className="forgot-password-button"
              onClick={onForgotPassword}
            >
              Quên mật khẩu?
            </button>
          </div>


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
              ? 'Đang đăng nhập...'
              : 'Đăng nhập hệ thống'}
            {!loading && <span aria-hidden="true"> →</span>}
          </button>
        </form>
        <div className="login-consultation">
          <p>Bạn cần tìm khóa học phù hợp?</p>
          <a className="consultation-login-link" href="/dang-ky-tu-van">Đăng ký tư vấn <span aria-hidden="true">→</span></a>
        </div>
      </div>
    </AuthShell>
  )
}


export default LoginPage
