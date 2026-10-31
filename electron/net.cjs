// Internet requests through Chromium's network stack (Electron net.fetch): uses the system proxy and
// Chromium's DNS / IPv4-IPv6 fallback. Node's own fetch failed on some machines ("fetch failed",
// UND_ERR_CONNECT_TIMEOUT) while the browser had no problem. Falls back to Node fetch outside Electron / in tests.
let electron = null;
try { electron = require('electron'); } catch { /* not in electron */ }
async function webFetch(url, opts = {}) {
  const useNet = electron?.net?.fetch && electron.app?.isReady?.() && !process.env.ACE_AI_TEST;
  try {
    return useNet ? await electron.net.fetch(url, opts) : await fetch(url, opts);
  } catch (e) {
    if (useNet) { try { return await fetch(url, opts); } catch { /* report the first error */ } }
    const host = (() => { try { return new URL(url).hostname; } catch { return url; } })();
    const err = new Error(`no connection to ${host} (${e.cause?.code || e.message})`);
    err.cause = e; throw err;
  }
}
module.exports = { webFetch };
