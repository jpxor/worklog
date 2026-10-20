import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');
const read = path => readFileSync(join(root, path));
const text = path => read(path).toString().replaceAll('\r\n', '\n');
const json = path => JSON.parse(read(path).toString().replace(/^\uFEFF/, ''));
const render = value => `${JSON.stringify(value, null, 2)}\n`;
const licenseName = /^(licen[sc]e|copying|notice|copyright)(\.|$|-)/i;
const check = process.argv.includes('--check');
function output(path, value) {
  if (check) {
    if (!existsSync(join(root, path)) || text(path) !== value) throw new Error(`Stale third-party materials: ${path}. Run npm run notices:generate.`);
  } else {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), value);
  }
}
const lockHashes = Object.fromEntries(['package-lock.json', 'src-tauri/Cargo.lock', 'src-tauri/Cargo.toml', 'src-tauri/about.toml'].map(p => [p, hash(text(p))]));
const rustArg = process.argv.indexOf('--rust-json');
if (rustArg >= 0) {
  if (check) throw new Error('--rust-json cannot be used with --check');
  const source = JSON.parse(readFileSync(resolve(process.argv[rustArg + 1]), 'utf8').replace(/^\uFEFF/, ''));
  const overrides = json('third-party/license-overrides.json');
  const texts = new Map();
  const resolved = source.licenses.filter(l => !/<copyright holders>|<owner>/.test(l.text)).map(l => ({...l, used_by:l.used_by.filter(u => u.crate.source)})).filter(l => l.used_by.length);
  // Preserve actual package notices even when the scanner selects canonical text.
  // Generic MIT/BSD templates without copyright attribution are never accepted.
  for (const c of source.crates.filter(c => c.package.source)) {
    const p = c.package;
    const directory = dirname(p.manifest_path);
    const files = readdirSync(directory, { withFileTypes: true }).filter(f => f.isFile() && licenseName.test(f.name));
    for (const f of files) resolved.push({ id: 'Upstream license/notice', text: readFileSync(join(directory,f.name),'utf8'), used_by: [{crate:p}] });
    const needsAttribution = source.licenses.some(l => /<copyright holders>|<owner>/.test(l.text) && l.used_by.some(u => u.crate.id === p.id));
    if (needsAttribution && !files.length) {
      const override = overrides.find(o => o.packages.includes(`${p.name}@${p.version}`));
      if (!override || hash(read(`third-party/${override.file}`)) !== override.sha256) throw new Error(`Missing upstream attribution: ${p.name}@${p.version}`);
      resolved.push({ id: c.license, text: text(`third-party/${override.file}`), used_by: [{crate:p}] });
    }
  }
  const grouped = new Map();
  for (const l of resolved) {
    const text = l.text.replaceAll('\r\n', '\n');
    const file = `licenses/${hash(text)}.txt`;
    texts.set(file, text);
    const entry = grouped.get(file) || { license: l.id, file, packages: [] };
    entry.packages = [...new Set([...entry.packages,...l.used_by.map(u => `${u.crate.name}@${u.crate.version}`)])].sort();
    grouped.set(file,entry);
  }
  const licenses = [...grouped.values()].sort((a,b) => a.file.localeCompare(b.file,'en'));
  const packages = source.crates.filter(c => c.package.source).map(c => ({ name: c.package.name, version: c.package.version, license: c.license, repository: c.package.repository })).sort((a,b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`, 'en'));
  output('third-party/rust.json', render({ cargoLock: lockHashes['src-tauri/Cargo.lock'], manifest: lockHashes['src-tauri/Cargo.toml'], config: lockHashes['src-tauri/about.toml'], generator: 'cargo-about 0.9.2; Windows x64 MSVC and Linux x64 GNU; dev/build-only dependencies excluded', packages, licenses }));
  for (const [file,text] of texts) output(`third-party/${file}`, text);
}
const rust = json('third-party/rust.json');
if (rust.cargoLock !== lockHashes['src-tauri/Cargo.lock'] || rust.manifest !== lockHashes['src-tauri/Cargo.toml'] || rust.config !== lockHashes['src-tauri/about.toml']) throw new Error('Rust licenses need regeneration with cargo-about; see docs/third-party.md.');
for (const l of rust.licenses) if (hash(text(`third-party/${l.file}`)) !== l.file.split('/')[1].slice(0,-4)) throw new Error(`Changed Rust license: ${l.file}`);
for (const o of json('third-party/license-overrides.json')) if (hash(text(`third-party/${o.file}`)) !== o.sha256) throw new Error(`Changed upstream attribution: ${o.file}`);
const packages = [];
const texts = [];
const lock = json('package-lock.json');
function collect(directory, prefix, recursive = false) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.isDirectory() && recursive) collect(join(directory, entry.name), `${prefix}/${entry.name}`, true);
    else if (entry.isFile() && licenseName.test(entry.name)) texts.push({ name: `${prefix}/${entry.name}`, text: readFileSync(join(directory, entry.name), 'utf8').replaceAll('\r\n','\n') });
  }
}
for (const [path,p] of Object.entries(lock.packages).sort(([a],[b]) => a.localeCompare(b,'en'))) {
  if (!path || p.dev || p.optional) continue;
  const meta = JSON.parse(readFileSync(join(root,path,'package.json'),'utf8'));
  if (meta.version !== p.version) throw new Error(`Run npm ci: ${path}`);
  const before = texts.length;
  collect(join(root,path), `${meta.name}@${meta.version}`);
  // khroma 2.1.0 omits SPDX metadata; its shipped license explicitly says MIT.
  const license = meta.license || p.license || (meta.name === 'khroma' && meta.version === '2.1.0' && texts.slice(before).some(t => t.text.startsWith('The MIT License (MIT)')) ? 'MIT' : null);
  if (texts.length === before || !license) throw new Error(`Missing license: ${path}`);
  packages.push({ name: meta.name, version: meta.version, license, integrity: p.integrity });
}
// PDF assets have licenses distinct from the package's Apache-2.0 license.
for (const dir of ['cmaps','standard_fonts','wasm','iccs']) collect(join(root,'node_modules/pdfjs-dist',dir), `pdfjs-dist/${dir}`, true);
const sources = json('third-party/sources.json');
for (const s of sources) if (hash(read(`third-party/sources/${s.file}`)) !== s.sha256) throw new Error(`Missing or altered corresponding source: ${s.file}`);
for (const p of rust.packages.filter(p => p.license.includes('MPL-2.0'))) {
  const source = sources.find(s => s.file === `${p.name}-${p.version}.crate`);
  if (!source) throw new Error(`Missing MPL source: ${p.name}@${p.version}`);
  const block = text('src-tauri/Cargo.lock').split('[[package]]').find(b => b.includes(`name = "${p.name}"`) && b.includes(`version = "${p.version}"`));
  if (block?.match(/checksum = "([a-f0-9]+)"/)?.[1] !== source.sha256) throw new Error(`MPL source does not match Cargo.lock: ${source.file}`);
}
output('third-party/inventory.json', render({ lockHashes, npmScope: 'Locked non-dev, non-optional npm dependency superset. Some packages are tree-shaken. Optional Node canvas/native dependencies are not used by the browser application.', npm: packages, rustScope: rust.generator, rust: rust.packages, sources }));
const sections = [
  'WorkLog third-party notices',
  'Original WorkLog material is licensed under Apache-2.0 (see LICENSE). Third-party components retain their own licenses. This inventory conservatively includes dependencies that may be removed by tree shaking or compilation.',
  'Corresponding source for the bundled Liberation 1.07.4 fonts (GPL-2.0 with font exceptions) and MPL-2.0 Rust components is included in third-party/sources. See third-party/SOURCES.md for provenance and build instructions. These components are unmodified by WorkLog.',
  'NPM components\n' + packages.map(p => `${p.name}@${p.version}: ${typeof p.license === 'string' ? p.license : JSON.stringify(p.license)}`).join('\n'),
  'Rust components\n' + rust.packages.map(p => `${p.name}@${p.version}: ${p.license}`).join('\n'),
  ...texts.map(t => `${t.name}\n${'='.repeat(72)}\n${t.text}`),
  ...rust.licenses.map(l => `${l.license}: ${l.packages.join(', ')}\n${'='.repeat(72)}\n${text(`third-party/${l.file}`)}`),
];
const notices = `${sections.join('\n\n')}\n`;
if (/<copyright holders>|<owner>/.test(notices)) throw new Error('Unresolved upstream copyright placeholder');
output('THIRD-PARTY-NOTICES.txt', notices);
console.log(`Third-party materials ${check ? 'verified' : 'generated'}: ${packages.length} npm packages, ${rust.packages.length} Rust crates, ${sources.length} source archives.`);
