import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const source = await readFile('src/pytml-runtime.js', 'utf8');
await mkdir('dist', { recursive: true });
await writeFile('pytml.js', source, 'utf8');
await writeFile('dist/pytml.js', source, 'utf8');

// Conservative whitespace minifier for the browser distribution snapshot.
const minified = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]+/gm, '')
  .replace(/\n{2,}/g, '\n')
  .trim();
await writeFile('pytml.min.js', minified, 'utf8');
await writeFile('dist/pytml.min.js', minified, 'utf8');

// Keep the website self-contained when it is deployed as a standalone folder.
await mkdir('website', { recursive: true });
await writeFile('website/pytml.js', source, 'utf8');
await writeFile('website/pytml.min.js', minified, 'utf8');

const copyDirs = ['examples'];
for (const dir of copyDirs) {
  await cp(dir, join('website', dir), { recursive: true, force: true });
}

console.log(`Built Pytml ${source.length} bytes -> root, dist/, and website/`);
