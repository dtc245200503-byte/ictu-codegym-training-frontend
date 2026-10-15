import type { ReactNode } from 'react'
import BrandLockup from './BrandLockup'
import CollaborationVisual from './CollaborationVisual'
import './LoginPage.css'

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="login-page partnership-auth">
      <section className="auth-story" aria-label="ICTU và CodeGym Việt Nam cùng kiến tạo">
        <BrandLockup />
        <div className="auth-story-content">
          <span className="auth-story-eyebrow"><i aria-hidden="true" /> KẾT NỐI TRI THỨC. KIẾN TẠO TƯƠNG LAI.</span>
          <h2>Cùng kiến tạo.<br /><span>Cùng tiến xa.</span></h2>
          <p>Sự kết hợp giữa ICTU và CodeGym Việt Nam trong xây dựng hệ thống quản lý đào tạo — kết nối nhà trường, giảng viên và học viên trên một nền tảng.</p>
          <CollaborationVisual />
          <div className="auth-story-values">
            <span><b>01</b> Kết nối đào tạo</span>
            <span><b>02</b> Đồng hành học tập</span>
            <span><b>03</b> Cùng phát triển</span>
          </div>
        </div>
        <p className="auth-story-footer">ICTU × CodeGym Việt Nam <span>Hệ thống quản lý đào tạo</span></p>
      </section>
      <section className="auth-form-panel" aria-label="Truy cập tài khoản">
        {children}
        <p className="auth-panel-footer">Kết nối hôm nay. Phát triển ngày mai.</p>
      </section>
    </div>
  )
}
