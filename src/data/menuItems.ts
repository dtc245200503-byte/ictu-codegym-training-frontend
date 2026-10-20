import type { MenuItem } from '../types/auth'

export const menuItems: MenuItem[] = [
  { name: 'Hồ sơ học viên', path: '/students', permission: 'STUDENT_MANAGE' },
  { name: 'Thông báo', path: '/notifications' },
  { name: 'Bảng chuyên cần', path: '/attendance-summary', permission: 'ATTENDANCE_VIEW' },
  {
    name: 'Trang chủ',
    path: '/',
  },
  {
    name: 'Hồ sơ cá nhân',
    path: '/profile',
  },
  {
    name: 'Quản lý tài khoản',
    path: '/users',
    permission: 'USER_MANAGE',
  },
  {
    name: 'Vai trò và phân quyền',
    path: '/roles',
    permission: 'ROLE_MANAGE',
  },
  {
    name: 'Chương trình đào tạo',
    path: '/courses',
    permission: 'CURRICULUM_MANAGE',
  },
  {
    name: 'Môn học',
    path: '/subjects',
    permission: 'SUBJECT_MANAGE',
  },
  { name: 'Khách hàng tiềm năng', path: '/leads', permission: 'LEAD_MANAGE' },
  {
    name: 'Lớp học',
    path: '/classes',
    permission: 'CLASS_MANAGE',
  },
  {
    name: 'Điểm',
    path: '/grades',
    permission: 'GRADE_VIEW',
  },
  {
    name: 'Học phí',
    path: '/tuition',
    permission: 'TUITION_VIEW',
  },
  {
    name: 'Điểm danh',
    path: '/attendance',
    permission: 'ATTENDANCE_VIEW',
  },
]
