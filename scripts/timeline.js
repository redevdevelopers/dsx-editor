import { AddNoteCommand, DeleteNoteCommand, MoveNoteCommand } from './commandManager.js';
import { WaveformRenderer } from './waveformRenderer.js'; // Import WaveformRenderer

export function Timeline(options) {
    this._chartData = options.chartData;
    this.parent = options.parent;
    this.audioPlayer = options.audioPlayer;
    this.onNoteSelected = options.onNoteSelected;
    this.gameplay = options.gameplay;
    this.selectedNoteType = options.selectedNoteType;
    this.commandManager = options.commandManager;
    this.audioBuffer = options.audioBuffer;
        console.log("PIXI object in Timeline constructor:", PIXI); // Added for debugging

        console.assert(typeof this.createGrid === 'function', "Timeline.createGrid is not a function in constructor!");

        this.app = new PIXI.Application({
            backgroundColor: 0x1a1a1a,
            resizeTo: this.parent,
        });
        this.parent.appendChild(this.app.view);

        this.container = new PIXI.Container();
        this.app.stage.addChild(this.container);

        this.zoom = 1; // pixels per millisecond
        this.offset = 0; // in pixels

        this.selectedNote = null;
        this.noteGraphics = new Map(); // Moved initialization here
        this.isDragging = false;
        this.snapEnabled = true; // New property for snap toggle
        this.snapDivision = 4; // 1/4 beat snapping by default
        this.currentTimeIndicator = new PIXI.Graphics(); // Moved initialization here
        this.notesHit = new Set(); // Moved initialization here

        this.isDraggingTimeline = false; // New flag for timeline dragging
        this.lastPointerX = 0; // New property for timeline dragging

        this.isScrubbing = false;
        this.wasPlayingBeforeScrub = false;

        this.waveformRenderer = new WaveformRenderer(this.app, this.container); // Instantiate WaveformRenderer
        if (this.audioBuffer) {
            this.waveformRenderer.loadAudioBuffer(this.audioBuffer); // Load audio buffer if provided
        }

        this.gridGraphics = new PIXI.Graphics(); // Initialize gridGraphics
        this.container.addChild(this.gridGraphics); // Add gridGraphics to container

        this.createGrid();
        this.createNotes();

        this.app.view.addEventListener('wheel', this.onWheel.bind(this));
        this.app.view.addEventListener('click', this.onClick.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        
        // Disable right-click context menu on the PIXI canvas
        this.app.view.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });

        // Removed: this.app.view.addEventListener('pointerdown', this.onTimelinePointerDown); // New: for timeline dragging
        
        this.container.addChild(this.currentTimeIndicator); // Add to container after initialization
        this.currentTimeIndicator.interactive = true;
        this.currentTimeIndicator.buttonMode = true;
        this.currentTimeIndicator.on('pointerdown', this.onScrubStart.bind(this));
        this.drawCurrentTimeIndicator(0);
        } // Closing brace for export function Timeline(options)
        
        Timeline.prototype.createGrid = function() {
            this.gridGraphics.clear();
            this.gridGraphics.lineStyle(1, 0x333333, 0.5); // Darker grid lines
        
            const screenWidth = this.app.screen.width;
            const screenHeight = this.app.screen.height;
        
            // Draw waveform first
            this.waveformRenderer.draw(this.offset, this.zoom);
        
            // Draw vertical lines (beats)
            const msPerBeat = 60000 / this._chartData.getBPMAtTime(0); // Assuming constant BPM for grid
            const beatIntervalPx = msPerBeat * this.zoom;
            const startTimeMs = this.offset / this.zoom;

            // Find the time of the first beat
            const firstVisibleBeatNumber = Math.floor(startTimeMs / msPerBeat);
            const firstVisibleBeatTime = firstVisibleBeatNumber * msPerBeat;

            // Calculate the screen position of the first beat
            let x = (firstVisibleBeatTime * this.zoom) - this.offset;

            // Draw all visible beats
            while (x < this.app.screen.width) {
                if (x >= 0) { // Ensure we don't draw off-screen to the left
                    this.gridGraphics.moveTo(x, 0);
                    this.gridGraphics.lineTo(x, this.app.screen.height);
                }
                x += beatIntervalPx;
            }
        
            // Draw horizontal lines (zones)
            for (let i = 0; i < 4; i++) { // Assuming 4 zones
                const y = i * 30; // 30 pixels per zone
                this.gridGraphics.moveTo(0, y);
                this.gridGraphics.lineTo(screenWidth, y);
            }
        };
        
        Timeline.prototype.createNotes = function() {
            // This method seems to be missing or incomplete.
            // It should iterate through this._chartData.raw.notes and create PIXI.Graphics objects for each.
            // It should also attach event listeners for interaction.
        };

Timeline.prototype.drawNotes = function() {
    console.log("drawNotes: Number of notes to draw:", this._chartData.raw.notes.length);
    // Clear existing note graphics from the container
    for (const graphic of this.noteGraphics.values()) {
        this.container.removeChild(graphic);
        graphic.destroy(); // Clean up PIXI resources
    }
    this.noteGraphics.clear();

    const zoneColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00]; // Red, Green, Blue, Yellow

    this._chartData.raw.notes.forEach(note => {
        const x = (note.time * this.zoom) - this.offset;
        const y = note.zone * 30; // 30 pixels per zone

        const noteGraphic = new PIXI.Graphics();
        noteGraphic.beginFill(zoneColors[note.zone % zoneColors.length]);
        noteGraphic.drawRect(0, 0, 20, 20); // Note size
        noteGraphic.endFill();

        noteGraphic.x = x;
        noteGraphic.y = y;

        noteGraphic.interactive = true;
        noteGraphic.buttonMode = true;

        noteGraphic.on('pointerdown', (event) => this.onNotePointerDown(event, note, noteGraphic));

        this.container.addChild(noteGraphic);
        this.noteGraphics.set(note, noteGraphic);

        // Highlight if selected
        if (this.selectedNote === note) {
            this.highlightNote(noteGraphic);
        }
    });
};

Timeline.prototype.onTimelinePointerDown = function(event) {
    if (event.button === 0) { // Left-click only for dragging timeline
        this.isDraggingTimeline = true;
        this.lastPointerX = event.clientX;
        this.app.view.addEventListener('pointermove', this.onTimelinePointerMove.bind(this));
        this.app.view.addEventListener('pointerup', this.onTimelinePointerUp.bind(this));
    }
};

Timeline.prototype.onTimelinePointerUp = function() {
    this.isDraggingTimeline = false;
    this.app.view.removeEventListener('pointermove', this.onTimelinePointerMove.bind(this));
    this.app.view.removeEventListener('pointerup', this.onTimelinePointerUp.bind(this));
};

Timeline.prototype.onTimelinePointerMove = function(event) {
    if (this.isDraggingTimeline) {
        const currentPointerX = event.clientX;
        const deltaX = currentPointerX - this.lastPointerX;
        this.offset -= deltaX;
        this.offset = Math.max(0, this.offset); // Prevent dragging past the beginning
        this.lastPointerX = currentPointerX;

        this.createGrid();
        this.drawNotes();
        this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);
    }
};

Timeline.prototype.onNotePointerDown = function(event, note, noteGraphic) {
    console.log("Note clicked:", note, "Button:", event.button, "Selected Note before:", this.selectedNote);

    if (event.button === 2) { // Right-click
        event.stopPropagation();
        event.preventDefault(); // Prevent context menu
        console.log("Right-click detected, attempting to delete note:", note);
        this.commandManager.execute(new DeleteNoteCommand(this._chartData, note));
        this.selectedNote = null;
        if (this.onNoteSelected) {
            this.onNoteSelected(null);
        }
        this.drawNotes();
        console.log("Note deleted via right-click. Selected Note after:", this.selectedNote);
        return;
    }

    event.stopPropagation(); // Prevent timeline click event

    // Single-click: select note
    if (this.selectedNote && this.selectedNote !== note) {
        // Deselect previous note
        const prevGraphic = this.noteGraphics.get(this.selectedNote);
        if (prevGraphic) {
            const zoneColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00];
            prevGraphic.clear();
            prevGraphic.beginFill(zoneColors[this.selectedNote.zone % zoneColors.length]);
            prevGraphic.drawRect(0, 0, 20, 20);
            prevGraphic.endFill();
        }
    }
    this.selectedNote = note;
    this.highlightNote(noteGraphic);
    if (this.onNoteSelected) {
        this.onNoteSelected(note);
    }
    console.log("Note selected:", this.selectedNote);

    // Initiate drag on single left-click
    this.isDragging = true;
    this.app.view.addEventListener('pointermove', this.onNotePointerMove.bind(this));
    this.app.view.addEventListener('pointerup', this.onNotePointerUp.bind(this));
};

Timeline.prototype.onNotePointerMove = function(event) {
    if (this.isDragging && this.selectedNote) {
        const pxToMs = (px) => (px + this.offset) / this.zoom; // Corrected pxToMs
        let newTime = pxToMs(event.offsetX); // Use offsetX
        let newZone = Math.floor(event.offsetY / 30); // Use offsetY

        if (this.snapEnabled) {
            newTime = this.snapToBeat(newTime);
        }

        newZone = Math.max(0, Math.min(5, newZone)); // Clamp zone (0-5 for 6 zones)

        // Only execute command if position actually changed
        if (this.selectedNote.time !== newTime || this.selectedNote.zone !== newZone) {
            const oldTime = this.selectedNote.time;
            const oldZone = this.selectedNote.zone;
            this.commandManager.execute(new MoveNoteCommand(this._chartData, this.selectedNote, oldTime, oldZone, newTime, newZone));
            this.drawNotes();
            if (this.onNoteSelected) {
                this.onNoteSelected(this.selectedNote); // Update panel during drag
            }
        }
    }
};

Timeline.prototype.onNotePointerUp = function() {
    this.isDragging = false;
    this.app.view.removeEventListener('pointermove', this.onNotePointerMove.bind(this));
    this.app.view.removeEventListener('pointerup', this.onNotePointerUp.bind(this));
    this._chartData.raw.notes.sort((a, b) => a.time - b.time); // Re-sort after moving
    this.drawNotes();
    // Do not reset lastClickTime here, it's handled in onNotePointerDown for double-click detection
};

Timeline.prototype.onClick = function(event) {
    // Use a small timeout to prevent this from firing immediately after a scrub action ends.
    // A better solution is a more robust state management, but this is a simple fix.
    if (this.isScrubbing) return;

    console.log("Timeline background clicked. Selected Note before:", this.selectedNote);
    // If a note was clicked, onNoteClick would have stopped propagation
    // So if we reach here, it's a click on the timeline background
    if (this.selectedNote) {
        const prevGraphic = this.noteGraphics.get(this.selectedNote);
        if (prevGraphic) {
            const zoneColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00];
            prevGraphic.clear();
            prevGraphic.beginFill(zoneColors[this.selectedNote.zone % zoneColors.length]);
            prevGraphic.drawRect(0, 0, 20, 20);
            prevGraphic.endFill();
        }
    }
    this.selectedNote = null;
    if (this.onNoteSelected) {
        this.onNoteSelected(null);
    }
    this.drawNotes(); // Redraw to remove selection highlight
    console.log("Note deselected via background click. Selected Note after:", this.selectedNote);
    
    const pxToMs = (px) => (px + this.offset) / this.zoom;
    let time = pxToMs(event.offsetX);
    const zone = Math.floor(event.offsetY / 30); // Calculate zone based on Y position

    if (this.snapEnabled) {
        time = this.snapToBeat(time);
    }

    if (zone >= 0 && zone < 6) { // Assuming 6 zones
        const newNote = { time: time, zone: zone, type: this.selectedNoteType };
        this.commandManager.execute(new AddNoteCommand(this._chartData, newNote));
        this.drawNotes();
        this.selectedNote = newNote; // Select the newly created note
        if (this.onNoteSelected) {
            this.onNoteSelected(newNote);
        }
        console.log("New note added and selected:", newNote);
    }
};

Timeline.prototype.getTimeFromPointer = function(event) {
    // event is a DOM PointerEvent on the canvas
    return (event.offsetX + this.offset) / this.zoom;
};

Timeline.prototype.onScrubStart = function(event) {
    // Stop propagation to prevent the timeline's onClick from firing
    event.stopPropagation();

    this.isScrubbing = true;

    // Bind these methods to `this` ONCE and store them, so they can be removed.
    this._boundScrubMove = this.onScrubMove.bind(this);
    this._boundScrubEnd = this.onScrubEnd.bind(this);

    this.app.view.addEventListener('pointermove', this._boundScrubMove);
    this.app.view.addEventListener('pointerup', this._boundScrubEnd);
    this.app.view.addEventListener('pointerupoutside', this._boundScrubEnd);

    // The event from PIXI is a wrapper, we need the original DOM event for offsetX
    if (event.data && event.data.originalEvent) {
        this.onScrubMove(event.data.originalEvent);
    }
};

Timeline.prototype.onScrubMove = function(event) {
    if (!this.isScrubbing) return;

    // Prevent default browser actions, like text selection, during drag
    event.preventDefault();

    const newTime = this.getTimeFromPointer(event);
    if (this.audioPlayer && newTime >= 0 && newTime <= this.audioPlayer.duration * 1000) {
        this.audioPlayer.currentTime = newTime / 1000;
        this.drawCurrentTimeIndicator(newTime);
    }
};

Timeline.prototype.onScrubEnd = function(event) {
    if (!this.isScrubbing) return;
    
    event.preventDefault();

    this.isScrubbing = false;

    this.app.view.removeEventListener('pointermove', this._boundScrubMove);
    this.app.view.removeEventListener('pointerup', this._boundScrubEnd);
    this.app.view.removeEventListener('pointerupoutside', this._boundScrubEnd);
};

Timeline.prototype.onWheel = function(event) {
    event.preventDefault();
    if (event.ctrlKey) {
        // Zoom
        const zoomFactor = 1.1;
        const oldZoom = this.zoom;
        this.zoom *= event.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
        this.zoom = Math.max(0.01, Math.min(10, this.zoom));

        // Zoom towards mouse pointer
        const mouseX = event.offsetX;
        const chartTimeAtMouse = (this.offset + mouseX) / oldZoom;
        this.offset = chartTimeAtMouse * this.zoom - mouseX;

    } else {
        // Scroll
        this.offset += event.deltaY;
    }
    this.offset = Math.max(0, this.offset);

    this.createGrid();
    this.drawNotes();
    this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);
};

Timeline.prototype.onKeyDown = function(event) {
    console.log("Key down:", event.key, "Selected Note:", this.selectedNote);
    if (event.key === 'Delete' && this.selectedNote) {
        this.commandManager.execute(new DeleteNoteCommand(this._chartData, this.selectedNote));
        this.selectedNote = null;
        if (this.onNoteSelected) {
            this.onNoteSelected(null);
        }
        this.drawNotes();
        console.log("Note deleted via Delete key. Selected Note after:", this.selectedNote);
    }
};

Timeline.prototype.snapToBeat = function(timeInMs) {
    const bpm = this._chartData.getBPMAtTime(timeInMs);
    if (!bpm) return timeInMs;

    const msPerBeat = 60000 / bpm;
    const snapInterval = msPerBeat / this.snapDivision;

    return Math.round(timeInMs / snapInterval) * snapInterval;
};

Timeline.prototype.update = function() {
    // Redraw on chart data change
    this.drawNotes();
};

Timeline.prototype.setZoom = function(newZoom) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.01, Math.min(10, newZoom));

    // Adjust offset to zoom towards the center of the view
    const centerX = this.app.screen.width / 2;
    const chartTimeAtCenter = (this.offset + centerX) / oldZoom;
    this.offset = chartTimeAtCenter * this.zoom - centerX;

    this.createGrid();
    this.drawNotes();
    this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);
};

Timeline.prototype.highlightNote = function(noteGraphic) {
    noteGraphic.lineStyle(2, 0xFFFF00, 1); // Yellow border
    noteGraphic.drawRect(0, 0, 20, 20);
};

Timeline.prototype.drawCurrentTimeIndicator = function(currentTime) {
    this.currentTimeIndicator.clear();
    this.currentTimeIndicator.lineStyle(2, 0xFFFFFF, 1); // White line
    const x = (currentTime * this.zoom) - this.offset;
    this.currentTimeIndicator.moveTo(x, 0);
    this.currentTimeIndicator.lineTo(x, this.app.screen.height);

    // Create a larger, invisible hit area to make it easier to grab
    this.currentTimeIndicator.hitArea = new PIXI.Rectangle(x - 5, 0, 10, this.app.screen.height);
};