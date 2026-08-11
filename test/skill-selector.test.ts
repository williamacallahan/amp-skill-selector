import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'

import skillSelector, {
  cancelQueuedSkill,
  createSkillReferenceMatcher,
  findInvokedSkill,
  invocationInstruction,
  loadedSkillName,
  parseSkillInventory,
  takeInvokedSkill,
} from '../.amp/plugins/skill-selector.ts'

const skills = ['ponytail', 'ce-simplify-code', 'test']
const references = createSkillReferenceMatcher(skills)

test('finds dollar-prefixed skills at the start or within a message', () => {
  assert.equal(findInvokedSkill('$ponytail simplify this', references), 'ponytail')
  assert.equal(findInvokedSkill('Please use $ce-simplify-code here', references), 'ce-simplify-code')
})

test('finds embedded slash-prefixed skills but reserves a leading slash', () => {
  assert.equal(findInvokedSkill('Please /ponytail simplify this', references), 'ponytail')
  assert.equal(findInvokedSkill('/ponytail simplify this', references), undefined)
})

test('recognizes punctuation boundaries without matching unknown or partial names', () => {
  assert.equal(findInvokedSkill('Use $test, then report.', references), 'test')
  assert.equal(findInvokedSkill('Use ($ponytail).', references), 'ponytail')
  assert.equal(findInvokedSkill('Use "/ponytail".', references), 'ponytail')
  assert.equal(findInvokedSkill('Use $testing here', references), undefined)
  assert.equal(findInvokedSkill('The price is $testable.', references), undefined)
  assert.equal(findInvokedSkill('The variable is $test_value.', references), undefined)
  assert.equal(findInvokedSkill('Path/test is not a skill token', references), undefined)
})

test('ignores references inside fenced code', () => {
  assert.equal(findInvokedSkill('```sh\n$test command\n```', references), undefined)
  assert.equal(findInvokedSkill('~~~sh\n/test command\n~~~', references), undefined)
  assert.equal(
    findInvokedSkill('```sh\n$test command\n```\nUse $ponytail', references),
    'ponytail',
  )
})

test('ignores references inside inline code', () => {
  assert.equal(findInvokedSkill('Run `echo $test`.', references), undefined)
  assert.equal(findInvokedSkill('Run ``echo /test``.', references), undefined)
  assert.equal(findInvokedSkill('Mention `$test`, then use $ponytail.', references), 'ponytail')
  assert.equal(findInvokedSkill('Literal \\` then use $ponytail.', references), 'ponytail')
})

test('returns the first invoked skill in message order', () => {
  assert.equal(findInvokedSkill('$test then $ponytail', references), 'test')
})

test('builds an explicit canonical skill-tool instruction', () => {
  const instruction = invocationInstruction('ponytail')

  assert.match(instruction, /built-in `skill` tool/)
  assert.match(instruction, /"name":"ponytail"/)
  assert.match(instruction, /before any other action/i)
})

test('parses Amp canonical skill inventory', () => {
  assert.deepEqual(
    parseSkillInventory(JSON.stringify({
      skills: [{ name: 'ponytail', description: 'Prefer the simplest code.' }],
      errors: [],
    })),
    [{ name: 'ponytail', description: 'Prefer the simplest code.' }],
  )
  assert.throws(() => parseSkillInventory('{"skills":"invalid"}'), /invalid skill inventory/i)
})

test('explicit references override and consume a queued palette selection', () => {
  const queued = new Map([['T-thread-1' as const, 'ce-simplify-code']])

  assert.equal(
    takeInvokedSkill('$ponytail simplify this', references, 'T-thread-1', queued),
    'ponytail',
  )
  assert.equal(queued.has('T-thread-1'), false)
})

test('queued selections are one-shot and isolated by thread', () => {
  const queued = new Map([
    ['T-thread-1' as const, 'ponytail'],
    ['T-thread-2' as const, 'ce-simplify-code'],
  ])

  assert.equal(takeInvokedSkill('Simplify this', references, 'T-thread-1', queued), 'ponytail')
  assert.equal(takeInvokedSkill('Again', references, 'T-thread-1', queued), undefined)
  assert.equal(queued.get('T-thread-2'), 'ce-simplify-code')
})

test('cancels only the active thread queued selection', () => {
  const queued = new Map([
    ['T-thread-1' as const, 'ponytail'],
    ['T-thread-2' as const, 'ce-simplify-code'],
  ])

  assert.equal(cancelQueuedSkill('T-thread-1', queued), 'ponytail')
  assert.equal(cancelQueuedSkill('T-thread-1', queued), undefined)
  assert.equal(queued.get('T-thread-2'), 'ce-simplify-code')
})

test('reports the name only after a successful built-in skill result', () => {
  assert.equal(
    loadedSkillName({ tool: 'skill', status: 'done', input: { name: 'ponytail' } }),
    'ponytail',
  )
  assert.equal(
    loadedSkillName({ tool: 'skill', status: 'error', input: { name: 'ponytail' } }),
    undefined,
  )
  assert.equal(
    loadedSkillName({ tool: 'shell_command', status: 'done', input: { name: 'ponytail' } }),
    undefined,
  )
  assert.equal(
    loadedSkillName({ tool: 'skill', status: 'done', input: { name: 42 } }),
    undefined,
  )
})

test('logs command registration failures', async () => {
  const logs: unknown[][] = []
  const amp = {
    $: () => Promise.resolve({
      exitCode: 0,
      stdout: JSON.stringify({
        skills: [{ name: 'ponytail', description: 'Prefer the simplest code.' }],
      }),
      stderr: '',
    }),
    logger: { log: (...args: unknown[]) => logs.push(args) },
    registerCommand: () => { throw new Error('registration failed') },
    on: () => undefined,
  }

  skillSelector(amp as never)
  await setImmediate()

  assert.equal(logs[0]?.[0], 'Unable to register skill commands:')
  assert.match(String(logs[0]?.[1]), /registration failed/)
})
