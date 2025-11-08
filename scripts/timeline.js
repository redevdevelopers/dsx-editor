export class Timeline {
    constructor({ canvas, audioPlayer, chartData }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioPlayer = audioPlayer;
        this.chartData = chartData;
        this.waveform = [];

        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.canvas.addEventListener('click', (e) => this._handleCanvasClick(e));
    }

    _handleCanvasClick(e) {
        const { duration } = this.audioPlayer;
        if (!duration) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const timeInSeconds = (x / this.width) * duration;

        if (e.shiftKey) {
            this.audioPlayer.currentTime = timeInSeconds;
        } else {
            const timeInMilliseconds = timeInSeconds * 1000;
            const newNote = {
                time: timeInMilliseconds,
                zone: 0 // Hardcoded for now
            };
            this.chartData.addNote(newNote);
        }
    }

    setWaveform(waveform) {
        this.waveform = waveform;
    }

    _drawWaveform() {
        if (!this.waveform.length) {
            return;
        }

        this.ctx.strokeStyle = '#6ee7b7';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        const centerY = this.height / 2;
        const scale = this.height / 2;

        for (let i = 0; i < this.width; i++) {
            const { min, max } = this.waveform[i];
            const x = i;
            const yMin = centerY + min * scale;
            const yMax = centerY + max * scale;

            this.ctx.moveTo(x, yMin);
            this.ctx.lineTo(x, yMax);
        }

        this.ctx.stroke();
    }

    _drawPlayhead() {
        const { currentTime, duration } = this.audioPlayer;
        if (!duration) {
            return;
        }

        const x = (currentTime / duration) * this.width;

        this.ctx.strokeStyle = '#ff6fd8';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.height);
        this.ctx.stroke();
    }

    _drawNotes() {
        const { duration } = this.audioPlayer;
        if (!duration) {
            return;
        }

        const notes = this.chartData.getNotes();
        this.ctx.strokeStyle = '#ffff00'; // Yellow for notes
        this.ctx.lineWidth = 1;

        for (const note of notes) {
            const x = (note.time / 1000 / duration) * this.width; // Note time is in ms
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this._drawWaveform();
        this._drawNotes();
        this._drawPlayhead();
    }
}
