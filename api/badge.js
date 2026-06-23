// api/badge.js
export default async function handler(req, res) {
  // Get current count (same as above)
  let count = global.pytmlCount || 0;
  
  // Set proper headers
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  // Return SVG
  res.send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="20">
      <linearGradient id="b" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
      </linearGradient>
      <mask id="a">
        <rect width="160" height="20" rx="3" fill="#fff"/>
      </mask>
      <g mask="url(#a)">
        <rect width="80" height="20" fill="#555"/>
        <rect x="80" width="80" height="20" fill="#007ec6"/>
        <rect width="160" height="20" fill="url(#b)"/>
      </g>
      <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
        <text x="40" y="14">pytml loads</text>
        <text x="120" y="14">${count}</text>
      </g>
    </svg>
  `);
}
