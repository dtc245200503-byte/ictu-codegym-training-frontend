import { getRolePermissions } from '../services/rolePermissionService'
import {
  useEffect,
  useState,
} from 'react'

import {
  assignUserRole,
  getUserRoles,
  removeUserRole,
} from '../services/userService'

import type {
  UserItem,
} from '../services/userService'

import type {
  CurrentUser,
} from '../types/auth'


interface UserRoleModalProps {
  user: Pick<UserItem, 'user_id' | 'full_name'>
  currentUser: CurrentUser
  onClose: () => void
  onUpdated: () => void
}


const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên', INSTRUCTOR: 'Giảng viên', TEACHER: 'Giảng viên',
  STUDENT: 'Học viên', ACCOUNTANT: 'Kế toán', TRAINING_MANAGER: 'Quản lý đào tạo',
  ADMISSIONS: 'Tuyển sinh', ACADEMIC_AFFAIRS: 'Giáo vụ', MANAGEMENT: 'Ban quản lý',
  ASSISTANT: 'Trợ giảng', TA: 'Trợ giảng',
}


function UserRoleModal({
  user,
  currentUser,
  onClose,
  onUpdated,
}: UserRoleModalProps) {
  const [roles, setRoles] = useState<{ role_id: number; role_name: string; label: string }[]>([])
  const [selectedRoleIds, setSelectedRoleIds] =
    useState<number[]>([])

  const [originalRoleIds, setOriginalRoleIds] =
    useState<number[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isOwnAccount = currentUser.user_id === user.user_id
  const isReadOnly = isOwnAccount && !currentUser.roles.includes('ADMIN')


  useEffect(() => {
    const loadRoles = async () => {
      setLoading(true)
      setError('')

      try {
        const [result, catalog] = await Promise.all([getUserRoles(user.user_id), getRolePermissions()])
        setRoles(catalog.roles.map(role => ({ ...role, label: roleLabels[role.role_name] || role.role_name })))

        const roleIds = result.roles.map(
          (role) => role.role_id,
        )

        setSelectedRoleIds(roleIds)
        setOriginalRoleIds(roleIds)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError(
            'Không thể tải vai trò của người dùng.',
          )
        }
      } finally {
        setLoading(false)
      }
    }

    loadRoles()
  }, [user.user_id])


  const handleRoleChange = (
    roleId: number,
  ) => {
    if (isReadOnly || saving || (isOwnAccount && roles.find(role => role.role_id === roleId)?.role_name === 'ADMIN')) return
    setSelectedRoleIds((current) => {
      if (current.includes(roleId)) {
        return current.filter(
          (id) => id !== roleId,
        )
      }

      return [
        ...current,
        roleId,
      ]
    })
  }


  const handleSave = async () => {
    if (isReadOnly || saving || loading || !roles.length) return
    const adminRoleId = roles.find(role => role.role_name === 'ADMIN')?.role_id
    if (isOwnAccount && adminRoleId !== undefined && originalRoleIds.includes(adminRoleId) && !selectedRoleIds.includes(adminRoleId)) {
      setError('Bạn không thể tự thu hồi vai trò Quản trị viên của chính mình.')
      return
    }
    setError('')

    if (selectedRoleIds.length === 0) {
      setError(
        'Người dùng phải có ít nhất một vai trò.',
      )
      return
    }

    setSaving(true)

    try {
      const rolesToAdd = selectedRoleIds.filter(
        (roleId) =>
          !originalRoleIds.includes(roleId),
      )

      const rolesToRemove =
        originalRoleIds.filter(
          (roleId) =>
            !selectedRoleIds.includes(roleId),
        )

      for (const roleId of rolesToAdd) {
        await assignUserRole(
          user.user_id,
          roleId,
        )
      }

      for (const roleId of rolesToRemove) {
        await removeUserRole(
          user.user_id,
          roleId,
        )
      }

      onUpdated()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(
          'Không thể cập nhật vai trò.',
        )
      }
    } finally {
      setSaving(false)
    }
  }


  return (
    <div className="modal-overlay">
      <div className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-role-title">
        <div className="modal-header">
          <div>
            <h2 id="user-role-title">{isOwnAccount ? 'Vai trò của tôi' : 'Quản lý vai trò'}</h2>

            <p>
              {isReadOnly ? 'Xem vai trò của ' : 'Gán hoặc thu hồi vai trò của '}
              <strong>
                {user.full_name}
              </strong>.
            </p>
          </div>

          <button
            type="button"
            className="modal-close-button"
            aria-label="Đóng hộp thoại"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>


        {loading ? (
          <div className="table-message">
            Đang tải vai trò...
          </div>
        ) : (
          <>
            <div className="role-selection-list">
              {roles.map((role) => {
                const checked =
                  selectedRoleIds.includes(
                    role.role_id,
                  )

                return (
                  <label
                    key={role.role_id}
                    className="role-selection-item"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={
                        saving
                        || isReadOnly
                        || (isOwnAccount && role.role_name === 'ADMIN')
                      }
                      onChange={() =>
                        handleRoleChange(
                          role.role_id,
                        )
                      }
                    />

                    <span>
                      {role.label}
                    </span>
                  </label>
                )
              })}
            </div>


            {isOwnAccount && (
                <p className="role-warning">
                  {isReadOnly
                    ? 'Bạn có thể xem nhưng không được tự thay đổi vai trò. Nếu cần thay đổi, hãy nhờ quản trị viên thực hiện.'
                    : 'Bạn có thể sửa các vai trò khác của mình, nhưng không được tự thu hồi vai trò Quản trị viên.'}
                </p>
              )}


            {error && (
              <div className="user-error">
                {error}
              </div>
            )}


            <div className="modal-actions">
              <button
                type="button"
                className="modal-cancel-button"
                onClick={onClose}
                disabled={saving}
              >
                {isReadOnly ? 'Đóng' : 'Hủy'}
              </button>

              {!isReadOnly && <button
                type="button"
                className="primary-button"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? 'Đang lưu...'
                  : 'Lưu vai trò'}
              </button>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}


export default UserRoleModal
