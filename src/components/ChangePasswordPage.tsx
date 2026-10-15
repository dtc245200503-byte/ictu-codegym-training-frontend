import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  changePassword,
} from '../services/authService'


interface ChangePasswordPageProps {
  onSuccess: (
    message: string,
  ) => void
}


function EyeIcon() {
  return (
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
  )
}


function EyeOffIcon() {
  return (
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
  )
}


function ChangePasswordPage({
  onSuccess,
}: ChangePasswordPageProps) {
  const navigate = useNavigate()
  const [
    currentPassword,
    setCurrentPassword,
  ] = useState('')

  const [
    newPassword,
    setNewPassword,
  ] = useState('')

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('')

  const [
    showCurrentPassword,
    setShowCurrentPassword,
  ] = useState(false)

  const [
    showNewPassword,
    setShowNewPassword,
  ] = useState(false)

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false)

  const [error, setError] =
    useState('')

  const [loading, setLoading] =
    useState(false)


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')

    if (!currentPassword) {
      setError(
        'Vui lòng nhập mật khẩu hiện tại.',
      )
      return
    }

    if (
      newPassword.length < 8
      || !/[A-Z]/.test(newPassword)
      || !/[a-z]/.test(newPassword)
      || !/[0-9]/.test(newPassword)
      || !/[@$!%*?&]/.test(newPassword)
    ) {
      setError(
        'Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt (@, $, !, %, *, ?, &).',
      )
      return
    }

    if (
      newPassword !== confirmPassword
    ) {
      setError(
        'Xác nhận mật khẩu mới không khớp.',
      )
      return
    }

    setLoading(true)

    try {
      await changePassword(
        currentPassword,
        newPassword,
      )

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      onSuccess(
        'Đổi mật khẩu thành công. Các phiên đăng nhập khác đã được thu hồi.',
      )
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(
          'Không thể đổi mật khẩu.',
        )
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="change-password-page">
      <div className="change-password-card">
        <h1>Đổi mật khẩu</h1>

        <p className="change-password-subtitle">
          Cập nhật mật khẩu để bảo vệ tài khoản của bạn.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="change-password-field">
            <label htmlFor="current-password">
              Mật khẩu hiện tại
            </label>

            <div className="password-input-wrapper">
              <input
                id="current-password"
                type={
                  showCurrentPassword
                    ? 'text'
                    : 'password'
                }
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(
                    event.target.value,
                  )
                }
                placeholder="Nhập mật khẩu hiện tại"
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="password-toggle-button"
                onClick={() =>
                  setShowCurrentPassword(
                    !showCurrentPassword,
                  )
                }
                aria-label={
                  showCurrentPassword
                    ? 'Ẩn mật khẩu'
                    : 'Hiện mật khẩu'
                }
                title={
                  showCurrentPassword
                    ? 'Ẩn mật khẩu'
                    : 'Hiện mật khẩu'
                }
              >
                {showCurrentPassword
                  ? <EyeOffIcon />
                  : <EyeIcon />}
              </button>
            </div>
          </div>


          <div className="change-password-field">
            <label htmlFor="new-password">
              Mật khẩu mới
            </label>

            <div className="password-input-wrapper">
              <input
                id="new-password"
                type={
                  showNewPassword
                    ? 'text'
                    : 'password'
                }
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(
                    event.target.value,
                  )
                }
                placeholder="Nhập mật khẩu mới"
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="password-toggle-button"
                onClick={() =>
                  setShowNewPassword(
                    !showNewPassword,
                  )
                }
                aria-label={
                  showNewPassword
                    ? 'Ẩn mật khẩu'
                    : 'Hiện mật khẩu'
                }
                title={
                  showNewPassword
                    ? 'Ẩn mật khẩu'
                    : 'Hiện mật khẩu'
                }
              >
                {showNewPassword
                  ? <EyeOffIcon />
                  : <EyeIcon />}
              </button>
            </div>

            <small className="password-requirement">
              Tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt (@, $, !, %, *, ?, &).
            </small>
          </div>


          <div className="change-password-field">
            <label htmlFor="confirm-password">
              Xác nhận mật khẩu mới
            </label>

            <div className="password-input-wrapper">
              <input
                id="confirm-password"
                type={
                  showConfirmPassword
                    ? 'text'
                    : 'password'
                }
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="password-toggle-button"
                onClick={() =>
                  setShowConfirmPassword(
                    !showConfirmPassword,
                  )
                }
                aria-label={
                  showConfirmPassword
                    ? 'Ẩn mật khẩu'
                    : 'Hiện mật khẩu'
                }
                title={
                  showConfirmPassword
                    ? 'Ẩn mật khẩu'
                    : 'Hiện mật khẩu'
                }
              >
                {showConfirmPassword
                  ? <EyeOffIcon />
                  : <EyeIcon />}
              </button>
            </div>
          </div>


          {error && (
            <p className="change-password-error">
              {error}
            </p>
          )}


          <button
            type="submit"
            className="change-password-submit"
            disabled={loading}
          >
            {loading
              ? 'Đang đổi mật khẩu...'
              : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  )
}


export default ChangePasswordPage
