import { AddNoteCommand, DeleteNoteCommand, MoveNoteCommand, CompoundCommand } from './commandManager.js';
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
    this.onDeleteSelected = options.onDeleteSelected; // Bug 2 fix: bulk delete from keyboard

    // Bug 16 fix: store bound refs once so addEventListener/removeEventListener use the same reference
    this._boundTimelineMove = this.onTimelinePointerMove.bind(this);
    this._boundTimelineUp   = this.onTimelinePointerUp.bind(this);
    this._boundNoteMove     = this.onNotePointerMove.bind(this);
    this._boundNoteUp       = this.onNotePointerUp.bind(this);
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

    // Create separate graphics layer for zone lines (always visible)
    this.zoneGraphics = new PIXI.Graphics();
    this.container.addChild(this.zoneGraphics);

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

    // Performance optimization: Dirty flags to track what needs redrawing
    this.dirtyFlags = {
        grid: true,
        notes: true,
        markers: true,
        scrollbar: true,
        timeIndicator: true
    };

    // Performance optimization: Throttle redraws
    this.lastRedrawTime = 0;
    this.redrawThrottleMs = 16; // ~60fps max
    this.pendingRedraw = false;

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
    // Performance: Skip if not dirty
    if (!this.dirtyFlags.grid) return;

    this.gridGraphics.clear();
    this.zoneGraphics.clear(); // Clear zone graphics separately

    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    // Draw waveform first
    this.waveformRenderer.draw(this.offset, this.zoom);

    // Get theme-aware grid colors
    const isLightTheme = document.body.classList.contains('theme-light');
    const beatLineColor = isLightTheme ? 0x000000 : 0xFFFFFF;
    const halfBeatLineColor = isLightTheme ? 0x555555 : 0xAAAAAA;
    const subdivisionLineColor = isLightTheme ? 0x888888 : 0x666666;
    const zoneLineColor = isLightTheme ? 0xCCCCCC : 0x333333;

    // --- Draw horizontal zone lines on separate layer (ALWAYS VISIBLE) ---
    this.zoneGraphics.lineStyle(1, zoneLineColor, 0.6);
    this.zoneGraphics.beginFill(0, 0); // Transparent fill
    for (let i = 0; i <= this.waveformRenderer.numZones; i++) {
        const y = i * 30;
        this.zoneGraphics.moveTo(0, y);
        this.zoneGraphics.lineTo(screenWidth, y);
    }
    this.zoneGraphics.endFill();

    // --- Draw Beat and Subdivision Lines on main grid layer ---
    // Handle multiple BPM changes by drawing each section separately
    const startTimeMs = this.offset / this.zoom;
    const endTimeMs = (this.offset + screenWidth) / this.zoom;

    // Get all BPM changes that affect the visible area
    // Fallback to default BPM if bpmChanges is missing or empty
    let bpmChanges = this._chartData.bpmChanges;
    if (!bpmChanges || bpmChanges.length === 0) {
        const defaultBpm = this._chartData.raw?.meta?.bpm?.init || this._chartData.raw?.meta?.bpm || 120;
        bpmChanges = [{ time: 0, bpm: defaultBpm }];
    }

    // Validate and sanitize BPM changes
    bpmChanges = bpmChanges.filter(change => {
        return change &&
            typeof change.time === 'number' &&
            typeof change.bpm === 'number' &&
            change.bpm > 0 &&
            isFinite(change.bpm);
    });

    // If all BPM changes were invalid, use default
    if (bpmChanges.length === 0) {
        bpmChanges = [{ time: 0, bpm: 120 }];
    }

    // Ensure BPM changes are sorted by time
    bpmChanges.sort((a, b) => a.time - b.time);

    // Batch draw operations by line type for better performance
    const beatLines = [];
    const halfBeatLines = [];
    const subdivisionLines = [];

    // Process each BPM section
    for (let changeIndex = 0; changeIndex < bpmChanges.length; changeIndex++) {
        const bpmChange = bpmChanges[changeIndex];
        const nextBpmChange = bpmChanges[changeIndex + 1];

        const sectionStartTime = bpmChange.time;
        const sectionEndTime = nextBpmChange ? nextBpmChange.time : endTimeMs + 10000; // Extend beyond visible area

        // Skip sections that are completely outside the visible area
        if (sectionEndTime < startTimeMs || sectionStartTime > endTimeMs) {
            continue;
        }

        const bpm = bpmChange.bpm;
        const msPerBeat = 60000 / bpm;
        const subdivisionIntervalMs = msPerBeat / this.snapDivision;
        const subdivisionIntervalPx = subdivisionIntervalMs * this.zoom;

        // Only draw vertical lines if grid is not too dense
        if (subdivisionIntervalPx >= 3) {
            // Calculate the first beat in this section
            // We need to find the first beat that occurs at or after sectionStartTime
            const beatsFromSectionStart = Math.ceil((Math.max(startTimeMs, sectionStartTime) - sectionStartTime) / subdivisionIntervalMs);
            let currentTime = sectionStartTime + (beatsFromSectionStart * subdivisionIntervalMs);

            // Draw beats until we reach the end of this section or the visible area
            const drawEndTime = Math.min(sectionEndTime, endTimeMs);

            let iterationCount = 0;
            const maxIterations = 10000; // Safety limit
            let beatIndex = beatsFromSectionStart; // Track which subdivision we're on

            while (currentTime <= drawEndTime && iterationCount < maxIterations) {
                const x = (currentTime * this.zoom) - this.offset;

                // Use beat index instead of modulo to avoid floating-point errors
                // beatIndex tells us which subdivision we're on
                const isFullBeat = (beatIndex % this.snapDivision) === 0;
                const isHalfBeat = this.snapDivision > 2 && (beatIndex % (this.snapDivision / 2)) === 0;

                if (x >= 0 && x <= screenWidth) {
                    if (isFullBeat) {
                        beatLines.push(x);
                    } else if (isHalfBeat && !isFullBeat) {
                        halfBeatLines.push(x);
                    } else {
                        subdivisionLines.push(x);
                    }
                }

                currentTime += subdivisionIntervalMs;
                beatIndex++;
                iterationCount++;
            }

            if (iterationCount >= maxIterations) {
                console.warn('[Timeline] Hit max iterations drawing beat lines - possible infinite loop prevented');
            }
        }
    }

    // Draw all beat lines at once
    if (beatLines.length > 0) {
        this.gridGraphics.lineStyle(2, beatLineColor, 0.5);
        beatLines.forEach(x => {
            this.gridGraphics.moveTo(x, 0);
            this.gridGraphics.lineTo(x, screenHeight);
        });
    }

    // Draw all half-beat lines at once
    if (halfBeatLines.length > 0) {
        this.gridGraphics.lineStyle(1, halfBeatLineColor, 0.4);
        halfBeatLines.forEach(x => {
            this.gridGraphics.moveTo(x, 0);
            this.gridGraphics.lineTo(x, screenHeight);
        });
    }

    // Draw all subdivision lines at once
    if (subdivisionLines.length > 0) {
        this.gridGraphics.lineStyle(1, subdivisionLineColor, 0.3);
        subdivisionLines.forEach(x => {
            this.gridGraphics.moveTo(x, 0);
            this.gridGraphics.lineTo(x, screenHeight);
        });
    }

    // Mark grid as clean
    this.dirtyFlags.grid = false;
};

Timeline.prototype.createNotes = function () {
    // This method seems to be missing or incomplete.
    // It should iterate through this._chartData.raw.notes and create PIXI.Graphics objects for each.
    // It should also attach event listeners for interaction.
};

Timeline.prototype.drawMarkers = function () {
    // Performance: Skip if not dirty
    if (!this.dirtyFlags.markers) return;

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

    // Mark markers as clean
    this.dirtyFlags.markers = false;
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

    // Use the correctly nested raw data array for notes
    const notes = (this._chartData && this._chartData.raw && this._chartData.raw.notes) ? this._chartData.raw.notes : (this._chartData.notes || []);
    return notes.find(note => {
        const noteX = (note.time * this.zoom) - this.offset;
        const noteY = note.zone * 30;
        
        // Calculate dynamic width for hold notes
        const tailWidth = (note.type === 'hold' && note.duration) ? note.duration * this.zoom : 0;
        const rightBound = noteX + clickWidth / 2 + tailWidth;

        return x >= noteX - clickWidth / 2 &&
            x <= rightBound &&
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
    this.dirtyFlags.notes = true;
    this.throttledRedraw();
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
    if (!this.dirtyFlags.notes) return;

    for (const graphic of this.noteGraphics.values()) {
        this.container.removeChild(graphic);
        graphic.destroy();
    }
    this.noteGraphics.clear();

    const getNoteColor = (note) => {
        const type = note.type || 'regular';
        return { regular: 0xFFFFFF, ex: 0xFFD700, ex2: 0x00E5FF, multi: 0x00BFFF, hold: 0x44FFCC, flick: 0xFF8C00 }[type] || 0xFFFFFF;
    };

    const NOTE_W = 20, NOTE_H = 20, ZONE_H = 30;
    const notesToDraw = this.temporaryNotes.length > 0
        ? this._chartData.raw.notes.concat(this.temporaryNotes)
        : this._chartData.raw.notes;

    notesToDraw.forEach(note => {
        const x = (note.time * this.zoom) - this.offset;
        const y = note.zone * ZONE_H;
        const noteGraphic = new PIXI.Graphics();
        const isSelected  = (this.selectionManager && this.selectionManager.isSelected(note)) || this.selectedNote === note;
        const color = getNoteColor(note);

        // Hold note: draw duration bar behind head
        if (note.type === 'hold' && note.duration > 0) {
            const barW = Math.max(0, note.duration * this.zoom);
            noteGraphic.beginFill(color, 0.30);
            noteGraphic.drawRect(NOTE_W / 2, (NOTE_H - 8) / 2, barW, 8);
            noteGraphic.endFill();
            noteGraphic.beginFill(color, 0.70);
            noteGraphic.drawRect(NOTE_W / 2 + barW - 4, (NOTE_H - 14) / 2, 4, 14);
            noteGraphic.endFill();
        }

        // Note head
        if (isSelected) noteGraphic.lineStyle(3, 0xFFFF00, 1);
        noteGraphic.beginFill(color);
        noteGraphic.drawRect(0, 0, NOTE_W, NOTE_H);
        noteGraphic.endFill();

        // Flick note: right-pointing arrow overlay
        if (note.type === 'flick') {
            noteGraphic.lineStyle(0);
            noteGraphic.beginFill(0xFFFFFF, 0.9);
            noteGraphic.moveTo(NOTE_W / 2 - 4, NOTE_H / 2 - 5);
            noteGraphic.lineTo(NOTE_W / 2 + 6, NOTE_H / 2);
            noteGraphic.lineTo(NOTE_W / 2 - 4, NOTE_H / 2 + 5);
            noteGraphic.closePath();
            noteGraphic.endFill();
        }

        noteGraphic.x = x;
        noteGraphic.y = y;
        noteGraphic.eventMode = 'static';
        noteGraphic.cursor    = 'pointer';
        const hitAreaW = (note.type === 'hold' && note.duration > 0) ? NOTE_W + note.duration * this.zoom : NOTE_W;
        noteGraphic.hitArea   = new PIXI.Rectangle(0, 0, hitAreaW, NOTE_H);
        noteGraphic.on('pointerdown', (event) => this.onNotePointerDown(event, note, noteGraphic));

        this.container.addChild(noteGraphic);
        this.noteGraphics.set(note, noteGraphic);
    });

    this.dirtyFlags.notes = false;
};

Timeline.prototype.onTimelinePointerDown = function (event) {
    if (event.button === 0) { // Left-click only for dragging timeline
        this.isDraggingTimeline = true;
        this.lastPointerX = event.clientX;
        this.app.view.addEventListener('pointermove', this._boundTimelineMove);
        this.app.view.addEventListener('pointerup', this._boundTimelineUp);
    }
};

Timeline.prototype.onTimelinePointerUp = function () {
    this.isDraggingTimeline = false;
    this.app.view.removeEventListener('pointermove', this._boundTimelineMove);
    this.app.view.removeEventListener('pointerup', this._boundTimelineUp);
};

Timeline.prototype.onTimelinePointerMove = function (event) {
    if (this.isDraggingTimeline) {
        const currentPointerX = event.clientX;
        const deltaX = currentPointerX - this.lastPointerX;
        this.offset -= deltaX;
        this.offset = Math.max(0, this.offset); // Prevent dragging past the beginning
        this.lastPointerX = currentPointerX;

        this.wasDragging = true;

        // Mark everything as dirty
        this.markAllDirty();
        this.throttledRedraw();
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
        this.dirtyFlags.notes = true;
        this.throttledRedraw();
        return;
    }

    event.stopPropagation(); // Prevent timeline click event
    const evt = event.nativeEvent || event.data.originalEvent;
    const isCtrlPressed = evt.ctrlKey || evt.metaKey;
    const isShiftPressed = evt.shiftKey;

    // --- Hold note tail resize check ---
    const pointerX = evt.offsetX;
    const noteScreenX = (note.time * this.zoom) - this.offset;
    
    // If we click the right edge or tail of a hold note, resize it instead of dragging it
    if (note.type === 'hold' && pointerX > noteScreenX + 15) {
        this.isResizingHold = true;
        this.resizingNote = note;
        this.wasDragging = false; 

        if (!this.boundHoldResizeMove) this.boundHoldResizeMove = this.onHoldResizeMove.bind(this);
        if (!this.boundHoldResizeUp) this.boundHoldResizeUp = this.onHoldResizeUp.bind(this);

        this.app.view.addEventListener('pointermove', this.boundHoldResizeMove);
        this.app.view.addEventListener('pointerup', this.boundHoldResizeUp);
        
        // Ensure note is selected when resizing
        if (this.selectionManager && !this.selectionManager.isSelected(note)) {
            this.selectionManager.selectNote(note);
            this.selectedNote = note;
            if (this.onNoteSelected) this.onNoteSelected(note);
            this.dirtyFlags.notes = true;
            this.throttledRedraw();
        }
        return; // Skip normal selection/drag
    }

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

        // Bug 3 fix: snapshot every selected note's start position before dragging.
        // We'll push a single CompoundCommand on pointerup instead of one per mousemove.
        const notesToMove = this.selectionManager
            ? this.selectionManager.getSelection()
            : (this.selectedNote ? [this.selectedNote] : []);
        this._dragStartPositions = new Map();
        notesToMove.forEach(note => {
            this._dragStartPositions.set(note, { time: note.time, zone: note.zone });
        });

        this.app.view.addEventListener('pointermove', this._boundNoteMove);
        this.app.view.addEventListener('pointerup', this._boundNoteUp);
    } else {
        // Only redraw if we're multi-selecting (not dragging)
        this.dirtyFlags.notes = true;
        this.throttledRedraw();
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

        // Only move if position actually changed
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

            if (wouldGoOutOfBounds) return;

            // Bug 3 fix: directly mutate positions without going through commandManager.
            // A single CompoundCommand is pushed in onNotePointerUp instead.
            notesToMove.forEach(note => {
                note.time = Math.max(0, note.time + deltaTime);
                note.zone = Math.max(0, Math.min(5, note.zone + deltaZone));
            });

            // Mark notes as dirty and throttle redraw during drag
            this.dirtyFlags.notes = true;
            this.throttledRedraw();

            if (this.onNoteSelected) {
                this.onNoteSelected(this.selectedNote);
            }
        }
    }
};

Timeline.prototype.onNotePointerUp = function () {
    this.isDragging = false;
    this.app.view.removeEventListener('pointermove', this._boundNoteMove);
    this.app.view.removeEventListener('pointerup', this._boundNoteUp);

    // Bug 3 fix: push a single CompoundCommand covering the entire drag.
    // One Ctrl+Z undoes the whole drag, not individual pixels.
    if (this.wasDragging && this._dragStartPositions && this._dragStartPositions.size > 0) {
        const moveCommands = [];
        this._dragStartPositions.forEach((start, note) => {
            if (note.time !== start.time || note.zone !== start.zone) {
                // Create command that records start -> current, but skip execute()
                // since the note is already at the new position visually.
                const cmd = new MoveNoteCommand(
                    this._chartData,
                    note,
                    start.time,
                    start.zone,
                    note.time,
                    note.zone
                );
                // Override execute so it does NOT re-apply the move (already done)
                cmd.execute = () => {
                    note.time = cmd.newTime;
                    note.zone = cmd.newZone;
                    cmd.chartData.raw.notes.sort((a, b) => a.time - b.time);
                };
                moveCommands.push(cmd);
            }
        });
        this._dragStartPositions = null;

        if (moveCommands.length > 0) {
            // Push to history without calling execute() again
            const compound = new CompoundCommand(moveCommands);
            if (this.commandManager.currentIndex < this.commandManager.history.length - 1) {
                this.commandManager.history = this.commandManager.history.slice(0, this.commandManager.currentIndex + 1);
            }
            this.commandManager.history.push(compound);
            this.commandManager.currentIndex++;
            if (this.commandManager.autoSaveManager) {
                this.commandManager.autoSaveManager.markUnsaved();
            }
        }
    }

    this._chartData.raw.notes.sort((a, b) => a.time - b.time); // Re-sort after moving
    this.dirtyFlags.notes = true;
    this.throttledRedraw();
};

Timeline.prototype.onHoldResizeMove = function(event) {
    if (!this.isResizingHold || !this.resizingNote) return;
    
    const pxToMs = (px) => (px + this.offset) / this.zoom;
    let newEndTime = pxToMs(event.offsetX);
    
    if (this.snapEnabled) {
        newEndTime = this.snapToBeat(newEndTime);
    }
    
    let newDuration = newEndTime - this.resizingNote.time;
    newDuration = Math.max(50, newDuration); // 50ms min duration
    
    if (newDuration !== this.resizingNote.duration) {
        this.resizingNote.duration = newDuration;
        this.dirtyFlags.notes = true;
        this.throttledRedraw();
        
        if (this.onNoteSelected) {
            this.onNoteSelected(this.resizingNote);
        }
    }
};

Timeline.prototype.onHoldResizeUp = function() {
    this.isResizingHold = false;
    this.resizingNote = null;
    this.app.view.removeEventListener('pointermove', this.boundHoldResizeMove);
    this.app.view.removeEventListener('pointerup', this.boundHoldResizeUp);
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
        if (this.selectedNoteType === 'hold') {
            newNote.duration = 250; // Give hold notes a default tail to allow resizing
        }
        this.commandManager.execute(new AddNoteCommand(this._chartData, newNote));
        this.dirtyFlags.notes = true;
        this.throttledRedraw();
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

            // Mark everything as dirty and use throttled redraw
            this.markAllDirty();
            this.throttledRedraw();

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

        // Mark everything as dirty
        this.markAllDirty();
        this.throttledRedraw();
    }
};

Timeline.prototype.smoothScroll = function () {
    if (!this.isScrolling) return;

    // Apply velocity to offset
    this.offset += this.scrollVelocity;

    // Calculate max offset based on audio duration
    let chartDuration = 180000; // Default 3 minutes
    if (this.audioPlayer && this.audioPlayer.duration && !isNaN(this.audioPlayer.duration)) {
        chartDuration = this.audioPlayer.duration * 1000; // Convert to milliseconds
    } else if (this._chartData.metadata?.duration) {
        chartDuration = this._chartData.metadata.duration;
    }
    const totalContentWidth = chartDuration * this.zoom;
    const maxOffset = Math.max(0, totalContentWidth - this.app.renderer.width);

    // Clamp offset between 0 and maxOffset
    this.offset = Math.max(0, Math.min(this.offset, maxOffset));

    // Apply friction/easing
    this.scrollVelocity *= 0.85; // Friction coefficient (0.85 = smooth deceleration)

    // Stop scrolling when velocity is very small
    if (Math.abs(this.scrollVelocity) < 0.1) {
        this.scrollVelocity = 0;
        this.isScrolling = false;
    }

    // Mark everything as dirty and use throttled redraw
    this.markAllDirty();
    this.throttledRedraw();

    // Continue animation
    if (this.isScrolling) {
        requestAnimationFrame(() => this.smoothScroll());
    }
};

Timeline.prototype.onKeyDown = function (event) {
    if (event.key === 'Delete') {
        event.preventDefault(); // Prevent browser default action

        // Check selectionManager first — supports bulk delete
        if (this.selectionManager && this.selectionManager.getCount() > 0) {
            // Delegate bulk delete to the editor (uses filter-based safe deletion)
            if (this.onDeleteSelected) {
                this.onDeleteSelected();
            } else {
                // Fallback: use CommandManager for each note individually (single-note safe path)
                const selected = this.selectionManager.getSelection();
                selected.forEach(note => {
                    this.commandManager.execute(new DeleteNoteCommand(this._chartData, note));
                });
                this.selectionManager.clearSelection();
                this.selectedNote = null;
                if (this.onNoteSelected) this.onNoteSelected(null);
                this.dirtyFlags.notes = true;
                this.throttledRedraw();
            }
        } else if (this.selectedNote) {
            // Legacy single-note path (no selectionManager or empty selection)
            this.commandManager.execute(new DeleteNoteCommand(this._chartData, this.selectedNote));
            this.selectedNote = null;
            if (this.onNoteSelected) this.onNoteSelected(null);
            this.dirtyFlags.notes = true;
            this.throttledRedraw();
        }
    }
};

Timeline.prototype.snapToBeat = function (timeInMs) {
    // Get BPM at this time with fallback
    const bpm = this._chartData.getBPMAtTime(timeInMs);
    if (!bpm || bpm <= 0 || !isFinite(bpm)) return timeInMs;

    // Find the BPM change that applies to this time
    let bpmChanges = this._chartData.bpmChanges;
    if (!bpmChanges || bpmChanges.length === 0) {
        const defaultBpm = this._chartData.raw?.meta?.bpm?.init || this._chartData.raw?.meta?.bpm || 120;
        bpmChanges = [{ time: 0, bpm: defaultBpm }];
    }

    // Validate and find active BPM change
    let activeBpmChange = bpmChanges[0];
    for (let i = bpmChanges.length - 1; i >= 0; i--) {
        if (bpmChanges[i] &&
            typeof bpmChanges[i].time === 'number' &&
            typeof bpmChanges[i].bpm === 'number' &&
            bpmChanges[i].time <= timeInMs) {
            activeBpmChange = bpmChanges[i];
            break;
        }
    }

    // Safety check
    if (!activeBpmChange || !activeBpmChange.bpm || activeBpmChange.bpm <= 0) {
        return timeInMs;
    }

    const msPerBeat = 60000 / activeBpmChange.bpm;
    const snapInterval = msPerBeat / this.snapDivision;

    // Calculate time relative to the BPM change point
    const timeFromBpmChange = timeInMs - activeBpmChange.time;
    const snappedTimeFromBpmChange = Math.round(timeFromBpmChange / snapInterval) * snapInterval;

    // Return absolute time
    return activeBpmChange.time + snappedTimeFromBpmChange;
};

Timeline.prototype.update = function () {
    // Redraw on chart data change
    this.markAllDirty();
    this.performRedraw();
};

// Performance optimization: Mark all components as needing redraw
Timeline.prototype.markAllDirty = function () {
    this.dirtyFlags.grid = true;
    this.dirtyFlags.notes = true;
    this.dirtyFlags.markers = true;
    this.dirtyFlags.scrollbar = true;
    this.dirtyFlags.timeIndicator = true;
};

// Performance optimization: Throttled redraw to prevent excessive GPU calls
Timeline.prototype.throttledRedraw = function () {
    const now = performance.now();
    const timeSinceLastRedraw = now - this.lastRedrawTime;

    if (timeSinceLastRedraw >= this.redrawThrottleMs) {
        // Enough time has passed, redraw immediately
        this.performRedraw();
        this.lastRedrawTime = now;
        this.pendingRedraw = false;
    } else if (!this.pendingRedraw) {
        // Schedule a redraw for later
        this.pendingRedraw = true;
        const delay = this.redrawThrottleMs - timeSinceLastRedraw;
        setTimeout(() => {
            this.performRedraw();
            this.lastRedrawTime = performance.now();
            this.pendingRedraw = false;
        }, delay);
    }
};

// Performance optimization: Actual redraw function
Timeline.prototype.performRedraw = function () {
    this.createGrid();
    this.drawNotes();
    this.drawMarkers();
    this.updateScrollbar();
    this.drawCurrentTimeIndicator(this.audioPlayer ? this.audioPlayer.currentTime * 1000 : 0);
};

Timeline.prototype.setZoom = function (newZoom) {
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.01, Math.min(10, newZoom));

    // Adjust offset to zoom towards the center of the view
    const centerX = this.app.screen.width / 2;
    const chartTimeAtCenter = (this.offset + centerX) / oldZoom;
    this.offset = chartTimeAtCenter * this.zoom - centerX;

    this.markAllDirty();
    this.performRedraw();
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

        // Mark everything as dirty and use throttled redraw
        this.markAllDirty();
        this.throttledRedraw();

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
    this.dirtyFlags.markers = true;
    this.throttledRedraw();
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
            this.markAllDirty();
            this.performRedraw(); // Use immediate redraw for auto-scroll (not throttled)
        }
        // If playhead is before the left edge (e.g., after seeking backward), scroll to show it
        else if (x < 0) {
            this.offset = Math.max(0, currentTime * this.zoom - (viewWidth * 0.1));
            this.markAllDirty();
            this.performRedraw(); // Use immediate redraw for auto-scroll (not throttled)
        }
    }
};

Timeline.prototype.setWaveformColor = function (color) {
    this.waveformRenderer.setColor(color);
    this.dirtyFlags.grid = true;
    this.dirtyFlags.scrollbar = true;
    this.performRedraw();
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
    // Use actual audio duration if available, otherwise fall back to chart metadata or default
    let chartDuration = 180000; // Default 3 minutes
    if (this.audioPlayer && this.audioPlayer.duration && !isNaN(this.audioPlayer.duration)) {
        chartDuration = this.audioPlayer.duration * 1000; // Convert to milliseconds
    } else if (this._chartData.metadata?.duration) {
        chartDuration = this._chartData.metadata.duration;
    }
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

    // Mark everything as dirty and use throttled redraw
    this.markAllDirty();
    this.throttledRedraw();
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
