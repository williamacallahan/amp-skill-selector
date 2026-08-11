# Amp Skill Selector

Invoke installed Amp skills from Amp's native command palette or explicit skill references.

## Install

Clone the repository, then install it for every project on this machine:

```bash
git clone https://github.com/WilliamAGH/amp-skill-selector.git
mkdir -p ~/.config/amp/plugins
cp amp-skill-selector/.amp/plugins/skill-selector.ts ~/.config/amp/plugins/
```

To install it for one workspace instead, copy the plugin into that repository:

```bash
mkdir -p .amp/plugins
cp /path/to/amp-skill-selector/.amp/plugins/skill-selector.ts .amp/plugins/
```

Run `plugins: reload` from Amp's command palette after installation. Reload the plugin again after adding or removing skills so its generated commands match Amp's current skill inventory.

## Use the native command palette

Once a thread is active:

1. Open Amp's command palette with `Ctrl+O`.
2. Type part of a skill name, such as `ponytail` or `simplify`.
3. Select the matching `skills: <name>` command.
4. Submit the task that should use the skill.

The palette is Amp's native UI, including its filtering, scrolling, and keyboard behavior. A selection applies once to the active thread's next submitted message. On Amp's welcome screen there is no thread to attach a selection to, so use `$skill-name` for the first message.

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

Requires Node.js 22 or newer for TypeScript type stripping and the built-in test runner:

```bash
npm test
amp plugins exec .amp/plugins/skill-selector.ts agent.start \
  --data '{"thread":{"id":"T-00000000-0000-0000-0000-000000000000"},"message":"$ponytail reply ok","id":"test"}'
```
