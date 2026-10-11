import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { apiRequest } from '../api'
import { Modal, UiIcon } from '../components/Ui'
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
}: {
  student: StudentRecord
  onClose: () => void
  onSaved: () => void
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
    <Modal eyebrow="HỒ SƠ HỌC VIÊN" onClose={onClose} size="large" title="Cập nhật hồ sơ">
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
        <div className="modal-actions">
          <button className="button button-outline" onClick={onClose} type="button">Đóng</button>
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
}: {
  student: StudentRecord
  onClose: () => void
  onSaved: () => void
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
    <Modal eyebrow={`${student.student_code ?? student.username} · BIẾN ĐỘNG HỌC VIÊN`} onClose={onClose} size="large" title={student.full_name}>
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label className="field"><span>Ghi danh hiện tại</span><select onChange={(event) => setClassId(event.target.value)} required value={classId}><option value="">Chọn lớp</option>{enrollments.map((enrollment) => <option key={enrollment.class_id} value={enrollment.class_id}>{enrollment.class_code} · {enrollment.course_name}</option>)}</select></label>
          <label className="field"><span>Thao tác</span><select onChange={(event) => setAction(event.target.value as typeof action)} value={action}><option value="suspend">Bảo lưu</option><option value="transfer">Chuyển lớp</option><option value="withdraw">Thôi học</option></select></label>
          {action === 'transfer' ? <label className="field"><span>Lớp đích <b>*</b></span><select name="target_class_id" required><option value="">Chọn lớp</option>{classes.filter((item) => String(item.id) !== classId && ['preparing', 'active'].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.course_name}</option>)}</select></label> : null}
          <label className="field"><span>Ngày hiệu lực <b>*</b></span><input defaultValue={today} name="effective_date" required type="date" /></label>
          <label className="field field-span-2"><span>Lý do <b>*</b></span><textarea maxLength={2000} minLength={3} name="reason" required rows={3} /></label>
        </div>
        {problem ? <div className="form-alert error-alert">{problem}</div> : null}
        <div className="modal-actions"><button className="button button-outline" onClick={onClose} type="button">Đóng</button><button className="button button-primary" disabled={busy || !enrollments.length} type="submit">{busy ? 'Đang xử lý…' : 'Lưu biến động'}</button></div>
      </form>
      <section className="lead-activity">
        <h3>Lịch sử biến động ghi danh</h3>
        {history.map((entry) => <article className="syllabus-row" key={entry.id}><strong>{entry.action} · hiệu lực {entry.effective_date}</strong><p>{entry.reason}</p></article>)}
        {!history.length ? <p>Chưa có lịch sử biến động.</p> : null}
      </section>
    </Modal>
  )
}

export function StudentRecordsPage() {
  const [items, setItems] = useState<StudentRecord[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState<AccountPage | null>(null)
  const [selected, setSelected] = useState<StudentRecord | null>(null)
  const [enrollmentTarget, setEnrollmentTarget] = useState<StudentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [refresh, setRefresh] = useState(0)

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
  }, [page, query, refresh])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setQuery(searchInput.trim())
  }

  function saved() {
    setSelected(null)
    setLoading(true)
    setRefresh((value) => value + 1)
  }

  return (
    <section className="page-section">
      <div className="page-title-row">
        <div><span className="eyebrow">HỒ SƠ ĐÀO TẠO</span><h1>Hồ sơ học viên</h1><p>Tra cứu thông tin, chương trình và trạng thái tài khoản học viên.</p></div>
        <span className="role-pill role-student">{pageInfo?.total ?? 0} học viên</span>
      </div>
      <div className="page-toolbar">
        <form className="toolbar-search" onSubmit={submitSearch}>
          <UiIcon name="search" />
          <input aria-label="Tìm học viên" onChange={(event) => setSearchInput(event.target.value)} placeholder="Mã học viên, họ tên, email, chương trình…" value={searchInput} />
          <button className="button button-outline button-small" type="submit">Tìm</button>
        </form>
      </div>
      {problem ? <div className="form-alert error-alert">{problem}</div> : null}
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>HỌC VIÊN</th><th>MÃ SINH VIÊN</th><th>CHƯƠNG TRÌNH</th><th>LIÊN HỆ</th><th>TRẠNG THÁI</th><th /></tr></thead>
          <tbody>
            {loading ? <tr><td className="table-loading" colSpan={6}>Đang tải hồ sơ…</td></tr> : null}
            {!loading && !items.length ? <tr><td className="table-empty" colSpan={6}>Không tìm thấy học viên.</td></tr> : null}
            {!loading && items.map((student) => (
              <tr key={student.id}>
                <td><strong>{student.full_name}</strong><span className="table-secondary">{student.email}</span></td>
                <td><span className="mono-code">{student.student_code ?? student.username}</span></td>
                <td>{student.study_program ?? 'Chưa cập nhật'}</td>
                <td>{student.phone ?? '—'}</td>
                <td><span className={`status-pill ${student.is_active && !student.is_locked ? 'status-active' : 'status-inactive'}`}>{student.is_active && !student.is_locked ? 'Đang hoạt động' : 'Bị khóa'}</span></td>
                <td><div className="row-actions"><button className="button button-outline button-small" onClick={() => setSelected(student)} type="button">Hồ sơ</button><button className="text-action" onClick={() => setEnrollmentTarget(student)} type="button">Biến động</button></div></td>
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
      {selected ? <StudentEditor onClose={() => setSelected(null)} onSaved={saved} student={selected} /> : null}
      {enrollmentTarget ? <EnrollmentChangeModal onClose={() => setEnrollmentTarget(null)} onSaved={saved} student={enrollmentTarget} /> : null}
    </section>
  )
}
