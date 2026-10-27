import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { showError } from '../format'
import './StudentAttendanceHistoryPage.css'

type AttendanceHistoryItem = {
  session_id: number
  session_date: string
  start_time: string
  end_time: string
  status: 'present' | 'late' | 'excused_absent' | 'unexcused_absent' | 'absent' | null
  class_id: number
  class_code: string
  class_name: string
  course_name: string
}

type AttendanceHistoryResponse = {
  items: AttendanceHistoryItem[]
  classes: {
    class_id: number
    class_code: string
    class_name: string
    course_name: string
    present_count: number
    late_count: number
    absent_count: number
    unrecorded_count: number
    total_sessions: number
    attendance_rate: number | null
  }[]
  totals: {
    present_count: number
    late_count: number
    absent_count: number
    unrecorded_count: number
    total_sessions: number
  }
  attendance_rate: number | null
  total: number
  page: number
  page_size: number
  pages: number
}

const attendanceLabels: Record<NonNullable<AttendanceHistoryItem['status']>, string> = {
  present: 'Có mặt',
  late: 'Đi muộn',
  excused_absent: 'Vắng có phép',
  unexcused_absent: 'Vắng không phép',
  absent: 'Vắng (trạng thái lịch sử)',
}

export function StudentAttendanceHistoryPage() {
  const [page, setPage] = useState(1)
  const [classFilter, setClassFilter] = useState<number | null>(() => {
    const value = Number(new URLSearchParams(window.location.search).get('class_id'))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  })
  const [data, setData] = useState<AttendanceHistoryResponse | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const [requestError, setRequestError] = useState<{ key: string; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = `${page}:${classFilter}:${reloadKey}`
  const loading = loadedKey !== requestKey
  const problem = requestError?.key === requestKey ? requestError.message : ''

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ page: String(page), page_size: '20' })
    if (classFilter !== null) params.set('class_id', String(classFilter))
    apiRequest<AttendanceHistoryResponse>(`/students/me/attendance-history?${params.toString()}`)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((error: unknown) => {
        if (active) setRequestError({ key: requestKey, message: showError(error) })
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey)
      })
    return () => {
      active = false
    }
  }, [classFilter, page, reloadKey, requestKey])

  const pages = data?.pages ?? 0

  return (
    <section className="student-attendance-page" aria-labelledby="student-attendance-title">
      <header className="page-header">
        <div>
          <span className="eyebrow">HỌC TẬP</span>
          <h1 id="student-attendance-title">Lịch sử điểm danh</h1>
          <p>Xem trạng thái điểm danh của bạn theo từng buổi học.</p>
        </div>
      </header>

      {classFilter !== null ? (
        <div className="inline-notice" role="status">
          Đang xem lịch sử điểm danh của lớp được liên kết từ thông báo.
          <button
            className="text-button"
            onClick={() => {
              setClassFilter(null)
              setPage(1)
              window.history.replaceState({}, '', '/my/attendance')
            }}
            type="button"
          >Xóa lọc lớp</button>
        </div>
      ) : null}

      {data ? (
        <div className="student-attendance-summary" aria-label="Tổng hợp chuyên cần">
          <article><span>Tỷ lệ chuyên cần</span><strong>{data.attendance_rate == null ? '—' : `${data.attendance_rate}%`}</strong></article>
          <article><span>Buổi có mặt</span><strong>{data.totals.present_count + data.totals.late_count}</strong></article>
          <article><span>Buổi vắng</span><strong>{data.totals.absent_count}</strong></article>
          <article><span>Chưa ghi nhận</span><strong>{data.totals.unrecorded_count}</strong></article>
        </div>
      ) : null}

      {problem ? (
        <div className="alert alert-error" role="alert">
          <span>{problem}</span>
          <button className="button button-outline" onClick={() => setReloadKey((value) => value + 1)} type="button">Thử lại</button>
        </div>
      ) : null}

      {loading ? <div className="card loading-state" role="status">Đang tải lịch sử điểm danh…</div> : null}

      {!loading && !problem && data && data.total === 0 ? (
        <div className="card empty-state" role="status">
          <strong>Chưa có buổi điểm danh</strong>
          <span>Các buổi đã diễn ra sẽ xuất hiện tại đây.</span>
        </div>
      ) : null}

      {!loading && !problem && data && data.total > 0 ? (
        <>
          <div className="student-attendance-table-wrap">
            <table className="data-table student-attendance-table">
              <thead>
                <tr><th scope="col">Ngày</th><th scope="col">Lớp / môn học</th><th scope="col">Thời gian</th><th scope="col">Trạng thái</th></tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.session_id}>
                    <td>{new Date(`${item.session_date}T00:00:00`).toLocaleDateString('vi-VN')}</td>
                    <td><strong>{item.class_code} · {item.class_name}</strong><span className="student-attendance-course">{item.course_name}</span></td>
                    <td>{item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}</td>
                    <td><span className={`student-attendance-status ${item.status ? `status-${item.status}` : 'status-unrecorded'}`}>{item.status ? attendanceLabels[item.status] : 'Chưa ghi nhận'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="pagination student-attendance-pagination" aria-label="Phân trang lịch sử điểm danh">
            <span>{data.total} buổi · Trang {page} / {Math.max(1, pages)}</span>
            <div>
              <button className="button button-outline" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">Trước</button>
              <button className="button button-outline" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)} type="button">Sau</button>
            </div>
          </nav>
        </>
      ) : null}
    </section>
  )
}
