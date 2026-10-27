import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react'
import { Modal } from './Ui'

export type TableColumn<Row> = { key: string; header: ReactNode; render: (row: Row) => ReactNode; className?: string }

export function DataTable<Row extends { id: string | number }>({ rows, columns, emptyMessage = 'Không có dữ liệu.', rowLabel }: { rows: Row[]; columns: TableColumn<Row>[]; emptyMessage?: string; rowLabel: (row: Row) => string }) {
  if (!rows.length) return <div className="empty-state">{emptyMessage}</div>
  return <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map((column) => <th className={column.className} key={column.key} scope="col">{column.header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr aria-label={rowLabel(row)} key={row.id}>{columns.map((column) => <td className={column.className} key={column.key}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>
}

export function SearchInput({ label, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  return <label className="search-input"><span>{label}</span><input {...props} type="search" /></label>
}

export function FilterPanel({ title = 'Bộ lọc', children, onReset }: { title?: string; children: ReactNode; onReset?: () => void }) {
  return <section aria-label={title} className="filter-panel"><div className="filter-panel-heading"><strong>{title}</strong>{onReset ? <button className="text-button" onClick={onReset} type="button">Xóa bộ lọc</button> : null}</div><div className="filter-panel-fields">{children}</div></section>
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode }) {
  return <span className={`status-badge status-tone-${tone}`}>{children}</span>
}

export function LoadingSkeleton({ rows = 3, label = 'Đang tải dữ liệu' }: { rows?: number; label?: string }) {
  return <div aria-label={label} aria-busy="true" className="skeleton-stack" role="status">{Array.from({ length: rows }, (_, index) => <span className="skeleton-line" key={index} />)}</div>
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <section className="empty-state"><strong>{title}</strong>{description ? <p>{description}</p> : null}{action}</section>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <section className="error-state" role="alert"><strong>Không thể tải dữ liệu</strong><p>{message}</p>{onRetry ? <button className="button button-secondary" onClick={onRetry} type="button">Thử lại</button> : null}</section>
}

export function ConfirmDialog({ title, message, confirmLabel = 'Xác nhận', onConfirm, onClose, busy = false }: { title: string; message: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  return <Modal eyebrow="XÁC NHẬN THAO TÁC" title={title} onClose={onClose}><p>{message}</p><div className="button-row"><button className="button button-quiet" disabled={busy} onClick={onClose} type="button">Hủy</button><button className="button button-primary" disabled={busy} onClick={onConfirm} type="button">{busy ? 'Đang xử lý…' : confirmLabel}</button></div></Modal>
}

export function FileUploader({ label, accept, maxBytes, onFile, disabled = false }: { label: string; accept: string; maxBytes: number; onFile: (file: File | null) => void; disabled?: boolean }) {
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (file && file.size > maxBytes) { event.target.value = ''; onFile(null); return }
    onFile(file)
  }
  return <label className="file-uploader"><span>{label}</span><input accept={accept} disabled={disabled} onChange={change} type="file" /><small>Giới hạn {(maxBytes / (1024 * 1024)).toFixed(0)} MB. Máy chủ vẫn kiểm tra lại loại và kích thước tệp.</small></label>
}
