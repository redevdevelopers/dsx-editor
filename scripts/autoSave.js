/**
 * Auto-Save Manager for DreamSyncX Editor
 * Automatically saves work and provides recovery
 */

import { ChartData } from './chartData.js';

export class AutoSaveManager {
    constructor(editor) {
        this.editor = editor;
        this.autoSaveInterval = 30 * 1000; // 30 seconds (reduced from 2 minutes)
        this.autoSaveTimer = null;
        this.hasUnsavedChanges = false;
        this.lastSaveTime = null;
        this.autoSaveKey = 'dsx-editor-autosave';
        this.recoveryKey = 'dsx-editor-recovery';
        this.backupKey = 'dsx-editor-backup'; // Secondary backup
        this.statusElement = null;
        this.isEnabled = true;
        this.saveCount = 0; // Track number of saves
        this.lastNoteCount = 0; // Track note count changes
    }

    /**
     * Start auto-save timer
     */
    start() {
        this.stop(); // Clear any existing timer

        if (!this.isEnabled) {
            console.log('[AutoSave] Auto-save is disabled');
            return;
        }

        console.log('[AutoSave] Starting auto-save with interval:', this.autoSaveInterval / 1000, 'seconds');

        this.autoSaveTimer = setInterval(() => {
            if (this.hasUnsavedChanges) {
                console.log('[AutoSave] Performing auto-save...');
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
        console.log('[AutoSave] Marked as unsaved');
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
     * Perform auto-save with multiple redundancy layers
     */
    performAutoSave() {
        try {
            const currentNoteCount = this.editor._chart?.notes?.length || 0;

            const saveData = {
                chart: this.editor._chart,
                settings: this.editor._settings,
                sessionMarkers: this.editor.sessionMarkers,
                timestamp: Date.now(),
                audioSrc: this.editor.audioPlayer?.src || null,
                noteCount: currentNoteCount,
                saveNumber: ++this.saveCount
            };

            // Validate that we're actually saving notes
            if (!saveData.chart || !saveData.chart.notes) {
                console.warn('[AutoSave] Warning: No notes array in chart data!');
            } else {
                console.log(`[AutoSave] Saving ${currentNoteCount} notes (save #${this.saveCount})`);
            }

            const jsonData = JSON.stringify(saveData);

            // Primary save to localStorage
            localStorage.setItem(this.autoSaveKey, jsonData);

            // Secondary backup (keep previous version)
            const previousBackup = localStorage.getItem(this.autoSaveKey);
            if (previousBackup) {
                localStorage.setItem(this.backupKey, previousBackup);
            }

            // File-based backup using Electron API (if available)
            if (window.electronAPI && window.electronAPI.saveBackup) {
                window.electronAPI.saveBackup(jsonData).catch(err => {
                    console.warn('[AutoSave] File backup failed:', err);
                });
            }

            this.lastSaveTime = Date.now();
            this.lastNoteCount = currentNoteCount;
            this.hasUnsavedChanges = false;
            this.updateStatusBar();
            this.updateTitleBar();

            console.log('[AutoSave] Auto-save completed successfully');
            console.log(`[AutoSave] Data size: ${(jsonData.length / 1024).toFixed(2)} KB`);
        } catch (e) {
            console.error('[AutoSave] Auto-save failed:', e);
            this.updateStatusBar('Error');

            // Try emergency backup to a different key
            try {
                const emergencyData = {
                    chart: this.editor._chart,
                    timestamp: Date.now(),
                    emergency: true
                };
                localStorage.setItem('dsx-editor-emergency', JSON.stringify(emergencyData));
                console.log('[AutoSave] Emergency backup saved');
            } catch (emergencyError) {
                console.error('[AutoSave] Emergency backup also failed:', emergencyError);
            }
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

        if (!this.isEnabled) {
            this.statusElement.textContent = 'Auto-save: Off';
            this.statusElement.style.color = '#64748b';
            return;
        }

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
            this.statusElement.style.color = '#10b981';
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
            // Check primary auto-save
            let recoveryData = localStorage.getItem(this.autoSaveKey);
            let source = 'primary';

            // If primary is corrupted or empty, try backup
            if (!recoveryData || recoveryData.length < 100) {
                console.log('[AutoSave] Primary auto-save empty/corrupted, checking backup...');
                recoveryData = localStorage.getItem(this.backupKey);
                source = 'backup';
            }

            // Try emergency backup as last resort
            if (!recoveryData || recoveryData.length < 100) {
                console.log('[AutoSave] Backup empty/corrupted, checking emergency...');
                recoveryData = localStorage.getItem('dsx-editor-emergency');
                source = 'emergency';
            }

            if (!recoveryData) {
                return null;
            }

            const data = JSON.parse(recoveryData);
            const age = Date.now() - data.timestamp;
            const ageMinutes = Math.floor(age / 60000);

            // Validate that we have actual chart data
            const noteCount = data.chart?.notes?.length || 0;
            console.log(`[AutoSave] Found ${source} recovery data with ${noteCount} notes`);

            // Only offer recovery if less than 24 hours old
            if (age < 24 * 60 * 60 * 1000) {
                return {
                    data,
                    age: ageMinutes,
                    timestamp: new Date(data.timestamp),
                    noteCount,
                    source
                };
            }

            // Clear old recovery data
            this.clearRecovery();
            return null;
        } catch (e) {
            console.error('[AutoSave] Error checking recovery:', e);
            return null;
        }
    }

    /**
     * Restore from auto-save
     */
    restore(recoveryData) {
        try {
            this.editor._chart = recoveryData.chart;

            // Recreate ChartData instance with recovered data
            this.editor._chartData = new ChartData(recoveryData.chart);

            this.editor.sessionMarkers = recoveryData.sessionMarkers || [];

            if (recoveryData.settings) {
                this.editor._settings = { ...this.editor._settings, ...recoveryData.settings };
            }

            this.editor._showToast('Recovered unsaved work');
            console.log('[AutoSave] Successfully restored from auto-save');
            return true;
        } catch (e) {
            console.error('[AutoSave] Error restoring from auto-save:', e);
            return false;
        }
    }

    /**
     * Clear recovery data
     */
    clearRecovery() {
        localStorage.removeItem(this.autoSaveKey);
        localStorage.removeItem(this.backupKey);
        localStorage.removeItem('dsx-editor-emergency');
        this.lastSaveTime = null;
        this.updateStatusBar();
    }

    /**
     * Update title bar with unsaved indicator
     */
    updateTitleBar() {
        const title = 'DreamSync Studio 6';
        document.title = this.hasUnsavedChanges ? `${title} *` : title;
    }

    /**
     * Respond to Electron's native close confirmation request.
     * main.js sends 'close-requested' via IPC; we reply with whether it's safe to close.
     * This replaces the broken beforeunload e.preventDefault() approach.
     */
    setupBeforeUnload() {
        if (window.electronAPI && window.electronAPI.onCloseRequested) {
            window.electronAPI.onCloseRequested(() => {
                // Reply: true = safe to close, false = has unsaved changes (show dialog)
                window.electronAPI.respondToClose(!this.hasUnsavedChanges);
            });
        } else {
            // Fallback for non-Electron environments (browser preview etc.)
            window.addEventListener('beforeunload', (e) => {
                if (this.hasUnsavedChanges) {
                    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                }
            });
        }
    }
}
