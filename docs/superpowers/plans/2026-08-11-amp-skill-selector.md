# Amp Skill Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and dogfood a dependency-free Amp plugin that exposes installed skills in Amp's native command palette and converts explicit skill selection into a real built-in `skill` tool invocation.

**Architecture:** A single project-local TypeScript plugin obtains Amp's canonical JSON skill inventory, registers one native command per skill, tracks one queued selection per thread, and recognizes `$name` or embedded `/name` in submitted prompts. An `agent.start` result instructs the agent to make the canonical tool call; it never copies skill files or uses private UI APIs.

**Tech Stack:** Amp Plugin API, TypeScript supported by Amp/Bun, Node.js built-in test runner for pure parsing tests, Herdr for interactive TUI dogfooding.

## Global Constraints

- Use only Amp's public, non-experimental Plugin API.
- Add no runtime dependencies, custom picker, filesystem scanner, fuzzy matcher, polling, or persistent recents.
- Reserve a leading `/` for Amp's built-in command behavior.
- Skill invocation must remain a visible built-in `skill` tool call, never copied `SKILL.md` content.
- Keep implementation ponytail- and ce-simplify-code-compliant: canonical platform APIs, minimal files, and no speculative abstractions.

---

### Task 1: Pure skill-reference resolution

**Files:**
- Create: `.amp/plugins/skill-selector.ts`
- Create: `test/skill-selector.test.ts`
- Create: `package.json`

**Interfaces:**
- Produces: `findInvokedSkill(message: string, installedNames: readonly string[]): string | undefined`
- Produces: `invocationInstruction(name: string): string`
- Consumes: installed skill names returned by `amp skill list --json`

- [ ] **Step 1: Write failing parser and instruction tests**

Cover `$ponytail` at the beginning and in text, embedded `/ponytail`, excluded leading `/ponytail`, punctuation boundaries, unknown names, first-match ordering, and an instruction that explicitly names the built-in `skill` tool and selected skill.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL because `.amp/plugins/skill-selector.ts` does not exist.

- [ ] **Step 3: Implement the minimal exported pure functions**

Build one escaped alternation from installed names ordered longest-first. Match only whitespace/start-delimited `$` or `/` tokens, reject `/` when it begins the message, and require end/whitespace/punctuation after the skill name. Return the first recognized skill in message order.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all parser and instruction tests PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json test/skill-selector.test.ts .amp/plugins/skill-selector.ts
git commit -m "test: define skill invocation syntax"
```

### Task 2: Native palette commands and canonical invocation

**Files:**
- Modify: `.amp/plugins/skill-selector.ts`
- Modify: `test/skill-selector.test.ts`

**Interfaces:**
- Consumes: `PluginAPI.$`, `PluginAPI.registerCommand`, `PluginAPI.on('agent.start', ...)`
- Produces: native commands with category `skills` and each installed skill name as the title
- Produces: a one-shot `Map<ThreadID, string>` queue consumed by the matching thread's next `agent.start`

- [ ] **Step 1: Add tests for JSON inventory parsing and one-shot selection resolution**

Test `{ "skills": [{ "name": "ponytail", "description": "..." }] }`, malformed inventory rejection, explicit-token precedence over a queued command, matching-thread consumption, and isolation between thread IDs.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL because inventory parsing and queue resolution are absent.

- [ ] **Step 3: Implement plugin registration**

At plugin load, start one canonical `amp skill list --json` request. Parse and validate skill entries; register `skills: <name>` commands whose handlers require an active thread, queue by its ID, and notify the user. Await the same inventory in `agent.start`, resolve explicit text before queued state, consume the queue before returning, and return hidden canonical invocation instructions only when a skill was selected.

- [ ] **Step 4: Run automated verification**

Run:

```bash
npm test
amp plugins exec .amp/plugins/skill-selector.ts agent.start \
  --data '{"thread":{"id":"T-00000000-0000-0000-0000-000000000000"},"message":"$ponytail reply ok","id":"test"}'
```

Expected: tests PASS; Amp loads the plugin without registration or runtime errors and returns invocation context naming `ponytail`.

- [ ] **Step 5: Commit**

```bash
git add .amp/plugins/skill-selector.ts test/skill-selector.test.ts
git commit -m "feat: invoke skills from Amp palette"
```

### Task 3: Installation documentation and live dogfood

**Files:**
- Create: `README.md`

**Interfaces:**
- Documents: project and user installation through `amp plugins add`
- Documents: palette, `$name`, embedded `/name`, leading-slash reservation, plugin reload after skill changes, and the model-mediated public-API boundary

- [ ] **Step 1: Write focused usage and installation documentation**

Include raw GitHub URL templates for system and workspace installation, native palette instructions, syntax examples, and the requirement to run `plugins: reload` after changing installed skills.

- [ ] **Step 2: Verify documentation commands and plugin loading**

Run: `git diff --check && npm test && amp plugins exec .amp/plugins/skill-selector.ts agent.start --data '<event-json>'`
Expected: no whitespace errors, all tests PASS, plugin event succeeds.

- [ ] **Step 3: Dogfood native palette and real invocation through Herdr**

Start Amp in this repository in a separate Herdr pane. Open the native command palette, type a partial installed skill name, capture ANSI output proving `skills: ponytail` and `skills: ce-simplify-code` are filtered commands, select one, submit a harmless request, and inspect the transcript/output for the real built-in `skill` tool call. Repeat with `$ponytail` and embedded `/ce-simplify-code`; confirm leading `/ponytail` remains under built-in command handling.

- [ ] **Step 4: Apply ce-simplify-code review**

Run the required reuse, quality, and efficiency review passes over `.amp/plugins/skill-selector.ts` and apply only behavior-preserving improvements. Re-run all automated checks and the affected live path.

- [ ] **Step 5: Commit**

```bash
git add README.md .amp/plugins/skill-selector.ts test/skill-selector.test.ts package.json
git commit -m "docs: add Amp skill selector usage"
```
