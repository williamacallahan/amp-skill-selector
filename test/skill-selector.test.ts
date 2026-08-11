import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findInvokedSkill,
  invocationInstruction,
} from '../.amp/plugins/skill-selector.ts'

const skills = ['ponytail', 'ce-simplify-code', 'test']

test('finds dollar-prefixed skills at the start or within a message', () => {
  assert.equal(findInvokedSkill('$ponytail simplify this', skills), 'ponytail')
  assert.equal(findInvokedSkill('Please use $ce-simplify-code here', skills), 'ce-simplify-code')
})

test('finds embedded slash-prefixed skills but reserves a leading slash', () => {
  assert.equal(findInvokedSkill('Please /ponytail simplify this', skills), 'ponytail')
  assert.equal(findInvokedSkill('/ponytail simplify this', skills), undefined)
})

test('recognizes punctuation boundaries without matching unknown or partial names', () => {
  assert.equal(findInvokedSkill('Use $test, then report.', skills), 'test')
  assert.equal(findInvokedSkill('Use $testing here', skills), undefined)
  assert.equal(findInvokedSkill('The price is $testable.', skills), undefined)
  assert.equal(findInvokedSkill('Path/test is not a skill token', skills), undefined)
})

test('returns the first invoked skill in message order', () => {
  assert.equal(findInvokedSkill('$test then $ponytail', skills), 'test')
})

test('builds an explicit canonical skill-tool instruction', () => {
  const instruction = invocationInstruction('ponytail')

  assert.match(instruction, /built-in `skill` tool/)
  assert.match(instruction, /"name":"ponytail"/)
  assert.match(instruction, /before any other action/i)
})
