import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { navigateTo } from '../navigation'
import { apiRequest, apiUrl } from '../api'
import { Modal, RolePill, StatusPill, UiIcon } from '../components/Ui'
import { initials, showError } from '../format'
import type { AccountPage, Role, User } from '../types'

const roleOptions: { value: Role; label: string }[] = [
  { value: 'student', label: 'Học viên' },
  { value: 'teacher', label: 'Giảng viên' },
  { value: 'ta', label: 'Trợ giảng' },
  { value: 'admissions', label: 'Tuyển sinh' },
  { value: 'accountant', label: 'Kế toán' },
  { value: 'guest', label: 'Khách' },
  { value: 'manager', label: 'Quản lý đào tạo' },
  { value: 'admin', label: 'Quản trị viên' },
]

function AccountEditor({
  account,
  onClose,
  onSaved,
  notify,
  fullPage = false,
}: {
  account: User | null
  onClose: () => void
  onSaved: (created?: User) => void
  notify: (message: string) => void
  fullPage?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [credential, setCredential] = useState<{ password: string; delivery: string } | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const fields = new FormData(event.currentTarget)
    const selectedRoles = fields.getAll('roles').map(String).filter(
      (value): value is Role => roleOptions.some((option) => option.value === value),
    )
    if (!selectedRoles.length) {
      setProblem('Hãy chọn ít nhất một vai trò.')
      setBusy(false)
      return
    }
    try {
      if (account) {
        await apiRequest(`/accounts/${account.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            full_name: fields.get('full_name'),
            phone: fields.get('phone') || null,
            birth_date: fields.get('birth_date') || null,
            address: fields.get('address') || null,
          }),
        })
        if (
          [...selectedRoles].sort().join(',') !== [...account.roles].sort().join(',')
        ) {
          await apiRequest(`/accounts/${account.id}/role`, {
            method: 'PUT',
            body: JSON.stringify({ roles: selectedRoles }),
          })
        }
        notify('Thông tin tài khoản đã được cập nhật.')
        onSaved()
      } else {
        const created = await apiRequest<User & {
          temporary_password?: string
          credential_delivery: string
        }>('/accounts', {
          method: 'POST',
          body: JSON.stringify({
            username: fields.get('username'),
            email: fields.get('email'),
            full_name: fields.get('full_name'),
            roles: fields.getAll('roles'),
            password: fields.get('password'),
            student_code: fields.get('student_code') || null,
            phone: fields.get('phone') || null,
          }),
        })
        onSaved(created)
        if (created.temporary_password) {
          setCredential({
            password: created.temporary_password,
            delivery: created.credential_delivery,
          })
        } else {
          notify('Đã tạo tài khoản và gửi thông tin đăng nhập qua email.')
          onClose()
        }
      }
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }

  if (credential) {
    return (
      <Modal eyebrow="TÀI KHOẢN ĐÃ TẠO" onClose={onClose} title="Gửi thông tin đăng nhập">
        <div className="credential-panel">
          <span className="credential-check"><UiIcon name="check" size={22} /></span>
          <p>Máy chủ chưa cấu hình email. Hãy gửi mật khẩu tạm thời này cho người dùng.</p>
          <label className="field">
            <span>Mật khẩu tạm thời</span>
            <div className="copy-field">
              <input readOnly value={credential.password} />
              <button
                className="button button-outline"
                onClick={() => {
                  void navigator.clipboard.writeText(credential.password)
                  notify('Đã sao chép mật khẩu.')
                }}
                type="button"
              >
                Sao chép
              </button>
            </div>
          </label>
          <div className="form-alert info-alert">Phương thức bàn giao: {credential.delivery === 'manual' ? 'Thủ công' : 'Email'}</div>
          <button className="button button-primary button-full" onClick={onClose} type="button">Hoàn tất</button>
        </div>
      </Modal>
    )
  }

  const form = (
    <form className={`dialog-form ${fullPage ? 'account-editor-form' : ''}`} onSubmit={submit}>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className="form-grid">
          {!account ? (
            <>
              <label className="field">
                <span>Mã đăng nhập <b>*</b></span>
                <input autoFocus maxLength={50} minLength={3} name="username" placeholder="VD: SV2026001" required />
              </label>
              <label className="field">
                <span>Email <b>*</b></span>
                <input maxLength={255} name="email" placeholder="ten@ictu.edu.vn" required type="email" />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                <span>Mã đăng nhập</span>
                <input disabled value={account.username} />
              </label>
              <label className="field">
                <span>Email</span>
                <input disabled value={account.email} />
              </label>
            </>
          )}
          <label className="field">
            <span>Họ và tên <b>*</b></span>
            <input
              autoComplete="name"
              defaultValue={account?.full_name}
              maxLength={150}
              name="full_name"
              placeholder="Nhập họ và tên đầy đủ"
              required
            />
          </label>
          <fieldset className="field field-span-2">
            <legend>Vai trò <b>*</b></legend>
            <div className="form-grid">
              {roleOptions.map((role) => (
                <label className="checkbox-field" key={role.value}>
                  <input
                    defaultChecked={account ? account.roles.includes(role.value) : role.value === 'student'}
                    name="roles"
                    type="checkbox"
                    value={role.value}
                  />
                  <span>{role.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {!account ? (
            <label className="field">
              <span>Mật khẩu khởi tạo <b>*</b></span>
              <input
                autoComplete="new-password"
                defaultValue="123456"
                maxLength={128}
                minLength={1}
                name="password"
                required
                type="password"
              />
            </label>
          ) : null}
          {!account ? (
            <label className="field">
              <span>Mã học viên</span>
              <input maxLength={50} name="student_code" placeholder="Để trống nếu là giảng viên" />
            </label>
          ) : null}
          <label className="field">
            <span>Số điện thoại</span>
            <input autoComplete="tel" defaultValue={account?.phone ?? ''} maxLength={30} name="phone" placeholder="09xx xxx xxx" />
          </label>
          {account ? (
            <>
              <label className="field">
                <span>Ngày sinh</span>
                <input defaultValue={account.birth_date ?? ''} name="birth_date" type="date" />
              </label>
              <label className="field">
                <span>Địa chỉ</span>
                <input defaultValue={account.address ?? ''} maxLength={255} name="address" placeholder="Địa chỉ liên hệ" />
              </label>
            </>
          ) : null}
        </div>
        {!account ? <p className="form-note">Mật khẩu khởi tạo mặc định là 123456. Người dùng bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.</p> : null}
        <div className={fullPage ? 'page-actions' : 'modal-actions'}>
          <button className="button button-outline" onClick={onClose} type="button">Hủy</button>
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? 'Đang lưu…' : account ? 'Lưu thay đổi' : 'Tạo tài khoản'} {!busy ? <UiIcon name="arrow" size={16} /> : null}
          </button>
        </div>
      </form>
  )

  if (fullPage) {
    return (
      <div className="page-stack">
        <div className="page-title-row">
          <div>
            <span className="eyebrow">HỆ THỐNG NGƯỜI DÙNG</span>
            <h1>Cập nhật tài khoản</h1>
            <p>Chỉnh sửa thông tin cá nhân và các quyền được cấp cho tài khoản.</p>
          </div>
          <a className="button button-outline" href="/accounts">Quay lại danh sách</a>
        </div>
        <section className="panel account-editor-panel">{form}</section>
      </div>
    )
  }

  return (
    <Modal
      eyebrow={account ? 'HỒ SƠ NGƯỜI DÙNG' : 'CẤP TÀI KHOẢN MỚI'}
      onClose={onClose}
      size="large"
      title={account ? 'Cập nhật thông tin' : 'Thêm tài khoản'}
    >
      {form}
    </Modal>
  )
}

export function AccountEditPage({
  accountId,
  notify,
}: {
  accountId: number
  notify: (message: string) => void
}) {
  const [account, setAccount] = useState<User | null>(null)
  const [problem, setProblem] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadAccount() {
      let page = 1
      let total = 0
      do {
        const result = await apiRequest<AccountPage>(`/accounts?page=${page}&page_size=100`)
        const match = result.items.find((item) => item.id === accountId)
        if (match) {
          if (active) setAccount(match)
          return
        }
        total = result.total
        page += 1
        if (!result.items.length) break
      } while ((page - 1) * 100 < total)

      throw new Error('Không tìm thấy tài khoản cần chỉnh sửa.')
    }

    loadAccount()
      .catch((error: unknown) => {
        if (active) setProblem(showError(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [accountId])

  if (loading) {
    return <section className="panel detail-loading">Đang tải hồ sơ tài khoản…</section>
  }

  if (problem || !account) {
    return (
      <section className="page-stack">
        <div className="form-alert error-alert">{problem || 'Không tìm thấy tài khoản.'}</div>
        <button
          className="button button-outline"
          onClick={() => navigateTo('/accounts')}
          type="button"
        >
          Quay lại danh sách tài khoản
        </button>
      </section>
    )
  }

  return (
    <AccountEditor
      account={account}
      fullPage
      notify={notify}
      onClose={() => navigateTo('/accounts')}
      onSaved={() => navigateTo('/accounts')}
    />
  )
}

function StatusReasonModal({
  account,
  action,
  onClose,
  onConfirm,
}: {
  account: User
  action: 'lock' | 'unlock'
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    try {
      await onConfirm(reason)
    } catch (error) {
      setProblem(showError(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      eyebrow="XÁC NHẬN THAY ĐỔI"
      onClose={onClose}
      title={action === 'lock' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
    >
      <form className="dialog-form" onSubmit={submit}>
        <p className="modal-description">
          {action === 'lock'
            ? `Tài khoản ${account.full_name} sẽ không thể đăng nhập sau khi bị khóa.`
            : `Khôi phục quyền đăng nhập cho ${account.full_name}.`}
        </p>
        <label className="field">
          <span>Lý do <b>*</b></span>
          <textarea
            autoFocus
            maxLength={500}
            minLength={3}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nhập lý do để lưu vào lịch sử hệ thống"
            required
            rows={3}
            value={reason}
          />
        </label>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose} type="button">Hủy</button>
          <button className={`button ${action === 'lock' ? 'button-danger' : 'button-primary'}`} disabled={busy} type="submit">
            {busy ? 'Đang xử lý…' : action === 'lock' ? 'Khóa tài khoản' : 'Mở khóa'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ImportCredentialsModal({
  accounts,
  onClose,
}: {
  accounts: { email: string; temporary_password: string; credential_delivery: string }[]
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const credentials = accounts
    .map((account) => `${account.email}\t${account.temporary_password}`)
    .join('\n')
  return (
    <Modal eyebrow="NHẬP TÀI KHOẢN THÀNH CÔNG" onClose={onClose} size="large" title="Bàn giao mật khẩu tạm thời">
      <div className="credential-panel">
        <span className="credential-check"><UiIcon name="check" size={22} /></span>
        <p>Máy chủ đã tạo {accounts.length} tài khoản nhưng email chưa được gửi. Hãy sao chép danh sách bên dưới và bàn giao an toàn cho người dùng.</p>
        <div className="credential-list">
          {accounts.map((account) => (
            <div className="credential-list-row" key={account.email}>
              <strong>{account.email}</strong><code>{account.temporary_password}</code>
              {account.credential_delivery === 'failed' ? <span>Gửi email thất bại</span> : <span>Bàn giao thủ công</span>}
            </div>
          ))}
        </div>
        <div className="form-alert info-alert">Mật khẩu chỉ hiển thị trong lần nhập này. Hãy lưu giữ an toàn.</div>
        <div className="modal-actions">
          <button
            className="button button-outline"
            onClick={() => {
              void navigator.clipboard.writeText(credentials)
              setCopied(true)
            }}
            type="button"
          >
            {copied ? 'Đã sao chép' : 'Sao chép danh sách'}
          </button>
          <button className="button button-primary" onClick={onClose} type="button">Hoàn tất</button>
        </div>
      </div>
    </Modal>
  )
}

type ImportPreview = {
  total_rows: number
  valid_count: number
  invalid_count: number
  rows: { row: number; username: string; email: string; full_name: string; valid: boolean; errors: string[] }[]
}

export function AccountsPage({
  user,
  notify,
}: {
  user: User
  notify: (message: string) => void
}) {
  const [data, setData] = useState<AccountPage | null>(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [editor, setEditor] = useState<User | null | undefined>(undefined)
  const [statusTarget, setStatusTarget] = useState<{ account: User; action: 'lock' | 'unlock' } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [importCredentials, setImportCredentials] = useState<{ email: string; temporary_password: string; credential_delivery: string }[]>([])
  const uploadInput = useRef<HTMLInputElement>(null)
  const canEdit = user.roles.includes('admin')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      const query = new URLSearchParams({ page: String(page), page_size: '20' })
      if (q.trim()) query.set('q', q.trim())
      if (role) query.set('role', role)
      apiRequest<AccountPage>(`/accounts?${query}`)
        .then((result) => {
          setData(result)
          setProblem('')
        })
        .catch((error: unknown) => setProblem(showError(error)))
        .finally(() => setLoading(false))
    }, q ? 240 : 0)
    return () => window.clearTimeout(timer)
  }, [page, q, refresh, role])

  function changeFilter(nextRole: string) {
    setRole(nextRole)
    setPage(1)
  }

  async function downloadTemplate() {
    try {
      const token = sessionStorage.getItem('ictu_access_token')
      const response = await fetch(apiUrl('/accounts/template'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) throw new Error('Không tải được file mẫu.')
      const file = await response.blob()
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'ictu-account-template.xlsx'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      notify(showError(error))
    }
  }

  async function importWorkbook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      notify('Vui lòng chọn file Excel định dạng .xlsx.')
      return
    }
    setImporting(true)
    try {
      const result = await apiRequest<ImportPreview>('/accounts/import?preview=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: await file.arrayBuffer(),
      })
      setImportFile(file)
      setImportPreview(result)
    } catch (error) {
      notify(showError(error))
    } finally {
      setImporting(false)
    }
  }

  async function confirmImport() {
    if (!importFile || !importPreview?.valid_count) return
    setImporting(true)
    try {
      const result = await apiRequest<{ created_count: number; skipped_count: number; accounts: { email: string; credential_delivery: string; temporary_password?: string }[] }>('/accounts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: await importFile.arrayBuffer(),
      })
      setImportPreview(null)
      setImportFile(null)
      setRefresh((value) => value + 1)
      const credentials = result.accounts.filter((item) => item.temporary_password)
      if (credentials.length) {
        setImportCredentials(credentials as { email: string; temporary_password: string; credential_delivery: string }[])
      } else {
        notify(`Đã nhập ${result.created_count} tài khoản; bỏ qua ${result.skipped_count} dòng lỗi.`)
      }
    } catch (error) {
      notify(showError(error))
    } finally {
      setImporting(false)
    }
  }

  async function confirmStatus(reason: string) {
    if (!statusTarget) return
    const result = await apiRequest<{ handover_classes?: string[] }>(`/accounts/${statusTarget.account.id}/${statusTarget.action}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    setStatusTarget(null)
    setRefresh((value) => value + 1)
    if (statusTarget.action === 'lock' && result.handover_classes?.length) {
      notify(`Đã khóa tài khoản. Cần bàn giao lớp: ${result.handover_classes.join(', ')}.`)
    } else {
      notify(statusTarget.action === 'lock' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.')
    }
  }

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">HỆ THỐNG NGƯỜI DÙNG</span>
          <h1>Quản lý tài khoản</h1>
          <p>Quản lý hồ sơ, quyền truy cập của học viên và giảng viên.</p>
        </div>
        {canEdit ? (
          <div className="page-actions">
            <button className="button button-outline" disabled={importing} onClick={downloadTemplate} type="button"><UiIcon name="download" size={17} /> Tải file mẫu</button>
            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="visually-hidden"
              onChange={importWorkbook}
              ref={uploadInput}
              type="file"
            />
            <button className="button button-outline" disabled={importing} onClick={() => uploadInput.current?.click()} type="button"><UiIcon name="upload" size={17} /> {importing ? 'Đang nhập…' : 'Nhập Excel'}</button>
            <button className="button button-primary" onClick={() => setEditor(null)} type="button"><UiIcon name="plus" size={17} /> Thêm tài khoản</button>
          </div>
        ) : null}
      </div>

      <section className="panel data-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <UiIcon name="search" size={18} />
            <input
              aria-label="Tìm kiếm tài khoản"
              onChange={(event) => {
                setQ(event.target.value)
                setPage(1)
              }}
              placeholder="Tìm theo tên, email hoặc mã số…"
              value={q}
            />
          </div>
          <label className="filter-select">
            <UiIcon name="filter" size={16} />
            <select aria-label="Lọc theo vai trò" onChange={(event) => changeFilter(event.target.value)} value={role}>
              <option value="">Tất cả vai trò</option>
              {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {(q || role) ? (
            <button
              className="button button-ghost button-small"
              onClick={() => {
                setQ('')
                setRole('')
                setPage(1)
              }}
              style={{ color: '#dc2626', fontWeight: 600 }}
              type="button"
            >
              ✕ Xóa bộ lọc
            </button>
          ) : null}
          <span className="table-total">{data?.total ?? '—'} tài khoản</span>
        </div>
        {problem ? <div className="inline-error">{problem}</div> : null}
        <div className="table-scroll">
          <table className="data-table account-table">
            <thead>
              <tr>
                <th>NGƯỜI DÙNG</th>
                <th>MÃ ĐỊNH DANH</th>
                <th>VAI TRÒ</th>
                <th>LIÊN HỆ</th>
                <th>TRẠNG THÁI</th>
                {canEdit ? <th aria-label="Thao tác" /> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="table-loading" colSpan={canEdit ? 6 : 5}>Đang tải danh sách tài khoản…</td></tr>
              ) : data?.items.length ? data.items.map((account, index) => (
                <tr key={account.id}>
                  <td>
                    <div className="person-cell">
                      <div className={`avatar table-avatar avatar-tone-${index % 5}`}>{initials(account.full_name)}</div>
                      <div><strong>{account.full_name}</strong><span>{account.email}</span></div>
                    </div>
                  </td>
                  <td><span className="mono-code">{account.student_code ?? account.username}</span></td>
                  <td><div className="role-pill-list">{account.roles.map((role) => <RolePill key={role} role={role} />)}</div></td>
                  <td className="muted-cell">{account.phone || '—'}</td>
                  <td><StatusPill locked={account.is_locked || !account.is_active} /></td>
                  {canEdit ? (
                    <td>
                      <div className="row-actions">
                        <a aria-label={`Sửa ${account.full_name}`} className="icon-button row-action" href={`/accounts/${account.id}/edit`} title="Chỉnh sửa"><UiIcon name="edit" size={16} /></a>
                        {account.id !== user.id ? (
                          <button
                            aria-label={account.is_locked ? `Mở khóa ${account.full_name}` : `Khóa ${account.full_name}`}
                            className={`icon-button row-action ${account.is_locked ? 'unlock-action' : 'lock-action'}`}
                            onClick={() => setStatusTarget({ account, action: account.is_locked ? 'unlock' : 'lock' })}
                            title={account.is_locked ? 'Mở khóa' : 'Khóa tài khoản'}
                            type="button"
                          >
                            <UiIcon name={account.is_locked ? 'check' : 'shield'} size={16} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              )) : (
                <tr><td className="table-empty" colSpan={canEdit ? 6 : 5}>
                  <div className="empty-state"><div className="empty-icon"><UiIcon name="users" size={22} /></div><strong>Không tìm thấy tài khoản</strong><span>Thử thay đổi từ khóa hoặc bộ lọc.</span></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>Hiển thị {data?.items.length ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, data?.total ?? 0)} trong {data?.total ?? 0} tài khoản</span>
          <div>
            <button className="button button-page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Trước</button>
            <span className="page-current">{page} / {Math.max(data?.pages ?? 1, 1)}</span>
            <button className="button button-page" disabled={!data || page >= data.pages} onClick={() => setPage((value) => value + 1)} type="button">Tiếp</button>
          </div>
        </div>
      </section>
      {editor !== undefined ? (
        <AccountEditor
          account={editor}
          notify={notify}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor(undefined)
            setRefresh((value) => value + 1)
          }}
        />
      ) : null}
      {statusTarget ? (
        <StatusReasonModal
          account={statusTarget.account}
          action={statusTarget.action}
          onClose={() => setStatusTarget(null)}
          onConfirm={confirmStatus}
        />
      ) : null}
      {importPreview ? (
        <Modal eyebrow="KIỂM TRA FILE EXCEL" onClose={() => { setImportPreview(null); setImportFile(null) }} size="large" title="Xem trước dữ liệu nhập">
          <p className="form-note">{importPreview.total_rows} dòng · {importPreview.valid_count} hợp lệ · {importPreview.invalid_count} có lỗi. Chỉ các dòng hợp lệ sẽ được nhập.</p>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>DÒNG</th><th>TÀI KHOẢN</th><th>HỌ TÊN</th><th>KẾT QUẢ KIỂM TRA</th></tr></thead>
              <tbody>{importPreview.rows.map((row) => (
                <tr key={row.row}>
                  <td>{row.row}</td>
                  <td><strong>{row.username}</strong><small className="cell-subtitle">{row.email}</small></td>
                  <td>{row.full_name}</td>
                  <td>{row.valid ? <span className="status-pill status-active"><i />Hợp lệ</span> : <span className="form-alert error-alert">{row.errors.join('; ')}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button className="button button-outline" onClick={() => { setImportPreview(null); setImportFile(null) }} type="button">Hủy</button>
            <button className="button button-primary" disabled={importing || !importPreview.valid_count} onClick={() => void confirmImport()} type="button">{importing ? 'Đang nhập…' : `Nhập ${importPreview.valid_count} tài khoản hợp lệ`}</button>
          </div>
        </Modal>
      ) : null}
      {importCredentials.length ? (
        <ImportCredentialsModal accounts={importCredentials} onClose={() => setImportCredentials([])} />
      ) : null}
    </div>
  )
}
