// Starts / stops the user's Strata (local text model, https://github.com/Niko1221/Strata) on demand
// through its Terminal command:  strata launch --preset NAME --yes --no-tui   and   strata launch --stop
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

let startedByUs = false;
let starting = null;
let lastUse = 0;
let idleTimer = null;
let getWin = () => null;
const logBuf = [];

function send(ch, d) { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, d); }
function log(s) { for (const l of String(s).replace(/\r/g, '').split('\n')) if (l.trim()) { logBuf.push(l); send('strata:log', l); } if (logBuf.length > 300) logBuf.splice(0, 100); }

function verCmp(a, b) { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; }

// strata.cmd of the newest installed Terminal, or a path the user set
function findCmd(custom) {
  if (custom && fs.existsSync(custom)) return custom;
  const base = path.join(process.env.LOCALAPPDATA || '', 'Strata', 'terminal');
  try {
    const vers = fs.readdirSync(base).filter(v => /^\d+(\.\d+)*$/.test(v)).sort(verCmp).reverse();
    for (const v of vers) {
      for (const rel of [['bin', 'strata.cmd'], ['strata.cmd']]) {
        const p = path.join(base, v, ...rel);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch { /* not installed */ }
  return null;
}

function run(cmd, args, timeout = 60000) {
  return new Promise(resolve => {
    execFile('cmd.exe', ['/d', '/s', '/c', `"${cmd}" ${args.join(' ')}`], { windowsHide: true, timeout, windowsVerbatimArguments: true, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, PYTHONUTF8: '1', NO_COLOR: '1' } },
      (err, stdout, stderr) => resolve({ code: err ? (err.code ?? 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || '') }));
  });
}
const q = (s) => '"' + String(s).replace(/"/g, '') + '"';

async function reachable(url, key) {
  try {
    const r = await fetch(String(url || 'http://127.0.0.1:8080/v1').replace(/\/+$/, '') + '/models', { headers: key ? { Authorization: 'Bearer ' + key } : {}, signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch { return false; }
}

async function info({ cmd: custom, url, key } = {}) {
  const cmd = process.platform === 'win32' ? findCmd(custom) : null;
  return { supported: process.platform === 'win32', cmd, running: await reachable(url, key), startedByUs, starting: !!starting };
}

async function presets({ cmd: custom } = {}) {
  const cmd = findCmd(custom); if (!cmd) return [];
  const r = await run(cmd, ['launch', '--list-presets', '--output', 'json'], 30000);
  const line = r.stdout.split('\n').reverse().find(l => l.trim().startsWith('{'));
  try { return (JSON.parse(line).presets || []).map(p => ({ name: p.name, model: p.model, context: p.context, lastUsed: p.last_used })); } catch { return []; }
}

async function start({ cmd: custom, preset, url, key }) {
  if (await reachable(url, key)) return { already: true };
  if (starting) return starting;
  const cmd = findCmd(custom);
  if (!cmd) throw new Error('STRATA_NOT_FOUND');
  if (!preset) throw new Error('STRATA_NO_PRESET');
  starting = (async () => {
    log('> strata launch --preset ' + preset + ' --yes --no-tui');
    const p = spawn('cmd.exe', ['/d', '/s', '/c', `"${cmd}" launch --preset ${q(preset)} --yes --no-tui`], { windowsHide: true, windowsVerbatimArguments: true, env: { ...process.env, PYTHONUTF8: '1', NO_COLOR: '1' } });
    let exited = null;
    p.stdout.on('data', log); p.stderr.on('data', log);
    p.on('exit', c => { exited = c; });
    startedByUs = true; send('strata:state', {});
    const t0 = Date.now();
    while (Date.now() - t0 < 30 * 60 * 1000) { // big models can take a while to load
      if (await reachable(url, key)) { lastUse = Date.now(); send('strata:state', {}); return { started: true }; }
      if (exited != null && exited !== 0) { startedByUs = false; throw new Error('Strata: ' + logBuf.slice(-6).join(' | ')); }
      send('strata:progress', { seconds: Math.round((Date.now() - t0) / 1000), line: logBuf[logBuf.length - 1] || '' });
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Strata did not answer within 30 minutes');
  })();
  try { return await starting; } finally { starting = null; send('strata:state', {}); }
}

async function stop({ cmd: custom, force } = {}) {
  if (!startedByUs && !force) return false;
  const cmd = findCmd(custom); if (!cmd) return false;
  log('> strata launch --stop');
  await run(cmd, ['launch', '--stop'], 60000);
  startedByUs = false; send('strata:state', {});
  return true;
}

function touch() { lastUse = Date.now(); }
function setIdle(minutes, opts) {
  clearInterval(idleTimer); idleTimer = null;
  if (!minutes) return;
  idleTimer = setInterval(() => { if (startedByUs && !starting && lastUse && Date.now() - lastUse > minutes * 60000) stop(opts).catch(() => {}); }, 30000);
}

function register(winGetter) {
  getWin = winGetter;
  ipcMain.handle('strata:info', (_e, o) => info(o));
  ipcMain.handle('strata:presets', (_e, o) => presets(o));
  ipcMain.handle('strata:start', (_e, o) => start(o || {}));
  ipcMain.handle('strata:stop', (_e, o) => stop(o || {}));
  ipcMain.handle('strata:touch', () => { touch(); return true; });
  ipcMain.handle('strata:setIdle', (_e, m, o) => { setIdle(m, o); return true; });
  ipcMain.handle('strata:log', () => logBuf.slice(-60).join('\n'));
  app.on('before-quit', () => { if (startedByUs) { const cmd = findCmd(); if (cmd) spawn('cmd.exe', ['/d', '/s', '/c', `"${cmd}" launch --stop`], { windowsHide: true, detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref(); } });
}

module.exports = { register, touch };
