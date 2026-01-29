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
    openBeatmapFiles: (options) => ipcRenderer.invoke('dialog:openBeatmapFiles', options)
});