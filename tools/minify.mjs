// Conservative whitespace minifier for the browser distribution snapshot.
//
// Template literals are copied through untouched. They hold the embedded
// Python modules (where indentation is syntax) and CSS, so stripping their
// leading whitespace would break Python. Everything else gets block comments,
// leading indentation and blank lines removed.

function skipTemplate(src, start) {
  // `start` is the index just after an opening backtick. Returns the index of the closing backtick.
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '`') return i;
    if (ch === '$' && src[i + 1] === '{') {
      i += 2;
      let depth = 1;
      while (i < src.length && depth > 0) {
        const c = src[i];
        if (c === '`') { i = skipTemplate(src, i + 1) + 1; continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        i++;
      }
      continue;
    }
    i++;
  }
  throw new Error('Unterminated template literal while minifying');
}

function minifyCode(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/\n{2,}/g, '\n');
}

export function minify(source) {
  let out = '';
  let last = 0;
  let i = 0;
  while (i < source.length) {
    if (source[i] === '`') {
      const end = skipTemplate(source, i + 1);
      out += minifyCode(source.slice(last, i)) + source.slice(i, end + 1);
      i = end + 1;
      last = i;
      continue;
    }
    i++;
  }
  out += minifyCode(source.slice(last));
  return out.replace(/\n{2,}/g, '\n').trim();
}
