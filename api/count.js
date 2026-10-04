// api/count.js
const REPO = 'NodeX-AR/Pytml';
const PATH = 'count.json';
const FLUSH_MS = 60_000;
const FLUSH_THRESHOLD = 25;

let buffer = { total: 0, origins: {} };
let cachedTotal = 0;
let lastFlush = 0;
let flushing = null;

async function readCount(token) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!r.ok) throw new Error('read failed');
  const data = await r.json();
  const text = Buffer.from(data.content, 'base64').toString('utf-8');
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { parsed = { total: parseInt(text) || 0, origins: {} }; }
  return { data: parsed, sha: data.sha };
}

async function writeCount(token, payload, sha) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Count: ${payload.total}`,
      content: Buffer.from(JSON.stringify(payload, null, 2)).toString('base64'),
      sha
    })
  });
  if (!r.ok) throw new Error('write failed');
}

function flush() {
  if (flushing || buffer.total === 0) return flushing;
  const token = process.env.GITHUB_TOKEN;
  const snapshot = buffer;
  buffer = { total: 0, origins: {} };
  lastFlush = Date.now();

  flushing = (async () => {
    try {
      const { data, sha } = await readCount(token);
      data.total = (data.total || 0) + snapshot.total;
      data.origins = data.origins || {};
      for (const [o, n] of Object.entries(snapshot.origins)) {
        data.origins[o] = (data.origins[o] || 0) + n;
      }
      data.lastUpdated = new Date().toISOString();
      await writeCount(token, data, sha);
      cachedTotal = data.total;
    } catch (err) {
      buffer.total += snapshot.total;
      for (const [o, n] of Object.entries(snapshot.origins)) {
        buffer.origins[o] = (buffer.origins[o] || 0) + n;
      }
      console.error('flush failed:', err);
    } finally {
      flushing = null;
    }
  })();

  return flushing;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  let origin = req.headers.origin || '';
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch {}
  }
  if (!origin) origin = 'unknown';

  buffer.total += 1;
  buffer.origins[origin] = (buffer.origins[origin] || 0) + 1;

  if (buffer.total >= FLUSH_THRESHOLD || Date.now() - lastFlush >= FLUSH_MS) {
    flush().catch(() => {});
  }

  res.status(200).json({
    schemaVersion: 1,
    label: 'pytml loads',
    message: String(cachedTotal + buffer.total),
    color: 'blue'
  });
}
