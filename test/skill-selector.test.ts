import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'

import skillSelector, {
  ANY_THREAD,
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

test('treats slash references that name existing paths as paths', () => {
  const isExistingPath = (name: string) => name === 'test'

  assert.equal(findInvokedSkill('check the /test directory', references, isExistingPath), undefined)
  assert.equal(findInvokedSkill('check /test then /ponytail this', references, isExistingPath), 'ponytail')
  assert.equal(findInvokedSkill('use $test here', references, isExistingPath), 'test')
})

test('recognizes references wrapped in quotes, parentheses, or brackets', () => {
  assert.equal(findInvokedSkill('use ($ponytail) here', references), 'ponytail')
  assert.equal(findInvokedSkill('use "$ponytail" here', references), 'ponytail')
  assert.equal(findInvokedSkill("use '$ponytail' here", references), 'ponytail')
  assert.equal(findInvokedSkill('use [$ponytail] here', references), 'ponytail')
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

test('threadless selections apply to the next message in any thread', () => {
  const queued = new Map([[ANY_THREAD, 'ponytail']])

  assert.equal(takeInvokedSkill('Simplify this', references, 'T-thread-9', queued), 'ponytail')
  assert.equal(queued.size, 0)
})

test('a thread-specific selection wins and the threadless one survives for its target', () => {
  const queued = new Map([
    ['T-thread-1' as const, 'ponytail'],
    [ANY_THREAD, 'ce-simplify-code'],
  ])

  assert.equal(takeInvokedSkill('Simplify this', references, 'T-thread-1', queued), 'ponytail')
  assert.equal(queued.has('T-thread-1'), false)
  assert.equal(queued.get(ANY_THREAD), 'ce-simplify-code')
})

test('a same-named selection from another source spares the threadless entry', () => {
  const queued = new Map([
    ['T-thread-1' as const, 'ponytail'],
    [ANY_THREAD, 'ponytail'],
  ])

  assert.equal(takeInvokedSkill('Simplify this', references, 'T-thread-1', queued), 'ponytail')
  assert.equal(queued.get(ANY_THREAD), 'ponytail')

  assert.equal(takeInvokedSkill('$ponytail go', references, 'T-thread-2', queued), 'ponytail')
  assert.equal(queued.get(ANY_THREAD), 'ponytail')
})

test('a previously seen thread does not consume a threadless pending selection', () => {
  const queued = new Map([[ANY_THREAD, 'ponytail']])
  const seen = new Set(['T-old' as const])

  assert.equal(
    takeInvokedSkill('Continue where we left off', references, 'T-old', queued, undefined, seen),
    undefined,
  )
  assert.equal(queued.get(ANY_THREAD), 'ponytail')

  assert.equal(
    takeInvokedSkill('First message', references, 'T-new', queued, undefined, seen),
    'ponytail',
  )
  assert.equal(queued.size, 0)
  assert.ok(seen.has('T-new'))
})

test('queues a welcome-screen selection without an active thread', async () => {
  const handlers = new Map<string, (event: unknown) => unknown>()
  const commands = new Map<string, (ctx: unknown) => Promise<void>>()
  const notices: string[] = []
  const amp = {
    $: () => Promise.resolve({
      exitCode: 0,
      stdout: JSON.stringify({
        skills: [{ name: 'ponytail', description: 'Prefer the simplest code.' }],
      }),
      stderr: '',
    }),
    logger: { log: () => undefined },
    registerCommand: (id: string, _options: unknown, handler: (ctx: unknown) => Promise<void>) => {
      commands.set(id, handler)
    },
    on: (event: string, handler: (event: unknown) => unknown) => handlers.set(event, handler),
    system: { workspaceRoot: null },
    helpers: { filePathFromURI: () => '' },
  }

  skillSelector(amp as never)
  await setImmediate()

  const invoke = commands.get('invoke-ponytail')
  assert.ok(invoke)
  await invoke({ ui: { notify: async (message: string) => { notices.push(message) } } })
  assert.match(String(notices[0]), /ponytail/)
  assert.doesNotMatch(String(notices[0]), /open a thread/i)

  const agentStart = handlers.get('agent.start')
  assert.ok(agentStart)
  const invoked = await agentStart({ thread: { id: 'T-brand-new' }, message: 'Simplify this', id: 'm-1' })
  assert.match(
    String((invoked as { message?: { content?: string } })?.message?.content),
    /"name":"ponytail"/,
  )
})

test('cancelling from a thread also clears a threadless pending selection', async () => {
  const handlers = new Map<string, (event: unknown) => unknown>()
  const commands = new Map<string, (ctx: unknown) => Promise<void>>()
  const notices: string[] = []
  const amp = {
    $: () => Promise.resolve({
      exitCode: 0,
      stdout: JSON.stringify({
        skills: [{ name: 'ponytail', description: 'Prefer the simplest code.' }],
      }),
      stderr: '',
    }),
    logger: { log: () => undefined },
    registerCommand: (id: string, _options: unknown, handler: (ctx: unknown) => Promise<void>) => {
      commands.set(id, handler)
    },
    on: (event: string, handler: (event: unknown) => unknown) => handlers.set(event, handler),
    system: { workspaceRoot: null },
    helpers: { filePathFromURI: () => '' },
  }

  skillSelector(amp as never)
  await setImmediate()

  const notify = async (message: string) => { notices.push(message) }
  await commands.get('invoke-ponytail')?.({ ui: { notify } })
  await commands.get('cancel-queued-skill')?.({ ui: { notify }, thread: { id: 'T-thread-1' } })
  assert.match(String(notices[1]), /Cancelled queued skill: ponytail/)

  const invoked = await handlers.get('agent.start')?.({
    thread: { id: 'T-thread-1' },
    message: 'Simplify this',
    id: 'm-1',
  })
  assert.equal(invoked, undefined)
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
    system: { workspaceRoot: null },
    helpers: { filePathFromURI: () => '' },
  }

  skillSelector(amp as never)
  await setImmediate()

  assert.equal(logs[0]?.[0], 'Unable to register skill commands:')
  assert.match(String(logs[0]?.[1]), /registration failed/)
})

test('resolves path collisions against the workspace root, not the process cwd', async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'skill-selector-'))
  mkdirSync(join(workspace, 'ponytail'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))

  const handlers = new Map<string, (event: unknown) => unknown>()
  const amp = {
    $: () => Promise.resolve({
      exitCode: 0,
      stdout: JSON.stringify({
        skills: [{ name: 'ponytail', description: 'Prefer the simplest code.' }],
      }),
      stderr: '',
    }),
    logger: { log: () => undefined },
    registerCommand: () => undefined,
    on: (event: string, handler: (event: unknown) => unknown) => handlers.set(event, handler),
    system: { workspaceRoot: 'uri:workspace' },
    helpers: { filePathFromURI: (uri: unknown) => (uri === 'uri:workspace' ? workspace : '') },
  }

  skillSelector(amp as never)
  const agentStart = handlers.get('agent.start')
  assert.ok(agentStart)

  assert.equal(
    await agentStart({ thread: { id: 'T-thread-1' }, message: 'use /ponytail here', id: 'm-1' }),
    undefined,
  )

  const invoked = await agentStart({ thread: { id: 'T-thread-1' }, message: 'use $ponytail here', id: 'm-2' })
  assert.match(
    String((invoked as { message?: { content?: string } })?.message?.content),
    /"name":"ponytail"/,
  )
})
