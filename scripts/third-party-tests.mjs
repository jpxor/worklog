import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const base = resolve('.test-tmp');
const hash = s => createHash('sha256').update(s).digest('hex');
function fixture(run) {
  mkdirSync(base, {recursive:true});
  const dir = mkdtempSync(join(base,'notices-'));
  const put = (p,s) => { mkdirSync(join(dir,p,'..'),{recursive:true}); writeFileSync(join(dir,p),s); };
  const hashes = {};
  put('scripts/third-party.mjs', readFileSync('scripts/third-party.mjs'));
  const lock = JSON.stringify({packages:{'':{},'node_modules/example':{version:'1.0.0',license:'MIT'}}});
  for (const [p,s] of Object.entries({'package-lock.json':lock,'src-tauri/Cargo.lock':'lock\n','src-tauri/Cargo.toml':'manifest\n','src-tauri/about.toml':'config\n'})) { put(p,s); hashes[p]=hash(s); }
  put('node_modules/example/package.json',JSON.stringify({name:'example',version:'1.0.0',license:'MIT'}));
  put('node_modules/example/LICENSE','Example license\n');
  for(const d of ['cmaps','standard_fonts','wasm','iccs'])put(`node_modules/pdfjs-dist/${d}/LICENSE`,'Asset license\n');
  put('third-party/rust.json',JSON.stringify({cargoLock:hashes['src-tauri/Cargo.lock'],manifest:hashes['src-tauri/Cargo.toml'],config:hashes['src-tauri/about.toml'],generator:'fixture',packages:[],licenses:[]}));
  put('third-party/sources.json',JSON.stringify([{file:'example.crate',sha256:hash('source')} ]));
  put('third-party/license-overrides.json','[]');
  put('third-party/sources/example.crate','source');
  const invoke = (...args) => spawnSync(process.execPath,['scripts/third-party.mjs',...args],{cwd:dir,encoding:'utf8'});
  try { run({dir,put,invoke}); } finally { if(!dir.startsWith(`${base}${sep}`))throw new Error('Unsafe fixture cleanup'); rmSync(dir,{recursive:true,force:true}); }
}

test('checks generated output across CRLF checkouts and rejects stale npm attribution',()=>fixture(({put,invoke,dir})=>{
  assert.equal(invoke().status,0);
  put('src-tauri/Cargo.lock','lock\r\n');
  assert.equal(invoke('--check').status,0);
  put('node_modules/example/LICENSE','Updated attribution\n');
  const result=invoke('--check');assert.notEqual(result.status,0);assert.match(result.stderr,/Stale third-party/);
}));
test('rejects lock changes without refreshed Rust inventory',()=>fixture(({put,invoke})=>{
  put('src-tauri/Cargo.lock','changed\n');
  const result=invoke();assert.notEqual(result.status,0);assert.match(result.stderr,/Rust licenses need regeneration/);
}));
test('rejects altered corresponding source',()=>fixture(({put,invoke})=>{
  put('third-party/sources/example.crate','altered');
  const result=invoke();assert.notEqual(result.status,0);assert.match(result.stderr,/altered corresponding source/);
}));
test('rejects a runtime package without license files',()=>fixture(({dir,invoke})=>{
  rmSync(join(dir,'node_modules/example/LICENSE'));
  const result=invoke();assert.notEqual(result.status,0);assert.match(result.stderr,/Missing license/);
}));
test('rejects copyright placeholders without exact-version upstream attribution',()=>fixture(({dir,put,invoke})=>{
  const crate={name:'example',version:'1.0.0',id:'example',source:'registry',manifest_path:join(dir,'src-tauri/Cargo.toml')};
  put('raw.json',JSON.stringify({crates:[{package:crate,license:'MIT'}],licenses:[{id:'MIT',text:'Copyright (c) <year> <copyright holders>',used_by:[{crate}]}]}));
  const result=invoke('--rust-json','raw.json');assert.notEqual(result.status,0);assert.match(result.stderr,/Missing upstream attribution/);
}));
