import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { auditDateRange } from '../auditDateRange'
import { apiRequest } from '../api'
import { Modal } from '../components/Ui'
import { ListPagination } from '../components/ListControls'
import { describeAuditAction, parseAuditDetails } from '../auditPresentation'
import { showError } from '../format'

type AuditEntry = {
  id: number
  actor_id: number | null
  target_user_id: number | null
  action: string
  entity_type: 'role' | 'tuition' | 'grade' | 'submission' | 'rubric'
  details: string | null
  created_at: string
}

type AuditResponse = {
  items: AuditEntry[]
  total: number
  page: number
  page_size: number
  pages: number
}

export function AuditLogsPage() {
  const [items, setItems] = useState<AuditEntry[]>([])
  const [actorInput, setActorInput] = useState('')
  const [entityInput, setEntityInput] = useState('')
  const [actionSearch, setActionSearch] = useState('')
  const [search, setSearch] = useState('')
  const [fromInput, setFromInput] = useState('')
  const [toInput, setToInput] = useState('')
  const [filters, setFilters] = useState({ actorId: '', entityType: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null)

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (filters.actorId) params.set('actor_id', filters.actorId)
    if (filters.entityType) params.set('entity_type', filters.entityType)
    const range = auditDateRange(filters.from, filters.to)
    if (range.fromDate) params.set('from_date', range.fromDate)
    if (range.toDate) params.set('to_date', range.toDate)
    apiRequest<AuditResponse>(`/audit-logs?${params.toString()}`)
      .then((result) => {
        if (!active) return
        setItems(result.items)
        setTotal(result.total)
        setPages(Math.max(1, result.pages))
        setProblem('')
      })
      .catch((error: unknown) => {
        if (active) setProblem(showError(error))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [filters, page, pageSize])

  const visibleItems = items.filter((item) => {
    const query = search.trim().toLocaleLowerCase('vi')
    const textMatches = !query || `${item.actor_id ?? ''} ${item.target_user_id ?? ''} ${item.action} ${item.details ?? ''}`.toLocaleLowerCase('vi').includes(query)
    return textMatches && (!actionSearch || item.action === actionSearch)
  })

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setFilters({
      actorId: actorInput.trim(),
      entityType: entityInput,
      from: fromInput,
      to: toInput,
    })
  }

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div><span className="eyebrow">QUẢN TRỊ</span><h1>Nhật ký thao tác nhạy cảm</h1></div>
      </div>
      <form className="panel assignment-form" onSubmit={applyFilters}>
        <label className="field"><span>ID người thực hiện</span><input min="1" onChange={(event) => setActorInput(event.target.value)} type="number" value={actorInput} /></label>
        <label className="field"><span>Loại đối tượng</span><select onChange={(event) => setEntityInput(event.target.value)} value={entityInput}><option value="">Tất cả loại hiện có</option><option value="role">Vai trò người dùng</option><option value="tuition">Học phí</option><option value="grade">Điểm bài tập</option><option value="submission">Bài nộp</option><option value="rubric">Rubric</option></select></label>
        <label className="field"><span>Hành động trên trang hiện tại</span><select onChange={(event) => setActionSearch(event.target.value)} value={actionSearch}><option value="">Tất cả hành động</option>{[...new Set(items.map((item) => item.action))].sort().map((action) => <option key={action} value={action}>{describeAuditAction(action)}</option>)}</select></label>
        <label className="field"><span>Từ ngày</span><input onChange={(event) => setFromInput(event.target.value)} type="date" value={fromInput} /></label>
        <label className="field"><span>Đến ngày</span><input onChange={(event) => setToInput(event.target.value)} type="date" value={toInput} /></label>
        <button className="button button-primary" type="submit">Lọc nhật ký</button>
      </form>
      <label className="field audit-search"><span>Tìm trong trang hiện tại</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã người dùng, hành động hoặc nội dung thay đổi" type="search" value={search} /></label>
      {problem ? <div className="inline-error" role="alert">{problem}</div> : null}
      {loading ? <div className="panel schedule-loading">Đang tải nhật ký…</div> : null}
      {!loading && !problem && !visibleItems.length ? <div className="panel schedule-empty">{items.length ? 'Không có nhật ký nào trong trang khớp bộ lọc.' : 'Không có nhật ký phù hợp.'}</div> : null}
      {!loading && visibleItems.length ? (
        <section className="table-wrap" aria-label="Kết quả nhật ký">
          <table className="data-table audit-log-table">
            <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Người liên quan</th><th>Chi tiết</th><th>Thao tác</th></tr></thead>
            <tbody>{visibleItems.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                <td>{item.actor_id ?? 'Tài khoản đã xóa'}{item.actor_id ? ` (#${item.actor_id})` : ''}</td>
                <td><span className="audit-action-label">{describeAuditAction(item.action)}</span></td>
                <td>{item.entity_type === 'role' ? 'Vai trò người dùng' : item.entity_type === 'tuition' ? 'Học phí' : item.entity_type === 'grade' ? 'Điểm bài tập' : item.entity_type === 'submission' ? 'Bài nộp' : 'Rubric'}</td>
                <td>{item.target_user_id ?? 'Không còn tài khoản'}{item.target_user_id ? ` (#${item.target_user_id})` : ''}</td>
                <td>{parseAuditDetails(item.details).slice(0, 2).map((change) => `${change.key}: ${change.value}`).join(' · ') || 'Không có mô tả bổ sung'}</td>
                <td><button className="button button-outline button-small" onClick={() => setSelectedEntry(item)} type="button">Xem chi tiết</button></td>
              </tr>
            ))}</tbody>
          </table>
          <ListPagination page={page} pageSize={pageSize} total={total} onPageChange={(nextPage) => { setLoading(true); setPage(Math.min(pages, nextPage)) }} onPageSizeChange={(nextSize) => { setLoading(true); setPageSize(nextSize); setPage(1) }} />
        </section>
      ) : null}
      {selectedEntry ? (
        <Modal eyebrow={`Nhật ký #${selectedEntry.id} · ${new Date(selectedEntry.created_at).toLocaleString('vi-VN')}`} onClose={() => setSelectedEntry(null)} title="Chi tiết thao tác">
          <div className="audit-detail-grid">
            <p><strong>Người thực hiện</strong><span>{selectedEntry.actor_id ? `Tài khoản #${selectedEntry.actor_id}` : 'Tài khoản đã xóa'}</span></p>
            <p><strong>Hành động</strong><span>{describeAuditAction(selectedEntry.action)}</span></p>
            <p><strong>Đối tượng</strong><span>{selectedEntry.entity_type} · {selectedEntry.target_user_id ? `Tài khoản #${selectedEntry.target_user_id}` : 'Không có bản ghi liên quan'}</span></p>
          </div>
          <h3>Giá trị lưu trong nhật ký</h3>
          <dl className="audit-detail-list">{parseAuditDetails(selectedEntry.details).map((change, index) => <div key={`${change.key}-${index}`}><dt>{change.key}</dt><dd>{change.value}</dd></div>)}</dl>
          <details className="audit-raw-details"><summary>Dữ liệu gốc</summary><pre>{selectedEntry.details || selectedEntry.action}</pre></details>
        </Modal>
      ) : null}
    </div>
  )
}
