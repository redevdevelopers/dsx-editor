import { ChartData } from './chartData.js';
import { Gameplay } from './GameplayEngine/gameplay.js';
import { InputHandler } from './input.js';
import { Timeline } from './timeline.js';
import { CommandManager } from './commandManager.js';
import { AudioAnalyzer } from './audioEngine/audioAnalyzer.js';
import { DebugOverlay } from './UI/debugOverlay.js';
import { soundManager } from './audioEngine/soundManager.js';


export class ChartEditor {
    constructor({ editorCanvasContainer, timelineContainer, sidebarContainer, toolbarContainer }) {
        this.containers = {
            editor: editorCanvasContainer,
            timeline: timelineContainer,
            sidebar: sidebarContainer,
            toolbar: toolbarContainer,
        };

        this.input = new InputHandler();
        this.isRecording = false;
        this.startTime = 0;

        this._chart = {
            meta: {
                title: 'untitled',
                artist: '',
                creator: '',
                difficulty: 1,
                difficultyName: 'NORMAL',
                bpm: { init: 120, min: 120, max: 120 },
                preview: { start: 0, duration: 15000 },
                version: '1.0.0'
            },
            timing: {
                offset: 0,
                bpmChanges: [{ time: 0, bpm: 120 }],
                timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }]
            },
            sections: [],
            notes: [],
            // Markers will be handled as a session-only feature, not part of the chart data.
        };
        this._chartData = new ChartData(this._chart);
        this.commandManager = new CommandManager();
        this.selectedNoteType = 'regular';

        this._settings = {
            bpm: 120,
            offset: 0,
            approachSpeed: 550,
            effectsVolume: 1,
            musicVolume: 0.5,
            snapEnabled: true,
            snapDivision: 4,
            // New visual settings
            useAntialiasing: true,
            appBackgroundColor: 'linear-gradient(180deg, #1D2B49 0%, #0F1628 100%)',
            waveformColor: '#00FF00',
        };

        this.sessionMarkers = []; // Editor-only markers

        this._loadSettings(); // Load settings on initialization
    }

    init() {
        this._loadFonts().then(() => {
            // Initialize soundManager early
            soundManager.init().then(() => {
                console.log('SoundManager initialized.');
                // Apply loaded volume settings to soundManager
                soundManager.setEffectsVolume(this._settings.effectsVolume);
                soundManager.setMusicVolume(this._settings.musicVolume);
            }).catch(e => {
                console.error('Failed to initialize SoundManager:', e);
            });
            this._renderToolbar();
            this._renderSidebarPanels();

            this.approachSpeedInput = this.containers.sidebar.querySelector('#approach-speed-input');

            this.audioPlayer = document.createElement('audio');
            this.audioPlayer.id = 'audio-player';
            this.audioPlayer.volume = this._settings.musicVolume; // Apply saved music volume on creation
            document.body.appendChild(this.audioPlayer);

            this.gameplay = new Gameplay({ parent: this.containers.editor, input: this.input, settings: {} });
            this.approachSpeedInput.value = this.gameplay.approachTime; // Set initial value of approach speed input

            // Create a clock object that is slaved to the editor's audio player
            const editorClock = {
                getCurrentTime: () => this.audioPlayer.currentTime * 1000
            };
            this.gameplay.setClock(editorClock);

            this.timeline = new Timeline({
                chartData: this._chartData,
                parent: this.containers.timeline,
                audioPlayer: this.audioPlayer,
                onMarkerAction: this._onMarkerAction.bind(this),
                onNoteSelected: this._onNoteSelected.bind(this),
                gameplay: this.gameplay,
                selectedNoteType: this.selectedNoteType,
                commandManager: this.commandManager,
                audioBuffer: null
            });

            this._setupEventListeners();
            this._setupRecording();

            window.addEventListener('keydown', this._handleKeyDown.bind(this));
            this.containers.editor.addEventListener('contextmenu', (event) => event.preventDefault());
            this.containers.timeline.addEventListener('contextmenu', (event) => event.preventDefault());
        });

        // Expose a global for the debug overlay to access editor components
        window.__dsx = { editor: this, input: this.input };

        // Initialize the debug overlay
        this.debugOverlay = new DebugOverlay();
        window.onerror = this.debugOverlay.logError;
    }

    _saveSettings() {
        try {
            localStorage.setItem('chartEditorSettings', JSON.stringify(this._settings));
            console.log('Editor settings saved.');
        } catch (e) {
            console.error('Failed to save editor settings:', e);
        }
    }

    _loadSettings() {
        try {
            const savedSettings = localStorage.getItem('chartEditorSettings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                this._settings = { ...this._settings, ...parsedSettings };
                console.log('Editor settings loaded.');
            }
        } catch (e) {
            console.error('Failed to load editor settings, using defaults:', e);
        }
    }

    _loadFonts() {
        const fontFaces = [
            { family: 'ZenMaruGothic', weight: '300', src: 'url(./assets/misc/fonts/ttf/ZenMaruGothic-Light.ttf)' },
            { family: 'ZenMaruGothic', weight: '400', src: 'url(./assets/misc/fonts/ttf/ZenMaruGothic-Regular.ttf)' },
            { family: 'ZenMaruGothic', weight: '500', src: 'url(./assets/misc/fonts/ttf/ZenMaruGothic-Medium.ttf)' },
            { family: 'ZenMaruGothic', weight: '700', src: 'url(./assets/misc/fonts/ttf/ZenMaruGothic-Bold.ttf)' },
            { family: 'ZenMaruGothic', weight: '900', src: 'url(./assets/misc/fonts/ttf/ZenMaruGothic-Black.ttf)' },
        ];

        const fontPromises = fontFaces.map(font => {
            const fontFace = new FontFace(font.family, font.src, { weight: font.weight });
            document.fonts.add(fontFace);
            return fontFace.load();
        });

        return Promise.all(fontPromises)
            .then(() => console.log('Fonts loaded successfully.'))
            .catch(err => console.error('Failed to load fonts:', err));
    }

    _renderToolbar() {
        this.containers.toolbar.innerHTML = `
            <button class="button ghost" id="import-btn">Import</button>
            <button class="button ghost" id="export-btn">Export</button>
            <button class="icon-button toolbar-spacer" id="play-pause-btn" title="Play/Pause (Space)">
                <svg id="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                <svg id="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display: none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
            </button>
            <button class="icon-button" id="record-btn" title="Record (F4)">
                <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"></circle></svg>
            </button>
            <button class="icon-button toolbar-spacer" id="undo-btn" title="Undo (Ctrl+Z)">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"></path></svg>
            </button>
            <button class="icon-button" id="redo-btn" title="Redo (Ctrl+Y)">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"></path></svg>
            </button>
            <button class="icon-button toolbar-spacer" id="zoom-in-btn" title="Zoom In (+)">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>
            </button>
            <button class="icon-button" id="zoom-out-btn" title="Zoom Out (-)">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"></path></svg>
            </button>
            <button class="icon-button" id="help-btn" title="Show Shortcuts (?)">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.07,12.85c0.74,0,1.35-0.25,1.83-0.76c0.48-0.5,0.72-1.12,0.72-1.85c0-0.71-0.24-1.32-0.72-1.82c-0.48-0.5-1.09-0.75-1.83-0.75c-0.75,0-1.36,0.25-1.84,0.75c-0.48,0.5-0.72,1.11-0.72,1.82c0,0.73,0.24,1.35,0.72,1.85C9.71,12.6,10.32,12.85,11.07,12.85z M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10c5.52,0,10-4.48,10-10S17.52,2,12,2z M12,20c-4.41,0-8-3.59-8-8s3.59-8,8-8c4.41,0,8,3.59,8,8S16.41,20,12,20z M12,14.3c-0.55,0-1.02,0.1-1.41,0.31L12,17.2V18h-1v-1.53l-3.59-3.59l0.71-0.71L11,15.05V14.3c-0.01-0.01-0.01-0.01-0.01-0.02c-0.4-0.19-0.74-0.46-1.01-0.81C9.69,13.08,9.5,12.6,9.5,12.03c0-0.93,0.34-1.71,1.01-2.32c0.67-0.62,1.5-0.93,2.49-0.93c0.98,0,1.8,0.31,2.47,0.93c0.67,0.62,1.01,1.39,1.01,2.32c0,0.57-0.19,1.05-0.56,1.44c-0.37,0.39-0.82,0.67-1.34,0.82v0.71h-1V14.3z"></path></svg>
            </button>
            <label for="effects-volume-slider" style="color: white; margin-right: 5px;">SFX:</label>
            <input type="range" id="effects-volume-slider" min="0" max="1" value="${this._settings.effectsVolume}" step="0.01" style="width: 80px; margin-right: 10px;">
            <label for="music-volume-slider" style="color: white; margin-right: 5px;">Music:</label>
            <input type="range" id="music-volume-slider" min="0" max="1" value="${this._settings.musicVolume}" step="0.01" style="width: 80px;">
        `;
    }

    _renderHelpModal() {
        const modal = document.createElement('div');
        modal.id = 'help-modal';
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background-color: rgba(20, 25, 40, 0.95); border: 1px solid #4a5568;
            color: #e2e8f0; padding: 2rem; border-radius: 8px; z-index: 100000;
            display: none; font-family: monospace; max-width: 500px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); backdrop-filter: blur(5px);
        `;

        modal.innerHTML = `
            <h2 style="margin-top: 0; border-bottom: 1px solid #4a5568; padding-bottom: 1rem;">DSX Editor Keyboard Shortcuts</h2>
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 0.5rem 1rem;">
                <strong>Playback:</strong>
                <div>
                    <div><kbd>Space</kbd><span>: Play / Pause</span></div>
                    <div><kbd>Arrow Keys</kbd><span>: Seek by Snap Division</span></div>
                    <div><kbd>Shift</kbd> + <kbd>Arrow Keys</kbd><span>: Seek by Beat</span></div>
                </div>
                <strong>Timeline:</strong>
                <div>
                    <div><kbd>Ctrl</kbd> + <kbd>Scroll</kbd><span>: Zoom Timeline</span></div>
                    <div><kbd>Shift</kbd> + <kbd>Drag Playhead</kbd><span>: Precise Seek</span></div>
                    <div><kbd>M</kbd><span>: Add Marker</span></div>
                    <div><kbd>Right-Click Marker</kbd><span>: Delete Marker</span></div>
                </div>
                <strong>Editing:</strong>
                <div>
                    <div><kbd>Ctrl</kbd> + <kbd>Z</kbd><span>: Undo</span></div>
                    <div><kbd>Ctrl</kbd> + <kbd>Y</kbd><span>: Redo</span></div>
                    <div><kbd>Delete</kbd><span>: Delete Selected Note</span></div>
                    <div><kbd>S</kbd><span>: Toggle Snap to Beat</span></div>
                </div>
                <strong>Volume:</strong>
                <div>
                    <div><kbd>Scroll</kbd><span>: Master Volume</span></div>
                    <div><kbd>Shift</kbd> + <kbd>Scroll</kbd><span>: Music Volume</span></div>
                    <div><kbd>Alt</kbd> + <kbd>Scroll</kbd><span>: Effects Volume</span></div>
                </div>
                <strong>Utility:</strong>
                <div>
                    <div><kbd>\`</kbd><span>: Toggle Debug Overlay</span></div>
                    <div><kbd>Esc</kbd><span>: Close this window</span></div>
                </div>
            </div>
            <style>
                #help-modal kbd { background-color: #4a5568; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
            </style>
        `;
        document.body.appendChild(modal);
        this.helpModal = modal;
    }

    _renderSidebarPanels() {
        this.containers.sidebar.innerHTML = `
            <div class="panel">
                <h3>Editor Settings</h3>
                <label for="bpm-input">BPM:</label>
                <input type="number" id="bpm-input" value="${this._settings.bpm}">
                <label for="offset-input">Offset (ms):</label>
                <input type="number" id="offset-input" value="${this._settings.offset}">
                <label for="approach-speed-input">Approach Speed (ms):</label>
                <input type="number" id="approach-speed-input" value="${this._settings.approachSpeed}">
                <label for="note-approach-speed-slider">Note Approach Speed:</label>
                <input type="range" id="note-approach-speed-slider" min="100" max="5000" value="${this._settings.approachSpeed}" step="50">
                <label for="audio-input">Audio:</label>
                <input type="file" id="audio-input" accept=".mp3, .wav, .ogg">
                <div>
                    <input type="checkbox" id="snap-toggle" ${this._settings.snapEnabled ? 'checked' : ''}>
                    <label for="snap-toggle">Snap to Beat</label>
                </div>
                <label for="snap-division">Snap Division:</label>
                <select id="snap-division">
                    <option value="1" ${this._settings.snapDivision === 1 ? 'selected' : ''}>1/1</option>
                    <option value="2" ${this._settings.snapDivision === 2 ? 'selected' : ''}>1/2</option>
                    <option value="4" ${this._settings.snapDivision === 4 ? 'selected' : ''}>1/4</option>
                    <option value="8" ${this._settings.snapDivision === 8 ? 'selected' : ''}>1/8</option>
                    <option value="16" ${this._settings.snapDivision === 16 ? 'selected' : ''}>1/16</option>
                </select>
                <div style="margin-top: 15px;">
                    <input type="checkbox" id="antialiasing-toggle" ${this._settings.useAntialiasing ? 'checked' : ''}>
                    <label for="antialiasing-toggle">Use Anti-Aliasing (Reload required)</label>
                </div>
                <label for="background-color-input">Background:</label>
                <input type="text" id="background-color-input" value="${this._settings.appBackgroundColor}">
                <label for="waveform-color-input">Waveform Color:</label>
                <input type="color" id="waveform-color-input" value="${this._settings.waveformColor}">

            </div>
            <div class="panel">
                <h3>Looping</h3>
                <label for="loop-start">Loop Start (ms):</label>
                <input type="number" id="loop-start" value="0">
                <label for="loop-end">Loop End (ms):</label>
                <input type="number" id="loop-end" value="0">
                <button class="button ghost" id="toggle-loop-btn">Toggle Loop</button>
            </div>
            <div id="note-palette" class="panel">
                <h3>Note Palette</h3>
                <button class="button primary" id="note-type-regular" data-note-type="regular">Regular</button>
                <button class="button ghost" id="note-type-hold" data-note-type="hold">Hold</button>
                <button class="button ghost" id="note-type-chain" data-note-type="chain">Chain</button>
                <button class="button ghost" id="note-type-multi" data-note-type="multi">Multi</button>
            </div>
            <div id="note-properties-panel" class="panel" style="opacity: 0; display: none; pointer-events: none;">
                <h3>Selected Note</h3>
                <label for="note-time">Time (ms):</label>
                <input type="number" id="note-time">
                <label for="note-zone">Zone:</label>
                <input type="number" id="note-zone" min="0" max="3">
            </div>
        `;
    }

    _setupEventListeners() {
        this.recordBtn = this.containers.toolbar.querySelector('#record-btn');
        this.exportBtn = this.containers.toolbar.querySelector('#export-btn');
        this.importBtn = this.containers.toolbar.querySelector('#import-btn');
        this.zoomInBtn = this.containers.toolbar.querySelector('#zoom-in-btn');
        this.zoomOutBtn = this.containers.toolbar.querySelector('#zoom-out-btn');
        this.undoBtn = this.containers.toolbar.querySelector('#undo-btn');
        this.helpBtn = this.containers.toolbar.querySelector('#help-btn');
        this.redoBtn = this.containers.toolbar.querySelector('#redo-btn');
        this.playPauseBtn = this.containers.toolbar.querySelector('#play-pause-btn');
        this.playIcon = this.containers.toolbar.querySelector('#play-icon');
        this.pauseIcon = this.containers.toolbar.querySelector('#pause-icon');

        this.bpmInput = this.containers.sidebar.querySelector('#bpm-input');
        this.offsetInput = this.containers.sidebar.querySelector('#offset-input');
        this.audioInput = this.containers.sidebar.querySelector('#audio-input');
        this.noteApproachSpeedSlider = this.containers.sidebar.querySelector('#note-approach-speed-slider');
        this.snapToggle = this.containers.sidebar.querySelector('#snap-toggle');
        this.snapDivisionSelect = this.containers.sidebar.querySelector('#snap-division');
        this.loopStartInput = this.containers.sidebar.querySelector('#loop-start');
        this.antialiasingToggle = this.containers.sidebar.querySelector('#antialiasing-toggle');
        this.backgroundColorInput = this.containers.sidebar.querySelector('#background-color-input');
        this.waveformColorInput = this.containers.sidebar.querySelector('#waveform-color-input');
        this.loopEndInput = this.containers.sidebar.querySelector('#loop-end');
        this.toggleLoopBtn = this.containers.sidebar.querySelector('#toggle-loop-btn');
        this.notePropertiesPanel = this.containers.sidebar.querySelector('#note-properties-panel');
        this.noteTimeInput = this.containers.sidebar.querySelector('#note-time');
        this.noteZoneInput = this.containers.sidebar.querySelector('#note-zone');
        this.noteTypeButtons = this.containers.sidebar.querySelectorAll('#note-palette .button');

        this.effectsVolumeSlider = this.containers.toolbar.querySelector('#effects-volume-slider');
        this.musicVolumeSlider = this.containers.toolbar.querySelector('#music-volume-slider');

        const addListener = (el, event, handler) => {
            if (el) {
                el.addEventListener(event, handler);
            } else {
                console.error(`UI element not found for event listener: ${event}`);
            }
        };

        const addBlurListener = (el, event, handler) => {
            if (el) {
                el.addEventListener(event, (e) => {
                    handler(e);
                    // Remove focus from the element after interaction
                    if (e.target && typeof e.target.blur === 'function') {
                        e.target.blur();
                    }
                });
            } else {
                console.error(`UI element not found for event listener: ${event}`);
            }
        };

        // --- Toolbar Buttons ---
        addListener(this.recordBtn, 'click', this._toggleRecording.bind(this));
        addListener(this.exportBtn, 'click', this._exportChart.bind(this));
        addListener(this.importBtn, 'click', this._importChart.bind(this));
        addListener(this.zoomInBtn, 'click', () => this.timeline.setZoom(this.timeline.zoom * 1.2));
        addListener(this.helpBtn, 'click', () => this._toggleHelpModal());
        addListener(this.zoomOutBtn, 'click', () => this.timeline.setZoom(this.timeline.zoom * 0.8));
        addListener(this.undoBtn, 'click', () => {
            this.commandManager.undo();
            this.timeline.update();
            this._onNoteSelected(null);
        });
        addListener(this.redoBtn, 'click', () => {
            this.commandManager.redo();
            this.timeline.update();
            this._onNoteSelected(null);
        });
        addListener(this.playPauseBtn, 'click', this._toggleSimulation.bind(this));

        // --- Sidebar Inputs (with blur on change) ---
        addBlurListener(this.bpmInput, 'change', this._updateBpm.bind(this));
        addBlurListener(this.offsetInput, 'change', this._updateOffset.bind(this));
        addBlurListener(this.approachSpeedInput, 'change', this._updateApproachSpeed.bind(this));
        addBlurListener(this.audioInput, 'change', this._loadAudio.bind(this));
        addBlurListener(this.noteApproachSpeedSlider, 'change', this._updateNoteApproachSpeedFromSlider.bind(this));
        addListener(this.noteApproachSpeedSlider, 'input', this._updateNoteApproachSpeedFromSlider.bind(this)); // For live update
        addBlurListener(this.snapToggle, 'change', (e) => {
            if (this.timeline) this.timeline.snapEnabled = this.snapToggle.checked;
            this._settings.snapEnabled = this.snapToggle.checked;
            this._saveSettings();
        });
        addBlurListener(this.snapDivisionSelect, 'change', (e) => {
            const division = parseInt(this.snapDivisionSelect.value);
            if (this.timeline) this.timeline.snapDivision = division;
            this._settings.snapDivision = division;
            this._saveSettings();
        });
        addBlurListener(this.antialiasingToggle, 'change', (e) => {
            this._settings.useAntialiasing = this.antialiasingToggle.checked;
            this._saveSettings();
            alert('Please reload the editor for the anti-aliasing setting to take effect.');
        });
        addBlurListener(this.backgroundColorInput, 'change', (e) => {
            const color = e.target.value;
            document.body.style.background = color;
            this._settings.appBackgroundColor = color;
            this._saveSettings();
        });
        addBlurListener(this.waveformColorInput, 'change', (e) => {
            this._settings.waveformColor = e.target.value;
            this.timeline.setWaveformColor(this._settings.waveformColor);
            this._saveSettings();
        });
        addBlurListener(this.noteTimeInput, 'change', (e) => this._updateSelectedNoteProperty('time', parseFloat(e.target.value)));
        addBlurListener(this.noteZoneInput, 'change', (e) => this._updateSelectedNoteProperty('zone', parseInt(e.target.value)));
        addBlurListener(this.loopStartInput, 'change', (e) => this.loopStart = parseFloat(e.target.value));
        addBlurListener(this.loopEndInput, 'change', (e) => this.loopEnd = parseFloat(e.target.value));
        addListener(this.toggleLoopBtn, 'click', this._toggleLoop.bind(this));

        // --- Toolbar Volume Sliders (with blur on change) ---
        addBlurListener(this.effectsVolumeSlider, 'change', this._updateEffectsVolume.bind(this));
        addListener(this.effectsVolumeSlider, 'input', this._updateEffectsVolume.bind(this)); // For live update
        addBlurListener(this.musicVolumeSlider, 'change', this._updateMusicVolume.bind(this));
        addListener(this.musicVolumeSlider, 'input', this._updateMusicVolume.bind(this)); // For live update

        // Initialize UI elements with loaded settings
        this.bpmInput.value = this._settings.bpm;
        this.offsetInput.value = this._settings.offset;
        this.approachSpeedInput.value = this._settings.approachSpeed;
        this.noteApproachSpeedSlider.value = this._settings.approachSpeed;
        this.snapToggle.checked = this._settings.snapEnabled;
        this.snapDivisionSelect.value = this._settings.snapDivision;
        this.antialiasingToggle.checked = this._settings.useAntialiasing;
        this.backgroundColorInput.value = this._settings.appBackgroundColor;
        this.waveformColorInput.value = this._settings.waveformColor;
        this.effectsVolumeSlider.value = this._settings.effectsVolume;
        this.musicVolumeSlider.value = this._settings.musicVolume;

        // Apply loaded settings to gameplay and timeline
        this.gameplay.setNoteApproachTime(this._settings.approachSpeed);
        this.timeline.setWaveformColor(this._settings.waveformColor);
        this.timeline.snapEnabled = this._settings.snapEnabled;
        this.timeline.snapDivision = this._settings.snapDivision;
    }

    _handleKeyDown(e) {
        if ([' ', 'Backspace', 'Delete', 'z', 'y', 's', 'l', '+', '-', 'ArrowLeft', 'ArrowRight', 'm', 'Backquote', 'Escape'].includes(e.key) && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
        }

        switch (e.key) {
            case ' ': this._toggleSimulation(); break;
            case 'z': if (e.ctrlKey) { this.commandManager.undo(); this.timeline.update(); this._onNoteSelected(null); } break;
            case 'y': if (e.ctrlKey) { this.commandManager.redo(); this.timeline.update(); this._onNoteSelected(null); } break;
            case 's': this.snapToggle.checked = !this.snapToggle.checked; this.timeline.snapEnabled = this.snapToggle.checked; break;
            case 'l': this._toggleLoop(); break;
            case '+': this.timeline.setZoom(this.timeline.zoom * 1.2); break;
            case '-': this.timeline.setZoom(this.timeline.zoom * 0.8); break;
            case 'ArrowLeft': {
                // Seek by one beat with shift, otherwise by snap division.
                const beatDuration = 60 / this._settings.bpm;
                const seekAmount = e.shiftKey ? beatDuration : beatDuration / this._settings.snapDivision;
                this.audioPlayer.currentTime = Math.max(0, this.audioPlayer.currentTime - seekAmount);
                this.timeline.drawCurrentTimeIndicator(this.audioPlayer.currentTime * 1000);
                this.gameplay.reset();
                break;
            }
            case 'ArrowRight': {
                // Seek by one beat with shift, otherwise by snap division.
                const beatDuration = 60 / this._settings.bpm;
                const seekAmount = e.shiftKey ? beatDuration : beatDuration / this._settings.snapDivision;
                this.audioPlayer.currentTime = Math.min(this.audioPlayer.duration, this.audioPlayer.currentTime + seekAmount);
                this.timeline.drawCurrentTimeIndicator(this.audioPlayer.currentTime * 1000);
                this.gameplay.reset();
                break;
            }
            case 'm':
                const currentTime = this.audioPlayer.currentTime * 1000;
                this.sessionMarkers.push({ time: currentTime, label: `Marker ${this.sessionMarkers.length + 1}` });
                this.timeline.setSessionMarkers(this.sessionMarkers);
                console.log(`Marker added at ${currentTime.toFixed(2)}ms`);
                break;
            case 'Backquote':
                this.debugOverlay.toggle();
                break;
            case 'Escape':
                if (this.helpModal && this.helpModal.style.display !== 'none') {
                    this._toggleHelpModal();
                }
                break;
        }
    }

    _toggleHelpModal() {
        if (!this.helpModal) this._renderHelpModal();

        const isVisible = this.helpModal.style.display !== 'none';
        this.helpModal.style.display = isVisible ? 'none' : 'block';
    }

    _onMarkerAction(action, marker) {
        if (action === 'delete') {
            const index = this.sessionMarkers.indexOf(marker);
            if (index > -1) {
                this.sessionMarkers.splice(index, 1);
                // Refresh the timeline to show the marker has been removed
                this.timeline.setSessionMarkers(this.sessionMarkers);
                console.log(`Marker at ${marker.time.toFixed(2)}ms deleted.`);
            }
        }
    }


    _selectNoteType(type) {
        this.selectedNoteType = type;
        this.timeline.selectedNoteType = type;
        this.noteTypeButtons.forEach(button => {
            if (button.dataset.noteType === type) {
                button.classList.add('primary');
                button.classList.remove('ghost');
            } else {
                button.classList.remove('primary');
                button.classList.add('ghost');
            }
        });
    }

    _updateOffset() {
        const offset = parseFloat(this.offsetInput.value);
        if (!isNaN(offset)) {
            this._chart.timing.offset = offset;
            this._chartData.processTimingData();
            this.timeline.update();
            this._settings.offset = offset;
            this._saveSettings();
        }
    }

    _updateEffectsVolume() {
        const volume = parseFloat(this.effectsVolumeSlider.value);
        if (!isNaN(volume)) {
            soundManager.setEffectsVolume(volume);
            this._settings.effectsVolume = volume;
            this._saveSettings();
        }
    }

    _updateMusicVolume() {
        const volume = parseFloat(this.musicVolumeSlider.value);
        if (!isNaN(volume)) {
            if (this.audioPlayer) {
                this.audioPlayer.volume = volume;
            }
            soundManager.setMusicVolume(volume);
            this._settings.musicVolume = volume;
            this._saveSettings();
        }
    }

    _toggleLoop() {
        this.isLooping = !this.isLooping;
        this.toggleLoopBtn.classList.toggle('primary', this.isLooping);
        this.toggleLoopBtn.classList.toggle('ghost', !this.isLooping);
        if (this.isLooping) {
            if (this.audioPlayer.currentTime * 1000 < this.loopStart || this.audioPlayer.currentTime * 1000 >= this.loopEnd) {
                this.audioPlayer.currentTime = this.loopStart / 1000;
            }
            this.audioPlayer.play();
        }
    }

    _toggleSimulation() {
        if (!this.audioPlayer.src || this.audioPlayer.src === '') {
            alert("Load an audio file first, you dumbass.");
            return;
        }
        this.isSimulating = !this.isSimulating;
        if (this.isSimulating) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
            this.audioPlayer.play().catch(e => {
                console.error("Fucking hell, audio could not play:", e);
                this.isSimulating = false;
                this.playIcon.style.display = 'block';
                this.pauseIcon.style.display = 'none';
            });
            this.gameplay.setChart(this._chartData.raw.notes); // Pass current chart notes to gameplay
            this.gameplay.start(); // Start gameplay simulation
            this._updateTimelineIndicator();
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
            this.audioPlayer.pause();
            this.gameplay.stop(); // Stop gameplay simulation
            cancelAnimationFrame(this.timelineIndicatorRAF);
        }
    }

    _onNoteSelected(note) {
        this.selectedNote = note;
        if (note) {
            if (this.notePropertiesPanel.style.opacity === '1') {
                this.noteTimeInput.value = note.time.toFixed(2);
                this.noteZoneInput.value = note.zone;
                return;
            }
            this.notePropertiesPanel.style.display = 'block';
            this.notePropertiesPanel.style.pointerEvents = 'auto';
            this.noteTimeInput.value = note.time.toFixed(2);
            this.noteZoneInput.value = note.zone;
            anime({ targets: this.notePropertiesPanel, opacity: [0, 1], translateY: ['-10px', '0px'], duration: 300, easing: 'easeOutCubic' });
        } else {
            if (this.notePropertiesPanel.style.opacity === '0') return;
            anime({
                targets: this.notePropertiesPanel,
                opacity: [1, 0],
                translateY: ['0px', '-10px'],
                duration: 300,
                easing: 'easeInCubic',
                complete: () => {
                    this.notePropertiesPanel.style.display = 'none';
                    this.notePropertiesPanel.style.pointerEvents = 'none';
                }
            });
        }
    }

    _updateSelectedNoteProperty(property, value) {
        if (this.selectedNote) {
            this.selectedNote[property] = value;
            this._chartData.raw.notes.sort((a, b) => a.time - b.time);
            this.timeline.update();
        }
    }

    _updateBpm() {
        const bpm = parseFloat(this.bpmInput.value);
        if (!isNaN(bpm)) {
            this._chart.timing.bpmChanges = [{ time: 0, bpm: bpm }];
            this._chart.meta.bpm.init = bpm;
            this._chart.meta.bpm.min = bpm;
            this._chart.meta.bpm.max = bpm;
            this._chartData.processTimingData();
            this.timeline.update();
            this._settings.bpm = bpm;
            this._saveSettings();
        }
    }

    _updateApproachSpeed() {
        const approachSpeed = parseFloat(this.approachSpeedInput.value);
        if (!isNaN(approachSpeed) && this.gameplay) {
            this.gameplay.setNoteApproachTime(approachSpeed);
            if (this.noteApproachSpeedSlider) {
                this.noteApproachSpeedSlider.value = approachSpeed;
            }
            this._settings.approachSpeed = approachSpeed;
            this._saveSettings();
        }
    }

    _updateNoteApproachSpeedFromSlider(event) {
        const approachSpeed = parseFloat(this.noteApproachSpeedSlider.value);
        if (!isNaN(approachSpeed) && this.gameplay) {
            this.gameplay.setNoteApproachTime(approachSpeed);
            this.approachSpeedInput.value = approachSpeed; // Keep the number input in sync
        }
    }

    async _loadAudio() {
        const file = this.audioInput.files[0];
        if (file) {
            this.audioPlayer.src = URL.createObjectURL(file);
            this._chart.meta.title = file.name.replace(/\.[^/.]+$/, "");
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            this.timeline.waveformRenderer.loadAudioBuffer(audioBuffer);
            this.timeline.createGrid();
        }
    }

    _setupRecording() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F4') {
                e.preventDefault();
                this._toggleRecording();
            }
        });
    }

    _toggleRecording() {
        this.isRecording = !this.isRecording;
        if (this.isRecording) {
            this._startCountdown().then(() => this._startRecording());
        } else {
            this._stopRecording();
        }
    }

    _startCountdown() {
        return new Promise(resolve => {
            const countdownElement = this.containers.editor.querySelector('#countdown') || document.createElement('div');
            if (!countdownElement.id) {
                countdownElement.id = 'countdown';
                this.containers.editor.appendChild(countdownElement);
            }
            let count = 3;
            const countdownInterval = setInterval(() => {
                if (count > 0) {
                    countdownElement.textContent = count;
                    countdownElement.style.opacity = 1;
                    setTimeout(() => countdownElement.style.opacity = 0, 800);
                    count--;
                } else {
                    countdownElement.textContent = 'GO!';
                    countdownElement.style.opacity = 1;
                    setTimeout(() => {
                        countdownElement.style.opacity = 0;
                        resolve();
                    }, 1000);
                    clearInterval(countdownInterval);
                }
            }, 1000);
        });
    }

    _startRecording() {
        this.recordBtn.classList.add('primary');
        this._chart.notes = [];
        this.startTime = performance.now();
        this.audioPlayer.currentTime = 0;
        this.audioPlayer.play();
        this.gameplay.start();
        this._recordLoop();
        this._updateTimelineIndicator();
    }

    _stopRecording() {
        this.recordBtn.classList.remove('primary');
        this.audioPlayer.pause();
        this.gameplay.stop();
        cancelAnimationFrame(this.timelineIndicatorRAF);
        this._exportChart();
    }

    _recordLoop() {
        if (!this.isRecording) return;
        const pressedZones = this.input.getPressedZones();
        const currentTime = performance.now() - this.startTime;
        for (const zone of pressedZones) {
            this._chart.notes.push({ time: currentTime, zone });
            this.gameplay.showHit(zone);
            soundManager.play('perfect');
        }
        // Only redraw notes if new ones were added. Avoids constant grid redraw.
        if (pressedZones.length > 0) {
            this.timeline.drawNotes();
        }
        requestAnimationFrame(() => this._recordLoop());
    }

    _updateTimelineIndicator = () => {
        const currentTime = this.audioPlayer.currentTime * 1000;
        this.timeline.drawCurrentTimeIndicator(currentTime);
        this.timelineIndicatorRAF = requestAnimationFrame(this._updateTimelineIndicator);
    }

    _exportChart() {
        const chartData = { ...this._chart, keybinds: this.input.getMappings() };
        const dataStr = "data:text/json;charset=utf-t," + encodeURIComponent(JSON.stringify(chartData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${this._chart.meta.title || 'untitled'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    _importChart() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const importedChart = JSON.parse(event.target.result);
                        if (importedChart.meta && importedChart.timing && importedChart.notes) {
                            this._chart = importedChart;
                            this._chartData = new ChartData(this._chart);
                            this.timeline._chartData = this._chartData;
                            this.timeline.drawNotes();
                            this.timeline.createGrid();
                            this.bpmInput.value = this._chart.meta.bpm.init;
                            this.offsetInput.value = this._chart.timing.offset;
                            this._onNoteSelected(null);
                            console.log("Chart imported successfully!");
                        } else {
                            console.error("Invalid chart format.");
                        }
                    } catch (error) {
                        console.error("Error parsing chart JSON:", error);
                    }
                };
                reader.readAsText(file);
            }
        };
        fileInput.click();
    }
}