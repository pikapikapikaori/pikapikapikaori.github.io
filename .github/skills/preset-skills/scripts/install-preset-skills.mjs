#!/usr/bin/env node
import { mkdtemp, mkdir, cp, access, readdir, rm, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const workspace = process.cwd();
const flag = (key) => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
const configPath = resolve(workspace, flag('--config') ?? '.github/skills/session-configuration/presets/megacave-minimal.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const preset = config.presets?.[config.preset];
if (!preset) throw new Error(`Unknown preset: ${config.preset}`);
const paths = {
  template: flag('--template-root') ?? preset.skill_paths?.template,
  external: flag('--external-root') ?? preset.skill_paths?.external,
};
function workspacePath(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label} path`);
  if (isAbsolute(value)) throw new Error(`${label} must be workspace-relative: ${value}`);
  const full = resolve(workspace, value);
  const rel = relative(workspace, full);
  if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) throw new Error(`${label} escapes workspace: ${value}`);
  return full;
}
const templateRoot = workspacePath(paths.template, 'template');
const targetRoot = workspacePath(paths.external, 'external');
if (templateRoot === targetRoot) throw new Error('Template and external Skill paths must be distinct');
const specs = [
  { name: 'megacave', repo: 'https://github.com/JuliusBrussee/caveman' },
  { name: 'design-taste-frontend', repo: 'https://github.com/Leonxlnx/taste-skill' },
  { name: 'impeccable', repo: 'https://github.com/pbakaus/impeccable' },
];
const selected = preset.preset_skills?.names ?? specs.map(s => s.name);
const unknown = selected.filter(name => !specs.some(s => s.name === name));
if (unknown.length) throw new Error(`Unknown preset skills: ${unknown.join(', ')}`);
console.log(`Workspace: ${workspace}\nTemplate Skills: ${templateRoot}\nExternal Skills: ${targetRoot}`);
if (!args.includes('--install')) {
  for (const s of specs.filter(s => selected.includes(s.name))) console.log(`${s.name}: ${s.repo}`);
  console.log('Run with --install to install missing Skills in the configured external path');
  process.exit(0);
}
if (preset.preset_skills?.install_on_start === false) {
  console.log('Preset install_on_start is false; skipping');
  process.exit(0);
}
async function exists(path) { try { await access(path); return true; } catch { return false; } }
function run(commandArgs, cwd) {
  const r = spawnSync('npx', commandArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error || r.status !== 0) throw new Error(`npx failed: ${r.error?.message ?? r.status}`);
}
async function findSkill(dir, name) {
  for (const base of ['.agents/skills', '.github/skills', '.claude/skills', 'skills']) {
    const p = join(dir, base, name);
    if (await exists(join(p, 'SKILL.md'))) return p;
  }
  throw new Error(`Could not locate staged ${name}/SKILL.md`);
}
await mkdir(targetRoot, { recursive: true });
for (const spec of specs.filter(s => selected.includes(s.name))) {
  const dest = join(targetRoot, spec.name);
  if (await exists(dest)) {
    if (await exists(join(dest, 'SKILL.md'))) { console.log(`SKIP ${spec.name}: already installed`); continue; }
    throw new Error(`Incomplete directory; refusing overwrite: ${dest}`);
  }
  const stage = await mkdtemp(join(tmpdir(), 'copilot-preset-skills-'));
  try {
    run(['--yes', 'skills', 'add', spec.repo, '--skill', spec.name, '--copy', '--yes'], stage);
    const source = await findSkill(stage, spec.name);
    if (!(await stat(source)).isDirectory()) throw new Error(`Not a directory: ${source}`);
    await cp(source, dest, { recursive: true, errorOnExist: true, force: false });
    if (!(await exists(join(dest, 'SKILL.md')))) throw new Error(`Verification failed: ${dest}`);
    console.log(`INSTALLED ${spec.name} -> ${dest}`);
  } finally { await rm(stage, { recursive: true, force: true }); }
}
