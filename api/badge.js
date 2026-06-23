// api/badge.js
let count = 0;

export default function handler(req, res) {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(`<svg><text x="10" y="20">Loads: ${count}</text></svg>`);
}
