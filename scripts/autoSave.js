/**
 * Auto-Save Manager for DreamSyncX Editor
 * Automatically saves work and provides recovery
 */

export class AutoSaveManager {
    constructor(editor) {
        this.editor = editor;
        this.autoSaveInterval = 2 * 60 * 1000; // 2 minutes
        this.autoSaveTimer = null;
        this.hasUnsavedChanges = false;
        this.lastSaveTime = null;
        this.autoSaveKey = 'dsx-editor-autosave';
        this.recoveryKey = 'dsx-editor-recovery';
        this.statusElement = null;
    }

    /**
     * Start auto-save timer
     */
    start() {
        this.stop(); // Clear any existing timer

        this.autoSaveTimer = setInterval(() => {
            if (this.hasUnsavedChanges) {
                this.performAutoSave();
            }
        }, this.autoSaveInterval);

        // Get status bar element
        this.statusElement = document.getElementById('status-autosave');
        this.updateStatusBar();
    }

    /**
     * Stop auto-save timer
     */
    stop() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Mark as having unsaved changes
     */
    markUnsaved() {
        this.hasUnsavedChanges = true;
        this.updateTitleBar();
        this.updateStatusBar();
    }

    /**
     * Mark as saved
     */
    markSaved() {
        this.hasUnsavedChanges = false;
        this.updateTitleBar();
        this.updateStatusBar();
    }

    /**
     * Perform auto-save
     */
    performAutoSave() {
        try {
            const saveData = {
                chart: this.editor._chart,
                settings: this.editor._settings,
                sessionMarkers: this.editor.sessionMarkers,
                timestamp: Date.now(),
                audioSrc: this.editor.audioPlayer?.src || null
            };

            localStorage.setItem(this.autoSaveKey, JSON.stringify(saveData));
            this.lastSaveTime = Date.now();
            this.hasUnsavedChanges = false;
            this.updateStatusBar();
            this.updateTitleBar();
        } catch (e) {
            this.updateStatusBar('Error');
        }
    }

    /**
     * Update status bar with auto-save info
     */
    updateStatusBar(status = null) {
        if (!this.statusElement) {
            this.statusElement = document.getElementById('status-autosave');
        }

        if (!this.statusElement) return;

        if (status === 'Error') {
            this.statusElement.textContent = 'Auto-save: Error';
            this.statusElement.style.color = '#ef4444';
            return;
        }

        if (this.hasUnsavedChanges) {
            this.statusElement.textContent = 'Auto-save: Unsaved';
            this.statusElement.style.color = '#f59e0b';
        } else if (this.lastSaveTime) {
            const elapsed = Math.floor((Date.now() - this.lastSaveTime) / 1000);
            if (elapsed < 60) {
                this.statusElement.textContent = `Auto-save: ${elapsed}s ago`;
            } else {
                const minutes = Math.floor(elapsed / 60);
                this.statusElement.textContent = `Auto-save: ${minutes}m ago`;
            }
            this.statusElement.style.color = '#e2e8f0';
        } else {
            this.statusElement.textContent = 'Auto-save: Ready';
            this.statusElement.style.color = '#e2e8f0';
        }
    }

    /**
     * Check for recovery data on startup
     */
    checkRecovery() {
        try {
            const recoveryData = localStorage.getItem(this.autoSaveKey);
            if (!recoveryData) {
                return null;
            }

            const data = JSON.parse(recoveryData);
            const age = Date.now() - data.timestamp;
            const ageMinutes = Math.floor(age / 60000);

            // Only offer recovery if less than 24 hours old
            if (age < 24 * 60 * 60 * 1000) {
                return {
                    data,
                    age: ageMinutes,
                    timestamp: new Date(data.timestamp)
                };
            }

            // Clear old recovery data
            this.clearRecovery();
            return null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Restore from auto-save
     */
    restore(recoveryData) {
        try {
            this.editor._chart = recoveryData.chart;
            this.editor._chartData.setChart(recoveryData.chart);
            this.editor.sessionMarkers = recoveryData.sessionMarkers || [];

            if (recoveryData.settings) {
                this.editor._settings = { ...this.editor._settings, ...recoveryData.settings };
            }
            this.editor._showToast('Recovered unsaved work');
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Clear recovery data
     */
    clearRecovery() {
        localStorage.removeItem(this.autoSaveKey);
        this.lastSaveTime = null;
        this.updateStatusBar();
    }

    /**
     * Update title bar with unsaved indicator
     */
    updateTitleBar() {
        const title = 'DreamSync Studio 4';
        document.title = this.hasUnsavedChanges ? `${title} *` : title;
    }

    /**
     * Prompt before closing with unsaved changes
     */
    setupBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }
}
