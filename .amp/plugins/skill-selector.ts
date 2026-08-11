import type { PluginAPI, ThreadID } from '@ampcode/plugin'

export const description = 'Invoke installed skills from Amp’s native command palette or $name and embedded /name references.'

interface Skill {
  name: string
  description: string
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function createSkillReferenceMatcher(
  installedNames: readonly string[],
): RegExp | undefined {
  if (installedNames.length === 0) return undefined

  const names = installedNames.map(escapeRegExp).join('|')
  return new RegExp(
    `(^|\\s)([$/])(${names})(?=$|[\\s.,!?;:])`,
    'g',
  )
}

export function findInvokedSkill(
  message: string,
  references: RegExp | undefined,
): string | undefined {
  if (!references) return undefined

  for (const match of message.matchAll(references)) {
    if (match[2] === '/' && match.index === 0) continue
    return match[3]
  }

  return undefined
}

export function invocationInstruction(name: string): string {
  return `The user explicitly invoked the ${JSON.stringify(name)} skill. Before any other action, call the built-in \`skill\` tool exactly once with ${JSON.stringify({ name })}, then follow the loaded skill instructions for this request.`
}

export function parseSkillInventory(json: string): Skill[] {
  const inventory: unknown = JSON.parse(json)
  if (
    typeof inventory !== 'object'
    || inventory === null
    || !Array.isArray((inventory as { skills?: unknown }).skills)
  ) {
    throw new Error('Invalid skill inventory from Amp')
  }

  const skills = (inventory as { skills: unknown[] }).skills
  if (!skills.every((skill) => (
    typeof skill === 'object'
    && skill !== null
    && typeof (skill as Partial<Skill>).name === 'string'
    && typeof (skill as Partial<Skill>).description === 'string'
  ))) {
    throw new Error('Invalid skill inventory from Amp')
  }

  return skills as Skill[]
}

export function takeInvokedSkill(
  message: string,
  references: RegExp | undefined,
  threadID: ThreadID,
  queued: Map<ThreadID, string>,
): string | undefined {
  const explicit = findInvokedSkill(message, references)
  const selected = explicit ?? queued.get(threadID)
  queued.delete(threadID)
  return selected
}

export default function skillSelector(amp: PluginAPI) {
  const queued = new Map<ThreadID, string>()
  const inventoryPromise = amp.$`amp skill list --json`
    .then((result) => {
      if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || `amp skill list exited ${result.exitCode}`)
      }
      const skills = parseSkillInventory(result.stdout)
      return {
        skills,
        references: createSkillReferenceMatcher(skills.map((skill) => skill.name)),
      }
    })
    .catch((error) => {
      amp.logger.log('Unable to load skills:', error)
      return { skills: [], references: undefined }
    })

  void inventoryPromise.then(({ skills }) => {
    for (const skill of skills) {
      amp.registerCommand(
        `invoke-${skill.name}`,
        {
          title: skill.name,
          category: 'skills',
          description: skill.description,
        },
        async (ctx) => {
          if (!ctx.thread) {
            await ctx.ui.notify('Open a thread before selecting a skill.')
            return
          }

          queued.set(ctx.thread.id, skill.name)
          await ctx.ui.notify(`Queued skill for your next message: ${skill.name}`)
        },
      )
    }
  })

  amp.on('agent.start', async (event) => {
    const { references } = await inventoryPromise
    const name = takeInvokedSkill(
      event.message,
      references,
      event.thread.id,
      queued,
    )

    if (!name) return
    return { message: { content: invocationInstruction(name) } }
  })
}
