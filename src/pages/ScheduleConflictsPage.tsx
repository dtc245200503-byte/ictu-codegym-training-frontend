import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'
import { UiIcon } from '../components/Ui'
import { ListPagination } from '../components/ListControls'
import { showError } from '../format'
import type { User } from '../types'

type SessionInfo = {
  id: number
  class_id: number
  class_code: string
  class_name: string
  course_code: string
  course_name: string
  session_date: string
  weekday: string
  start_time: string
  end_time: string
  teacher_id: number
  teacher_name: string
  room: string
  lesson_title: string | null
  conflict_override: boolean
}

type ConflictItem = {
  id: string
  date: string
  weekday: string
  conflict_type: 'teacher' | 'room' | 'both'
  teacher_conflict: boolean
  room_conflict: boolean
  conflict_entity: string
  status: 'unresolved' | 'overridden'
  severity: 'high' | 'medium'
  overlap_time: string
  session_1: SessionInfo
  session_2: SessionInfo
}

type ConflictReport = {
  start_date: string
  end_date: string
  total_conflicts: number
  unresolved_count: number
  overridden_count: number
  teacher_conflicts: number
  room_conflicts: number
  conflicts: ConflictItem[]
}

export function ScheduleConflictsPage({
  user: _user,
  notify,
}: {
  user?: User
  notify?: (msg: string) => void
}) {
  const [data, setData] = useState<ConflictReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')

  // Filter states
  const [typeFilter, setTypeFilter] = useState<'all' | 'teacher' | 'room' | 'both'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'overridden'>('all')
  const [searchEntity, setSearchEntity] = useState('')
  const [page, setPage] = useState(1)

  // Scan range
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 90)
    return d.toISOString().slice(0, 10)
  })

  function handleRefresh() {
    setLoading(true)
    setProblem('')
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)

    apiRequest<ConflictReport>(`/schedule/conflicts?${params.toString()}`)
      .then((res) => {
        setData(res)
        notify?.('Đã cập nhật dữ liệu quét xung đột lịch.')
      })
      .catch((err: unknown) => {
        setProblem(showError(err))
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    let active = true
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)

    apiRequest<ConflictReport>(`/schedule/conflicts?${params.toString()}`)
      .then((res) => {
        if (!active) return
        setData(res)
      })
      .catch((err: unknown) => {
        if (!active) return
        setProblem(showError(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [startDate, endDate])

  // Filtered conflicts list
  const filteredConflicts = useMemo(() => {
    if (!data) return []
    return data.conflicts.filter((item) => {
      if (typeFilter !== 'all' && item.conflict_type !== typeFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (searchEntity.trim()) {
        const q = searchEntity.trim().toLowerCase()
        const matchesEntity = item.conflict_entity.toLowerCase().includes(q)
        const matchesClass1 = item.session_1.class_code.toLowerCase().includes(q) || item.session_1.class_name.toLowerCase().includes(q)
        const matchesClass2 = item.session_2.class_code.toLowerCase().includes(q) || item.session_2.class_name.toLowerCase().includes(q)
        if (!matchesEntity && !matchesClass1 && !matchesClass2) return false
      }
      return true
    })
  }, [data, typeFilter, statusFilter, searchEntity])
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(filteredConflicts.length / pageSize))
  const visibleConflicts = filteredConflicts.slice((page - 1) * pageSize, page * pageSize)

  return (
    <section className="page-section schedule-conflicts-page">
      <div className="breadcrumb">
        <a href="/schedule" style={{ color: 'inherit', textDecoration: 'none' }}>Thời khóa biểu</a>
        <span className="breadcrumb-divider">/</span>
        <strong>Cảnh báo xung đột lịch</strong>
      </div>

      <div className="page-title-row" style={{ marginBottom: '16px' }}>
        <div>
          <span className="eyebrow">QUẢN TRỊ ĐÀO TẠO & KIỂM TRA LỊCH</span>
          <h1>Cảnh báo xung đột lịch</h1>
          <p>
            Phát hiện các ca trùng giờ của giảng viên hoặc phòng học để kịp thời điều chỉnh phân công đào tạo.
          </p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="button button-outline"
            disabled={loading}
            onClick={handleRefresh}
            type="button"
          >
            <UiIcon name="refresh" size={15} /> Quét lại xung đột
          </button>
          <a className="button button-primary" href="/schedule/generate">
            <UiIcon name="calendar" size={15} /> Sinh lịch tự động
          </a>
        </div>
      </div>

      {problem ? (
        <div className="form-alert error-alert" style={{ marginBottom: '16px' }}>
          <strong>Lỗi:</strong> {problem}
        </div>
      ) : null}

      {/* 1-row KPI Overview Metrics Strip */}
      <div className="class-kpi-bar">
        <div className="class-kpi-item">
          <span>Tổng số xung đột</span>
          <strong style={{ color: data?.total_conflicts ? '#dc2626' : '#0f172a' }}>{data?.total_conflicts ?? 0}</strong>
        </div>
        <div className="class-kpi-item">
          <span>Trùng giảng viên</span>
          <strong style={{ color: '#ea580c' }}>{data?.teacher_conflicts ?? 0}</strong>
        </div>
        <div className="class-kpi-item">
          <span>Trùng phòng học</span>
          <strong style={{ color: '#ca8a04' }}>{data?.room_conflicts ?? 0}</strong>
        </div>
        <div className="class-kpi-item">
          <span>Chưa xử lý</span>
          <strong style={{ color: '#dc2626' }}>{data?.unresolved_count ?? 0}</strong>
        </div>
        <div className="class-kpi-item">
          <span>Đã phê duyệt ghi đè</span>
          <strong style={{ color: '#16a34a' }}>{data?.overridden_count ?? 0}</strong>
        </div>
      </div>

      {/* Business Policy Callout */}
      <div
        className="panel"
        style={{
          padding: '16px 20px',
          marginBottom: '24px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '20px' }}>ℹ️</span>
          <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
            <strong>Quy tắc nghiệp vụ kiểm tra xung đột:</strong>
            <br />
            1. So sánh khoảng thời gian thực tế: Hai buổi học chỉ bị coi là xung đột khi có khoảng giao nhau thực tế (ví dụ: 09:00–11:00 và 10:00–12:00 là trùng; 09:00–10:00 và 10:00–11:00 tiếp giáp nhau không bị coi là trùng).
            <br />
            2. Mặc định hệ thống chặn lưu lịch xung đột khi sinh lịch hoặc tạo buổi học mới.
            <br />
            3. Nhấn <strong>“Chỉnh sửa buổi học”</strong> để thay đổi giờ, dời ngày, đổi phòng hoặc phân công giảng viên dạy thay để giải quyết xung đột.
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="panel"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'flex-end',
        }}
      >
        <label className="field" style={{ margin: 0, minWidth: '150px' }}>
          <span style={{ fontSize: '12px' }}>Từ ngày</span>
          <input
            onChange={(e) => setStartDate(e.target.value)}
            type="date"
            value={startDate}
          />
        </label>

        <label className="field" style={{ margin: 0, minWidth: '150px' }}>
          <span style={{ fontSize: '12px' }}>Đến ngày</span>
          <input
            onChange={(e) => setEndDate(e.target.value)}
            type="date"
            value={endDate}
          />
        </label>

        <label className="field" style={{ margin: 0, minWidth: '160px' }}>
          <span style={{ fontSize: '12px' }}>Loại xung đột</span>
          <select
            onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1) }}
            value={typeFilter}
          >
            <option value="all">Tất cả loại xung đột</option>
            <option value="teacher">Trùng giảng viên</option>
            <option value="room">Trùng phòng học</option>
            <option value="both">Trùng cả GV & Phòng</option>
          </select>
        </label>

        <label className="field" style={{ margin: 0, minWidth: '160px' }}>
          <span style={{ fontSize: '12px' }}>Trạng thái xử lý</span>
          <select
            onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1) }}
            value={statusFilter}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="unresolved">Chưa xử lý (Cần can thiệp)</option>
            <option value="overridden">Đã ghi đè / Phê duyệt</option>
          </select>
        </label>

        <label className="field" style={{ margin: 0, minWidth: '200px', flex: 1 }}>
          <span style={{ fontSize: '12px' }}>Tìm theo GV, Phòng, Mã lớp</span>
          <input
            onChange={(e) => { setSearchEntity(e.target.value); setPage(1) }}
            placeholder="Tên giảng viên, số phòng, mã lớp…"
            value={searchEntity}
          />
        </label>

        <button
          className="button button-primary button-small"
          onClick={handleRefresh}
          type="button"
        >
          Áp dụng lọc
        </button>
      </div>

      {/* Conflict List */}
      <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div className="table-loading" style={{ padding: '40px' }}>
            Đang quét dữ liệu xung đột thời khóa biểu…
          </div>
        ) : filteredConflicts.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✨</div>
            <strong style={{ fontSize: '18px', color: '#0f172a' }}>
              Không phát hiện xung đột lịch nào
            </strong>
            <p style={{ color: '#64748b', maxWidth: '460px', margin: '8px auto 0' }}>
              Thời khóa biểu của tất cả các lớp, giảng viên và phòng học trong khoảng thời gian đã chọn đều hoàn toàn tách biệt và hợp lệ.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {visibleConflicts.map((c, idx) => (
              <div
                key={c.id}
                style={{
                  padding: '20px',
                  borderBottom: idx < filteredConflicts.length - 1 ? '1px solid #e2e8f0' : 'none',
                  backgroundColor: c.status === 'unresolved' ? '#fffaf8' : '#ffffff',
                }}
              >
                {/* Conflict Card Top Bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        backgroundColor: c.conflict_type === 'teacher' ? '#ffedd5' : (c.conflict_type === 'room' ? '#fef9c3' : '#fee2e2'),
                        color: c.conflict_type === 'teacher' ? '#c2410c' : (c.conflict_type === 'room' ? '#854d0e' : '#b91c1c'),
                        fontWeight: 700,
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.conflict_type === 'teacher'
                        ? 'Trùng giảng viên'
                        : c.conflict_type === 'room'
                          ? 'Trùng phòng học'
                          : 'Trùng cả GV & Phòng'}
                    </span>
                    <strong style={{ fontSize: '16px', color: '#0f172a' }}>
                      {c.conflict_entity}
                    </strong>
                    <span style={{ color: '#64748b', fontSize: '14px' }}>
                      · {c.weekday}, ngày <strong>{c.date}</strong>
                    </span>
                    <span
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Khoảng trùng: {c.overlap_time}
                    </span>
                  </div>

                  <div>
                    {c.status === 'unresolved' ? (
                      <span
                        style={{
                          backgroundColor: '#fee2e2',
                          color: '#b91c1c',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ Chưa xử lý (Chặn lưu)
                      </span>
                    ) : (
                      <span
                        style={{
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        ✓ Đã được phê duyệt ghi đè
                      </span>
                    )}
                  </div>
                </div>

                {/* Overlapping Sessions Comparison */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px',
                    marginBottom: '12px',
                  }}
                >
                  {/* Session 1 */}
                  <div
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '14px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ color: 'var(--blue, #0054a6)' }}>Buổi học A: {c.session_1.class_code}</strong>
                      <span className="mono-code" style={{ fontSize: '12px', fontWeight: 600 }}>
                        {c.session_1.start_time} – {c.session_1.end_time}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      <strong>Lớp:</strong> {c.session_1.class_name} ({c.session_1.course_name})
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', gap: '16px' }}>
                      <span><strong>GV:</strong> {c.session_1.teacher_name}</span>
                      <span><strong>Phòng:</strong> {c.session_1.room}</span>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <a
                        className="button button-outline button-small"
                        href={`/schedule/sessions/${c.session_1.id}`}
                      >
                        Chỉnh sửa buổi này →
                      </a>
                    </div>
                  </div>

                  {/* Session 2 */}
                  <div
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '14px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ color: 'var(--blue, #0054a6)' }}>Buổi học B: {c.session_2.class_code}</strong>
                      <span className="mono-code" style={{ fontSize: '12px', fontWeight: 600 }}>
                        {c.session_2.start_time} – {c.session_2.end_time}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      <strong>Lớp:</strong> {c.session_2.class_name} ({c.session_2.course_name})
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', gap: '16px' }}>
                      <span><strong>GV:</strong> {c.session_2.teacher_name}</span>
                      <span><strong>Phòng:</strong> {c.session_2.room}</span>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <a
                        className="button button-outline button-small"
                        href={`/schedule/sessions/${c.session_2.id}`}
                      >
                        Chỉnh sửa buổi này →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {filteredConflicts.length > pageSize ? <ListPagination page={page} pageSize={pageSize} total={filteredConflicts.length} onPageChange={(nextPage) => setPage(Math.min(pageCount, nextPage))} /> : null}
    </section>
  )
}
