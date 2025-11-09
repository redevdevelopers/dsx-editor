import { ChartData } from './chartData.js';
import { Gameplay } from './gameplay.js';
import { InputHandler } from './input.js';
import { Timeline } from './timeline.js';
import { CommandManager } from './commandManager.js';
import { AudioAnalyzer } from './audioAnalyzer.js'; // Import AudioAnalyzer

export class ChartEditor {
    constructor() {
        this.element = document.createElement('div');
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
                bpm: {
                    init: 120,
                    min: 120,
                    max: 120
                },
                preview: {
                    start: 0,
                    duration: 15000
                },
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
        this.commandManager = new CommandManager(); // Initialize CommandManager

        this._render();
        this._setupRecording();

        this.gameplay = new Gameplay({ parent: this.gameplayContainer, input: this.input });
        this.timeline = new Timeline({
            chartData: this._chartData,
            parent: this.timelineContainer,
            audioPlayer: this.audioPlayer,
            onNoteSelected: this._onNoteSelected.bind(this),
            gameplay: this.gameplay,
            selectedNoteType: this.selectedNoteType,
            commandManager: this.commandManager, // Pass CommandManager
            audioBuffer: null // Will be set when audio is loaded
        });

        this.selectedNoteType = 'regular'; // Default selected note type
    }

    getElement() {
        return this.element;
    }

    _render() {
        this.element.innerHTML = `
            <div class="editor-container">
                <div class="editor-main-layout">
                    <div class="editor-sidebar">
                        <div class="editor-toolbar">
                            <button class="button" id="record-btn">Record (F4)</button>
                            <button class="button ghost" id="export-btn">Export Chart</button>
                            <button class="button ghost" id="import-btn">Import Chart</button>
                            <button class="button ghost" id="zoom-in-btn">+</button>
                            <button class="button ghost" id="zoom-out-btn">-</button>
                            <button class="button ghost" id="undo-btn">Undo</button>
                            <button class="button ghost" id="redo-btn">Redo</button>
                            <button class="button" id="simulate-btn">Simulate Play</button>
                        </div>
                        <div class="editor-settings panel">
                            <h3>Editor Settings</h3>
                            <div>
                                <label for="bpm-input">BPM:</label>
                                <input type="number" id="bpm-input" value="120">
                            </div>
                            <div>
                                <label for="offset-input">Offset (ms):</label>
                                <input type="number" id="offset-input" value="0">
                            </div>
                            <div>
                                <label for="audio-input">Audio:</label>
                                <input type="file" id="audio-input" accept=".mp3">
                            </div>
                            <div>
                                <input type="checkbox" id="snap-toggle" checked>
                                <label for="snap-toggle">Snap to Beat</label>
                            </div>
                            <div>
                                <label for="snap-division">Snap Division:</label>
                                <select id="snap-division">
                                    <option value="1">1/1</option>
                                    <option value="2">1/2</option>
                                    <option value="4" selected>1/4</option>
                                    <option value="8">1/8</option>
                                    <option value="16">1/16</option>
                                </select>
                            </div>
                            <div>
                                <label for="loop-start">Loop Start (ms):</label>
                                <input type="number" id="loop-start" value="0">
                            </div>
                            <div>
                                <label for="loop-end">Loop End (ms):</label>
                                <input type="number" id="loop-end" value="0">
                            </div>
                            <button class="button ghost" id="toggle-loop-btn">Toggle Loop</button>
                        </div>
                        <div id="note-palette" class="panel">
                            <h3>Note Palette</h3>
                            <button class="button primary" id="note-type-regular" data-note-type="regular">Regular</button>
                            <button class="button ghost" id="note-type-hold" data-note-type="hold">Hold</button>
                            <button class="button ghost" id="note-type-chain" data-note-type="chain">Chain</button>
                            <button class="button ghost" id="note-type-multi" data-note-type="multi">Multi</button>
                        </div>
                        <div id="note-properties-panel" class="panel" style="display: none;">
                            <h3>Selected Note Properties</h3>
                            <div>
                                <label for="note-time">Time (ms):</label>
                                <input type="number" id="note-time">
                            </div>
                            <div>
                                <label for="note-zone">Zone:</label>
                                <input type="number" id="note-zone" min="0" max="3">
                            </div>
                            <!-- Add more properties here as needed, e.g., duration for hold notes -->
                        </div>
                    </div>
                    <div class="editor-content">
                        <div id="timeline-container" style="width: 100%; height: 200px;"></div>
                        <div id="gameplay-container">
                            <div id="countdown"></div>
                        </div>
                        <audio id="audio-player"></audio>
                    </div>
                </div>
            </div>
        `;

        this.gameplayContainer = this.element.querySelector('#gameplay-container');
        this.timelineContainer = this.element.querySelector('#timeline-container');
        this.recordBtn = this.element.querySelector('#record-btn');
        this.exportBtn = this.element.querySelector('#export-btn');
        this.bpmInput = this.element.querySelector('#bpm-input');
        this.audioInput = this.element.querySelector('#audio-input');
        this.audioPlayer = this.element.querySelector('#audio-player');
        this.snapToggle = this.element.querySelector('#snap-toggle');
        this.snapDivisionSelect = this.element.querySelector('#snap-division');
                this.notePropertiesPanel = this.element.querySelector('#note-properties-panel');
        this.noteTimeInput = this.element.querySelector('#note-time');
        this.noteZoneInput = this.element.querySelector('#note-zone');
        this.zoomInBtn = this.element.querySelector('#zoom-in-btn');
        this.zoomOutBtn = this.element.querySelector('#zoom-out-btn');
        this.undoBtn = this.element.querySelector('#undo-btn');
        this.redoBtn = this.element.querySelector('#redo-btn');
        this.offsetInput = this.element.querySelector('#offset-input');
        this.importBtn = this.element.querySelector('#import-btn');
        this.loopStartInput = this.element.querySelector('#loop-start');
        this.loopEndInput = this.element.querySelector('#loop-end');
        this.toggleLoopBtn = this.element.querySelector('#toggle-loop-btn');
        this.simulateBtn = this.element.querySelector('#simulate-btn');

        this.noteTypeButtons = this.element.querySelectorAll('#note-palette .button');
        this.noteTypeButtons.forEach(button => {
            button.addEventListener('click', (e) => this._selectNoteType(e.target.dataset.noteType));
        });

        this.recordBtn.addEventListener('click', () => this._toggleRecording());
        this.exportBtn.addEventListener('click', () => this._exportChart());
        this.importBtn.addEventListener('click', () => this._importChart());
        this.bpmInput.addEventListener('change', () => this._updateBpm());
        this.offsetInput.addEventListener('change', () => this._updateOffset());
        this.audioInput.addEventListener('change', () => this._loadAudio());
        this.snapToggle.addEventListener('change', () => this.timeline.snapEnabled = this.snapToggle.checked);
        this.snapDivisionSelect.addEventListener('change', () => this.timeline.snapDivision = parseInt(this.snapDivisionSelect.value));
        this.noteTimeInput.addEventListener('change', (e) => this._updateSelectedNoteProperty('time', parseFloat(e.target.value)));
        this.noteZoneInput.addEventListener('change', (e) => this._updateSelectedNoteProperty('zone', parseInt(e.target.value)));
        this.zoomInBtn.addEventListener('click', () => this.timeline.setZoom(this.timeline.zoom * 1.2));
        this.zoomOutBtn.addEventListener('click', () => this.timeline.setZoom(this.timeline.zoom * 0.8));
        this.undoBtn.addEventListener('click', () => {
            this.commandManager.undo();
            this.timeline.update();
            this._onNoteSelected(null); // Clear selection after undo/redo
        });
        this.redoBtn.addEventListener('click', () => {
            this.commandManager.redo();
            this.timeline.update();
            this._onNoteSelected(null); // Clear selection after undo/redo
        });
        this.toggleLoopBtn.addEventListener('click', () => this._toggleLoop());
        this.loopStartInput.addEventListener('change', (e) => this.loopStart = parseFloat(e.target.value));
        this.loopEndInput.addEventListener('change', (e) => this.loopEnd = parseFloat(e.target.value));
        this.simulateBtn.addEventListener('click', () => this._toggleSimulation());

        this.isLooping = false;
        this.loopStart = 0;
        this.loopEnd = 0;
        this.isSimulating = false;

        this.audioPlayer.addEventListener('timeupdate', () => {
            if (this.isLooping && this.audioPlayer.currentTime * 1000 >= this.loopEnd) {
                this.audioPlayer.currentTime = this.loopStart / 1000;
            }
        });

        window.addEventListener('keydown', this._handleKeyDown.bind(this));

        // Disable right-click context menu for the entire editor element
        this.element.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }

    _handleKeyDown(e) {
        // Prevent default browser shortcuts for common keys
        if ([' ', 'Backspace', 'Delete', 'z', 'y', 's', 'l', '+', '-'].includes(e.key)) {
            e.preventDefault();
        }

        switch (e.key) {
            case 'z': // Ctrl+Z for undo
                if (e.ctrlKey) {
                    this.commandManager.undo();
                    this.timeline.update();
                    this._onNoteSelected(null);
                }
                break;
            case 'y': // Ctrl+Y for redo
                if (e.ctrlKey) {
                    this.commandManager.redo();
                    this.timeline.update();
                    this._onNoteSelected(null);
                }
                break;
            case 's': // Toggle snap
                this.snapToggle.checked = !this.snapToggle.checked;
                this.timeline.snapEnabled = this.snapToggle.checked;
                break;
            case 'l': // Toggle loop
                this._toggleLoop();
                break;
            case '+': // Zoom In
                this.timeline.setZoom(this.timeline.zoom * 1.2);
                break;
            case '-': // Zoom Out
                this.timeline.setZoom(this.timeline.zoom * 0.8);
                break;
            // The Timeline class handles note deletion directly.
            // No need for duplicate logic here.
            // Add more shortcuts as needed
        }
    }

    _selectNoteType(type) {
        this.selectedNoteType = type;
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
            this._chartData.processTimingData(); // Recalculate beat map with new offset
            this.timeline.update(); // Update timeline with new offset
        }
    }

    _toggleLoop() {
        this.isLooping = !this.isLooping;
        if (this.isLooping) {
            this.toggleLoopBtn.classList.add('primary');
            this.toggleLoopBtn.classList.remove('ghost');
            if (this.audioPlayer.currentTime * 1000 < this.loopStart || this.audioPlayer.currentTime * 1000 >= this.loopEnd) {
                this.audioPlayer.currentTime = this.loopStart / 1000;
            }
            this.audioPlayer.play();
        } else {
            this.toggleLoopBtn.classList.remove('primary');
            this.toggleLoopBtn.classList.add('ghost');
        }
    }

    _toggleSimulation() {
        this.isSimulating = !this.isSimulating;
        if (this.isSimulating) {
            this.simulateBtn.classList.add('primary');
            this.simulateBtn.classList.remove('ghost');
            this.audioPlayer.currentTime = 0;
            this.audioPlayer.play();
            // Reset simulatedHit flag for all notes
            this._chartData.raw.notes.forEach(note => {
                note.simulatedHit = false;
            });
            this._updateTimelineIndicator();
        } else {
            this.simulateBtn.classList.remove('primary');
            this.simulateBtn.classList.add('ghost');
            this.audioPlayer.pause();
            cancelAnimationFrame(this.timelineIndicatorRAF);
        }
    }

    _onNoteSelected(note) {
        this.selectedNote = note;
        if (note) {
            this.notePropertiesPanel.style.display = 'block';
            this.noteTimeInput.value = note.time.toFixed(2);
            this.noteZoneInput.value = note.zone;
        } else {
            this.notePropertiesPanel.style.display = 'none';
        }
    }

    _updateSelectedNoteProperty(property, value) {
        if (this.selectedNote) {
            this.selectedNote[property] = value;
            this._chartData.raw.notes.sort((a, b) => a.time - b.time); // Re-sort after time change
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
            this._chartData.processTimingData(); // Recalculate beat map
            this.timeline.update(); // Update timeline with new BPM
        }
    }

    async _loadAudio() {
        const file = this.audioInput.files[0];
        if (file) {
            this.audioPlayer.src = URL.createObjectURL(file);
            this._chart.meta.title = file.name.replace('.mp3', '');

            // Decode audio for waveform visualization
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await AudioAnalyzer.decodeAudioData(audioContext, arrayBuffer);
            this.timeline.waveformRenderer.loadAudioBuffer(audioBuffer);
            console.assert(typeof this.timeline.createGrid === 'function', "ChartEditor: this.timeline.createGrid is not a function in _loadAudio!");
            this.timeline.createGrid(); // Redraw grid to show waveform
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
            this._startCountdown().then(() => {
                this._startRecording();
            });
        } else {
            this._stopRecording();
        }
    }

    _startCountdown() {
        return new Promise(resolve => {
            const countdownElement = this.element.querySelector('#countdown');
            let count = 3;

            const countdownInterval = setInterval(() => {
                if (count > 0) {
                    countdownElement.textContent = count;
                    countdownElement.style.opacity = 1;
                    setTimeout(() => {
                        countdownElement.style.opacity = 0;
                    }, 800);
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
        this.recordBtn.textContent = 'Stop Recording (F4)';
        this.recordBtn.classList.add('primary');
        this.recordBtn.classList.remove('ghost');
        this._chart.notes = [];
        this.startTime = performance.now();
        this.audioPlayer.currentTime = 0;
        this.audioPlayer.play();
        this.gameplay.start();
        this._recordLoop();
        this._updateTimelineIndicator();
    }

    _stopRecording() {
        this.recordBtn.textContent = 'Record (F4)';
        this.recordBtn.classList.remove('primary');
        this.recordBtn.classList.add('ghost');
        this.audioPlayer.pause();
        this.gameplay.stop();
        cancelAnimationFrame(this.timelineIndicatorRAF);
        this._exportChart();
    }

    _recordLoop() {
        if (!this.isRecording) {
            return;
        }

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
            // Simple hit window for simulation (e.g., +/- 100ms)
            const hitWindow = 100;
            this._chartData.raw.notes.forEach(note => {
                if (note.time >= currentTime - hitWindow && note.time <= currentTime + hitWindow && !note.simulatedHit) {
                    this.gameplay.showHit(note.zone);
                    note.simulatedHit = true; // Mark note as hit to avoid re-triggering
                }
            });
        }

        this.timelineIndicatorRAF = requestAnimationFrame(this._updateTimelineIndicator);
    }

    _exportChart() {
        const chartData = {
            ...this._chart,
            keybinds: this.input.getMappings()
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chartData, null, 2));
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
                        // Basic validation
                        if (importedChart.meta && importedChart.timing && importedChart.notes) {
                            this._chart = importedChart;
                            this._chartData = new ChartData(this._chart);
                            this.timeline._chartData = this._chartData; // Update timeline's chartData reference
                            this.timeline.drawNotes();
                            console.assert(typeof this.timeline.createGrid === 'function', "ChartEditor: this.timeline.createGrid is not a function in _importChart!");
                            this.timeline.createGrid();
                            this.bpmInput.value = this._chart.meta.bpm.init;
                            this.offsetInput.value = this._chart.timing.offset;
                            this._onNoteSelected(null); // Clear any selected note
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