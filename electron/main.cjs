const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { promises: fsPromises } = fs;

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

const loadSettings = () => {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    return { autoSave: false };
};

const saveSettings = (settings) => {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
};

function createWindow() {
    const settings = loadSettings();

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
    }

    // Menu Template
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Auto Save',
                    type: 'checkbox',
                    checked: settings.autoSave,
                    click: (menuItem) => {
                        const newSettings = loadSettings();
                        newSettings.autoSave = menuItem.checked;
                        saveSettings(newSettings);
                        win.webContents.send('auto-save-change', menuItem.checked);
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    if (isDev) {
        win.loadURL('http://localhost:5173/'); // Vite dev server URL
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

// Disable hardware acceleration to fix GPU crashes
app.disableHardwareAcceleration();

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers ---

// Helper to get absolute path
const getPath = (relativePath) => {
    if (app.isPackaged) {
        // In production, resources are in process.resourcesPath
        return path.join(process.resourcesPath, relativePath);
    }
    // In dev, relative to project root
    return path.join(__dirname, '..', relativePath);
};

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const absolutePath = getPath(filePath);
        const content = await fsPromises.readFile(absolutePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
        const absolutePath = getPath(filePath);
        // console.log(`[Main] Writing file to: ${absolutePath}`);
        await fsPromises.writeFile(absolutePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error(`[Main] Write failed: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('create-file', async (event, filePath, content = '') => {
    try {
        const absolutePath = getPath(filePath);
        await fsPromises.writeFile(absolutePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        const absolutePath = getPath(filePath);
        // Use rm with recursive: true to handle both files and directories
        await fsPromises.rm(absolutePath, { recursive: true, force: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('create-dir', async (event, dirPath) => {
    try {
        const absolutePath = getPath(dirPath);
        await fsPromises.mkdir(absolutePath, { recursive: true });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('rename-path', async (event, oldPath, newPath) => {
    try {
        const absoluteOldPath = getPath(oldPath);
        const absoluteNewPath = getPath(newPath);
        await fsPromises.rename(absoluteOldPath, absoluteNewPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// We might need a way to get the project root path to the frontend so it knows where to look
ipcMain.handle('get-root-path', () => {
    return path.resolve(__dirname, '..');
});

ipcMain.handle('run-generator', async () => {
    const { exec } = require('child_process');
    let scriptPath;
    if (app.isPackaged) {
        scriptPath = path.join(process.resourcesPath, 'scripts/generate-content.js');
    } else {
        scriptPath = path.join(__dirname, '../scripts/generate-content.js');
    }

    return new Promise((resolve) => {
        exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                resolve({ success: false, error: error.message });
                return;
            }
            // console.log(`stdout: ${stdout}`);
            if (stderr) console.error(`stderr: ${stderr}`);
            resolve({ success: true });
        });
    });
});

ipcMain.handle('get-auto-save-status', () => {
    const menu = Menu.getApplicationMenu();
    if (!menu) return false;
    const fileMenu = menu.items.find(item => item.label === 'File');
    if (!fileMenu) return false;
    const autoSave = fileMenu.submenu.items.find(item => item.label === 'Auto Save');
    return autoSave ? autoSave.checked : false;
});
