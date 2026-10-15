import { useId } from 'react'

export default function CollaborationVisual() {
  const id = useId()
  return (
    <svg className="collaboration-visual" viewBox="0 0 560 320" role="img" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>ICTU và CodeGym Việt Nam kết nối tri thức đại học và thực hành công nghệ trong cùng một hệ thống đào tạo</title>
      <defs>
        <linearGradient id={`${id}-bridge`} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#54aaa6" /><stop offset="1" stopColor="#c39448" /></linearGradient>
        <pattern id={`${id}-grid`} width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#54aaa6" opacity=".15" /></pattern>
      </defs>
      <rect width="560" height="320" fill={`url(#${id}-grid)`} />
      <ellipse cx="280" cy="164" rx="238" ry="120" fill="none" stroke="#54aaa6" strokeOpacity=".14" />
      <ellipse cx="280" cy="164" rx="190" ry="85" fill="none" stroke="#54aaa6" strokeOpacity=".12" />
      <path d="M132 142C174 142 190 196 240 196M428 142C386 142 370 196 320 196" fill="none" stroke={`url(#${id}-bridge)`} strokeWidth="2" />
      <path d="M280 225v21M129 246h302M129 246v9M280 246v9M431 246v9" stroke="#54aaa6" strokeOpacity=".45" fill="none" strokeDasharray="4 5" />
      <g transform="translate(40 65)">
        <rect width="182" height="98" rx="16" fill="#fff" stroke="#54aaa6" strokeOpacity=".45" />
        <rect x="14" y="16" width="38" height="38" rx="11" fill="#54aaa6" fillOpacity=".12" />
        <g transform="translate(21 23)" fill="none" stroke="#54aaa6" strokeWidth="1.7"><path d="m0 8 12-6 12 6-12 6L0 8ZM5 11v7c4 3 10 3 14 0v-7" /></g>
        <text x="64" y="36" fill="#142d4e" fontSize="22" fontWeight="750">ICTU</text>
        <text x="16" y="78" fill="#637f8c" fontSize="12">Nền tảng tri thức đại học</text>
      </g>
      <g transform="translate(338 65)">
        <rect width="182" height="98" rx="16" fill="#fff" stroke="#c39448" strokeOpacity=".45" />
        <rect x="14" y="16" width="38" height="38" rx="11" fill="#c39448" fillOpacity=".13" />
        <text x="20" y="41" fill="#c39448" fontSize="16" fontWeight="700">&lt;/&gt;</text>
        <text x="63" y="36" fill="#142d4e" fontSize="21" fontWeight="750">CodeGym</text>
        <text x="16" y="78" fill="#637f8c" fontSize="12">Thực hành công nghệ</text>
      </g>
      <g transform="translate(197 163)">
        <rect x="-6" y="-6" width="178" height="74" rx="22" fill="#54aaa6" fillOpacity=".06" />
        <rect width="166" height="62" rx="16" fill="#dcefeb" />
        <g transform="translate(12 19)" stroke="#087f8c" strokeWidth="1.5" fill="none"><rect width="23" height="17" rx="3" /><path d="M4 6h15M6 10h4M13 10h4M9 21h5M12 17v4" /></g>
        <text x="45" y="28" fill="#142d4e" fontSize="11" fontWeight="750">CÙNG KIẾN TẠO</text>
        <text x="45" y="43" fill="#527882" fontSize="10">Quản lý đào tạo</text>
      </g>
      <g fontSize="11" fill="#637f8c" textAnchor="middle">
        <rect x="66" y="255" width="126" height="33" rx="16" fill="#fff" fillOpacity=".65" /><text x="129" y="276">Chương trình học</text>
        <rect x="213" y="255" width="134" height="33" rx="16" fill="#fff" fillOpacity=".65" /><text x="280" y="276">Lớp học & học viên</text>
        <rect x="368" y="255" width="126" height="33" rx="16" fill="#fff" fillOpacity=".65" /><text x="431" y="276">Hành trình học tập</text>
      </g>
      <circle cx="38" cy="184" r="4" fill="#54aaa6" /><circle cx="520" cy="205" r="5" fill="#c39448" /><path d="M287 43v10M282 48h10" stroke="#c39448" strokeWidth="2" />
    </svg>
  )
}
