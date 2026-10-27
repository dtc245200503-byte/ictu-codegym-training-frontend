export type NotificationTarget = {
  class_id: number | null
  lead_id: number | null
  title: string
}

export type NotificationApiRequest = <T>(path: string) => Promise<T>

type OpenActions = {
  apiRequest: NotificationApiRequest
  markRead: () => Promise<boolean>
  onOpen: (path: string) => void
}

function isValidId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

export async function preflightNotification(
  notification: NotificationTarget,
  apiRequest: NotificationApiRequest,
): Promise<string | null> {
  const hasClassId = notification.class_id !== null
  const hasLeadId = notification.lead_id !== null
  if (hasClassId === hasLeadId) return null

  if (hasClassId) {
    if (!isValidId(notification.class_id)) return null
    const classId = notification.class_id
    const classPath = `/schedule?class_id=${classId}`

    if (notification.title === 'Bài tập mới') {
      const params = new URLSearchParams({
        class_id: String(classId),
        page: '1',
        page_size: '1',
      })
      const assignments = await apiRequest<{ items: Array<{ id: number }> }>(
        `/assignments?${params.toString()}`,
      )
      return assignments.items.length ? `/assignments?class_id=${classId}` : null
    }

    const visibleClasses = await apiRequest<Array<{ id: number }>>('/classes')
    if (!visibleClasses.some((trainingClass) => trainingClass.id === classId)) return null

    if (notification.title === 'Đơn xin vắng đã được xử lý') {
      await apiRequest(
        `/students/me/attendance-history?class_id=${classId}&page=1&page_size=1`,
      )
      return `/my/attendance?class_id=${classId}`
    }

    return classPath
  }

  if (!isValidId(notification.lead_id)) return null
  await apiRequest(`/leads/${notification.lead_id}`)
  return `/leads/${notification.lead_id}`
}

export async function openNotificationWithPreflight(
  notification: NotificationTarget,
  actions: OpenActions,
): Promise<'opened' | 'unavailable' | 'read_failed'> {
  const path = await preflightNotification(notification, actions.apiRequest)
  if (!path) return 'unavailable'
  if (!(await actions.markRead())) return 'read_failed'
  actions.onOpen(path)
  return 'opened'
}
