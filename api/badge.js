// api/badge.js
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const token = process.env.GITHUB_TOKEN;
    const repo = 'NodeX-AR/Pytml';
    const path = 'count.json';

    // Get the current count from GitHub
    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    let count = 0;
    if (getRes.ok) {
      const data = await getRes.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      count = parseInt(content) || 0;
    }

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
    res.status(200).send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="20">
        <rect width="160" height="20" fill="#555"/>
        <text x="10" y="14" fill="white" font-family="monospace" font-size="11">
          pytml loads: error
        </text>
      </svg>
    `);
  }
}
