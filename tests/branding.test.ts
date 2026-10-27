import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const institutionBrand = readFileSync(new URL('../src/components/InstitutionBrand.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/frappe-refresh.css', import.meta.url), 'utf8')

test('browser tab uses the ICTU logo and Vietnamese product title', () => {
  assert.match(html, /href="\/ictu-logo\.png"/)
  assert.match(html, /<title>Hệ thống Quản lý Đào tạo<\/title>/)
  assert.doesNotMatch(html, /href="\/favicon\.svg"/)
  assert.match(app, /document\.title = 'Hệ thống Quản lý Đào tạo'/)
})

test('sidebar uses ICTU logo and the complete university name', () => {
  assert.match(app, /<InstitutionBrand className="sidebar-brand"\s*\/>/)
  assert.match(app, /<InstitutionBrand className="login-institution-brand"\s*\/>/)
  assert.match(app, /<InstitutionBrand className="login-mobile-institution-brand"\s*\/>/)
  assert.match(institutionBrand, /src="\/ictu-logo\.png"/)
  assert.match(institutionBrand, /ĐẠI HỌC THÁI NGUYÊN/)
  assert.match(institutionBrand, /TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN VÀ TRUYỀN THÔNG/)
  assert.match(styles, /\.institution-brand-logo\s*\{[^}]*object-fit:\s*contain/s)
  assert.doesNotMatch(app, /ACADEMIC PORTAL/)
  assert.doesNotMatch(app, /<Icon name="cap"/)
})
