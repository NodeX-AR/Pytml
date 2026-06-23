// api/count.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const token = process.env.GITHUB_TOKEN;
    const repo = 'NodeX-AR/Pytml';
    const path = 'count.json';

    // 1. Get the current count from GitHub
    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!getRes.ok) {
      throw new Error('Failed to fetch count');
    }

    const data = await getRes.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const currentCount = parseInt(content) || 0;
    const newCount = currentCount + 1;

    // 2. Write the new count back to GitHub
    const updateRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Count: ${newCount}`,
          content: Buffer.from(String(newCount)).toString('base64'),
          sha: data.sha
        })
      }
    );

    if (!updateRes.ok) {
      throw new Error('Failed to update count');
    }

    // 3. Return the count
    res.status(200).json({
      schemaVersion: 1,
      label: "pytml loads",
      message: String(newCount),
      color: "blue"
    });

  } catch (error) {
    console.error('Error:', error);
    // Return a fallback
    res.status(200).json({
      schemaVersion: 1,
      label: "pytml loads",
      message: "error",
      color: "red"
    });
  }
}
