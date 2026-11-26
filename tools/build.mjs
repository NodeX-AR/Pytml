import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { minify } from './minify.mjs';

const source = await readFile('src/pytml-runtime.js', 'utf8');
await mkdir('dist', { recursive: true });
await writeFile('pytml.js', source, 'utf8');
await writeFile('dist/pytml.js', source, 'utf8');

const minified = minify(source);
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

console.log(`Built Pytml ${source.length} bytes (min ${minified.length}) -> root, dist/, and website/`);
