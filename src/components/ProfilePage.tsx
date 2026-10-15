import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { CurrentUser } from '../types/auth'
import { getProfile, ProfileSessionError, updateProfile } from '../services/profileService'
import './ProfilePage.css'
import AvatarEditor from './AvatarEditor'
import UserRoleModal from './UserRoleModal'

interface ProfilePageProps {
  onUserUpdated: (user: CurrentUser) => void
  onSuccess: (message: string) => void
  onSessionExpired: () => void
}

const roleNames: Record<string, string> = {
  ADMIN: 'Quản trị viên', MANAGER: 'Quản lý đào tạo', TRAINING_MANAGER: 'Quản lý đào tạo',
  INSTRUCTOR: 'Giảng viên', TEACHER: 'Giảng viên', ASSISTANT: 'Trợ giảng', TA: 'Trợ giảng', STUDENT: 'Học viên', ACCOUNTANT: 'Kế toán',
  ADMISSIONS: 'Tuyển sinh', ACADEMIC_AFFAIRS: 'Giáo vụ', MANAGEMENT: 'Ban quản lý',
}

const emptyForm = { full_name: '', phone: '', date_of_birth: '', address: '' }

function toForm(user: CurrentUser) {
  return {
    full_name: user.full_name,
    phone: user.phone || '',
    date_of_birth: user.date_of_birth || '',
    address: user.address || '',
  }
}

export default function ProfilePage({ onUserUpdated, onSuccess, onSessionExpired }: ProfilePageProps) {
  const [profile, setProfile] = useState<CurrentUser | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingRoles, setEditingRoles] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const today = new Date().toLocaleDateString('sv-SE')

  useEffect(() => {
    let active = true
    getProfile().then((user) => {
      if (active) {
        setProfile(user)
        setForm(toForm(user))
      }
    }).catch((err: unknown) => {
      if (!active) return
      if (err instanceof ProfileSessionError) onSessionExpired()
      setError('Không thể tải hồ sơ cá nhân. Vui lòng thử lại.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // Reload only on entry or explicit retry; parent updates must not erase edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    setError('')
    const name = form.full_name.trim()
    const phone = form.phone.trim()
    if (!name || name.length > 100) {
      setError('Vui lòng nhập họ và tên hợp lệ, tối đa 100 ký tự.')
      return
    }
    if (phone && !/^(?:0|\+84)(?:[35789][0-9]{8}|2[0-9]{9})$/.test(phone)) {
      setError('Số điện thoại Việt Nam không hợp lệ. Ví dụ: 0912345678 hoặc +84912345678.')
      return
    }
    if (form.date_of_birth && form.date_of_birth > today) {
      setError('Ngày sinh không được ở tương lai.')
      return
    }
    if (form.address.trim().length > 255) {
      setError('Địa chỉ không được vượt quá 255 ký tự.')
      return
    }
    setSaving(true)
    try {
      const user = await updateProfile({
        full_name: name,
        phone: phone || null,
        date_of_birth: form.date_of_birth || null,
        address: form.address.trim() || null,
      })
      setProfile(user)
      setForm(toForm(user))
      onUserUpdated(user)
      onSuccess('Cập nhật hồ sơ cá nhân thành công.')
    } catch (err) {
      if (err instanceof ProfileSessionError) onSessionExpired()
      setError(err instanceof Error && !(err instanceof TypeError)
        ? err.message : 'Không thể lưu hồ sơ cá nhân. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <div className="profile-card">
        <h1 id="profile-title">Hồ sơ cá nhân</h1>
        <p className="profile-subtitle">Cập nhật thông tin liên lạc để trung tâm liên hệ với bạn khi cần.</p>
        {loading ? <p role="status">Đang tải hồ sơ...</p> : profile ? (
          <>
          <AvatarEditor user={profile} onUpdated={(user) => {
            setProfile(user)
            onUserUpdated(user)
          }} onSuccess={onSuccess} onSessionExpired={onSessionExpired} />
          <form onSubmit={handleSubmit} noValidate>
            <div className="profile-fields">
              <div className="profile-field">
                <label htmlFor="profile-name">Họ và tên <span aria-label="bắt buộc">*</span></label>
                <input id="profile-name" autoComplete="name" value={form.full_name}
                  disabled={saving} maxLength={100} required
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
              </div>
              <div className="profile-field">
                <label htmlFor="profile-phone">Số điện thoại</label>
                <input id="profile-phone" type="tel" autoComplete="tel" value={form.phone}
                  disabled={saving} maxLength={20}
                  aria-describedby="profile-phone-hint"
                  onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                <small id="profile-phone-hint">Ví dụ: 0912345678 hoặc +84912345678.</small>
              </div>
              <div className="profile-field">
                <label htmlFor="profile-birthday">Ngày sinh</label>
                <input id="profile-birthday" type="date" autoComplete="bday"
                  value={form.date_of_birth} max={today} disabled={saving}
                  onChange={(event) => setForm({ ...form, date_of_birth: event.target.value })} />
              </div>
              <div className="profile-field">
                <label htmlFor="profile-email">Email</label>
                <input id="profile-email" type="email" value={profile.email} readOnly
                  aria-describedby="profile-locked-hint" />
              </div>
              <div className="profile-field profile-field-wide">
                <label htmlFor="profile-address">Địa chỉ</label>
                <textarea id="profile-address" autoComplete="street-address" rows={3}
                  value={form.address} disabled={saving} maxLength={255}
                  onChange={(event) => setForm({ ...form, address: event.target.value })} />
              </div>
              <div className="profile-field profile-field-wide">
                <label htmlFor="profile-roles">Vai trò</label>
                <input id="profile-roles" readOnly value={profile.roles
                  .map((role) => roleNames[role] || 'Vai trò khác').join(', ') || 'Chưa được gán vai trò'}
                  aria-describedby="profile-locked-hint" />
                <small id="profile-locked-hint">Email do trung tâm quản lý. {profile.roles.includes('ADMIN') && profile.permissions.includes('ROLE_MANAGE') ? 'Bạn có thể chọn các vai trò bổ sung cho tài khoản.' : 'Chỉ quản trị viên được thay đổi vai trò trong hồ sơ cá nhân.'}</small>
                {profile.roles.includes('ADMIN') && profile.permissions.includes('ROLE_MANAGE') && <button type="button" className="profile-cancel" disabled={saving} onClick={() => setEditingRoles(true)}>Chọn vai trò</button>}
              </div>
            </div>
            {error && <p className="profile-error" role="alert">{error}</p>}
            <div className="profile-actions">
              <button type="button" className="profile-cancel" disabled={saving} onClick={() => {
                setForm(toForm(profile)); setError('')
              }}>Hoàn tác</button>
              <button type="submit" className="profile-primary" disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </button>
            </div>
          </form>
          {editingRoles && <UserRoleModal user={profile} currentUser={profile} onClose={() => setEditingRoles(false)} onUpdated={() => {
            setEditingRoles(false)
            void getProfile().then(user => { setProfile(user); onUserUpdated(user); onSuccess('Cập nhật vai trò thành công.') }).catch(err => {
              if (err instanceof ProfileSessionError) onSessionExpired()
              setError('Vai trò đã được lưu nhưng chưa tải lại được hồ sơ. Vui lòng tải lại trang.')
            })
          }} />}
          </>
        ) : <>
          <p className="profile-error" role="alert">{error}</p>
          <button type="button" className="profile-primary" onClick={() => {
            setLoading(true); setError(''); setReload(reload + 1)
          }}>Thử lại</button>
        </>}
      </div>
    </section>
  )
}
