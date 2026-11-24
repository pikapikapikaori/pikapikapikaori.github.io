#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Usage: node .github/skills/development-workflow/scripts/snapshot-batch.mjs before|after BATCH_ID [--directory PATH] PATH...
const args = process.argv.slice(2);
const phase = args.shift(), batch = args.shift();
if (!['before','after'].includes(phase) || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(batch ?? '')) {
  console.error('Usage: node .github/skills/development-workflow/scripts/snapshot-batch.mjs before|after BATCH_ID [--directory DIR] PATH...'); process.exit(2);
}
let dir = '.workflow-snapshots'; const targets = [];
for (let i=0;i<args.length;i++) {
  if (args[i] === '--directory') { if (!args[i+1]) throw Error('Missing directory'); dir=args[++i]; }
  else targets.push(args[i]);
}
if (!targets.length) throw Error('Provide one or more scoped paths');
const root=process.cwd();
const within=(parent,child)=>child===parent || child.startsWith(parent+path.sep);
const resolveSafe=(p)=>{
  const abs=path.resolve(root,p);
  if (!within(root,abs)) throw Error(`Outside workspace: ${p}`);
  return abs;
};
const store=resolveSafe(dir);
if (store===root || within(path.resolve(root,'.git'),store)) throw Error('Unsafe snapshot root');
const batchDir=path.join(store,batch), phaseDir=path.join(batchDir,phase);
const manifestPath=path.join(batchDir,'manifest.json');
const walk=(p)=>{
  const abs=resolveSafe(p);
  if (within(store,abs) || within(abs,store)) throw Error(`Snapshot root overlap: ${p}`);
  if (!fs.existsSync(abs)) return [p];
  const st=fs.lstatSync(abs);
  if (st.isSymbolicLink()) throw Error(`Symlinks not supported: ${p}`);
  if (!st.isDirectory()) return [p];
  const entries=fs.readdirSync(abs);
  return entries.flatMap(e=>walk(path.join(p,e)));
};
const paths=[...new Set(targets.flatMap(walk).map(p=>path.relative(root,resolveSafe(p)).replaceAll(path.sep,'/')))].sort();
if (paths.some(p=>p.startsWith('../')||p==='.')) throw Error('Invalid scope');
if (fs.existsSync(phaseDir)) throw Error(`Phase already captured: ${phaseDir}`);
if (phase==='after' && !fs.existsSync(manifestPath)) throw Error('Capture before first');
let manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{batch,created_at:new Date().toISOString(),snapshot_directory:path.relative(root,store),entries:{}};
if (phase==='after') {
  const missing=paths.filter(p=>!(p in manifest.entries));
  if (missing.length) throw Error(`Missing before snapshots for: ${missing.join(', ')}; capture new paths before modifying them`);
}
// Validate scope and read source bytes before creating the phase folder.
const captures=paths.map(rel=>{
  const abs=resolveSafe(rel);
  if (!fs.existsSync(abs)) return {rel,exists:false};
  const stat=fs.lstatSync(abs);
  if (!stat.isFile()) throw Error(`Only regular files supported: ${rel}`);
  const bytes=fs.readFileSync(abs);
  return {rel,exists:true,bytes,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
fs.mkdirSync(phaseDir,{recursive:true});
for (const item of captures) {
  manifest.entries[item.rel]??={};
  manifest.entries[item.rel][phase]={exists:item.exists,...(item.exists?{sha256:item.sha256,size:item.bytes.length}:{})};
  if (item.exists) {
    const out=path.join(phaseDir,item.rel);
    fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,item.bytes,{flag:'wx'});
  }
}
manifest.updated_at=new Date().toISOString();
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(`${phase} captured ${captures.length} paths: ${path.relative(root,batchDir)}`);
