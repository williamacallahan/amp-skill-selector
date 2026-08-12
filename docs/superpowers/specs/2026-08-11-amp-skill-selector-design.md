# Amp Skill Selector Design

## Goal

Provide a small Amp plugin that turns explicit skill references into real calls to Amp's built-in `skill` tool.

Supported entry points:

- `$skill-name task` anywhere in a submitted message.
- `/skill-name task` within a submitted message, except when `/` is its first character.
- One native `invoke skill: <name>` command-palette action per installed skill. Amp's palette provides typed filtering, scrolling, and keyboard selection; choosing a command queues that skill for the next submitted message.

## Platform boundary

Amp's public plugin API does not expose composer text, cursor changes, argument completion, direct tool invocation, or a direct skill-loading API. Consequently:

- The plugin cannot open a completion UI in the composer while a prefix is being typed. Skill-name autocomplete instead uses Amp's native command palette.
- A leading `/` remains entirely under Amp's built-in command handling.
- The plugin must not read and inject `SKILL.md` itself, because that would imitate rather than perform Amp's canonical skill invocation.
- The plugin will use `agent.start` to instruct the active agent to call Amp's built-in `skill` tool before doing other work. The resulting tool call is the real, visible invocation.

## Design

The plugin contains three responsibilities in one TypeScript file:

1. **Discover skills** by running Amp's canonical `amp skill list --json` command. Do not duplicate Amp's filesystem scanning or precedence rules.
2. **Select or resolve a skill** by registering every installed skill as a native command-palette command and by recognizing submitted `$name`/embedded `/name` tokens. The native palette owns autocomplete, scrolling, and keyboard behavior.
3. **Request canonical invocation** by returning hidden `agent.start` context requiring the agent to call `skill({ name: "<name>" })` before any other action.

A command-palette selection with an active thread invokes immediately: the plugin appends a visible, plugin-attributed user message instructing the agent to make the canonical `skill` tool call, so no follow-up submission is needed. A selection made with no active thread (Amp's welcome screen) is held under a reserved any-thread key and consumed only by the first message of a thread the plugin has not yet seen an agent turn from — typically the thread that first message creates. Threads that already had a turn in this plugin process never consume it; a thread resumed after a plugin reload counts as unseen, which is the accepted residual. The threadless entry is cleared only when consumed or explicitly cancelled. The next `agent.start` for a thread consumes and clears that thread's own queue before returning invocation context. An explicit token in that same message takes precedence over the queue so user text wins; the thread's stale queued selection is also cleared.

The native `invoke skill: cancel queued selection` command lets the active thread discard a selection before submitting another message.

The command inventory is generated when the plugin loads. After installing or removing skills, the user runs Amp's existing `plugins: reload` action to refresh palette commands.

Token recognition is deliberately narrow:

- Skill names come from Amp's installed-skill inventory, so arbitrary `$words` and path fragments are ignored.
- `$` may begin the message.
- `/` must occur after the first character and at a token boundary.
- Quotes and brackets may surround a reference.
- References inside inline or fenced Markdown code are ignored.
- An embedded `/name` that also names an existing file or directory (workspace-relative or at the filesystem root) is treated as a path, not a skill reference.
- Only the first recognized explicit skill is invoked. Multi-skill orchestration remains ordinary prompt text rather than hidden plugin policy.

## Failure behavior

- If skill discovery fails, the plugin logs a concise error and registers no skill commands.
- If no thread is active, the selection queues for the next submitted message in any thread.
- Messages without a recognized skill add no context and preserve normal Amp behavior.
- Unknown sigil names are not intercepted because `$` and `/` are common text. Amp handles the original message normally.

## Verification

- Unit tests cover `$` at the start and within text, embedded `/`, excluded leading `/`, token boundaries, unknown names, explicit-over-queued precedence, and one-shot queue consumption.
- `amp plugins exec` exercises plugin loading and command registration where the CLI permits non-interactive execution.
- Manual verification in Amp confirms typing a partial skill name filters native palette commands and that a selected or explicit skill produces the built-in `skill` tool call.

## Intentionally omitted

- Live composer autocomplete: unsupported by Amp's public API; the native command palette supplies autocomplete instead.
- Custom picker, fuzzy matcher, recents database, filesystem scanner, polling, dependencies, and experimental APIs: Amp's native command palette and canonical inventory already own those concerns or the platform cannot safely support them.
