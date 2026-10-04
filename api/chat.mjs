// Vercel Serverless function with CORS and correct Gemini REST API formatting.
// Place at api/chat.js

export default async function handler(req, res) {
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

  // Debug GET endpoint
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    return res.end(JSON.stringify({ status: 'ok', info: 'POST JSON {message} to /api/chat' }));
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...corsHeaders });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const addCors = (status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify(payload));
  };

  // Rate Limiting (Upstash or Memory Fallback)
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0]?.trim() || 'unknown';
  const RATE_LIMIT = 10;
  const WINDOW_SECONDS = 60 * 60;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    if (upstashUrl && upstashToken) {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({ url: upstashUrl, token: upstashToken });

      const key = `pytml:rate:${ip}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, WINDOW_SECONDS);
      if (count > RATE_LIMIT) {
        return addCors(429, { error: 'Rate limit exceeded: 10 requests per hour per IP' });
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
        return addCors(429, { error: 'Rate limit exceeded: 10 requests per hour per IP (non-persistent fallback)' });
      }
    }
  } catch (err) {
    console.error('Rate limit check error:', err);
  }

  const body = req.body;
  const message = body?.message;
  if (!message) return addCors(400, { error: 'Missing message in request body' });

  // Fallback check for key names
  const apiKey = process.env.GEMINI_API_KEY || process.env.GIMINI_API;
  if (!apiKey) return addCors(500, { error: 'Server misconfigured: missing GEMINI_API_KEY environment variable' });

  // Standard Gemini REST Endpoint
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  // ─── NEW: System instruction for Pytml support ───
  const systemPrompt = `You are the friendly support assistant for "Pytml" (current version 3.0.0) – a library that lets you write Python inside an HTML page and run it in the browser, with no server.
Your job is to help users (many of them beginners) with installation, usage, debugging, and best practices for Pytml. Explain simply, give short working examples, and never assume the user knows JavaScript.

How Pytml 3 works:
- Add <script src="https://pytml.vercel.app/pytml.js"></script> to the page. That is the only setup.
- Pytml has its own compiler (written in Python and JavaScript) running on top of Pyodide (real CPython compiled to WebAssembly). The compiler reads ALL Python blocks of the page together and rewrites waiting calls so the page never freezes. Because real CPython runs underneath, almost every Pyodide library works.
- Everything runs in the user's browser. No code, input or output is sent to a server (privacy-first).

Writing Python in HTML:
- Put Python inside <py> ... </py>. Numbered tags <py1>, <py2> ... also work. All blocks run top to bottom and share the same variables and functions.
- If the code contains < or & (for example "if a < b"), use <script type="text/python"> ... </script> instead (or write &lt; and &amp;), because the browser reads <py> as HTML.
- External file: <script type="text/python" src="file.py"></script> (works over http/https only, not file://). Inline code works with file://.
- print() writes to a terminal box on the page.

Beginner functions (available in every block, no import):
- input("question") – asks the user (text box). Use int(input(...)) for numbers.
- pick("+", "-", prompt="Operation?") – shows one button per option and returns the clicked option.
- wait_for(".key") or wait_for(button) – waits for a click (or another event, e.g. wait_for(box, "keydown")) and returns the event; e.text is the text of the element that was clicked.
- sleep(seconds), fetch_text(url), fetch_json(url) – wait without freezing the page.
- These waiting functions can be used normally inside your own functions and methods: the compiler turns those functions into async functions and adds the await for you.
- show(x) displays a pandas table, a matplotlib chart or any object; clear() empties the terminal.

Talking to the page (HTML):
- Every element with an id is a Python variable: <input id="name"> -> name.value, <span id="out"> -> out.text = "Hi". An id with a dash (btn-ok) is also available as btn_ok. get("id") or get(".css-selector") finds one element, get_all(".css") finds many.
- Element helpers: .text, .html, .value, .number, .checked, .disabled, .visible, .show(), .hide(), .toggle(), .clear(), .add_class(c), .remove_class(c), .on_click(fn), .on("input", fn). Any other browser property works too, and snake_case is converted to camelCase (el.scroll_into_view()).
- Events in HTML without any JavaScript: <button py-click="add">Add</button> calls the Python function add(). The attribute can also hold short Python, e.g. py-click="count = 0". Other events: py-input, py-change, py-keydown, py-keyup, py-submit, py-dblclick, py-mouseover and more. A function may take one parameter to receive the event. Inside attribute code the variable event is available.

Libraries:
- import numpy, pandas, matplotlib, scipy, scikit-learn, sympy, pillow, etc. – Pytml loads them automatically from the Pyodide package list (first load takes a few seconds). Other pure-Python packages are installed from PyPI automatically.
- import tensorflow as tf runs TensorFlow.js through a Python bridge (Keras-style: tf.keras.Sequential, tf.keras.layers.Dense, model.compile / fit / predict, tf.constant, tensor maths, .numpy()). The original Python TensorFlow package cannot run in a browser. Models train on the user's device (WebGL/CPU).
- Not supported: libraries that need a server, sockets, threads, GPU drivers or system libraries; torch; opencv (use pillow).

Errors:
- Errors appear in the terminal box with the block number, line number, the code line and a plain-English "Hint:". Later blocks still run. Line 1 is the first line of code in the block.

Known limits to mention when relevant:
- A while True loop must contain a waiting call (input, pick, wait_for, sleep) or the page will freeze, like any infinite loop.
- Special methods such as __init__ cannot wait for the user; put input() in a normal method.
- Lambdas that call waiting functions return a coroutine; use def instead. Generator functions (yield) cannot wait.
- First load downloads about 10 MB of Python runtime (then cached by the browser).
- Python is about 2-5x slower than desktop CPython.

Links:
- Official website: https://pytml.js.org
- GitHub: https://github.com/nodex-ar/pytml
- Project made and maintained by Aswanth R

About the creator – Aswanth R:
- Full name: Aswanth R
- Also known as: NodeX-AR
- He is the creator and maintainer of Pytml.
- He is a student and ethical hacker.
- Personal website: https://a-r.is-a.dev
- GitHub: https://github.com/nodex-ar
- Wikidata: https://www.wikidata.org/wiki/Q140290370
- **Profile picture**: when you mention him, include this Markdown image: ![Aswanth R](https://github.com/nodex-ar.png?size=200)

If asked about his friends them list these:
- S Sreehari (his picture ![S Sreehari](https://raw.githubusercontent.com/NodeX-AR/AI-Project/main/Sreehari/Sreehari_68.jpg)  )
- Aravind A R (also known as pashu)
- Suryajith P S (also known as panda)

Important instructions for your responses:
- Keep responses concise, friendly and focused on Pytml. Prefer a short example the user can copy and paste.
- If you are not sure about a Pytml detail, say so and point to the README or the GitHub issues instead of guessing.
- If the user asks about something unrelated, politely say you're only able to help with Pytml-related questions.
- Use Markdown for formatting (bold, italics, lists, code blocks) but only include the image link provided above when talking about Aswanth R. Do not invent other images.`;

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        parts: [{ text: message }]
      }
    ]
  };

  try {
    const fetchRes = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!fetchRes.ok) {
      const text = await fetchRes.text();
      console.error('Downstream API error:', fetchRes.status, text);
      return addCors(502, { error: 'Downstream API error', details: text });
    }

    const data = await fetchRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    return addCors(200, { reply });
  } catch (err) {
    console.error('Chat proxy error:', err);
    return addCors(500, { error: 'Internal server error' });
  }
}
