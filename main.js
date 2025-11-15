const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises; // Use the promise-based version of fs

function createWindow() {
    const win = new BrowserWindow({
        width: 1366,
        height: 768,
        fullscreen: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        autoHideMenuBar: false,
    });

    win.loadFile('index.html');

    // Reload the window when entering or leaving full-screen mode
    win.on('enter-full-screen', () => {
        win.webContents.reload();
    });
    win.on('leave-full-screen', () => {
        win.webContents.reload();
    });

    const template = [
        {
            label: 'DreamSyncX Editor Version',
            submenu: [
                {
                    label: `Version`,
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'DreamSyncX Editor Version',
                            message: `You are currently running DSX-Editor Build v3 (BETA). BASED DSX V1.12-D. Compiled on 16th November 2025.`,
                            buttons: ['OK']
                        });
                    }
                }
            ]
        },
        {
            label: 'Client Options',
            submenu: [
                {
                    label: 'Reload/Restart App',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.reload();
                        }
                    }
                },
                {
                    label: 'Force Reload',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.reloadIgnoringCache();
                        }
                    }
                },
                {
                    label: 'Full Screen',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.setFullScreen(!window.isFullScreen());
                        }
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('ignore-gpu-blacklist');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8096');
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

// --- IPC Handlers for native file operations ---

async function handleFileOpen() {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (canceled || filePaths.length === 0) {
        return;
    }
    try {
        const content = await fs.readFile(filePaths[0], 'utf-8');
        return { filePath: filePaths[0], content };
    } catch (error) {
        console.error('Failed to read file', error);
        dialog.showErrorBox('File Read Error', `Could not read the file: ${error.message}`);
    }
}

async function handleFileSave(event, { data, defaultPath }) {
    const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: defaultPath,
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (canceled || !filePath) {
        return { success: false };
    }

    try {
        await fs.writeFile(filePath, data);
        return { success: true, filePath };
    } catch (error) {
        console.error('Failed to save file', error);
        dialog.showErrorBox('File Save Error', `Could not save the file: ${error.message}`);
        return { success: false, error: error.message };
    }
}

app.on('ready', () => {
    ipcMain.handle('dialog:openFile', handleFileOpen);
    ipcMain.handle('dialog:saveFile', handleFileSave);
});