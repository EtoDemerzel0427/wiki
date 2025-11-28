const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
    createFile: (path, content) => ipcRenderer.invoke('create-file', path, content),
    deleteFile: (path) => ipcRenderer.invoke('delete-file', path),
    createDir: (path) => ipcRenderer.invoke('create-dir', path),
    renamePath: (oldPath, newPath) => ipcRenderer.invoke('rename-path', oldPath, newPath),
    getRootPath: () => ipcRenderer.invoke('get-root-path'),
    runGenerator: () => ipcRenderer.invoke('run-generator'),
    onAutoSaveChange: (callback) => ipcRenderer.on('auto-save-change', (event, value) => callback(value)),
    getAutoSaveStatus: () => ipcRenderer.invoke('get-auto-save-status'),
});
