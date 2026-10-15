import {
  useEffect,
  useState,
} from 'react'

import ErrorPage from './ErrorPage'
import './RolePermissionPage.css'

import {
  getRolePermissions,
  updateRolePermissions,
} from '../services/rolePermissionService'

import type {
  PermissionItem,
  RolePermissionItem,
} from '../services/rolePermissionService'

import type { CurrentUser } from '../types/auth'


interface RolePermissionPageProps {
  user: CurrentUser
}


const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  INSTRUCTOR: 'Giảng viên', TEACHER: 'Giảng viên', ASSISTANT: 'Trợ giảng', TA: 'Trợ giảng',
  STUDENT: 'Học viên',
  ACCOUNTANT: 'Kế toán',
  TRAINING_MANAGER: 'Quản lý đào tạo',
  ADMISSIONS: 'Tuyển sinh',
  ACADEMIC_AFFAIRS: 'Giáo vụ',
  MANAGEMENT: 'Ban quản lý',
}


function RolePermissionPage({
  user,
}: RolePermissionPageProps) {
  const [permissions, setPermissions] = useState<
    PermissionItem[]
  >([])

  const [roles, setRoles] = useState<
    RolePermissionItem[]
  >([])

  const [loading, setLoading] = useState(true)

  const [savingRoleId, setSavingRoleId] = useState<
    number | null
  >(null)

  const [error, setError] = useState('')

  const [success, setSuccess] = useState('')


  const hasPermission = user.permissions.includes(
    'ROLE_MANAGE',
  )


  useEffect(() => {
    if (!hasPermission) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        setError('')

        const data = await getRolePermissions()

        setPermissions(data.permissions)
        setRoles(data.roles)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải dữ liệu phân quyền.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [hasPermission])


  if (!hasPermission) {
    return (
      <ErrorPage
        statusCode={403}
        title="Không có quyền truy cập"
        message="Bạn không có quyền quản lý vai trò và phân quyền."
      />
    )
  }


  const handlePermissionChange = (
    roleId: number,
    permissionId: number,
  ) => {
    setSuccess('')
    setError('')

    setRoles((currentRoles) =>
      currentRoles.map((role) => {
        if (role.role_id !== roleId) {
          return role
        }

        const hasCurrentPermission =
          role.permission_ids.includes(
            permissionId,
          )

        return {
          ...role,
          permission_ids: hasCurrentPermission
            ? role.permission_ids.filter(
                (id) => id !== permissionId,
              )
            : [
                ...role.permission_ids,
                permissionId,
              ],
        }
      }),
    )
  }


  const handleSave = async (
    role: RolePermissionItem,
  ) => {
    try {
      setSavingRoleId(role.role_id)
      setError('')
      setSuccess('')

      await updateRolePermissions(
        role.role_id,
        role.permission_ids,
      )

      setSuccess(
        `Đã cập nhật quyền cho ${
          ROLE_LABELS[role.role_name]
          ?? role.role_name
        }.`,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật phân quyền.',
      )
    } finally {
      setSavingRoleId(null)
    }
  }


  if (loading) {
    return <p>Đang tải phân quyền...</p>
  }


  return (
    <div className="role-permission-page">
      <h1>Vai trò và phân quyền</h1>

      <p>
        Thiết lập quyền truy cập cho 8 vai trò
        trong hệ thống.
      </p>

      {error && (
        <p
          style={{
            padding: '12px',
            border: '1px solid #ccc',
            borderRadius: '6px',
          }}
        >
          {error}
        </p>
      )}

      {success && (
        <p
          style={{
            padding: '12px',
            border: '1px solid #ccc',
            borderRadius: '6px',
          }}
        >
          {success}
        </p>
      )}

      <div
        className="role-matrix-wrap"
        style={{
          overflowX: 'auto',
          marginTop: '24px',
        }}
      >
        <table
          className="role-matrix"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px',
                  borderBottom: '1px solid #ddd',
                }}
              >
                Quyền
              </th>

              {roles.map((role) => (
                <th
                  key={role.role_id}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #ddd',
                    minWidth: '130px',
                  }}
                >
                  {ROLE_LABELS[role.role_name]
                    ?? role.role_name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.permission_id}>
                <td
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <strong>
                    {permission.description
                      ?? permission.permission_name}
                  </strong>

                  <div>
                    <small>
                      {permission.permission_name}
                    </small>
                  </div>
                </td>

                {roles.map((role) => {
                  const isAdmin =
                    role.role_name === 'ADMIN'

                  return (
                    <td
                      key={role.role_id}
                      style={{
                        textAlign: 'center',
                        padding: '12px',
                        borderBottom:
                          '1px solid #eee',
                      }}
                    >
                      <input
                        type="checkbox"
                        aria-label={(ROLE_LABELS[role.role_name] ?? role.role_name) + ': ' + (permission.description ?? permission.permission_name)}
                        checked={
                          role.permission_ids.includes(
                            permission.permission_id,
                          )
                        }
                        disabled={isAdmin}
                        onChange={() =>
                          handlePermissionChange(
                            role.role_id,
                            permission.permission_id,
                          )
                        }
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td
                style={{
                  padding: '16px 12px',
                }}
              >
                Lưu thay đổi
              </td>

              {roles.map((role) => (
                <td
                  key={role.role_id}
                  style={{
                    textAlign: 'center',
                    padding: '16px 12px',
                  }}
                >
                  <button
                    type="button"
                    className={
                      savingRoleId === role.role_id
                        ? 'role-save-button saving'
                        : 'role-save-button'
                    }
                    disabled={
                      role.role_name === 'ADMIN'
                      || savingRoleId !== null
                    }
                    onClick={() =>
                      handleSave(role)
                    }
                  >
                    {savingRoleId === role.role_id
                      ? 'Đang lưu...'
                      : role.role_name === 'ADMIN'
                        ? 'Mặc định'
                        : 'Lưu'}
                  </button>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}


export default RolePermissionPage
