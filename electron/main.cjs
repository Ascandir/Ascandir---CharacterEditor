// Ascandir - CharacterEditor: Electron main process
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { execFile } = require('child_process');

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

app.whenReady().then(async () => {
  await ensureDirs();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
