export class WaveformRenderer {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        this.waveformGraphic = new PIXI.Graphics();
        this.container.addChild(this.waveformGraphic);

        this.audioBuffer = null;
        this.waveformPoints = []; // Stores downsampled waveform data
        this.height = 100; // Fixed height for the waveform display
    }

    async loadAudioBuffer(audioBuffer) {
        this.audioBuffer = audioBuffer;
        this.waveformPoints = this.downsampleAudioBuffer(audioBuffer);
        this.draw(0, 1); // Redraw with new buffer, reset offset/zoom
    }

    downsampleAudioBuffer(audioBuffer, samples = 8000) {
        const rawData = audioBuffer.getChannelData(0); // Get data from first channel
        const blockSize = Math.floor(rawData.length / samples); // Number of samples in each "block"
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
            const blockStart = blockSize * i;
            let peak = 0;
            for (let j = 0; j < blockSize; j++) {
                const sample = Math.abs(rawData[blockStart + j]);
                if (sample > peak) {
                    peak = sample;
                }
            }
            filteredData.push(peak);
        }
        return filteredData;
    }

    draw(offset, zoom) {
        this.waveformGraphic.clear();
        if (!this.audioBuffer || this.waveformPoints.length === 0) {
            return;
        }

        this.waveformGraphic.lineStyle(1, 0x00FF00, 0.7); // Green waveform, semi-transparent

        const totalDurationMs = this.audioBuffer.duration * 1000;
        const pixelsPerMs = zoom; // This is the zoom level from Timeline
        const waveformWidth = totalDurationMs * pixelsPerMs; // Total width of the waveform in pixels

        const startX = -offset; // Start drawing from this pixel offset

        const centerY = this.app.screen.height / 2; // Center of the timeline view
        const waveformHeight = this.height; // Use the fixed height for the waveform

        this.waveformGraphic.moveTo(startX, centerY);

        for (let i = 0; i < this.waveformPoints.length; i++) {
            const x = startX + (i / this.waveformPoints.length) * waveformWidth;
            const y = centerY - (this.waveformPoints[i] * waveformHeight / 2); // Scale amplitude to waveform height

            // Draw mirrored for a fuller look
            this.waveformGraphic.lineTo(x, y);
        }

        // Draw the bottom half (mirrored)
        this.waveformGraphic.moveTo(startX, centerY);
        for (let i = 0; i < this.waveformPoints.length; i++) {
            const x = startX + (i / this.waveformPoints.length) * waveformWidth;
            const y = centerY + (this.waveformPoints[i] * waveformHeight / 2);
            this.waveformGraphic.lineTo(x, y);
        }
    }
}