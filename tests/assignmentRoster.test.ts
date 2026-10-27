import assert from 'node:assert/strict'
import test from 'node:test'
import { filterAssignmentRoster, summarizeAssignmentRoster } from '../src/assignmentRoster.ts'

const roster = [
  { student_id: 7, student_code: 'SV007', full_name: 'Lan Nguyen', status: 'submitted' as const },
  { student_id: 8, student_code: 'SV008', full_name: 'Minh Tran', status: 'not_submitted' as const },
]

test('assignment roster filters by current submission state and learner search', () => {
  assert.deepEqual(filterAssignmentRoster(roster, '', 'not_submitted').map((row) => row.student_id), [8])
  assert.deepEqual(filterAssignmentRoster(roster, 'sv007', 'all').map((row) => row.student_id), [7])
  assert.deepEqual(filterAssignmentRoster(roster, 'unknown', 'all'), [])
})

test('assignment roster supports the server status vocabulary used by the grading roster', () => {
  const states = [
    { student_id: 1, student_code: 'S1', full_name: 'A', status: 'not_submitted' as const },
    { student_id: 2, student_code: 'S2', full_name: 'B', status: 'not_graded' as const },
    { student_id: 3, student_code: 'S3', full_name: 'C', status: 'graded' as const },
    { student_id: 4, student_code: 'S4', full_name: 'D', status: 'late' as const },
  ]
  for (const status of ['not_submitted', 'not_graded', 'graded', 'late'] as const) {
    assert.deepEqual(filterAssignmentRoster(states, '', status).map((row) => row.status), [status])
  }
  assert.deepEqual(filterAssignmentRoster(states, 's3', 'all').map((row) => row.student_id), [3])
})

test('assignment roster summary reports actual submitted and missing counts', () => {
  assert.deepEqual(summarizeAssignmentRoster(roster), {
    submitted: 1, notSubmitted: 1, total: 2, ratio: 0.5,
  })
  assert.deepEqual(summarizeAssignmentRoster([]), {
    submitted: 0, notSubmitted: 0, total: 0, ratio: 0,
  })
})
