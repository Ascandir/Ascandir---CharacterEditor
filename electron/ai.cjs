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
      id: 'qwen-image-21-turbo', name: 'Qwen Image 2.1 Turbo', version: '1', recommended: false, minVramGB: 16, kind: 'image',
      note: { de: 'Schnelle Fassung von Qwen Image 2.1: 8 statt 30–45 Schritte, kaum schlechter. Teilt Text-Modell und VAE mit Qwen Image 2.1.', en: 'Fast version of Qwen Image 2.1: 8 instead of 30-45 steps, barely worse. Shares text encoder and VAE with Qwen Image 2.1.' },
      files: [
        { url: 'https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/diffusion_models/qwen_image_2.1_turbo_bf16.safetensors', dest: 'models/diffusion_models/qwen_image_2.1_turbo_bf16.safetensors', size: 13250000000 },
        { url: 'https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/text_encoders/qwen3vl_8b_bf16.safetensors', dest: 'models/text_encoders/qwen3vl_8b_bf16.safetensors', size: 16330000000 },
        { url: 'https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/vae/qwen_image_2.1_vae_bf16.safetensors', dest: 'models/vae/qwen_image_2.1_vae_bf16.safetensors', size: 644200000 },
      ],
    },
    {
      id: 'ace-step-15', name: 'ACE-Step 1.5 Turbo', version: '1', recommended: false, minVramGB: 8, kind: 'music',
      note: { de: 'Musik-Modell für ganze Stücke, mit Gesang oder rein instrumental (bis mehrere Minuten, MIT-Lizenz). Für Soundtracks und Lieder.', en: 'Music model for complete pieces, with vocals or instrumental (up to several minutes, MIT licence). For soundtracks and songs.' },
      files: [
        { url: 'https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/checkpoints/ace_step_1.5_turbo_aio.safetensors', dest: 'models/checkpoints/ace_step_1.5_turbo_aio.safetensors', size: 9340000000 },
      ],
    },
    {
      id: 'stable-audio', name: 'Stable Audio Open 1.0', version: '1', recommended: false, minVramGB: 6, kind: 'sfx',
      note: { de: 'Soundeffekt-Modell: Geräusche, Ambiente, kurze Klänge bis 47 Sekunden (z. B. Schwerthieb, Feuerball, Taverne). Stability AI Community-Lizenz (privat frei).', en: 'Sound effect model: noises, ambience, short sounds up to 47 seconds (e.g. sword hit, fireball, tavern). Stability AI Community licence (free for personal use).' },
      files: [
        { url: 'https://huggingface.co/Comfy-Org/stable-audio-open-1.0_repackaged/resolve/main/stable-audio-open-1.0.safetensors', dest: 'models/checkpoints/stable-audio-open-1.0.safetensors', size: 4520000000 },
        { url: 'https://huggingface.co/ComfyUI-Wiki/t5-base/resolve/main/t5-base.safetensors', dest: 'models/text_encoders/t5-base.safetensors', size: 850300000 },
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
    comfyInstalled: !!root, comfyVersion: cfg.comfyVersion || null, models, running, lastModel: running ? lastModel : null, starting: !!proc && !running,
    freeGB: cfg.dir ? await freeSpaceGB(cfg.dir) : await freeSpaceGB(app.getPath('userData')),
    customModels: (cfg.customModels || []).map(m => ({ ...m, present: !!root && fs.existsSync(path.join(root, 'ComfyUI', CUSTOM_DIRS[m.type] || 'models/checkpoints', m.file)) })), hasCivitaiKey: !!cfg.civitaiKey,
    setupDone: !!cfg.setupDone, setupSkipped: !!cfg.setupSkipped, idleMinutes: cfg.idleMinutes ?? 10, gpuMode: cfg.gpuMode || 'safe', stopAfterImage: cfg.stopAfterImage !== false,
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
        // shared file already installed by another model (e.g. Qwen text encoder): keep it
        if (fs.existsSync(dest) && Object.entries(cfg.models).some(([oid, im]) => oid !== id && (im.files || []).includes(f.dest))) continue;
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
// progress of the running picture, read from ComfyUI's tqdm bars ("12/30 [00:40<01:00, ...]")
let gen = null; // { phase: 'load' | 'sample' | 'post', step, total, firstAt, lastAt }
function trackSteps(t) {
  if (!gen) return;
  let m, last = null; const re = /(\d+)\/(\d+) \[/g;
  while ((m = re.exec(t))) last = m;
  if (!last) return;
  const step = Number(last[1]), total = Number(last[2]);
  if (!total) return;
  // music: the song planner (language model) shows its own progress bar before the sampler starts
  if (gen.phase === 'post') { if (!(gen.audio && step < total)) return; gen.phase = 'load'; }
  if (gen.phase === 'load') { gen.phase = 'sample'; gen.firstAt = Date.now(); gen.firstStep = step; }
  gen.step = step; gen.total = total; gen.lastAt = Date.now();
  if (step >= total) gen.phase = 'post';
}
function spawnComfy(root, env, args) {
  procLog = [];
  // the whole log is also written to a file while running (a driver reset can take the app down with it)
  try { logFile = path.join(app.getPath('userData'), 'comfyui.log'); fs.writeFileSync(logFile, new Date().toISOString() + ' start: ' + args.join(' ') + '\n'); } catch { logFile = null; }
  log('args: ' + args.join(' ') + '\n');
  proc = spawn(path.join(root, 'python_embeded', 'python.exe'), ['-s', path.join('ComfyUI', 'main.py'), ...args], { cwd: root, env, windowsHide: true });
  const w = d => { const t = String(d); log(t); if (logFile) fs.appendFile(logFile, t, () => {}); trackSteps(t); };
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
  lastModel = null;
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
  // idle stop: never while a picture is being made (this used to kill long Qwen runs after 10 minutes)
  const check = () => {
    if (generating) { idleTimer = setTimeout(check, 60000); return; }
    if (Date.now() - lastUse >= mins * 60000) stop(); else idleTimer = setTimeout(check, mins * 60000 - (Date.now() - lastUse) + 1000);
  };
  if (mins > 0) idleTimer = setTimeout(check, mins * 60000 + 1000);
}
let generating = false;
let lastModel = null; // which image model ComfyUI currently keeps in memory
// unload everything ComfyUI keeps cached (models in RAM/VRAM) without stopping it
async function freeComfy() {
  if (!proc && !EXTERNAL) return false;
  try { await fetch(`http://127.0.0.1:${port}/free`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unload_models: true, free_memory: true }) }); } catch { return false; }
  lastModel = null; await new Promise(r => setTimeout(r, 2500)); return true;
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

// own all-in-one checkpoints (SD 1.5 / SDXL / Pony / Illustrious …) added by the user
function checkpointWorkflow({ prompt, negative = '', seed, width = 1024, height = 1024, steps = 30, cfg = 6, sampler = 'dpmpp_2m', scheduler = 'karras', ckpt, lora = null, loraStrength = 1, batch = 1, initImage = null, denoise = 1, removeBg = false, upscale = null }) {
  const w = {
    300: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    302: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['300', 1] } },
    303: { class_type: 'CLIPTextEncode', inputs: { text: negative || '', clip: ['300', 1] } },
    3: { class_type: 'KSampler', inputs: { model: ['300', 0], positive: ['302', 0], negative: ['303', 0], latent_image: ['13', 0], seed, steps, cfg, sampler_name: sampler, scheduler, denoise } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['300', 2] } },
    9: { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: 'ascandir/char' } },
  };
  if (lora) {
    w[301] = { class_type: 'LoraLoader', inputs: { model: ['300', 0], clip: ['300', 1], lora_name: lora, strength_model: loraStrength, strength_clip: loraStrength } };
    w[3].inputs.model = ['301', 0]; w[302].inputs.clip = ['301', 1]; w[303].inputs.clip = ['301', 1];
  }
  addPost(w, { removeBg, upscale });
  if (initImage) {
    w[40] = { class_type: 'LoadImage', inputs: { image: initImage } };
    w[41] = { class_type: 'ImageScale', inputs: { image: ['40', 0], upscale_method: 'lanczos', width, height, crop: 'center' } };
    w[13] = { class_type: 'VAEEncode', inputs: { pixels: ['41', 0], vae: ['300', 2] } };
  } else w[13] = { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: batch } };
  return w;
}

function zImageWorkflow({ prompt, seed, width = 832, height = 1216, steps = 8, batch = 1, initImage = null, denoise = 1, removeBg = false, upscale = null, unet = null, lora = null, loraStrength = 1, cfg = 1, sampler = 'res_multistep' }) {
  const w = {
    28: { class_type: 'UNETLoader', inputs: { unet_name: unet || 'z_image_turbo_bf16.safetensors', weight_dtype: 'default' } },
    30: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'lumina2', device: 'default' } },
    29: { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
    11: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['28', 0], shift: 3 } },
    27: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['30', 0] } },
    33: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['27', 0] } },
    3: { class_type: 'KSampler', inputs: { model: ['11', 0], positive: ['27', 0], negative: ['33', 0], latent_image: ['13', 0], seed, steps, cfg, sampler_name: sampler, scheduler: 'simple', denoise } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['29', 0] } },
    9: { class_type: 'SaveImage', inputs: { images: ['8', 0], filename_prefix: 'ascandir/char' } },
  };
  if (lora) { // a Z-Image LoRA the user added
    w[34] = { class_type: 'LoraLoaderModelOnly', inputs: { model: ['28', 0], lora_name: lora, strength_model: loraStrength } };
    w[11].inputs.model = ['34', 0];
  }
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
function qwenWorkflow({ prompt, negative = '', seed, width = 1024, height = 1024, steps = 40, cfg = 1, batch = 1, refs = [], editLatent = false, resolution = 1024, removeBg = false, upscale = null, turbo = false }) {
  const w = {
    101: { class_type: 'UNETLoader', inputs: { unet_name: turbo ? 'qwen_image_2.1_turbo_bf16.safetensors' : 'qwen_image_2.1_bf16.safetensors', weight_dtype: 'default' } },
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
  if (turbo) {
    // distilled for 8 steps with a fixed schedule (official template), no CFG
    const pos = w[3].inputs.positive, neg = w[3].inputs.negative;
    w[120] = { class_type: 'RandomNoise', inputs: { noise_seed: seed } };
    w[121] = { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } };
    w[122] = { class_type: 'ManualSigmas', inputs: { sigmas: '1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0' } };
    w[123] = { class_type: 'CFGGuider', inputs: { model: ['102', 0], positive: pos, negative: neg, cfg: 1 } };
    w[3] = { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['120', 0], guider: ['123', 0], sampler: ['121', 0], sigmas: ['122', 0], latent_image: lat } };
  }
  addPost(w, { removeBg, upscale });
  return w;
}

// ---------- audio ----------
const ACE_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'].flatMap(r => [r + ' major', r + ' minor']);
const ACE_LANGS = ['en', 'de', 'fr', 'es', 'it', 'ja', 'ko', 'zh', 'ru', 'pt', 'nl', 'pl', 'sv', 'la', 'unknown'];
// ACE-Step 1.5 (official ComfyUI template "audio_ace_step_1_5_checkpoint")
function musicWorkflow({ tags, lyrics = '', vocals = false, seed, seconds = 90, bpm = 120, key = 'C minor', timesig = '4', language = 'en', batch = 1, steps = 8 }) {
  const lyr = vocals && String(lyrics).trim() ? String(lyrics) : '[Instrumental]';
  const tg = vocals ? String(tags) : String(tags) + (/instrumental/i.test(tags) ? '' : ', instrumental, no vocals');
  const dur = Math.max(5, Math.min(600, Number(seconds) || 90));
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'ace_step_1.5_turbo_aio.safetensors' } },
    2: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: 3 } },
    3: { class_type: 'TextEncodeAceStepAudio1.5', inputs: { clip: ['1', 1], tags: tg, lyrics: lyr, seed, bpm: Math.max(30, Math.min(300, Math.round(Number(bpm) || 120))), duration: dur,
      timesignature: ['2', '3', '4', '6'].includes(String(timesig)) ? String(timesig) : '4', language: ACE_LANGS.includes(language) ? language : 'en',
      keyscale: ACE_KEYS.includes(key) ? key : 'C minor', generate_audio_codes: true, cfg_scale: 2, temperature: 0.85, top_p: 0.9, top_k: 0, min_p: 0 } },
    4: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['3', 0] } },
    5: { class_type: 'EmptyAceStep1.5LatentAudio', inputs: { seconds: dur, batch_size: batch } },
    6: { class_type: 'KSampler', inputs: { model: ['2', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['5', 0], seed, steps, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
    7: { class_type: 'VAEDecodeAudio', inputs: { samples: ['6', 0], vae: ['1', 2] } },
    9: { class_type: 'SaveAudioMP3', inputs: { audio: ['7', 0], filename_prefix: 'ascandir/music', quality: 'V0' } },
  };
}
// Stable Audio Open 1.0 (official template "audio_stable_audio_example")
function sfxWorkflow({ prompt, negative = '', seed, seconds = 6, batch = 1, steps = 50, cfg = 5 }) {
  const dur = Math.max(0.5, Math.min(47, Number(seconds) || 6));
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'stable-audio-open-1.0.safetensors' } },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: 't5-base.safetensors', type: 'stable_audio', device: 'default' } },
    3: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: prompt } },
    4: { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: String(negative).trim() ? String(negative).trim() + ', low quality, distorted' : 'low quality, distorted, noise, music, speech' } },
    5: { class_type: 'EmptyLatentAudio', inputs: { seconds: dur, batch_size: batch } },
    6: { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['5', 0], seed, steps, cfg, sampler_name: 'dpmpp_3m_sde_gpu', scheduler: 'exponential', denoise: 1 } },
    7: { class_type: 'VAEDecodeAudio', inputs: { samples: ['6', 0], vae: ['1', 2] } },
    9: { class_type: 'SaveAudioMP3', inputs: { audio: ['7', 0], filename_prefix: 'ascandir/sfx', quality: 'V0' } },
  };
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
  const ramFree = require('os').freemem() / 1024 ** 3;
  return `(RAM free now: ${ramFree.toFixed(1)} GB) ` + (oom ? 'ComfyUI ran out of memory and stopped. Try a lower resolution or fewer images at once.\n\n' : 'ComfyUI stopped unexpectedly.\n\n')
    + clean.slice(-1200) + '\n\n(Full log: ' + path.join(app.getPath('userData'), 'comfyui-last.log') + ')';
}

let currentPrompt = null; let cancelRequested = false;
// cancel the running picture: remove it from the queue and interrupt the sampler (ComfyUI keeps running)
async function cancelGenerate() {
  cancelRequested = true;
  const id = currentPrompt;
  try { if (id) await fetch(`http://127.0.0.1:${port}/queue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delete: [id] }) }); } catch { /* not running */ }
  try { await fetch(`http://127.0.0.1:${port}/interrupt`, { method: 'POST' }); } catch { /* not running */ }
  return true;
}
async function generate(params) {
  generating = true;
  try { return await generateInner(params); } finally {
    generating = false; lastUse = Date.now();
    // default: stop ComfyUI as soon as the picture is done, so its ~30-40 GB of RAM are free again right away
    const c = await readCfg().catch(() => ({}));
    if (c.stopAfterImage !== false && proc && !EXTERNAL) { log('picture done: stopping ComfyUI to free the memory'); await stop(); } else touch();
  }
}
async function generateInner(params) {
  cancelRequested = false;
  await start();
  touch();
  // switching between Z-Image and Qwen: drop the other model first, two of them do not fit into RAM together
  // own models: resolve the file names and settings from the config
  if (params.custom) {
    const cm = ((await readCfg()).customModels || []).find(x => x.id === params.custom);
    if (!cm) throw new Error('Own model not found (removed?)');
    const st = { steps: cm.steps, cfg: cm.cfg, sampler: cm.sampler };
    if (cm.type === 'checkpoint') Object.assign(params, { model: 'checkpoint', ckpt: cm.file }, st);
    else if (cm.type === 'zimage') Object.assign(params, { model: 'zimage', unet: cm.file }, st);
    else if (cm.type === 'zimage-lora') Object.assign(params, { model: 'zimage', lora: cm.file, loraStrength: cm.strength ?? 0.8 });
  }
  const isAudio = params.model === 'music' || params.model === 'sfx';
  const want = isAudio ? params.model : params.model === 'qwen' ? (params.turbo ? 'qwenturbo' : 'qwen') : params.model === 'checkpoint' ? 'ckpt:' + params.ckpt : params.unet ? 'z:' + params.unet : 'zimage';
  if (lastModel && lastModel !== want) await freeComfy();
  lastModel = want;
  const t0 = Date.now();
  let workflow;
  if (params.model === 'music') workflow = musicWorkflow(params);
  else if (params.model === 'sfx') workflow = sfxWorkflow(params);
  else if (params.model === 'checkpoint') {
    let initImage = null;
    if (params.initImage) initImage = await uploadImage(params.initImage, 'ascandir_init.png');
    workflow = checkpointWorkflow({ ...params, initImage });
  } else if (params.model === 'qwen') {
    const refs = [];
    for (const [i, img] of (params.refImages || []).entries()) refs.push(await uploadImage(img, `ascandir_ref${i + 1}.png`));
    workflow = qwenWorkflow({ ...params, refs });
  } else {
    let initImage = null;
    if (params.initImage) initImage = await uploadImage(params.initImage, 'ascandir_init.png');
    workflow = zImageWorkflow({ ...params, initImage });
  }
  if (cancelRequested) throw new Error('CANCELLED');
  const r = await comfyFetch(`http://127.0.0.1:${port}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow, client_id: 'ascandir' }) }, 'prompt');
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.prompt_id) {
    const txt = JSON.stringify(body.error || body.node_errors || body);
    if (/TextEncodeQwenImage21|QwenImage21Cache|ManualSigmas|AceStep1\.5|SaveAudioMP3|EmptyLatentAudio|VAEDecodeAudio/.test(txt) && /not found|does not exist|invalid_prompt/i.test(txt)) throw new Error('COMFY_TOO_OLD');
    throw new Error('ComfyUI: ' + txt.slice(0, 500));
  }
  const id = body.prompt_id;
  currentPrompt = id; cancelRequested = false;
  gen = { phase: 'load', step: 0, total: 0, audio: isAudio };
  for (;;) {
    await new Promise(res => setTimeout(res, 1000));
    if (cancelRequested) { await cancelGenerate(); currentPrompt = null; throw new Error('CANCELLED'); }
    lastUse = Date.now();
    let eta = null;
    if (gen?.phase === 'sample' && gen.step > (gen.firstStep || 0)) eta = Math.round((gen.lastAt - gen.firstAt) / (gen.step - (gen.firstStep || 0)) * (gen.total - gen.step) / 1000);
    send('ai:gen', { phase: 'running', seconds: Math.round((Date.now() - t0) / 1000), stage: gen?.phase || 'load', step: gen?.step || 0, total: gen?.total || 0, eta, post: !!(params.upscale || params.removeBg) });
    if (!proc && !EXTERNAL) throw new Error(crashText());
    const h = await (await comfyFetch(`http://127.0.0.1:${port}/history/${id}`, undefined, 'history')).json().catch(() => ({}));
    const entry = h[id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') throw new Error('ComfyUI error: ' + JSON.stringify(entry.status.messages || '').slice(-600));
    const imgs = Object.values(entry.outputs || {}).flatMap(o => (isAudio ? o.audio : o.images) || []);
    if (!imgs.length) { if (entry.status?.completed) throw new Error(isAudio ? 'No audio produced' : 'No image produced'); continue; }
    const out = [];
    for (const im of imgs) {
      const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || '', type: im.type || 'output' });
      const buf = Buffer.from(await (await comfyFetch(`http://127.0.0.1:${port}/view?${q}`, undefined, 'view')).arrayBuffer());
      out.push((isAudio ? 'data:audio/mpeg;base64,' : 'data:image/png;base64,') + buf.toString('base64'));
      // the copy in ComfyUI's output folder is not needed (the app keeps its own)
      if (isAudio) { try { const r = await findComfyRoot((await readCfg()).dir); if (r) await fsp.rm(path.join(r, 'ComfyUI', 'output', im.subfolder || '', im.filename), { force: true }); } catch { /* ignore */ } }
    }
    touch();
    return isAudio ? { audios: out, seconds: Math.round((Date.now() - t0) / 1000) } : { images: out, seconds: Math.round((Date.now() - t0) / 1000) };
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

// ---------- own models (link or file) ----------
const CUSTOM_DIRS = { checkpoint: 'models/checkpoints', zimage: 'models/diffusion_models', 'zimage-lora': 'models/loras' };
const CUSTOM_DEFAULTS = { checkpoint: { steps: 30, cfg: 6, sampler: 'dpmpp_2m' }, zimage: { steps: 8, cfg: 1, sampler: 'res_multistep' }, 'zimage-lora': { strength: 0.8 } };
// turn a model page link into a direct download link
async function directUrl(u, civitaiKey) {
  let url = String(u || '').trim();
  if (!/^https:\/\//.test(url)) throw new Error('BAD_URL');
  url = url.replace(/^(https:\/\/huggingface\.co\/[^/]+\/[^/]+)\/blob\//, '$1/resolve/');
  const civ = /^https:\/\/civitai\.com\/models\/(\d+)/.exec(url);
  if (civ) {
    let ver = /modelVersionId=(\d+)/.exec(url)?.[1];
    if (!ver) { // no version in the link: take the newest one
      try { const r = await webFetch('https://civitai.com/api/v1/models/' + civ[1], { headers: UA }); if (r.ok) ver = (await r.json()).modelVersions?.[0]?.id; } catch { /* offline */ }
    }
    if (!ver) throw new Error('CIVITAI_VERSION');
    url = `https://civitai.com/api/download/models/${ver}?type=Model&format=SafeTensor`;
  }
  if (/^https:\/\/civitai\.com\/api\/download/.test(url) && civitaiKey) url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(civitaiKey);
  return url;
}
async function addCustomModel(e, { type, name, url, file: localFile }) {
  const cfg = await readCfg(); const root = await findComfyRoot(cfg.dir);
  if (!root) throw new Error('ComfyUI not installed');
  if (!CUSTOM_DIRS[type]) throw new Error('unknown type');
  const safe = String(name || 'model').normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'model';
  const id = 'c' + Date.now().toString(36);
  const fileName = 'ascandir_' + safe + '_' + id + '.safetensors'; // flat folder: ComfyUI only accepts names from its own file list
  const dest = path.join(root, 'ComfyUI', CUSTOM_DIRS[type], fileName);
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  if (url) {
    abort = new AbortController();
    try { await download(await directUrl(url, cfg.civitaiKey), dest, name || 'Model', abort.signal); }
    catch (err) { if (/HTTP 401|HTTP 403/.test(err.message) && /civitai/.test(url)) throw new Error('CIVITAI_LOGIN'); throw err; }
    finally { abort = null; }
  } else {
    let src = localFile;
    if (!src) {
      const { dialog, BrowserWindow } = require('electron');
      const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openFile'], filters: [{ name: 'SafeTensors', extensions: ['safetensors'] }] });
      if (r.canceled || !r.filePaths.length) return null;
      src = r.filePaths[0];
    }
    send('ai:progress', { phase: 'extract', label: 'Kopieren / Copying', pct: 0 });
    await fsp.copyFile(src, dest);
  }
  // sanity check: a model is at least a few MB and a safetensors file starts with a JSON header
  const st = await fsp.stat(dest);
  const head = Buffer.alloc(16); const fd = await fsp.open(dest, 'r'); await fd.read(head, 0, 16, 0); await fd.close();
  if (st.size < 1e6 || head.toString('latin1', 8, 9) !== '{') { await fsp.rm(dest, { force: true }); throw new Error('NOT_A_MODEL'); }
  const c2 = await readCfg();
  c2.customModels = [...(c2.customModels || []), { id, type, name: name || safe, file: fileName, size: st.size, ...CUSTOM_DEFAULTS[type] }];
  await writeCfg(c2);
  send('ai:progress', { phase: 'done' });
  return id;
}
async function updateCustomModel(id, patch) {
  const c = await readCfg();
  c.customModels = (c.customModels || []).map(m => (m.id === id ? { ...m, ...patch, id: m.id, type: m.type, file: m.file } : m));
  await writeCfg(c); return true;
}
// remove an installed model: its files, unless another installed model still uses them
async function removeModel(id) {
  await stop();
  const cfg = await readCfg(); const root = await findComfyRoot(cfg.dir);
  if (!root) return false;
  const cm = (cfg.customModels || []).find(m => m.id === id);
  if (cm) {
    await fsp.rm(path.join(root, 'ComfyUI', CUSTOM_DIRS[cm.type], cm.file), { force: true });
    cfg.customModels = cfg.customModels.filter(m => m.id !== id);
  } else if (cfg.models?.[id]) {
    const others = new Set(Object.entries(cfg.models).filter(([k]) => k !== id).flatMap(([, m]) => m.files || []));
    for (const f of cfg.models[id].files || []) {
      if (others.has(f)) continue;
      for (const suffix of ['', '.part']) await fsp.rm(path.join(root, 'ComfyUI', f + suffix), { force: true });
    }
    delete cfg.models[id];
  } else return false;
  await writeCfg(cfg);
  return true;
}

// the map maker was removed again (0.10.0): delete the models it downloaded (about 10 GB)
const REMOVED_MODELS = {
  'sdxl-map': ['models/checkpoints/sd_xl_base_1.0.safetensors', 'models/loras/dnd_battlemaps_sdxl.safetensors'],
  'zimage-control': ['models/model_patches/Z-Image-Turbo-Fun-Controlnet-Union.safetensors'],
};
async function cleanupRemovedModels() {
  try {
    const cfg = await readCfg(); const root = await findComfyRoot(cfg.dir); if (!root) return;
    let changed = false;
    for (const [id, files] of Object.entries(REMOVED_MODELS)) {
      const known = cfg.models?.[id];
      for (const rel of files) {
        // only what this app downloaded (installed model entry, or a leftover partial download)
        for (const suffix of known ? ['', '.part', '.orig', '.conv'] : ['.part']) {
          const p = path.join(root, 'ComfyUI', rel + suffix);
          if (fs.existsSync(p)) { await fsp.rm(p, { force: true }); log('removed ' + rel + suffix); }
        }
      }
      if (known) { delete cfg.models[id]; changed = true; }
    }
    if (changed) await writeCfg(cfg);
  } catch { /* not important */ }
}

function register(mainWindowGetter) {
  killOrphans();
  cleanupRemovedModels();
  ipcMain.handle('ai:status', async () => { win = mainWindowGetter(); return status(); });
  ipcMain.handle('ai:updates', () => updates());
  ipcMain.handle('ai:install', async (_e, opts) => { win = mainWindowGetter(); return install(opts); });
  ipcMain.handle('ai:cancel', () => { abort?.abort(); return true; });
  ipcMain.handle('ai:start', async () => { win = mainWindowGetter(); await start(); return true; });
  ipcMain.handle('ai:stop', () => stop());
  ipcMain.handle('ai:generate', async (_e, params) => { win = mainWindowGetter(); return generate(params); });
  ipcMain.handle('ai:cancelGen', () => cancelGenerate());
  ipcMain.handle('ai:free', () => freeComfy());
  ipcMain.handle('ai:log', () => procLog.slice(-120).join(''));
  ipcMain.handle('ai:skip', async () => { const c = await readCfg(); c.setupSkipped = true; await writeCfg(c); return true; });
  ipcMain.handle('ai:addCustom', async (e, o) => { win = mainWindowGetter(); return addCustomModel(e, o || {}); });
  ipcMain.handle('ai:updateCustom', (_e, id, patch) => updateCustomModel(id, patch || {}));
  ipcMain.handle('ai:removeModel', (_e, id) => removeModel(id));
  ipcMain.handle('ai:setCivitaiKey', async (_e, key) => { const c = await readCfg(); c.civitaiKey = String(key || '').trim() || undefined; await writeCfg(c); return true; });
  ipcMain.handle('ai:setStopAfter', async (_e, on) => { const c = await readCfg(); c.stopAfterImage = !!on; await writeCfg(c); return true; });
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

module.exports = { register, musicWorkflow, sfxWorkflow, zImageWorkflow, qwenWorkflow, checkpointWorkflow, directUrl, DEFAULT_CATALOG, download, extract, readAiCfg: readCfg, writeAiCfg: writeCfg, stopComfy: stop, stopIfIdle: () => (generating ? false : stop()), _test: { install, generate, download, extract, addCustomModel, removeModel, status } };
