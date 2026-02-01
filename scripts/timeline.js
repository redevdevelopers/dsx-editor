import { AddNoteCommand, DeleteNoteCommand, MoveNoteCommand } from './commandManager.js';
import { WaveformRenderer } from './waveformRenderer.js'; // Import WaveformRenderer
export function Timeline(options) {
    this._chartData = options.chartData;
    this.parent = options.parent;
    this.audioPlayer = options.audioPlayer;
    this.onMarkerAction = options.onMarkerAction;
    this.onNoteSelected = options.onNoteSelected;
    this.onZoomChange = options.onZoomChange; // NEW: Callback for zoom changes
    this.gameplay = options.gameplay;
    this.selectedNoteType = options.selectedNoteType;
    this.commandManager = options.commandManager;
    this.audioBuffer = options.audioBuffer;
    this.selectionManager = options.selectionManager; // NEW: Add selection manager// Added for debugging
    // Get initial background color from timeline container's computed style
    const timelineContainerStyle = getComputedStyle(this.parent);
    const bgColor = timelineContainerStyle.backgroundColor;

    // Convert RGB to hex
    let bgColorHex = 0x1a1a1a; // default
    if (bgColor.startsWith('rgb')) {
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            bgColorHex = (parseInt(rgb[0]) << 16) | (parseInt(rgb[1]) << 8) | parseInt(rgb[2]);
        }
    } else if (bgColor.startsWith('#')) {
        bgColorHex = parseInt(bgColor.replace('#', ''), 16);
    }

    this.app = new PIXI.Application({
        backgroundColor: bgColorHex,
        backgroundAlpha: 1,
        clearBeforeRender: true,
        resizeTo: this.parent,
        eventMode: 'static',
    });
    this.parent.appendChild(this.app.view);

    this.container = new PIXI.Container();
    this.container.eventMode = 'static';
    this.container.interactiveChildren = true;
    this.app.stage.addChild(this.container);
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.zoom = 1; // pixels per millisecond
    this.offset = 0; // in pixels

    this.selectedNote = null;
    this.selectedNotes = new Set(); // NEW: Track multiple selected notes
    this.sessionMarkers = []; // For editor-only markers
    this.noteGraphics = new Map(); // Moved initialization here
    this.isDragging = false;
    this.snapEnabled = true; // New property for snap toggle
    this.snapDivision = 4; // 1/4 beat snapping by default
    this.currentTimeIndicator = new PIXI.Graphics(); // Moved initialization here
    this.notesHit = new Set(); // Moved initialization here
    this.temporaryNotes = []; // Buffer for notes currently being recorded

    this.isDraggingTimeline = false; // New flag for timeline dragging
    this.lastPointerX = 0; // New property for timeline dragging

    this.isScrubbing = false;
    this.wasPlayingBeforeScrub = false;
    this.wasDragging = false; // Flag to prevent click after drag

    // Smooth scrolling properties
    this.scrollVelocity = 0;
    this.targetOffset = 0;
    this.isScrolling = false;

    // For precise seeking
    this.isPreciseScrubbing = false;
    this.preciseScrubStartPointerX = 0;
    this.preciseScrubStartTime = 0;

    // Box selection
    this.isBoxSelecting = false;
    this.boxSelectStart = { x: 0, y: 0 };
    this.boxSelectEnd = { x: 0, y: 0 };
    this.boxSelectGraphics = new PIXI.Graphics();
    // Don't add to container yet - will be added on top later

    // Bind box select methods once
    this.boundBoxSelectMove = this.onBoxSelectMove.bind(this);
    this.boundBoxSelectEnd = this.onBoxSelectEnd.bind(this);

    this.waveformRenderer = new WaveformRenderer(this.app, this.container); // Instantiate WaveformRenderer
    if (this.audioBuffer) {
        this.waveformRenderer.loadAudioBuffer(this.audioBuffer); // Load audio buffer if provided
    }

    this.gridGraphics = new PIXI.Graphics(); // Initialize gridGraphics
    this.container.addChild(this.gridGraphics); // Add gridGraphics to container

    this.markerGraphics = new PIXI.Graphics();
    this.container.addChild(this.markerGraphics);

    // Add box select graphics directly to stage (not container) so it's not affected by zoom/offset
    this.app.stage.addChild(this.boxSelectGraphics);
    this.boxSelectGraphics.zIndex = 10000;

    // Create scrollbar
    this.scrollbarContainer = new PIXI.Container();
    this.scrollbarBg = new PIXI.Graphics();
    this.scrollbarThumb = new PIXI.Graphics();
    this.scrollbarContainer.addChild(this.scrollbarBg);
    this.scrollbarContainer.addChild(this.scrollbarThumb);
    this.app.stage.addChild(this.scrollbarContainer);
    this.scrollbarContainer.zIndex = 9999;

    this.scrollbarThumb.eventMode = 'static';
    this.scrollbarThumb.cursor = 'pointer';
    this.isDraggingScrollbar = false;
    this.scrollbarDragStartX = 0;
    this.scrollbarDragStartOffset = 0;

    // Bind scrollbar methods
    this.boundScrollbarMove = this.onScrollbarPointerMove.bind(this);
    this.boundScrollbarUp = this.onScrollbarPointerUp.bind(this);

    this.createGrid();
    this.createNotes();
    this.updateScrollbar();

    this.app.view.addEventListener('wheel', this.onWheel.bind(this));
    this.app.view.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));

    // Disable right-click context menu on the PIXI canvas
    this.app.view.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });

    // Removed: this.app.view.addEventListener('pointerdown', this.onTimelinePointerDown); // New: for timeline dragging

    // Add currentTimeIndicator to stage (not container) so it's not affected by offset
    this.app.stage.addChild(this.currentTimeIndicator);
    this.currentTimeIndicator.eventMode = 'static';
    this.currentTimeIndicator.cursor = 'ew-resize';
    this.currentTimeIndicator.on('pointerdown', this.onScrubStart.bind(this));
    this.drawCurrentTimeIndicator(0);

    // Add scrollbar event listeners
    this.scrollbarThumb.on('pointerdown', this.onScrollbarPointerDown.bind(this));
} // Closing brace for export function Timeline(options)

Timeline.prototype.createGrid = function () {
    this.gridGraphics.clear();

    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // Draw waveform first
    this.waveformRenderer.draw(this.offset, this.zoom);

    // Get theme-aware grid colors
    const isLightTheme = document.body.classList.contains('theme-light');
    const beatLineColor = isLightTheme ? 0x000000 : 0xFFFFFF;  // Black in light, white in dark
    const halfBeatLineColor = isLightTheme ? 0x555555 : 0xAAAAAA;  // Dark gray in light, light gray in dark
    const subdivisionLineColor = isLightTheme ? 0x888888 : 0x666666;  // Medium gray in light, darker gray in dark

    // --- Draw Beat and Subdivision Lines ---
    const bpm = this._chartData.getBPMAtTime(0); // Assuming constant BPM for now
    if (!bpm) return;

    const msPerBeat = 60000 / bpm;
    const subdivisionIntervalMs = msPerBeat / this.snapDivision;
    const subdivisionIntervalPx = subdivisionIntervalMs * this.zoom;

    if (subdivisionIntervalPx < 3) return; // Don't draw if grid is too dense

    const startTimeMs = this.offset / this.zoom;
    const firstVisibleSubdivision = Math.floor(startTimeMs / subdivisionIntervalMs);
    let currentTime = firstVisibleSubdivision * subdivisionIntervalMs;

    for (let i = 0; i < (screenWidth / subdivisionIntervalPx) + 2; i++) {
        const x = (currentTime * this.zoom) - this.offset;
        const isBeat = Math.abs(currentTime % msPerBeat) < 0.01;
        const isHalfBeat = Math.abs(currentTime % (msPerBeat / 2)) < 0.01;

        if (x >= 0 && x <= screenWidth) {
            if (isBeat) {
                this.gridGraphics.lineStyle(2, beatLineColor, 0.5); // Main beat lines - thicker and more visible
            } else if (isHalfBeat && this.snapDivision > 2) {
                this.gridGraphics.lineStyle(1, halfBeatLineColor, 0.4); // Half-beat lines
            } else {
                this.gridGraphics.lineStyle(1, subdivisionLineColor, 0.3); // Subdivision lines
            }
            this.gridGraphics.moveTo(x, 0).lineTo(x, screenHeight);
        }

        currentTime += subdivisionIntervalMs;
    }

    // Draw horizontal lines (zones)
    for (let i = 0; i < this.waveformRenderer.numZones; i++) { // Use numZones from waveformRenderer
        const y = i * 30; // 30 pixels per zone
        this.gridGraphics.moveTo(0, y);
        this.gridGraphics.lineTo(screenWidth, y);
    }
};

Timeline.prototype.createNotes = function () {
    // This method seems to be missing or incomplete.
    // It should iterate through this._chartData.raw.notes and create PIXI.Graphics objects for each.
    // It should also attach event listeners for interaction.
};

Timeline.prototype.drawMarkers = function () {
    this.markerGraphics.clear();
    if (!this.sessionMarkers) return;

    const screenHeight = this.app.screen.height;

    this.sessionMarkers.forEach(marker => {
        const x = (marker.time * this.zoom) - this.offset;

        // Only draw if visible
        if (x >= -10 && x <= this.app.screen.width + 10) {
            // Marker line
            this.markerGraphics.lineStyle(1, 0x00aaff, 0.9);
            this.markerGraphics.moveTo(x, 0);
            this.markerGraphics.lineTo(x, screenHeight);

            // Marker flag
            this.markerGraphics.beginFill(0x00aaff, 0.8);
            this.markerGraphics.moveTo(x, 0);
            this.markerGraphics.lineTo(x + 8, 4);
            this.markerGraphics.lineTo(x, 8);
            this.markerGraphics.closePath();
            this.markerGraphics.endFill();
        }
    });
};

Timeline.prototype._getMarkerAt = function (x) {
    const clickWidth = 8; // Clickable pixel width around the marker line
    if (!this.sessionMarkers) return null;

    return this.sessionMarkers.find(marker => {
        const markerX = (marker.time * this.zoom) - this.offset;
        return x >= markerX - clickWidth / 2 && x <= markerX + clickWidth / 2;
    });
};

Timeline.prototype._getNoteAtPosition = function (x, y) {
    const clickWidth = 25; // Tolerance for clicking
    const clickHeight = 30; // Height of one zone

    const notes = this._chartData.notes || [];
    return notes.find(note => {
        const noteX = (note.time * this.zoom) - this.offset;
        const noteY = note.zone * 30;

        return x >= noteX - clickWidth / 2 &&
            x <= noteX + clickWidth / 2 &&
            y >= noteY &&
            y <= noteY + clickHeight;
    });
};

Timeline.prototype.onPointerDown = function (event) {
    if (event.button === 0) { // Left-click
        // Check if clicking on a marker
        const marker = this._getMarkerAt(event.offsetX);
        if (marker) {
            return; // Let marker handling take over
        }

        // Box select ONLY when Shift is held
        if (event.shiftKey) {
            this.isBoxSelecting = true;
            this.boxSelectStart = { x: event.offsetX, y: event.offsetY };
            this.boxSelectEnd = { x: event.offsetX, y: event.offsetY };
            this.app.view.style.cursor = 'crosshair';
            this.app.view.addEventListener('pointermove', this.boundBoxSelectMove);
            this.app.view.addEventListener('pointerup', this.boundBoxSelectEnd);
            return;
        }

        this.onClick(event);
    } else if (event.button === 2) { // Right-click
        const marker = this._getMarkerAt(event.offsetX);
        if (marker) {
            if (this.onMarkerAction) {
                this.onMarkerAction('delete', marker);
            }
        }
    }
};

Timeline.prototype.onBoxSelectMove = function (event) {
    if (!this.isBoxSelecting) return;

    this.boxSelectEnd = { x: event.offsetX, y: event.offsetY };
    this.drawBoxSelect();
};

Timeline.prototype.onBoxSelectEnd = function (event) {
    if (!this.isBoxSelecting) return;

    this.isBoxSelecting = false;
    this.app.view.style.cursor = 'default';
    this.app.view.removeEventListener('pointermove', this.boundBoxSelectMove);
    this.app.view.removeEventListener('pointerup', this.boundBoxSelectEnd);

    // Calculate selection bounds
    const x1 = Math.min(this.boxSelectStart.x, this.boxSelectEnd.x);
    const x2 = Math.max(this.boxSelectStart.x, this.boxSelectEnd.x);
    const y1 = Math.min(this.boxSelectStart.y, this.boxSelectEnd.y);
    const y2 = Math.max(this.boxSelectStart.y, this.boxSelectEnd.y);
    // Convert to time and zone ranges
    const time1 = (x1 + this.offset) / this.zoom;
    const time2 = (x2 + this.offset) / this.zoom;
    const zone1 = Math.floor(y1 / 30);
    const zone2 = Math.floor(y2 / 30);
    // Select notes in the box
    if (this.selectionManager) {
        const notesInBox = this._chartData.raw.notes.filter(note => {
            return note.time >= time1 && note.time <= time2 &&
                note.zone >= zone1 && note.zone <= zone2;
        });
        if (event.ctrlKey || event.metaKey) {
            // Add to existing selection
            notesInBox.forEach(note => this.selectionManager.addToSelection(note));
        } else {
            // Replace selection
            this.selectionManager.selectMultiple(notesInBox);
        }

        if (this.onNoteSelected) {
            const selected = this.selectionManager.getSelection();
            if (selected.length === 1) {
                this.onNoteSelected(selected[0]);
            } else {
                this.onNoteSelected(null);
            }
        }
    }

    // Clear box graphics
    this.boxSelectGraphics.clear();
    this.drawNotes();
};

Timeline.prototype.drawBoxSelect = function () {
    this.boxSelectGraphics.clear();

    const x1 = this.boxSelectStart.x;
    const y1 = this.boxSelectStart.y;
    const x2 = this.boxSelectEnd.x;
    const y2 = this.boxSelectEnd.y;

    // Calculate proper x, y, width, height to handle dragging in any direction
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    // Draw semi-transparent blue box in screen space (not affected by zoom/offset)
    this.boxSelectGraphics.beginFill(0x3b82f6, 0.2);
    this.boxSelectGraphics.lineStyle(2, 0x3b82f6, 0.8);
    this.boxSelectGraphics.drawRect(x, y, width, height);
    this.boxSelectGraphics.endFill();

    // Ensure box select is always on top and in screen space
    this.boxSelectGraphics.position.set(0, 0);
    this.boxSelectGraphics.zIndex = 10000;
};

Timeline.prototype.setTemporaryNotes = function (notes) {
    this.temporaryNotes = notes || [];
};

Timeline.prototype.drawNotes = function () {
    // Clear existing note graphics from the container
    for (const graphic of this.noteGraphics.values()) {
        this.container.removeChild(graphic);
        graphic.destroy(); // Clean up PIXI resources
    }
    this.noteGraphics.clear();

    // Note type colors (convert hex to PIXI color)
    const getNoteColor = (note) => {
        const type = note.type || 'regular';
        const colorMap = {
            'regular': 0xFFFFFF,  // White
            'ex': 0xFFD700,       // Gold
            'ex2': 0xFFD700,      // Gold (same as EX)
            'multi': 0x00BFFF     // Blue
        };
        return colorMap[type] || 0xFFFFFF;
    };

    const notesToDraw = this.temporaryNotes.length > 0 ? this._chartData.raw.notes.concat(this.temporaryNotes) : this._chartData.raw.notes;

    notesToDraw.forEach(note => {
        const x = (note.time * this.zoom) - this.offset;
        const y = note.zone * 30; // 30 pixels per zone

        const noteGraphic = new PIXI.Graphics();

        // Check if note is selected (either in selectionManager or as selectedNote)
        const isSelected = (this.selectionManager && this.selectionManager.isSelected(note)) || this.selectedNote === note;

        if (isSelected) {
            // Draw selection highlight
            noteGraphic.lineStyle(3, 0xFFFF00, 1); // Yellow border for selected notes
        }

        noteGraphic.beginFill(getNoteColor(note));
        noteGraphic.drawRect(0, 0, 20, 20); // Note size
        noteGraphic.endFill();

        noteGraphic.x = x;
        noteGraphic.y = y;

        // CRITICAL: Set explicit hit area for PIXI v7 event system
        noteGraphic.eventMode = 'static';
        noteGraphic.cursor = 'pointer';
        noteGraphic.hitArea = new PIXI.Rectangle(0, 0, 20, 20);

        noteGraphic.on('pointerdown', (event) => this.onNotePointerDown(event, note, noteGraphic));

        this.container.addChild(noteGraphic);
        this.noteGraphics.set(note, noteGraphic);
    });
};

Timeline.prototype.onTimelinePointerDown = function (event) {
    if (event.button === 0) { // Left-click only for dragging timeline
        this.isDraggingTimeline = true;
        this.lastPointerX = event.clientX;
        this.app.view.addEventListener('pointermove', this.onTimelinePointerMove.bind(this));
        this.app.view.addEventListener('pointerup', this.onTimelinePointerUp.bind(this));
    }
};

Timeline.prototype.onTimelinePointerUp = function () {
    this.isDraggingTimeline = false;
    this.app.view.removeEventListener('pointermove', this.onTimelinePointerMove.bind(this));
    this.app.view.removeEventListener('pointerup', this.onTimelinePointerUp.bind(this));
};

Timeline.prototype.onTimelinePointerMove = function (event) {
    if (this.isDraggingTimeline) {
        const currentPointerX = event.clientX;
        const deltaX = currentPointerX - this.lastPointerX;
        this.offset -= deltaX;
        this.offset = Math.max(0, this.offset); // Prevent dragging past the beginning
        this.lastPointerX = currentPointerX;

        this.wasDragging = true;
        this.createGrid();
        this.drawNotes();
        this.drawMarkers();
        this.updateScrollbar();
        this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);
    }
};

Timeline.prototype.onNotePointerDown = function (event, note, noteGraphic) {
    // Handle right-click deletion
    if (event.data.button === 2) {
        event.stopPropagation();
        this.commandManager.execute(new DeleteNoteCommand(this._chartData, note));
        if (this.selectedNote === note) {
            this.selectedNote = null;
            if (this.onNoteSelected) {
                this.onNoteSelected(null);
            }
        }
        if (this.selectionManager) {
            this.selectionManager.removeFromSelection(note);
        }
        this.drawNotes();
        return;
    }

    event.stopPropagation(); // Prevent timeline click event
    const isCtrlPressed = event.data.originalEvent.ctrlKey || event.data.originalEvent.metaKey;
    const isShiftPressed = event.data.originalEvent.shiftKey;

    if (this.selectionManager) {
        const isAlreadySelected = this.selectionManager.isSelected(note);

        if (isCtrlPressed) {
            // Ctrl+Click: Toggle selection
            this.selectionManager.toggleSelection(note);
            this.selectedNote = note;
        } else if (isShiftPressed && this.selectedNote) {
            // Shift+Click: Add to selection
            this.selectionManager.addToSelection(note);
        } else if (isAlreadySelected && this.selectionManager.getSelection().length > 1) {
            // Clicking on an already-selected note in a multi-selection: keep selection and start drag
            this.selectedNote = note;
        } else {
            // Regular click: Select only this note
            this.selectionManager.selectNote(note);
            this.selectedNote = note;
        }

        // Notify editor of selection change
        if (this.onNoteSelected) {
            const selected = this.selectionManager.getSelection();
            if (selected.length === 1) {
                this.onNoteSelected(selected[0]);
            } else if (selected.length > 1) {
                this.onNoteSelected(null); // Multiple selection, clear property panel
            } else {
                this.onNoteSelected(null);
            }
        }
    } else {
        // Fallback to old single-selection behavior
        if (this.selectedNote && this.selectedNote !== note) {
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
    }

    // DON'T redraw notes here - it destroys event listeners during drag
    // this.drawNotes(); // Redraw to show selection

    // Initiate drag: if clicking on already-selected note OR single-clicking
    const shouldStartDrag = !isCtrlPressed && !isShiftPressed;

    if (shouldStartDrag) {
        this.isDragging = true;
        this.wasDragging = false;
        this.app.view.addEventListener('pointermove', this.onNotePointerMove.bind(this));
        this.app.view.addEventListener('pointerup', this.onNotePointerUp.bind(this));
    } else {
        // Only redraw if we're multi-selecting (not dragging)
        this.drawNotes();
    }
};

Timeline.prototype.onNotePointerMove = function (event) {
    if (this.isDragging && this.selectedNote) {
        const pxToMs = (px) => (px + this.offset) / this.zoom;
        let newTime = pxToMs(event.offsetX);
        let newZone = Math.floor(event.offsetY / 30);

        if (this.snapEnabled) {
            newTime = this.snapToBeat(newTime);
        }

        newZone = Math.max(0, Math.min(5, newZone));

        // Calculate delta from the primary selected note
        const deltaTime = newTime - this.selectedNote.time;
        const deltaZone = newZone - this.selectedNote.zone;

        // Only execute if position actually changed
        if (deltaTime !== 0 || deltaZone !== 0) {
            this.wasDragging = true;

            // Get all selected notes (or just the single selected note)
            const notesToMove = this.selectionManager ?
                this.selectionManager.getSelection() :
                [this.selectedNote];

            // Check if ANY note would go out of bounds
            const wouldGoOutOfBounds = notesToMove.some(note => {
                const newNoteZone = note.zone + deltaZone;
                return newNoteZone < 0 || newNoteZone > 5;
            });

            // If any note would go out of bounds, don't move any notes
            if (wouldGoOutOfBounds) {
                return;
            }

            // Move all selected notes by the same delta
            notesToMove.forEach(note => {
                const oldTime = note.time;
                const oldZone = note.zone;
                const newNoteTime = oldTime + deltaTime;
                const newNoteZone = oldZone + deltaZone;

                if (note.time !== newNoteTime || note.zone !== newNoteZone) {
                    this.commandManager.execute(new MoveNoteCommand(
                        this._chartData,
                        note,
                        oldTime,
                        oldZone,
                        newNoteTime,
                        newNoteZone
                    ));
                }
            });

            this.drawNotes();
            if (this.onNoteSelected) {
                this.onNoteSelected(this.selectedNote);
            }
        }
    }
};

Timeline.prototype.onNotePointerUp = function () {
    this.isDragging = false;
    this.app.view.removeEventListener('pointermove', this.onNotePointerMove.bind(this));
    this.app.view.removeEventListener('pointerup', this.onNotePointerUp.bind(this));
    this._chartData.raw.notes.sort((a, b) => a.time - b.time); // Re-sort after moving
    this.drawNotes();
    // Do not reset lastClickTime here, it's handled in onNotePointerDown for double-click detection
};

Timeline.prototype.onClick = function (event) {
    // Right-click handling for markers
    // This is now handled in onPointerDown to separate concerns.

    // If a drag action just completed, don't process this as a click.
    if (this.wasDragging) {
        this.wasDragging = false; // Reset for the next interaction
        return;
    }

    // If we're currently dragging, don't create a note
    if (this.isDragging) {
        return;
    }
    // Check if clicking on an existing note - if so, don't create a new one
    const clickedNote = this._getNoteAtPosition(event.offsetX, event.offsetY);
    if (clickedNote) {
        return; // Note click will be handled by onNotePointerDown
    }

    // Clear selection when clicking background (unless Ctrl is held)
    const isCtrlPressed = event.ctrlKey || event.metaKey;

    if (!isCtrlPressed) {
        if (this.selectionManager) {
            this.selectionManager.clearSelection();
        }

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
    }

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
        if (this.selectionManager) {
            this.selectionManager.selectNote(newNote);
        }
        if (this.onNoteSelected) {
            this.onNoteSelected(newNote);
        }
    }
};

Timeline.prototype.getTimeFromPointer = function (event) {
    // event is a DOM PointerEvent on the canvas
    return (event.offsetX + this.offset) / this.zoom;
};

Timeline.prototype.onScrubStart = function (event) {
    // Stop propagation to prevent the timeline's onClick from firing
    event.stopPropagation();

    // Check for precise scrubbing
    if (event.data.originalEvent.shiftKey) {
        this.isPreciseScrubbing = true;
        this.preciseScrubStartPointerX = event.data.originalEvent.offsetX;
        this.preciseScrubStartTime = this.audioPlayer.currentTime * 1000;
    }

    this.isScrubbing = true;
    this.wasDragging = false; // Reset drag flag

    // Bind these methods to `this` ONCE and store them, so they can be removed.
    this._boundScrubMove = this.onScrubMove.bind(this);
    this._boundScrubEnd = this.onScrubEnd.bind(this);

    this.app.view.addEventListener('pointermove', this._boundScrubMove);
    this.app.view.addEventListener('pointerup', this._boundScrubEnd);
    this.app.view.addEventListener('pointerupoutside', this._boundScrubEnd);

    // Also add to window to catch releases outside the canvas
    window.addEventListener('pointerup', this._boundScrubEnd);

    // The event from PIXI is a wrapper, we need the original DOM event for offsetX
    if (event.data && event.data.originalEvent) {
        this.onScrubMove(event.data.originalEvent);
    }
};

Timeline.prototype.onScrubMove = function (event) {
    if (!this.isScrubbing) return;

    // Prevent default browser actions, like text selection, during drag
    event.preventDefault();

    this.wasDragging = true; // It's a drag (scrub)

    let newTime;
    if (this.isPreciseScrubbing) {
        const precisionFactor = 0.1; // 10% of normal speed
        const deltaX = event.offsetX - this.preciseScrubStartPointerX;
        newTime = this.preciseScrubStartTime + (deltaX / this.zoom) * precisionFactor;
    } else {
        newTime = this.getTimeFromPointer(event);
    }

    if (this.audioPlayer && newTime >= 0 && newTime <= this.audioPlayer.duration * 1000) {
        this.audioPlayer.currentTime = newTime / 1000;
        this.drawCurrentTimeIndicator(newTime);

        // Preview notes at scrubbed position if paused
        if (this.audioPlayer.paused && this.gameplay) {
            this.gameplay.previewAtTime(newTime);
        }
    }
};

Timeline.prototype.onScrubEnd = function (event) {
    if (!this.isScrubbing) return;

    if (event) event.preventDefault();

    this.isScrubbing = false;
    this.isPreciseScrubbing = false; // Reset precise scrubbing flag

    // Remove event listeners
    if (this._boundScrubMove) {
        this.app.view.removeEventListener('pointermove', this._boundScrubMove);
        window.removeEventListener('pointermove', this._boundScrubMove);
    }
    if (this._boundScrubEnd) {
        this.app.view.removeEventListener('pointerup', this._boundScrubEnd);
        this.app.view.removeEventListener('pointerupoutside', this._boundScrubEnd);
        window.removeEventListener('pointerup', this._boundScrubEnd);
    }

    // Final preview update at end position if paused
    if (this.audioPlayer && this.audioPlayer.paused && this.gameplay) {
        this.gameplay.previewAtTime(this.audioPlayer.currentTime * 1000);
    }
};

Timeline.prototype.onWheel = function (event) {
    event.preventDefault();
    if (event.ctrlKey) {
        // Smooth zoom with mouse pointer as target
        const zoomFactor = 1.15; // Increased from 1.1 for faster zoom
        const targetZoom = event.deltaY > 0 ? this.zoom / zoomFactor : this.zoom * zoomFactor;
        const clampedZoom = Math.max(0.01, Math.min(10, targetZoom));

        // Cancel any existing zoom animation
        if (this.zoomAnimationFrame) {
            cancelAnimationFrame(this.zoomAnimationFrame);
        }

        const startZoom = this.zoom;
        const endZoom = clampedZoom;
        const duration = 80; // milliseconds - faster animation
        const startTime = performance.now();

        // Store the mouse position for zoom target
        const mouseX = event.offsetX;
        const chartTimeAtMouse = (this.offset + mouseX) / startZoom;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic for smooth deceleration
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            // Interpolate zoom
            const currentZoom = startZoom + (endZoom - startZoom) * easeProgress;
            this.zoom = currentZoom;

            // Adjust offset to zoom towards mouse pointer
            this.offset = chartTimeAtMouse * this.zoom - mouseX;
            this.offset = Math.max(0, this.offset);

            // Redraw timeline
            this.createGrid();
            this.drawNotes();
            this.drawMarkers();
            this.updateScrollbar();
            this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);

            // Notify editor of zoom change
            if (this.onZoomChange) {
                this.onZoomChange(this.zoom);
            }

            // Continue animation if not complete
            if (progress < 1) {
                this.zoomAnimationFrame = requestAnimationFrame(animate);
            } else {
                this.zoomAnimationFrame = null;
            }
        };

        this.zoomAnimationFrame = requestAnimationFrame(animate);

    } else {
        // Smooth scroll with momentum
        const scrollAmount = event.deltaY * 0.5; // Reduce sensitivity
        this.scrollVelocity += scrollAmount;

        // Start smooth scrolling animation if not already running
        if (!this.isScrolling) {
            this.isScrolling = true;
            this.smoothScroll();
        }

        this.offset = Math.max(0, this.offset);
        this.createGrid();
        this.drawNotes();
        this.drawMarkers();
        this.updateScrollbar();
        this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);
    }
};

Timeline.prototype.smoothScroll = function () {
    if (!this.isScrolling) return;

    // Apply velocity to offset
    this.offset += this.scrollVelocity;
    this.offset = Math.max(0, this.offset);

    // Apply friction/easing
    this.scrollVelocity *= 0.85; // Friction coefficient (0.85 = smooth deceleration)

    // Stop scrolling when velocity is very small
    if (Math.abs(this.scrollVelocity) < 0.1) {
        this.scrollVelocity = 0;
        this.isScrolling = false;
    }

    // Redraw timeline
    this.createGrid();
    this.drawNotes();
    this.drawMarkers();
    this.updateScrollbar();
    this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);

    // Continue animation
    if (this.isScrolling) {
        requestAnimationFrame(() => this.smoothScroll());
    }
};

Timeline.prototype.onKeyDown = function (event) {
    if (event.key === 'Delete' && this.selectedNote) {
        event.preventDefault(); // Prevent browser default action
        this.commandManager.execute(new DeleteNoteCommand(this._chartData, this.selectedNote));
        this.selectedNote = null;
        if (this.onNoteSelected) {
            this.onNoteSelected(null);
        }
        this.drawNotes();
    }
};

Timeline.prototype.snapToBeat = function (timeInMs) {
    const bpm = this._chartData.getBPMAtTime(timeInMs);
    if (!bpm) return timeInMs;

    const msPerBeat = 60000 / bpm;
    const snapInterval = msPerBeat / this.snapDivision;

    return Math.round(timeInMs / snapInterval) * snapInterval;
};

Timeline.prototype.update = function () {
    // Redraw on chart data change
    this.createGrid();
    this.drawNotes();
    this.drawMarkers();
    this.updateScrollbar();
};

Timeline.prototype.setZoom = function (newZoom) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.01, Math.min(10, newZoom));

    // Adjust offset to zoom towards the center of the view
    const centerX = this.app.screen.width / 2;
    const chartTimeAtCenter = (this.offset + centerX) / oldZoom;
    this.offset = chartTimeAtCenter * this.zoom - centerX;

    this.createGrid();
    this.drawNotes();
    this.drawMarkers();
    this.updateScrollbar();
    this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);
};

Timeline.prototype.smoothZoom = function (targetZoom) {
    // Cancel any existing zoom animation
    if (this.zoomAnimationFrame) {
        cancelAnimationFrame(this.zoomAnimationFrame);
    }

    const startZoom = this.zoom;
    const endZoom = Math.max(0.01, Math.min(10, targetZoom));
    const duration = 100; // milliseconds - faster animation
    const startTime = performance.now();

    // Store the center point for consistent zoom target
    const centerX = this.app.screen.width / 2;
    const chartTimeAtCenter = (this.offset + centerX) / startZoom;

    const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic for smooth deceleration
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        // Interpolate zoom
        const currentZoom = startZoom + (endZoom - startZoom) * easeProgress;
        this.zoom = currentZoom;

        // Adjust offset to maintain center point
        this.offset = chartTimeAtCenter * this.zoom - centerX;

        // Redraw timeline
        this.createGrid();
        this.drawNotes();
        this.drawMarkers();
        this.updateScrollbar();
        this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);

        // Continue animation if not complete
        if (progress < 1) {
            this.zoomAnimationFrame = requestAnimationFrame(animate);
        } else {
            this.zoomAnimationFrame = null;
        }
    };

    this.zoomAnimationFrame = requestAnimationFrame(animate);
};

Timeline.prototype.setSessionMarkers = function (markers) {
    this.sessionMarkers = markers;
    this.drawMarkers();
}

Timeline.prototype.highlightNote = function (noteGraphic) {
    noteGraphic.lineStyle(2, 0xFFFF00, 1); // Yellow border
    noteGraphic.drawRect(0, 0, 20, 20);
};

Timeline.prototype.drawCurrentTimeIndicator = function (currentTime) {
    this.currentTimeIndicator.clear();
    this.currentTimeIndicator.lineStyle(2, 0xFFFFFF, 1); // White line
    const x = (currentTime * this.zoom) - this.offset;
    const height = this.app.renderer.height;
    this.currentTimeIndicator.moveTo(x, 0);
    this.currentTimeIndicator.lineTo(x, height);

    // Create a larger, invisible hit area to make it easier to grab
    this.currentTimeIndicator.hitArea = new PIXI.Rectangle(x - 5, 0, 10, height);

    // Auto-scroll when playhead reaches the edge (FL Studio style)
    if (this.audioPlayer && !this.audioPlayer.paused && !this.isDraggingScrollbar && !this.isManuallyScrolling) {
        const viewWidth = this.app.renderer.width;
        const rightEdge = viewWidth * 0.9; // Scroll when playhead reaches 90% of view width

        // If playhead is past the right edge, scroll forward by one screen width
        if (x > rightEdge) {
            this.offset = currentTime * this.zoom - (viewWidth * 0.1); // Position playhead at 10% from left
            this.createGrid();
            this.drawNotes();
            this.drawMarkers();
            this.updateScrollbar();
        }
        // If playhead is before the left edge (e.g., after seeking backward), scroll to show it
        else if (x < 0) {
            this.offset = Math.max(0, currentTime * this.zoom - (viewWidth * 0.1));
            this.createGrid();
            this.drawNotes();
            this.drawMarkers();
            this.updateScrollbar();
        }
    }
};

Timeline.prototype.setWaveformColor = function (color) {
    this.waveformRenderer.setColor(color);
    this.createGrid(); // Redraw grid which includes the waveform
    this.updateScrollbar();
};

Timeline.prototype.updateBackgroundColor = function () {
    // Get background color from timeline container's actual background
    const timelineContainerStyle = getComputedStyle(this.parent);
    const bgColor = timelineContainerStyle.backgroundColor;

    // Convert RGB to hex
    let bgColorHex = 0x1a1a1a; // default
    if (bgColor.startsWith('rgb')) {
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            bgColorHex = (parseInt(rgb[0]) << 16) | (parseInt(rgb[1]) << 8) | parseInt(rgb[2]);
        }
    } else if (bgColor.startsWith('#')) {
        bgColorHex = parseInt(bgColor.replace('#', ''), 16);
    }

    // Update PIXI renderer background color
    if (this.app && this.app.renderer) {
        this.app.renderer.background.color = bgColorHex;
    }
};

Timeline.prototype.updateScrollbar = function () {
    const scrollbarHeight = 12;
    const scrollbarPadding = 4;
    const scrollbarY = this.app.renderer.height - scrollbarHeight - scrollbarPadding;
    const scrollbarWidth = this.app.renderer.width - (scrollbarPadding * 2);

    // Calculate total content width (total chart duration in pixels)
    const chartDuration = this._chartData.metadata?.duration || 180000; // Default 3 minutes
    const totalContentWidth = chartDuration * this.zoom;

    // Calculate visible ratio and thumb width
    const visibleRatio = Math.min(1, this.app.renderer.width / totalContentWidth);
    const thumbWidth = Math.max(40, scrollbarWidth * visibleRatio); // Minimum 40px thumb

    // Calculate thumb position based on offset
    const scrollRatio = this.offset / Math.max(1, totalContentWidth - this.app.renderer.width);
    const thumbX = scrollbarPadding + (scrollbarWidth - thumbWidth) * scrollRatio;

    // Draw scrollbar background
    this.scrollbarBg.clear();
    this.scrollbarBg.beginFill(0x2a2a2a, 0.8);
    this.scrollbarBg.drawRoundedRect(scrollbarPadding, scrollbarY, scrollbarWidth, scrollbarHeight, 6);
    this.scrollbarBg.endFill();

    // Draw scrollbar thumb
    this.scrollbarThumb.clear();
    this.scrollbarThumb.beginFill(0x4a9eff, 0.9);
    this.scrollbarThumb.drawRoundedRect(thumbX, scrollbarY, thumbWidth, scrollbarHeight, 6);
    this.scrollbarThumb.endFill();

    // Update hit area for dragging
    this.scrollbarThumb.hitArea = new PIXI.Rectangle(thumbX, scrollbarY, thumbWidth, scrollbarHeight);

    // Store scrollbar properties for drag calculations
    this.scrollbarProps = {
        y: scrollbarY,
        height: scrollbarHeight,
        padding: scrollbarPadding,
        width: scrollbarWidth,
        thumbWidth: thumbWidth,
        totalContentWidth: totalContentWidth
    };
};

Timeline.prototype.onScrollbarPointerDown = function (event) {
    this.isDraggingScrollbar = true;
    this.scrollbarDragStartX = event.data.global.x;
    this.scrollbarDragStartOffset = this.offset;

    // Use PIXI events instead of DOM events
    this.scrollbarThumb.on('pointermove', this.boundScrollbarMove);
    this.scrollbarThumb.on('pointerup', this.boundScrollbarUp);
    this.scrollbarThumb.on('pointerupoutside', this.boundScrollbarUp);

    // Also listen on stage for better tracking
    this.app.stage.on('pointermove', this.boundScrollbarMove);
    this.app.stage.on('pointerup', this.boundScrollbarUp);
    this.app.stage.on('pointerupoutside', this.boundScrollbarUp);
};

Timeline.prototype.onScrollbarPointerMove = function (event) {
    if (!this.isDraggingScrollbar || !this.scrollbarProps) return;

    const deltaX = event.data.global.x - this.scrollbarDragStartX;
    const scrollableWidth = this.scrollbarProps.width - this.scrollbarProps.thumbWidth;
    const contentScrollRange = this.scrollbarProps.totalContentWidth - this.app.renderer.width;

    // Convert pixel delta to offset delta
    const offsetDelta = (deltaX / scrollableWidth) * contentScrollRange;
    this.offset = Math.max(0, Math.min(contentScrollRange, this.scrollbarDragStartOffset + offsetDelta));

    // Mark that we're manually scrolling to prevent auto-scroll interference
    this.isManuallyScrolling = true;

    this.createGrid();
    this.drawNotes();
    this.drawMarkers();
    this.updateScrollbar();

    // Update playhead position to reflect current audio time
    this.drawCurrentTimeIndicator(this.audioPlayer.currentTime * 1000);
};

Timeline.prototype.onScrollbarPointerUp = function () {
    this.isDraggingScrollbar = false;

    // Keep manual scrolling flag active for a short time after release
    // to prevent immediate auto-scroll
    setTimeout(() => {
        this.isManuallyScrolling = false;
    }, 1000); // 1 second delay

    // Remove PIXI event listeners
    this.scrollbarThumb.off('pointermove', this.boundScrollbarMove);
    this.scrollbarThumb.off('pointerup', this.boundScrollbarUp);
    this.scrollbarThumb.off('pointerupoutside', this.boundScrollbarUp);

    this.app.stage.off('pointermove', this.boundScrollbarMove);
    this.app.stage.off('pointerup', this.boundScrollbarUp);
    this.app.stage.off('pointerupoutside', this.boundScrollbarUp);
};
