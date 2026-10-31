// TRELLIS.2 (trellis.cpp) bridge: uses the user's existing "Trellis Studio" installation
// (config in %APPDATA%\trellis-studio\config.json), starts trellis-server and sends images to it.
const { app, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const { spawn } = require('child_process');

const ai = require('./ai.cjs');
const REPO = 'pwilkin/trellis.cpp';
const REL_BASE = process.env.ACE_TRELLIS_REL || `https://github.com/${REPO}/releases/latest/download`;
const HF_BASE = process.env.ACE_TRELLIS_HF || 'https://huggingface.co/ilintar/trellis2-gguf/resolve/main';
const WEIGHTS = ['birefnet.gguf', 'dinov3.gguf', 'ss_flow.gguf', 'ss_dec.gguf', 'shape_flow_512.gguf', 'shape_flow_1024.gguf', 'shape_dec.gguf', 'tex_flow_512.gguf', 'tex_flow_1024.gguf', 'tex_dec.gguf'];
const QUANTS = { f16: { sub: '', gb: 16.5 }, q8: { sub: 'q8/', gb: 9.5 }, q4: { sub: 'q4/', gb: 6 } };
const OWN_PORT = 8092;
let instAbort = null;
const INSTALL_CMD = 'irm https://raw.githubusercontent.com/pwilkin/trellis.cpp/main/install/install.ps1 | iex';
let child = null;
let starting = null;
let logBuf = [];
let busy = false;
let getWin = () => null;

const cfgFile = () => process.env.ACE_TRELLIS_CFG || path.join(app.getPath('appData'), 'trellis-studio', 'config.json');
const modelDir = (charId) => path.join(app.getPath('userData'), 'models3d', String(charId).replace(/[^\w-]/g, ''));

async function readCfg() {
  if (!process.env.ACE_TRELLIS_CFG) {
    const c = (await ai.readAiCfg()).trellis;
    if (c?.serverBin && fs.existsSync(c.serverBin)) return { own: true, serverBin: c.serverBin, modelsDir: c.modelsDir, gpu: 0, host: '127.0.0.1', port: OWN_PORT, backend: c.backend, quant: c.quant, version: c.version };
  }
  try {
    const raw = (await fsp.readFile(cfgFile(), 'utf8')).replace(/^﻿/, '');
    const c = JSON.parse(raw);
    return { serverBin: c.serverBin, modelsDir: c.modelsDir, gpu: c.gpu ?? 0, host: c.host || '127.0.0.1', port: Number(c.port) || 8080, backend: c.backend };
  } catch { return null; }
}

function send(ch, d) { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, d); }
function log(line) {
  const s = String(line).replace(/\r/g, '').trim(); if (!s) return;
  for (const l of s.split('\n')) { logBuf.push(l); send('trellis:log', l); }
  if (logBuf.length > 400) logBuf = logBuf.slice(-300);
}

function req(cfg, method, p, { body, headers, timeout } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: cfg.host, port: cfg.port, method, path: p, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    r.on('error', reject);
    if (timeout) r.setTimeout(timeout, () => r.destroy(new Error('timeout')));
    if (body) r.write(body);
    r.end();
  });
}
async function healthy(cfg) {
  try { const r = await req(cfg, 'GET', '/health', { timeout: 1500 }); return r.status === 200; } catch { return false; }
}

async function findFile(dir, name, depth = 3) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name.toLowerCase() === name) return p;
    if (e.isDirectory() && depth > 0) { const r = await findFile(p, name, depth - 1); if (r) return r; }
  }
  return null;
}

async function latestTag() {
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { 'User-Agent': 'Ascandir-CharacterEditor' } });
    if (r.ok) return (await r.json()).tag_name || null;
  } catch { /* offline */ }
  return null;
}

// own installation: runtime from the trellis.cpp GitHub release + TRELLIS.2 GGUF weights, into <AI folder>/trellis
async function install({ quant = 'f16', runtimeOnly = false } = {}) {
  if (process.platform !== 'win32' && !process.env.ACE_AI_TEST) throw new Error('only available on Windows');
  if (instAbort) throw new Error('installation already running');
  const acfg = await ai.readAiCfg();
  const base = path.join(acfg.dir || app.getPath('userData'), 'trellis');
  const backend = acfg.gpu === 'nvidia' ? 'cuda' : 'vulkan'; // Vulkan is the self-contained choice for AMD
  const q = QUANTS[quant] ? quant : 'f16';
  instAbort = new AbortController(); const signal = instAbort.signal;
  try {
    stop();
    const runtimeDir = path.join(base, 'runtime');
    const zip = path.join(base, 'downloads', `trellis-${backend}-windows-x64.zip`);
    await ai.download(`${REL_BASE}/trellis-${backend}-windows-x64.zip`, zip, 'TRELLIS runtime', signal);
    await fsp.rm(runtimeDir, { recursive: true, force: true });
    send('ai:progress', { phase: 'extract', label: 'TRELLIS runtime', pct: 0 });
    await ai.extract(zip, runtimeDir, 'TRELLIS runtime');
    await fsp.rm(zip, { force: true });
    const serverBin = await findFile(runtimeDir, 'trellis-server.exe');
    if (!serverBin) throw new Error('trellis-server.exe not found after extraction');
    const modelsDir = path.join(base, 'models-' + q);
    if (!runtimeOnly) {
      for (const w of WEIGHTS) {
        const dest = path.join(modelsDir, w);
        if (fs.existsSync(dest)) continue;
        await ai.download(`${HF_BASE}/${QUANTS[q].sub}${w}`, dest, 'TRELLIS.2 – ' + w, signal);
      }
    }
    const c = await ai.readAiCfg();
    c.trellis = { serverBin, modelsDir: runtimeOnly && c.trellis?.modelsDir ? c.trellis.modelsDir : modelsDir, backend, quant: runtimeOnly ? c.trellis?.quant || q : q, version: await latestTag() };
    await ai.writeAiCfg(c);
    send('ai:progress', { phase: 'done' });
    return true;
  } finally { instAbort = null; send('trellis:state', {}); }
}

async function status() {
  const cfg = await readCfg();
  const installed = !!(cfg?.serverBin && fs.existsSync(cfg.serverBin));
  const modelsOk = !!(cfg?.modelsDir && fs.existsSync(path.join(cfg.modelsDir, 'shape_flow_1024.gguf')));
  const running = installed && await healthy(cfg);
  return { supported: process.platform === 'win32' || !!process.env.ACE_TRELLIS_CFG, installed, own: !!cfg?.own, modelsOk, running, starting: !!starting, busy, installing: !!instAbort, external: running && !child, cfg: cfg ? { ...cfg } : null, cfgFile: cfgFile(), quants: QUANTS };
}

async function start() {
  const cfg = await readCfg();
  if (!cfg?.serverBin || !fs.existsSync(cfg.serverBin)) throw new Error('TRELLIS not installed');
  if (await healthy(cfg)) return true; // already running (e.g. Trellis Studio is open)
  if (starting) return starting;
  starting = (async () => {
    log(`starting ${cfg.serverBin} (${cfg.backend || '?'}, port ${cfg.port})`);
    child = spawn(cfg.serverBin, ['--models', cfg.modelsDir, '--gpu', String(cfg.gpu), '--host', cfg.host, '--port', String(cfg.port)],
      { cwd: path.dirname(cfg.serverBin), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', d => log(d));
    child.stderr.on('data', d => log(d));
    child.on('exit', code => { log('trellis-server exited (' + code + ')'); child = null; send('trellis:state', {}); });
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      if (!child) throw new Error('trellis-server stopped:\n' + logBuf.slice(-8).join('\n'));
      if (await healthy(cfg)) { send('trellis:state', {}); return true; }
      await new Promise(r => setTimeout(r, 700));
    }
    throw new Error('trellis-server did not start within 2 minutes');
  })();
  try { return await starting; } finally { starting = null; }
}

function stop() {
  if (!child) return;
  const pid = child.pid;
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
  else child.kill();
  child = null;
}

function multipart(fields, file) {
  const b = '----ace' + Math.random().toString(16).slice(2);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="image"; filename="input.png"\r\nContent-Type: image/png\r\n\r\n`));
  parts.push(file, Buffer.from(`\r\n--${b}--\r\n`));
  return { body: Buffer.concat(parts), type: 'multipart/form-data; boundary=' + b };
}

async function generate({ charId, image, seed, resolution, texture, faces }) {
  if (busy) throw new Error('already generating');
  busy = true; send('trellis:state', {});
  const t0 = Date.now();
  const timer = setInterval(() => send('trellis:gen', { seconds: Math.round((Date.now() - t0) / 1000) }), 1000);
  try {
    // free the GPU memory held by the image AI before TRELLIS loads its models
    try { await ai.stopComfy(); log('image AI (ComfyUI) stopped to free GPU memory'); } catch { /* not running */ }
    await start();
    const cfg = await readCfg();
    const png = Buffer.from(String(image).split(',').pop(), 'base64');
    const { body, type } = multipart({ seed: seed ?? 42, resolution: resolution || 1024, texture: texture === false ? 'off' : null, faces: faces || null }, png);
    log(`generate: res ${resolution}, seed ${seed}${texture === false ? ', no texture' : ''}`);
    const r = await req(cfg, 'POST', '/generate', { body, headers: { 'Content-Type': type, 'Content-Length': body.length } });
    if (r.status !== 200 || !/gltf/.test(r.type)) {
      let msg = r.body.toString('utf8');
      try { msg = JSON.parse(msg).error || msg; } catch { /* plain text */ }
      throw new Error('TRELLIS: ' + (msg || 'HTTP ' + r.status));
    }
    const dir = modelDir(charId); await fsp.mkdir(dir, { recursive: true });
    const name = 'm' + Date.now() + '.glb';
    await fsp.writeFile(path.join(dir, name), r.body);
    // keep the input image next to the model
    await fsp.writeFile(path.join(dir, name.replace(/\.glb$/, '.png')), png);
    return { name, size: r.body.length, seconds: Math.round((Date.now() - t0) / 1000) };
  } finally {
    clearInterval(timer); busy = false; send('trellis:state', {});
  }
}

function register(winGetter) {
  getWin = winGetter;
  ipcMain.handle('trellis:status', () => status());
  ipcMain.handle('trellis:start', () => start());
  ipcMain.handle('trellis:stop', () => { stop(); return true; });
  ipcMain.handle('trellis:log', () => logBuf.slice(-80).join('\n'));
  ipcMain.handle('trellis:generate', (_e, p) => generate(p));
  ipcMain.handle('trellis:load', async (_e, { charId, name }) => {
    const b = await fsp.readFile(path.join(modelDir(charId), path.basename(name)));
    return new Uint8Array(b.buffer, b.byteOffset, b.length);
  });
  ipcMain.handle('trellis:delete', async (_e, { charId, name }) => {
    for (const f of [name, name.replace(/\.glb$/, '.png')]) await fsp.unlink(path.join(modelDir(charId), path.basename(f))).catch(() => {});
    return true;
  });
  ipcMain.handle('trellis:export', async (e, { charId, name, defaultName }) => {
    const win = getWin();
    const r = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters: [{ name: 'GLB', extensions: ['glb'] }] });
    if (r.canceled || !r.filePath) return null;
    await fsp.copyFile(path.join(modelDir(charId), path.basename(name)), r.filePath);
    return r.filePath;
  });
  ipcMain.handle('trellis:setup', (_e, o) => install(o || {}));
  ipcMain.handle('trellis:cancel', () => { instAbort?.abort(); return true; });
  ipcMain.handle('trellis:updates', async () => { const cfg = await readCfg(); const latest = await latestTag(); return { own: !!cfg?.own, installed: cfg?.version || null, latest, update: !!(cfg?.own && latest && cfg.version && latest !== cfg.version) }; });
  ipcMain.handle('trellis:install', async () => {
    // visible PowerShell window running the official one-line installer
    spawn('cmd.exe', ['/c', 'start', 'powershell', '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', INSTALL_CMD], { detached: true, stdio: 'ignore' }).unref();
    return true;
  });
  ipcMain.handle('trellis:openDir', async (_e, charId) => { const d = modelDir(charId); await fsp.mkdir(d, { recursive: true }); shell.openPath(d); return true; });
  app.on('before-quit', () => { stop(); });
}

module.exports = { register, stop, _test: { multipart, readCfg, generate, status, stop, install } };
