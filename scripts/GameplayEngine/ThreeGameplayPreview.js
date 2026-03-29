/**
 * ThreeGameplayPreview
 * Wraps ThreeGameplayLayer to provide the same API as the old PixiJS Gameplay class.
 * Drop-in replacement: chartEditor.js only changes the import line + constructor call.
 */
import { ThreeGameplayLayer, CFG } from './threeGameplayLayer.js';
import { soundManager } from '../audioEngine/soundManager.js';

// Approach time in seconds (default 2.0s = 2000ms)
const DEFAULT_APPROACH_SEC = 2.0;

export class ThreeGameplayPreview {
    constructor({ parent, input, settings = {} }) {
        this.parent  = parent;
        this.input   = input;
        this._clock  = null;
        this._chart  = { notes: [], transitions: [] };

        // Approach time in MILLISECONDS (matches old Gameplay.approachTime)
        this._approachMs = settings.noteApproachTime || 2000;

        // State
        this._running       = false;
        this._rafId         = null;
        this._scheduledIdx  = 0;
        this._activeNotes   = [];
        this._lastFrameTime = 0;
        this._fps           = 0;
        this._frameCount    = 0;
        this._fpsTimer      = 0;

        // Fake app.ticker.FPS & renderer shim — chartEditor.js reads this for status bar and window resize
        const self = this;
        this.app = { 
            ticker: { get FPS() { return self._fps; } },
            renderer: { 
                resize: (w, h) => {
                    if (self._layer && self._layer.renderer) {
                        self._layer.renderer.setSize(w, h);
                        self._layer.camera.aspect = w / h;
                        self._layer.camera.updateProjectionMatrix();
                    }
                }
            } 
        };

        // Dummy objects for legacy PixiJS Gameplay resize logic in chartEditor.js
        this.hexGroup  = { removeChildren: () => {} };
        this.glowLayer = { removeChildren: () => {} };
        this.uiLayer   = { removeChildren: () => {} };
        this.bgLayer   = { removeChildren: () => {} };
        this._createParallaxBackground = () => {};
        this._createHexGrid = () => {};

        // Mount Three.js layer into the preview container
        this._layer = new ThreeGameplayLayer(parent, /* editorMode= */ true);

        // Sync CFG approach time
        CFG.approachTime = this._approachMs / 1000;
        
        // Force an initial render so the track shows up immediately upon app load
        setTimeout(() => this._layer.syncNotes([], 0, this._approachMs), 50);

        // Bind 2D Fever Fireworks Overlay
        parent.addEventListener('dsx-fever-trigger', () => {
            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.inset = '0';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '9999';
            overlay.style.borderRadius = '8px';
            overlay.style.boxShadow = 'inset 0 0 150px rgba(255,255,255,0.8), inset 0 0 50px cyan, inset 0 0 100px magenta';
            overlay.style.mixBlendMode = 'overlay';
            overlay.style.transition = 'opacity 0.6s ease-out';
            parent.appendChild(overlay);

            // Force reflow and trigger fade out
            void overlay.offsetWidth;
            overlay.style.opacity = '0';

            setTimeout(() => overlay.remove(), 600);
        });

        this._lastHitCheckMs = 0;
        this._wasHolding = false;
    }

    // ── Clock (slaved to editor's audio player) ───────────────────────────────
    setClock(clock) { this._clock = clock; }

    _nowMs() { return this._clock ? this._clock.getCurrentTime() : 0; }

    // ── Approach time (ms) ───────────────────────────────────────────────────
    get approachTime() { return this._approachMs; }
    set approachTime(ms) {
        this._approachMs = ms;
        CFG.approachTime = ms / 1000;
    }
    setNoteApproachTime(ms) { this.approachTime = ms; }

    // ── Chart data ───────────────────────────────────────────────────────────
    setChart(notes) {
        this._chart = { notes: notes || [], transitions: [] };
        if (this._wasHolding) {
            soundManager.stopLoop('slide');
            this._wasHolding = false;
        }
        this._reset();
    }

    setChartWithTransitions(chartData) {
        this._chart = {
            notes:       chartData.notes       || [],
            transitions: chartData.transitions || [],
        };
        this._reset();
    }

    // ── Playback control ─────────────────────────────────────────────────────
    start() {
        if (this._running) return;
        this._running      = true;
        this._lastFrameTime = performance.now();
        this._lastHitCheckMs = this._nowMs();
        
        const nowMs = this._nowMs();
        this._scheduledIdx = this._chart.notes.findIndex(n => n.time >= nowMs - this._approachMs);
        if (this._scheduledIdx === -1) this._scheduledIdx = this._chart.notes.length;
        this._tick();
    }

    stop() {
        this._running = false;
        if (this._wasHolding) {
            soundManager.stopLoop('slide');
            this._wasHolding = false;
        }
        if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    }

    reset() { this._reset(); }

    _reset() {
        // Clear all visuals
        this._lastHitCheckMs = this._nowMs();
        if (this._wasHolding) {
            soundManager.stopLoop('slide');
            this._wasHolding = false;
        }
        this._layer.syncNotes([], this._nowMs(), this._approachMs);
    }

    // ── Visual feedback (recording mode) ─────────────────────────────────────
    showHit(zone) {
        this._layer.pressLane(zone);
    }

    _getEngineNotes(nowMs) {
        return this._chart.notes
            .map((note, idx) => ({
                index: idx,
                zone: note.zone,
                targetTime: note.time,
                holdDuration: note.duration || 0,
                holdStarted: note.time <= nowMs && (note.time + (note.duration || 0)) >= nowMs,
                hit: note.time + (note.duration || 0) < nowMs,
                isExNote: note.type === 'ex',
                isEx2Note: note.type === 'ex2',
                isFlick: note.type === 'flick',
                hitSound: note.hitSound || '',
                tailType: note.tailType || '',
                tailSound: note.tailSound || ''
            }))
            .filter(n => {
                const endTime = n.targetTime + n.holdDuration;
                // Note is visible if it hasn't despawned (1000ms after end time) and has spawned (approachMs before start)
                return endTime > nowMs - 1000 && n.targetTime <= nowMs + this._approachMs;
            });
    }

    // ── Scrub preview while paused ───────────────────────────────────────────
    previewAtTime(timeMs) {
        if (this._running) return;
        const notes = this._getEngineNotes(timeMs);
        this._layer.syncNotes(notes, timeMs, this._approachMs);
    }

    // ── Destroy ──────────────────────────────────────────────────────────────
    destroy() {
        this.stop();
        if (this._layer && this._layer.renderer) {
            this._layer.renderer.dispose();
        }
    }

    // ── RAF loop ─────────────────────────────────────────────────────────────
    _tick() {
        if (!this._running) return;

        const nowPerf = performance.now();
        const delta   = (nowPerf - this._lastFrameTime) / 1000;
        this._lastFrameTime = nowPerf;

        // FPS tracking
        this._frameCount++;
        this._fpsTimer += delta;
        if (this._fpsTimer >= 1.0) {
            this._fps       = Math.round(this._frameCount / this._fpsTimer);
            this._frameCount = 0;
            this._fpsTimer   = 0;
        }

        const nowMs  = this._nowMs();
        const notes  = this._getEngineNotes(nowMs);
        
        // Track global hold state for the slide sound
        let currentlyHolding = false;

        // Trigger simulated gameplay hits (sound + lane effects)
        if (this._chart.notes && this._chart.notes.length > 0) {
            for (let i = 0; i < this._chart.notes.length; i++) {
                const n = this._chart.notes[i];
                
                // Track if we are inside a hold window
                if (n.type === 'hold' && n.duration > 0) {
                    if (n.time <= nowMs && n.time + n.duration > nowMs) {
                        currentlyHolding = true;
                    }
                }
                
                // --- Head Hit Logic ---
                if (n.time > this._lastHitCheckMs && n.time <= nowMs + 10) {
                    let playedSound = 'incoming';

                    if (n.hitSound) {
                        soundManager.play(n.hitSound);
                        playedSound = n.hitSound;
                    }
                    else if (n.type === 'ex') { soundManager.play('ex'); playedSound = 'ex'; }
                    else if (n.type === 'ex2') { soundManager.play('ex2'); playedSound = 'ex2'; }
                    else if (n.type === 'flick') { soundManager.play('incoming'); }
                    else soundManager.play('incoming');

                    // Check for VFX triggers based on sound fired
                    if (playedSound === 'fireworks') {
                        if (this._layer.triggerShake) this._layer.triggerShake(0.8);
                        if (this._layer.triggerFeverFireworks) this._layer.triggerFeverFireworks();
                    } else if (playedSound.startsWith('explosion')) {
                        if (this._layer.triggerShake) this._layer.triggerShake(0.3);
                    }

                    this._layer.triggerHitEffect(n.zone, 'perfect');
                }
                
                // --- Tail Hit Logic ---
                if (n.type === 'hold' && n.duration > 0) {
                    const tailTime = n.time + n.duration;
                    if (tailTime > this._lastHitCheckMs && tailTime <= nowMs + 10) {
                        let playedTailSound = 'incoming';

                        if (n.tailSound) {
                            soundManager.play(n.tailSound);
                            playedTailSound = n.tailSound;
                        }
                        else if (n.tailType === 'flick') soundManager.play('incoming');
                        else soundManager.play('incoming'); // Standard tail release sound if no custom

                        // Check for VFX triggers based on tail sound fired
                        if (playedTailSound === 'fireworks') {
                            if (this._layer.triggerShake) this._layer.triggerShake(0.8);
                            if (this._layer.triggerFeverFireworks) this._layer.triggerFeverFireworks();
                        } else if (playedTailSound.startsWith('explosion')) {
                            if (this._layer.triggerShake) this._layer.triggerShake(0.3);
                        }
                        
                        this._layer.triggerHitEffect(n.zone, 'perfect');
                    }
                }
            }
        }
        
        // Toggle the looping slide sound based on hold state
        if (currentlyHolding && !this._wasHolding) {
            this._wasHolding = true;
            soundManager.playLoop('slide', { volume: 0.6 }); // Volume tuned down slightly for the hum
        } else if (!currentlyHolding && this._wasHolding) {
            this._wasHolding = false;
            soundManager.stopLoop('slide');
        }

        this._lastHitCheckMs = nowMs + 10;
        
        this._layer.syncNotes(notes, nowMs, this._approachMs);

        this._rafId = requestAnimationFrame(() => this._tick());
    }

    // ── Zoom / bloom shims (no-ops, keep API parity) ─────────────────────────
    setZoom() {}
    setBloomEnabled() {}
    setBloomIntensity() {}
    setNoteColor() {}
    setNoteColors() {}
}
