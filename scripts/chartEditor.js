import { ChartData } from './chartData.js';
import { Gameplay } from './gameplay.js';
import { InputHandler } from './input.js';
import { Timeline } from './timeline.js';
import { CommandManager } from './commandManager.js';
import { AudioAnalyzer } from './audioAnalyzer.js';

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
            notes: []
        };
        this._chartData = new ChartData(this._chart);
        this.commandManager = new CommandManager();
        this.selectedNoteType = 'regular';
    }

    init() {
        this._renderToolbar();
        this._renderSidebarPanels();

        this.audioPlayer = document.createElement('audio');
        this.audioPlayer.id = 'audio-player';
        document.body.appendChild(this.audioPlayer);

        this.gameplay = new Gameplay({ parent: this.containers.editor, input: this.input });
        this.timeline = new Timeline({
            chartData: this._chartData,
            parent: this.containers.timeline,
            audioPlayer: this.audioPlayer,
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
    }

    _renderToolbar() {
        this.containers.toolbar.innerHTML = `
            <button class="button ghost" id="import-btn">Import</button>
            <button class="button ghost" id="export-btn">Export</button>
            <div style="width: 20px;"></div>
            <button class="icon-button" id="play-pause-btn" title="Play/Pause (Space)">
                <svg id="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                <svg id="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display: none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
            </button>
            <button class="icon-button" id="record-btn" title="Record (F4)">
                <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"></circle></svg>
            </button>
            <div style="width: 20px;"></div>
            <button class="icon-button" id="undo-btn" title="Undo (Ctrl+Z)">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"></path></svg>
            </button>
            <button class="icon-button" id="redo-btn" title="Redo (Ctrl+Y)">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.96 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"></path></svg>
            </button>
            <div style="width: 20px;"></div>
            <button class="icon-button" id="zoom-in-btn" title="Zoom In (+)">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>
            </button>
            <button class="icon-button" id="zoom-out-btn" title="Zoom Out (-)">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"></path></svg>
            </button>
        `;
    }

    _renderSidebarPanels() {
        this.containers.sidebar.innerHTML = `
            <div class="panel">
                <h3>Editor Settings</h3>
                <label for="bpm-input">BPM:</label>
                <input type="number" id="bpm-input" value="120">
                <label for="offset-input">Offset (ms):</label>
                <input type="number" id="offset-input" value="0">
                <label for="audio-input">Audio:</label>
                <input type="file" id="audio-input" accept=".mp3, .wav, .ogg">
                <div>
                    <input type="checkbox" id="snap-toggle" checked>
                    <label for="snap-toggle">Snap to Beat</label>
                </div>
                <label for="snap-division">Snap Division:</label>
                <select id="snap-division">
                    <option value="1">1/1</option>
                    <option value="2">1/2</option>
                    <option value="4" selected>1/4</option>
                    <option value="8">1/8</option>
                    <option value="16">1/16</option>
                </select>
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
        this.redoBtn = this.containers.toolbar.querySelector('#redo-btn');
        this.playPauseBtn = this.containers.toolbar.querySelector('#play-pause-btn');
        this.playIcon = this.containers.toolbar.querySelector('#play-icon');
        this.pauseIcon = this.containers.toolbar.querySelector('#pause-icon');

        this.bpmInput = this.containers.sidebar.querySelector('#bpm-input');
        this.offsetInput = this.containers.sidebar.querySelector('#offset-input');
        this.audioInput = this.containers.sidebar.querySelector('#audio-input');
        this.snapToggle = this.containers.sidebar.querySelector('#snap-toggle');
        this.snapDivisionSelect = this.containers.sidebar.querySelector('#snap-division');
        this.loopStartInput = this.containers.sidebar.querySelector('#loop-start');
        this.loopEndInput = this.containers.sidebar.querySelector('#loop-end');
        this.toggleLoopBtn = this.containers.sidebar.querySelector('#toggle-loop-btn');
        this.notePropertiesPanel = this.containers.sidebar.querySelector('#note-properties-panel');
        this.noteTimeInput = this.containers.sidebar.querySelector('#note-time');
        this.noteZoneInput = this.containers.sidebar.querySelector('#note-zone');
        this.noteTypeButtons = this.containers.sidebar.querySelectorAll('#note-palette .button');

        const addListener = (el, event, handler) => {
            if (el) {
                el.addEventListener(event, handler);
            } else {
                console.error(`Fucking hell, element not found for event: ${event} on ${el}`);
            }
        };

        addListener(this.recordBtn, 'click', () => this._toggleRecording());
        addListener(this.exportBtn, 'click', () => this._exportChart());
        addListener(this.importBtn, 'click', () => this._importChart());
        addListener(this.bpmInput, 'change', () => this._updateBpm());
        addListener(this.offsetInput, 'change', () => this._updateOffset());
        addListener(this.audioInput, 'change', () => this._loadAudio());
        addListener(this.snapToggle, 'change', () => { if(this.timeline) this.timeline.snapEnabled = this.snapToggle.checked });
        addListener(this.snapDivisionSelect, 'change', () => { if(this.timeline) this.timeline.snapDivision = parseInt(this.snapDivisionSelect.value) });
        addListener(this.noteTimeInput, 'change', (e) => this._updateSelectedNoteProperty('time', parseFloat(e.target.value)));
        addListener(this.noteZoneInput, 'change', (e) => this._updateSelectedNoteProperty('zone', parseInt(e.target.value)));
        addListener(this.zoomInBtn, 'click', () => this.timeline.setZoom(this.timeline.zoom * 1.2));
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
        addListener(this.toggleLoopBtn, 'click', () => this._toggleLoop());
        addListener(this.loopStartInput, 'change', (e) => this.loopStart = parseFloat(e.target.value));
        addListener(this.loopEndInput, 'change', (e) => this.loopEnd = parseFloat(e.target.value));
        addListener(this.playPauseBtn, 'click', () => this._toggleSimulation());

        this.noteTypeButtons.forEach(button => {
            addListener(button, 'click', (e) => this._selectNoteType(e.target.dataset.noteType));
        });

        this.isLooping = false;
        this.loopStart = 0;
        this.loopEnd = 0;
        this.isSimulating = false;

        addListener(this.audioPlayer, 'timeupdate', () => {
            if (this.isLooping && this.audioPlayer.currentTime * 1000 >= this.loopEnd) {
                this.audioPlayer.currentTime = this.loopStart / 1000;
            }
            if (this.audioPlayer.ended && this.isSimulating) {
                this._toggleSimulation();
            }
        });
    }

    _handleKeyDown(e) {
        if ([' ', 'Backspace', 'Delete', 'z', 'y', 's', 'l', '+', '-'].includes(e.key) && document.activeElement.tagName !== 'INPUT') {
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
            this._chartData.raw.notes.forEach(note => note.simulatedHit = false);
            this._updateTimelineIndicator();
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
            this.audioPlayer.pause();
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
        }
    }

    async _loadAudio() {
        const file = this.audioInput.files[0];
        if (file) {
            this.audioPlayer.src = URL.createObjectURL(file);
            this._chart.meta.title = file.name.replace(/\.[^/.]+$/, "");
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await AudioAnalyzer.decodeAudioData(audioContext, arrayBuffer);
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
        }
        this.timeline.update();
        requestAnimationFrame(() => this._recordLoop());
    }

    _updateTimelineIndicator = () => {
        const currentTime = this.audioPlayer.currentTime * 1000;
        this.timeline.drawCurrentTimeIndicator(currentTime);
        if (this.isSimulating) {
            const hitWindow = 100;
            this._chartData.raw.notes.forEach(note => {
                if (Math.abs(note.time - currentTime) < hitWindow / 2 && !note.simulatedHit) {
                    this.gameplay.showHit(note.zone);
                    note.simulatedHit = true;
                }
            });
        }
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