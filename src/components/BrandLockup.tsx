interface BrandLockupProps {
  compact?: boolean
}

/** Typographic partnership signature, independent of external logo assets. */
export default function BrandLockup({ compact = false }: BrandLockupProps) {
  return (
    <div className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}`} aria-label="ICTU hợp tác cùng CodeGym Việt Nam">
      <div className="brand-partner brand-partner--ictu">
        <span className="brand-symbol" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none"><path d="m3 12 13-6 13 6-13 6-13-6Z" /><path d="M8 15v8c5 4 11 4 16 0v-8M29 12v10" /></svg>
        </span>
        <div><strong>ICTU</strong>{!compact && <small>Đại học CNTT & Truyền thông</small>}</div>
      </div>
      <span className="brand-cross" aria-hidden="true">×</span>
      <div className="brand-partner brand-partner--codegym">
        <span className="brand-symbol" aria-hidden="true">&lt;/&gt;</span>
        <div><strong>CodeGym</strong><small>Việt Nam</small></div>
      </div>
    </div>
  )
}
