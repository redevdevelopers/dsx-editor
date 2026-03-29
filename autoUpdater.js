const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true;

class AutoUpdater {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.setupListeners();
    }

    setupListeners() {
        // Update available
        autoUpdater.on('update-available', (info) => {
            log.info('Update available:', info.version);
            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'Update Available',
                message: `A new version (${info.version}) is available!`,
                detail: `Current version: ${require('./package.json').version}\nNew version: ${info.version}\n\nWould you like to download it now?`,
                buttons: ['Download', 'Later'],
                defaultId: 0,
                cancelId: 1
            }).then(result => {
                if (result.response === 0) {
                    autoUpdater.downloadUpdate();
                    // Show download progress
                    dialog.showMessageBox(this.mainWindow, {
                        type: 'info',
                        title: 'Downloading Update',
                        message: 'Downloading update...',
                        detail: 'The update is being downloaded in the background. You will be notified when it\'s ready to install.',
                        buttons: ['OK']
                    });
                }
            });
        });

        // No update available
        autoUpdater.on('update-not-available', (info) => {
            log.info('Update not available:', info.version);
            // Only show dialog if manually checked
            if (this.manualCheck) {
                dialog.showMessageBox(this.mainWindow, {
                    type: 'info',
                    title: 'No Updates',
                    message: 'You are running the latest version!',
                    detail: `Current version: ${require('./package.json').version}`,
                    buttons: ['OK']
                });
                this.manualCheck = false;
            }
        });

        // Download progress
        autoUpdater.on('download-progress', (progressObj) => {
            const percent = Math.round(progressObj.percent);
            log.info(`Download progress: ${percent}%`);
            // Send progress to renderer if needed
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('download-progress', percent);
            }
        });

        // Update downloaded
        autoUpdater.on('update-downloaded', (info) => {
            log.info('Update downloaded:', info.version);
            dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'Update Ready',
                message: 'Update downloaded successfully!',
                detail: `Version ${info.version} has been downloaded and is ready to install.\n\nThe application will restart to apply the update.`,
                buttons: ['Restart Now', 'Later'],
                defaultId: 0,
                cancelId: 1
            }).then(result => {
                if (result.response === 0) {
                    autoUpdater.quitAndInstall(false, true);
                }
            });
        });

        // Error handling
        autoUpdater.on('error', (error) => {
            log.error('Update error:', error);
            dialog.showMessageBox(this.mainWindow, {
                type: 'error',
                title: 'Update Error',
                message: 'Failed to check for updates',
                detail: error.message || 'An unknown error occurred while checking for updates.',
                buttons: ['OK']
            });
        });
    }

    /**
     * Check for updates (manual check)
     */
    checkForUpdates() {
        this.manualCheck = true;
        log.info('Manually checking for updates...');
        autoUpdater.checkForUpdates();
    }

    /**
     * Check for updates silently (automatic check on startup)
     */
    checkForUpdatesQuietly() {
        this.manualCheck = false;
        log.info('Automatically checking for updates...');
        autoUpdater.checkForUpdates();
    }

    /**
     * Check for updates with callback (for initialization screen)
     * @param {Function} callback - Called when check completes (success or failure)
     */
    checkForUpdatesWithCallback(callback) {
        this.manualCheck = false;
        log.info('Checking for updates (initialization)...');

        // Set timeout to prevent hanging
        const timeout = setTimeout(() => {
            log.info('Update check timed out');
            if (callback) callback();
        }, 5000); // 5 second timeout

        // Listen for completion events
        const onComplete = () => {
            clearTimeout(timeout);
            if (callback) callback();
        };

        autoUpdater.once('update-available', onComplete);
        autoUpdater.once('update-not-available', onComplete);
        autoUpdater.once('error', onComplete);

        autoUpdater.checkForUpdates();
    }
}

module.exports = AutoUpdater;
