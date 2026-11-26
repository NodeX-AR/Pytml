// Runs the integration suites. They execute the real runtime with real Pyodide inside jsdom.
//   npm install        (installs the jsdom + pyodide devDependencies)
//   npm run test:integration
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
for (const dep of ['jsdom', 'pyodide']) {
  try { import.meta.resolve(dep); } catch {
    console.error(`Missing devDependency "${dep}". Run "npm install" first.`);
    process.exit(2);
  }
}
let failed = 0;
for (const file of readdirSync(here).filter((f) => f.endsWith('.int.mjs')).sort()) {
  console.log(`\n=== ${file} ===`);
  const result = spawnSync(process.execPath, [path.join(here, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed++;
}
console.log(failed ? `\n${failed} suite(s) FAILED` : '\nAll integration suites passed');
process.exit(failed ? 1 : 0);
