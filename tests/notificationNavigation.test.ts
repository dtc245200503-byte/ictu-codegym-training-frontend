import assert from 'node:assert/strict'
import test from 'node:test'
import {
  openNotificationWithPreflight,
  type NotificationApiRequest,
  type NotificationTarget,
} from '../src/notificationNavigation.ts'

function makeActions(apiRequest: NotificationApiRequest) {
  const calls: string[] = []
  return {
    calls,
    actions: {
      apiRequest,
      markRead: async () => { calls.push('mark-read'); return true },
      onOpen: (path: string) => { calls.push(`open:${path}`) },
    },
  }
}

test('assignment preflight keeps class filter, marks read, then opens filtered list', async () => {
  const { calls, actions } = makeActions(async <T,>(path: string) => {
    calls.push(path)
    return { items: [{ id: 12 }] } as T
  })

  const opened = await openNotificationWithPreflight(
    { class_id: 31, lead_id: null, title: 'Bài tập mới' },
    actions,
  )

  assert.equal(opened, 'opened')
  assert.deepEqual(calls, [
    '/assignments?class_id=31&page=1&page_size=1',
    'mark-read',
    'open:/assignments?class_id=31',
  ])
})

for (const status of [403, 404]) {
  test(`failed class preflight ${status} stays in inbox and does not mark read`, async () => {
    const calls: string[] = []
    const apiRequest: NotificationApiRequest = async (path) => {
      calls.push(path)
      throw Object.assign(new Error('denied'), { status })
    }
    const { actions } = makeActions(apiRequest)
    actions.markRead = async () => { calls.push('mark-read'); return true }
    actions.onOpen = (path) => { calls.push(`open:${path}`) }

    await assert.rejects(
      openNotificationWithPreflight(
        { class_id: 31, lead_id: null, title: 'Bài tập mới' },
        actions,
      ),
    )
    assert.deepEqual(calls, ['/assignments?class_id=31&page=1&page_size=1'])
  })
}

test('missing or invalid target metadata does not request, mark read, or invent a route', async () => {
  for (const notification of [
    { class_id: null, lead_id: null, title: 'Notice' },
    { class_id: 0, lead_id: null, title: 'Bài tập mới' },
    { class_id: Number.NaN, lead_id: null, title: 'Bài tập mới' },
    { class_id: 31, lead_id: 9, title: 'Notice' },
  ] as NotificationTarget[]) {
    const calls: string[] = []
    const { actions } = makeActions(async <T,>() => ({ items: [] } as T))
    actions.markRead = async () => { calls.push('mark-read'); return true }
    actions.onOpen = (path) => { calls.push(`open:${path}`) }
    actions.apiRequest = async (path) => { calls.push(path); return { items: [] } as never }

    assert.equal(await openNotificationWithPreflight(notification, actions), 'unavailable')
    assert.deepEqual(calls, [])
  }
})

test('assignment with no visible task stays unread in the inbox', async () => {
  const calls: string[] = []
  const { actions } = makeActions(async <T,>(path: string) => {
    calls.push(path)
    return { items: [] } as T
  })
  actions.markRead = async () => { calls.push('mark-read'); return true }
  actions.onOpen = (path) => { calls.push(`open:${path}`) }

  assert.equal(
    await openNotificationWithPreflight(
      { class_id: 31, lead_id: null, title: 'Bài tập mới' },
      actions,
    ),
    'unavailable',
  )
  assert.deepEqual(calls, ['/assignments?class_id=31&page=1&page_size=1'])
})

test('lead notification keeps detail route and existing preflight before mark read', async () => {
  const { calls, actions } = makeActions(async <T,>(path: string) => {
    calls.push(path)
    return { id: 44 } as T
  })

  const opened = await openNotificationWithPreflight(
    { class_id: null, lead_id: 44, title: 'Lead được giao cho bạn' },
    actions,
  )

  assert.equal(opened, 'opened')
  assert.deepEqual(calls, ['/leads/44', 'mark-read', 'open:/leads/44'])
})

test('absence notification preflights the visible class and attendance history', async () => {
  const { calls, actions } = makeActions(async <T,>(path: string) => {
    calls.push(path)
    if (path === '/classes') return [{ id: 31 }] as T
    return { items: [] } as T
  })

  const opened = await openNotificationWithPreflight(
    { class_id: 31, lead_id: null, title: 'Đơn xin vắng đã được xử lý' },
    actions,
  )

  assert.equal(opened, 'opened')
  assert.deepEqual(calls, [
    '/classes',
    '/students/me/attendance-history?class_id=31&page=1&page_size=1',
    'mark-read',
    'open:/my/attendance?class_id=31',
  ])
})

test('other class notifications preflight visibility before opening schedule list', async () => {
  const { calls, actions } = makeActions(async <T,>(path: string) => {
    calls.push(path)
    return [{ id: 31 }] as T
  })

  const opened = await openNotificationWithPreflight(
    { class_id: 31, lead_id: null, title: 'Cập nhật tình trạng ghi danh' },
    actions,
  )

  assert.equal(opened, 'opened')
  assert.deepEqual(calls, [
    '/classes',
    'mark-read',
    'open:/schedule?class_id=31',
  ])
})
