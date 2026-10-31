// Local AI service: installs ComfyUI (portable, AMD ROCm or NVIDIA) + image models, starts/stops it and runs generations.
// Never touches graphics drivers.
const electron = require('electron');
const { app, ipcMain, dialog, shell } = electron;
// Chromium's network stack (system proxy, IPv4/IPv6 fallback, longer connect timeouts); plain fetch in tests
const { webFetch } = require('./net.cjs');
const netFetch = webFetch;
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
    {
      id: 'qwen-image-21', name: 'Qwen Image 2.1', version: '1', recommended: false, minVramGB: 16, kind: 'image',
      note: { de: 'Großes Bildmodell (20 Mrd. Parameter): hält sich sehr genau an Beschreibungen, kann Bilder gezielt bearbeiten und Mehrfachansichten aus einer Vorlage malen. Deutlich langsamer.', en: 'Large image model (20B): follows descriptions very closely, can edit pictures and paint multi-angle sheets from a reference. Much slower.' },
      files: [
        { url: 'https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/diffusion_models/qwen_image_2.1_bf16.safetensors', dest: 'models/diffusion_models/qwen_image_2.1_bf16.safetensors', size: 13250000000 },
        { url: 'https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/text_encoders/qwen3vl_8b_bf16.safetensors', dest: 'models/text_encoders/qwen3vl_8b_bf16.safetensors', size: 16330000000 },
        { url: 'https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/vae/qwen_image_2.1_vae_bf16.safetensors', dest: 'models/vae/qwen_image_2.1_vae_bf16.safetensors', size: 644200000 },
      ],
    },
    {
      id: 'upscale', name: 'Real-ESRGAN x4', version: '1', recommended: true, minVramGB: 2, kind: 'upscale',
      note: { de: 'Hochskalierer für 2K/4K-Bilder', en: 'Upscaler for 2K/4K pictures' },
      files: [
        { url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth', dest: 'models/upscale_models/RealESRGAN_x4plus.pth', size: 67040989 },
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
    const r = await webFetch(CATALOG_URL, { headers: UA });
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
    dir: cfg.dir || null, defaultDir: await suggestedDir() || path.join(app.getPath('userData'), 'ai'), programModelsDir: await suggestedDir(), gpu: cfg.gpu || null,
    comfyInstalled: !!root, comfyVersion: cfg.comfyVersion || null, models, running, starting: !!proc && !running,
    freeGB: cfg.dir ? await freeSpaceGB(cfg.dir) : await freeSpaceGB(app.getPath('userData')),
    setupDone: !!cfg.setupDone, setupSkipped: !!cfg.setupSkipped, idleMinutes: cfg.idleMinutes ?? 10, gpuMode: cfg.gpuMode || 'safe',
  };
}

// ---------- downloads with resume ----------
// download with resume and automatic retries (connection drops / timeouts happen on 20 GB files)
async function download(url, dest, label, signal) {
  for (let attempt = 1; ; attempt++) {
    try { return await downloadOnce(url, dest, label, signal); } catch (e) {
      if (signal?.aborted || /HTTP 4\d\d/.test(e.message) || attempt >= 6) throw e;
      log(`${label}: ${e.message} - retry ${attempt}/5`);
      send('ai:progress', { phase: 'download', label: label + ' (retry ' + attempt + ')', pct: 0 });
      await new Promise(r => setTimeout(r, Math.min(30000, 3000 * attempt)));
    }
  }
}
async function downloadOnce(url, dest, label, signal) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const part = dest + '.part';
  let have = fs.existsSync(part) ? (await fsp.stat(part)).size : 0;
  const headers = { ...UA };
  if (have) headers.Range = `bytes=${have}-`;
  let res;
  try { res = await netFetch(url, { headers, signal, redirect: 'follow' }); } catch (e) { throw new Error(`${label}: no connection (${e.cause?.code || e.message})`); }
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
  const cfg = await readCfg();
  // switching folders: move the existing installation instead of downloading everything again
  if (cfg.dir && path.resolve(cfg.dir).toLowerCase() !== path.resolve(dir).toLowerCase() && fs.existsSync(cfg.dir)) {
    const empty = !fs.existsSync(dir) || (await fsp.readdir(dir)).filter(f => !f.startsWith('.')).length === 0;
    if (empty) {
      await stop();
      send('ai:progress', { phase: 'extract', label: 'Moving / Verschieben', pct: 0 });
      try {
        if (fs.existsSync(dir)) await fsp.rmdir(dir);
        await fsp.mkdir(path.dirname(dir), { recursive: true });
        await fsp.rename(cfg.dir, dir);
        if (cfg.trellis) for (const k of ['serverBin', 'modelsDir']) if (cfg.trellis[k]?.startsWith(cfg.dir)) cfg.trellis[k] = dir + cfg.trellis[k].slice(cfg.dir.length);
        log('moved AI folder ' + cfg.dir + ' -> ' + dir);
      } catch (e) { log('move failed (' + e.message + '), installing fresh'); }
    }
  }
  await fsp.mkdir(dir, { recursive: true });
  const catalog = await getCatalog();
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
      try { const r = await webFetch(COMFY_RELEASE_API, { headers: UA }); if (r.ok) cfg.comfyVersion = (await r.json()).tag_name; } catch { /* ignore */ }
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
  // GPU-friendly mode (default on): keep VRAM headroom for Windows/driver, offload more, smaller attention peaks.
  // Prevents driver resets (TDR) with big models such as Qwen Image on 16 GB cards.
  const cfg = await readCfg();
  const mode = cfg.gpuMode || 'safe';
  // newer ComfyUI loads models "dynamically" (pinned RAM + async offload streams); with ROCm on Windows that
  // combination reset the AMD driver for big models, so the gentle mode switches back to classic loading
  const extra = mode === 'safe' ? ['--reserve-vram', '2.5', '--disable-dynamic-vram', '--lowvram', '--disable-pinned-memory', '--disable-async-offload', '--disable-smart-memory', '--use-split-cross-attention', '--cpu-vae']
    : mode === 'balanced' ? ['--reserve-vram', '1.5', '--disable-pinned-memory', '--disable-async-offload'] : [];
  return { env, args: [...args, ...extra, '--disable-auto-launch', '--listen', '127.0.0.1', '--port', String(port)] };
}

async function start() {
  if (EXTERNAL) return (await fetch(`http://127.0.0.1:${port}/system_stats`)).json();
  if (process.platform !== 'win32') throw new Error('AI is only available on Windows');
  if (proc) return waitReady();
  const cfg = await readCfg();
  const root = await findComfyRoot(cfg.dir);
  if (!root) throw new Error('ComfyUI is not installed');
  const { env, args } = await launchArgs(root);
  try { return await spawnComfy(root, env, args); } catch (e) {
    // an older ComfyUI may not know some flags: drop them and try once more
    const m = /unrecognized arguments:\s*([^\n]+)/.exec(procLog.join(''));
    if (!m) throw e;
    const bad = new Set(m[1].trim().split(/\s+/));
    const kept = []; for (let i = 0; i < args.length; i++) { if (bad.has(args[i])) { if (args[i] === '--reserve-vram') i++; continue; } kept.push(args[i]); }
    log('retrying without ' + [...bad].join(' '));
    return spawnComfy(root, env, kept);
  }
}
let logFile = null;
function spawnComfy(root, env, args) {
  procLog = [];
  // the whole log is also written to a file while running (a driver reset can take the app down with it)
  try { logFile = path.join(app.getPath('userData'), 'comfyui.log'); fs.writeFileSync(logFile, new Date().toISOString() + ' start: ' + args.join(' ') + '\n'); } catch { logFile = null; }
  log('args: ' + args.join(' ') + '\n');
  proc = spawn(path.join(root, 'python_embeded', 'python.exe'), ['-s', path.join('ComfyUI', 'main.py'), ...args], { cwd: root, env, windowsHide: true });
  const w = d => { const t = String(d); log(t); if (logFile) fs.appendFile(logFile, t, () => {}); };
  proc.stdout.on('data', w);
  proc.stderr.on('data', w);
  proc.on('close', code => { log('ComfyUI exited ' + code); if (logFile) fs.appendFile(logFile, '\nComfyUI exited ' + code + '\n', () => {}); proc = null; send('ai:state', { running: false }); });
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
function addPost(w, { removeBg, upscale }) {
  let img = ['8', 0];
  if (upscale?.width && upscale?.height) { // 4x model upscale, then exact target size
    w[60] = { class_type: 'UpscaleModelLoader', inputs: { model_name: 'RealESRGAN_x4plus.pth' } };
    w[61] = { class_type: 'ImageUpscaleWithModel', inputs: { upscale_model: ['60', 0], image: ['8', 0] } };
    w[62] = { class_type: 'ImageScale', inputs: { image: ['61', 0], upscale_method: 'lanczos', width: upscale.width, height: upscale.height, crop: 'disabled' } };
    img = ['62', 0]; w[9].inputs.images = img;
  }
  if (removeBg) { // BiRefNet (ComfyUI core nodes), same chain as the official template
    w[50] = { class_type: 'LoadBackgroundRemovalModel', inputs: { bg_removal_name: 'birefnet.safetensors' } };
    w[51] = { class_type: 'RemoveBackground', inputs: { bg_removal_model: ['50', 0], image: img } };
    w[52] = { class_type: 'InvertMask', inputs: { mask: ['51', 0] } };
    w[53] = { class_type: 'JoinImageWithAlpha', inputs: { image: img, alpha: ['52', 0] } };
    w[9].inputs.images = ['53', 0];
  }
}

function zImageWorkflow({ prompt, seed, width = 832, height = 1216, steps = 8, batch = 1, initImage = null, denoise = 1, removeBg = false, upscale = null }) {
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
  addPost(w, { removeBg, upscale });
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

// Qwen Image 2.1 (ComfyUI core nodes): text-to-image, or edit / reference mode when refs are given
function qwenWorkflow({ prompt, negative = '', seed, width = 1024, height = 1024, steps = 40, cfg = 1, batch = 1, refs = [], editLatent = false, resolution = 1024, removeBg = false, upscale = null }) {
  const w = {
    101: { class_type: 'UNETLoader', inputs: { unet_name: 'qwen_image_2.1_bf16.safetensors', weight_dtype: 'default' } },
    102: { class_type: 'QwenImage21Cache', inputs: { model: ['101', 0], device: 'auto', dtype: 'default' } },
    103: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_8b_bf16.safetensors', type: 'qwen_image', device: 'default' } },
    104: { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_2.1_vae_bf16.safetensors' } },
    105: { class_type: 'TextEncodeQwenImage21', inputs: { clip: ['103', 0], prompt, negative_prompt: negative || '', resolution } },
    3: { class_type: 'KSampler', inputs: { model: ['102', 0], positive: ['105', 0], negative: ['105', 1], latent_image: null, seed, steps, cfg, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['104', 0] } },
    9: { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: 'ascandir/char' } },
  };
  refs.forEach((name, i) => {
    w[110 + i] = { class_type: 'LoadImage', inputs: { image: name } };
    w[105].inputs['images.image_' + (i + 1)] = [String(110 + i), 0];
  });
  if (refs.length) w[105].inputs.vae = ['104', 0];
  let lat;
  if (refs.length && editLatent) lat = ['105', 2];
  else { w[106] = { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: editLatent ? 1 : batch } }; lat = ['106', 0]; }
  if (editLatent && batch > 1) { w[107] = { class_type: 'RepeatLatentBatch', inputs: { samples: lat, amount: batch } }; lat = ['107', 0]; }
  w[3].inputs.latent_image = lat;
  addPost(w, { removeBg, upscale });
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

// ComfyUI can be unresponsive for a while under heavy load (upscaling, saving big PNGs): retry while the process lives
async function comfyFetch(url, opts, what) {
  const t0 = Date.now();
  for (let i = 0; ; i++) {
    try { return await fetch(url, opts); } catch (e) {
      await new Promise(r => setTimeout(r, 1500));
      if (!proc && !EXTERNAL) throw new Error(crashText());
      if (Date.now() - t0 > 10 * 60 * 1000) throw new Error(`ComfyUI not reachable (${what}): ${e.cause?.code || e.message}\n` + procLog.slice(-10).join('').slice(-800));
    }
  }
}
function crashText() {
  // drop tqdm progress bars, keep the real messages
  const clean = procLog.join('').replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '\n').split('\n')
    .filter(l => l.trim() && !/\d+%\|.*\|\s*\d+\/\d+/.test(l) && !/^\s*\d+\/\d+\s*\[/.test(l)).slice(-30).join('\n');
  try { fs.writeFileSync(path.join(app.getPath('userData'), 'comfyui-last.log'), procLog.join(''), 'utf8'); } catch { /* ignore */ }
  const oom = /out of memory|OutOfMemory|HIP error|hipErrorOutOfMemory|CUDA error|allocate|MemoryError/i.test(clean);
  return (oom ? 'ComfyUI ran out of memory and stopped. Try a lower resolution or fewer images at once.\n\n' : 'ComfyUI stopped unexpectedly.\n\n')
    + clean.slice(-1200) + '\n\n(Full log: ' + path.join(app.getPath('userData'), 'comfyui-last.log') + ')';
}

async function generate(params) {
  await start();
  touch();
  const t0 = Date.now();
  let workflow;
  if (params.model === 'qwen') {
    const refs = [];
    for (const [i, img] of (params.refImages || []).entries()) refs.push(await uploadImage(img, `ascandir_ref${i + 1}.png`));
    workflow = qwenWorkflow({ ...params, refs });
  } else {
    let initImage = null;
    if (params.initImage) initImage = await uploadImage(params.initImage, 'ascandir_init.png');
    workflow = zImageWorkflow({ ...params, initImage });
  }
  const r = await comfyFetch(`http://127.0.0.1:${port}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow, client_id: 'ascandir' }) }, 'prompt');
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.prompt_id) {
    const txt = JSON.stringify(body.error || body.node_errors || body);
    if (/TextEncodeQwenImage21|QwenImage21Cache/.test(txt) && /not found|does not exist|invalid_prompt/i.test(txt)) throw new Error('COMFY_TOO_OLD');
    throw new Error('ComfyUI: ' + txt.slice(0, 500));
  }
  const id = body.prompt_id;
  for (;;) {
    await new Promise(res => setTimeout(res, 1000));
    send('ai:gen', { phase: 'running', seconds: Math.round((Date.now() - t0) / 1000) });
    if (!proc && !EXTERNAL) throw new Error(crashText());
    const h = await (await comfyFetch(`http://127.0.0.1:${port}/history/${id}`, undefined, 'history')).json().catch(() => ({}));
    const entry = h[id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') throw new Error('ComfyUI error: ' + JSON.stringify(entry.status.messages || '').slice(-600));
    const imgs = Object.values(entry.outputs || {}).flatMap(o => o.images || []);
    if (!imgs.length) { if (entry.status?.completed) throw new Error('No image produced'); continue; }
    const out = [];
    for (const im of imgs) {
      const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || '', type: im.type || 'output' });
      const buf = Buffer.from(await (await comfyFetch(`http://127.0.0.1:${port}/view?${q}`, undefined, 'view')).arrayBuffer());
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
    const r = await webFetch(COMFY_RELEASE_API, { headers: UA });
    if (r.ok) { const tag = (await r.json()).tag_name; out.comfy = { installed: cfg.comfyVersion || null, latest: tag, update: !!cfg.comfyVersion && tag !== cfg.comfyVersion }; }
  } catch { /* offline */ }
  for (const m of catalog.models) {
    const inst = cfg.models?.[m.id];
    out.models.push({ id: m.id, name: m.name, note: m.note, recommended: !!m.recommended, minVramGB: m.minVramGB, version: m.version,
      installed: inst?.version || null, update: !!inst && inst.version !== m.version, sizeGB: m.files.reduce((a, f) => a + (f.size || 0), 0) / 1e9 });
  }
  return out;
}

// processes left over from a crashed / force-killed earlier session (ComfyUI python, trellis-server)
// keep GPU memory and lock model files – clean them up on start. Only touches programs inside the AI folder.
// "<program folder>\models": kept across updates by the installer (build/installer.nsh), used when writable
async function suggestedDir() {
  if (!app.isPackaged) return null;
  const d = path.join(path.dirname(process.execPath), 'models');
  try { await fsp.mkdir(d, { recursive: true }); const f = path.join(d, '.write-test'); await fsp.writeFile(f, 'x'); await fsp.unlink(f); return d; } catch { return null; }
}

async function killOrphans() {
  if (process.platform !== 'win32' || EXTERNAL) return;
  const dir = (await readCfg()).dir; if (!dir) return;
  const esc = dir.replace(/'/g, "''");
  execFile('powershell.exe', ['-NoProfile', '-Command', `Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith('${esc}') } | Stop-Process -Force -ErrorAction SilentlyContinue`], { windowsHide: true }, () => {});
}

function register(mainWindowGetter) {
  killOrphans();
  ipcMain.handle('ai:status', async () => { win = mainWindowGetter(); return status(); });
  ipcMain.handle('ai:updates', () => updates());
  ipcMain.handle('ai:install', async (_e, opts) => { win = mainWindowGetter(); return install(opts); });
  ipcMain.handle('ai:cancel', () => { abort?.abort(); return true; });
  ipcMain.handle('ai:start', async () => { win = mainWindowGetter(); await start(); return true; });
  ipcMain.handle('ai:stop', () => stop());
  ipcMain.handle('ai:generate', async (_e, params) => { win = mainWindowGetter(); return generate(params); });
  ipcMain.handle('ai:log', () => procLog.slice(-120).join(''));
  ipcMain.handle('ai:skip', async () => { const c = await readCfg(); c.setupSkipped = true; await writeCfg(c); return true; });
  ipcMain.handle('ai:setGpuMode', async (_e, mode) => { const c = await readCfg(); if (c.gpuMode !== mode) { c.gpuMode = mode; await writeCfg(c); await stop(); } return true; });
  ipcMain.handle('ai:setIdle', async (_e, mins) => { const c = await readCfg(); c.idleMinutes = mins; await writeCfg(c); return true; });
  ipcMain.handle('ai:chooseDir', async () => {
    const r = await dialog.showOpenDialog(mainWindowGetter(), { properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const picked = r.filePaths[0];
    const dir = path.basename(picked).toLowerCase() === 'models' ? picked : path.join(picked, 'models');
    // inside the program folder only "<program>\models" survives updates
    const inst = path.dirname(process.execPath).toLowerCase();
    const keep = path.join(inst, 'models');
    const low = dir.toLowerCase();
    if (app.isPackaged && (low + path.sep).startsWith(inst + path.sep) && !(low === keep || low.startsWith(keep + path.sep))) throw new Error('Inside the program folder only the folder "models" is kept during updates. Please choose that or another folder.');
    return { dir, freeGB: await freeSpaceGB(r.filePaths[0]) };
  });
  ipcMain.handle('ai:openDir', async () => { const c = await readCfg(); if (c.dir) await shell.openPath(c.dir); return true; });
  app.on('before-quit', () => { stop(); });
}

module.exports = { register, zImageWorkflow, qwenWorkflow, DEFAULT_CATALOG, download, extract, readAiCfg: readCfg, writeAiCfg: writeCfg, stopComfy: stop, _test: { install, generate, download, extract } };
