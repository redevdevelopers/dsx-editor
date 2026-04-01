const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    /**
     * Opens a native file dialog to select a chart file.
     * @returns {Promise<{filePath: string, content: string}|undefined>}
     */
    openChart: () => ipcRenderer.invoke('dialog:openFile'),
    /**
     * Opens a native save dialog to save the chart data.
     * @param {{data: string, defaultPath: string}} options
     * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
     */
    saveChart: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    /**
     * Opens a native file dialog to select multiple files.
     * @returns {Promise<{canceled: boolean, files?: Array<{filePath: string, content: string}>, error?: string}>}
     */
    openMultipleFiles: () => ipcRenderer.invoke('dialog:openMultipleFiles'),
    /**
     * Opens a native file dialog to select beatmap files for training.
     * @param {{format: string}} options - The beatmap format (osu, stepmania, bms, etc.)
     * @returns {Promise<{canceled: boolean, files?: Array<{filePath: string, content: string, name: string}>, error?: string}>}
     */
    openBeatmapFiles: (options) => ipcRenderer.invoke('dialog:openBeatmapFiles', options),

    /**
     * Opens a native file dialog to select an audio file.
     * @returns {Promise<{canceled: boolean, filePath?: string, fileName?: string, buffer?: ArrayBuffer, error?: string}>}
     */
    openAudioFile: () => ipcRenderer.invoke('dialog:openAudioFile'),

    /**
     * Register a callback for menu events
     * @param {string} channel - The menu event channel
     * @param {Function} callback - The callback function
     */
    onMenuEvent: (channel, callback) => {
        ipcRenderer.on(channel, callback);
    },

    /**
     * Remove a menu event listener
     * @param {string} channel - The menu event channel
     * @param {Function} callback - The callback function
     */
    removeMenuListener: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    },

    /**
     * Check for updates (for initialization screen)
     * @returns {Promise<void>}
     */
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

    /**
     * Check for updates quietly in the background
     * @returns {Promise<void>}
     */
    checkForUpdatesQuietly: () => ipcRenderer.invoke('check-for-updates-quietly'),

    /**
     * Get the application version
     * @returns {Promise<string>}
     */
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    /**
     * Get the release notes
     * @returns {Promise<string>}
     */
    getReleaseNotes: () => ipcRenderer.invoke('get-release-notes'),

    /**
     * Save backup file to disk
     * @param {string} jsonData - The JSON data to backup
     * @returns {Promise<{success: boolean, backupPath?: string, error?: string}>}
     */
    saveBackup: (jsonData) => ipcRenderer.invoke('save-backup', jsonData),

    /**
     * Listen for a close confirmation request from the main process
     * @param {Function} callback - Called with no args when main process wants to close
     */
    onCloseRequested: (callback) => ipcRenderer.on('close-requested', callback),

    /**
     * Send the user's close decision back to the main process
     * @param {boolean} canClose - Whether the window is allowed to close
     */
    respondToClose: (canClose) => ipcRenderer.send('close-response', canClose)
});