// Local AI service: installs ComfyUI (portable, AMD ROCm or NVIDIA) + image models, starts/stops it and runs generations.
// Never touches graphics drivers.
const { app, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn, execFile } = require('child_process');

const CATALOG_URL = 'https://raw.githubusercontent.com/Ascandir/Ascandir---CharacterEditor/main/ai-catalog.json';
const COMFY_RELEASE_API = 'https://api.github.com/repos/comfyanonymous/ComfyUI/releases/latest';
const UA = { 'User-Agent': 'Ascandir-CharacterEditor' };

const DEFAULT_CATALOG = {
  version: 1,
  comfy: {
    amd: 'https://github.com/comfyanonymous/ComfyUI/releases/latest/download/ComfyUI_windows_portable_amd.7z',
    nvidia: 'https://github.com/comfyanonymous/ComfyUI/releases/latest/download/ComfyUI_windows_portable_nvidia.7z',
  },
  // sizes are approximate (for display only)
  models: [
    {
      id: 'z-image-turbo', name: 'Z-Image Turbo', version: '1', recommended: true, minVramGB: 12, kind: 'image',
      note: { de: 'Schnelles, sehr realistisches Bildmodell (6 Mrd. Parameter, Apache 2.0)', en: 'Fast, very realistic image model (6B parameters, Apache 2.0)' },
      files: [
        { url: 'https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/diffusion_models/z_image_turbo_bf16.safetensors', dest: 'models/diffusion_models/z_image_turbo_bf16.safetensors', size: 12309866400 },
        { url: 'https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/text_encoders/qwen_3_4b.safetensors', dest: 'models/text_encoders/qwen_3_4b.safetensors', size: 8044982048 },
        { url: 'https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors', dest: 'models/vae/ae.safetensors', size: 335304388 },
      ],
    },
    {
      id: 'birefnet', name: 'BiRefNet', version: '1', recommended: true, minVramGB: 2, kind: 'background',
      note: { de: 'Entfernt den Hintergrund sauber (erkennt die Figur, auch bei Verläufen)', en: 'Removes the background cleanly (detects the figure, also with gradients)' },
      files: [
        { url: 'https://huggingface.co/Comfy-Org/BiRefNet/resolve/main/background_removal/birefnet.safetensors', dest: 'models/background_removal/birefnet.safetensors', size: 444000000 },
      ],
    },
  ],
};

let win = null;
let proc = null; let procLog = []; let port = 8189; let idleTimer = null; let lastUse = 0;
let abort = null;
// test hooks: use an already running ComfyUI / allow install on non-Windows
const EXTERNAL = process.env.ACE_COMFY_PORT ? Number(process.env.ACE_COMFY_PORT) : 0;
const ALLOW_ANY_OS = !!process.env.ACE_AI_TEST;
if (EXTERNAL) port = EXTERNAL;

const cfgFile = () => path.join(app.getPath('userData'), 'ai-config.json');
async function readCfg() { try { return JSON.parse(await fsp.readFile(cfgFile(), 'utf8')); } catch { return {}; } }
async function writeCfg(c) { await fsp.writeFile(cfgFile(), JSON.stringify(c, null, 2), 'utf8'); }
const send = (ch, data) => { try { win?.webContents.send(ch, data); } catch { /* window gone */ } };
const log = (line) => { procLog.push(line); if (procLog.length > 400) procLog = procLog.slice(-300); };

async function getCatalog() {
  try {
    const r = await fetch(CATALOG_URL, { headers: UA });
    if (r.ok) { const c = await r.json(); if (c && c.models && c.comfy) return c; }
  } catch { /* offline: built-in catalog */ }
  return DEFAULT_CATALOG;
}

async function findComfyRoot(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  for (const name of await fsp.readdir(dir)) {
    const p = path.join(dir, name);
    if (fs.existsSync(path.join(p, 'python_embeded')) && fs.existsSync(path.join(p, 'ComfyUI', 'main.py'))) return p;
  }
  return null;
}

async function freeSpaceGB(dir) {
  try { const s = await fsp.statfs(dir); return (s.bavail * s.bsize) / 1e9; } catch { return null; }
}

async function status() {
  const cfg = await readCfg();
  const root = await findComfyRoot(cfg.dir);
  const models = {};
  for (const [id, info] of Object.entries(cfg.models || {})) {
    models[id] = { ...info, present: !!root && (info.files || []).every(f => fs.existsSync(path.join(root, 'ComfyUI', f))) };
  }
  let running = false;
  if (proc) { try { running = (await fetch(`http://127.0.0.1:${port}/system_stats`)).ok; } catch { running = false; } }
  return {
    platform: process.platform, supported: process.platform === 'win32',
    dir: cfg.dir || null, defaultDir: path.join(app.getPath('userData'), 'ai'), gpu: cfg.gpu || null,
    comfyInstalled: !!root, comfyVersion: cfg.comfyVersion || null, models, running, starting: !!proc && !running,
    freeGB: cfg.dir ? await freeSpaceGB(cfg.dir) : await freeSpaceGB(app.getPath('userData')),
    setupDone: !!cfg.setupDone, setupSkipped: !!cfg.setupSkipped, idleMinutes: cfg.idleMinutes ?? 10,
  };
}

// ---------- downloads with resume ----------
async function download(url, dest, label, signal) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const part = dest + '.part';
  let have = fs.existsSync(part) ? (await fsp.stat(part)).size : 0;
  const headers = { ...UA };
  if (have) headers.Range = `bytes=${have}-`;
  let res;
  try { res = await fetch(url, { headers, signal, redirect: 'follow' }); } catch (e) { throw new Error(`${label}: no connection (${e.cause?.code || e.message})`); }
  if (res.status === 416) { await fsp.rename(part, dest); return; }
  if (!res.ok && res.status !== 206) throw new Error(`Download ${label}: HTTP ${res.status}`);
  if (res.status === 200) have = 0; // server ignored range
  const total = have + (Number(res.headers.get('content-length')) || 0);
  const out = fs.createWriteStream(part, { flags: have ? 'a' : 'w' });
  let got = have; let t0 = Date.now(); let b0 = got; let last = 0;
  try {
    for await (const chunk of res.body) {
      if (!out.write(chunk)) await new Promise(r => out.once('drain', r));
      got += chunk.length;
      const now = Date.now();
      if (now - last > 400) {
        const speed = (got - b0) / Math.max(0.001, (now - t0) / 1000);
        send('ai:progress', { phase: 'download', label, got, total, pct: total ? Math.floor(got / total * 100) : 0, speed });
        last = now; if (now - t0 > 5000) { t0 = now; b0 = got; }
      }
    }
  } catch (e) {
    await new Promise(r => out.end(r));
    if (signal?.aborted) throw new Error('cancelled');
    throw new Error(`${label}: download interrupted at ${Math.round(got / 1e6)} MB (${e.cause?.code || e.message})`);
  }
  await new Promise(r => out.end(r));
  if (total && got < total) throw new Error(`Download ${label} incomplete`);
  await fsp.rename(part, dest);
}

function sevenZipPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, '7za.exe');
  try { return require('7zip-bin').path7za; } catch { return '7za'; }
}
function extract(archive, outDir, label) {
  return new Promise((resolve, reject) => {
    const p = spawn(sevenZipPath(), ['x', archive, '-o' + outDir, '-y', '-bsp1', '-bso0'], { windowsHide: true });
    p.stdout.on('data', d => { const m = /(\d+)%/.exec(String(d)); if (m) send('ai:progress', { phase: 'extract', label, pct: Number(m[1]) }); });
    p.stderr.on('data', d => log(String(d)));
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error('7-Zip exit ' + code))));
  });
}

async function install({ dir, gpu, models: modelIds, comfy: doComfy = true }) {
  if (process.platform !== 'win32' && !ALLOW_ANY_OS) throw new Error('AI setup is only available on Windows');
  await fsp.mkdir(dir, { recursive: true });
  const catalog = await getCatalog();
  const cfg = await readCfg();
  cfg.dir = dir; cfg.gpu = gpu; cfg.models = cfg.models || {};
  await writeCfg(cfg);
  abort = new AbortController();
  const signal = abort.signal;
  try {
    let root = await findComfyRoot(dir);
    if (doComfy || !root) {
      await stop();
      const url = catalog.comfy[gpu] || catalog.comfy.amd;
      const archive = path.join(dir, 'downloads', path.basename(new URL(url).pathname));
      await download(url, archive, 'ComfyUI', signal);
      send('ai:progress', { phase: 'extract', label: 'ComfyUI', pct: 0 });
      await extract(archive, dir, 'ComfyUI');
      await fsp.rm(archive, { force: true });
      root = await findComfyRoot(dir);
      if (!root) throw new Error('ComfyUI folder not found after extraction');
      try { const r = await fetch(COMFY_RELEASE_API, { headers: UA }); if (r.ok) cfg.comfyVersion = (await r.json()).tag_name; } catch { /* ignore */ }
      await writeCfg(cfg);
    }
    for (const id of modelIds || []) {
      const m = catalog.models.find(x => x.id === id);
      if (!m) continue;
      for (const f of m.files) {
        const dest = path.join(root, 'ComfyUI', f.dest);
        if (fs.existsSync(dest) && cfg.models[id]?.version === m.version) continue; // .part files are renamed only when complete
        if (fs.existsSync(dest)) await fsp.rm(dest, { force: true });
        await download(f.url, dest, m.name + ' – ' + path.basename(f.dest), signal);
      }
      cfg.models[id] = { version: m.version, name: m.name, files: m.files.map(f => f.dest) };
      await writeCfg(cfg);
    }
    cfg.setupDone = true; cfg.setupSkipped = false;
    await writeCfg(cfg);
    send('ai:progress', { phase: 'done' });
    return true;
  } finally { abort = null; }
}

// ---------- start / stop ----------
async function launchArgs(root) {
  // reuse what the bundled start script does (env vars + flags)
  const env = { ...process.env };
  let args = ['--windows-standalone-build'];
  for (const bat of ['run_amd_gpu.bat', 'run_nvidia_gpu.bat']) {
    const p = path.join(root, bat);
    if (!fs.existsSync(p)) continue;
    const txt = await fsp.readFile(p, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const s = /^\s*set\s+"?([A-Za-z0-9_]+)=([^"]*)"?\s*$/i.exec(line);
      if (s) env[s[1]] = s[2];
      const m = /main\.py\s+(.*)$/i.exec(line);
      if (m) args = m[1].split(/\s+/).filter(a => a && !/^%|pause/i.test(a));
    }
    break;
  }
  args = args.filter(a => !['--listen', '--port'].includes(a));
  return { env, args: [...args, '--disable-auto-launch', '--listen', '127.0.0.1', '--port', String(port)] };
}

async function start() {
  if (EXTERNAL) return (await fetch(`http://127.0.0.1:${port}/system_stats`)).json();
  if (process.platform !== 'win32') throw new Error('AI is only available on Windows');
  if (proc) return waitReady();
  const cfg = await readCfg();
  const root = await findComfyRoot(cfg.dir);
  if (!root) throw new Error('ComfyUI is not installed');
  const { env, args } = await launchArgs(root);
  procLog = [];
  proc = spawn(path.join(root, 'python_embeded', 'python.exe'), ['-s', path.join('ComfyUI', 'main.py'), ...args], { cwd: root, env, windowsHide: true });
  proc.stdout.on('data', d => log(String(d)));
  proc.stderr.on('data', d => log(String(d)));
  proc.on('close', code => { log('ComfyUI exited ' + code); proc = null; send('ai:state', { running: false }); });
  return waitReady();
}
async function waitReady(timeoutMs = 600000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (!proc) throw new Error('ComfyUI stopped: ' + procLog.slice(-8).join(' ').slice(-600));
    try { const r = await fetch(`http://127.0.0.1:${port}/system_stats`); if (r.ok) { send('ai:state', { running: true }); touch(); return await r.json(); } } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('ComfyUI did not start in time');
}
function stop() {
  return new Promise(resolve => {
    if (!proc) return resolve(true);
    const pid = proc.pid;
    if (process.platform === 'win32') execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve(true));
    else { proc.kill(); resolve(true); }
  });
}
async function touch() {
  lastUse = Date.now();
  clearTimeout(idleTimer);
  const cfg = await readCfg();
  const mins = cfg.idleMinutes ?? 10;
  if (mins > 0) idleTimer = setTimeout(() => { if (Date.now() - lastUse >= mins * 60000) stop(); }, mins * 60000 + 1000);
}

// ---------- workflows ----------
function zImageWorkflow({ prompt, seed, width = 832, height = 1216, steps = 8, batch = 1, initImage = null, denoise = 1, removeBg = false }) {
  const w = {
    28: { class_type: 'UNETLoader', inputs: { unet_name: 'z_image_turbo_bf16.safetensors', weight_dtype: 'default' } },
    30: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'lumina2', device: 'default' } },
    29: { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
    11: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['28', 0], shift: 3 } },
    27: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['30', 0] } },
    33: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['27', 0] } },
    3: { class_type: 'KSampler', inputs: { model: ['11', 0], positive: ['27', 0], negative: ['33', 0], latent_image: ['13', 0], seed, steps, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple', denoise } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['29', 0] } },
    9: { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: 'ascandir/char' } },
  };
  if (removeBg) { // BiRefNet (ComfyUI core nodes), same chain as the official template
    w[50] = { class_type: 'LoadBackgroundRemovalModel', inputs: { bg_removal_name: 'birefnet.safetensors' } };
    w[51] = { class_type: 'RemoveBackground', inputs: { bg_removal_model: ['50', 0], image: ['8', 0] } };
    w[52] = { class_type: 'InvertMask', inputs: { mask: ['51', 0] } };
    w[53] = { class_type: 'JoinImageWithAlpha', inputs: { image: ['8', 0], alpha: ['52', 0] } };
    w[9].inputs.images = ['53', 0];
  }
  if (initImage) {
    w[40] = { class_type: 'LoadImage', inputs: { image: initImage } };
    w[41] = { class_type: 'ImageScale', inputs: { image: ['40', 0], upscale_method: 'lanczos', width, height, crop: 'center' } };
    w[13] = { class_type: 'VAEEncode', inputs: { pixels: ['41', 0], vae: ['29', 0] } };
    if (batch > 1) { w[42] = { class_type: 'RepeatLatentBatch', inputs: { samples: ['13', 0], amount: batch } }; w[3].inputs.latent_image = ['42', 0]; }
  } else {
    w[13] = { class_type: 'EmptySD3LatentImage', inputs: { width, height, batch_size: batch } };
  }
  return w;
}

async function uploadImage(dataUrl, name) {
  const b64 = String(dataUrl).split(',')[1];
  const form = new FormData();
  form.append('image', new Blob([Buffer.from(b64, 'base64')], { type: 'image/png' }), name);
  form.append('overwrite', 'true');
  const r = await fetch(`http://127.0.0.1:${port}/upload/image`, { method: 'POST', body: form });
  if (!r.ok) throw new Error('Upload failed: HTTP ' + r.status);
  return (await r.json()).name;
}

async function generate(params) {
  await start();
  touch();
  const t0 = Date.now();
  let initImage = null;
  if (params.initImage) initImage = await uploadImage(params.initImage, 'ascandir_init.png');
  const workflow = zImageWorkflow({ ...params, initImage });
  const r = await fetch(`http://127.0.0.1:${port}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow, client_id: 'ascandir' }) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.prompt_id) throw new Error('ComfyUI: ' + JSON.stringify(body.error || body.node_errors || body).slice(0, 500));
  const id = body.prompt_id;
  for (;;) {
    await new Promise(res => setTimeout(res, 1000));
    send('ai:gen', { phase: 'running', seconds: Math.round((Date.now() - t0) / 1000) });
    if (!proc && !EXTERNAL) throw new Error('ComfyUI stopped: ' + procLog.slice(-6).join(' ').slice(-500));
    const h = await (await fetch(`http://127.0.0.1:${port}/history/${id}`)).json().catch(() => ({}));
    const entry = h[id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') throw new Error('ComfyUI error: ' + JSON.stringify(entry.status.messages || '').slice(-600));
    const imgs = Object.values(entry.outputs || {}).flatMap(o => o.images || []);
    if (!imgs.length) { if (entry.status?.completed) throw new Error('No image produced'); continue; }
    const out = [];
    for (const im of imgs) {
      const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || '', type: im.type || 'output' });
      const buf = Buffer.from(await (await fetch(`http://127.0.0.1:${port}/view?${q}`)).arrayBuffer());
      out.push('data:image/png;base64,' + buf.toString('base64'));
    }
    touch();
    return { images: out, seconds: Math.round((Date.now() - t0) / 1000) };
  }
}

async function updates() {
  const cfg = await readCfg();
  const catalog = await getCatalog();
  const out = { comfy: null, models: [] };
  try {
    const r = await fetch(COMFY_RELEASE_API, { headers: UA });
    if (r.ok) { const tag = (await r.json()).tag_name; out.comfy = { installed: cfg.comfyVersion || null, latest: tag, update: !!cfg.comfyVersion && tag !== cfg.comfyVersion }; }
  } catch { /* offline */ }
  for (const m of catalog.models) {
    const inst = cfg.models?.[m.id];
    out.models.push({ id: m.id, name: m.name, note: m.note, recommended: !!m.recommended, minVramGB: m.minVramGB, version: m.version,
      installed: inst?.version || null, update: !!inst && inst.version !== m.version, sizeGB: m.files.reduce((a, f) => a + (f.size || 0), 0) / 1e9 });
  }
  return out;
}

function register(mainWindowGetter) {
  ipcMain.handle('ai:status', async () => { win = mainWindowGetter(); return status(); });
  ipcMain.handle('ai:updates', () => updates());
  ipcMain.handle('ai:install', async (_e, opts) => { win = mainWindowGetter(); return install(opts); });
  ipcMain.handle('ai:cancel', () => { abort?.abort(); return true; });
  ipcMain.handle('ai:start', async () => { win = mainWindowGetter(); await start(); return true; });
  ipcMain.handle('ai:stop', () => stop());
  ipcMain.handle('ai:generate', async (_e, params) => { win = mainWindowGetter(); return generate(params); });
  ipcMain.handle('ai:log', () => procLog.slice(-120).join(''));
  ipcMain.handle('ai:skip', async () => { const c = await readCfg(); c.setupSkipped = true; await writeCfg(c); return true; });
  ipcMain.handle('ai:setIdle', async (_e, mins) => { const c = await readCfg(); c.idleMinutes = mins; await writeCfg(c); return true; });
  ipcMain.handle('ai:chooseDir', async () => {
    const r = await dialog.showOpenDialog(mainWindowGetter(), { properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const dir = path.join(r.filePaths[0], 'Ascandir-AI');
    return { dir, freeGB: await freeSpaceGB(r.filePaths[0]) };
  });
  ipcMain.handle('ai:openDir', async () => { const c = await readCfg(); if (c.dir) await shell.openPath(c.dir); return true; });
  app.on('before-quit', () => { stop(); });
}

module.exports = { register, zImageWorkflow, DEFAULT_CATALOG, _test: { install, generate, download, extract } };
