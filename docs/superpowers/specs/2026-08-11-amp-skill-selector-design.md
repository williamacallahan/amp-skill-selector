# Amp Skill Selector Design

## Goal

Provide a small Amp plugin that turns explicit skill references into real calls to Amp's built-in `skill` tool.

Supported entry points:

- `$skill-name task` anywhere in a submitted message.
- `/skill-name task` within a submitted message, except when `/` is its first character.
- A `skills: select` command-palette action that queues one installed skill for the next submitted message.

## Platform boundary

Amp's public plugin API does not expose composer text, cursor changes, argument completion, direct tool invocation, or a direct skill-loading API. Consequently:

- The plugin cannot open a completion UI while a prefix is being typed.
- A leading `/` remains entirely under Amp's built-in command handling.
- The plugin must not read and inject `SKILL.md` itself, because that would imitate rather than perform Amp's canonical skill invocation.
- The plugin will use `agent.start` to instruct the active agent to call Amp's built-in `skill` tool before doing other work. The resulting tool call is the real, visible invocation.

## Design

The plugin contains three responsibilities in one TypeScript file:

1. **Discover skills** by running Amp's canonical `amp skill list --json` command. Do not duplicate Amp's filesystem scanning or precedence rules.
2. **Select or resolve a skill** through Amp's native `ctx.ui.select` dialog or a submitted `$name`/embedded `/name` token. The native dialog owns scrolling and keyboard behavior.
3. **Request canonical invocation** by returning hidden `agent.start` context requiring the agent to call `skill({ name: "<name>" })` before any other action.

The command-palette selection is held in memory as a one-shot queued skill. The next `agent.start` consumes and clears it before returning invocation context. An explicit token in that same message takes precedence over the queue so user text wins; the stale queued selection is also cleared.

Token recognition is deliberately narrow:

- Skill names come from Amp's installed-skill inventory, so arbitrary `$words` and path fragments are ignored.
- `$` may begin the message.
- `/` must occur after the first character and at a token boundary.
- Only the first recognized explicit skill is invoked. Multi-skill orchestration remains ordinary prompt text rather than hidden plugin policy.

## Failure behavior

- If skill discovery fails, the palette command shows Amp's stderr or a concise fallback notification and does not queue anything.
- If no thread is active, selection reports that a thread is required.
- Cancellation leaves queued state unchanged only when the user never selected a replacement.
- Messages without a recognized skill add no context and preserve normal Amp behavior.
- Unknown sigil names are not intercepted because `$` and `/` are common text. Amp handles the original message normally.

## Verification

- Unit tests cover `$` at the start and within text, embedded `/`, excluded leading `/`, token boundaries, unknown names, explicit-over-queued precedence, and one-shot queue consumption.
- `amp plugins exec` exercises plugin loading and command registration where the CLI permits non-interactive execution.
- Manual verification in Amp confirms the command uses the native scrollable selector and that a selected or explicit skill produces the built-in `skill` tool call.

## Intentionally omitted

- Live composer autocomplete: unsupported by Amp's public API.
- Custom picker, fuzzy matcher, recents database, filesystem scanner, polling, dependencies, and experimental APIs: Amp's native UI and canonical inventory already own those concerns or the platform cannot safely support them.
