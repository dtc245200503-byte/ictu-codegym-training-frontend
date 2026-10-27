import { useEffect, useMemo, useState } from 'react'
import { apiBlobRequest, apiRequest } from '../api'
import { hoChiMinhDate } from '../attendanceExportDate'
import { showError } from '../format'
import type {
  AttendanceMatrixCell,
  AttendanceMatrixResponse,
  AttendanceMatrixStatus,
  AttendanceMatrixStudent,
} from '../types'
import './AttendanceMatrixPage.css'

type AttendanceFilter = 'all' | AttendanceMatrixStatus | 'not_recorded'

const statusLabels: Record<AttendanceMatrixStatus, string> = {
  present: 'Có mặt',
  late: 'Đi muộn',
  excused_absent: 'Vắng có phép',
  unexcused_absent: 'Vắng không phép',
  absent: 'Vắng — trạng thái cũ',
}

const statusClasses: Record<AttendanceMatrixStatus, string> = {
  present: 'attendance-matrix-status-present',
  late: 'attendance-matrix-status-late',
  excused_absent: 'attendance-matrix-status-excused',
  unexcused_absent: 'attendance-matrix-status-unexcused',
  absent: 'attendance-matrix-status-legacy',
}

const attendanceStatuses = new Set<AttendanceMatrixStatus>([
  'present',
  'late',
  'excused_absent',
  'unexcused_absent',
  'absent',
])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isAttendanceCell(value: unknown): value is AttendanceMatrixCell {
  return (
    isObject(value) &&
    typeof value.eligible === 'boolean' &&
    (value.status === null ||
      (typeof value.status === 'string' && attendanceStatuses.has(value.status as AttendanceMatrixStatus)))
  )
}

function isAttendanceMatrixResponse(value: unknown): value is AttendanceMatrixResponse {
  if (!isObject(value) || !isObject(value.class)) return false
  if (
    typeof value.class.id !== 'number' ||
    typeof value.class.code !== 'string' ||
    typeof value.class.name !== 'string' ||
    !Array.isArray(value.sessions) ||
    !Array.isArray(value.students)
  ) {
    return false
  }

  const sessionIds = new Set<string>()
  for (const session of value.sessions) {
    if (
      !isObject(session) ||
      typeof session.id !== 'number' ||
      typeof session.session_date !== 'string' ||
      typeof session.start_time !== 'string' ||
      typeof session.end_time !== 'string'
    ) {
      return false
    }
    sessionIds.add(String(session.id))
  }

  for (const student of value.students) {
    if (
      !isObject(student) ||
      typeof student.id !== 'number' ||
      (student.student_code !== null && typeof student.student_code !== 'string') ||
      typeof student.full_name !== 'string' ||
      !isObject(student.attendance_by_session)
    ) {
      return false
    }

    const counters = [
      'total_sessions',
      'attended_count',
      'present_count',
      'late_count',
      'excused_absent_count',
      'unexcused_absent_count',
      'legacy_absent_count',
      'unrecorded_count',
      'absent_count',
    ]
    if (!counters.every((key) => isNonNegativeInteger(student[key]))) return false
    if (
      student.attendance_rate !== null &&
      (typeof student.attendance_rate !== 'number' ||
        !Number.isFinite(student.attendance_rate) ||
        student.attendance_rate < 0 ||
        student.attendance_rate > 100)
    ) {
      return false
    }

    const cells = Object.entries(student.attendance_by_session)
    if (
      cells.length !== sessionIds.size ||
      cells.some(([sessionId, cell]) => !sessionIds.has(sessionId) || !isAttendanceCell(cell))
    ) {
      return false
    }
  }

  if (value.pagination !== undefined) {
    if (
      !isObject(value.pagination) ||
      !isNonNegativeInteger(value.pagination.page) ||
      value.pagination.page < 1 ||
      !isNonNegativeInteger(value.pagination.page_size) ||
      value.pagination.page_size < 1 ||
      !isNonNegativeInteger(value.pagination.total)
    ) return false
  }
  if (value.total_students !== undefined && !isNonNegativeInteger(value.total_students)) return false
  if (value.totals !== undefined) {
    const totals = value.totals
    const totalFields = [
      'attended_count',
      'absent_count',
      'excused_absent_count',
      'unexcused_absent_count',
      'legacy_absent_count',
      'unrecorded_count',
    ]
    if (!isObject(totals) || !totalFields.every((field) => isNonNegativeInteger(totals[field]))) return false
  }

  return true
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function displayStudentCode(student: AttendanceMatrixStudent) {
  return student.student_code || `Học viên #${student.id}`
}

function AttendanceCellView({ cell }: { cell: AttendanceMatrixCell }) {
  if (!cell.eligible) {
    return <span className="attendance-matrix-cell attendance-matrix-not-applicable">Không áp dụng</span>
  }
  if (cell.status === null) {
    return <span className="attendance-matrix-cell attendance-matrix-pending">Chưa ghi nhận</span>
  }
  return (
    <span className={`attendance-matrix-cell ${statusClasses[cell.status]}`}>
      {statusLabels[cell.status]}
    </span>
  )
}

export function AttendanceMatrixPage({
  classId,
  canExport = false,
}: {
  classId: number
  canExport?: boolean
}) {
  const [reloadKey, setReloadKey] = useState(0)
  const [requestState, setRequestState] = useState<
    | { key: string; status: 'loading' }
    | { key: string; status: 'success'; data: AttendanceMatrixResponse }
    | { key: string; status: 'error'; message: string }
  >({ key: '', status: 'loading' })
  const [search, setSearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<AttendanceFilter>('all')
  const [sort, setSort] = useState<'attendance_asc' | 'attendance_desc'>('attendance_asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [exporting, setExporting] = useState(false)
  const [exportProblem, setExportProblem] = useState('')
  const params = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize), sort })
    if (searchQuery) query.set('q', searchQuery)
    if (filter !== 'all') query.set('status', filter)
    return query.toString()
  }, [filter, page, pageSize, searchQuery, sort])
  const requestKey = `${classId}:${reloadKey}:${params}`
  const loading =
    requestState.key !== requestKey ||
    requestState.status === 'loading' ||
    search.trim() !== searchQuery
  const data = !loading && requestState.status === 'success' ? requestState.data : null
  const problem = !loading && requestState.status === 'error' ? requestState.message : ''

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchQuery(search.trim())
      setPage(1)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let active = true

    apiRequest<unknown>(`/classes/${classId}/attendance/summary?${params}`)
      .then((result) => {
        if (!isAttendanceMatrixResponse(result)) {
          throw new Error('Dữ liệu ma trận điểm danh trả về không đúng định dạng.')
        }
        if (active) {
          const responsePageCount = Math.max(
            1,
            Math.ceil((result.pagination?.total ?? result.students.length) / pageSize),
          )
          if (page > responsePageCount) setPage(responsePageCount)
          setRequestState({ key: requestKey, status: 'success', data: result })
        }
      })
      .catch((error: unknown) => {
        if (active) setRequestState({ key: requestKey, status: 'error', message: showError(error) })
      })

    return () => {
      active = false
    }
  }, [classId, page, pageSize, params, requestKey])

  const visibleStudents = useMemo(() => {
    return data?.students ?? []
  }, [data])

  const resultCount = data?.pagination?.total ?? visibleStudents.length
  const pageCount = Math.max(1, Math.ceil(resultCount / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStudents = visibleStudents
  const totals = useMemo(() => {
    const students = data?.students ?? []
    if (data?.totals) {
      return {
        attended: data.totals.attended_count,
        absent: data.totals.absent_count,
        excused: data.totals.excused_absent_count,
        unexcused: data.totals.unexcused_absent_count,
        legacy: data.totals.legacy_absent_count,
        unrecorded: data.totals.unrecorded_count,
      }
    }
    return students.reduce(
      (summary, student) => ({
        attended: summary.attended + student.attended_count,
        absent: summary.absent + student.absent_count,
        excused: summary.excused + student.excused_absent_count,
        unexcused: summary.unexcused + student.unexcused_absent_count,
        legacy: summary.legacy + student.legacy_absent_count,
        unrecorded: summary.unrecorded + student.unrecorded_count,
      }),
      { attended: 0, absent: 0, excused: 0, unexcused: 0, legacy: 0, unrecorded: 0 },
    )
  }, [data])

  const resetPage = () => setPage(1)
  async function exportAttendance() {
    setExporting(true)
    setExportProblem('')
    try {
      const file = await apiBlobRequest(`/classes/${classId}/attendance/export`)
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      const vietnamDate = hoChiMinhDate(new Date())
      anchor.download = `${data?.class.code || `class-${classId}`}-attendance-${vietnamDate}.xlsx`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportProblem(showError(error))
    } finally {
      setExporting(false)
    }
  }
  const studentColumnWidth = data?.sessions.length
    ? `max(980px, ${360 + data.sessions.length * 132}px)`
    : '980px'

  return (
    <main className="page-stack attendance-matrix-page">
      <header className="attendance-matrix-heading">
        <div>
          <span className="eyebrow">ĐIỂM DANH THEO LỚP</span>
          <h1>Ma trận điểm danh</h1>
          {data ? (
            <p className="attendance-matrix-class-name">
              <strong>{data.class.code}</strong> · {data.class.name}
            </p>
          ) : null}
        </div>
        <nav aria-label="Điều hướng điểm danh" className="attendance-matrix-nav">
          {canExport ? (
            <button className="button button-outline" disabled={exporting || loading} onClick={() => void exportAttendance()} type="button">
              {exporting ? 'Đang xuất…' : 'Xuất Excel'}
            </button>
          ) : null}
          <a className="button button-outline" href={`/classes/${classId}/students`}>Về trang lớp</a>
          <a className="button button-primary" href={`/classes/${classId}/attendance`}>Điểm danh từng buổi</a>
        </nav>
      </header>

      {exportProblem ? <p className="form-alert error-alert" role="alert">Không xuất được bảng điểm danh: {exportProblem}</p> : null}

      {loading ? (
        <section aria-live="polite" className="panel attendance-matrix-loading">
          <span className="loading-spinner" /> Đang tải ma trận điểm danh…
        </section>
      ) : null}

      {!loading && problem ? (
        <section className="attendance-matrix-error" role="alert">
          <div>
            <strong>Không tải được ma trận điểm danh</strong>
            <p>{problem}</p>
          </div>
          <button className="button button-outline" onClick={() => setReloadKey((value) => value + 1)} type="button">
            Thử lại
          </button>
        </section>
      ) : null}

      {!loading && data ? (
        <>
          <section aria-label="Tổng quan chuyên cần" className="attendance-matrix-overview">
            <div className="attendance-matrix-stat"><span>Học viên</span><strong>{data.total_students ?? data.students.length}</strong></div>
            <div className="attendance-matrix-stat"><span>Buổi đủ điều kiện</span><strong>{data.sessions.length}</strong></div>
            <div className="attendance-matrix-stat"><span>Lượt có mặt</span><strong>{totals.attended.toLocaleString('vi-VN')}</strong></div>
            <div className="attendance-matrix-stat"><span>Lượt vắng</span><strong>{totals.absent.toLocaleString('vi-VN')}</strong></div>
            <div className="attendance-matrix-stat"><span>Chưa ghi nhận</span><strong>{totals.unrecorded.toLocaleString('vi-VN')}</strong></div>
          </section>
          <p className="attendance-matrix-absence-breakdown">
            Vắng có phép: <strong>{totals.excused.toLocaleString('vi-VN')}</strong> lượt
            {' · '}Vắng không phép: <strong>{totals.unexcused.toLocaleString('vi-VN')}</strong> lượt
            {' · '}Trạng thái cũ: <strong>{totals.legacy.toLocaleString('vi-VN')}</strong> lượt
          </p>

          {(data.total_students ?? data.students.length) === 0 ? (
            <section className="panel attendance-matrix-empty" role="status">
              <strong>Chưa có học viên trong ma trận</strong>
              <span>Lớp hiện không có enrollment phù hợp để hiển thị.</span>
            </section>
          ) : (
            <section className="panel attendance-matrix-panel">
              <div className="attendance-matrix-toolbar">
                <label className="attendance-matrix-search">
                  <span>Tìm học viên</span>
                  <input
                    onChange={(event) => {
                      setSearch(event.target.value)
                      resetPage()
                    }}
                    placeholder="Mã học viên hoặc họ tên"
                    type="search"
                    value={search}
                  />
                </label>
                <label className="attendance-matrix-filter">
                  <span>Lọc trạng thái</span>
                  <select
                    onChange={(event) => {
                      setFilter(event.target.value as AttendanceFilter)
                      resetPage()
                    }}
                    value={filter}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="present">Có mặt</option>
                    <option value="late">Đi muộn</option>
                    <option value="excused_absent">Vắng có phép</option>
                    <option value="unexcused_absent">Vắng không phép</option>
                    <option value="absent">Vắng — trạng thái cũ</option>
                    <option value="not_recorded">Chưa ghi nhận</option>
                  </select>
                </label>
                <label className="attendance-matrix-filter">
                  <span>Sắp xếp</span>
                  <select
                    onChange={(event) => {
                      setSort(event.target.value as typeof sort)
                      resetPage()
                    }}
                    value={sort}
                  >
                    <option value="attendance_asc">Tỷ lệ tăng dần</option>
                    <option value="attendance_desc">Tỷ lệ giảm dần</option>
                  </select>
                </label>
                <label className="attendance-matrix-page-size">
                  <span>Số hàng</span>
                  <select
                    onChange={(event) => {
                      setPageSize(Number(event.target.value))
                      resetPage()
                    }}
                    value={pageSize}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>

              {!data.sessions.length ? (
                <div className="attendance-matrix-no-sessions" role="status">
                  Lớp chưa có buổi học đủ điều kiện. Tỷ lệ chuyên cần của học viên được hiển thị là “—”.
                </div>
              ) : null}

              {!visibleStudents.length ? (
                <div className="attendance-matrix-empty" role="status">
                  <strong>Không tìm thấy học viên phù hợp</strong>
                  <span>Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc.</span>
                </div>
              ) : (
                <div className="attendance-matrix-scroll" role="region" aria-label="Bảng ma trận điểm danh" tabIndex={0}>
                  <table className="attendance-matrix-table" style={{ minWidth: studentColumnWidth }}>
                    <thead>
                      <tr>
                        <th className="attendance-matrix-student-column" scope="col">Học viên</th>
                        {data.sessions.length ? data.sessions.map((session) => (
                          <th key={session.id} scope="col">
                            <span>Buổi học</span>
                            <strong>{formatDate(session.session_date)}</strong>
                            <small>{session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}</small>
                          </th>
                        )) : <th scope="col">Buổi học</th>}
                        <th scope="col">Có mặt</th>
                        <th scope="col">Vắng có phép</th>
                        <th scope="col">Vắng không phép</th>
                        <th scope="col">Vắng trạng thái cũ</th>
                        <th scope="col">Chưa ghi nhận</th>
                        <th scope="col">Tỷ lệ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageStudents.map((student) => (
                        <tr key={student.id}>
                          <th className="attendance-matrix-student-column" scope="row">
                            <strong>{displayStudentCode(student)}</strong>
                            <span>{student.full_name}</span>
                          </th>
                          {data.sessions.length ? data.sessions.map((session) => (
                            <td key={session.id}>
                              <AttendanceCellView cell={student.attendance_by_session[String(session.id)]} />
                            </td>
                          )) : <td><span className="attendance-matrix-no-session-cell">Không có buổi</span></td>}
                          <td className="attendance-matrix-number">{student.attended_count}</td>
                          <td className="attendance-matrix-number">{student.excused_absent_count}</td>
                          <td className="attendance-matrix-number">{student.unexcused_absent_count}</td>
                          <td className="attendance-matrix-number">{student.legacy_absent_count}</td>
                          <td className="attendance-matrix-number">{student.unrecorded_count}</td>
                          <td className="attendance-matrix-rate">
                            {student.attendance_rate === null ? '—' : `${student.attendance_rate.toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="attendance-matrix-pagination">
                <span>
                  {resultCount
                    ? `Hiển thị ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, resultCount)} trong ${resultCount} học viên`
                    : '0 học viên'}
                </span>
                <div>
                  <button
                    aria-label="Trang trước"
                    className="button button-outline button-small"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    type="button"
                  >Trước</button>
                  <span>Trang {currentPage} / {pageCount}</span>
                  <button
                    aria-label="Trang sau"
                    className="button button-outline button-small"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                    type="button"
                  >Sau</button>
                </div>
              </div>
            </section>
          )}
        </>
      ) : null}
    </main>
  )
}
