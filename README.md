# Amp Skill Selector

A plugin for [Amp](https://ampcode.com/install), Sourcegraph's agentic coding CLI. Invoke installed Amp skills from Amp's native command palette or explicit skill references.

## Install

The plugin is a single file. Download it into Amp's user-wide plugin directory:

```bash
mkdir -p ~/.config/amp/plugins
curl -fsSL https://raw.githubusercontent.com/williamacallahan/amp-skill-selector/main/.amp/plugins/skill-selector.ts \
  -o ~/.config/amp/plugins/skill-selector.ts
```

Then run `plugins: reload` from Amp's command palette. Re-run both steps to update. Reload the plugin again after adding or removing skills so its generated commands match Amp's current skill inventory.

## Use the native command palette

Once a thread is active:

1. Open Amp's command palette with `Ctrl+O`.
2. Type part of a skill name, such as `ponytail` or `simplify`.
3. Select the matching `invoke skill: <name>` command.
4. Submit the task that should use the skill.

The palette is Amp's native UI, including its filtering, scrolling, and keyboard behavior. A selection applies once to the active thread's next submitted message. On Amp's welcome screen there is no thread to attach a selection to, so use `$skill-name` for the first message.

Amp's built-in `skills: list` remains the read-only inventory view. The `invoke skill:`
commands are deliberately separate because Amp's public plugin API cannot extend that view.

Whenever Amp successfully loads a skill—from this selector, automatic model choice, another skill, or another plugin—the CLI shows a `Loaded skill: <name>` notification.

## Use a skill reference

Dollar-prefixed references work at the beginning or within a submitted message:

```text
$ponytail simplify this implementation
Please use $ce-simplify-code on the current changes
```

Slash-prefixed references work within a message:

```text
Please /ponytail simplify this implementation
```

A slash at the beginning is reserved for Amp's built-in commands, so `/ponytail` is not intercepted.

## How invocation works

Amp's public plugin API cannot call an agent tool directly. On message submission, this plugin adds a hidden instruction requiring the agent to call Amp's built-in `skill` tool with the selected installed skill. The visible tool call is Amp's canonical skill invocation; the plugin never reads or copies `SKILL.md` itself.

The public API also does not expose live composer text or completion hooks. Prefix lookup therefore occurs after submission, while autocomplete uses the native command palette.

## Develop

Clone the repository and symlink the plugin so your checkout is the live copy:

```bash
git clone https://github.com/williamacallahan/amp-skill-selector.git
cd amp-skill-selector
mkdir -p ~/.config/amp/plugins
ln -sf "$PWD/.amp/plugins/skill-selector.ts" ~/.config/amp/plugins/skill-selector.ts
```

While working inside this repository, Amp loads `.amp/plugins/skill-selector.ts` directly, so no separate installation is needed here.

Node.js 22 or newer is required for TypeScript type stripping and the built-in test runner:

```bash
npm test
amp plugins exec .amp/plugins/skill-selector.ts agent.start \
  --data '{"thread":{"id":"T-00000000-0000-0000-0000-000000000000"},"message":"$ponytail reply ok","id":"test"}'
```
