// Builds pytml.js (the single file people load) from the sources in compiler/.
//   node build.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'compiler');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

let out = read('pytml.src.js');
const embed = {
  PY_COMPILER: read('compiler.py'),
  PY_RUNTIME: read('runtime.py'),
  PY_TFJS: read('tfjs_bridge.py'),
};
for (const [key, text] of Object.entries(embed)) {
  const marker = '/*' + key + "*/''";
  if (!out.includes(marker)) throw new Error('marker missing: ' + key);
  out = out.replace(marker, () => JSON.stringify(text));
}
fs.writeFileSync(path.join(__dirname, 'pytml.js'), out);
console.log('pytml.js built: ' + (out.length / 1024).toFixed(1) + ' KB');
