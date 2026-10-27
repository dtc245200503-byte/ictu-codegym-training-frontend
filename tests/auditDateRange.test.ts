import assert from 'node:assert/strict'
import test from 'node:test'
import { auditDateRange } from '../src/auditDateRange.ts'

test('audit date filters use inclusive Ho Chi Minh calendar days', () => {
  assert.deepEqual(auditDateRange('2026-10-22', '2026-10-22'), {
    fromDate: '2026-10-22T00:00:00+07:00',
    toDate: '2026-10-22T23:59:59.999999+07:00',
  })
})

test('audit date filters omit unset bounds', () => {
  assert.deepEqual(auditDateRange('', ''), { fromDate: null, toDate: null })
})
