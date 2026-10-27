import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { apiRequest } from '../api'
import { Modal } from './Ui'
import { showError } from '../format'
import type { User } from '../types'

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'))
    reader.onload = () => {
      const result = String(reader.result)
      const separator = result.indexOf(',')
      if (separator < 0) {
        reject(new Error('Tệp ảnh không hợp lệ.'))
        return
      }
      resolve(result.slice(separator + 1))
    }
    reader.readAsDataURL(file)
  })
}

async function centerCrop(file: File): Promise<{ crop_x: number; crop_y: number; crop_size: number }> {
  const image = await createImageBitmap(file)
  const cropSize = Math.min(image.width, image.height)
  const crop = { crop_x: Math.floor((image.width - cropSize) / 2), crop_y: Math.floor((image.height - cropSize) / 2), crop_size: cropSize }
  image.close()
  return crop
}

export function ProfileModal({
  user,
  avatarUrl,
  onAvatarChanged,
  onUserUpdated,
  onPasswordChange,
  onClose,
}: {
  user: User
  avatarUrl: string | null
  onAvatarChanged: () => void
  onUserUpdated: (user: User) => void
  onPasswordChange: () => void
  onClose: () => void
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [message, setMessage] = useState('')
  const [reminderPreference, setReminderPreference] = useState<'enabled' | 'disabled' | ''>('')

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  function clearSelectedFile() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    setSelectedFile(null)
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    setMessage('')
    const values = new FormData(event.currentTarget)
    try {
      const updated = await apiRequest<User>('/me', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: values.get('full_name'),
          phone: values.get('phone') || null,
          birth_date: values.get('birth_date') || null,
          address: values.get('address') || null,
        }),
      })
      onUserUpdated(updated)
      setMessage('Thông tin cá nhân đã được cập nhật.')
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function saveAvatar() {
    if (!selectedFile) return
    setBusy(true)
    setProblem('')
    setMessage('')
    try {
      await apiRequest('/me/avatar', {
        method: 'PUT',
        body: JSON.stringify({
          content_type: selectedFile.type,
          data_base64: await readAsBase64(selectedFile),
          ...await centerCrop(selectedFile),
        }),
      })
      clearSelectedFile()
      onAvatarChanged()
      setMessage('Ảnh đại diện đã được cập nhật.')
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function removeAvatar() {
    setBusy(true)
    setProblem('')
    setMessage('')
    try {
      await apiRequest('/me/avatar', { method: 'DELETE' })
      clearSelectedFile()
      onAvatarChanged()
      setMessage('Ảnh đại diện đã được xóa.')
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  async function saveReminderPreference() {
    if (!reminderPreference) return
    setBusy(true)
    setProblem('')
    setMessage('')
    try {
      await apiRequest('/me/class-reminder-preferences', {
        method: 'PUT',
        body: JSON.stringify({ class_reminder_opt_out: reminderPreference === 'disabled' }),
      })
      setMessage(reminderPreference === 'disabled' ? 'Đã tắt email nhắc lịch học.' : 'Đã bật email nhắc lịch học.')
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  function selectAvatar(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      clearSelectedFile()
      setProblem('Chỉ chấp nhận ảnh PNG, JPEG hoặc WebP.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      clearSelectedFile()
      setProblem('Ảnh đại diện tối đa 2 MB.')
      return
    }
    setProblem('')
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = URL.createObjectURL(file)
    setPreviewUrl(previewUrlRef.current)
    setSelectedFile(file)
  }

  return (
    <Modal eyebrow="HỒ SƠ CÁ NHÂN" onClose={onClose} size="large" title="Thông tin tài khoản">
      <div className="profile-avatar-editor">
        <div className="profile-avatar-preview">
          {previewUrl || avatarUrl
            ? <img alt="Ảnh đại diện" src={previewUrl ?? avatarUrl ?? undefined} />
            : <span>{user.full_name.slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className="profile-avatar-controls">
          <strong>Ảnh đại diện</strong>
          <span>PNG, JPEG hoặc WebP · tối đa 2 MB</span>
          <label className="button button-outline button-small">
            Chọn ảnh
            <input
              accept="image/png,image/jpeg,image/webp"
              className="visually-hidden"
              onChange={(event) => selectAvatar(event.target.files?.[0])}
              type="file"
            />
          </label>
          {selectedFile ? (
            <button className="button button-primary button-small" disabled={busy} onClick={() => void saveAvatar()} type="button">
              {busy ? 'Đang tải…' : 'Lưu ảnh'}
            </button>
          ) : null}
          {avatarUrl && !selectedFile ? (
            <button className="text-button" disabled={busy} onClick={() => void removeAvatar()} type="button">Xóa ảnh</button>
          ) : null}
        </div>
      </div>
      <form className="dialog-form" onSubmit={saveProfile}>
        <div className="form-grid">
          <label className="field field-span-2">
            <span>Họ và tên <b>*</b></span>
            <input autoFocus defaultValue={user.full_name} maxLength={150} name="full_name" required />
          </label>
          <label className="field">
            <span>Email</span>
            <input readOnly value={user.email} />
          </label>
          <label className="field">
            <span>Số điện thoại</span>
            <input defaultValue={user.phone ?? ''} maxLength={30} name="phone" pattern="(?:\+?84|0)(?:3|5|7|8|9)[0-9]{8}" title="Nhập số điện thoại Việt Nam gồm 10 chữ số hoặc mã quốc gia +84." type="tel" />
          </label>
          <label className="field">
            <span>Ngày sinh</span>
            <input defaultValue={user.birth_date ?? ''} name="birth_date" type="date" />
          </label>
          <label className="field">
            <span>Địa chỉ</span>
            <input defaultValue={user.address ?? ''} maxLength={255} name="address" />
          </label>
        </div>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        {message ? <div className="form-alert success-alert">{message}</div> : null}
        <div className="modal-actions">
          <button className="text-button" onClick={onPasswordChange} type="button">Đổi mật khẩu</button>
          <div>
            <button className="button button-outline" onClick={onClose} type="button">Đóng</button>
            <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu thông tin'}</button>
          </div>
        </div>
      </form>
      {user.roles.includes('student') ? (
        <section className="profile-reminder-preference" aria-labelledby="reminder-preference-title">
          <h3 id="reminder-preference-title">Email nhắc lịch học</h3>
          <p>Chọn nhận hoặc tắt email nhắc lịch. Lựa chọn của bạn được lưu riêng cho tài khoản học viên.</p>
          <label className="checkbox-field"><input checked={reminderPreference === 'enabled'} name="class-reminder" onChange={() => setReminderPreference('enabled')} type="radio" /><span>Nhận email nhắc lịch</span></label>
          <label className="checkbox-field"><input checked={reminderPreference === 'disabled'} name="class-reminder" onChange={() => setReminderPreference('disabled')} type="radio" /><span>Tắt email nhắc lịch</span></label>
          <button className="button button-outline button-small" disabled={busy || !reminderPreference} onClick={() => void saveReminderPreference()} type="button">Lưu lựa chọn nhắc lịch</button>
        </section>
      ) : null}
    </Modal>
  )
}
