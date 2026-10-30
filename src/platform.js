// Platform layer: Electron (window.ace) or browser fallback (for development/testing)
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
  async openFile() {
    return new Promise(resolve => {
      const i = document.createElement('input');
      i.type = 'file'; i.accept = '.json';
      i.onchange = async () => { const f = i.files[0]; resolve(f ? { name: f.name, text: await f.text() } : null); };
      i.click();
    });
  },
  async openExternal(u) { window.open(u, '_blank'); return true; },
  async hardware() { return { platform: 'browser', gpus: [], ramGB: null }; },
  async version() { return 'dev'; },
  async checkUpdate() { return window.__ACE_MOCK_UPDATE || { available: false, current: 'dev', version: 'dev' }; },
  async installUpdate() { return false; },
  onUpdateProgress() { return () => {}; },
};

export const api = (typeof window !== 'undefined' && window.ace) ? window.ace : browser;
