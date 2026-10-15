import ChoiceSelect from './ChoiceSelect'
import {
  useEffect,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '../services/authService'

import {
  getUsers,
  unlockUser,
} from '../services/userService'

import type {
  UserItem,
} from '../services/userService'

import type {
  CurrentUser,
} from '../types/auth'

import CreateUserModal from './CreateUserModal'
import EditUserModal from './EditUserModal'
import ErrorPage from './ErrorPage'
import ImportUserModal from './ImportUserModal'
import LockUserModal from './LockUserModal'
import UserRoleModal from './UserRoleModal'


interface UserManagementPageProps {
  user: CurrentUser
  onCurrentUserUpdated: (user: CurrentUser) => void
}


function UserManagementPage({
  user,
  onCurrentUserUpdated,
}: UserManagementPageProps) {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserItem[]>([])
  const [search, setSearch] = useState('')
  const [roleId, setRoleId] = useState('')
  const [status, setStatus] = useState('')

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showCreateModal, setShowCreateModal] =
    useState(false)

  const [showImportModal, setShowImportModal] =
    useState(false)

  const [editingUser, setEditingUser] =
    useState<UserItem | null>(null)

  const [roleUser, setRoleUser] =
    useState<UserItem | null>(null)

  const [lockingUser, setLockingUser] =
    useState<UserItem | null>(null)

  const [unlockingUserId, setUnlockingUserId] =
    useState<number | null>(null)

  const [successMessage, setSuccessMessage] =
    useState('')

  const pageSize = 20

  const canManageRoles =
    user.permissions.includes('ROLE_MANAGE')


  const roleNames: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    INSTRUCTOR: 'Giảng viên', TEACHER: 'Giảng viên', ASSISTANT: 'Trợ giảng', TA: 'Trợ giảng',
    STUDENT: 'Học viên',
    ACCOUNTANT: 'Kế toán',
    TRAINING_MANAGER: 'Quản lý đào tạo',
    ADMISSIONS: 'Tuyển sinh',
    ACADEMIC_AFFAIRS: 'Giáo vụ',
    MANAGEMENT: 'Ban quản lý',
  }


  const showSuccessToast = (
    message: string,
  ) => {
    setSuccessMessage(message)

    window.setTimeout(() => {
      setSuccessMessage('')
    }, 3000)
  }


  const loadUsers = async (
    targetPage: number,
  ) => {
    setLoading(true)
    setError('')

    try {
      const result = await getUsers({
        search:
          search.trim() || undefined,

        role_id:
          roleId
            ? Number(roleId)
            : undefined,

        status:
          status || undefined,

        page: targetPage,
        page_size: pageSize,
      })

      setUsers(result.items)
      setTotal(result.total)
      setPage(result.page)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(
          'Không thể tải danh sách tài khoản.',
        )
      }
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    loadUsers(1)
  }, [])


  if (
    !user.permissions.includes('USER_MANAGE')
  ) {
    return (
      <ErrorPage
        statusCode={403}
        title="Không có quyền truy cập"
        message="Bạn không có quyền quản lý tài khoản."
      />
    )
  }


  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize),
  )


  const handleSearch = () => {
    setSuccessMessage('')
    loadUsers(1)
  }


  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      setSuccessMessage('')
      loadUsers(1)
    }
  }


  const handleCreated = async () => {
    setShowCreateModal(false)

    showSuccessToast(
      'Tạo tài khoản thành công. Mật khẩu tạm đã được gửi qua email.',
    )

    await loadUsers(1)
  }


  const handleImportSuccess = async (
    summaryText: string,
  ) => {
    setShowImportModal(false)
    showSuccessToast(summaryText)
    await loadUsers(1)
  }


  const handleUpdated = async () => {
    setEditingUser(null)

    showSuccessToast(
      'Cập nhật tài khoản thành công.',
    )

    await loadUsers(page)
  }


  const handleRolesUpdated = async () => {
    const updatedOwnRoles = roleUser?.user_id === user.user_id
    setRoleUser(null)

    showSuccessToast(
      'Cập nhật vai trò thành công.',
    )

    await loadUsers(page)
    if (updatedOwnRoles) {
      try {
        const updated = await getCurrentUser(localStorage.getItem('access_token') || '')
        onCurrentUserUpdated(updated)
      } catch {
        setError('Vai trò đã được lưu. Vui lòng tải lại trang để cập nhật thông tin tài khoản đang đăng nhập.')
      }
    }
  }


  const handleLocked = async () => {
    setLockingUser(null)

    showSuccessToast(
      'Khóa tài khoản thành công.',
    )

    await loadUsers(page)
  }


  const handleUnlock = async (
    item: UserItem,
  ) => {
    const confirmed = window.confirm(
      `Bạn có chắc muốn mở khóa tài khoản của ${item.full_name}?`,
    )

    if (!confirmed) {
      return
    }

    setError('')
    setSuccessMessage('')
    setUnlockingUserId(item.user_id)

    try {
      await unlockUser(item.user_id)

      showSuccessToast(
        'Mở khóa tài khoản thành công.',
      )

      await loadUsers(page)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError(
          'Không thể mở khóa tài khoản.',
        )
      }
    } finally {
      setUnlockingUserId(null)
    }
  }


  return (
    <div className="user-management-page">
      <div className="user-page-header">
        <div>
          <h1>Quản lý tài khoản</h1>

          <p>
            Tạo, sửa, quản lý vai trò và
            trạng thái tài khoản người dùng.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setSuccessMessage('')
              setShowImportModal(true)
            }}
            style={{
              padding: '12px 18px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <span>📥</span>
            Nhập từ Excel
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setSuccessMessage('')
              setShowCreateModal(true)
            }}
          >
            + Tạo tài khoản
          </button>
        </div>
      </div>


      {successMessage && (
        <div className="success-toast">
          <span className="success-toast-icon">
            ✓
          </span>

          <span>
            {successMessage}
          </span>
        </div>
      )}


      <div className="user-filters">
        <input
          type="text"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="Tìm tên, email, số điện thoại..."
        />

        <ChoiceSelect
          aria-label="Lọc theo vai trò"
          value={roleId}
          onChange={(event) =>
            setRoleId(event.target.value)
          }
        >
          <option value="">
            Tất cả vai trò
          </option>

          <option value="1">
            Quản trị viên
          </option>

          <option value="2">
            Giảng viên
          </option>

          <option value="3">
            Học viên
          </option>

          <option value="4">
            Kế toán
          </option>

          <option value="5">
            Quản lý đào tạo
          </option>

          <option value="6">
            Tuyển sinh
          </option>

          <option value="7">
            Giáo vụ
          </option>

          <option value="8">
            Ban quản lý
          </option>
        </ChoiceSelect>

        <ChoiceSelect
          aria-label="Lọc theo trạng thái tài khoản"
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
        >
          <option value="">
            Tất cả trạng thái
          </option>

          <option value="active">
            Hoạt động
          </option>

          <option value="locked">
            Đã khóa
          </option>
        </ChoiceSelect>

        <button
          type="button"
          className="search-button"
          onClick={handleSearch}
        >
          Tìm kiếm
        </button>
      </div>


      {error && (
        <div className="user-error">
          {error}
        </div>
      )}


      <div className="user-table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Lý do khóa</th>
              <th>Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="table-message"
                >
                  Đang tải...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="table-message"
                >
                  Không có tài khoản nào.
                </td>
              </tr>
            ) : (
              users.map((item) => (
                <tr key={item.user_id}>
                  <td>
                    {item.user_id}
                  </td>

                  <td>
                    {item.full_name}
                  </td>

                  <td>
                    {item.email}
                  </td>

                  <td>
                    {item.phone || '-'}
                  </td>

                  <td>
                    {item.roles.length > 0
                      ? item.roles
                          .map(
                            (role) =>
                              roleNames[
                                role.role_name
                              ]
                              || role.role_name,
                          )
                          .join(', ')
                      : 'Chưa có vai trò'}
                  </td>

                  <td>
                    <span
                      className={
                        item.status === 'active'
                          ? 'status-active'
                          : 'status-locked'
                      }
                    >
                      {item.status === 'active'
                        ? 'Hoạt động'
                        : 'Đã khóa'}
                    </span>
                  </td>

                  <td>
                    {item.status === 'locked'
                      ? item.lock_reason || '-'
                      : '-'}
                  </td>

                  <td>
                    <div className="user-action-buttons">
                      <button
                        type="button"
                        className="edit-button"
                        onClick={() => {
                          setSuccessMessage('')
                          if (item.user_id === user.user_id) {
                            navigate('/profile')
                            return
                          }
                          setEditingUser(item)
                        }}
                      >
                        Sửa
                      </button>

                      {canManageRoles && (
                        <button
                          type="button"
                          className="edit-button"
                          title={item.user_id === user.user_id && !user.roles.includes('ADMIN') ? 'Xem vai trò của bạn' : 'Cập nhật vai trò'}
                          onClick={() => {
                            setSuccessMessage('')
                            setRoleUser(item)
                          }}
                        >
                          {item.user_id === user.user_id && !user.roles.includes('ADMIN') ? 'Xem vai trò' : 'Vai trò'}
                        </button>
                      )}

                      {item.status === 'active' ? (
                        <button
                          type="button"
                          className="lock-user-button"
                          disabled={
                            item.user_id
                              === user.user_id
                          }
                          onClick={() => {
                            setSuccessMessage('')
                            setLockingUser(item)
                          }}
                        >
                          {item.user_id
                            === user.user_id
                            ? 'Tài khoản hiện tại'
                            : 'Khóa'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="unlock-user-button"
                          disabled={
                            unlockingUserId
                              === item.user_id
                          }
                          onClick={() =>
                            handleUnlock(item)
                          }
                        >
                          {unlockingUserId
                            === item.user_id
                            ? 'Đang mở...'
                            : 'Mở khóa'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>


      <div className="pagination">
        <button
          type="button"
          disabled={
            page <= 1 || loading
          }
          onClick={() =>
            loadUsers(page - 1)
          }
        >
          ← Trước
        </button>

        <span>
          Trang {page} / {totalPages}
          {' '}
          ({total} tài khoản)
        </span>

        <button
          type="button"
          disabled={
            page >= totalPages || loading
          }
          onClick={() =>
            loadUsers(page + 1)
          }
        >
          Sau →
        </button>
      </div>


      {showCreateModal && (
        <CreateUserModal
          onClose={() =>
            setShowCreateModal(false)
          }
          onCreated={handleCreated}
        />
      )}


      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() =>
            setEditingUser(null)
          }
          onUpdated={handleUpdated}
        />
      )}


      {roleUser && canManageRoles && (
        <UserRoleModal
          user={roleUser}
          currentUser={user}
          onClose={() =>
            setRoleUser(null)
          }
          onUpdated={handleRolesUpdated}
        />
      )}


      {lockingUser && (
        <LockUserModal
          user={lockingUser}
          onClose={() =>
            setLockingUser(null)
          }
          onLocked={handleLocked}
        />
      )}


      {showImportModal && (
        <ImportUserModal
          isOpen={showImportModal}
          onClose={() =>
            setShowImportModal(false)
          }
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  )
}


export default UserManagementPage
