import { useMemo, useState } from 'react'

export type SearchOption = { value: string; label: string }

type SearchableSelectProps = {
  options: SearchOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  ariaLabel: string
  placeholder?: string
  name?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function SearchableSelect({
  options,
  value,
  defaultValue,
  onChange,
  ariaLabel,
  placeholder = 'Chọn một mục',
  name,
  required,
  disabled,
  className,
}: SearchableSelectProps) {
  const [search, setSearch] = useState('')
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const selectedValue = value ?? internalValue
  const visibleOptions = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('vi')
    const filtered = normalized
      ? options.filter((option) => option.label.toLocaleLowerCase('vi').includes(normalized))
      : options
    if (selectedValue && !filtered.some((option) => option.value === selectedValue)) {
      const selected = options.find((option) => option.value === selectedValue)
      return selected ? [selected, ...filtered] : filtered
    }
    return filtered
  }, [options, search, selectedValue])

  return (
    <div className={`searchable-select ${className ?? ''}`}>
      {options.length > 5 ? (
        <input
          aria-label={`Tìm trong ${ariaLabel}`}
          autoComplete="off"
          className="searchable-select-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm trong danh sách…"
          type="search"
          value={search}
        />
      ) : null}
      <select
        aria-label={ariaLabel}
        className="searchable-select-control"
        disabled={disabled}
        name={name}
        onChange={(event) => {
          if (value === undefined) setInternalValue(event.target.value)
          onChange?.(event.target.value)
        }}
        required={required}
        value={selectedValue}
      >
        <option value="">{placeholder}</option>
        {visibleOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}

export function SearchableMultiSelect({
  options,
  value,
  defaultValue,
  name,
  onChange,
  ariaLabel,
  size = 6,
}: {
  options: SearchOption[]
  value?: string[]
  defaultValue?: string[]
  name?: string
  onChange?: (values: string[]) => void
  ariaLabel: string
  size?: number
}) {
  const [search, setSearch] = useState('')
  const [internalValue, setInternalValue] = useState(defaultValue ?? [])
  const selectedValues = value ?? internalValue
  const visibleOptions = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('vi')
    const filtered = normalized
      ? options.filter((option) => option.label.toLocaleLowerCase('vi').includes(normalized))
      : options
    const selected = options.filter((option) => selectedValues.includes(option.value) && !filtered.includes(option))
    return [...selected, ...filtered]
  }, [options, search, selectedValues])

  return (
    <div className="searchable-select">
      {options.length > 5 ? (
        <input
          aria-label={`Tìm trong ${ariaLabel}`}
          autoComplete="off"
          className="searchable-select-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm trong danh sách…"
          type="search"
          value={search}
        />
      ) : null}
      <select
        aria-label={ariaLabel}
        className="searchable-select-control"
        multiple
        name={name}
        onChange={(event) => {
          const nextValues = Array.from(event.target.selectedOptions, (option) => option.value)
          if (value === undefined) setInternalValue(nextValues)
          onChange?.(nextValues)
        }}
        size={size}
        value={selectedValues}
      >
        {visibleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav aria-label="Phân trang danh sách" className="table-pagination list-pagination">
      <span>Hiển thị {first}–{last} / {total}</span>
      <div className="list-pagination-actions">
        {onPageSizeChange ? (
          <label className="list-page-size">
            <span>Số dòng</span>
            <select
              aria-label="Số dòng mỗi trang"
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              value={pageSize}
            >
              {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        ) : null}
        <button className="button button-page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">Trước</button>
        <span className="page-current">{page} / {pageCount}</span>
        <button className="button button-page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} type="button">Sau</button>
      </div>
    </nav>
  )
}
