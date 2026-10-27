import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { navigateTo } from '../navigation'
import { apiRequest } from '../api'
import { Modal, UiIcon } from '../components/Ui'
import { SearchableSelect } from '../components/ListControls'
import { showError } from '../format'
import type { AccountPage, TrainingClass, User } from '../types'

type StudentRecord = User & {
  study_program: string | null
  lead_id: number | null
  profile_created_at: string | null
}

function StudentEditor({
  student,
  onClose,
  onSaved,
  presentation = 'dialog',
}: {
  student: StudentRecord
  onClose: () => void
  onSaved: () => void
  presentation?: 'dialog' | 'page'
}) {
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setProblem('')
    const values = new FormData(event.currentTarget)
    try {
      await apiRequest(`/students/${student.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: values.get('full_name'),
          phone: values.get('phone') || null,
          birth_date: values.get('birth_date') || null,
          address: values.get('address') || null,
          study_program: values.get('study_program') || null,
        }),
      })
      onSaved()
    } catch (error) {
      setProblem(showError(error))
      setBusy(false)
    }
  }

  return (
    <Modal
      backHref={presentation === 'page' ? '/students' : undefined}
      eyebrow="HỒ SƠ HỌC VIÊN"
      onClose={onClose}
      presentation={presentation}
      size="large"
      title="Cập nhật hồ sơ"
    >
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label className="field"><span>Mã học viên</span><input readOnly value={student.student_code ?? student.username} /></label>
          <label className="field"><span>Email</span><input readOnly value={student.email} /></label>
          <label className="field"><span>Họ và tên <b>*</b></span><input defaultValue={student.full_name} maxLength={150} name="full_name" required /></label>
          <label className="field"><span>Số điện thoại</span><input defaultValue={student.phone ?? ''} maxLength={30} name="phone" /></label>
          <label className="field"><span>Ngày sinh</span><input defaultValue={student.birth_date ?? ''} name="birth_date" type="date" /></label>
          <label className="field"><span>Chương trình đào tạo</span><input defaultValue={student.study_program ?? ''} maxLength={150} name="study_program" /></label>
          <label className="field field-span-2"><span>Địa chỉ</span><input defaultValue={student.address ?? ''} maxLength={255} name="address" /></label>
        </div>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className={presentation === 'page' ? 'page-actions' : 'modal-actions'}>
          {presentation === 'dialog' ? <button className="button button-outline" onClick={onClose} type="button">Đóng</button> : null}
          <button className="button button-primary" disabled={busy} type="submit">{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        </div>
      </form>
    </Modal>
  )
}

type EnrollmentEntry = { class_id: number; class_code: string; class_name: string; course_name: string }
type EnrollmentHistoryEntry = { id: number; action: string; reason: string; effective_date: string; target_class_id: number | null }

function EnrollmentChangeModal({
  student,
  onClose,
  onSaved,
  presentation = 'dialog',
}: {
  student: StudentRecord
  onClose: () => void
  onSaved: () => void
  presentation?: 'dialog' | 'page'
}) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [enrollments, setEnrollments] = useState<EnrollmentEntry[]>([])
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [history, setHistory] = useState<EnrollmentHistoryEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [action, setAction] = useState<'suspend' | 'transfer' | 'withdraw'>('suspend')
  const [classId, setClassId] = useState('')

  useEffect(() => {
    Promise.all([
      apiRequest<EnrollmentEntry[]>(`/students/${student.id}/enrollments`),
      apiRequest<TrainingClass[]>('/classes'),
      apiRequest<EnrollmentHistoryEntry[]>(`/students/${student.id}/enrollment-history`),
    ])
      .then(([activeEnrollments, classItems, historyItems]) => {
        setEnrollments(activeEnrollments)
        setClasses(classItems)
        setHistory(historyItems)
        setClassId(String(activeEnrollments[0]?.class_id ?? ''))
      })
      .catch((error: unknown) => setProblem(showError(error)))
  }, [student.id])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!classId) {
      setProblem('Học viên chưa có lớp đang học.')
      return
    }
    setBusy(true)
    setProblem('')
    const values = new FormData(event.currentTarget)
    try {
      await apiRequest('/student-enrollment-changes', {
        method: 'POST',
        body: JSON.stringify({
          student_id: student.id,
          class_id: Number(classId),
          action,
          effective_date: values.get('effective_date'),
          reason: values.get('reason'),
          ...(action === 'transfer' ? { target_class_id: Number(values.get('target_class_id')) } : {}),
        }),
      })
      onSaved()
    } catch (error) {
      setProblem(showError(error))
      setBusy(false)
    }
  }

  return (
    <Modal
      backHref={presentation === 'page' ? '/students' : undefined}
      eyebrow={`${student.student_code ?? student.username} · BIẾN ĐỘNG HỌC VIÊN`}
      onClose={onClose}
      presentation={presentation}
      size="large"
      title={student.full_name}
    >
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label className="field"><span>Ghi danh hiện tại</span><select onChange={(event) => setClassId(event.target.value)} required value={classId}><option value="">Chọn lớp</option>{enrollments.map((enrollment) => <option key={enrollment.class_id} value={enrollment.class_id}>{enrollment.class_code} · {enrollment.course_name}</option>)}</select></label>
          <label className="field"><span>Thao tác</span><select onChange={(event) => setAction(event.target.value as typeof action)} value={action}><option value="suspend">Bảo lưu</option><option value="transfer">Chuyển lớp</option><option value="withdraw">Thôi học</option></select></label>
          {action === 'transfer' ? <label className="field"><span>Lớp đích <b>*</b></span><SearchableSelect ariaLabel="Target class" name="target_class_id" options={classes.filter((item) => String(item.id) !== classId && ['preparing', 'active'].includes(item.status)).map((item) => ({ value: String(item.id), label: `${item.code} - ${item.course_name}` }))} placeholder="Choose a class" required /></label> : null}
          <label className="field"><span>Ngày hiệu lực <b>*</b></span><input defaultValue={today} name="effective_date" required type="date" /></label>
          <label className="field field-span-2"><span>Lý do <b>*</b></span><textarea maxLength={2000} minLength={3} name="reason" required rows={3} /></label>
        </div>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className={presentation === 'page' ? 'page-actions' : 'modal-actions'}>
          {presentation === 'dialog' ? <button className="button button-outline" onClick={onClose} type="button">Đóng</button> : null}
          <button className="button button-primary" disabled={busy || !enrollments.length} type="submit">{busy ? 'Đang xử lý…' : 'Lưu biến động'}</button>
        </div>
      </form>
      <section className="lead-activity">
        <h3>Lịch sử biến động ghi danh</h3>
        {history.map((entry) => <article className="syllabus-row" key={entry.id}><strong>{entry.action} · hiệu lực {entry.effective_date}</strong><p>{entry.reason}</p></article>)}
        {!history.length ? <p>Chưa có lịch sử biến động.</p> : null}
      </section>
    </Modal>
  )
}

export function StudentWorkflowPage({
  studentId,
  action,
}: {
  studentId: number
  action: 'edit' | 'enrollment'
}) {
  const [student, setStudent] = useState<StudentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    let active = true
    async function loadStudent() {
      let pageNumber = 1
      let pageCount = 1
      do {
        const result = await apiRequest<Omit<AccountPage, 'items'> & { items: StudentRecord[] }>(
          `/students?page=${pageNumber}&page_size=100`,
        )
        pageCount = result.pages
        const found = result.items.find((item) => item.id === studentId)
        if (found) {
          if (active) {
            setStudent(found)
            setProblem('')
          }
          return
        }
        pageNumber += 1
      } while (pageNumber <= pageCount)
      throw new Error('Không tìm thấy hồ sơ học viên.')
    }

    loadStudent()
      .catch((error: unknown) => {
        if (active) setProblem(showError(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [studentId])

  if (loading) return <section className="panel detail-loading">Đang tải hồ sơ học viên…</section>
  if (!student) {
    return (
      <section className="page-stack">
        <div className="form-alert error-alert">{problem || 'Không tìm thấy hồ sơ học viên.'}</div>
        <button className="button button-outline" onClick={() => navigateTo('/students')} type="button">
          Quay lại danh sách
        </button>
      </section>
    )
  }

  const onClose = () => navigateTo('/students')
  const onSaved = () => navigateTo('/students')
  return action === 'edit' ? (
    <StudentEditor onClose={onClose} onSaved={onSaved} presentation="page" student={student} />
  ) : (
    <EnrollmentChangeModal onClose={onClose} onSaved={onSaved} presentation="page" student={student} />
  )
}

export function StudentRecordsPage() {
  const [items, setItems] = useState<StudentRecord[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState<AccountPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ page: String(page), page_size: '25' })
    if (query) params.set('q', query)
    apiRequest<AccountPage & { items: StudentRecord[] }>(`/students?${params}`)
      .then((result) => {
        if (!active) return
        setItems(result.items)
        setPageInfo(result)
        setProblem('')
      })
      .catch((error: unknown) => { if (active) setProblem(showError(error)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, query])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setQuery(searchInput.trim())
  }

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all')

  const displayedItems = useMemo(() => {
    if (statusFilter === 'all') return items
    if (statusFilter === 'active') return items.filter((s) => s.is_active && !s.is_locked)
    return items.filter((s) => !s.is_active || s.is_locked)
  }, [items, statusFilter])

  return (
    <section className="page-section">
      <div className="page-title-row">
        <div><span className="eyebrow">HỒ SƠ ĐÀO TẠO</span><h1>Danh sách học viên</h1><p>Tra cứu thông tin, chương trình học, lịch sử học tập và tiến độ chuyên cần của học viên.</p></div>
        <span className="role-pill role-student">{pageInfo?.total ?? 0} học viên</span>
      </div>
      <div className="page-toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <form className="toolbar-search" onSubmit={submitSearch} style={{ flex: 1, minWidth: '260px' }}>
          <UiIcon name="search" />
          <input aria-label="Tìm học viên" onChange={(event) => setSearchInput(event.target.value)} placeholder="Mã học viên, họ tên, email, chương trình…" value={searchInput} />
          <button className="button button-outline button-small" type="submit">Tìm</button>
        </form>
        <label className="field filter-field" style={{ margin: 0, minWidth: '160px' }}>
          <span className="visually-hidden">Lọc trạng thái</span>
          <select onChange={(e) => setStatusFilter(e.target.value as any)} value={statusFilter}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="locked">Bị khóa</option>
          </select>
        </label>
        {(query || statusFilter !== 'all') ? (
          <button
            className="button button-ghost button-small"
            onClick={() => {
              setSearchInput('')
              setQuery('')
              setStatusFilter('all')
              setPage(1)
            }}
            style={{ color: '#dc2626', fontWeight: 600 }}
            type="button"
          >
            ✕ Xóa bộ lọc
          </button>
        ) : null}
      </div>
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      <div className="table-container">
        <table className="data-table student-records-table">
          <thead><tr><th>HỌC VIÊN</th><th>MÃ SINH VIÊN</th><th>CHƯƠNG TRÌNH</th><th>LIÊN HỆ</th><th>TRẠNG THÁI</th><th style={{ textAlign: 'right' }}>THAO TÁC</th></tr></thead>
          <tbody>
            {loading ? <tr><td className="table-loading" colSpan={6}>Đang tải hồ sơ…</td></tr> : null}
            {!loading && !displayedItems.length ? <tr><td className="table-empty" colSpan={6}>Không tìm thấy học viên nào.</td></tr> : null}
            {!loading && displayedItems.map((student: StudentRecord) => (
              <tr key={student.id}>
                <td data-label="Học viên">
                  <a
                    href={`/students/${student.id}`}
                    style={{ fontWeight: 600, color: 'var(--blue, #0054a6)', textDecoration: 'none' }}
                  >
                    {student.full_name}
                  </a>
                  <span className="table-secondary">{student.email}</span>
                </td>
                <td data-label="Mã học viên"><span className="mono-code">{student.student_code ?? student.username}</span></td>
                <td data-label="Chương trình">{student.study_program ?? 'Chưa cập nhật'}</td>
                <td data-label="Điện thoại">{student.phone ?? '—'}</td>
                <td data-label="Trạng thái"><span className={`status-pill ${student.is_active && !student.is_locked ? 'status-active' : 'status-inactive'}`}>{student.is_active && !student.is_locked ? 'Đang hoạt động' : 'Bị khóa'}</span></td>
                <td data-label="Thao tác">
                  <div className="row-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                    <a className="button button-primary button-small" href={`/students/${student.id}`}>
                      Xem chi tiết
                    </a>
                    <a className="button button-outline button-small" href={`/students/${student.id}/edit`}>
                      Sửa
                    </a>
                    <a className="text-action" href={`/students/${student.id}/enrollment`}>
                      Biến động
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>Trang {page} / {pageInfo?.pages ?? 1}</span>
        <div>
          <button className="button button-page" disabled={page <= 1} onClick={() => { setLoading(true); setPage((value) => value - 1) }} type="button">Trước</button>
          <button className="button button-page" disabled={!pageInfo || page >= pageInfo.pages} onClick={() => { setLoading(true); setPage((value) => value + 1) }} type="button">Sau</button>
        </div>
      </div>
    </section>
  )
}
