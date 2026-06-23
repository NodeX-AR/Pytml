// api/badge.js
// This file generates the actual badge image

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    // Get the count (same logic as count.js)
    // For Vercel KV (uncomment if you have KV set up)
    // const { kv } = await import('@vercel/kv');
    // let count = await kv.get('pytml_count') || 0;

    // Option B: Simple in-memory counter
    let count = global.pytmlCount || 0;

    // Generate SVG badge
    const svg = `
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
    `;

    res.status(200).send(svg);
  } catch (error) {
    console.error('Error:', error);
    // Return a fallback badge
    res.status(200).send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="140" height="20">
        <rect width="140" height="20" fill="#555"/>
        <text x="10" y="14" fill="white" font-family="monospace" font-size="11">
          pytml loads: error
        </text>
      </svg>
    `);
  }
}
