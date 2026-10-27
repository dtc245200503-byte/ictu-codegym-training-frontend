import assert from 'node:assert/strict'
import test from 'node:test'
import { paginationFromHeaders } from '../src/pagination.ts'

test('pagination reads backend header metadata for bare array responses', () => {
  const headers = new Headers({
    'X-Current-Page': '3', 'X-Page-Size': '20', 'X-Total-Count': '45',
    'X-Total-Pages': '3', 'X-Has-Previous': 'true', 'X-Has-Next': 'false',
  })
  assert.deepEqual(paginationFromHeaders(headers, { page: 1, pageSize: 20 }), {
    page: 3, pageSize: 20, total: 45, pages: 3, hasPrevious: true, hasNext: false,
  })
})

test('pagination uses safe fallback when a response has no pagination headers', () => {
  assert.deepEqual(paginationFromHeaders(new Headers(), { page: 2, pageSize: 10, total: 21 }), {
    page: 2, pageSize: 10, total: 21, pages: 3, hasPrevious: true, hasNext: true,
  })
})
