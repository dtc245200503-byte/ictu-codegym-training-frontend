const actionLabels: Record<string, string> = {
  'account.role_changed': 'Cập nhật vai trò',
  'enrollment.tuition_status_changed': 'Cập nhật trạng thái học phí',
  'fee_schedule.created': 'Tạo biểu phí',
  'tuition.plan_batch_created': 'Tạo kế hoạch học phí',
  'tuition.payment_recorded': 'Ghi nhận thanh toán',
  'tuition.payment_reversed': 'Hoàn tác thanh toán',
  'tuition.discount_requested': 'Yêu cầu giảm học phí',
  'tuition.discount_approved': 'Duyệt giảm học phí',
  'tuition.discount_rejected': 'Từ chối giảm học phí',
  'grade.draft_saved': 'Lưu điểm nháp',
  'grade.published': 'Công bố điểm',
  'assignment.submitted': 'Nộp bài',
  'rubric.template_created': 'Tạo mẫu rubric',
  'rubric.template_updated': 'Cập nhật mẫu rubric',
}

const detailLabels: Record<string, string> = {
  assignment_id: 'Mã bài tập',
  submission_id: 'Mã bài nộp',
  version: 'Phiên bản',
  before: 'Trước',
  after: 'Sau',
  score: 'Điểm',
  status: 'Trạng thái',
}

export function describeAuditAction(action: string) {
  return actionLabels[action] ?? action.replace(/[._]/g, ' ')
}

export function parseAuditDetails(details: string | null) {
  if (!details) return []
  return details.split(';').map((part) => {
    const splitAt = part.indexOf('=')
    if (splitAt < 0) return { key: 'Chi tiết', value: part }
    const key = part.slice(0, splitAt)
    return { key: detailLabels[key] ?? key.replaceAll('_', ' '), value: part.slice(splitAt + 1) }
  })
}
