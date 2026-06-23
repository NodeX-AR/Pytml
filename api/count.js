// api/count.js
// This file handles the counting logic

// For Vercel KV (persistent storage) - RECOMMENDED
// import { kv } from '@vercel/kv';

// Option A: Using Vercel KV (Recommended - preserves count across deploys)
export default async function handler(req, res) {
  // Enable CORS so any site can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // For Vercel KV (uncomment if you have KV set up)
    // const { kv } = await import('@vercel/kv');
    // let count = await kv.get('pytml_count') || 0;
    // count++;
    // await kv.set('pytml_count', count);

    // Option B: Simple in-memory counter (resets on each deploy)
    let count = global.pytmlCount || 0;
    count++;
    global.pytmlCount = count;

    // Return JSON for Shields.io badge
    res.status(200).json({
      schemaVersion: 1,
      label: "pytml loads",
      message: String(count),
      color: "blue",
      style: "flat"
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(200).json({
      schemaVersion: 1,
      label: "pytml loads",
      message: "error",
      color: "red"
    });
  }
}
