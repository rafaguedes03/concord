const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getScreenSources: async () => {
    return await ipcRenderer.invoke('get-screen-sources');
  },
  setSelectedSource: async (sourceId) => {
    return await ipcRenderer.invoke('set-selected-source', sourceId);
  },
  getAppVersion: async () => {
    return await ipcRenderer.invoke('get-app-version');
  },
  applyUpdate: async (arrayBuffer) => {
    return await ipcRenderer.invoke('apply-update', arrayBuffer);
  },
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close')
});
