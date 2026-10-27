type InstitutionBrandProps = {
  className?: string
}

export function InstitutionBrand({ className = '' }: InstitutionBrandProps) {
  return (
    <div className={`institution-brand ${className}`.trim()}>
      <img
        alt="Logo ICTU"
        className="institution-brand-logo"
        height={56}
        src="/ictu-logo.png"
        width={56}
      />
      <div className="institution-brand-copy">
        <strong>ĐẠI HỌC THÁI NGUYÊN</strong>
        <span>TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG</span>
      </div>
    </div>
  )
}
