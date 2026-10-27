import assert from 'node:assert/strict'
import test from 'node:test'
import { isLandingPath } from '../src/navigation.ts'

test('public landing route is separate from login and authenticated routes', () => {
  assert.equal(isLandingPath('/'), true)
  assert.equal(isLandingPath(''), true)
  assert.equal(isLandingPath('/login'), false)
  assert.equal(isLandingPath('/dashboard'), false)
})
