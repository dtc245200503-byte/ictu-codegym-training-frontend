import assert from 'node:assert/strict'
import test from 'node:test'
import { formatHoChiMinhDateTime, hoChiMinhDate } from '../src/attendanceExportDate.ts'

test('formats XLSX export date in Ho Chi Minh timezone across UTC midnight', () => {
  assert.equal(hoChiMinhDate(new Date('2026-10-21T16:59:59.000Z')), '2026-10-21')
  assert.equal(hoChiMinhDate(new Date('2026-10-21T17:00:00.000Z')), '2026-10-22')
})

test('formats naive assignment deadlines as ICTU local time independent of machine timezone', () => {
  assert.equal(formatHoChiMinhDateTime('2026-10-21T17:05:00'), '21/10/2026 17:05')
})

test('formats UTC assignment deadlines as Ho Chi Minh local time', () => {
  assert.equal(formatHoChiMinhDateTime('2026-10-21T10:05:00Z'), '21/10/2026 17:05')
})
