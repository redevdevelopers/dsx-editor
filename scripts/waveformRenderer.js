export class WaveformRenderer {
    constructor(app, container) {
        this.app = app;
        this.container = container;
        this.waveformGraphic = new PIXI.Graphics();
        this.container.addChild(this.waveformGraphic);

        this.audioBuffer = null;
        this.waveformPoints = []; // Stores downsampled waveform data
        this.zoneHeight = 30; // Height of a single zone, consistent with Timeline
        this.numZones = 6; // Assuming 6 zones (0-5)
        this.waveformDisplayHeight = this.zoneHeight * this.numZones; // Total height for waveform display
        this.color = '#00FF00'; // Default color
    }

    async loadAudioBuffer(audioBuffer) {
        this.audioBuffer = audioBuffer;
        this.waveformPoints = this.downsampleAudioBuffer(audioBuffer);
        this.draw(0, 1); // Redraw with new buffer, reset offset/zoom
    }

    setColor(color) {
        this.color = color;
        // The timeline will call draw() after this, so no need to redraw here.
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

        this.waveformGraphic.lineStyle(1, this.color, 0.7); // Use dynamic color

        const totalDurationMs = this.audioBuffer.duration * 1000;
        const pixelsPerMs = zoom; // This is the zoom level from Timeline
        const waveformWidth = totalDurationMs * pixelsPerMs; // Total width of the waveform in pixels

        const startX = -offset; // Start drawing from this pixel offset

        // Center the waveform vertically within the total zone display height
        const centerY = this.waveformDisplayHeight / 2;
        const waveformRenderHeight = this.waveformDisplayHeight * 0.8; // Use 80% of the height to make peaks more visible

        this.waveformGraphic.moveTo(startX, centerY);

        for (let i = 0; i < this.waveformPoints.length; i++) {
            const x = startX + (i / this.waveformPoints.length) * waveformWidth;
            const y = centerY - (this.waveformPoints[i] * waveformRenderHeight * 0.5); // Scale amplitude to waveform height

            // Draw mirrored for a fuller look
            this.waveformGraphic.lineTo(x, y);
        }

        // Draw the bottom half (mirrored)
        this.waveformGraphic.moveTo(startX, centerY);
        for (let i = 0; i < this.waveformPoints.length; i++) {
            const x = startX + (i / this.waveformPoints.length) * waveformWidth;
            const y = centerY + (this.waveformPoints[i] * waveformRenderHeight * 0.5);
            this.waveformGraphic.lineTo(x, y);
        }
    }
}