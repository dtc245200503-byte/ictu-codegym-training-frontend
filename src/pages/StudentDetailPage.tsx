import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { UiIcon } from '../components/Ui'
import { ListPagination } from '../components/ListControls'
import { showError } from '../format'
import type { User } from '../types'

type StudentEnrollment = {
  id: number
  class_id: number
  class_code: string
  class_name: string
  course_id: number
  course_code: string
  course_name: string
  teacher_name: string
  room: string
  term: string
  enrollment_status: string
  tuition_status: string
  attendance_status: string
  enrolled_at: string | null
  effective_date: string | null
}

type EnrollmentHistory = {
  id: number
  action: string
  reason: string
  effective_date: string
  class_id: number
  class_name: string
  target_class_id: number | null
  target_class_name: string | null
  created_at: string | null
}

type AttendanceStat = {
  total_sessions: number
  present_count: number
  late_count: number
  excused_count: number
  unexcused_count: number
  attendance_rate: number
}

type StudentAttendanceRecord = {
  id: number
  session_id: number
  session_date: string
  start_time: string
  end_time: string
  class_code: string
  class_name: string
  lesson_title: string | null
  status: string
  marked_at: string | null
}

type StudentFullProfile = {
  id: number
  username: string
  email: string
  full_name: string
  student_code: string | null
  phone: string | null
  birth_date: string | null
  address: string | null
  is_active: boolean
  is_locked: boolean
  study_program: string | null
  lead_id: number | null
  profile_created_at: string | null
  created_at: string
  enrollments: StudentEnrollment[]
  enrollment_history: EnrollmentHistory[]
  attendance_stats: AttendanceStat
  attendance_records: StudentAttendanceRecord[]
}

export function StudentDetailPage({
  studentId,
  user,
  notify: _notify,
}: {
  studentId: number
  user?: User
  notify?: (msg: string) => void
}) {
  const [profile, setProfile] = useState<StudentFullProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [activeTab, setActiveTab] = useState<'classes' | 'history' | 'attendance' | 'timeline'>('classes')
  const [enrollmentPage, setEnrollmentPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [attendancePage, setAttendancePage] = useState(1)

  useEffect(() => {
    let active = true

    apiRequest<StudentFullProfile>(`/students/${studentId}`)
      .then((res) => {
        if (active) setProfile(res)
      })
      .catch((err: unknown) => {
        if (active) setProblem(showError(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [studentId])

  const canManageStudents = user?.roles ? user.roles.some((r: string) => ['admin', 'manager', 'admissions'].includes(r)) : true
  const listPageSize = 10
  const enrollments = profile?.enrollments ?? []
  const enrollmentHistory = profile?.enrollment_history ?? []
  const attendanceRecords = profile?.attendance_records ?? []
  const pagedEnrollments = enrollments.slice((enrollmentPage - 1) * listPageSize, enrollmentPage * listPageSize)
  const pagedHistory = enrollmentHistory.slice((historyPage - 1) * listPageSize, historyPage * listPageSize)
  const pagedAttendance = attendanceRecords.slice((attendancePage - 1) * listPageSize, attendancePage * listPageSize)

  if (loading) {
    return (
      <section className="page-section">
        <div className="table-loading">Đang tải hồ sơ chi tiết học viên…</div>
      </section>
    )
  }

  if (!profile || problem) {
    return (
      <section className="page-section">
        <div className="form-alert error-alert" style={{ marginBottom: '20px' }}>
          <strong>Lỗi:</strong> {problem || 'Không tìm thấy hồ sơ học viên này.'}
        </div>
        <a className="button button-outline" href="/students">
          ← Quay lại danh sách học viên
        </a>
      </section>
    )
  }

  const activeEnrollments = profile.enrollments.filter((e) => e.enrollment_status === 'active')

  return (
    <section className="page-section student-detail-page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <a href="/students" style={{ color: 'inherit', textDecoration: 'none' }}>Danh sách học viên</a>
        <span className="breadcrumb-divider">/</span>
        <strong>{profile.student_code || profile.username} · {profile.full_name}</strong>
      </div>

      {/* Hero Profile Header */}
      <div
        className="panel"
        style={{
          padding: '24px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#0054a6',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 700,
            }}
          >
            {profile.full_name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                {profile.full_name}
              </h1>
              <span
                className="mono-code"
                style={{
                  backgroundColor: '#f1f5f9',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Mã SV: {profile.student_code || profile.username}
              </span>
              <span
                style={{
                  backgroundColor: profile.is_active && !profile.is_locked ? '#dcfce7' : '#fee2e2',
                  color: profile.is_active && !profile.is_locked ? '#15803d' : '#b91c1c',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '16px',
                }}
              >
                {profile.is_active && !profile.is_locked ? 'Đang theo học' : 'Bị khóa'}
              </span>
            </div>

            <div style={{ marginTop: '8px', color: '#64748b', fontSize: '14px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <span>
                <strong>Chương trình:</strong> {profile.study_program || 'Chưa phân ngành'}
              </span>
              <span>
                <strong>Email:</strong> {profile.email}
              </span>
              <span>
                <strong>SĐT:</strong> {profile.phone || '—'}
              </span>
              <span>
                <strong>Ngày sinh:</strong> {profile.birth_date || '—'}
              </span>
              <span>
                <strong>Địa chỉ:</strong> {profile.address || '—'}
              </span>
            </div>
          </div>
        </div>

        {canManageStudents ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <a className="button button-outline" href={`/students/${profile.id}/edit`}>
              <UiIcon name="edit" size={15} /> Chỉnh sửa hồ sơ
            </a>
            <a className="button button-primary" href={`/students/${profile.id}/enrollment`}>
              <UiIcon name="plus" size={15} /> Biến động ghi danh
            </a>
          </div>
        ) : null}
      </div>

      {/* KPI Overview Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="panel" style={{ padding: '18px', borderLeft: '4px solid var(--blue, #0054a6)' }}>
          <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            Lớp học phần đang học
          </span>
          <strong style={{ fontSize: '26px', color: '#0f172a' }}>
            {activeEnrollments.length} lớp
          </strong>
          <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>
            {profile.enrollments.length} tổng lớp đã ghi danh
          </span>
        </div>

        <div className="panel" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            Tỷ lệ chuyên cần
          </span>
          <strong style={{ fontSize: '26px', color: '#10b981' }}>
            {profile.attendance_stats.attendance_rate}%
          </strong>
          <span style={{ fontSize: '12px', color: '#16a34a', display: 'block', marginTop: '4px' }}>
            {profile.attendance_stats.present_count} có mặt / {profile.attendance_stats.total_sessions} buổi
          </span>
        </div>

        <div className="panel" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            Vắng / Đi muộn
          </span>
          <strong style={{ fontSize: '26px', color: '#0f172a' }}>
            {profile.attendance_stats.late_count + profile.attendance_stats.excused_count + profile.attendance_stats.unexcused_count} buổi
          </strong>
          <span style={{ fontSize: '12px', color: '#d97706', display: 'block', marginTop: '4px' }}>
            Muộn: {profile.attendance_stats.late_count} · Nghỉ có phép: {profile.attendance_stats.excused_count} · Không phép: {profile.attendance_stats.unexcused_count}
          </span>
        </div>

        <div className="panel" style={{ padding: '18px', borderLeft: '4px solid #8b5cf6' }}>
          <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            Biến động ghi danh
          </span>
          <strong style={{ fontSize: '26px', color: '#0f172a' }}>
            {profile.enrollment_history.length} lần
          </strong>
          <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>
            Chuyển lớp, bảo lưu, tạm dừng…
          </span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '20px',
        }}
      >
        <button
          onClick={() => setActiveTab('classes')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'classes' ? '2px solid #0054a6' : '2px solid transparent',
            color: activeTab === 'classes' ? '#0054a6' : '#64748b',
            fontWeight: activeTab === 'classes' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '14px',
          }}
          type="button"
        >
          📚 Các lớp học phần ({profile.enrollments.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'history' ? '2px solid #0054a6' : '2px solid transparent',
            color: activeTab === 'history' ? '#0054a6' : '#64748b',
            fontWeight: activeTab === 'history' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '14px',
          }}
          type="button"
        >
          🔄 Lịch sử biến động ghi danh ({profile.enrollment_history.length})
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'attendance' ? '2px solid #0054a6' : '2px solid transparent',
            color: activeTab === 'attendance' ? '#0054a6' : '#64748b',
            fontWeight: activeTab === 'attendance' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '14px',
          }}
          type="button"
        >
          📋 Lịch sử điểm danh ({profile.attendance_records.length})
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'timeline' ? '2px solid #0054a6' : '2px solid transparent',
            color: activeTab === 'timeline' ? '#0054a6' : '#64748b',
            fontWeight: activeTab === 'timeline' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '14px',
          }}
          type="button"
        >
          ⏳ Mốc thời gian & Hồ sơ
        </button>
      </div>

      {/* Tab 1: Enrolled Classes */}
      {activeTab === 'classes' ? (
        <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Danh sách các lớp học phần đã và đang theo học
            </h3>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>MÃ LỚP</th>
                  <th>TÊN LỚP & HỌC KỲ</th>
                  <th>MÔN HỌC</th>
                  <th>GIẢNG VIÊN & PHÒNG</th>
                  <th>TRẠNG THÁI GHI DANH</th>
                  <th>HỌC PHÍ</th>
                  <th>NGÀY VÀO LỚP</th>
                  <th aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {profile.enrollments.length === 0 ? (
                  <tr>
                    <td className="table-empty" colSpan={8}>
                      Học viên chưa được xếp vào lớp học phần nào.
                    </td>
                  </tr>
                ) : (
                  pagedEnrollments.map((enr) => (
                    <tr key={enr.id}>
                      <td>
                        <strong className="mono-code text-primary">{enr.class_code}</strong>
                      </td>
                      <td>
                        <strong>{enr.class_name}</strong>
                        <span className="table-secondary">{enr.term}</span>
                      </td>
                      <td>
                        <span>{enr.course_name}</span>
                        <span className="table-secondary">{enr.course_code}</span>
                      </td>
                      <td>
                        <div>{enr.teacher_name}</div>
                        <span className="table-secondary">Phòng: {enr.room}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            backgroundColor: enr.enrollment_status === 'active' ? '#dcfce7' : '#f1f5f9',
                            color: enr.enrollment_status === 'active' ? '#15803d' : '#64748b',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {{ active: 'Đang học', reserved: 'Bảo lưu', suspended: 'Tạm dừng', dropped: 'Thôi học', completed: 'Đã hoàn thành' }[enr.enrollment_status] ?? enr.enrollment_status}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            backgroundColor: enr.tuition_status === 'paid' ? '#dcfce7' : '#fee2e2',
                            color: enr.tuition_status === 'paid' ? '#15803d' : '#b91c1c',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {{ paid: 'Đã nộp đủ', partial: 'Nộp một phần', unpaid: 'Chưa nộp', waived: 'Miễn giảm' }[enr.tuition_status] ?? enr.tuition_status}
                        </span>
                      </td>
                      <td>
                        {enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td>
                        <a
                          className="button button-outline button-small"
                          href={`/classes/${enr.class_id}/students`}
                        >
                          Xem lớp
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
            <ListPagination page={enrollmentPage} pageSize={listPageSize} total={enrollments.length} onPageChange={setEnrollmentPage} />
        </div>
      ) : null}

      {/* Tab 2: Enrollment History */}
      {activeTab === 'history' ? (
        <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Lịch sử chuyển lớp, bảo lưu, tạm dừng hoặc thôi học
            </h3>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Toàn bộ các biến động học vụ được ghi nhận và lưu trữ vĩnh viễn trong hệ thống phục vụ đối soát và cấp bảng điểm.
            </span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>MÃ GD</th>
                  <th>LOẠI BIẾN ĐỘNG</th>
                  <th>LỚP GỐC</th>
                  <th>LỚP CHUYỂN TỚI</th>
                  <th>LÝ DO GHI NHẬN</th>
                  <th>NGÀY HIỆU LỰC</th>
                  <th>THỜI GIAN TẠO</th>
                </tr>
              </thead>
              <tbody>
                {profile.enrollment_history.length === 0 ? (
                  <tr>
                    <td className="table-empty" colSpan={7}>
                      Chưa có biến động ghi danh nào (học viên chưa chuyển lớp, bảo lưu hoặc tạm dừng).
                    </td>
                  </tr>
                ) : (
                  pagedHistory.map((h) => (
                    <tr key={h.id}>
                      <td><span className="mono-code">#{h.id}</span></td>
                      <td>
                        <span
                          style={{
                            backgroundColor: h.action === 'transfer' ? '#e0f2fe' : (h.action === 'reserve' ? '#fef3c7' : '#fee2e2'),
                            color: h.action === 'transfer' ? '#0369a1' : (h.action === 'reserve' ? '#b45309' : '#b91c1c'),
                            fontWeight: 600,
                            fontSize: '12px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {{ transfer: 'Chuyển lớp', reserve: 'Bảo lưu', suspend: 'Tạm dừng', drop: 'Thôi học' }[h.action] ?? h.action}
                        </span>
                      </td>
                      <td><strong>{h.class_name}</strong></td>
                      <td>
                        {h.target_class_name ? <strong>{h.target_class_name}</strong> : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td>{h.reason}</td>
                      <td><strong>{h.effective_date}</strong></td>
                      <td>
                        {h.created_at ? new Date(h.created_at).toLocaleString('vi-VN') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
            <ListPagination page={historyPage} pageSize={listPageSize} total={enrollmentHistory.length} onPageChange={setHistoryPage} />
        </div>
      ) : null}

      {/* Tab 3: Attendance Records */}
      {activeTab === 'attendance' ? (
        <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                Nhật ký điểm danh từng buổi học
              </h3>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Tổng cộng {profile.attendance_records.length} buổi học đã được ghi nhận điểm danh.
              </span>
            </div>
            <span
              style={{
                backgroundColor: '#dcfce7',
                color: '#15803d',
                fontWeight: 600,
                fontSize: '13px',
                padding: '4px 12px',
                borderRadius: '16px',
              }}
            >
              Chuyên cần: {profile.attendance_stats.attendance_rate}%
            </span>
          </div>
          <div className="table-scroll" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>NGÀY HỌC</th>
                  <th>GIỜ HỌC</th>
                  <th>LỚP HỌC</th>
                  <th>NỘI DUNG BUỔI HỌC</th>
                  <th>TRẠNG THÁI</th>
                  <th>THỜI ĐIỂM GHI NHẬN</th>
                </tr>
              </thead>
              <tbody>
                {profile.attendance_records.length === 0 ? (
                  <tr>
                    <td className="table-empty" colSpan={6}>
                      Chưa có dữ liệu điểm danh nào cho học viên này.
                    </td>
                  </tr>
                ) : (
                  pagedAttendance.map((rec) => (
                    <tr key={rec.id}>
                      <td><strong>{rec.session_date}</strong></td>
                      <td><span className="mono-code">{rec.start_time} – {rec.end_time}</span></td>
                      <td>
                        <strong>{rec.class_code}</strong>
                        <span className="table-secondary">{rec.class_name}</span>
                      </td>
                      <td>{rec.lesson_title || 'Nội dung theo tiến độ'}</td>
                      <td>
                        <span
                          style={{
                            backgroundColor:
                              rec.status === 'present'
                                ? '#dcfce7'
                                : rec.status === 'late'
                                  ? '#fef3c7'
                                  : rec.status === 'excused_absent'
                                    ? '#e0f2fe'
                                    : '#fee2e2',
                            color:
                              rec.status === 'present'
                                ? '#15803d'
                                : rec.status === 'late'
                                  ? '#b45309'
                                  : rec.status === 'excused_absent'
                                    ? '#0369a1'
                                    : '#b91c1c',
                            fontWeight: 600,
                            fontSize: '12px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {{
                            present: 'Có mặt',
                            late: 'Đi muộn',
                            excused_absent: 'Vắng có phép',
                            unexcused_absent: 'Vắng không phép',
                          }[rec.status] ?? rec.status}
                        </span>
                      </td>
                      <td>
                        {rec.marked_at ? new Date(rec.marked_at).toLocaleString('vi-VN') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
            <ListPagination page={attendancePage} pageSize={listPageSize} total={attendanceRecords.length} onPageChange={setAttendancePage} />
        </div>
      ) : null}

      {/* Tab 4: Timeline & Origin */}
      {activeTab === 'timeline' ? (
        <div className="panel" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
            Mốc thời gian và nguồn gốc hồ sơ
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px' }}>🗓️</span>
              <div>
                <strong>Ngày tạo tài khoản hệ thống:</strong>
                <div style={{ color: '#64748b', fontSize: '14px' }}>
                  {profile.created_at ? new Date(profile.created_at).toLocaleString('vi-VN') : 'Chưa rõ'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px' }}>🎓</span>
              <div>
                <strong>Hồ sơ học viên chính thức:</strong>
                <div style={{ color: '#64748b', fontSize: '14px' }}>
                  {profile.profile_created_at ? new Date(profile.profile_created_at).toLocaleString('vi-VN') : 'Được tạo đồng bộ cùng tài khoản'}
                </div>
              </div>
            </div>

            {profile.lead_id ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px' }}>🎯</span>
                <div>
                  <strong>Chuyển đổi từ hồ sơ tư vấn tuyển sinh:</strong>
                  <div style={{ color: '#64748b', fontSize: '14px' }}>
                    Mã Lead tuyển sinh: <strong>#{profile.lead_id}</strong>
                  </div>
                  <a
                    className="button button-outline button-small"
                    href={`/leads/${profile.lead_id}`}
                    style={{ marginTop: '6px' }}
                  >
                    Xem lịch sử tư vấn Lead #{profile.lead_id} →
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
