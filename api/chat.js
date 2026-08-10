// Vercel Serverless function with CORS and OPTIONS handling.
// Place at api/chat.js

export default async function handler(req, res) {
  // Always allow CORS for the site (restrict origin if you want tighter security)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  // Friendly GET for debugging from browser
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ status: 'ok', info: 'POST JSON {message} to /api/chat' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // From here on, add cors headers to final responses as well
  const addCors = (status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify(payload));
  };

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0]?.trim() || 'unknown';
  const RATE_LIMIT = 5;
  const WINDOW_SECONDS = 24 * 60 * 60;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    if (upstashUrl && upstashToken) {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({ url: upstashUrl, token: upstashToken });

      const key = `pytml:rate:${ip}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, WINDOW_SECONDS);
      }
      if (count > RATE_LIMIT) {
        return addCors(429, { error: 'Rate limit exceeded: 5 requests per 24 hours per IP' });
      }
    } else {
      if (!global._pytml_rate) global._pytml_rate = new Map();
      const entry = global._pytml_rate.get(ip) || { count: 0, first: Date.now() };
      if (Date.now() - entry.first > WINDOW_SECONDS * 1000) {
        entry.count = 0;
        entry.first = Date.now();
      }
      entry.count += 1;
      global._pytml_rate.set(ip, entry);
      if (entry.count > RATE_LIMIT) {
        return addCors(429, { error: 'Rate limit exceeded: 5 requests per 24 hours per IP (non-persistent fallback)' });
      }
    }
  } catch (err) {
    console.error('Rate limit check error:', err);
    // proceed but log
  }

  const body = req.body;
  const message = body?.message;
  if (!message) return addCors(400, { error: 'Missing message in request body' });

  const apiKey = process.env.GIMINI_API;
  if (!apiKey) return addCors(500, { error: 'Server misconfigured: missing GIMINI_API environment variable' });

  const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://api.example.com/v1/generate';
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gpt-4o-mini';

  const payload = { model: GEMINI_MODEL, prompt: message, max_tokens: 800 };

  try {
    const fetchRes = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });

    if (!fetchRes.ok) {
      const text = await fetchRes.text();
      console.error('Downstream API error:', fetchRes.status, text);
      return addCors(502, { error: 'Downstream API error', details: text });
    }

    const data = await fetchRes.json();
    const reply = data?.output_text || data?.choices?.[0]?.message?.content || (typeof data === 'string' ? data : JSON.stringify(data));
    return addCors(200, { reply });
  } catch (err) {
    console.error('Chat proxy error:', err);
    return addCors(500, { error: 'Internal server error' });
  }
}
