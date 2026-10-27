import { useEffect, useRef, useState } from 'react'
import type { User } from '../types'
import './LandingPage.css'

interface LandingPageProps {
  user: User | null
  onLoginClick: () => void
  onGoToDashboard: () => void
  onConsultationClick?: () => void
}

/* Crisp SVG icons tailored for the landing page */
function LandingIcon({ name, size = 20 }: { name: string; size?: number }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  }

  const icons: Record<string, React.ReactNode> = {
    cap: (
      <>
        <path d="m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z" />
        <path d="M6 11v5c3.7 2.7 8.3 2.7 12 0v-5" />
        <path d="M21.5 9v6" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    classes: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18M8 14h3M8 17h7" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="m8 15 2 2 5-5" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    arrowRight: <path d="M5 12h14m-7-7 7 7-7 7" />,
    externalLink: (
      <>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    mapPin: (
      <>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
    mail: (
      <>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...common}
    >
      {icons[name] ?? icons.cap}
    </svg>
  )
}

export function LandingPage({
  user,
  onLoginClick,
  onGoToDashboard,
  onConsultationClick,
}: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState<'hero' | 'about' | 'programs' | 'features'>('hero')
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  // Listen to window scroll to apply header styling and active link
  useEffect(() => {
    function handleScroll() {
      const scrollY = window.scrollY
      setScrolled(scrollY > 20)

      // Section highlight calculation
      const sections = ['features', 'programs', 'about', 'hero'] as const
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 180) {
            setActiveSection(sectionId)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // IntersectionObserver for scroll-reveal effects
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
          }
        })
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      },
    )

    const elements = document.querySelectorAll('.reveal-init')
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  // Handle escape key to close mobile menu
  useEffect(() => {
    if (!mobileMenuOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileMenuOpen])

  // Smooth scroll handler
  const scrollTo = (id: string) => {
    setMobileMenuOpen(false)
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="landing-wrapper">
      {/* ====================================================================
          A. THANH ĐIỀU HƯỚNG (HEADER)
          ==================================================================== */}
      <header className={`landing-header ${scrolled ? 'header-scrolled' : ''}`}>
        <div className="landing-container">
          <div className="landing-nav-inner">
            {/* Logo & Brand Recognition */}
            <button
              className="landing-brand"
              onClick={() => scrollTo('hero')}
              type="button"
              aria-label="Về đầu trang ICTU × CodeGym Việt Nam"
            >
              <img
                src="/ictu-logo.png"
                alt="Logo Trường Đại học Công nghệ Thông tin và Truyền thông"
                className="landing-brand-logo"
                width="44"
                height="48"
              />
              <div className="landing-brand-text">
                <div className="landing-brand-title">
                  <span>ICTU</span>
                  <span className="brand-accent">×</span>
                  <span>CodeGym</span>
                  <span className="brand-badge">Đào tạo</span>
                </div>
                <span className="landing-brand-sub">HỆ THỐNG QUẢN LÝ ĐÀO TẠO</span>
              </div>
            </button>

            {/* Desktop Navigation Links */}
            <nav className="landing-nav" aria-label="Điều hướng chính">
              <ul className="landing-nav-links">
                <li>
                  <button
                    className={`landing-nav-link ${activeSection === 'hero' ? 'active' : ''}`}
                    onClick={() => scrollTo('hero')}
                    type="button"
                  >
                    Trang chủ
                  </button>
                </li>
                <li>
                  <button
                    className={`landing-nav-link ${activeSection === 'about' ? 'active' : ''}`}
                    onClick={() => scrollTo('about')}
                    type="button"
                  >
                    Giới thiệu
                  </button>
                </li>
                <li>
                  <button
                    className={`landing-nav-link ${activeSection === 'programs' ? 'active' : ''}`}
                    onClick={() => scrollTo('programs')}
                    type="button"
                  >
                    Chương trình đào tạo
                  </button>
                </li>
                <li>
                  <button
                    className={`landing-nav-link ${activeSection === 'features' ? 'active' : ''}`}
                    onClick={() => scrollTo('features')}
                    type="button"
                  >
                    Về hệ thống
                  </button>
                </li>
              </ul>
            </nav>

            {/* Header Right Actions */}
            <div className="landing-header-actions">
              {user ? (
                <button
                  className="landing-btn-login"
                  onClick={onGoToDashboard}
                  type="button"
                >
                  <LandingIcon name="cap" size={17} />
                  <span>Vào hệ thống</span>
                </button>
              ) : (
                <button
                  className="landing-btn-login"
                  onClick={onLoginClick}
                  type="button"
                >
                  <span>Đăng nhập</span>
                  <LandingIcon name="arrowRight" size={16} />
                </button>
              )}

              {/* Hamburger Button for Mobile */}
              <button
                aria-controls="mobile-navigation"
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
                className={`landing-hamburger ${mobileMenuOpen ? 'open' : ''}`}
                onClick={() => setMobileMenuOpen((open) => !open)}
                type="button"
              >
                <span />
                <span />
                <span />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <div
          id="mobile-navigation"
          ref={mobileMenuRef}
          aria-hidden={!mobileMenuOpen}
          className={`landing-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
        >
          <div className="landing-mobile-links">
            <button
              className={`landing-mobile-link ${activeSection === 'hero' ? 'active' : ''}`}
              onClick={() => scrollTo('hero')}
              type="button"
            >
              <span>Trang chủ</span>
              <LandingIcon name="arrowRight" size={16} />
            </button>
            <button
              className={`landing-mobile-link ${activeSection === 'about' ? 'active' : ''}`}
              onClick={() => scrollTo('about')}
              type="button"
            >
              <span>Giới thiệu ICTU & CodeGym</span>
              <LandingIcon name="arrowRight" size={16} />
            </button>
            <button
              className={`landing-mobile-link ${activeSection === 'programs' ? 'active' : ''}`}
              onClick={() => scrollTo('programs')}
              type="button"
            >
              <span>Chương trình đào tạo</span>
              <LandingIcon name="arrowRight" size={16} />
            </button>
            <button
              className={`landing-mobile-link ${activeSection === 'features' ? 'active' : ''}`}
              onClick={() => scrollTo('features')}
              type="button"
            >
              <span>Về hệ thống quản lý</span>
              <LandingIcon name="arrowRight" size={16} />
            </button>
          </div>

          <div className="landing-mobile-actions">
            {user ? (
              <button
                className="landing-btn-primary"
                onClick={() => {
                  setMobileMenuOpen(false)
                  onGoToDashboard()
                }}
                type="button"
              >
                <LandingIcon name="cap" size={18} />
                <span>Vào bảng điều khiển ({user.full_name})</span>
              </button>
            ) : (
              <button
                className="landing-btn-primary"
                onClick={() => {
                  setMobileMenuOpen(false)
                  onLoginClick()
                }}
                type="button"
              >
                <span>Đăng nhập hệ thống</span>
                <LandingIcon name="arrowRight" size={18} />
              </button>
            )}

            {onConsultationClick ? (
              <button
                className="landing-btn-secondary"
                onClick={() => {
                  setMobileMenuOpen(false)
                  onConsultationClick()
                }}
                type="button"
              >
                <span>Đăng ký tư vấn tuyển sinh</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* ====================================================================
          B. HERO SECTION
          ==================================================================== */}
      <section id="hero" className="landing-hero">
        <div className="landing-hero-bg">
          <img
            src="/ictu-campus.png"
            alt="Khuôn viên Trường Đại học Công nghệ Thông tin và Truyền thông - Đại học Thái Nguyên"
            className="landing-hero-bg-img"
          />
          <div className="landing-hero-overlay" />
        </div>

        <div className="landing-container">
          <div className="landing-hero-inner">
            {/* Left Column: Information & Actions */}
            <div className="landing-hero-content">
              <div className="landing-hero-eyebrow anim-hero-eyebrow">
                <span className="dot-live" />
                <span>TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG × CODEGYM VIỆT NAM</span>
              </div>

              <h1 className="landing-hero-title anim-hero-title">
                Kết nối tri thức.<br />
                <span className="title-highlight">Kiến tạo tương lai.</span>
              </h1>

              <p className="landing-hero-desc anim-hero-desc">
                Cổng thông tin quản lý đào tạo được xây dựng nhằm hỗ trợ hoạt động đào tạo,
                kết nối nhà trường, giảng viên và học viên trong khuôn khổ hợp tác giữa
                Trường Đại học Công nghệ Thông tin và Truyền thông (ICTU) và CodeGym Việt Nam.
              </p>

              <div className="landing-hero-buttons anim-hero-buttons">
                <button
                  className="landing-btn-primary"
                  onClick={() => scrollTo('features')}
                  type="button"
                >
                  <span>Khám phá hệ thống</span>
                  <LandingIcon name="arrowRight" size={17} />
                </button>

                {user ? (
                  <button
                    className="landing-btn-secondary"
                    onClick={onGoToDashboard}
                    type="button"
                  >
                    <LandingIcon name="cap" size={17} />
                    <span>Vào bảng điều khiển</span>
                  </button>
                ) : (
                  <button
                    className="landing-btn-secondary"
                    onClick={onLoginClick}
                    type="button"
                  >
                    <span>Đăng nhập</span>
                  </button>
                )}
              </div>

              <div className="landing-hero-trust anim-hero-trust">
                <div className="landing-trust-item">
                  <LandingIcon name="check" size={16} />
                  <span>Chuẩn hóa học phần & tín chỉ</span>
                </div>
                <div className="landing-trust-item">
                  <LandingIcon name="check" size={16} />
                  <span>Lịch học & chuyên cần trực quan</span>
                </div>
                <div className="landing-trust-item">
                  <LandingIcon name="check" size={16} />
                  <span>Đào tạo thực tiễn chuẩn ngành</span>
                </div>
              </div>
            </div>

            {/* Right Column: 2 Staggered Event Photos */}
            <div className="landing-hero-media">
              <div className="landing-event-cards">
                <div className="landing-event-card card-one anim-card-1">
                  <div className="landing-event-img-wrap">
                    <img
                      src="/ictu-event-1.png"
                      alt="Hoạt động giảng dạy và sự kiện học thuật tại ICTU"
                      className="landing-event-img"
                      loading="eager"
                    />
                  </div>
                  <div className="landing-event-caption">
                    <span className="landing-event-tag">Học thuật ICTU</span>
                    <p className="landing-event-title">Hoạt động đào tạo tại ICTU</p>
                  </div>
                </div>

                <div className="landing-event-card card-two anim-card-2">
                  <div className="landing-event-img-wrap">
                    <img
                      src="/ictu-event-2.png"
                      alt="Chương trình hợp tác đào tạo công nghệ thông tin ICTU × CodeGym"
                      className="landing-event-img"
                      loading="eager"
                    />
                  </div>
                  <div className="landing-event-caption">
                    <span className="landing-event-tag">Hợp tác chiến lược</span>
                    <p className="landing-event-title">Chương trình đào tạo thực chiến cùng CodeGym</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          C & D. KHU VỰC GIỚI THIỆU ICTU VÀ CODEGYM
          ==================================================================== */}
      <section id="about" className="landing-about-section">
        <div className="landing-container">
          <div className="landing-section-header reveal-init">
            <span className="landing-section-eyebrow">ĐỐI TÁC HỢP TÁC CHIẾN LƯỢC</span>
            <h2 className="landing-section-title">Kết nối thế mạnh đào tạo & thực chiến</h2>
            <p className="landing-section-desc">
              Mô hình kết hợp giữa cơ sở giáo dục đại học công lập hàng đầu khu vực
              với doanh nghiệp đào tạo lập trình thực tiễn chuẩn quốc tế.
            </p>
          </div>

          <div className="landing-about-grid">
            {/* ICTU Card */}
            <div className="landing-about-card reveal-init stagger-1">
              <div className="landing-about-head">
                <div className="landing-about-logo-box">
                  <img
                    src="/ictu-logo.png"
                    alt="Biểu trưng ICTU"
                    width="56"
                    height="60"
                  />
                </div>
                <div className="landing-about-head-text">
                  <h3>Về ICTU</h3>
                  <span>Trường ĐH Công nghệ Thông tin và Truyền thông</span>
                </div>
              </div>

              <p className="landing-about-body">
                Trường Đại học Công nghệ Thông tin và Truyền thông, Đại học Thái Nguyên,
                đào tạo nguồn nhân lực chất lượng trong lĩnh vực công nghệ thông tin và truyền thông.
              </p>

              <div className="landing-about-pills">
                <span className="landing-pill">Thành viên Đại học Thái Nguyên</span>
                <span className="landing-pill">Tiên phong chuyển đổi số</span>
                <span className="landing-pill">Chất lượng kiểm định</span>
              </div>

              <a
                href="https://ictu.edu.vn"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-about-link"
              >
                <span>Tìm hiểu thêm về ICTU</span>
                <LandingIcon name="externalLink" size={16} />
              </a>
            </div>

            {/* CodeGym Card */}
            <div className="landing-about-card reveal-init stagger-2">
              <div className="landing-about-head">
                <div className="landing-about-logo-box codegym-brand">
                  CodeGym
                </div>
                <div className="landing-about-head-text">
                  <h3>Hợp tác ICTU × CodeGym Việt Nam</h3>
                  <span>Hệ thống đào tạo lập trình thực chiến</span>
                </div>
              </div>

              <p className="landing-about-body">
                Kết nối thế mạnh đào tạo của ICTU với kinh nghiệm đào tạo lập trình
                thực tiễn của CodeGym Việt Nam, hướng đến mục tiêu phát triển nguồn
                nhân lực công nghệ chất lượng.
              </p>

              <div className="landing-about-pills">
                <span className="landing-pill">Mô hình Coding Bootcamp</span>
                <span className="landing-pill">Thực hành dự án thực tế</span>
                <span className="landing-pill">Kỹ năng công nghệ hiện đại</span>
              </div>

              <a
                href="https://codegym.vn"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-about-link"
              >
                <span>Tìm hiểu về CodeGym</span>
                <LandingIcon name="externalLink" size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          CHƯƠNG TRÌNH ĐÀO TẠO (PROGRAMS SECTION)
          ==================================================================== */}
      <section id="programs" className="landing-programs-section">
        <div className="landing-container">
          <div className="landing-section-header reveal-init">
            <span className="landing-section-eyebrow">CHƯƠNG TRÌNH ĐÀO TẠO TÍCH HỢP</span>
            <h2 className="landing-section-title">Lộ trình học tập bài bản & thực tiễn</h2>
            <p className="landing-section-desc">
              Chương trình được thiết kế khoa học, kết hợp nền tảng lý thuyết vững chắc
              với hàng trăm giờ thực hành đồ án phần mềm theo tiêu chuẩn công nghiệp.
            </p>
          </div>

          <div className="landing-programs-grid">
            <div className="landing-program-card reveal-init stagger-1">
              <span className="landing-program-badge">Chuyên ngành trọng điểm</span>
              <h3 className="landing-program-title">Kỹ sư Công nghệ Thông tin Thực chiến</h3>
              <p className="landing-program-desc">
                Trang bị tư duy thuật toán, cấu trúc dữ liệu, kiến trúc phần mềm
                cùng phương pháp làm việc chuyên nghiệp theo Agile/Scrum.
              </p>
              <div className="landing-program-meta">
                <span>Chương trình đại học chính quy</span>
                <span>Hợp tác doanh nghiệp</span>
              </div>
            </div>

            <div className="landing-program-card reveal-init stagger-2">
              <span className="landing-program-badge">Lập trình ứng dụng</span>
              <h3 className="landing-program-title">Phát triển Phần mềm Toàn diện</h3>
              <p className="landing-program-desc">
                Đào tạo chuyên sâu công nghệ Full-stack hiện đại, phát triển API,
                quản trị cơ sở dữ liệu và triển khai ứng dụng trên nền tảng đám mây.
              </p>
              <div className="landing-program-meta">
                <span>Học phần thực hành cao</span>
                <span>Đồ án doanh nghiệp</span>
              </div>
            </div>

            <div className="landing-program-card reveal-init stagger-3">
              <span className="landing-program-badge">Kỹ năng nghề nghiệp</span>
              <h3 className="landing-program-title">Huấn luyện Dự án & Tuyển dụng</h3>
              <p className="landing-program-desc">
                Rèn luyện kỹ năng mềm, giải quyết vấn đề thực tế, viết mã sạch
                và kết nối cơ hội thực tập, việc làm tại các đối tác công nghệ.
              </p>
              <div className="landing-program-meta">
                <span>Cố vấn 1-1 từ chuyên gia</span>
                <span>Chuẩn đầu ra doanh nghiệp</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          E. KHU VỰC GIỚI THIỆU HỆ THỐNG (SYSTEM FEATURES)
          ==================================================================== */}
      <section id="features" className="landing-system-section">
        <div className="landing-container">
          <div className="landing-section-header reveal-init">
            <span className="landing-section-eyebrow">NỀN TẢNG QUẢN LÝ HIỆN ĐẠI</span>
            <h2 className="landing-section-title">Hệ thống quản lý đào tạo</h2>
            <p className="landing-section-desc">
              Nền tảng hỗ trợ quản lý và kết nối các hoạt động đào tạo
              giữa nhà trường, giảng viên và học viên.
            </p>
          </div>

          <div className="landing-features-grid">
            {/* 1. Môn học */}
            <div className="landing-feature-card reveal-init stagger-1">
              <div className="landing-feature-icon">
                <LandingIcon name="book" size={24} />
              </div>
              <h3 className="landing-feature-title">Quản lý môn học</h3>
              <p className="landing-feature-desc">
                Quản lý danh mục học phần, số tín chỉ, đề cương chi tiết
                và hệ thống bài học theo từng lộ trình.
              </p>
              <div className="landing-feature-status">
                <span className="status-indicator" />
                <span>Chức năng trong hệ thống</span>
              </div>
            </div>

            {/* 2. Chương trình đào tạo */}
            <div className="landing-feature-card reveal-init stagger-2">
              <div className="landing-feature-icon">
                <LandingIcon name="cap" size={24} />
              </div>
              <h3 className="landing-feature-title">Chương trình đào tạo</h3>
              <p className="landing-feature-desc">
                Cấu trúc khung chương trình đào tạo theo từng học kỳ,
                phân bổ khối lượng kiến thức chuẩn hóa.
              </p>
              <div className="landing-feature-status">
                <span className="status-indicator" />
                <span>Chức năng trong hệ thống</span>
              </div>
            </div>

            {/* 3. Lớp học phần */}
            <div className="landing-feature-card reveal-init stagger-3">
              <div className="landing-feature-icon">
                <LandingIcon name="classes" size={24} />
              </div>
              <h3 className="landing-feature-title">Lớp học phần</h3>
              <p className="landing-feature-desc">
                Quản lý danh sách lớp, thông tin giảng viên, sĩ số
                và theo dõi tiến độ hoàn thành học phí.
              </p>
              <div className="landing-feature-status">
                <span className="status-indicator" />
                <span>Chức năng trong hệ thống</span>
              </div>
            </div>

            {/* 4. Thời khóa biểu & Điểm danh */}
            <div className="landing-feature-card reveal-init stagger-4">
              <div className="landing-feature-icon">
                <LandingIcon name="calendar" size={24} />
              </div>
              <h3 className="landing-feature-title">Thời khóa biểu & Điểm danh</h3>
              <p className="landing-feature-desc">
                Theo dõi lịch học trực quan theo tuần/tháng, xếp phòng học,
                ca học và ghi nhận chuyên cần chi tiết.
              </p>
              <div className="landing-feature-status">
                <span className="status-indicator" />
                <span>Chức năng trong hệ thống</span>
              </div>
            </div>

            {/* 5. Bài tập */}
            <div className="landing-feature-card reveal-init stagger-5">
              <div className="landing-feature-icon">
                <LandingIcon name="edit" size={24} />
              </div>
              <h3 className="landing-feature-title">Bài tập & Thực hành</h3>
              <p className="landing-feature-desc">
                Giao bài tập theo từng buổi học, quản lý hạn nộp bài
                và hỗ trợ đánh giá kết quả thực tế.
              </p>
              <div className="landing-feature-status">
                <span className="status-indicator" />
                <span>Chức năng trong hệ thống</span>
              </div>
            </div>

            {/* 6. Hồ sơ học viên */}
            <div className="landing-feature-card reveal-init stagger-6">
              <div className="landing-feature-icon">
                <LandingIcon name="users" size={24} />
              </div>
              <h3 className="landing-feature-title">Hồ sơ học viên</h3>
              <p className="landing-feature-desc">
                Quản lý thông tin học viên tập trung, theo dõi quá trình
                học tập và lịch sử biến động ghi danh.
              </p>
              <div className="landing-feature-status">
                <span className="status-indicator" />
                <span>Chức năng trong hệ thống</span>
              </div>
            </div>

            {/* 7. Tuyển sinh */}
            <div className="landing-feature-card reveal-init stagger-7">
              <div className="landing-feature-icon">
                <LandingIcon name="search" size={24} />
              </div>
              <h3 className="landing-feature-title">Tuyển sinh & Tư vấn</h3>
              <p className="landing-feature-desc">
                Tiếp nhận đăng ký trực tuyến, quản lý nguồn tuyển sinh
                và phân công tư vấn viên đồng hành.
              </p>
              <div className="landing-feature-status">
                <span className="status-indicator" />
                <span>Chức năng trong hệ thống</span>
              </div>
            </div>

            {/* 8. Quản trị & Phân quyền */}
            <div className="landing-feature-card reveal-init stagger-8">
              <div className="landing-feature-icon">
                <LandingIcon name="shield" size={24} />
              </div>
              <h3 className="landing-feature-title">Phân quyền đa vai trò</h3>
              <p className="landing-feature-desc">
                Bảo mật dữ liệu nghiêm ngặt theo vai trò: Quản trị viên,
                Quản lý đào tạo, Giảng viên, Học viên.
              </p>
              <div className="landing-feature-status">
                <span className="status-indicator" />
                <span>Chức năng trong hệ thống</span>
              </div>
            </div>
          </div>

          {/* CTA Banner */}
          <div className="landing-cta-banner reveal-init">
            <div className="landing-cta-text">
              <h3>Sẵn sàng trải nghiệm Cổng Quản lý Đào tạo?</h3>
              <p>
                Đăng nhập ngay để truy cập không gian học tập, thời khóa biểu,
                bài tập và các dịch vụ học vụ tích hợp.
              </p>
            </div>
            <div className="landing-cta-actions">
              {user ? (
                <button
                  className="landing-btn-cta"
                  onClick={onGoToDashboard}
                  type="button"
                >
                  <LandingIcon name="cap" size={18} />
                  <span>Vào bảng điều khiển</span>
                </button>
              ) : (
                <button
                  className="landing-btn-cta"
                  onClick={onLoginClick}
                  type="button"
                >
                  <span>Đăng nhập hệ thống</span>
                  <LandingIcon name="arrowRight" size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          F. FOOTER
          ==================================================================== */}
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-grid">
            {/* Brand column */}
            <div className="landing-footer-brand-col">
              <div className="landing-footer-brand">
                <img
                  src="/ictu-logo.png"
                  alt="ICTU Logo"
                  className="landing-footer-logo"
                  width="44"
                  height="48"
                />
                <div className="landing-footer-brand-text">
                  <strong>ICTU × CodeGym Việt Nam</strong>
                  <span>HỆ THỐNG QUẢN LÝ ĐÀO TẠO</span>
                </div>
              </div>
              <p className="landing-footer-desc">
                Cổng quản lý đào tạo kết nối Trường Đại học Công nghệ Thông tin
                và Truyền thông (ICTU) với CodeGym Việt Nam, phục vụ giảng dạy,
                học tập và phát triển nguồn nhân lực công nghệ số.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="landing-footer-heading">Điều hướng nhanh</h4>
              <ul className="landing-footer-links">
                <li>
                  <button
                    className="landing-footer-link"
                    onClick={() => scrollTo('hero')}
                    type="button"
                  >
                    Trang chủ
                  </button>
                </li>
                <li>
                  <button
                    className="landing-footer-link"
                    onClick={() => scrollTo('about')}
                    type="button"
                  >
                    Giới thiệu ICTU & CodeGym
                  </button>
                </li>
                <li>
                  <button
                    className="landing-footer-link"
                    onClick={() => scrollTo('programs')}
                    type="button"
                  >
                    Chương trình đào tạo
                  </button>
                </li>
                <li>
                  <button
                    className="landing-footer-link"
                    onClick={() => scrollTo('features')}
                    type="button"
                  >
                    Về hệ thống quản lý
                  </button>
                </li>
                <li>
                  <button
                    className="landing-footer-link"
                    onClick={user ? onGoToDashboard : onLoginClick}
                    type="button"
                  >
                    {user ? 'Bảng điều khiển' : 'Đăng nhập cổng đào tạo'}
                  </button>
                </li>
              </ul>
            </div>

            {/* External Links */}
            <div>
              <h4 className="landing-footer-heading">Đơn vị hợp tác</h4>
              <ul className="landing-footer-links">
                <li>
                  <a
                    href="https://ictu.edu.vn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-footer-link"
                  >
                    <span>Cổng thông tin ICTU</span>
                    <LandingIcon name="externalLink" size={13} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://codegym.vn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-footer-link"
                  >
                    <span>Website CodeGym Việt Nam</span>
                    <LandingIcon name="externalLink" size={13} />
                  </a>
                </li>
                {onConsultationClick ? (
                  <li>
                    <button
                      className="landing-footer-link"
                      onClick={onConsultationClick}
                      type="button"
                    >
                      <span>Tư vấn tuyển sinh</span>
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>

            {/* Official Contact Info */}
            <div>
              <h4 className="landing-footer-heading">Thông tin liên hệ</h4>
              <ul className="landing-footer-contact">
                <li>
                  <LandingIcon name="mapPin" size={16} />
                  <span>Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên, Tỉnh Thái Nguyên</span>
                </li>
                <li>
                  <LandingIcon name="mail" size={16} />
                  <span>daotao@ictu.edu.vn</span>
                </li>
                <li>
                  <LandingIcon name="globe" size={16} />
                  <span>ictu.edu.vn · codegym.vn</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="landing-footer-bottom">
            <span>
              © 2026 ICTU × CodeGym Việt Nam. Bản quyền thuộc về Trường ĐH CNTT&TT - ĐH Thái Nguyên.
            </span>
            <span>Hệ thống Quản lý Đào tạo · Phiên bản 1.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
