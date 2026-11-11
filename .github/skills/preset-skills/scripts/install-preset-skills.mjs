#!/usr/bin/env node
import { mkdtemp, mkdir, cp, access, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = new Set(process.argv.slice(2));
const workspace = process.cwd();
const targetRoot = join(workspace, '.agents', 'skills');
const fallbackRoot = join(workspace, '.github', 'skills');
const specs = [
  { name: 'megacave', repo: 'https://github.com/JuliusBrussee/caveman' },
  { name: 'design-taste-frontend', repo: 'https://github.com/Leonxlnx/taste-skill' },
  { name: 'impeccable', repo: 'https://github.com/pbakaus/impeccable' },
];
if (argv.has('--list') || !argv.has('--install')) {
  console.log('Workspace:', workspace, '\nDownload target:', targetRoot, '\nFallback:', fallbackRoot);
  for (const s of specs) console.log(`${s.name}: ${s.repo}`);
  console.log('Install (workspace only): node .github/skills/preset-skills/scripts/install-preset-skills.mjs --install');
  process.exit(0);
}
async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function inspect(base, name) {
  const dir = join(base, name);
  if (!(await exists(dir))) return 'absent';
  if (!(await exists(join(dir, 'SKILL.md')))) return 'incomplete';
  return 'valid';
}
function run(args, cwd) {
  const r = spawnSync('npx', args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error || r.status !== 0) throw new Error(`npx failed: ${r.error?.message ?? r.status}`);
}
async function findSkill(dir, name) {
  for (const base of ['.agents/skills', '.github/skills', '.claude/skills', 'skills']) {
    const p = join(dir, base, name);
    if (await exists(join(p, 'SKILL.md'))) return p;
  }
  // Fallback for repositories with alternative staging layouts.
  for (const base of ['.agents/skills', '.github/skills', '.claude/skills']) {
    const p = join(dir, base);
    if (await exists(p)) for (const child of await readdir(p)) {
      if (child === name && await exists(join(p, child, 'SKILL.md'))) return join(p, child);
    }
  }
  throw new Error(`Could not locate staged ${name}/SKILL.md; inspect source and installer layout manually`);
}
await mkdir(targetRoot, { recursive: true });
for (const spec of specs) {
  const dest = join(targetRoot, spec.name);
  const preferred = await inspect(targetRoot, spec.name);
  const fallback = await inspect(fallbackRoot, spec.name);
  if (preferred === 'incomplete') throw new Error(`Incomplete preferred Skill directory: ${dest}`);
  if (preferred === 'valid') {
    if (fallback !== 'absent') console.warn(`CONFLICT ${spec.name}: both paths exist; using .agents/skills; inspect .github/skills manually`);
    console.log(`SKIP ${spec.name}: using ${dest}`);
    continue;
  }
  if (fallback === 'incomplete') throw new Error(`Incomplete fallback Skill directory: ${join(fallbackRoot, spec.name)}`);
  if (fallback === 'valid') {
    console.log(`FALLBACK ${spec.name}: using ${join(fallbackRoot, spec.name)}; no download`);
    continue;
  }
  const stage = await mkdtemp(join(tmpdir(), 'copilot-preset-skills-'));
  try {
    // --copy avoids linking to a user/global location. No -g; staging is isolated.
    run(['--yes', 'skills', 'add', spec.repo, '--skill', spec.name, '--copy', '--yes'], stage);
    const src = await findSkill(stage, spec.name);
    if (!(await stat(src)).isDirectory()) throw new Error(`Not a directory: ${src}`);
    await cp(src, dest, { recursive: true, errorOnExist: true, force: false });
    if (!(await exists(join(dest, 'SKILL.md')))) throw new Error(`Verification failed: ${dest}`);
    console.log(`INSTALLED ${spec.name} -> ${dest}`);
  } finally { await rm(stage, { recursive: true, force: true }); }
}
