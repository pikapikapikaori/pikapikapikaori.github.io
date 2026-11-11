---
name: development-workflow
description: >-
  Required end-to-end workflow for software development coordinated by the Orchestrator: clarify requirements, plan, research, implement, test, review, repair, document, and accept.
---

# Development Workflow

The Orchestrator must follow this workflow for development tasks. Scale depth to task size; do not force unnecessary phases for trivial questions, but never skip acceptance criteria or honest validation.

## 1. Understand and clarify
- Restate the intended outcome concretely.
- Inspect relevant project context.
- Ask focused questions only when ambiguity materially affects implementation or acceptance.
- Separate confirmed requirements from assumptions.
- Define observable acceptance criteria before implementation.

## 2. Assess and plan
Use light task routing: L1 simple/low-risk tasks can stay with Orchestrator; L2 ordinary changes use only necessary specialists; L3 complex or high-risk changes may involve several specialists. Security or API risk can justify review even for small changes. Never treat tiers as fixed agent rosters.

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
Use Tester when risk, complexity, user instruction, or acceptance criteria warrant independent validation. Tester inspects actual code and criteria, runs relevant checks, records exact commands and results, distinguishes PASSED/FAILED/SKIPPED/NOT RUN, and reports blockers and coverage gaps. A suggested command, existing test file, or Developer claim is not evidence of a pass.

## 8. Review independently
Use Reviewer when risk, complexity, public API impact, security sensitivity, or user instruction warrants it. Reviewer is read-only and reports concrete findings with file/line, impact, severity, and correction direction. Review does not replace tests, and tests do not replace review.

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
Use Documentation selectively when changes affect public APIs, installation/configuration, architecture, deployment, user-facing behavior, or documentation is explicitly requested. Existing project documentation may be updated even with no `document_root`; workflow records may only be created with an explicit root or explicit user request. Verify docs against actual code and configuration. Check YAML frontmatter syntax in Skill files touched during a task, without requiring a separate validator script.

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
For UI/UX tasks, use the dedicated UI/UX Agent if delegation is appropriate and its model is explicitly configured. The agent must use `design-taste-frontend` and rapidly produce a minimal inspectable prototype. Present the prototype and solicit user feedback before substantial design polish or implementation expansion, unless the user expressly asks to skip the checkpoint. `impeccable` is an optional polish/audit Skill, not a replacement for taste-skill.

## Megacave token-efficient punctuation policy

For ALL natural-language communication (user-facing and between any agents), apply the installed `/megacave` response Skill and prefer concise classical Chinese. Minimize total tokens. Omit punctuation whenever meaning remains clear; retain punctuation where needed to prevent ambiguity. Do NOT add spaces or line breaks merely to replace omitted punctuation. Do not sacrifice meaning or precision to eliminate punctuation. Preserve exact syntax in code, commands, file paths, URLs, identifiers, JSON, YAML, regular expressions, logs, and other machine-readable content. This is a communication style rule, not a reason to alter code or structured handoff fields.
