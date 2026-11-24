---
name: preset-skills
description: >-
  Install approved external Skills at startup using the session-configured workspace paths and apply them after verification.
---

# Preset Skills

At session startup read `.github/skills/session-configuration/presets/megacave-minimal.json` and apply the chosen preset plus any explicit session overrides.

- `skill_paths.template` locates the three template Skills; `skill_paths.external` locates downloaded third-party Skills. Both are user-configurable workspace-relative paths. Do not confuse the two.
- The bootstrap default configuration is in `.github/skills/session-configuration/presets/megacave-minimal.json`; changing `skill_paths.template` requires moving the three existing Skill directories first, and updating references or native agent bindings as needed. A JSON edit alone does not relocate them.
- Check `megacave`, `design-taste-frontend`, `impeccable` in the configured external path on every new session. Run `node <template_skill_root>/preset-skills/scripts/install-preset-skills.mjs --install` from workspace root, with `--config` if needed. Use `--external-root` and `--template-root` for session overrides (they override file values for the installer only). Never install user/global scope.
- Check actual `SKILL.md` files after installation. Immediately read and apply `megacave` to all subsequent natural-language communication; if native `/megacave` invocation is available, use it too. A slash command typed as prose does not activate a native command. Freshly installed Skills may require VS Code reload or a new chat for native discovery.
- Before UI work read `design-taste-frontend`; optionally use `impeccable` including its scripts and references. Keep complete directories.
- If installation or activation fails, report it; do not claim success. Do not execute `caveman setup --install` or install `@caveman-ai/cli` automatically.

Sources: https://github.com/JuliusBrussee/caveman , https://github.com/Leonxlnx/taste-skill , https://github.com/pbakaus/impeccable

## megacave-minimal communication

All user-agent and agent-agent natural language uses `megacave` concise classical Chinese. Use zero punctuation and zero spaces in ordinary natural-language messages. Do not insert line breaks as substitutes. Rewrite ambiguous sentences rather than adding punctuation. Never change syntax in code, commands, paths, identifiers, URLs, YAML, JSON, logs, or machine-readable handoffs. If ambiguity arises rewrite the natural-language sentence without spaces or punctuation.
