export type Role =
  | 'admin'
  | 'manager'
  | 'admissions'
  | 'accountant'
  | 'teacher'
  | 'ta'
  | 'student'
  | 'guest'

export type User = {
  id: number
  username: string
  student_code: string | null
  email: string
  full_name: string
  phone: string | null
  birth_date: string | null
  address: string | null
  roles: Role[]
  is_active: boolean
  is_locked: boolean
  must_change_password: boolean
}

export type AccountPage = {
  items: User[]
  total: number
  page: number
  page_size: number
  pages: number
}

export type Course = {
  id: number
  code: string
  name: string
  department: string
  credits: number
  description: string | null
  prerequisite_id: number | null
  prerequisite_name: string | null
  session_count: number
  is_active: boolean
}

export type StudyProgram = {
  id: number
  code: string
  name: string
  degree_level: string
  total_credits: number
  duration_semesters: number
  description: string | null
  courses: {
    id: number
    code: string
    name: string
    sequence: number
    prerequisite_course_id: number | null
  }[]
  courses_pagination?: { page: number; page_size: number; total: number; pages: number }
}

export type Classroom = {
  id: number
  code: string
  capacity: number
  online_url: string | null
}

export type TrainingClass = {
  id: number
  code: string
  name: string
  course_id: number
  course_code: string
  course_name: string
  teacher_id: number
  teacher_name: string
  assistant_id: number | null
  assistant_name: string | null
  room: string
  term: string
  day_of_week: number
  weekday: string
  start_time: string
  end_time: string
  capacity: number
  student_count: number
  status: 'preparing' | 'active' | 'completed' | 'cancelled'
  assistants: { id: number; full_name: string }[]
  total_sessions?: number
  completed_sessions?: number
  session_progress?: string
}

export type AttendanceMatrixStatus =
  | 'present'
  | 'late'
  | 'excused_absent'
  | 'unexcused_absent'
  | 'absent'

export type AttendanceMatrixCell = {
  eligible: boolean
  status: AttendanceMatrixStatus | null
}

export type AttendanceMatrixSession = {
  id: number
  session_date: string
  start_time: string
  end_time: string
}

export type AttendanceMatrixStudent = {
  id: number
  student_code: string | null
  full_name: string
  attendance_by_session: Record<string, AttendanceMatrixCell>
  total_sessions: number
  attended_count: number
  present_count: number
  late_count: number
  excused_absent_count: number
  unexcused_absent_count: number
  legacy_absent_count: number
  unrecorded_count: number
  absent_count: number
  attendance_rate: number | null
}

export type AttendanceMatrixResponse = {
  class: Pick<TrainingClass, 'id' | 'code' | 'name'>
  sessions: AttendanceMatrixSession[]
  students: AttendanceMatrixStudent[]
  total_students?: number
  totals?: {
    attended_count: number
    absent_count: number
    excused_absent_count: number
    unexcused_absent_count: number
    legacy_absent_count: number
    unrecorded_count: number
  }
  pagination?: {
    page: number
    page_size: number
    total: number
  }
}

export type Assignment = {
  id: number
  class_id: number
  class_code: string
  class_name: string
  course_name: string
  title: string
  description: string | null
  due_at: string | null
  max_score: string | null
  status: 'draft' | 'published' | 'closed'
  session_id: number | null
  created_at: string
}

export type DashboardSummary = {
  students: number
  teachers: number
  courses: number
  classes: number
}
