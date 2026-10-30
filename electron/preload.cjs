const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ace', {
  isElectron: true,
  fetchData: (url, opts) => ipcRenderer.invoke('data:fetch', url, opts),
  clearCache: () => ipcRenderer.invoke('data:clearCache'),
  listChars: () => ipcRenderer.invoke('chars:list'),
  loadChar: (id) => ipcRenderer.invoke('chars:load', id),
  saveChar: (c) => ipcRenderer.invoke('chars:save', c),
  deleteChar: (id) => ipcRenderer.invoke('chars:delete', id),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  saveFile: (o) => ipcRenderer.invoke('file:save', o),
  openFile: (o) => ipcRenderer.invoke('file:open', o),
  openExternal: (u) => ipcRenderer.invoke('sys:openExternal', u),
  hardware: () => ipcRenderer.invoke('sys:hardware'),
  version: () => ipcRenderer.invoke('app:version'),
});
