import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/verify-distribution.mjs EXTRACTED_PACKAGE');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = digest(readFileSync(join(project,'THIRD-PARTY-NOTICES.txt')));
const matches = [];
function walk(directory) {
  for (const entry of readdirSync(directory,{withFileTypes:true})) {
    const path = join(directory,entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && entry.name === 'THIRD-PARTY-NOTICES.txt' && digest(readFileSync(path)) === expected) matches.push(path);
  }
}
walk(resolve(root));
if (!matches.length) throw new Error('Distribution is missing the current full third-party notices');
for (const path of matches) {
  const base = dirname(path);
  const sources = JSON.parse(readFileSync(join(project,'third-party/sources.json'),'utf8'));
  for (const source of sources) {
    const bytes = readFileSync(join(base,'third-party/sources',source.file));
    if (digest(bytes) !== source.sha256) throw new Error(`Distribution source mismatch: ${source.file}`);
  }
  const inventory = readFileSync(join(base,'third-party/inventory.json'));
  if (digest(inventory) !== digest(readFileSync(join(project,'third-party/inventory.json')))) throw new Error('Distribution inventory differs');
  console.log(`Verified notices, inventory and all ${sources.length} corresponding-source archives in ${base}`);
}
