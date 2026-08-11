# Amp Skill Selector

A plugin for [Amp](https://ampcode.com/install), Sourcegraph's agentic coding CLI. Invoke installed Amp skills from Amp's native command palette or explicit skill references.

## Install

The simplest way: paste this into any Amp thread and Amp installs it for you.

```text
Install the Amp skill-selector plugin: download
https://raw.githubusercontent.com/williamacallahan/amp-skill-selector/main/.amp/plugins/skill-selector.ts
to ~/.config/amp/plugins/skill-selector.ts, creating directories as needed, then reload plugins.
```

For a project-only install, change the destination to `.amp/plugins/skill-selector.ts` in the project root.

To install manually instead: Amp loads plugins from two standard directories, `~/.config/amp/plugins/` (system plugins, active in every project on the machine) and `.amp/plugins/` inside a repository (project plugins, active only there). The plugin is a single file — download it into either one.

User-level, for every project on this machine:

```bash
mkdir -p ~/.config/amp/plugins
curl -fsSL https://raw.githubusercontent.com/williamacallahan/amp-skill-selector/main/.amp/plugins/skill-selector.ts \
  -o ~/.config/amp/plugins/skill-selector.ts
```

Project-only, from the project's root — commit the file to share it with everyone working on that repository:

```bash
mkdir -p .amp/plugins
curl -fsSL https://raw.githubusercontent.com/williamacallahan/amp-skill-selector/main/.amp/plugins/skill-selector.ts \
  -o .amp/plugins/skill-selector.ts
```

Then run `plugins: reload` from Amp's command palette; `amp plugins list` confirms it is active. Re-run the download to update. Reload the plugin again after adding or removing skills so its generated commands match Amp's current skill inventory.

## Use the native command palette

Once a thread is active:

1. Open Amp's command palette with `Ctrl+O`.
2. Type part of a skill name, such as `ponytail` or `simplify`.
3. Select the matching `invoke skill: <name>` command.
4. Submit the task that should use the skill.

The palette is Amp's native UI, including its filtering, scrolling, and keyboard behavior. A selection applies once to the active thread's next submitted message. On Amp's welcome screen there is no thread to attach a selection to, so use `$skill-name` for the first message.

To discard a selection before submitting the next message, run
`invoke skill: cancel queued selection` from the palette.

Amp's built-in `skills: list` remains the read-only inventory view. The `invoke skill:`
commands are deliberately separate because Amp's public plugin API cannot extend that view.

Whenever Amp successfully loads a skill—from this selector, automatic model choice, another skill, or another plugin—the CLI shows a `Loaded skill: <name>` notification.

## Use a skill reference

| Form | Supported | Behavior |
| --- | --- | --- |
| `$skill-name` | Yes | Works anywhere, including as the first text in a new thread. |
| `/skill-name` after other text | Yes | Example: `Please /ponytail simplify this`. |
| `/skill-name` as the first text | No | Reserved for Amp's built-in commands. |
| `[$skill-name]`, `($skill-name)`, or `"/skill-name"` | Yes | Wrappers go around the complete reference. |
| `$[skill-name]` or `/[skill-name]` | No | Brackets cannot appear between the prefix and name. |
| References inside inline or fenced Markdown code | No | Ignored to avoid accidental invocation in examples and shell commands. |
| `/skill-name` that also names an existing path | No | A slash reference matching a file or directory in the workspace or at the filesystem root (for example `/test` in a repository with a `test/` directory) is treated as a path. Use `$skill-name` instead. |

`$` and embedded `/` references are matched after submission; they do not offer live autofill.
For searchable autocomplete, use the native command palette with `Ctrl+O` in an active thread.

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

This repository ships the plugin as its own project plugin at `.amp/plugins/skill-selector.ts`, so Amp loads it automatically while working here — no separate installation is needed.

Node.js 22 or newer is required for TypeScript type stripping and the built-in test runner:

```bash
npm test
amp plugins exec .amp/plugins/skill-selector.ts agent.start \
  --data '{"thread":{"id":"T-00000000-0000-0000-0000-000000000000"},"message":"$ponytail reply ok","id":"test"}'
```
