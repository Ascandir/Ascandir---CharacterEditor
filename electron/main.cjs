// Ascandir - CharacterEditor: Electron main process
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { execFile } = require('child_process');
const trellis = require('./trellis.cjs');
const ai = require('./ai.cjs');

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const userDir = () => app.getPath('userData');
const cacheDir = () => path.join(userDir(), 'cache');
const charDir = () => path.join(userDir(), 'characters');
const settingsFile = () => path.join(userDir(), 'settings.json');

async function ensureDirs() {
  await fsp.mkdir(cacheDir(), { recursive: true });
  await fsp.mkdir(charDir(), { recursive: true });
}

function safeName(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
}

// Allowed download hosts (data sources only)
const ALLOWED = ['raw.githubusercontent.com', 'api.github.com'];

async function fetchCached(url, { force = false } = {}) {
  const u = new URL(url);
  if (!ALLOWED.includes(u.hostname)) throw new Error('Host not allowed: ' + u.hostname);
  const file = path.join(cacheDir(), safeName(u.hostname + u.pathname));
  if (!force && fs.existsSync(file)) {
    return { text: await fsp.readFile(file, 'utf8'), cached: true };
  }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Ascandir-CharacterEditor' } });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    const text = await res.text();
    await fsp.writeFile(file, text, 'utf8');
    return { text, cached: false };
  } catch (e) {
    // offline fallback to cache
    if (fs.existsSync(file)) return { text: await fsp.readFile(file, 'utf8'), cached: true, stale: true };
    throw e;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#121418',
    title: 'Ascandir - CharacterEditor',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (isDev) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ---------- IPC ----------
ipcMain.handle('data:fetch', async (_e, url, opts) => fetchCached(url, opts || {}));

ipcMain.handle('data:clearCache', async () => {
  await fsp.rm(cacheDir(), { recursive: true, force: true });
  await fsp.mkdir(cacheDir(), { recursive: true });
  return true;
});

ipcMain.handle('chars:list', async () => {
  const files = (await fsp.readdir(charDir())).filter(f => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      const c = JSON.parse(await fsp.readFile(path.join(charDir(), f), 'utf8'));
      out.push({ id: c.id, name: c.name, summary: c.summary || '', updatedAt: c.updatedAt || 0 });
    } catch { /* skip broken */ }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
});
ipcMain.handle('chars:load', async (_e, id) => JSON.parse(await fsp.readFile(path.join(charDir(), safeName(id) + '.json'), 'utf8')));
ipcMain.handle('chars:save', async (_e, char) => {
  const file = path.join(charDir(), safeName(char.id) + '.json');
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(char, null, 2), 'utf8');
  await fsp.rename(tmp, file);
  return true;
});
ipcMain.handle('chars:delete', async (_e, id) => {
  await fsp.rm(path.join(charDir(), safeName(id) + '.json'), { force: true });
  return true;
});

// generated pictures per character
const imgDir = (charId) => path.join(userDir(), 'images', safeName(charId));
ipcMain.handle('img:save', async (_e, charId, dataUrl) => {
  await fsp.mkdir(imgDir(charId), { recursive: true });
  const name = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.png';
  await fsp.writeFile(path.join(imgDir(charId), name), Buffer.from(String(dataUrl).split(',')[1], 'base64'));
  return name;
});
ipcMain.handle('img:load', async (_e, charId, name) => 'data:image/png;base64,' + (await fsp.readFile(path.join(imgDir(charId), safeName(name)))).toString('base64'));
ipcMain.handle('img:delete', async (_e, charId, name) => { await fsp.rm(path.join(imgDir(charId), safeName(name)), { force: true }); return true; });

ipcMain.handle('settings:get', async () => {
  try { return JSON.parse(await fsp.readFile(settingsFile(), 'utf8')); } catch { return {}; }
});
ipcMain.handle('settings:set', async (_e, s) => {
  await fsp.writeFile(settingsFile(), JSON.stringify(s, null, 2), 'utf8');
  return true;
});

ipcMain.handle('file:save', async (e, { defaultName, filters, dataBase64, text }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters });
  if (r.canceled || !r.filePath) return null;
  if (dataBase64 != null) await fsp.writeFile(r.filePath, Buffer.from(dataBase64, 'base64'));
  else await fsp.writeFile(r.filePath, text || '', 'utf8');
  return r.filePath;
});
ipcMain.handle('file:saveDir', async (e, { files }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths.length) return null;
  for (const f of files) await fsp.writeFile(path.join(r.filePaths[0], path.basename(f.name)), Buffer.from(f.dataBase64, 'base64'));
  return r.filePaths[0];
});
ipcMain.handle('file:open', async (e, { filters }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters });
  if (r.canceled || !r.filePaths.length) return null;
  return { name: path.basename(r.filePaths[0]), text: await fsp.readFile(r.filePaths[0], 'utf8') };
});

ipcMain.handle('sys:openExternal', async (_e, url) => {
  if (/^https:\/\//.test(url)) await shell.openExternal(url);
  return true;
});

// GPU + driver detection (Windows). Never installs or updates anything.
ipcMain.handle('sys:hardware', async () => {
  const info = { platform: process.platform, gpus: [], ramGB: Math.round(require('os').totalmem() / 1024 ** 3) };
  if (process.platform !== 'win32') return info;
  const ps = 'Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,DriverDate,AdapterRAM | ConvertTo-Json -Compress';
  const out = await new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 15000, windowsHide: true },
      (err, stdout) => resolve(err ? '' : stdout));
  });
  try {
    let arr = JSON.parse(out);
    if (!Array.isArray(arr)) arr = [arr];
    info.gpus = arr.map(g => ({
      name: g.Name, driverVersion: g.DriverVersion,
      driverDate: parseCimDate(g.DriverDate),
    }));
  } catch { /* ignore */ }
  return info;
});

function parseCimDate(d) {
  if (!d) return null;
  if (typeof d === 'string') {
    const m = /Date\((\d+)\)/.exec(d);
    if (m) return new Date(Number(m[1])).toISOString();
    if (/^\d{8}/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    return d;
  }
  if (d.DateTime) return new Date(d.DateTime).toISOString();
  return null;
}

ipcMain.handle('app:version', () => app.getVersion());

// ---------- self-update from GitHub releases ----------
const REPO_API = 'https://api.github.com/repos/Ascandir/Ascandir---CharacterEditor/releases/latest';
function newer(a, b) { // is a > b
  const pa = String(a).replace(/^v/, '').split('.').map(Number); const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
}
ipcMain.handle('update:check', async () => {
  const res = await fetch(REPO_API, { headers: { 'User-Agent': 'Ascandir-CharacterEditor', Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error('GitHub HTTP ' + res.status);
  const r = await res.json();
  const asset = (r.assets || []).find(a => /^Ascandir-CharacterEditor-Setup-.*\.exe$/.test(a.name));
  const version = String(r.tag_name || '').replace(/^v/, '');
  let notes = r.body || '';
  try { // all changelog sections newer than the installed version
    const cl = await (await fetch('https://raw.githubusercontent.com/Ascandir/Ascandir---CharacterEditor/main/CHANGELOG.md', { headers: { 'User-Agent': 'Ascandir-CharacterEditor' } })).text();
    const parts = cl.split(/^## /m).slice(1).filter(sec => { const v = sec.split(/\s/)[0]; return newer(v, app.getVersion()) && !newer(v, version); });
    if (parts.length) notes = parts.map(p => '## ' + p.trim()).join('\n\n');
  } catch { /* keep release body */ }
  return { current: app.getVersion(), version, available: !!asset && newer(version, app.getVersion()), notes, url: asset?.browser_download_url, size: asset?.size, name: asset?.name };
});
let updating = false;
ipcMain.handle('update:install', async (e, { url, name }) => {
  const u = new URL(url);
  if (u.hostname !== 'github.com' || !/^Ascandir-CharacterEditor-Setup-[\d.]+\.exe$/.test(name)) throw new Error('invalid update source');
  if (updating) throw new Error('update already running');
  updating = true;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Ascandir-CharacterEditor' } });
    if (!res.ok || !res.body) throw new Error('Download HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || 0;
    // own folder + unique name, so a still running / locked old installer never blocks the download
    const dir = path.join(require('os').tmpdir(), 'ascandir-update');
    await fsp.mkdir(dir, { recursive: true });
    for (const f of await fsp.readdir(dir).catch(() => [])) await fsp.unlink(path.join(dir, f)).catch(() => {});
    const file = path.join(dir, name.replace(/\.exe$/, '-' + Date.now() + '.exe'));
    const out = fs.createWriteStream(file);
    const failed = new Promise((_, reject) => out.on('error', reject));
    failed.catch(() => {});
    let got = 0; let lastPct = -1;
    for await (const chunk of res.body) {
      if (!out.write(chunk)) await Promise.race([new Promise(r => out.once('drain', r)), failed]);
      got += chunk.length;
      const pct = total ? Math.floor(got / total * 100) : 0;
      if (pct !== lastPct) { lastPct = pct; e.sender.send('update:progress', pct); }
    }
    await Promise.race([new Promise((resolve, reject) => out.end(err => (err ? reject(err) : resolve()))), failed]);
    if (total && got !== total) throw new Error('download incomplete');
    if (process.platform === 'win32') {
      const { spawn } = require('child_process');
      // stop everything we started (ComfyUI, TRELLIS), then let a small helper wait until this
      // process is really gone before it opens the installer, so no file of the old version is locked
      try { await ai.stopComfy(); } catch { /* not running */ }
      try { trellis.stop(); } catch { /* not running */ }
      const esc = s => s.replace(/'/g, "''");
      const aiDir = (await ai.readAiCfg()).dir;
      const ps = `Wait-Process -Id ${process.pid} -ErrorAction SilentlyContinue; ` +
        `Get-Process | Where-Object { $_.Path -and ($_.Path.StartsWith('${esc(path.dirname(process.execPath))}')${aiDir ? ` -or $_.Path.StartsWith('${esc(aiDir)}')` : ''}) } | Stop-Process -Force -ErrorAction SilentlyContinue; ` +
        `Start-Sleep -Seconds 1; Start-Process -FilePath '${esc(file)}'`;
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', ps], { detached: true, stdio: 'ignore', windowsHide: true });
      await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
      child.unref();
      setTimeout(() => app.exit(0), 300);
    }
    return true;
  } catch (err) {
    updating = false;
    throw err;
  }
});

if (!app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
}

app.whenReady().then(async () => {
  await ensureDirs();
  createWindow();
  ai.register(() => BrowserWindow.getAllWindows()[0]);
  trellis.register(() => BrowserWindow.getAllWindows()[0]);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
