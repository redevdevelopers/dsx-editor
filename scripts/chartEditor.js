import { ChartData } from './chartData.js';
import { Gameplay } from './gameplay.js';
import { InputHandler } from './input.js';

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

        this._render();
        this._setupRecording();

        this.gameplay = new Gameplay({ parent: this.gameplayContainer, input: this.input });
    }

    getElement() {
        return this.element;
    }

    _render() {
        this.element.innerHTML = `
            <div class="editor-container">
                <div class="editor-main">
                    <div class="editor-toolbar">
                        <button class="button" id="record-btn">Record (F4)</button>
                        <button class="button ghost" id="export-btn">Export to Console</button>
                    </div>
                    <div class="editor-settings">
                        <div>
                            <label for="bpm-input">BPM:</label>
                            <input type="number" id="bpm-input" value="120">
                        </div>
                        <div>
                            <label for="audio-input">Audio:</label>
                            <input type="file" id="audio-input" accept=".mp3">
                        </div>
                    </div>
                    <div id="gameplay-container">
                        <div id="countdown"></div>
                    </div>
                    <audio id="audio-player"></audio>
                </div>
            </div>
        `;

        this.gameplayContainer = this.element.querySelector('#gameplay-container');
        this.recordBtn = this.element.querySelector('#record-btn');
        this.exportBtn = this.element.querySelector('#export-btn');
        this.bpmInput = this.element.querySelector('#bpm-input');
        this.audioInput = this.element.querySelector('#audio-input');
        this.audioPlayer = this.element.querySelector('#audio-player');

        this.recordBtn.addEventListener('click', () => this._toggleRecording());
        this.exportBtn.addEventListener('click', () => this._exportChart());
        this.bpmInput.addEventListener('change', () => this._updateBpm());
        this.audioInput.addEventListener('change', () => this._loadAudio());
    }

    _updateBpm() {
        const bpm = parseFloat(this.bpmInput.value);
        if (!isNaN(bpm)) {
            this._chart.timing.bpmChanges = [{ time: 0, bpm: bpm }];
            this._chart.meta.bpm.init = bpm;
            this._chart.meta.bpm.min = bpm;
            this._chart.meta.bpm.max = bpm;
        }
    }

    _loadAudio() {
        const file = this.audioInput.files[0];
        if (file) {
            this.audioPlayer.src = URL.createObjectURL(file);
            this._chart.meta.title = file.name.replace('.mp3', '');
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
    }

    _stopRecording() {
        this.recordBtn.textContent = 'Record (F4)';
        this.recordBtn.classList.remove('primary');
        this.recordBtn.classList.add('ghost');
        this.audioPlayer.pause();
        this.gameplay.stop();
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

        requestAnimationFrame(() => this._recordLoop());
    }

    _exportChart() {
        const chartData = {
            ...this._chart,
            keybinds: this.input.getMappings()
        };
        console.log(JSON.stringify(chartData, null, 2));
    }
}