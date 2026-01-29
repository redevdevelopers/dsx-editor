import { ChartData } from './chartData.js';
import { Gameplay } from './GameplayEngine/gameplay.js';
import { InputHandler } from './input.js';
import { Timeline } from './timeline.js';
import { CommandManager, AddNoteCommand, AddRecordedNotesCommand } from './commandManager.js';
import { AudioAnalyzer } from './audioEngine/audioAnalyzer.js';
import { DebugOverlay } from './UI/debugOverlay.js';
import { soundManager } from './audioEngine/soundManager.js';
import { AutoMapper } from './autoMapper.js';
import { SelectionManager } from './selectionManager.js';
import { AutoSaveManager } from './autoSave.js';
import { FirstTimeSetup } from './firstTimeSetup.js';
import { ThemeImporter } from './themeImporter.js';

export class ChartEditor {
    constructor({ editorCanvasContainer, timelineContainer, sidebarContainer, toolbarContainer, iconbarContainer }) {
        this.containers = {
            editor: editorCanvasContainer,
            timeline: timelineContainer,
            sidebar: sidebarContainer,
            toolbar: toolbarContainer,
            iconbar: iconbarContainer,
        };

        this.input = new InputHandler();
        this.isRecording = false;
        this.startTime = 0;
        this.metronomeEnabled = false;
        this.metronomeInterval = null;
        this.lastMetronomeBeat = -1;

        this._chart = {
            meta: {
                title: 'untitled',
                artist: '',
                creator: '',
                difficulty: 1,
                difficultyName: 'EASY',
                level: 1,
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
            metronomeVolume: 0.5,
            snapEnabled: true,
            snapDivision: 4,
            // New visual settings
            useAntialiasing: true,
            appBackgroundColor: 'linear-gradient(180deg, #1D2B49 0%, #0F1628 100%)',
            waveformColor: '#00FF00',
            gameplayZoom: 1.0,
            bloomEnabled: false,
            bloomIntensity: 0.0,
            // Note colors
            noteColors: {
                regular: '#FF69B4',  // Pink for single notes
                hold: '#FFD700',     // Gold for hold notes
                chain: '#00CED1',    // Dark Turquoise for chain
                multi: '#FFD700',    // Gold for double notes
                slide: '#9370DB',    // Medium Purple for slide
                flick: '#FF6347'     // Tomato Red for flick
            }
        };

        this.sessionMarkers = []; // Editor-only markers

        this._loadSettings(); // Load settings on initialization

        // Initialize new managers
        this.selectionManager = new SelectionManager();
        this.autoSaveManager = new AutoSaveManager(this);
        this.autoMapper = null; // Will be initialized when audio is loaded
        this.themeImporter = new ThemeImporter(this);

        // FPS tracking
        this.fpsCounter = {
            app: { frames: 0, lastTime: performance.now(), fps: 0 },
            gameplay: { frames: 0, lastTime: performance.now(), fps: 0 }
        };
    }

    init() {
        this._loadFonts().then(() => {
            // Initialize soundManager early
            soundManager.init().then(() => {
                // Apply loaded volume settings to soundManager
                soundManager.setEffectsVolume(this._settings.effectsVolume);
                soundManager.setMusicVolume(this._settings.musicVolume);
            }).catch(e => {
            });
            this._renderToolbar();
            this._renderIconbar();
            this._renderSidebarPanels();

            // Set initial shortcuts visibility based on window size
            this._updateShortcutsVisibility();

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
                onZoomChange: this._updateStatusBar.bind(this), // Update status bar on zoom
                gameplay: this.gameplay,
                selectedNoteType: this.selectedNoteType,
                commandManager: this.commandManager,
                audioBuffer: null,
                selectionManager: this.selectionManager // Pass selection manager to timeline
            });

            this._setupEventListeners();
            this._setupRecording();

            window.addEventListener('keydown', this._handleKeyDown.bind(this));
            window.addEventListener('resize', this._handleResize.bind(this));
            this.containers.editor.addEventListener('contextmenu', (event) => event.preventDefault());
            this.containers.timeline.addEventListener('contextmenu', (event) => event.preventDefault());

            // Start auto-save manager
            this.autoSaveManager.start();
            this.autoSaveManager.setupBeforeUnload();

            // Show first-time setup wizard
            setTimeout(() => {
                const setup = new FirstTimeSetup(this);
                setup.show();
            }, 500);
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
        } catch (e) {
        }
    }

    _loadSettings() {
        try {
            const savedSettings = localStorage.getItem('chartEditorSettings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                this._settings = { ...this._settings, ...parsedSettings };
            }

            // Also load and apply modal settings
            const modalSettings = localStorage.getItem('editorSettings');
            if (modalSettings) {
                const settings = JSON.parse(modalSettings);

                // Apply theme on startup
                if (settings.theme) {
                    setTimeout(() => this._applyTheme(settings.theme), 100);
                }

                // Apply note colors on startup
                if (settings.noteColors) {
                    setTimeout(() => this._applyNoteColorScheme(settings.noteColors), 100);
                }

                // Apply performance mode on startup
                if (settings.performanceMode) {
                    document.body.classList.add('performance-mode');
                    // Optimize PIXI for performance
                    if (window.PIXI) {
                        window.PIXI.settings.RESOLUTION = 1;
                        window.PIXI.settings.ROUND_PIXELS = true;
                    }
                } else {
                    // High quality mode
                    if (window.PIXI) {
                        window.PIXI.settings.RESOLUTION = window.devicePixelRatio || 1;
                        window.PIXI.settings.ROUND_PIXELS = false;
                    }
                }

                // Apply FPS visibility on startup
                if (settings.showFps === false) {
                    setTimeout(() => {
                        const fpsElement = document.getElementById('status-fps');
                        if (fpsElement) {
                            fpsElement.parentElement.style.display = 'none';
                        }
                    }, 100);
                }
            }
        } catch (e) {
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
            .then(() => { });
    }

    _renderToolbar() {
        this.containers.toolbar.innerHTML = `
            <!-- Audio Playback Timer -->
            <div class="toolbar-group">
                <div class="audio-timer">
                    <div class="audio-timer-display" id="audio-timer-display">00h 00m 00s</div>
                    <div class="audio-timer-info" id="audio-timer-info">No audio loaded</div>
                </div>
            </div>

            <!-- Audio Level Meter -->
            <div class="toolbar-group">
                <div class="audio-level-meter-horizontal">
                    <div class="level-meter-row">
                        <span class="level-label">L</span>
                        <div class="level-bar-container">
                            <div class="level-bar-horizontal" id="level-bar-left"></div>
                        </div>
                    </div>
                    <div class="level-meter-row">
                        <span class="level-label">R</span>
                        <div class="level-bar-container">
                            <div class="level-bar-horizontal" id="level-bar-right"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Spacer -->
            <div class="spacer"></div>

            <!-- Transport Controls -->
            <div class="toolbar-group">
                <button class="icon-button" id="play-pause-btn" title="Play/Pause (Space)">
                    <svg id="play-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"></path>
                    </svg>
                    <svg id="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
                    </svg>
                </button>
                <button class="icon-button" id="record-btn" title="Record (F4)">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="6"></circle>
                    </svg>
                </button>
                <button class="icon-button ghost" id="metronome-btn" title="Toggle Metronome (M)">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L8 8h3v12h2V8h3l-4-6z"/>
                        <path d="M6 20h12v2H6z"/>
                    </svg>
                </button>
            </div>

            <!-- Edit Controls -->
            <div class="toolbar-group">
                <button class="icon-button" id="undo-btn" title="Undo (Ctrl+Z)">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"></path>
                    </svg>
                </button>
                <button class="icon-button" id="redo-btn" title="Redo (Ctrl+Y)">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"></path>
                    </svg>
                </button>
            </div>

            <!-- View Controls -->
            <div class="toolbar-group">
                <button class="icon-button" id="zoom-in-btn" title="Zoom In (+)">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
                    </svg>
                </button>
                <button class="icon-button" id="zoom-out-btn" title="Zoom Out (-)">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13H5v-2h14v2z"></path>
                    </svg>
                </button>
            </div>

            <!-- Volume Controls -->
            <div class="toolbar-group">
                <div class="volume-control">
                    <label>SFX</label>
                    <input type="range" id="effects-volume-slider" min="0" max="1" value="${this._settings.effectsVolume}" step="0.01">
                </div>
                <div class="volume-control">
                    <label>Music</label>
                    <input type="range" id="music-volume-slider" min="0" max="1" value="${this._settings.musicVolume}" step="0.01">
                </div>
                <div class="volume-control">
                    <label>Metronome</label>
                    <input type="range" id="metronome-volume-slider" min="0" max="1" value="${this._settings.metronomeVolume}" step="0.01">
                </div>
            </div>

            <!-- Playback Speed -->
            <div class="toolbar-group">
                <div class="volume-control">
                    <label>Speed</label>
                    <select id="playback-speed">
                        <option value="0.25">0.25x</option>
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>1.0x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2.0x</option>
                    </select>
                </div>
            </div>

            <!-- Help -->
            <div class="toolbar-group">
                <button class="icon-button" id="help-btn" title="Keyboard Shortcuts (?)">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"></path>
                    </svg>
                </button>
            </div>
        `;
    }

    _renderIconbar() {
        this.containers.iconbar.innerHTML = `
            <button class="iconbar-button active" id="iconbar-metadata-btn" data-panel="metadata" title="Chart Metadata">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
            </button>
            <button class="iconbar-button" id="iconbar-timing-btn" data-panel="timing" title="Timing & Audio">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/>
                </svg>
            </button>
            <button class="iconbar-button" id="iconbar-editor-btn" data-panel="editor" title="Editor Settings">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                </svg>
            </button>
            <button class="iconbar-button" id="iconbar-colors-btn" data-panel="colors" title="Note Colors">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
            </button>
            <button class="iconbar-button" id="iconbar-stats-btn" data-panel="stats" title="Chart Statistics">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
            </button>
        `;
    }

    _renderHelpModal() {
        const modal = document.createElement('div');
        modal.id = 'help-modal';
        modal.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background-color: rgba(20, 25, 40, 0.95); border: 1px solid #4a5568;
            color: #e2e8f0; padding: 2rem; border-radius: 8px; z-index: 100000;
            display: none; font-family: monospace; max-width: 600px; max-height: 80vh; overflow-y: auto;
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
                    <div><kbd>+</kbd> / <kbd>-</kbd><span>: Zoom In/Out</span></div>
                    <div><kbd>M</kbd><span>: Add Marker</span></div>
                    <div><kbd>Right-Click Marker</kbd><span>: Delete Marker</span></div>
                </div>
                <strong>Editing:</strong>
                <div>
                    <div><kbd>Ctrl</kbd> + <kbd>Z</kbd><span>: Undo</span></div>
                    <div><kbd>Ctrl</kbd> + <kbd>Y</kbd><span>: Redo</span></div>
                    <div><kbd>Ctrl</kbd> + <kbd>C</kbd><span>: Copy Selected Notes</span></div>
                    <div><kbd>Ctrl</kbd> + <kbd>V</kbd><span>: Paste Notes</span></div>
                    <div><kbd>Ctrl</kbd> + <kbd>X</kbd><span>: Cut Selected Notes</span></div>
                    <div><kbd>Ctrl</kbd> + <kbd>D</kbd><span>: Duplicate Selected Notes</span></div>
                    <div><kbd>Ctrl</kbd> + <kbd>A</kbd><span>: Select All Notes</span></div>
                    <div><kbd>Ctrl</kbd> + <kbd>Click</kbd><span>: Multi-Select Notes</span></div>
                    <div><kbd>Shift</kbd> + <kbd>Drag</kbd><span>: Box Select Notes</span></div>
                    <div><kbd>Delete</kbd> / <kbd>Backspace</kbd><span>: Delete Selected</span></div>
                    <div><kbd>S</kbd><span>: Toggle Snap to Beat</span></div>
                </div>
                <strong>Note Types:</strong>
                <div>
                    <div><kbd>1</kbd><span>: Regular Note</span></div>
                    <div><kbd>2</kbd><span>: Hold Note</span></div>
                    <div><kbd>3</kbd><span>: Chain Note</span></div>
                    <div><kbd>4</kbd><span>: Multi Note</span></div>
                    <div><kbd>5</kbd><span>: Slide Note</span></div>
                    <div><kbd>6</kbd><span>: Flick Note</span></div>
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
                    <div><kbd>L</kbd><span>: Toggle Loop</span></div>
                </div>
            </div>
            <style>
                #help-modal kbd { background-color: #4a5568; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
                #help-modal::-webkit-scrollbar { width: 8px; }
                #help-modal::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
                #help-modal::-webkit-scrollbar-thumb { background: #4a5568; border-radius: 4px; }
            </style>
        `;
        document.body.appendChild(modal);
        this.helpModal = modal;
    }

    _updateChartStatistics() {
        const notes = this._chart.notes || [];
        const totalNotes = notes.length;

        // Calculate duration
        const lastNoteTime = notes.length > 0 ? Math.max(...notes.map(n => n.time)) : 0;
        const durationSeconds = lastNoteTime / 1000;
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = Math.floor(durationSeconds % 60);

        // Calculate notes per second
        const nps = durationSeconds > 0 ? (totalNotes / durationSeconds).toFixed(2) : '0.00';

        // Calculate peak density (notes per second in busiest 5-second window)
        let peakDensity = 0;
        if (notes.length > 0) {
            const windowSize = 5000; // 5 seconds in ms
            for (let i = 0; i < lastNoteTime; i += 1000) {
                const notesInWindow = notes.filter(n => n.time >= i && n.time < i + windowSize).length;
                const density = notesInWindow / 5;
                if (density > peakDensity) peakDensity = density;
            }
        }

        // Count note types
        const typeCounts = {
            regular: 0,
            hold: 0,
            chain: 0,
            multi: 0,
            slide: 0,
            flick: 0
        };
        notes.forEach(note => {
            const type = note.type || 'regular';
            if (typeCounts.hasOwnProperty(type)) {
                typeCounts[type]++;
            }
        });

        // Update UI
        const statElements = {
            'stat-total-notes': totalNotes,
            'stat-duration': `${minutes}:${seconds.toString().padStart(2, '0')}`,
            'stat-nps': nps,
            'stat-peak': peakDensity.toFixed(2),
            'stat-regular': typeCounts.regular,
            'stat-hold': typeCounts.hold,
            'stat-chain': typeCounts.chain,
            'stat-multi': typeCounts.multi,
            'stat-slide': typeCounts.slide,
            'stat-flick': typeCounts.flick
        };

        Object.entries(statElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Update status bar
        this._updateStatusBar();
    }

    _updateStatusBar() {
        const notes = this._chart.notes || [];
        const totalNotes = notes.length;
        const lastNoteTime = notes.length > 0 ? Math.max(...notes.map(n => n.time)) : 0;
        const durationSeconds = lastNoteTime / 1000;
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = Math.floor(durationSeconds % 60);

        // Update status bar elements
        const statusNotes = document.getElementById('status-notes');
        const statusDuration = document.getElementById('status-duration');
        const statusBpm = document.getElementById('status-bpm');
        const statusZoom = document.getElementById('status-zoom');
        const statusSnap = document.getElementById('status-snap');
        const statusMessage = document.getElementById('status-message');

        if (statusNotes) statusNotes.textContent = `${totalNotes} note${totalNotes !== 1 ? 's' : ''}`;
        if (statusDuration) statusDuration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        if (statusBpm) statusBpm.textContent = `${this._settings.bpm} BPM`;
        if (statusZoom && this.timeline) {
            const zoomPercent = Math.round(this.timeline.zoom * 100);
            statusZoom.textContent = `${zoomPercent}%`;
        }
        if (statusSnap) {
            const snapText = this._settings.snapEnabled ? `Snap: 1/${this._settings.snapDivision}` : 'Snap: Off';
            statusSnap.textContent = snapText;
        }

        // Update playback time if playing
        if (statusMessage && this.audioPlayer && !this.audioPlayer.paused) {
            const currentTime = this.audioPlayer.currentTime;
            const currentMinutes = Math.floor(currentTime / 60);
            const currentSeconds = Math.floor(currentTime % 60);
            statusMessage.textContent = `Playing: ${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
        } else if (statusMessage && this.audioPlayer && this.audioPlayer.paused && this.audioPlayer.currentTime > 0) {
            const currentTime = this.audioPlayer.currentTime;
            const currentMinutes = Math.floor(currentTime / 60);
            const currentSeconds = Math.floor(currentTime % 60);
            statusMessage.textContent = `Paused: ${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
        } else if (statusMessage) {
            statusMessage.textContent = 'Ready';
        }
    }

    _startRealtimeStatusUpdates() {
        // Update status bar at 30 FPS for smooth playback time display
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
        this.statusUpdateInterval = setInterval(() => {
            this._updateStatusBar();
            this._updateAudioTimer();
            this._updateFPS();
            // Update autosave status every second
            if (this.autoSaveManager) {
                this.autoSaveManager.updateStatusBar();
            }
        }, 33); // ~30 FPS
    }

    _updateFPS() {
        const now = performance.now();
        const statusFps = document.getElementById('status-fps');
        if (!statusFps) return;

        // Update app FPS
        this.fpsCounter.app.frames++;
        const appElapsed = now - this.fpsCounter.app.lastTime;
        if (appElapsed >= 1000) {
            this.fpsCounter.app.fps = Math.round((this.fpsCounter.app.frames * 1000) / appElapsed);
            this.fpsCounter.app.frames = 0;
            this.fpsCounter.app.lastTime = now;
        }

        // Get gameplay FPS from PIXI
        let gameplayFps = 0;
        if (this.gameplay && this.gameplay.app && this.gameplay.app.ticker) {
            gameplayFps = Math.round(this.gameplay.app.ticker.FPS);
        }

        statusFps.textContent = `FPS: ${this.fpsCounter.app.fps} / ${gameplayFps}`;
    }

    _renderSidebarPanels() {
        this.containers.sidebar.innerHTML = `
            <div class="panel-group">
                <div class="panel collapsible">
                    <h3 class="panel-header" data-panel="metadata">
                        <span>Chart Metadata</span>
                        <span class="collapse-icon">▼</span>
                    </h3>
                    <div class="panel-content" id="panel-metadata">
                        <label for="chart-title">Title:</label>
                        <input type="text" id="chart-title" value="${this._chart.meta.title}" placeholder="Song Title">
                        <label for="chart-artist">Artist:</label>
                        <input type="text" id="chart-artist" value="${this._chart.meta.artist}" placeholder="Artist Name">
                        <label for="chart-creator">Charter:</label>
                        <input type="text" id="chart-creator" value="${this._chart.meta.creator}" placeholder="Your Name">
                        <div class="input-row">
                            <div class="input-col">
                                <label for="chart-difficulty">Difficulty:</label>
                                <select id="chart-difficulty">
                                    <option value="1" ${this._chart.meta.difficulty === 1 ? 'selected' : ''}>EASY</option>
                                    <option value="2" ${this._chart.meta.difficulty === 2 ? 'selected' : ''}>NORMAL</option>
                                    <option value="3" ${this._chart.meta.difficulty === 3 ? 'selected' : ''}>HARD</option>
                                    <option value="4" ${this._chart.meta.difficulty === 4 ? 'selected' : ''}>EXPERT</option>
                                    <option value="5" ${this._chart.meta.difficulty === 5 ? 'selected' : ''}>MASTER</option>
                                </select>
                            </div>
                            <div class="input-col">
                                <label for="chart-level">Level:</label>
                                <input type="number" id="chart-level" min="1" max="15" value="${this._chart.meta.level || 1}">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="panel collapsible">
                    <h3 class="panel-header" data-panel="timing">
                        <span>Timing & Audio</span>
                        <span class="collapse-icon">▼</span>
                    </h3>
                    <div class="panel-content" id="panel-timing">
                        <div class="input-row">
                            <div class="input-col">
                                <label for="bpm-input">BPM:</label>
                                <input type="number" id="bpm-input" value="${this._settings.bpm}">
                            </div>
                            <div class="input-col">
                                <label for="offset-input">Offset (ms):</label>
                                <input type="number" id="offset-input" value="${this._settings.offset}">
                            </div>
                        </div>
                        <label for="audio-input">Audio File:</label>
                        <input type="file" id="audio-input" accept=".mp3, .wav, .ogg">
                    </div>
                </div>

                <div class="panel collapsible">
                    <h3 class="panel-header" data-panel="editor">
                        <span>Editor Settings</span>
                        <span class="collapse-icon">▼</span>
                    </h3>
                    <div class="panel-content" id="panel-editor">
                        <label for="approach-speed-input">Approach Speed:</label>
                        <input type="range" id="note-approach-speed-slider" min="100" max="5000" value="${this._settings.approachSpeed}" step="50">
                        <input type="number" id="approach-speed-input" value="${this._settings.approachSpeed}" style="margin-top: 5px;">
                        <div class="checkbox-group">
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
                    </div>
                </div>

                <div class="panel collapsible collapsed">
                    <h3 class="panel-header" data-panel="visual">
                        <span>Visual Settings</span>
                        <span class="collapse-icon">▶</span>
                    </h3>
                    <div class="panel-content" id="panel-visual" style="display: none;">
                        <label for="gameplay-zoom-slider">Gameplay Zoom: <span id="gameplay-zoom-value">1.0x</span></label>
                        <input type="range" id="gameplay-zoom-slider" min="0.5" max="2" value="1" step="0.1">
                        <label for="waveform-color-input">Waveform Color:</label>
                        <input type="color" id="waveform-color-input" value="${this._settings.waveformColor}">
                    </div>
                </div>

                <div class="panel collapsible collapsed">
                    <h3 class="panel-header" data-panel="colors">
                        <span>Note Colors</span>
                        <span class="collapse-icon">▶</span>
                    </h3>
                    <div class="panel-content" id="panel-colors" style="display: none;">
                        <div class="color-grid">
                            <label for="regular-note-color">Regular:</label>
                            <input type="color" id="regular-note-color" value="#FF69B4">
                            <label for="hold-note-color">Hold:</label>
                            <input type="color" id="hold-note-color" value="#FFD700">
                            <label for="chain-note-color">Chain:</label>
                            <input type="color" id="chain-note-color" value="#00CED1">
                            <label for="multi-note-color">Multi:</label>
                            <input type="color" id="multi-note-color" value="#FFD700">
                            <label for="slide-note-color">Slide:</label>
                            <input type="color" id="slide-note-color" value="#9370DB">
                            <label for="flick-note-color">Flick:</label>
                            <input type="color" id="flick-note-color" value="#FF6347">
                        </div>
                    </div>
                </div>

                <div class="panel collapsible">
                    <h3 class="panel-header" data-panel="stats">
                        <span>Chart Statistics</span>
                        <span class="collapse-icon">▼</span>
                    </h3>
                    <div class="panel-content" id="panel-stats">
                        <div id="chart-stats">
                            <div class="stat-row"><span>Total Notes:</span> <strong id="stat-total-notes">0</strong></div>
                            <div class="stat-row"><span>Duration:</span> <strong id="stat-duration">0:00</strong></div>
                            <div class="stat-row"><span>Notes/Sec:</span> <strong id="stat-nps">0.00</strong></div>
                            <div class="stat-row"><span>Peak Density:</span> <strong id="stat-peak">0.00</strong></div>
                            <div class="stat-divider"></div>
                            <div class="stat-row"><span>Regular:</span> <strong id="stat-regular">0</strong></div>
                            <div class="stat-row"><span>Hold:</span> <strong id="stat-hold">0</strong></div>
                            <div class="stat-row"><span>Chain:</span> <strong id="stat-chain">0</strong></div>
                            <div class="stat-row"><span>Multi:</span> <strong id="stat-multi">0</strong></div>
                            <div class="stat-row"><span>Slide:</span> <strong id="stat-slide">0</strong></div>
                            <div class="stat-row"><span>Flick:</span> <strong id="stat-flick">0</strong></div>
                        </div>
                    </div>
                </div>

                <div class="panel collapsible collapsed">
                    <h3 class="panel-header" data-panel="ai-training">
                        <span>AI Training</span>
                        <span class="collapse-icon">▶</span>
                    </h3>
                    <div class="panel-content" id="panel-ai-training" style="display: none;">
                        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">
                            Train the AI to learn your charting style and maimai patterns.
                        </p>
                        <button class="button primary" id="train-current-chart-btn" style="width: 100%; margin-bottom: 8px;">
                            Train from Current Chart
                        </button>
                        <button class="button" id="train-multiple-charts-btn" style="width: 100%; margin-bottom: 8px;">
                            Train from Multiple Charts
                        </button>
                        <button class="button" id="train-other-format-btn" style="width: 100%; margin-bottom: 8px;">
                            Train from Other Game Format
                        </button>
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            <button class="button ghost" id="export-model-btn" style="flex: 1;">
                                Export Model
                            </button>
                            <button class="button ghost" id="import-model-btn" style="flex: 1;">
                                Import Model
                            </button>
                        </div>
                        <button class="button ghost" id="clear-trained-model-btn" style="width: 100%;">
                            Clear Trained Model
                        </button>
                        <div id="training-status" style="margin-top: 10px; font-size: 12px; color: #64748b;">
                            No trained model
                        </div>
                    </div>
                </div>

                <div class="panel">
                    <h3>Note Palette</h3>
                    <div class="note-palette-grid">
                        <button class="button primary note-btn" id="note-type-regular" data-note-type="regular">
                            <span class="note-key">1</span> Regular
                        </button>
                        <button class="button ghost note-btn" id="note-type-hold" data-note-type="hold">
                            <span class="note-key">2</span> Hold
                        </button>
                        <button class="button ghost note-btn" id="note-type-chain" data-note-type="chain">
                            <span class="note-key">3</span> Chain
                        </button>
                        <button class="button ghost note-btn" id="note-type-multi" data-note-type="multi">
                            <span class="note-key">4</span> Multi
                        </button>
                        <button class="button ghost note-btn" id="note-type-slide" data-note-type="slide">
                            <span class="note-key">5</span> Slide
                        </button>
                        <button class="button ghost note-btn" id="note-type-flick" data-note-type="flick">
                            <span class="note-key">6</span> Flick
                        </button>
                    </div>
                </div>

                <div id="note-properties-panel" class="panel" style="opacity: 0; display: none; pointer-events: none;">
                    <h3>Selected Note</h3>
                    <div class="input-row">
                        <div class="input-col">
                            <label for="note-time">Time (ms):</label>
                            <input type="number" id="note-time">
                        </div>
                        <div class="input-col">
                            <label for="note-zone">Zone:</label>
                            <input type="number" id="note-zone" min="0" max="3">
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add collapse/expand functionality
        this._setupPanelCollapse();
    }

    _setupPanelCollapse() {
        const headers = this.containers.sidebar.querySelectorAll('.panel-header');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const panelId = header.dataset.panel;
                const content = document.getElementById(`panel-${panelId}`);
                const panel = header.parentElement;
                const icon = header.querySelector('.collapse-icon');

                if (panel.classList.contains('collapsed')) {
                    panel.classList.remove('collapsed');
                    content.style.display = 'block';
                    icon.textContent = '▼';
                } else {
                    panel.classList.add('collapsed');
                    content.style.display = 'none';
                    icon.textContent = '▶';
                }
            });
        });
    }

    _scrollToPanel(panelId) {
        const panel = this.containers.sidebar.querySelector(`[data-panel="${panelId}"]`).parentElement;
        const content = document.getElementById(`panel-${panelId}`);
        const icon = panel.querySelector('.collapse-icon');

        // Expand the panel if collapsed
        if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            content.style.display = 'block';
            icon.textContent = '▼';
        }

        // Scroll to the panel
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Update iconbar active state
        this._updateIconbarActiveState(panelId);
    }

    _updateIconbarActiveState(activePanelId) {
        const iconbarButtons = this.containers.iconbar.querySelectorAll('.iconbar-button');
        iconbarButtons.forEach(btn => {
            if (btn.dataset.panel === activePanelId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    _setupEventListeners() {
        // Header buttons
        const headerImportBtn = document.getElementById('header-import-btn');
        const headerExportBtn = document.getElementById('header-export-btn');
        const headerAutomapBtn = document.getElementById('header-automap-btn');

        this.recordBtn = this.containers.toolbar.querySelector('#record-btn');
        this.exportBtn = headerExportBtn;
        this.importBtn = headerImportBtn;
        this.automapBtn = headerAutomapBtn;
        this.zoomInBtn = this.containers.toolbar.querySelector('#zoom-in-btn');
        this.zoomOutBtn = this.containers.toolbar.querySelector('#zoom-out-btn');
        this.undoBtn = this.containers.toolbar.querySelector('#undo-btn');
        this.helpBtn = this.containers.toolbar.querySelector('#help-btn');
        this.metronomeBtn = this.containers.toolbar.querySelector('#metronome-btn');
        this.iconbarMetadataBtn = this.containers.iconbar.querySelector('#iconbar-metadata-btn');
        this.iconbarTimingBtn = this.containers.iconbar.querySelector('#iconbar-timing-btn');
        this.iconbarEditorBtn = this.containers.iconbar.querySelector('#iconbar-editor-btn');
        this.iconbarColorsBtn = this.containers.iconbar.querySelector('#iconbar-colors-btn');
        this.iconbarStatsBtn = this.containers.iconbar.querySelector('#iconbar-stats-btn');
        this.redoBtn = this.containers.toolbar.querySelector('#redo-btn');
        this.playPauseBtn = this.containers.toolbar.querySelector('#play-pause-btn');
        this.playIcon = this.containers.toolbar.querySelector('#play-icon');
        this.pauseIcon = this.containers.toolbar.querySelector('#pause-icon');

        // Metadata inputs
        this.chartTitleInput = this.containers.sidebar.querySelector('#chart-title');
        this.chartArtistInput = this.containers.sidebar.querySelector('#chart-artist');
        this.chartCreatorInput = this.containers.sidebar.querySelector('#chart-creator');
        this.chartDifficultySelect = this.containers.sidebar.querySelector('#chart-difficulty');
        this.chartLevelInput = this.containers.sidebar.querySelector('#chart-level');

        this.bpmInput = this.containers.sidebar.querySelector('#bpm-input');
        this.offsetInput = this.containers.sidebar.querySelector('#offset-input');
        this.audioInput = this.containers.sidebar.querySelector('#audio-input');
        this.noteApproachSpeedSlider = this.containers.sidebar.querySelector('#note-approach-speed-slider');
        this.snapToggle = this.containers.sidebar.querySelector('#snap-toggle');
        this.snapDivisionSelect = this.containers.sidebar.querySelector('#snap-division');
        this.waveformColorInput = this.containers.sidebar.querySelector('#waveform-color-input');
        this.gameplayZoomSlider = this.containers.sidebar.querySelector('#gameplay-zoom-slider');
        this.gameplayZoomValue = this.containers.sidebar.querySelector('#gameplay-zoom-value');
        this.playbackSpeedSelect = this.containers.toolbar.querySelector('#playback-speed');
        this.regularNoteColorInput = this.containers.sidebar.querySelector('#regular-note-color');
        this.holdNoteColorInput = this.containers.sidebar.querySelector('#hold-note-color');
        this.chainNoteColorInput = this.containers.sidebar.querySelector('#chain-note-color');
        this.multiNoteColorInput = this.containers.sidebar.querySelector('#multi-note-color');
        this.slideNoteColorInput = this.containers.sidebar.querySelector('#slide-note-color');
        this.flickNoteColorInput = this.containers.sidebar.querySelector('#flick-note-color');
        this.notePropertiesPanel = this.containers.sidebar.querySelector('#note-properties-panel');
        this.noteTimeInput = this.containers.sidebar.querySelector('#note-time');
        this.noteZoneInput = this.containers.sidebar.querySelector('#note-zone');
        this.noteTypeButtons = this.containers.sidebar.querySelectorAll('.note-palette-grid .button');

        this.effectsVolumeSlider = this.containers.toolbar.querySelector('#effects-volume-slider');
        this.musicVolumeSlider = this.containers.toolbar.querySelector('#music-volume-slider');
        this.metronomeVolumeSlider = this.containers.toolbar.querySelector('#metronome-volume-slider');

        const addListener = (el, event, handler) => {
            if (el) {
                el.addEventListener(event, handler);
            } else {
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
            }
        };

        // --- Iconbar Buttons ---
        addListener(this.iconbarMetadataBtn, 'click', () => this._scrollToPanel('metadata'));
        addListener(this.iconbarTimingBtn, 'click', () => this._scrollToPanel('timing'));
        addListener(this.iconbarEditorBtn, 'click', () => this._scrollToPanel('editor'));
        addListener(this.iconbarColorsBtn, 'click', () => this._scrollToPanel('colors'));
        addListener(this.iconbarStatsBtn, 'click', () => this._scrollToPanel('stats'));

        // --- Status Bar Settings Button ---
        const statusSettingsBtn = document.getElementById('status-settings-btn');
        if (statusSettingsBtn) {
            addListener(statusSettingsBtn, 'click', () => {
                this._showSettingsModal();
            });
        } else {
        }

        // --- Toolbar Buttons ---
        addListener(this.recordBtn, 'click', this._toggleRecording.bind(this));
        addListener(this.exportBtn, 'click', this._exportChart.bind(this));
        addListener(this.importBtn, 'click', this._importChart.bind(this));
        addListener(this.automapBtn, 'click', this._showAutomapDialog.bind(this));
        addListener(this.metronomeBtn, 'click', this._toggleMetronome.bind(this));
        addListener(this.zoomInBtn, 'click', () => {
            this.timeline.smoothZoom(this.timeline.zoom * 1.5);
            this._updateStatusBar();
        });
        addListener(this.helpBtn, 'click', () => this._toggleHelpModal());
        addListener(this.zoomOutBtn, 'click', () => {
            this.timeline.smoothZoom(this.timeline.zoom * 0.67);
            this._updateStatusBar();
        });
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

        // --- Metadata Inputs ---
        addBlurListener(this.chartTitleInput, 'change', (e) => {
            this._chart.meta.title = e.target.value;
            this.autoSaveManager.markUnsaved();
        });
        addBlurListener(this.chartArtistInput, 'change', (e) => {
            this._chart.meta.artist = e.target.value;
            this.autoSaveManager.markUnsaved();
        });
        addBlurListener(this.chartCreatorInput, 'change', (e) => {
            this._chart.meta.creator = e.target.value;
            this.autoSaveManager.markUnsaved();
        });
        addBlurListener(this.chartDifficultySelect, 'change', (e) => {
            this._chart.meta.difficulty = parseInt(e.target.value);
            const diffNames = ['', 'EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'];
            this._chart.meta.difficultyName = diffNames[this._chart.meta.difficulty];
            this.autoSaveManager.markUnsaved();
        });
        addBlurListener(this.chartLevelInput, 'change', (e) => {
            this._chart.meta.level = parseInt(e.target.value);
            this.autoSaveManager.markUnsaved();
        });

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
            this._updateStatusBar(); // Update status bar to show snap state
        });
        addBlurListener(this.snapDivisionSelect, 'change', (e) => {
            const division = parseInt(this.snapDivisionSelect.value);
            if (this.timeline) this.timeline.snapDivision = division;
            this._settings.snapDivision = division;
            this._saveSettings();
        });
        addBlurListener(this.waveformColorInput, 'change', (e) => {
            this._settings.waveformColor = e.target.value;
            this.timeline.setWaveformColor(this._settings.waveformColor);
            this._saveSettings();
        });
        addListener(this.gameplayZoomSlider, 'input', (e) => {
            const zoom = parseFloat(e.target.value);
            this._settings.gameplayZoom = zoom;
            this.gameplayZoomValue.textContent = `${zoom.toFixed(1)}x`;
            if (this.gameplay) {
                this.gameplay.setZoom(zoom);
            }
            this._saveSettings();
        });
        addBlurListener(this.playbackSpeedSelect, 'change', (e) => {
            const speed = parseFloat(e.target.value);
            if (this.audioPlayer) {
                this.audioPlayer.playbackRate = speed;
            }
            this._showToast(`Playback speed: ${speed}x`);
        });
        // Note color inputs
        const noteColorInputs = [
            { input: this.regularNoteColorInput, type: 'regular' },
            { input: this.holdNoteColorInput, type: 'hold' },
            { input: this.chainNoteColorInput, type: 'chain' },
            { input: this.multiNoteColorInput, type: 'multi' },
            { input: this.slideNoteColorInput, type: 'slide' },
            { input: this.flickNoteColorInput, type: 'flick' }
        ];
        noteColorInputs.forEach(({ input, type }) => {
            addBlurListener(input, 'change', (e) => {
                this._settings.noteColors[type] = e.target.value;
                if (this.gameplay) {
                    this.gameplay.setNoteColor(type, e.target.value);
                }
                this._saveSettings();
            });
        });
        addBlurListener(this.noteTimeInput, 'change', (e) => this._updateSelectedNoteProperty('time', parseFloat(e.target.value)));
        addBlurListener(this.noteZoneInput, 'change', (e) => this._updateSelectedNoteProperty('zone', parseInt(e.target.value)));

        // --- Note Palette Buttons ---
        this.noteTypeButtons.forEach(button => {
            addListener(button, 'click', () => {
                const noteType = button.dataset.noteType;
                this._setSelectedNoteType(noteType);
            });
        });

        // --- AI Training Buttons ---
        const trainCurrentChartBtn = this.containers.sidebar.querySelector('#train-current-chart-btn');
        const trainMultipleChartsBtn = this.containers.sidebar.querySelector('#train-multiple-charts-btn');
        const trainOtherFormatBtn = this.containers.sidebar.querySelector('#train-other-format-btn');
        const exportModelBtn = this.containers.sidebar.querySelector('#export-model-btn');
        const importModelBtn = this.containers.sidebar.querySelector('#import-model-btn');
        const clearTrainedModelBtn = this.containers.sidebar.querySelector('#clear-trained-model-btn');

        addListener(trainCurrentChartBtn, 'click', async () => {
            await this._trainAIFromCurrentChart();
        });
        addListener(trainMultipleChartsBtn, 'click', () => {
            this._trainAIFromMultipleCharts();
        });
        addListener(trainOtherFormatBtn, 'click', () => {
            this._trainAIFromOtherFormat();
        });
        addListener(exportModelBtn, 'click', () => {
            this._exportAIModel();
        });
        addListener(importModelBtn, 'click', () => {
            this._importAIModel();
        });
        addListener(clearTrainedModelBtn, 'click', () => {
            this._clearTrainedModel();
            this._updateTrainingStatus();
        });

        // Try to load trained model on startup (will initialize AutoMapper if needed)
        setTimeout(async () => {
            if (!this.autoMapper) {
                // Initialize AutoMapper
                const dummyContext = new (window.AudioContext || window.webkitAudioContext)();
                const dummyBuffer = dummyContext.createBuffer(1, dummyContext.sampleRate, dummyContext.sampleRate);
                this.autoMapper = new AutoMapper(dummyBuffer, dummyContext);
            }

            // Try to load model (checks localStorage and IndexedDB)
            const loaded = await this.autoMapper.loadTrainedModel();
            if (loaded) {
            } else {
            }

            this._updateTrainingStatus();
        }, 100);

        // --- Editor Canvas Click for Note Placement ---
        addListener(this.containers.editor, 'click', this._handleEditorClick.bind(this));

        // --- Toolbar Volume Sliders (with blur on change) ---
        addBlurListener(this.effectsVolumeSlider, 'change', this._updateEffectsVolume.bind(this));
        addListener(this.effectsVolumeSlider, 'input', this._updateEffectsVolume.bind(this)); // For live update
        addBlurListener(this.musicVolumeSlider, 'change', this._updateMusicVolume.bind(this));
        addListener(this.musicVolumeSlider, 'input', this._updateMusicVolume.bind(this)); // For live update
        addBlurListener(this.metronomeVolumeSlider, 'change', this._updateMetronomeVolume.bind(this));
        addListener(this.metronomeVolumeSlider, 'input', this._updateMetronomeVolume.bind(this)); // For live update

        // Initialize UI elements with loaded settings
        this.bpmInput.value = this._settings.bpm;
        this.offsetInput.value = this._settings.offset;
        this.approachSpeedInput.value = this._settings.approachSpeed;
        this.noteApproachSpeedSlider.value = this._settings.approachSpeed;
        this.snapToggle.checked = this._settings.snapEnabled;
        this.snapDivisionSelect.value = this._settings.snapDivision;
        this.waveformColorInput.value = this._settings.waveformColor;
        this.gameplayZoomSlider.value = this._settings.gameplayZoom;
        this.gameplayZoomValue.textContent = `${this._settings.gameplayZoom.toFixed(1)}x`;
        this.regularNoteColorInput.value = this._settings.noteColors.regular;
        this.holdNoteColorInput.value = this._settings.noteColors.hold;
        this.chainNoteColorInput.value = this._settings.noteColors.chain;
        this.multiNoteColorInput.value = this._settings.noteColors.multi;
        this.slideNoteColorInput.value = this._settings.noteColors.slide;
        this.flickNoteColorInput.value = this._settings.noteColors.flick;
        this.effectsVolumeSlider.value = this._settings.effectsVolume;
        this.musicVolumeSlider.value = this._settings.musicVolume;
        this.metronomeVolumeSlider.value = this._settings.metronomeVolume;

        // Apply loaded settings to gameplay and timeline
        this.gameplay.setNoteApproachTime(this._settings.approachSpeed);
        this.gameplay.setZoom(this._settings.gameplayZoom);
        this.gameplay.setNoteColors(this._settings.noteColors);
        this.timeline.setWaveformColor(this._settings.waveformColor);
        this.timeline.snapEnabled = this._settings.snapEnabled;
        this.timeline.snapDivision = this._settings.snapDivision;

        // Update chart statistics periodically
        setInterval(() => this._updateChartStatistics(), 1000);

        // Start real-time status bar updates
        this._startRealtimeStatusUpdates();
    }

    _handleEditorClick(event) {
        event.preventDefault();

        // Prevent note placement via click if recording is active
        if (this.isRecording) {
            return;
        }

        // Ensure a song is loaded before allowing note placement
        if (!this.audioPlayer.src || this.audioPlayer.src === '') {
            this._showToast('Please load an audio file first');
            return;
        }

        const editorRect = this.containers.editor.getBoundingClientRect();
        const clickX = event.clientX - editorRect.left;
        const clickY = event.clientY - editorRect.top;

        // Calculate time based on timeline's current view and zoom
        // Assuming timeline has properties like `viewStartTime` and `pixelsPerMillisecond`
        // which define the current visible time range and scale.
        const clickedTime = (this.timeline.offset + clickX) / this.timeline.zoom;

        // Snap the time to the nearest beat division
        const snappedTime = this._chartData.getSnappedTime(clickedTime, this._settings.bpm, this._settings.snapDivision);

        // Calculate zone based on Y position (assuming 4 zones, 0-3 from top to bottom)
        const zoneHeight = editorRect.height / 4;
        let zone = Math.floor(clickY / zoneHeight);
        zone = Math.max(0, Math.min(3, zone)); // Ensure zone is between 0 and 3

        const newNote = {
            time: snappedTime,
            zone: zone,
            type: this.selectedNoteType // Use the currently selected note type
        };

        // Add the note to the chart data
        this._chart.notes.push(newNote);
        this._chart.notes.sort((a, b) => a.time - b.time); // Keep notes sorted by time

        // Update the timeline to render the new note
        this.timeline.update();
        soundManager.play('button'); // Provide feedback that a note was placed
    }

    _handleResize() {
        // Debounce resize events to avoid excessive updates
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            // Resize gameplay canvas
            if (this.gameplay && this.gameplay.app) {
                const editorRect = this.containers.editor.getBoundingClientRect();
                this.gameplay.app.renderer.resize(editorRect.width, editorRect.height);

                // Completely recreate the hex grid to ensure proper positioning
                if (this.gameplay.hexGroup) {
                    // Clear existing hex grid
                    this.gameplay.hexGroup.removeChildren();
                }
                if (this.gameplay.glowLayer) {
                    // Clear existing glows and blooms
                    this.gameplay.glowLayer.removeChildren();
                }
                if (this.gameplay.uiLayer) {
                    // Clear existing UI elements
                    this.gameplay.uiLayer.removeChildren();
                }
                if (this.gameplay.bgLayer) {
                    // Clear and recreate background
                    this.gameplay.bgLayer.removeChildren();
                    this.gameplay._createParallaxBackground();
                }

                // Recreate the hex grid with new dimensions
                this.gameplay._createHexGrid();
            }

            // Resize timeline canvas
            if (this.timeline && this.timeline.app) {
                const timelineRect = this.containers.timeline.getBoundingClientRect();
                this.timeline.app.renderer.resize(timelineRect.width, timelineRect.height);

                // Redraw timeline content
                this.timeline.createGrid();
                this.timeline.drawNotes();
                this.timeline.drawMarkers();
                this.timeline.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);
                this.timeline.updateScrollbar();
            }

            // Handle keyboard shortcuts visibility based on window width
            this._updateShortcutsVisibility();

            this.resizeTimeout = null;
        }, 150); // 150ms debounce
    }

    _updateShortcutsVisibility() {
        const shortcuts = document.querySelector('.status-shortcuts');
        if (!shortcuts) return;

        const windowWidth = window.innerWidth;
        const threshold = 1200; // Hide shortcuts below this width

        if (windowWidth < threshold) {
            shortcuts.classList.add('hidden');
        } else {
            shortcuts.classList.remove('hidden');
        }
    }

    _handleKeyDown(e) {
        // Prevent default for editor shortcuts when not in input fields
        if ([' ', 'Backspace', 'Delete', 'z', 'y', 's', 'l', '+', '-', 'ArrowLeft', 'ArrowRight', 'm', 'M', 'Backquote', 'Escape', '1', '2', '3', '4', '5', '6', 'c', 'v', 'x', 'd', 'a'].includes(e.key) && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
        }

        // Handle Ctrl key combinations
        if (e.ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 'z':
                    this.commandManager.undo();
                    this.timeline.update();
                    this._onNoteSelected(null);
                    return;
                case 'y':
                    this.commandManager.redo();
                    this.timeline.update();
                    this._onNoteSelected(null);
                    return;
                case 'c':
                    this._copySelectedNotes();
                    return;
                case 'v':
                    this._pasteNotes();
                    return;
                case 'x':
                    this._cutSelectedNotes();
                    return;
                case 'd':
                    this._duplicateSelectedNotes();
                    return;
                case 'a':
                    this._selectAllNotes();
                    return;
            }
        }

        // Handle regular keys
        switch (e.key) {
            case ' ':
                this._toggleSimulation();
                break;
            case 's':
                if (!e.ctrlKey) {
                    this.snapToggle.checked = !this.snapToggle.checked;
                    this.timeline.snapEnabled = this.snapToggle.checked;
                    this._settings.snapEnabled = this.snapToggle.checked;
                    this._saveSettings();
                    this._updateStatusBar(); // Update status bar to show snap state
                }
                break;
            case 'l':
                this._toggleLoop();
                break;
            case 'M':
                this._toggleMetronome();
                break;
            case '+':
                this.timeline.smoothZoom(this.timeline.zoom * 1.5);
                break;
            case '-':
                this.timeline.smoothZoom(this.timeline.zoom * 0.67);
                break;
            case 'ArrowLeft': {
                const beatDuration = 60 / this._settings.bpm;
                const seekAmount = e.shiftKey ? beatDuration : beatDuration / this._settings.snapDivision;
                this.audioPlayer.currentTime = Math.max(0, this.audioPlayer.currentTime - seekAmount);
                this.timeline.drawCurrentTimeIndicator(this.audioPlayer.currentTime * 1000);

                // Preview notes at new position if paused
                if (this.audioPlayer.paused) {
                    this.gameplay.previewAtTime(this.audioPlayer.currentTime * 1000);
                } else {
                    this.gameplay.reset();
                }
                break;
            }
            case 'ArrowRight': {
                const beatDuration = 60 / this._settings.bpm;
                const seekAmount = e.shiftKey ? beatDuration : beatDuration / this._settings.snapDivision;
                this.audioPlayer.currentTime = Math.min(this.audioPlayer.duration, this.audioPlayer.currentTime + seekAmount);
                this.timeline.drawCurrentTimeIndicator(this.audioPlayer.currentTime * 1000);

                // Preview notes at new position if paused
                if (this.audioPlayer.paused) {
                    this.gameplay.previewAtTime(this.audioPlayer.currentTime * 1000);
                } else {
                    this.gameplay.reset();
                }
                break;
            }
            case 'm':
                const currentTime = this.audioPlayer.currentTime * 1000;
                this.sessionMarkers.push({ time: currentTime, label: `Marker ${this.sessionMarkers.length + 1}` });
                this.timeline.setSessionMarkers(this.sessionMarkers);
                break;
            case 'Backquote':
                this.debugOverlay.toggle();
                break;
            case 'Escape':
                if (this.helpModal && this.helpModal.style.display !== 'none') {
                    this._toggleHelpModal();
                }
                break;
            case 'Delete':
            case 'Backspace':
                this._deleteSelectedNotes();
                break;
            // Note type shortcuts
            case '1':
                this._selectNoteType('regular');
                break;
            case '2':
                this._selectNoteType('hold');
                break;
            case '3':
                this._selectNoteType('chain');
                break;
            case '4':
                this._selectNoteType('multi');
                break;
            case '5':
                this._selectNoteType('slide');
                break;
            case '6':
                this._selectNoteType('flick');
                break;
        }
    }

    _copySelectedNotes() {
        const count = this.selectionManager.copy();
        if (count > 0) {
            this._showToast(`Copied ${count} note${count > 1 ? 's' : ''}`);
        } else {
            this._showToast('No notes selected');
        }
    }

    _pasteNotes() {
        if (this.selectionManager.clipboard.length === 0) {
            this._showToast('Clipboard is empty');
            return;
        }

        const pasteTime = this.audioPlayer.currentTime * 1000;
        const pastedNotes = this.selectionManager.paste(pasteTime);

        if (pastedNotes.length > 0) {
            // Add pasted notes to chart
            pastedNotes.forEach(note => this._chart.notes.push(note));
            this._chart.notes.sort((a, b) => a.time - b.time);
            this.timeline.update();
            this._showToast(`Pasted ${pastedNotes.length} note${pastedNotes.length > 1 ? 's' : ''}`);

            // Mark as unsaved
            this.autoSaveManager.markUnsaved();
        }
    }

    _cutSelectedNotes() {
        const notesToCut = this.selectionManager.cut();
        if (notesToCut.length > 0) {
            // Remove cut notes from chart
            notesToCut.forEach(note => {
                const index = this._chart.notes.indexOf(note);
                if (index > -1) {
                    this._chart.notes.splice(index, 1);
                }
            });
            this.selectionManager.clearSelection();
            this.timeline.update();
            this._showToast(`Cut ${notesToCut.length} note${notesToCut.length > 1 ? 's' : ''}`);

            // Mark as unsaved
            this.autoSaveManager.markUnsaved();
        } else {
            this._showToast('No notes selected');
        }
    }

    _duplicateSelectedNotes() {
        const beatDuration = (60 / this._settings.bpm) * 1000; // One beat in ms
        const duplicated = this.selectionManager.duplicate(beatDuration);

        if (duplicated.length > 0) {
            duplicated.forEach(note => this._chart.notes.push(note));
            this._chart.notes.sort((a, b) => a.time - b.time);
            this.timeline.update();
            this._showToast(`Duplicated ${duplicated.length} note${duplicated.length > 1 ? 's' : ''}`);

            // Mark as unsaved
            this.autoSaveManager.markUnsaved();
        } else {
            this._showToast('No notes selected');
        }
    }

    _selectAllNotes() {
        this.selectionManager.selectAll(this._chart.notes);
        this.timeline.update();
        this._showToast(`Selected ${this._chart.notes.length} notes`);
    }

    _deleteSelectedNotes() {
        const selected = this.selectionManager.getSelection();
        if (selected.length > 0) {
            selected.forEach(note => {
                const index = this._chart.notes.indexOf(note);
                if (index > -1) {
                    this._chart.notes.splice(index, 1);
                }
            });
            this.selectionManager.clearSelection();
            this.timeline.update();
            this._showToast(`Deleted ${selected.length} note${selected.length > 1 ? 's' : ''}`);

            // Mark as unsaved
            this.autoSaveManager.markUnsaved();
        }
    }

    _showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'editor-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: rgba(30, 40, 60, 0.95);
            color: #e2e8f0;
            padding: 12px 20px;
            border-radius: 6px;
            font-family: 'ZenMaruGothic', sans-serif;
            font-size: 14px;
            z-index: 100000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    _showFormatSelectionDialog() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.7); z-index: 100000;
                display: flex; align-items: center; justify-content: center;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: #1e293b; padding: 24px; border-radius: 8px;
                color: #e2e8f0; font-family: 'ZenMaruGothic', sans-serif;
                max-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            `;

            dialog.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 18px;">Train from Other Game Format</h3>
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #94a3b8;">Select the beatmap format:</p>
                <select id="format-select" style="width: 100%; padding: 8px; margin-bottom: 16px; background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 4px; font-size: 14px;">
                    <option value="osu">osu!mania (.osu files)</option>
                    <option value="stepmania">StepMania (.sm files)</option>
                    <option value="bms">BMS/BME (.bms/.bme files)</option>
                    <option value="maimai">maimai (JSON charts)</option>
                    <option value="chunithm">CHUNITHM (JSON charts)</option>
                </select>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button id="cancel-btn" style="padding: 8px 16px; background: #334155; color: #e2e8f0; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
                    <button id="ok-btn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">OK</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const formatSelect = dialog.querySelector('#format-select');
            const okBtn = dialog.querySelector('#ok-btn');
            const cancelBtn = dialog.querySelector('#cancel-btn');

            const cleanup = () => {
                overlay.remove();
            };

            okBtn.onclick = () => {
                const format = formatSelect.value;
                cleanup();
                resolve(format);
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(null);
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(null);
                }
            };
        });
    }

    _toggleHelpModal() {
        if (!this.helpModal) this._renderHelpModal();

        const isVisible = this.helpModal.style.display !== 'none';
        this.helpModal.style.display = isVisible ? 'none' : 'block';
    }

    _showSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (!modal) {
            return;
        }

        // Load current settings
        this._loadSettingsToModal();

        // Apply current theme to modal
        const currentTheme = JSON.parse(localStorage.getItem('editorSettings') || '{}').theme || 'dark';
        this._updateSettingsModalTheme(currentTheme);

        // Show modal
        modal.classList.add('show');

        // Blur background
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            appContainer.style.filter = 'blur(8px)';
        }
        // Setup event listeners if not already done
        if (!this._settingsModalInitialized) {
            const closeBtn = document.getElementById('settings-modal-close');
            const saveBtn = document.getElementById('settings-save');
            const resetBtn = document.getElementById('settings-reset');

            const closeModal = () => {
                modal.classList.remove('show');
                // Remove blur
                const appContainer = document.getElementById('app-container');
                if (appContainer) {
                    appContainer.style.filter = 'none';
                }
            };

            if (closeBtn) {
                closeBtn.addEventListener('click', closeModal);
            }

            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    this._saveSettingsFromModal();
                    closeModal();
                    this._showToast('Settings saved successfully');
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    if (confirm('Reset all settings to defaults?')) {
                        localStorage.removeItem('editorSettings');
                        this._loadSettingsToModal();
                        this._showToast('Settings reset to defaults');
                    }
                });
            }

            // Import Theme button
            const importThemeBtn = document.getElementById('setting-import-theme');
            if (importThemeBtn) {
                importThemeBtn.addEventListener('click', () => {
                    this.themeImporter.showImportDialog();
                });
            }

            // Theme preview selection
            const themeOptions = document.querySelectorAll('.theme-option');
            themeOptions.forEach(option => {
                const preview = option.querySelector('.theme-preview');
                const radio = option.querySelector('input[type="radio"]');

                preview.addEventListener('click', async () => {
                    // Unselect all
                    document.querySelectorAll('.theme-preview').forEach(p => {
                        p.classList.remove('selected');
                    });
                    // Select this one
                    preview.classList.add('selected');
                    radio.checked = true;

                    const theme = option.dataset.theme;
                    const isBuiltin = option.dataset.builtin === 'true';

                    if (isBuiltin) {
                        // Load and apply built-in theme
                        try {
                            const response = await fetch(`./assets/themes/${theme}.json`);
                            if (!response.ok) throw new Error('Theme not found');

                            const themeData = await response.json();

                            // Map and apply the theme
                            const mappedTheme = this.themeImporter.mapVSCodeTheme(themeData.colors, themeData.name);
                            this.themeImporter.applyCustomTheme(mappedTheme);

                            // Save to localStorage
                            localStorage.setItem('customTheme', JSON.stringify(mappedTheme));

                            this._showToast(`Applied Custom Theme: ${themeData.name}`);
                        } catch (error) {
                            this._showToast('Failed to load theme', 'error');
                        }
                    } else {
                        // Apply standard theme
                        this._applyTheme(theme);
                        this._updateSettingsModalTheme(theme);
                    }
                });
            });

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('show')) {
                    closeModal();
                }
            });

            this._settingsModalInitialized = true;
        }
    }

    _loadSettingsToModal() {
        const settings = JSON.parse(localStorage.getItem('editorSettings') || '{}');

        const setVal = (id, val, def) => {
            const el = document.getElementById(id);
            if (el) el.value = val !== undefined ? val : def;
        };
        const setChecked = (id, val, def) => {
            const el = document.getElementById(id);
            if (el) el.checked = val !== undefined ? val : def;
        };

        setVal('setting-autosave', settings.autosaveInterval, 30);
        setVal('setting-snap', settings.gridSnap, 4);
        setChecked('setting-show-fps', settings.showFps, true);
        setVal('setting-master-volume', settings.masterVolume, 100);
        setVal('setting-metronome-volume', settings.metronomeVolume, 50);
        setVal('setting-audio-latency', settings.audioLatency, 0);
        setVal('setting-note-colors', settings.noteColors, 'default');
        setChecked('setting-performance-mode', settings.performanceMode, false);

        // Set theme radio button
        const theme = settings.theme || 'dark';
        const themeRadio = document.querySelector(`input[name="setting-theme"][value="${theme}"]`);
        if (themeRadio) {
            themeRadio.checked = true;
            // Also select the preview
            const themeOption = themeRadio.closest('.theme-option');
            if (themeOption) {
                const preview = themeOption.querySelector('.theme-preview');
                if (preview) {
                    document.querySelectorAll('.theme-preview').forEach(p => p.classList.remove('selected'));
                    preview.classList.add('selected');
                }
            }
        }
    }

    _saveSettingsFromModal() {
        const getVal = (id) => document.getElementById(id)?.value;
        const getChecked = (id) => document.getElementById(id)?.checked;
        const getRadio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

        const settings = {
            autosaveInterval: parseInt(getVal('setting-autosave')),
            gridSnap: parseInt(getVal('setting-snap')),
            showFps: getChecked('setting-show-fps'),
            masterVolume: parseInt(getVal('setting-master-volume')),
            metronomeVolume: parseInt(getVal('setting-metronome-volume')),
            audioLatency: parseInt(getVal('setting-audio-latency')),
            theme: getRadio('setting-theme') || 'dark',
            noteColors: getVal('setting-note-colors'),
            performanceMode: getChecked('setting-performance-mode')
        };

        localStorage.setItem('editorSettings', JSON.stringify(settings));

        // Apply settings immediately
        // Apply grid snap
        if (this.timeline) {
            this.timeline.snapDivision = settings.gridSnap;
        }

        // Apply snap toggle
        if (this.snapDivisionSelect) {
            this.snapDivisionSelect.value = settings.gridSnap;
        }

        // Apply autosave interval
        if (this.autoSaveManager) {
            this.autoSaveManager.autoSaveInterval = settings.autosaveInterval * 1000; // Convert to ms
            this.autoSaveManager.stop();
            this.autoSaveManager.start(); // Restart with new interval
        }

        // Apply volumes
        if (this.musicVolumeSlider) {
            this.musicVolumeSlider.value = settings.masterVolume;
            if (this.audioPlayer) {
                this.audioPlayer.volume = settings.masterVolume / 100;
            }
        }

        if (this.metronomeVolumeSlider) {
            this.metronomeVolumeSlider.value = settings.metronomeVolume;
            this._settings.metronomeVolume = settings.metronomeVolume / 100;
        }

        // Apply FPS counter visibility
        const fpsElement = document.getElementById('status-fps');
        if (fpsElement) {
            fpsElement.parentElement.style.display = settings.showFps ? 'flex' : 'none';
        }

        // Apply audio latency offset
        if (this._settings) {
            this._settings.audioLatencyOffset = settings.audioLatency;
        }

        // Apply theme
        this._applyTheme(settings.theme);

        // Apply note color scheme
        this._applyNoteColorScheme(settings.noteColors);

        // Apply performance mode
        if (settings.performanceMode) {
            document.body.classList.add('performance-mode');
            // Optimize PIXI for performance
            if (window.PIXI) {
                window.PIXI.settings.RESOLUTION = 1;
                window.PIXI.settings.ROUND_PIXELS = true;
            }
            // Reduce gameplay renderer quality if it exists
            if (this.gameplay && this.gameplay.app) {
                this.gameplay.app.renderer.resolution = 1;
            }
            if (this.timeline && this.timeline.app) {
                this.timeline.app.renderer.resolution = 1;
            }
        } else {
            document.body.classList.remove('performance-mode');
            // High quality mode
            if (window.PIXI) {
                window.PIXI.settings.RESOLUTION = window.devicePixelRatio || 1;
                window.PIXI.settings.ROUND_PIXELS = false;
            }
            // Restore high quality rendering
            if (this.gameplay && this.gameplay.app) {
                this.gameplay.app.renderer.resolution = window.devicePixelRatio || 1;
            }
            if (this.timeline && this.timeline.app) {
                this.timeline.app.renderer.resolution = window.devicePixelRatio || 1;
            }
        }

        // Update status bar
        this._updateStatusBar();
    }

    _applyTheme(theme) {
        const root = document.documentElement;
        const body = document.body;

        // Remove existing theme classes
        body.classList.remove('theme-light', 'theme-dark', 'theme-oled', 'theme-high-contrast');

        if (theme === 'light') {
            body.classList.add('theme-light');
            root.style.setProperty('--bg-primary', '#f5f5f5');
            root.style.setProperty('--bg-elevated', '#ffffff');
            root.style.setProperty('--text-primary', '#1a1a1a');
            root.style.setProperty('--text-secondary', '#666666');
            root.style.setProperty('--border-color', '#d0d0d0');
            root.style.setProperty('--accent-primary', '#0066cc');
            root.style.setProperty('--accent-hover', '#0052a3');
        } else if (theme === 'oled') {
            body.classList.add('theme-oled');
            root.style.setProperty('--bg-primary', '#000000');
            root.style.setProperty('--bg-elevated', '#000000');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#999999');
            root.style.setProperty('--border-color', '#333333');
            root.style.setProperty('--accent-primary', '#00aaff');
            root.style.setProperty('--accent-hover', '#0088cc');
        } else if (theme === 'high-contrast') {
            body.classList.add('theme-high-contrast');
            root.style.setProperty('--bg-primary', '#000000');
            root.style.setProperty('--bg-elevated', '#1a1a1a');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#cccccc');
            root.style.setProperty('--border-color', '#ffffff');
            root.style.setProperty('--accent-primary', '#00ff00');
            root.style.setProperty('--accent-hover', '#00cc00');
        } else {
            // Dark theme (default)
            body.classList.add('theme-dark');
            root.style.setProperty('--bg-primary', '#1e1e1e');
            root.style.setProperty('--bg-elevated', '#252526');
            root.style.setProperty('--text-primary', '#cccccc');
            root.style.setProperty('--text-secondary', '#858585');
            root.style.setProperty('--border-color', '#3e3e42');
            root.style.setProperty('--accent-primary', '#0e639c');
            root.style.setProperty('--accent-hover', '#1177bb');
        }

        // Update timeline background color to match theme
        if (this.timeline && this.timeline.updateBackgroundColor) {
            this.timeline.updateBackgroundColor();
            // Redraw grid with new theme colors
            this.timeline.createGrid();
        }
    }

    _applyNoteColorScheme(scheme) {
        if (!this._settings || !this._settings.noteColors) return;

        if (scheme === 'rainbow') {
            this._settings.noteColors = {
                regular: '#FF0000',  // Red
                hold: '#FF7F00',     // Orange
                chain: '#FFFF00',    // Yellow
                multi: '#00FF00',    // Green
                slide: '#0000FF',    // Blue
                flick: '#8B00FF'     // Violet
            };
        } else if (scheme === 'monochrome') {
            this._settings.noteColors = {
                regular: '#FFFFFF',  // White
                hold: '#CCCCCC',     // Light gray
                chain: '#999999',    // Medium gray
                multi: '#FFFFFF',    // White
                slide: '#666666',    // Dark gray
                flick: '#AAAAAA'     // Gray
            };
        } else {
            // Default colors
            this._settings.noteColors = {
                regular: '#FF69B4',  // Pink
                hold: '#FFD700',     // Gold
                chain: '#00CED1',    // Dark Turquoise
                multi: '#FFD700',    // Gold
                slide: '#9370DB',    // Medium Purple
                flick: '#FF6347'     // Tomato Red
            };
        }

        // Update color inputs in sidebar
        if (this.regularNoteColorInput) this.regularNoteColorInput.value = this._settings.noteColors.regular;
        if (this.holdNoteColorInput) this.holdNoteColorInput.value = this._settings.noteColors.hold;
        if (this.chainNoteColorInput) this.chainNoteColorInput.value = this._settings.noteColors.chain;
        if (this.multiNoteColorInput) this.multiNoteColorInput.value = this._settings.noteColors.multi;
        if (this.slideNoteColorInput) this.slideNoteColorInput.value = this._settings.noteColors.slide;
        if (this.flickNoteColorInput) this.flickNoteColorInput.value = this._settings.noteColors.flick;

        // Redraw timeline to show new colors
        if (this.timeline) {
            this.timeline.update();
        }
    }

    _updateSettingsModalTheme(theme) {
        const modalContent = document.querySelector('.settings-modal-content');
        const modalHeader = document.querySelector('#settings-modal .modal-header');
        const modalFooter = document.querySelector('#settings-modal .modal-footer');
        const modalBody = document.querySelector('.settings-modal-body');
        const sections = document.querySelectorAll('.settings-section');
        const labels = document.querySelectorAll('#settings-modal label');
        const h2 = document.querySelector('#settings-modal h2');
        const h3s = document.querySelectorAll('.settings-section h3');
        const closeBtn = document.querySelector('#settings-modal-close');
        const inputs = document.querySelectorAll('#settings-modal input[type="number"], #settings-modal input[type="text"], #settings-modal select');

        if (!modalContent) return;

        if (theme === 'light') {
            modalContent.style.background = 'rgba(255, 255, 255, 0.95)';
            if (modalHeader) modalHeader.style.borderBottomColor = 'rgba(0, 0, 0, 0.1)';
            if (modalFooter) modalFooter.style.borderTopColor = 'rgba(0, 0, 0, 0.1)';
            if (h2) h2.style.color = '#333';
            if (closeBtn) closeBtn.style.color = '#666';
            sections.forEach(s => s.style.borderBottomColor = 'rgba(0, 0, 0, 0.1)');
            h3s.forEach(h => h.style.color = '#667eea');
            labels.forEach(l => l.style.color = '#333');
            inputs.forEach(i => {
                i.style.backgroundColor = '#ffffff';
                i.style.color = '#333';
                i.style.borderColor = '#e0e0e0';
            });
        } else if (theme === 'oled') {
            modalContent.style.background = 'rgba(0, 0, 0, 0.95)';
            if (modalHeader) modalHeader.style.borderBottomColor = 'rgba(255, 255, 255, 0.1)';
            if (modalFooter) modalFooter.style.borderTopColor = 'rgba(255, 255, 255, 0.1)';
            if (h2) h2.style.color = '#ffffff';
            if (closeBtn) closeBtn.style.color = '#999';
            sections.forEach(s => s.style.borderBottomColor = 'rgba(255, 255, 255, 0.1)');
            h3s.forEach(h => h.style.color = '#00aaff');
            labels.forEach(l => l.style.color = '#ffffff');
            inputs.forEach(i => {
                i.style.backgroundColor = '#1a1a1a';
                i.style.color = '#ffffff';
                i.style.borderColor = '#333333';
            });
        } else if (theme === 'high-contrast') {
            modalContent.style.background = 'rgba(0, 0, 0, 0.95)';
            if (modalHeader) modalHeader.style.borderBottomColor = 'rgba(255, 255, 255, 0.2)';
            if (modalFooter) modalFooter.style.borderTopColor = 'rgba(255, 255, 255, 0.2)';
            if (h2) h2.style.color = '#ffffff';
            if (closeBtn) closeBtn.style.color = '#cccccc';
            sections.forEach(s => s.style.borderBottomColor = 'rgba(255, 255, 255, 0.2)');
            h3s.forEach(h => h.style.color = '#00ff00');
            labels.forEach(l => l.style.color = '#ffffff');
            inputs.forEach(i => {
                i.style.backgroundColor = '#1a1a1a';
                i.style.color = '#ffffff';
                i.style.borderColor = '#ffffff';
            });
        } else {
            // Dark theme
            modalContent.style.background = 'rgba(30, 30, 30, 0.95)';
            if (modalHeader) modalHeader.style.borderBottomColor = 'rgba(255, 255, 255, 0.1)';
            if (modalFooter) modalFooter.style.borderTopColor = 'rgba(255, 255, 255, 0.1)';
            if (h2) h2.style.color = '#cccccc';
            if (closeBtn) closeBtn.style.color = '#858585';
            sections.forEach(s => s.style.borderBottomColor = 'rgba(255, 255, 255, 0.1)');
            h3s.forEach(h => h.style.color = '#667eea');
            labels.forEach(l => l.style.color = '#cccccc');
            inputs.forEach(i => {
                i.style.backgroundColor = '#252526';
                i.style.color = '#cccccc';
                i.style.borderColor = '#3e3e42';
            });
        }
    }

    _onMarkerAction(action, marker) {
        if (action === 'delete') {
            const index = this.sessionMarkers.indexOf(marker);
            if (index > -1) {
                this.sessionMarkers.splice(index, 1);
                // Refresh the timeline to show the marker has been removed
                this.timeline.setSessionMarkers(this.sessionMarkers);
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

    _updateMetronomeVolume() {
        const volume = parseFloat(this.metronomeVolumeSlider.value);
        if (!isNaN(volume)) {
            this._settings.metronomeVolume = volume;
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
            this._showToast('Please load an audio file first');
            return;
        }
        this.isSimulating = !this.isSimulating;
        if (this.isSimulating) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
            this.audioPlayer.play().catch(e => {
                this.isSimulating = false;
                this.playIcon.style.display = 'block';
                this.pauseIcon.style.display = 'none';
            });
            this.gameplay.setChart(this._chartData.raw.notes); // Pass current chart notes to gameplay
            this.gameplay.start(); // Start gameplay simulation
            this._updateTimelineIndicator();

            // Start metronome if enabled
            if (this.metronomeEnabled) {
                this._startMetronome();
            }
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
            this.audioPlayer.pause();
            this.gameplay.stop(); // Stop gameplay simulation
            cancelAnimationFrame(this.timelineIndicatorRAF);

            // Stop metronome
            this._stopMetronome();
        }
    }

    _toggleMetronome() {
        this.metronomeEnabled = !this.metronomeEnabled;

        // Update button visual state
        if (this.metronomeEnabled) {
            this.metronomeBtn.classList.add('active');
            this.metronomeBtn.style.color = '#0e639c';
            this._showToast('Metronome enabled');

            // Start metronome if audio is playing
            if (this.isSimulating) {
                this._startMetronome();
            }
        } else {
            this.metronomeBtn.classList.remove('active');
            this.metronomeBtn.style.color = '';
            this._showToast('Metronome disabled');
            this._stopMetronome();
        }
    }

    _startMetronome() {
        this._stopMetronome(); // Clear any existing interval
        this.lastMetronomeBeat = -1;

        // Calculate beat interval in milliseconds
        const beatInterval = (60 / this._settings.bpm) * 1000;

        // Check for metronome tick on each frame
        const checkMetronome = () => {
            if (!this.isSimulating || !this.metronomeEnabled) {
                return;
            }

            const currentTime = this.audioPlayer.currentTime * 1000;
            const currentBeat = Math.floor(currentTime / beatInterval);

            // Play tick on each new beat
            if (currentBeat !== this.lastMetronomeBeat) {
                this.lastMetronomeBeat = currentBeat;

                // Accent on first beat of measure (every 4 beats)
                const isAccent = (currentBeat % 4) === 0;

                // Create metronome tick using Web Audio API for better sound
                this._playMetronomeTick(isAccent);
            }

            this.metronomeInterval = requestAnimationFrame(checkMetronome);
        };

        checkMetronome();
    }

    _playMetronomeTick(isAccent = false) {
        try {
            const audioContext = soundManager.context;
            if (!audioContext) return;

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Accent beat: higher pitch and louder
            // Regular beat: lower pitch and quieter
            oscillator.frequency.value = isAccent ? 1200 : 800;

            // Apply metronome volume setting
            const baseVolume = this._settings.metronomeVolume || 0.5;
            gainNode.gain.value = isAccent ? baseVolume * 1.0 : baseVolume * 0.6;

            // Short, sharp click
            oscillator.start(audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
            oscillator.stop(audioContext.currentTime + 0.05);
        } catch (e) {
        }
    }

    _stopMetronome() {
        if (this.metronomeInterval) {
            cancelAnimationFrame(this.metronomeInterval);
            this.metronomeInterval = null;
        }
        this.lastMetronomeBeat = -1;
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

            // Store audio metadata
            this.audioMetadata = {
                sampleRate: audioBuffer.sampleRate,
                channels: audioBuffer.numberOfChannels,
                duration: audioBuffer.duration,
                codec: this._detectCodec(file.name)
            };

            // Update audio timer info
            this._updateAudioTimerInfo();

            // Initialize AutoMapper with the loaded audio buffer
            try {
                this.autoMapper = new AutoMapper(audioBuffer, audioContext);
                // Load trained model from storage
                await this.autoMapper.loadTrainedModel();
            } catch (error) {
            }

            // Initialize audio analyzer for level meter
            this._initAudioAnalyzer(audioContext);
        }
    }

    _initAudioAnalyzer(audioContext) {
        try {
            // Create analyzer node
            this.audioAnalyzer = audioContext.createAnalyser();
            this.audioAnalyzer.fftSize = 512; // Increased for better resolution
            this.audioAnalyzer.smoothingTimeConstant = 0.1; // Reduced for more reactive response

            // Create media element source from audio player
            if (!this.audioSource) {
                this.audioSource = audioContext.createMediaElementSource(this.audioPlayer);
                this.audioSource.connect(this.audioAnalyzer);
                this.audioAnalyzer.connect(audioContext.destination);
            }

            // Create data array for frequency data
            this.analyzerDataArray = new Uint8Array(this.audioAnalyzer.frequencyBinCount);

            // Get level bar elements
            this.levelBarLeft = document.getElementById('level-bar-left');
            this.levelBarRight = document.getElementById('level-bar-right');

            // Start updating level meters
            this._updateLevelMeters();
        } catch (error) {
        }
    }

    _updateLevelMeters() {
        if (!this.audioAnalyzer || !this.levelBarLeft || !this.levelBarRight) {
            requestAnimationFrame(() => this._updateLevelMeters());
            return;
        }

        // Get frequency data
        this.audioAnalyzer.getByteFrequencyData(this.analyzerDataArray);

        // Use RMS (Root Mean Square) for better level representation
        let sumSquares = 0;
        let maxValue = 0;

        for (let i = 0; i < this.analyzerDataArray.length; i++) {
            const value = this.analyzerDataArray[i];
            sumSquares += value * value;
            maxValue = Math.max(maxValue, value);
        }

        // Calculate RMS
        const rms = Math.sqrt(sumSquares / this.analyzerDataArray.length);

        // Blend RMS (70%) with peak (30%) for responsive but stable meter
        const blended = (rms * 0.7) + (maxValue * 0.3);

        // Apply gain multiplier to reach full scale more easily
        // Reduced to 1.3x for better headroom
        const levelPercent = Math.min(100, (blended / 255) * 100 * 1.3);

        // Apply to both bars (simulating stereo)
        // Add slight variation for visual interest
        const leftLevel = Math.min(100, levelPercent + (Math.random() * 3 - 1.5));
        const rightLevel = Math.min(100, levelPercent + (Math.random() * 3 - 1.5));

        this.levelBarLeft.style.width = `${leftLevel}%`;
        this.levelBarRight.style.width = `${rightLevel}%`;

        // Check for clipping (above 95% - only on true peaks)
        if (leftLevel > 95) {
            this.levelBarLeft.classList.add('clipping');
            setTimeout(() => this.levelBarLeft.classList.remove('clipping'), 100);
        }
        if (rightLevel > 95) {
            this.levelBarRight.classList.add('clipping');
            setTimeout(() => this.levelBarRight.classList.remove('clipping'), 100);
        }

        // Continue updating at 60fps
        requestAnimationFrame(() => this._updateLevelMeters());
    }

    _detectCodec(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const codecMap = {
            'mp3': 'MP3',
            'wav': 'WAV',
            'ogg': 'OGG Vorbis',
            'flac': 'FLAC',
            'm4a': 'AAC',
            'aac': 'AAC',
            'opus': 'Opus',
            'webm': 'WebM'
        };
        return codecMap[ext] || ext.toUpperCase();
    }

    _updateAudioTimerInfo() {
        const audioTimerInfo = document.getElementById('audio-timer-info');
        if (audioTimerInfo && this.audioMetadata) {
            const sampleRateKHz = (this.audioMetadata.sampleRate / 1000).toFixed(1);
            const channelText = this.audioMetadata.channels === 1 ? 'Mono' : this.audioMetadata.channels === 2 ? 'Stereo' : `${this.audioMetadata.channels}ch`;
            audioTimerInfo.textContent = `${this.audioMetadata.codec} • ${sampleRateKHz}kHz • ${channelText}`;
        }
    }

    _updateAudioTimer() {
        const audioTimerDisplay = document.getElementById('audio-timer-display');
        if (audioTimerDisplay && this.audioPlayer) {
            const currentTime = this.audioPlayer.currentTime || 0;
            const hours = Math.floor(currentTime / 3600);
            const minutes = Math.floor((currentTime % 3600) / 60);
            const seconds = Math.floor(currentTime % 60);

            audioTimerDisplay.textContent = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
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
        this._recordingNewNotes = []; // Initialize array for notes recorded in this session
        this.timeline.setTemporaryNotes(this._recordingNewNotes); // Pass reference to timeline for real-time rendering
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

        this.timeline.setTemporaryNotes([]); // Clear temporary notes from view

        if (this._recordingNewNotes.length > 0) {
            this.commandManager.execute(new AddRecordedNotesCommand(this._chartData, this._recordingNewNotes));
            this._recordingNewNotes = []; // Clear recorded notes after adding them to the chart
            this.timeline.update(); // Update timeline to show all merged notes
        }
    }

    _recordLoop() {
        if (!this.isRecording) return;
        const pressedZones = this.input.getPressedZones();
        const currentTime = performance.now() - this.startTime;
        for (const zone of pressedZones) {
            this._recordingNewNotes.push({ time: currentTime, zone, type: this.selectedNoteType });
            this.gameplay.showHit(zone);
            soundManager.play('perfect');
        }
        // Always update the timeline to show notes and progress
        this.timeline.update(); // Changed from conditional drawNotes()
        requestAnimationFrame(() => this._recordLoop());
    }

    _updateTimelineIndicator = () => {
        const currentTime = this.audioPlayer.currentTime * 1000;
        this.timeline.drawCurrentTimeIndicator(currentTime);
        this.timelineIndicatorRAF = requestAnimationFrame(this._updateTimelineIndicator);
    }

    async _exportChart() {
        const chartData = { ...this._chart, keybinds: this.input.getMappings() };
        const dataStr = JSON.stringify(chartData, null, 2);

        // Use Electron's native save dialog if available
        if (window.electronAPI) {
            const result = await window.electronAPI.saveChart({
                data: dataStr,
                defaultPath: `${this._chart.meta.title || 'untitled'}.json`
            });
            if (result.success) {
            }
        } else {
            // Fallback for web browser
            const dataUri = "data:text/json;charset=utf-8," + encodeURIComponent(dataStr);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataUri);
            downloadAnchorNode.setAttribute("download", `${this._chart.meta.title || 'untitled'}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        }
    }

    async _importChart() {
        // Use Electron's native open dialog if available
        if (window.electronAPI) {
            const result = await window.electronAPI.openChart();
            if (result && result.content) {
                this._processImportedChart(result.content);
            }
        } else {
            // Fallback for web browser
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.onchange = e => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => this._processImportedChart(event.target.result);
                    reader.readAsText(file);
                }
            };
            fileInput.click();
        }
    }

    _processImportedChart(jsonContent) {
        try {
            const importedChart = JSON.parse(jsonContent);
            if (importedChart.meta && importedChart.timing && importedChart.notes) {
                this._chart = importedChart;
                this._chartData = new ChartData(this._chart);
                this.timeline._chartData = this._chartData;
                this.timeline.update();

                // Update all UI fields with imported metadata
                this.bpmInput.value = this._chart.meta.bpm.init || this._chart.meta.bpm || 120;
                this.offsetInput.value = this._chart.timing.offset || 0;

                // Update metadata fields
                if (this.chartTitleInput) this.chartTitleInput.value = this._chart.meta.title || '';
                if (this.chartArtistInput) this.chartArtistInput.value = this._chart.meta.artist || '';
                if (this.chartCreatorInput) this.chartCreatorInput.value = this._chart.meta.creator || '';
                if (this.chartDifficultySelect) this.chartDifficultySelect.value = this._chart.meta.difficulty || 1;
                if (this.chartLevelInput) this.chartLevelInput.value = this._chart.meta.level || 1;

                // Update settings
                this._settings.bpm = this._chart.meta.bpm.init || this._chart.meta.bpm || 120;
                this._settings.offset = this._chart.timing.offset || 0;

                this._onNoteSelected(null);
                this._showToast(`Imported: ${this._chart.meta.title || 'Untitled'}`);
            } else {
                this._showToast('Error: Invalid chart format');
            }
        } catch (error) {
            this._showToast('Error: Failed to parse chart file');
        }
    }

    async _showAutomapDialog() {
        if (!this.audioPlayer.src) {
            this._showToast('Please load an audio file first');
            return;
        }

        if (!this.autoMapper) {
            this._showToast('AutoMapper not initialized. Please reload audio.');
            return;
        }

        const difficulty = parseInt(this.chartDifficultySelect.value) || 2;
        const bpm = parseInt(this.bpmInput.value) || 120;
        const offset = parseInt(this.offsetInput.value) || 0;

        // Check if trained model exists
        const hasTrainedModel = this.autoMapper.trainedModel !== null;
        const modelStatus = hasTrainedModel ? '✓ Trained model loaded' : '○ No trained model';

        const confirmed = confirm(
            `AI Chart Generation\n\n` +
            `This will generate notes automatically based on:\n` +
            `• Audio analysis (onsets, beats, spectral)\n` +
            `• maimai-style patterns (circular flows, symmetry)\n` +
            `• ${modelStatus}\n\n` +
            `Settings:\n` +
            `• Difficulty: ${['', 'EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'][difficulty]}\n` +
            `• BPM: ${bpm}\n` +
            `• Offset: ${offset}ms\n\n` +
            `This will replace all existing notes. Continue?`
        );

        if (!confirmed) return;

        this._showToast('Generating chart... This may take a moment.');

        try {
            const generatedNotes = await this.autoMapper.generateChart({
                difficulty,
                bpm,
                offset,
                minNoteInterval: 200,
                useTrainedModel: true,
                maimaiStyle: true,
                maimaiIntensity: 0.7
            });

            this._chart.notes = generatedNotes;
            this._chartData = new ChartData(this._chart);
            this.timeline._chartData = this._chartData;
            this.timeline.update();
            this._updateChartStatistics();

            this._showToast(`✓ Generated ${generatedNotes.length} notes!`);
        } catch (error) {
            this._showToast('Error: Chart generation failed');
        }
    }

    /**
     * Train the AI from current chart
     */
    async _trainAIFromCurrentChart() {
        // Initialize AutoMapper if not already initialized
        if (!this.autoMapper) {
            // Create a dummy audio buffer for training-only mode
            const dummyContext = new (window.AudioContext || window.webkitAudioContext)();
            const dummyBuffer = dummyContext.createBuffer(1, dummyContext.sampleRate, dummyContext.sampleRate);
            this.autoMapper = new AutoMapper(dummyBuffer, dummyContext);
        }

        if (!this._chart.notes || this._chart.notes.length === 0) {
            this._showToast('No notes in current chart to train from');
            return;
        }

        const confirmed = confirm(
            `Train AI from Current Chart\n\n` +
            `This will analyze the current chart and learn your mapping style.\n` +
            `The AI will use these patterns when generating new charts.\n\n` +
            `Current chart: ${this._chart.notes.length} notes\n` +
            `Difficulty: ${this._chart.meta.difficulty || 'Unknown'}\n\n` +
            `Continue?`
        );

        if (!confirmed) return;

        try {
            this.autoMapper.trainFromCharts([this._chart]);
            await this.autoMapper.saveTrainedModel();
            this._showToast('✓ AI trained successfully!');
            this._updateTrainingStatus();
        } catch (error) {
            this._showToast('Error: Training failed');
        }
    }

    /**
     * Train AI from multiple imported charts
     */
    async _trainAIFromMultipleCharts() {
        // Initialize AutoMapper if not already initialized
        if (!this.autoMapper) {
            // Create a dummy audio buffer for training-only mode
            const dummyContext = new (window.AudioContext || window.webkitAudioContext)();
            const dummyBuffer = dummyContext.createBuffer(1, dummyContext.sampleRate, dummyContext.sampleRate);
            this.autoMapper = new AutoMapper(dummyBuffer, dummyContext);
        }

        // Use native dialog if in Electron, otherwise fall back to file input
        if (window.electronAPI && window.electronAPI.openMultipleFiles) {
            const result = await window.electronAPI.openMultipleFiles();

            if (result.canceled || !result.files || result.files.length === 0) {
                return;
            }

            this._showToast(`Loading ${result.files.length} charts for training...`);

            try {
                const charts = [];
                for (const file of result.files) {
                    const chart = JSON.parse(file.content);
                    if (chart.notes && chart.notes.length > 0) {
                        charts.push(chart);
                    }
                }

                if (charts.length === 0) {
                    this._showToast('No valid charts found');
                    return;
                }

                this.autoMapper.trainFromCharts(charts);
                await this.autoMapper.saveTrainedModel();
                this._showToast(`✓ AI trained from ${charts.length} charts!`);
                this._updateTrainingStatus();
            } catch (error) {
                this._showToast('Error: Training failed');
            }
        } else {
            // Fallback for browser mode
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.multiple = true;

            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;

                this._showToast(`Loading ${files.length} charts for training...`);

                try {
                    const charts = [];
                    for (const file of files) {
                        const text = await file.text();
                        const chart = JSON.parse(text);
                        if (chart.notes && chart.notes.length > 0) {
                            charts.push(chart);
                        }
                    }

                    if (charts.length === 0) {
                        this._showToast('No valid charts found');
                        return;
                    }

                    this.autoMapper.trainFromCharts(charts);
                    await this.autoMapper.saveTrainedModel();
                    this._showToast(`✓ AI trained from ${charts.length} charts!`);
                    this._updateTrainingStatus();
                } catch (error) {
                    this._showToast('Error: Training failed');
                }
            };

            input.click();
        }
    }

    /**
     * Clear trained model
     */
    _clearTrainedModel() {
        // Initialize AutoMapper if not already initialized
        if (!this.autoMapper) {
            const dummyContext = new (window.AudioContext || window.webkitAudioContext)();
            const dummyBuffer = dummyContext.createBuffer(1, dummyContext.sampleRate, dummyContext.sampleRate);
            this.autoMapper = new AutoMapper(dummyBuffer, dummyContext);
        }

        const confirmed = confirm(
            `Clear Trained Model\n\n` +
            `This will remove all learned patterns.\n` +
            `The AI will use only audio analysis and maimai patterns.\n\n` +
            `Continue?`
        );

        if (!confirmed) return;

        this.autoMapper.trainedModel = null;
        localStorage.removeItem('dsxAutoMapperModel');

        // Also clear IndexedDB
        const request = indexedDB.open('DSXAutoMapper', 1);
        request.onsuccess = (event) => {
            const db = event.target.result;
            if (db.objectStoreNames.contains('models')) {
                const transaction = db.transaction(['models'], 'readwrite');
                const store = transaction.objectStore('models');
                store.delete('trainedModel');
            }
        };

        this._showToast('✓ Trained model cleared');
    }

    /**
     * Export AI model to file
     */
    _exportAIModel() {
        if (!this.autoMapper) {
            const dummyContext = new (window.AudioContext || window.webkitAudioContext)();
            const dummyBuffer = dummyContext.createBuffer(1, dummyContext.sampleRate, dummyContext.sampleRate);
            this.autoMapper = new AutoMapper(dummyBuffer, dummyContext);
        }

        if (!this.autoMapper.trainedModel) {
            this._showToast('No trained model to export');
            return;
        }

        const success = this.autoMapper.exportModelToFile();
        if (success) {
            this._showToast('✓ Model exported successfully');
        } else {
            this._showToast('Error: Failed to export model');
        }
    }

    /**
     * Import AI model from file
     */
    async _importAIModel() {
        if (!this.autoMapper) {
            const dummyContext = new (window.AudioContext || window.webkitAudioContext)();
            const dummyBuffer = dummyContext.createBuffer(1, dummyContext.sampleRate, dummyContext.sampleRate);
            this.autoMapper = new AutoMapper(dummyBuffer, dummyContext);
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            this._showToast('Loading model...');

            try {
                const success = await this.autoMapper.importModelFromFile(file);
                if (success) {
                    this._showToast('✓ Model imported successfully');
                    this._updateTrainingStatus();
                } else {
                    this._showToast('Error: Failed to import model');
                }
            } catch (error) {
                this._showToast('Error: Invalid model file');
            }
        };

        input.click();
    }

    /**
     * Train AI from other rhythm game formats
     */
    async _trainAIFromOtherFormat() {
        // Initialize AutoMapper if not already initialized
        if (!this.autoMapper) {
            const dummyContext = new (window.AudioContext || window.webkitAudioContext)();
            const dummyBuffer = dummyContext.createBuffer(1, dummyContext.sampleRate, dummyContext.sampleRate);
            this.autoMapper = new AutoMapper(dummyBuffer, dummyContext);
        }

        // Create custom format selection dialog
        const format = await this._showFormatSelectionDialog();

        if (!format) return;

        const formatLower = format.toLowerCase().trim();
        const validFormats = ['osu', 'osumania', 'stepmania', 'sm', 'bms', 'bme', 'maimai', 'chunithm'];

        if (!validFormats.includes(formatLower)) {
            this._showToast('Invalid format. Use: osu, stepmania, bms, maimai, or chunithm');
            return;
        }

        // Use native dialog if in Electron, otherwise fall back to file input
        if (window.electronAPI && window.electronAPI.openBeatmapFiles) {
            const result = await window.electronAPI.openBeatmapFiles({ format: formatLower });

            if (result.canceled || !result.files || result.files.length === 0) {
                return;
            }

            this._showToast(`Loading ${result.files.length} ${formatLower} charts...`);

            try {
                const chartData = [];

                for (const file of result.files) {
                    // Handle .osz files (ZIP archives)
                    if (file.name.endsWith('.osz')) {
                        const extractedCharts = await this._extractOszFile(file);
                        chartData.push(...extractedCharts);
                    } else {
                        chartData.push(file.content);
                    }
                }

                if (chartData.length === 0) {
                    this._showToast('No valid charts found');
                    return;
                }

                // Train with format specification
                this.autoMapper.trainFromCharts(chartData, formatLower);
                await this.autoMapper.saveTrainedModel();
                this._showToast(`✓ AI trained from ${chartData.length} ${formatLower} charts!`);
                this._updateTrainingStatus();
            } catch (error) {
                this._showToast(`Error: Failed to train from ${formatLower} format`);
            }
        } else {
            // Fallback for browser mode
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;

            // Set appropriate file extensions
            if (formatLower === 'osu' || formatLower === 'osumania') {
                input.accept = '.osu,.osz';
            } else if (formatLower === 'stepmania' || formatLower === 'sm') {
                input.accept = '.sm';
            } else if (formatLower === 'bms' || formatLower === 'bme') {
                input.accept = '.bms,.bme';
            } else {
                input.accept = '.json';
            }

            input.onchange = async (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;

                this._showToast(`Loading ${files.length} ${formatLower} charts...`);

                try {
                    const chartData = [];

                    for (const file of files) {
                        // Handle .osz files (ZIP archives)
                        if (file.name.endsWith('.osz')) {
                            const extractedCharts = await this._extractOszFile(file);
                            chartData.push(...extractedCharts);
                        } else {
                            const text = await file.text();
                            chartData.push(text);
                        }
                    }

                    if (chartData.length === 0) {
                        this._showToast('No valid charts found');
                        return;
                    }

                    // Train with format specification
                    this.autoMapper.trainFromCharts(chartData, formatLower);
                    await this.autoMapper.saveTrainedModel();
                    this._showToast(`✓ AI trained from ${chartData.length} ${formatLower} charts!`);
                    this._updateTrainingStatus();
                } catch (error) {
                    this._showToast(`Error: Failed to train from ${formatLower} format`);
                }
            };

            input.click();
        }
    }

    /**
     * Update training status display
     */
    _updateTrainingStatus() {
        const statusEl = document.getElementById('training-status');
        if (!statusEl) return;

        if (!this.autoMapper || !this.autoMapper.trainedModel) {
            statusEl.textContent = 'No trained model';
            statusEl.style.color = '#64748b';
            return;
        }

        const model = this.autoMapper.trainedModel;
        const transitionCount = model.zoneTransitions.size;
        const patternCount = model.patternFrequency.size;
        const difficultyCount = Object.keys(model.difficultyScaling).length;

        statusEl.innerHTML = `
            <strong style="color: #10b981;">✓ Model Trained</strong><br>
            ${transitionCount} transitions<br>
            ${patternCount} patterns<br>
            ${difficultyCount} difficulties
        `;
        statusEl.style.color = '#94a3b8';
    }

    /**
     * Extract .osu files from .osz archive (ZIP format)
     */
    async _extractOszFile(oszFile) {
        try {
            // Check if JSZip is available
            if (typeof JSZip === 'undefined') {
                this._showToast('Error: ZIP library not loaded. Please refresh the page.');
                return [];
            }

            const zip = new JSZip();
            const zipData = await zip.loadAsync(oszFile);
            const osuFiles = [];

            // Iterate through all files in the ZIP
            for (const [filename, file] of Object.entries(zipData.files)) {
                // Check if it's a .osu file and not a directory
                if (filename.toLowerCase().endsWith('.osu') && !file.dir) {
                    const content = await file.async('text');

                    // Verify it's actually an osu file by checking for osu file format marker
                    if (content.includes('osu file format') || content.includes('[General]')) {
                        osuFiles.push(content);
                    } else {
                    }
                }
            }
            return osuFiles;
        } catch (error) {
            this._showToast(`Error extracting ${oszFile.name}: ${error.message}`);
            return [];
        }
    }
}
