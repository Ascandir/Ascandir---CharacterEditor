// Platform layer: Electron (window.ace) or browser fallback (for development/testing)
const memImages = {};
const LS = typeof localStorage !== 'undefined' ? localStorage : null;

const browser = {
  isElectron: false,
  async fetchData(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    return { text: await res.text(), cached: false };
  },
  async clearCache() { return true; },
  async listChars() {
    const all = JSON.parse(LS?.getItem('ace.chars') || '{}');
    return Object.values(all).map(c => ({ id: c.id, name: c.name, summary: c.summary || '', updatedAt: c.updatedAt || 0 }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async loadChar(id) { return JSON.parse(LS?.getItem('ace.chars') || '{}')[id]; },
  async saveChar(c) {
    const all = JSON.parse(LS?.getItem('ace.chars') || '{}');
    all[c.id] = c; LS?.setItem('ace.chars', JSON.stringify(all)); return true;
  },
  async deleteChar(id) {
    const all = JSON.parse(LS?.getItem('ace.chars') || '{}');
    delete all[id]; LS?.setItem('ace.chars', JSON.stringify(all)); return true;
  },
  async saveImage(charId, dataUrl) { const k = 'm' + Date.now() + Math.random(); memImages[k] = dataUrl; return k; },
  async loadImage(charId, name) { return memImages[name]; },
  async deleteImage(charId, name) { delete memImages[name]; return true; },
  ai: {
    async status() { return { supported: false, platform: 'browser', models: {}, setupDone: false, setupSkipped: true }; },
    async updates() { return { comfy: null, models: [] }; },
    async install() { throw new Error('Nur unter Windows'); }, async cancel() {}, async start() { throw new Error('Nur unter Windows'); }, async stop() {},
    async generate() { throw new Error('Nur unter Windows'); }, async cancelGen() {}, async log() { return ''; }, async skip() {}, async setIdle() {}, async setGpuMode() {}, async chooseDir() { return null; }, async openDir() {},
    on() { return () => {}; },
  },
  strata: {
    async info() { return { supported: false }; }, async presets() { return []; }, async start() { throw new Error('STRATA_NOT_FOUND'); }, async stop() { return false; },
    async setIdle() {}, async log() { return ''; }, on() { return () => {}; },
  },
  llm: {
    async models() { throw new Error('NO_SERVER'); }, async chat() { throw new Error('NO_SERVER'); }, async stop() {}, on() { return () => {}; },
  },
  trellis: {
    async status() { return { supported: false, installed: false }; },
    async start() { throw new Error('Nur unter Windows'); }, async stop() {}, async log() { return ''; },
    async generate() { throw new Error('Nur unter Windows'); }, async load() { return null; }, async remove() {}, async exportGlb() {}, async install() {}, async openDir() {}, async setup() { throw new Error('Nur unter Windows'); }, async cancel() {}, async updates() { return {}; },
    on() { return () => {}; },
  },
  async getSettings() { return JSON.parse(LS?.getItem('ace.settings') || '{}'); },
  async setSettings(s) { LS?.setItem('ace.settings', JSON.stringify(s)); return true; },
  async saveFile({ defaultName, dataBase64, text }) {
    const a = document.createElement('a');
    a.download = defaultName;
    a.href = dataBase64 != null ? 'data:application/octet-stream;base64,' + dataBase64
      : URL.createObjectURL(new Blob([text || ''], { type: 'application/json' }));
    a.click();
    return defaultName;
  },
  async saveFilesToDir({ files }) {
    for (const f of files) { const a = document.createElement('a'); a.download = f.name; a.href = 'data:image/png;base64,' + f.dataBase64; a.click(); }
    return 'downloads';
  },
  async openFile() {
    return new Promise(resolve => {
      const i = document.createElement('input');
      i.type = 'file'; i.accept = '.json';
      i.onchange = async () => { const f = i.files[0]; resolve(f ? { name: f.name, text: await f.text() } : null); };
      i.click();
    });
  },
  async openExternal(u) { window.open(u, '_blank'); return true; },
  async tdr() { return window.__ACE_MOCK_TDR || { supported: false }; }, async setTdr(v) { if (window.__ACE_MOCK_TDR) window.__ACE_MOCK_TDR.delay = v || null; return true; },
  async hardware() { return { platform: 'browser', gpus: [], ramGB: null }; },
  async version() { return 'dev'; },
  async checkUpdate() { return window.__ACE_MOCK_UPDATE || { available: false, current: 'dev', version: 'dev' }; },
  async installUpdate() { return false; },
  async openUpdatePage() { window.open('https://github.com/Ascandir/Ascandir---CharacterEditor/releases/latest', '_blank'); },
  onUpdateProgress() { return () => {}; },
};

export const api = (typeof window !== 'undefined' && window.ace) ? window.ace : browser;
// test hook: a mocked AI service can be injected for UI tests
if (typeof window !== 'undefined' && window.__ACE_MOCK_AI) api.ai = window.__ACE_MOCK_AI;
if (typeof window !== 'undefined' && window.__ACE_MOCK_LLM) api.llm = window.__ACE_MOCK_LLM;
if (typeof window !== 'undefined' && window.__ACE_MOCK_STRATA) api.strata = window.__ACE_MOCK_STRATA;
if (typeof window !== 'undefined' && window.__ACE_MOCK_TRELLIS) api.trellis = window.__ACE_MOCK_TRELLIS;
