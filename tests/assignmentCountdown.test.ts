import assert from 'node:assert/strict'
import test from 'node:test'
import { assignmentCountdown } from '../src/assignmentCountdown.ts'

test('assignment countdown interprets naive deadlines as ICTU local time', () => {
  const beforeDeadline = Date.parse('2026-10-23T02:00:00Z')
  assert.deepEqual(assignmentCountdown('2026-10-23T10:00:00', beforeDeadline), {
    state: 'remaining', label: 'Còn 1 giờ'
  })
})

test('assignment countdown reports the exact boundary without deciding submission policy', () => {
  const exact = Date.parse('2026-10-23T03:00:00Z')
  assert.equal(assignmentCountdown('2026-10-23T10:00:00+07:00', exact).state, 'due')
  assert.equal(assignmentCountdown('2026-10-23T10:00:00+07:00', exact + 1).state, 'overdue')
})

test('assignment countdown safely handles missing or malformed deadlines', () => {
  assert.equal(assignmentCountdown(null, 0).state, 'none')
  assert.equal(assignmentCountdown('bad date', 0).state, 'invalid')
})
