(function(){
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const messages = document.getElementById('messages');

  function appendMessage(text, who = 'bot'){
    const el = document.createElement('div');
    el.className = `msg ${who}`;

    // if message looks like code (``` fenced or starts with 4-space), render a code block
    if (/^```[\s\S]*```$/.test(text.trim()) || /^\s{4}/m.test(text)){
      // strip fenced code markers if present
      const fenceMatch = text.match(/```(?:[a-zA-Z0-9-_]+)?\n([\s\S]*?)\n```/);
      const code = fenceMatch ? fenceMatch[1] : text;
      const pre = document.createElement('pre');
      pre.className = 'code';
      pre.textContent = code;

      const wrapper = document.createElement('div');
      wrapper.appendChild(pre);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', ()=>{
        navigator.clipboard.writeText(code).then(()=>{
          copyBtn.textContent = 'Copied';
          setTimeout(()=>copyBtn.textContent='Copy',1200);
        });
      });

      wrapper.appendChild(copyBtn);
      el.appendChild(wrapper);
    } else {
      el.textContent = text;
    }

    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping(){
    const el = document.createElement('div');
    el.className = 'msg bot typing';
    el.id = 'typing-indicator';
    el.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping(){
    const t = document.getElementById('typing-indicator');
    if(t) t.remove();
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const text = input.value.trim();
    if(!text) return;
    appendMessage(text, 'user');
    input.value='';

    showTyping();

    try{
      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ message: text })
      });

      hideTyping();

      if(res.status === 404){
        appendMessage('Chat endpoint not found on this host (expected /api/chat). Ensure your serverless function is deployed and GIMINI_API is set in Vercel.', 'bot');
        return;
      }
      if(res.status === 429){
        const j = await res.json().catch(()=>({ error: 'Rate limited' }));
        appendMessage(j.error || 'Rate limit exceeded: 5 questions per 24 hours per IP.', 'bot');
        return;
      }

      const j = await res.json();
      if(j.error) appendMessage(j.error, 'bot');
      else appendMessage(j.reply || JSON.stringify(j), 'bot');

    }catch(err){
      hideTyping();
      console.error(err);
      appendMessage('Network or server error. Check the browser console for details.', 'bot');
    }
  });

  // keyboard shortcut: Enter to send, Shift+Enter for newline
  input.addEventListener('keydown',(e)=>{
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // friendly local hint (not authoritative)
  const LOCAL_KEY = 'pytml_bot_local_count';
  function incrLocal(){
    try{
      const v = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      const now = Date.now();
      v.push(now);
      const cutoff = now - 24*60*60*1000;
      const filtered = v.filter(t=>t>cutoff);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(filtered));
      return filtered.length;
    }catch(e){ return null }
  }
  form.addEventListener('submit', ()=>{
    const c = incrLocal();
    if(c) console.log('Local friendly count for this browser (not authoritative):', c);
  });

})();
