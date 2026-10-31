// Bridge to a local OpenAI-compatible text model (e.g. Strata with Qwen3.8-Flash-Next at http://127.0.0.1:8080/v1).
// Runs in the main process so CORS of the local server does not matter. Streams tokens to the renderer.
const { ipcMain } = require('electron');

let current = null; // AbortController of the running request

function base(url) { return String(url || 'http://127.0.0.1:8080/v1').replace(/\/+$/, ''); }
function headers(key) { return { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) }; }

async function models({ url, key }) {
  const r = await fetch(base(url) + '/models', { headers: headers(key), signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json().catch(() => ({}));
  return (j.data || []).map(m => m.id);
}

async function chat(sender, { url, key, model, messages, reasoning, id }) {
  current?.abort();
  const ac = new AbortController(); current = ac;
  const body = { model: model || 'local', messages, stream: true, temperature: 0.7 };
  if (reasoning && reasoning !== 'default') body.reasoning_effort = reasoning;
  let r;
  try {
    r = await fetch(base(url) + '/chat/completions', { method: 'POST', headers: headers(key), body: JSON.stringify(body), signal: ac.signal });
  } catch (e) {
    throw new Error('NO_SERVER');
  }
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 300));
  let full = ''; let think = ''; let buf = '';
  const dec = new TextDecoder();
  try {
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          const d = j.choices?.[0]?.delta || {};
          if (d.reasoning_content || d.reasoning) { think += d.reasoning_content || d.reasoning; sender.send('llm:chunk', { id, think }); }
          if (d.content) { full += d.content; sender.send('llm:chunk', { id, text: full }); }
        } catch { /* keep-alive or partial line */ }
      }
    }
  } catch (e) {
    if (ac.signal.aborted) return { text: full, aborted: true };
    throw e;
  } finally { if (current === ac) current = null; }
  return { text: full, think };
}

function register() {
  ipcMain.handle('llm:models', (_e, o) => models(o || {}));
  ipcMain.handle('llm:chat', (e, o) => chat(e.sender, o));
  ipcMain.handle('llm:stop', () => { current?.abort(); return true; });
}

module.exports = { register };
