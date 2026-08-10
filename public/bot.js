(function(){
  const form = document.getElementById('form');
  const input = document.getElementById('input');
  const messages = document.getElementById('messages');

  function append(text, cls){
    const el = document.createElement('div');
    el.className = `bubble ${cls}`;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  function showError(msg){
    append(msg, 'bot');
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const text = input.value.trim();
    if(!text) return;
    append(text, 'user');
    input.value = '';

    append('Thinking...', 'bot');
    const lastBot = messages.lastChild;

    try{
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if(res.status === 404){
        lastBot.textContent = 'Chat endpoint not found on this host (expected /api/chat). This page only adds client files; you must add a server-side proxy that uses the GIMINI_API secret.';
        return;
      }

      if(res.status === 429){
        lastBot.textContent = 'Rate limit exceeded: 5 questions per 24 hours per IP.';
        return;
      }

      const j = await res.json();
      if(j.error) lastBot.textContent = j.error;
      else lastBot.textContent = j.reply || JSON.stringify(j);
    }catch(err){
      console.error(err);
      lastBot.textContent = 'Network or server error. Check browser console for details.';
    }
  });

  // optional: keep a local count as a friendly client-side hint (not authoritative)
  const LOCAL_KEY = 'pytml_bot_local_count';
  function incrLocal(){
    try{
      const v = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      const now = Date.now();
      v.push(now);
      // keep only 24h window
      const cutoff = now - 24*60*60*1000;
      const filtered = v.filter(t=>t>cutoff);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(filtered));
      return filtered.length;
    }catch(e){ return null }
  }

  // update header with local count
  form.addEventListener('submit', ()=>{
    const c = incrLocal();
    if(c) console.log('Local friendly count for this browser (not authoritative):', c);
  });

})();
