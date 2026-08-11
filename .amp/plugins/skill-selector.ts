import type { PluginAPI } from '@ampcode/plugin'

export const description = 'Invoke installed skills from Amp’s native command palette or $name and embedded /name references.'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function findInvokedSkill(
  message: string,
  installedNames: readonly string[],
): string | undefined {
  if (installedNames.length === 0) return undefined

  const names = [...installedNames]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')
  const references = new RegExp(
    `(^|\\s)([$/])(${names})(?=$|[\\s.,!?;:])`,
    'g',
  )

  for (const match of message.matchAll(references)) {
    if (match[2] === '/' && match.index === 0) continue
    return match[3]
  }

  return undefined
}

export function invocationInstruction(name: string): string {
  return `The user explicitly invoked the ${JSON.stringify(name)} skill. Before any other action, call the built-in \`skill\` tool exactly once with ${JSON.stringify({ name })}, then follow the loaded skill instructions for this request.`
}

export default function skillSelector(_amp: PluginAPI) {}
