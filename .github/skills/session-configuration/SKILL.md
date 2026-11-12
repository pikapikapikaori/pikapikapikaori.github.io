---
name: session-configuration
description: Initializes the Orchestrator's Copilot session by parsing user-provided model assignments, Skill requirements, project conventions, document paths, and workflow constraints; validates configuration and precedence.
---

# Session Configuration

Use at the beginning of every new Orchestrator session and whenever the user changes configuration.

## 0. Preset and configurable paths

Read `.github/skills/session-configuration/presets/megacave-minimal.json` first. It is this template's configuration file, not a VS Code-native schema. The only supplied preset is `megacave-minimal`.

The preset configures `communication.style`, `communication.punctuation`, `communication.spaces`, `skill_paths.template`, `skill_paths.external`, and `preset_skills.install_on_start` / `activate_after_install`, plus `version_control` settings.

Both Skill roots are independently configurable via the preset file or explicit session instructions. Template Skills (`development-workflow`, `session-configuration`, `preset-skills`) belong in the template root; external Skills belong in the external root. Resolve paths from the workspace root. User instruction > explicit session config > selected preset. Check for missing directories and name conflicts. Do not claim an edit to the path config physically moves installed Skills. Because the bootstrap Skill must be found before session configuration is read, moving the template root requires relocating its files and updating agent references manually.

When invoking the installer, pass `--external-root` / `--template-root` for session-only path overrides. When a custom external root is outside the VS Code auto-discovery locations, the files can be read explicitly but native Skill discovery may need additional host configuration.

## 1. Sources
The user may provide configuration through natural language, a YAML-like block, a Skill explicitly designated as a configuration source, or referenced project files. Do not treat an arbitrary Skill as a configuration source unless the user identifies it or its purpose clearly establishes that role.

## 2. Categories

### Session-level
- `preset`: currently `megacave-minimal` only.
- `communication`: style and punctuation/spacing policy, configurable.
- `skill_paths.template`: workspace-relative template Skill root.
- `skill_paths.external`: workspace-relative external Skill root.
- `document_root`: optional workflow-document directory.
- `version_control.mode`: `snapshots` or `git`, default `snapshots`.
- `version_control.git.agent_commit_allowed`: default false; explicit approval needed to enable.
- `version_control.git.agent_push_allowed`: default false and independent of commit permission.
- `version_control.snapshots.directory`: configurable workspace-relative location, default `.workflow-snapshots`.
- `version_control.snapshots.capture`: `before_and_after`, per batch.
- `conventions`: project convention files/paths.
- `main_required_skills`: additional Skills the main agent must apply.
- `main_available_skills`: Skills the main agent may select.
- `project_constraints`: other instructions and limits.
- `caveman_cli`: optional only if the user explicitly wants the separate Caveman CLI; not required for response Skills.

The Orchestrator always has baseline `development-workflow` and `session-configuration` Skills via its Custom Agent frontmatter.

### Per specialist
For each of Researcher, Developer, Tester, Reviewer, UI/UX Agent, Documentation:
- `model`: exact model explicitly chosen by the user; required before invoking the role.
- `required_skills`: must be applied whenever the role is invoked.
- `available_skills`: may be selected when relevant.
- `notes`: role-specific instructions.

The user may configure only roles needed for the current task. Do not require unused roles to be configured.

## 3. Model gate — no silent fallback
- A specialist model is configured only if the user explicitly names it in this session or a user-designated configuration Skill.
- Never infer a specialist model from the main session model.
- Do not assume omission of `model` from `.agent.md` means no runtime default; Copilot may use the current session model.
- Before first invocation, verify that the specialist's model is explicitly configured.
- If missing, ask the user and do not invoke before receiving the answer.
- Ask only when the role is actually needed.
- If the model is unavailable, explain and ask for another model or explicit permission to use the current session model.
- Use the exact model-selection mechanism exposed by the Copilot `task` runtime, if available.
- If per-task model selection is not exposed, stop and explain. Ask whether the user explicitly authorizes the current session model or prefers not to use that specialist.
- Never claim a model was used unless runtime/tool activity confirms it.

## Session model reuse
Once a role model is explicitly approved, reuse it for that role during this session unless the user changes it. Do not automatically persist it across sessions; a user-designated configuration Skill/file can supply it for future sessions.

## 4. Skill categories
- Main required: must be applied this session.
- Main available: may be selected when relevant.
- Specialist required: must be applied whenever that specialist is invoked.
- Specialist available: may be selected when relevant.

Skill assignment does not create an agent and does not select a model.

## 5. Resolve and validate Skills
For each Skill:
1. Determine whether the user supplied a name, a direct `SKILL.md` path, or a configuration Skill.
2. For a name, search the configured `skill_paths.template` and `skill_paths.external` roots first, then other available Copilot Skill locations.
3. If multiple matches exist, report ambiguity and ask which to use.
4. Read the actual `SKILL.md`; do not rely on the name/description alone.
5. Check relevance to the assigned role.
6. If a required Skill is missing/unreadable, do not claim it was loaded; stop the affected task and ask.
7. If an available Skill is missing, report it if selected; otherwise leave it unused.

### Passing session-specific Skills to subagents
Copilot Custom Agent `skills` frontmatter is static; a chat message cannot rewrite it for one invocation. For session-specific assignments:
- Orchestrator reads and validates the Skill file.
- Include its exact path in the delegated task.
- Require the subagent to read the file before acting.
- Include a concise summary of relevant requirements when useful.
- Describe this as file-based instruction transfer, not dynamic modification of native `skills` frontmatter.

## 6. Conventions and documents
- Read every convention file the user specifies before planning implementation.
- `document_root` is optional and must not be hard-coded.
- If absent, do not create workflow documents.
- If present, verify the path and use it for records.
- If invalid, do not silently create another directory; report and ask whether to create it or use another path.

## 7. Precedence
For user-configurable workflow settings:
1. Latest explicit user instruction in the current conversation.
2. Values in a Skill/file the user explicitly designated as a configuration source.
3. Defaults in Orchestrator/specialist instructions.
4. Copilot runtime defaults.

Runtime defaults must never override the specialist model gate. If no user-approved specialist model exists, ask even if Copilot would otherwise use the current session model. If user-level sources conflict and specificity/recency does not resolve them, ask one focused clarification.

## 8. Initialization report
After parsing configuration, briefly report:
- main model: selected by user in Copilot picker; do not guess;
- document root or not configured;
- convention files loaded or blockers;
- main required Skills loaded or blockers;
- configured specialist models;
- specialist required/available Skills;
- unresolved issues.

Do not ask for unused roles. Ask for a model only when that role is needed.

## 9. Suggested configuration shape

This is a conversational convention for this workflow, not a native VS Code configuration schema:

```yaml
session:
  document_root: "./project-notes"
  conventions:
    - "./rules/general.md"
    - "./rules/backend.md"
  main_required_skills:
    - "architecture-guidelines"
  main_available_skills:
    - "api-research"

agents:
  Researcher:
    model: "Exact model name shown in Copilot"
    required_skills:
      - "research-method"
    available_skills:
      - "web-research"

  Developer:
    model: "Exact model name shown in Copilot"
    required_skills:
      - "backend-development"
    available_skills:
      - "database-design"

  Tester:
    model: "Exact model name shown in Copilot"
    required_skills: []
    available_skills:
      - "test-conventions"

  Documentation:
    model: null
    required_skills: []
    available_skills: []

  Reviewer:
    model: "Exact model name shown in Copilot"
    required_skills: []
    available_skills:
      - "security-audit"
```

Omit unused roles and fields. The same information may be provided in natural language.

## Caveman configuration and workspace-only Skills
- Only discuss `caveman_cli` if explicitly requested. Options: `install-local` (project-local `@caveman-ai/cli@latest` development dependency) and `skills-only` (no CLI dependency). Never install CLI globally.
- Do not run `caveman setup --install` automatically: it may write to the user directory and requires separate explicit approval.
- Preset Skills `megacave`, `design-taste-frontend`, and `impeccable` belong exclusively in `.agents/skills/` under the current workspace.
- All specialist models, including UI/UX Agent and Documentation, are unset until explicitly assigned. Ask only when the role is needed.
- All user-facing and inter-agent messages use `megacave`, subject to installed Skills and actual host behavior.

## Startup bootstrap
Run the `preset-skills` startup installation/check before ordinary session configuration. Read and activate `megacave` immediately after installation; do not defer it until a task needs the Skill.

## Megacave token-efficient punctuation policy

For ALL natural-language messages to users or other agents, apply the installed `/megacave` response Skill. In ordinary prose use concise classical Chinese with ZERO spaces (ASCII or full-width) and ZERO punctuation (Chinese or ASCII). Do not insert line breaks to compensate for removed spaces or punctuation. Compose sentences so their meaning remains clear without punctuation. If unambiguous expression is impossible, rewrite rather than add punctuation; for unavoidable safety-critical ambiguity, clarity takes priority. This restriction applies to ordinary prose, including status messages, explanations and handoffs. Exceptions: preserve exact code, CLI commands, file paths, URLs, identifiers, quoted raw logs and machine-readable structures such as JSON/YAML, Markdown syntax necessary for formatting, and content explicitly requested by the user in another format. Do not alter technical artifacts to satisfy the prose style. When a native slash invocation is unavailable, read and apply the megacave Skill directly rather than outputting a literal slash command.

## Version-control initialization

Read `version_control` from the selected preset, then apply explicit user/session overrides. Do not ask to enable commit by default. Confirm the snapshot directory is within the workspace, is not a source path to be snapshotted, and can be created. Use `node .github/skills/development-workflow/scripts/snapshot-batch.mjs` for before/after capture. No commit or push unless the corresponding flag is explicitly authorized. A preset's disabled flags are not permission to commit. Never mutate `.gitignore` without user approval; recommend ignoring the snapshot directory.

## Mandatory roles

All workflows require Documentation. Formal development requires Developer, Tester, Reviewer and Documentation. Layout changes additionally require UI/UX. Request missing models only when the relevant role is needed. If mandatory delegation is blocked, report it rather than marking the workflow accepted.


## Configurable snapshot script location

Resolve the snapshot CLI from the active `skill_paths.template` as `<template_skill_root>/development-workflow/scripts/snapshot-batch.mjs`. The literal `.github/skills/development-workflow/scripts/snapshot-batch.mjs` is only the bundled preset path. If the template root changes, invoke the script from the configured root and do not assume the default location.
