---
name: preset-skills
description: >-
  Bootstrap and verify approved preset Skills in the current workspace at session startup.
---

# Preset Skills — startup bootstrap

At the START of every Orchestrator session, before normal task execution:
1. Check `<workspace>/.agents/skills/` for each preset; if absent, fall back to `<workspace>/.github/skills/`. If both exist, prefer `.agents/skills/` and warn about the duplicate. An incomplete preferred directory is an error.
2. Immediately install a preset Skill only if absent from both workspace locations using `node .github/skills/preset-skills/scripts/install-preset-skills.mjs --install` from the workspace root. The user has authorized this startup behavior in the workflow specification; obey any additional runtime approval prompts or execution policies. Never install to user/global scope.
3. Preserve already installed directories; never overwrite incomplete or conflicting directories silently.
4. Verify the resolved `SKILL.md` exists and is readable. Read the resolved `megacave/SKILL.md` immediately and apply it to ALL subsequent user-facing and inter-agent communication in this session. If the runtime supports a native slash invocation, invoke `/megacave` as well; a textual mention alone is not an actual slash command.
5. Before UI/UX tasks, read `design-taste-frontend/SKILL.md`; `impeccable` is available for optional polishing and its scripts/references must remain intact.
6. If download, validation, or activation fails, report the precise failure and do not claim the Skill is active.

Sources:
- `megacave`: https://github.com/JuliusBrussee/caveman
- `design-taste-frontend`: https://github.com/Leonxlnx/taste-skill
- `impeccable`: https://github.com/pbakaus/impeccable

The installer stages full Skill directories in an isolated temporary directory and copies newly installed Skills to `<workspace>/.agents/skills/`. Existing Skills in `.github/skills/` are accepted as fallback, not moved. No global installation, no symlinks, no `caveman setup --install`.

`@caveman-ai/cli` is separate from the response Skill and is NOT needed to apply `megacave`. Do not delay Skill startup for CLI configuration. The optional CLI package can be discussed only when specifically needed.

## Megacave token-efficient punctuation policy

For ALL natural-language communication (user-facing and between any agents), apply the installed `/megacave` response Skill and prefer concise classical Chinese. Minimize total tokens. Omit punctuation whenever meaning remains clear; retain punctuation where needed to prevent ambiguity. Do NOT add spaces or line breaks merely to replace omitted punctuation. Do not sacrifice meaning or precision to eliminate punctuation. Preserve exact syntax in code, commands, file paths, URLs, identifiers, JSON, YAML, regular expressions, logs, and other machine-readable content. This is a communication style rule, not a reason to alter code or structured handoff fields.
