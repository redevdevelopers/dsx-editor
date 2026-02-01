/**
 * Transition Manager - UI for managing layout transitions in the editor
 */
export class TransitionManager {
    constructor(editor) {
        this.editor = editor;
        this.transitions = [];
        this.selectedTransition = null;
        this.isEditingTransition = false;

        // Transition presets
        this.presets = {
            quick: { duration: 500, easing: 'easeInOutCubic', flashIntensity: 0.5, particleCount: 20 },
            standard: { duration: 1000, easing: 'easeInOutCubic', flashIntensity: 0.5, particleCount: 20 },
            smooth: { duration: 1500, easing: 'easeInOutQuint', flashIntensity: 0.3, particleCount: 15 },
            dramatic: { duration: 2000, easing: 'easeInOutQuint', flashIntensity: 0.6, particleCount: 30 },
            bouncy: { duration: 800, easing: 'easeOutBounce', flashIntensity: 0.7, particleCount: 25 },
            elastic: { duration: 800, easing: 'easeOutElastic', flashIntensity: 0.6, particleCount: 25 }
        };
    }

    /**
     * Initialize transition manager UI
     */
    init() {
        this.createTransitionPanel();
        this.createTransitionMarkers();
        this.setupEventListeners();
    }

    /**
     * Create transition control panel
     */
    createTransitionPanel() {
        const container = document.getElementById('transition-panel-content');
        if (!container) {
            console.warn('[TransitionManager] transition-panel-content not found');
            return;
        }

        container.innerHTML = `
            <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <button id="add-transition-btn" class="btn-icon" title="Add Transition" style="width: 100%;">
                    <span>+ Add Transition</span>
                </button>
            </div>
            <div id="transition-list" class="transition-list">
                <p class="empty-state">No transitions yet. Click + to add one.</p>
            </div>
            <div id="transition-editor" class="transition-editor" style="display: none;">
                <h4>Edit Transition</h4>
                
                <div class="form-group">
                    <label>Time (ms)</label>
                    <input type="number" id="transition-time" min="0" step="100" />
                </div>
                
                <div class="form-group">
                    <label>Mode</label>
                    <select id="transition-mode">
                        <option value="ring">Ring</option>
                        <option value="honeycomb">Honeycomb</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Preset</label>
                    <select id="transition-preset">
                        <option value="">Custom</option>
                        <option value="quick">Quick (500ms)</option>
                        <option value="standard">Standard (1000ms)</option>
                        <option value="smooth">Smooth (1500ms)</option>
                        <option value="dramatic">Dramatic (2000ms)</option>
                        <option value="bouncy">Bouncy (800ms)</option>
                        <option value="elastic">Elastic (800ms)</option>
                    </select>
                </div>
                
                <details class="advanced-settings">
                    <summary>Advanced Settings</summary>
                    
                    <div class="form-group">
                        <label>Duration (ms)</label>
                        <input type="number" id="transition-duration" min="100" max="5000" step="100" value="1000" />
                    </div>
                    
                    <div class="form-group">
                        <label>Easing</label>
                        <select id="transition-easing">
                            <option value="linear">Linear</option>
                            <option value="easeInOutQuad">Ease In/Out Quad</option>
                            <option value="easeInOutCubic" selected>Ease In/Out Cubic</option>
                            <option value="easeInOutQuart">Ease In/Out Quart</option>
                            <option value="easeInOutQuint">Ease In/Out Quint</option>
                            <option value="easeOutElastic">Elastic</option>
                            <option value="easeOutBounce">Bounce</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Scale From</label>
                        <input type="number" id="transition-scale-from" min="0" max="2" step="0.1" value="0.8" />
                    </div>
                    
                    <div class="form-group">
                        <label>Scale To</label>
                        <input type="number" id="transition-scale-to" min="0" max="2" step="0.1" value="1.0" />
                    </div>
                    
                    <div class="form-group">
                        <label>Camera Zoom</label>
                        <input type="number" id="transition-camera-zoom" min="0.5" max="1.5" step="0.05" placeholder="Auto" />
                    </div>
                    
                    <div class="form-group">
                        <label>Flash Intensity</label>
                        <input type="range" id="transition-flash" min="0" max="1" step="0.1" value="0.5" />
                        <span id="flash-value">0.5</span>
                    </div>
                    
                    <div class="form-group">
                        <label>Particle Count</label>
                        <input type="number" id="transition-particles" min="0" max="100" step="5" value="20" />
                    </div>
                    
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" id="transition-show-boundary" checked />
                            Show Ring Boundary
                        </label>
                    </div>
                    
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" id="transition-show-marker" checked />
                            Show Center Marker
                        </label>
                    </div>
                </details>
                
                <div class="button-group">
                    <button id="save-transition-btn" class="btn-primary" title="Save Transition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                        </svg>
                    </button>
                    <button id="delete-transition-btn" class="btn-danger" title="Delete Transition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                    <button id="cancel-transition-btn" class="btn-secondary" title="Cancel">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        this.panel = container;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Add transition button
        const addBtn = document.getElementById('add-transition-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addTransitionAtCurrentTime());
        }

        // Preset selector
        const presetSelect = document.getElementById('transition-preset');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => this.applyPreset(e.target.value));
        }

        // Flash intensity slider
        const flashSlider = document.getElementById('transition-flash');
        const flashValue = document.getElementById('flash-value');
        if (flashSlider && flashValue) {
            flashSlider.addEventListener('input', (e) => {
                flashValue.textContent = e.target.value;
            });
        }

        // Save button
        const saveBtn = document.getElementById('save-transition-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCurrentTransition());
        }

        // Delete button
        const deleteBtn = document.getElementById('delete-transition-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.deleteCurrentTransition());
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-transition-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelEdit());
        }
    }

    /**
     * Add transition at current playback time
     */
    addTransitionAtCurrentTime() {
        // Get current time from audio player
        let currentTime = 0;
        if (this.editor.audioPlayer && !isNaN(this.editor.audioPlayer.currentTime)) {
            currentTime = Math.round(this.editor.audioPlayer.currentTime * 1000); // Convert to ms
        }

        const transition = {
            time: currentTime,
            mode: 'ring',
            duration: 1000,
            easing: 'easeInOutCubic',
            scaleFrom: 0.8,
            scaleTo: 1.0,
            flashIntensity: 0.5,
            particleCount: 20,
            showRingBoundary: true,
            showCenterMarker: true
        };

        this.editTransition(transition, true);
    }

    /**
     * Edit a transition
     */
    editTransition(transition, isNew = false) {
        this.selectedTransition = transition;
        this.isEditingTransition = true;
        this.isNewTransition = isNew;

        // Show editor panel
        const editor = document.getElementById('transition-editor');
        if (editor) {
            editor.style.display = 'block';
        }

        // Populate form
        this.populateForm(transition);
    }

    /**
     * Populate form with transition data
     */
    populateForm(transition) {
        document.getElementById('transition-time').value = transition.time || 0;
        document.getElementById('transition-mode').value = transition.mode || 'ring';
        document.getElementById('transition-duration').value = transition.duration || 1000;
        document.getElementById('transition-easing').value = transition.easing || 'easeInOutCubic';
        document.getElementById('transition-scale-from').value = transition.scaleFrom ?? 0.8;
        document.getElementById('transition-scale-to').value = transition.scaleTo ?? 1.0;
        document.getElementById('transition-camera-zoom').value = transition.cameraZoom || '';
        document.getElementById('transition-flash').value = transition.flashIntensity ?? 0.5;
        document.getElementById('flash-value').textContent = transition.flashIntensity ?? 0.5;
        document.getElementById('transition-particles').value = transition.particleCount ?? 20;
        document.getElementById('transition-show-boundary').checked = transition.showRingBoundary !== false;
        document.getElementById('transition-show-marker').checked = transition.showCenterMarker !== false;
    }

    /**
     * Apply a preset
     */
    applyPreset(presetName) {
        if (!presetName || !this.presets[presetName]) return;

        const preset = this.presets[presetName];
        document.getElementById('transition-duration').value = preset.duration;
        document.getElementById('transition-easing').value = preset.easing;
        document.getElementById('transition-flash').value = preset.flashIntensity;
        document.getElementById('flash-value').textContent = preset.flashIntensity;
        document.getElementById('transition-particles').value = preset.particleCount;
    }

    /**
     * Save current transition
     */
    saveCurrentTransition() {
        if (!this.selectedTransition) return;

        // Read form values
        const transition = {
            time: parseInt(document.getElementById('transition-time').value),
            mode: document.getElementById('transition-mode').value,
            duration: parseInt(document.getElementById('transition-duration').value),
            easing: document.getElementById('transition-easing').value,
            scaleFrom: parseFloat(document.getElementById('transition-scale-from').value),
            scaleTo: parseFloat(document.getElementById('transition-scale-to').value),
            flashIntensity: parseFloat(document.getElementById('transition-flash').value),
            particleCount: parseInt(document.getElementById('transition-particles').value),
            showRingBoundary: document.getElementById('transition-show-boundary').checked,
            showCenterMarker: document.getElementById('transition-show-marker').checked
        };

        // Add camera zoom if specified
        const cameraZoom = document.getElementById('transition-camera-zoom').value;
        if (cameraZoom) {
            transition.cameraZoom = parseFloat(cameraZoom);
        }

        // Add or update transition
        if (this.isNewTransition) {
            this.editor._chart.transitions.push(transition);
        } else {
            const index = this.editor._chart.transitions.indexOf(this.selectedTransition);
            if (index !== -1) {
                this.editor._chart.transitions[index] = transition;
            }
        }

        // Sort transitions by time
        this.editor._chart.transitions.sort((a, b) => a.time - b.time);

        // Update UI
        this.refreshTransitionList();
        this.cancelEdit();

        // Update gameplay
        this.updateGameplayTransitions();
    }

    /**
     * Delete current transition
     */
    deleteCurrentTransition() {
        if (!this.selectedTransition) return;

        const index = this.editor._chart.transitions.indexOf(this.selectedTransition);
        if (index !== -1) {
            this.editor._chart.transitions.splice(index, 1);
        }

        this.refreshTransitionList();
        this.cancelEdit();
        this.updateGameplayTransitions();
    }

    /**
     * Cancel edit
     */
    cancelEdit() {
        this.selectedTransition = null;
        this.isEditingTransition = false;
        this.isNewTransition = false;

        const editor = document.getElementById('transition-editor');
        if (editor) {
            editor.style.display = 'none';
        }
    }

    /**
     * Refresh transition list
     */
    refreshTransitionList() {
        const list = document.getElementById('transition-list');
        if (!list) return;

        const transitions = this.editor._chart.transitions || [];

        if (transitions.length === 0) {
            list.innerHTML = '<p class="empty-state">No transitions yet. Click + to add one.</p>';
            return;
        }

        list.innerHTML = transitions.map((t, index) => `
            <div class="transition-item" data-index="${index}">
                <div class="transition-info">
                    <strong>${this.formatTime(t.time)}</strong>
                    <span class="transition-mode">${t.mode}</span>
                    <span class="transition-duration">${t.duration}ms</span>
                </div>
                <button class="btn-edit" data-index="${index}">Edit</button>
            </div>
        `).join('');

        // Add click handlers
        list.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.editTransition(transitions[index], false);
            });
        });
    }

    /**
     * Format time in MM:SS.mmm
     */
    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const millis = ms % 1000;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    }

    /**
     * Create transition markers on timeline
     */
    createTransitionMarkers() {
        // This will be called by the timeline to draw transition markers
        // Implementation depends on timeline structure
    }

    /**
     * Update gameplay with current transitions
     */
    updateGameplayTransitions() {
        if (this.editor.gameplay && this.editor.gameplay.transitionController) {
            this.editor.gameplay.transitionController.loadTransitions(this.editor._chart.transitions || []);
        }
    }

    /**
     * Load transitions from chart
     */
    loadTransitions(transitions) {
        this.editor._chart.transitions = transitions || [];
        this.refreshTransitionList();
        this.updateGameplayTransitions();
    }
}
