import assert from 'node:assert/strict'
import test from 'node:test'
import { describeAuditAction, parseAuditDetails } from '../src/auditPresentation.ts'

test('audit action names are presented in Vietnamese with a safe fallback', () => {
  assert.equal(describeAuditAction('grade.published'), 'Công bố điểm')
  assert.equal(describeAuditAction('unknown_action'), 'unknown action')
})

test('audit details are decoded for display without losing raw values', () => {
  assert.deepEqual(parseAuditDetails('assignment_id=3;before=draft;after=published;version=2'), [
    { key: 'Mã bài tập', value: '3' },
    { key: 'Trước', value: 'draft' },
    { key: 'Sau', value: 'published' },
    { key: 'Phiên bản', value: '2' },
  ])
  assert.deepEqual(parseAuditDetails(null), [])
})
