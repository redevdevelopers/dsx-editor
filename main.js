const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises; // Use the promise-based version of fs

function createWindow() {
    const win = new BrowserWindow({
        width: 1600,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        fullscreen: false,
        show: false, // Don't show until ready
        backgroundColor: '#1e1e1e',
        icon: path.join(__dirname, 'assets/icon/dsxicon256.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            devTools: false // Disable DevTools completely
        },
        autoHideMenuBar: false,
        frame: true,
        resizable: true,
    });

    // Prevent DevTools from being opened
    win.webContents.on('devtools-opened', () => {
        win.webContents.closeDevTools();
    });

    // Block F12 and other DevTools shortcuts
    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' ||
            (input.control && input.shift && input.key === 'I') ||
            (input.control && input.shift && input.key === 'J') ||
            (input.control && input.shift && input.key === 'C')) {
            event.preventDefault();
        }
    });

    // Show window when ready to prevent white flash
    win.once('ready-to-show', () => {
        win.show();
    });

    win.loadFile('chart-editor.html');

    // Reload the window when entering or leaving full-screen mode.
    // The confirmation dialog is now handled by the menu item that triggers this.
    win.on('enter-full-screen', () => {
        win.webContents.reload();
    });
    win.on('leave-full-screen', () => {
        win.webContents.reload();
    });

    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Chart',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-new-chart');
                        }
                    }
                },
                {
                    label: 'Open Chart',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-open-chart');
                        }
                    }
                },
                {
                    label: 'Save Chart',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-save-chart');
                        }
                    }
                },
                {
                    label: 'Save Chart As...',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-save-chart-as');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Import',
                    submenu: [
                        {
                            label: 'Import osu!mania Chart',
                            click: () => {
                                const window = BrowserWindow.getFocusedWindow();
                                if (window) {
                                    window.webContents.send('menu-import-osu');
                                }
                            }
                        },
                        {
                            label: 'Import Audio File',
                            click: () => {
                                const window = BrowserWindow.getFocusedWindow();
                                if (window) {
                                    window.webContents.send('menu-import-audio');
                                }
                            }
                        }
                    ]
                },
                {
                    label: 'Export',
                    submenu: [
                        {
                            label: 'Export Chart',
                            click: () => {
                                const window = BrowserWindow.getFocusedWindow();
                                if (window) {
                                    window.webContents.send('menu-export-chart');
                                }
                            }
                        }
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Settings',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-open-settings');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: 'Alt+F4',
                    role: 'quit'
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-undo');
                        }
                    }
                },
                {
                    label: 'Redo',
                    accelerator: 'CmdOrCtrl+Y',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-redo');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Select All Notes',
                    accelerator: 'CmdOrCtrl+A',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-select-all');
                        }
                    }
                },
                {
                    label: 'Delete Selected',
                    accelerator: 'Delete',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-delete-selected');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-copy');
                        }
                    }
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-paste');
                        }
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Zoom In',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-zoom-in');
                        }
                    }
                },
                {
                    label: 'Zoom Out',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-zoom-out');
                        }
                    }
                },
                {
                    label: 'Reset Zoom',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-zoom-reset');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Toggle Grid',
                    accelerator: 'G',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-toggle-grid');
                        }
                    }
                },
                {
                    label: 'Toggle Metronome',
                    accelerator: 'M',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-toggle-metronome');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Full-Screen Mode',
                    accelerator: 'F11',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (!window) return;
                        window.setFullScreen(!window.isFullScreen());
                    }
                }
            ]
        },
        {
            label: 'Playback',
            submenu: [
                {
                    label: 'Play/Pause',
                    accelerator: 'Space',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-play-pause');
                        }
                    }
                },
                {
                    label: 'Stop',
                    accelerator: 'Escape',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-stop');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Jump to Start',
                    accelerator: 'Home',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-jump-start');
                        }
                    }
                },
                {
                    label: 'Jump to End',
                    accelerator: 'End',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-jump-end');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Playback Speed',
                    submenu: [
                        {
                            label: '0.5x',
                            click: () => {
                                const window = BrowserWindow.getFocusedWindow();
                                if (window) {
                                    window.webContents.send('menu-playback-speed', 0.5);
                                }
                            }
                        },
                        {
                            label: '0.75x',
                            click: () => {
                                const window = BrowserWindow.getFocusedWindow();
                                if (window) {
                                    window.webContents.send('menu-playback-speed', 0.75);
                                }
                            }
                        },
                        {
                            label: '1.0x (Normal)',
                            click: () => {
                                const window = BrowserWindow.getFocusedWindow();
                                if (window) {
                                    window.webContents.send('menu-playback-speed', 1.0);
                                }
                            }
                        },
                        {
                            label: '1.25x',
                            click: () => {
                                const window = BrowserWindow.getFocusedWindow();
                                if (window) {
                                    window.webContents.send('menu-playback-speed', 1.25);
                                }
                            }
                        },
                        {
                            label: '1.5x',
                            click: () => {
                                const window = BrowserWindow.getFocusedWindow();
                                if (window) {
                                    window.webContents.send('menu-playback-speed', 1.5);
                                }
                            }
                        }
                    ]
                }
            ]
        },
        {
            label: 'Tools',
            submenu: [
                {
                    label: 'AI Auto-Mapper',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-ai-automapper');
                        }
                    }
                },
                {
                    label: 'Train AI Model',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-train-ai');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Chart Statistics',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-chart-stats');
                        }
                    }
                },
                {
                    label: 'Validate Chart',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-validate-chart');
                        }
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-documentation');
                        }
                    }
                },
                {
                    label: 'Keyboard Shortcuts',
                    accelerator: 'F1',
                    click: () => {
                        const window = BrowserWindow.getFocusedWindow();
                        if (window) {
                            window.webContents.send('menu-shortcuts');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Check for Updates',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Updates',
                            message: 'You are running the latest version.',
                            buttons: ['OK']
                        });
                    }
                },
                {
                    label: 'About DreamSync Studio 4',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'About DreamSync Studio 4',
                            message: `DreamSync Studio 4 v4.0.0\n\nProfessional chart editor for DreamSyncX\nBased on DSX V1.56-G\n\nCompiled: January 30, 2026\n\n© 2026 Redevon Studios / Kynix Teams`,
                            buttons: ['OK']
                        });
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

    // Register IPC handlers before creating window
    ipcMain.handle('dialog:openFile', handleFileOpen);
    ipcMain.handle('dialog:saveFile', handleFileSave);
    ipcMain.handle('dialog:openMultipleFiles', handleOpenMultipleFiles);
    ipcMain.handle('dialog:openBeatmapFiles', handleOpenBeatmapFiles);

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

async function handleOpenMultipleFiles() {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (canceled || filePaths.length === 0) {
        return { canceled: true };
    }

    try {
        const files = [];
        for (const filePath of filePaths) {
            const content = await fs.readFile(filePath, 'utf-8');
            files.push({ filePath, content });
        }
        return { canceled: false, files };
    } catch (error) {
        console.error('Failed to read files', error);
        dialog.showErrorBox('File Read Error', `Could not read files: ${error.message}`);
        return { canceled: true, error: error.message };
    }
}

async function handleOpenBeatmapFiles(event, { format }) {
    // Set file filters based on format
    let filters = [];
    if (format === 'osu' || format === 'osumania') {
        filters = [
            { name: 'osu! Beatmaps', extensions: ['osu', 'osz'] },
            { name: 'All Files', extensions: ['*'] }
        ];
    } else if (format === 'stepmania' || format === 'sm') {
        filters = [
            { name: 'StepMania Charts', extensions: ['sm'] },
            { name: 'All Files', extensions: ['*'] }
        ];
    } else if (format === 'bms' || format === 'bme') {
        filters = [
            { name: 'BMS Charts', extensions: ['bms', 'bme'] },
            { name: 'All Files', extensions: ['*'] }
        ];
    } else {
        filters = [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ];
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: filters,
        title: `Select ${format} beatmap files`
    });

    if (canceled || filePaths.length === 0) {
        return { canceled: true };
    }

    try {
        const files = [];
        for (const filePath of filePaths) {
            const content = await fs.readFile(filePath, 'utf-8');
            files.push({ filePath, content, name: path.basename(filePath) });
        }
        return { canceled: false, files };
    } catch (error) {
        console.error('Failed to read beatmap files', error);
        dialog.showErrorBox('File Read Error', `Could not read files: ${error.message}`);
        return { canceled: true, error: error.message };
    }
}