---
name: development-workflow
description: >-
  Required end-to-end workflow for software development coordinated by the Orchestrator: clarify requirements, plan, research, implement, test, review, repair, document, and accept.
---

# Development Workflow

The Orchestrator must follow this workflow for development tasks. Scale depth to task size; scale detail for trivial questions while still involving Documentation, but never skip acceptance criteria or honest validation.

## 1. Understand and clarify
- Restate the intended outcome concretely.
- Inspect relevant project context.
- Ask focused questions only when ambiguity materially affects implementation or acceptance.
- Separate confirmed requirements from assumptions.
- Define observable acceptance criteria before implementation.

## 2. Assess and plan
Use L1/L2/L3 only to scale task depth. Documentation participates in every workflow. Formal development always involves Developer, Tester, Reviewer, Documentation. Page layout changes additionally require UI/UX. Never skip a mandatory role due to task size.

- Decide whether to work directly or delegate.
- Consider complexity, expertise, context isolation, cost, and coordination overhead.
- Break complex work into bounded tasks with dependencies.
- Identify likely files/components, risks, compatibility constraints, and validation.
- Avoid oversized plans for trivial changes.

## 3. Research and design when needed
Use Researcher when independent codebase exploration, technical research, source verification, or comparison materially helps. Understand existing code and conventions, resolve important technical choices, and record confirmed decisions if a document root was supplied. Do not turn speculative research into settled requirements.

## 4. Durable records when configured
Use only the document root explicitly supplied by the user. Create/update only useful records. Possible records:
- `requirements.md`: confirmed requirements and acceptance criteria;
- `design.md`: architecture and technical decisions;
- `task-plan.md`: tasks, owners, dependencies, status;
- `decisions.md`: decisions and reasons;
- `progress.md`: current state, blockers, next steps;
- `test-report.md`: actual commands, results, failures, gaps.

These are suggestions, not mandatory filenames. Do not create all of them for every task. If no document root is configured, do not invent one.

## 5. Delegate with a complete contract
Reuse explicitly approved per-role models within the current session; ask only when first needed or changed. Every specialist returns a concise handoff with `status`, `summary`, `files_changed`/inspected, `verification` (actual result or NOT RUN), and `issues`.

Every delegated task states role/goal, relevant context and files, approved requirements, allowed actions and file scope, exact user-approved model, required/selected Skills and their paths, expected deliverables/evidence, dependencies, and parallelization rules. Do not assume the subagent has the main chat history.

## 6. Implement
- Assign coherent implementation ownership, normally one Developer per overlapping code area.
- Prefer small, reviewable changes.
- Avoid unrelated refactors and unapproved dependencies.
- Preserve user modifications and existing behavior unless change is required.
- Update task status and durable records when configured.
- Developer's completion statement is not acceptance.

## 7. Test independently
For every formal development batch, invoke Tester for independent validation. Tester inspects actual code and criteria, runs relevant checks, records exact commands and results, distinguishes PASSED/FAILED/SKIPPED/NOT RUN, and reports blockers and coverage gaps. A suggested command, existing test file, or Developer claim is not evidence of a pass.

## 8. Review independently
For every formal development batch, invoke Reviewer for independent review. Reviewer is read-only and reports concrete findings with file/line, impact, severity, and correction direction. Review does not replace tests, and tests do not replace review.

## 9. Repair and retest
When Tester reports failures or Reviewer finds actionable defects:
1. Validate the finding and scope.
2. Send Developer a focused repair task with evidence.
3. Have Tester rerun relevant tests after repair.
4. Repeat as needed.
5. If repeated attempts fail, stop the repair loop, report the blocker and ask the user how to proceed.

Do not mark complete while required checks remain failed or unverified.

## 10. Concurrency and file ownership
Parallelize independent research or read-only reviews. Do not parallelize edits to the same or tightly coupled files. Before parallel implementation, assign disjoint file ownership and an integration owner. If overlap appears, stop and serialize conflicting work. Researcher and Reviewer are read-only by default; Tester owns scoped test files, not production code; Documentation owns delegated documentation files.

## Documentation updates
Documentation MUST participate in every workflow and consolidate each participating agent’s individual delivery record. Each specialist must supply a concise work/documentation record with actions, changed/inspected files, evidence, risks and open items. Documentation edits a unified synthesis and must not invent facts. Existing project documentation may be updated even with no `document_root`; workflow records may only be created with an explicit root or explicit user request. Verify docs against actual code and configuration. Check YAML frontmatter syntax in Skill files touched during a task, without requiring a separate validator script.

## 11. Final acceptance
The Orchestrator owns acceptance. Inspect changed files/diff, compare with requirements, inspect actual test evidence and relevant review findings, and confirm useful records are updated. Clearly list remaining risks, skipped checks, and unverified behavior.

Final status:
- `ACCEPTED`: criteria met and required verification passed.
- `ACCEPTED WITH LIMITATIONS`: core criteria met, with explicit non-blocking gaps.
- `NOT ACCEPTED`: required criteria failed or material blockers remain.

Never report ACCEPTED if required tests failed or were not run.

## 12. Continuity
When resuming after interruption, compaction, or model change, reread progress and relevant requirements/design/decisions, inspect actual repository state, reconcile records with files and test evidence, and continue from verified state.

## UI/UX prototype-first checkpoint
For any page layout change, the dedicated UI/UX Agent is mandatory and its model must be explicitly configured. The agent must use `design-taste-frontend` and rapidly produce a minimal inspectable prototype. Present the prototype and solicit user feedback before substantial design polish or implementation expansion, unless the user expressly asks to skip the checkpoint. `impeccable` is an optional polish/audit Skill, not a replacement for taste-skill.

## Megacave token-efficient punctuation policy

For ALL natural-language messages to users or other agents, apply the installed `/megacave` response Skill. In ordinary prose use concise classical Chinese with ZERO spaces (ASCII or full-width) and ZERO punctuation (Chinese or ASCII). Do not insert line breaks to compensate for removed spaces or punctuation. Compose sentences so their meaning remains clear without punctuation. If unambiguous expression is impossible, rewrite rather than add punctuation; for unavoidable safety-critical ambiguity, clarity takes priority. This restriction applies to ordinary prose, including status messages, explanations and handoffs. Exceptions: preserve exact code, CLI commands, file paths, URLs, identifiers, quoted raw logs and machine-readable structures such as JSON/YAML, Markdown syntax necessary for formatting, and content explicitly requested by the user in another format. Do not alter technical artifacts to satisfy the prose style. When a native slash invocation is unavailable, read and apply the megacave Skill directly rather than outputting a literal slash command.

## Batch snapshots and git permission

Read `version_control` from the active preset/session. Default: snapshots only, no agent git commit or push. Before the first change in each batch, Orchestrator captures scoped originals with `node .github/skills/development-workflow/scripts/snapshot-batch.mjs before <batch-id> <paths...>`; after implementation, Tester evidence, Reviewer findings and Documentation synthesis, capture `after`. Use `--directory <path>` for the session-configured snapshot root. For newly discovered files, record before prior to mutation. Preserve manifest and raw files for VS Code diff. If before snapshot fails, do not modify files. Never include the snapshot directory within itself. Explicit authorization is required to switch to git commit; git push remains forbidden unless separately authorized.

## Mandatory delivery records

Every specialist must return `status`, `summary`, `files_changed` or inspected, `verification` with actual results or NOT RUN, `issues`, and `documentation_notes` for Documentation. Documentation consolidates these into one accurate final handoff. If no document root is configured, the synthesis remains in the conversation, not an invented folder.


## Configurable snapshot script location

Resolve the snapshot CLI from the active `skill_paths.template` as `<template_skill_root>/development-workflow/scripts/snapshot-batch.mjs`. The literal `.github/skills/development-workflow/scripts/snapshot-batch.mjs` is only the bundled preset path. If the template root changes, invoke the script from the configured root and do not assume the default location.
