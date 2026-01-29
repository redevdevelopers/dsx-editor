import { createHexGrid } from '../hexGrid.js';
import { createParallaxBackground } from '../UI/background.js';
import { spawnNote } from '../noteAnimation.js';
import { drawHex } from '../Utils/utils.js';
import { soundManager } from '../audioEngine/soundManager.js';
import { tryHit } from '../hitAndCombo.js';

const { PIXI } = window;

// Visual tuning constants (simplified from main game)
const VisualTuning = {
    timing: {
        hexZone: {
            bounceDuration: 160,
            bounceScale: 1.1,
            glowIdleSpeed: 2,
            glowBaseAlpha: 0.2,
            glowHitPulseDuration: 600,
            glowHitPulseIntensity: 0.6,
            incomingFlashDuration: 400,
            incomingFlashIntensity: 0.8,
            bloomAlpha: 0.85
        },
        noteApproach: {
            bodyAlphaMultiplier: 2,
            ringStartScale: 2.2,
            ringEndScale: 1.0,
            ringMinScale: 0.2,
            ringMaxScale: 2.2,
            ringAlphaPower: 3,
            ringAlphaMultiplier: 1.0, // Brightest white (was 0.95)
            arcVisibilityStart: 0.5,
            arcAlpha: 1.0 // Brightest white (was 0.95)
        },
        particles: {
            gravity: 0.3,
            lifeDecay: 16,
            scaleMultiplier: 0.6
        }
    },
    visual: {
        note: {
            approachRingLineWidth: 4, // Thinner (was 8)
            approachRingAlpha: 1.0, // Brightest white (was 0.95)
            timingArcLineWidth: 4, // Thinner (was 6)
            timingArcRadius: 1.1
        }
    },
    colors: {
        approachRing: 0xFFFFFF, // Pure white
        timingArc: 0xFFFFFF // Pure white
    }
};

export class Gameplay {
    get app() {
        return this._app;
    }

    constructor({ parent, input, settings }) {
        this.parent = parent || document.body;
        this.input = input;
        this.settings = settings || {};

        const rendererOpts = Object.assign({ backgroundAlpha: 0, resizeTo: this.parent }, (this.settings && this.settings.renderer) ? this.settings.renderer : {});
        this._app = new PIXI.Application(rendererOpts);
        this.parent.appendChild(this._app.view);
        this.stage = this._app.stage;

        this.bgLayer = new PIXI.Container();
        this.stage.addChildAt(this.bgLayer, 0);
        this._createParallaxBackground();

        this.hexGroup = new PIXI.Container();
        this.stage.addChild(this.hexGroup);

        this.glowLayer = new PIXI.Container();
        this.glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
        this.stage.addChild(this.glowLayer);

        this.uiLayer = new PIXI.Container();
        this.stage.addChild(this.uiLayer);

        this._createHexGrid();

        this.activeParticles = [];
        this.zoneLastHit = new Array(6).fill(0);
        this.incomingFlashes = new Array(6).fill(null); // Track incoming glow flash times per zone

        this.running = false;
        this.chart = { notes: [] };
        this.clock = null;
        this.scheduledIndex = 0;
        this.activeNotes = [];
        this.approachTime = this.settings.noteApproachTime || 550; // ms
        this.latencyOffset = (this.settings.latency || 0); // ms
        this.hitWindows = { 'critical perfect': 180, perfect: 180 };

        this.currentCombo = 0;
        this.maxCombo = 0;

        this.pointer = { x: 0.5, y: 0.5 };
        this.app.view.addEventListener('pointermove', (e) => {
            const r = this.app.view.getBoundingClientRect();
            this.pointer.x = (e.clientX - r.left) / r.width;
            this.pointer.y = (e.clientY - r.top) / r.height;
        });

        this.hexAnimations = [];
        this.hexShakeAnimations = [];

        // Bloom animation state (for smooth fade-out)
        this.bloomTargetScale = new Array(6).fill(1.0);
        this.bloomTargetAlpha = new Array(6).fill(0);
        this.bloomCurrentScale = new Array(6).fill(1.0);
        this.bloomCurrentAlpha = new Array(6).fill(0);

        // Visual settings
        this.gameplayZoom = 1.0;
        this.bloomEnabled = true;
        this.bloomIntensity = 0.5;
        this.noteColors = {
            regular: 0xFF69B4,
            hold: 0xFFD700,
            chain: 0x00CED1,
            multi: 0xFFD700,
            slide: 0x9370DB,
            flick: 0xFF6347
        };

        // Combo Text
        this.comboText = new PIXI.Text('0x', {
            fill: 0xffffff,
            fontSize: 48,
            fontFamily: 'ZenMaruGothic',
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 6,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowBlur: 10,
        });
        this.comboText.anchor.set(0.5);
        this.comboText.x = this.app.screen.width / 2;
        this.comboText.y = this.app.screen.height / 2 + 100; // Adjust position as needed
        this.comboText.alpha = 0; // Start invisible
        this.uiLayer.addChild(this.comboText);
    }

    setClock(clock) {
        this.clock = clock;
    }

    setChart(notes) {
        this.chart = { notes: notes || [] };
        this.scheduledIndex = 0;
        this.activeNotes.forEach(a => {
            if (a.sprite) a.sprite.destroy();
            if (a.ring) a.ring.destroy();
            if (a.arc) a.arc.destroy();
        });
        this.activeNotes = [];
    }

    /**
     * Resets the gameplay state to the current time from the clock.
     * This is used when seeking on the timeline to refresh the visible notes.
     */
    reset() {
        // Clear all currently visible notes and their PIXI objects
        this.activeNotes.forEach(a => {
            if (a.sprite) a.sprite.destroy();
            if (a.ring) a.ring.destroy();
            if (a.arc) a.arc.destroy();
        });
        this.activeNotes = [];

        // Find the correct note to start scheduling from based on the new time
        const now = this._now();
        this.scheduledIndex = this.chart.notes.findIndex(n => n.time >= now - this.approachTime);
    }

    setNoteApproachTime(time) {
        this.approachTime = time;
    }

    // Called by the editor during recording to give visual feedback
    showHit(zone) {
        const hex = this._getZoneHex(zone);
        if (hex) {
            // Remove any existing animation on this hex to restart it
            this.hexAnimations = this.hexAnimations.filter(a => a.hex !== hex);
            const originalScale = hex.scale.x || 1;
            this.hexAnimations.push({ hex, startTime: performance.now(), duration: 160, originalScale, targetScale: originalScale * 1.1 });
        }
        this.zoneLastHit[zone] = performance.now();
        // Hit feedback disabled for editor
        // showHitFeedback(this, 'perfect', zone);
    }

    start() {
        this.running = true;
        this.app.ticker.add(this._update, this);
        const now = this._now();
        // Find the first note that should be on screen
        this.scheduledIndex = this.chart.notes.findIndex(n => n.time >= now - this.approachTime);
        if (this.scheduledIndex === -1) {
            // All notes are in the past
            this.scheduledIndex = this.chart.notes.length;
        }
    }

    stop() {
        this.running = false;
        this.app.ticker.remove(this._update, this);
    }

    // Preview notes at a specific time (for scrubbing when paused)
    previewAtTime(timeMs) {
        if (this.running) return; // Only preview when stopped

        const tuning = VisualTuning;
        const previewWindow = 2000; // Show notes within 2 seconds

        // Clear existing preview notes
        for (let i = this.activeNotes.length - 1; i >= 0; i--) {
            const a = this.activeNotes[i];
            if (a.sprite) a.sprite.destroy();
            if (a.ring) a.ring.destroy();
            if (a.arc) a.arc.destroy();
        }
        this.activeNotes = [];

        // Find and display notes near current time
        if (this.chart && this.chart.notes) {
            for (const note of this.chart.notes) {
                const timeDiff = note.time - timeMs;

                // Show notes within preview window
                if (timeDiff >= -500 && timeDiff <= previewWindow) {
                    const progress = 1 - (timeDiff / this.approachTime);
                    const pos = this.zonePositions[note.zone];

                    if (!pos) continue;

                    // Create note sprite
                    const sprite = new PIXI.Graphics();
                    sprite.beginFill(0x00ffff, 0.8);
                    sprite.drawCircle(0, 0, tuning.noteRadius);
                    sprite.endFill();
                    sprite.x = pos.x;
                    sprite.y = pos.y;

                    // Create approach ring
                    const ring = new PIXI.Graphics();
                    const ringProgress = Math.max(0, Math.min(1, progress));
                    const ringRadius = tuning.noteRadius + (tuning.approachRingMaxRadius - tuning.noteRadius) * (1 - ringProgress);
                    ring.lineStyle(3, 0x00ffff, 0.6);
                    ring.drawCircle(0, 0, ringRadius);
                    ring.x = pos.x;
                    ring.y = pos.y;

                    this.noteLayer.addChild(ring);
                    this.noteLayer.addChild(sprite);

                    this.activeNotes.push({
                        sprite: sprite,
                        ring: ring,
                        zone: note.zone,
                        targetTime: note.time,
                        isPreview: true
                    });
                }
            }
        }
    }

    destroy() {
        this.stop();
        if (this._app) {
            this._app.destroy(true, { children: true, texture: true, basePath: true });
            this._app = null;
        }
        this.activeNotes = [];
        this.activeParticles = [];
        this.hexAnimations = [];
        this.hexShakeAnimations = [];
        this.parent = null;
        this.input = null;
        this.settings = null;
    }

    _createHexGrid() {
        createHexGrid(this);
    }

    _createParallaxBackground() {
        createParallaxBackground(this);
    }

    _drawHex(g, x, y, r) {
        drawHex(g, x, y, r);
    }

    _spawnNote(note) {
        spawnNote(this, note);
    }

    _now() {
        if (this.clock) {
            return this.clock.getCurrentTime();
        }
        return 0;
    }

    _tryHit(zone) {
        tryHit(this, zone);
    }

    _update(delta) {
        const now = this._now();
        const tuning = VisualTuning;
        const time = performance.now() / 1000;

        // Schedule notes from chart
        if (this.chart && this.chart.notes && this.scheduledIndex < this.chart.notes.length) {
            while (this.scheduledIndex < this.chart.notes.length) {
                const n = this.chart.notes[this.scheduledIndex];
                if (!n || typeof n.time !== 'number' || typeof n.zone !== 'number') {
                    this.scheduledIndex++;
                    continue;
                }
                const spawnTime = n.time - this.approachTime - this.latencyOffset;
                if (now >= spawnTime) {
                    this._spawnNote(n);
                    this.scheduledIndex++;
                } else {
                    break; // Notes are sorted, so we can stop here
                }
            }
        }

        // Update active notes with enhanced visuals
        for (let i = this.activeNotes.length - 1; i >= 0; i--) {
            const a = this.activeNotes[i];
            const progress = (now - (a.targetTime - this.approachTime)) / this.approachTime;
            const pos = this.zonePositions[a.zone];

            if (!pos) {
                if (a.sprite) a.sprite.destroy();
                if (a.ring) a.ring.destroy();
                if (a.arc) a.arc.destroy();
                this.activeNotes.splice(i, 1);
                continue;
            }

            // Note is off-screen (missed), remove it
            if (progress >= 1.1) {
                if (a.sprite) a.sprite.destroy();
                if (a.ring) a.ring.destroy();
                if (a.arc) a.arc.destroy();
                this.activeNotes.splice(i, 1);
                continue;
            }

            // Trigger incoming flash and sound
            if (!a.incomingSoundPlayed && progress > 0.95) {
                soundManager.play('incoming');
                this.incomingFlashes[a.zone] = performance.now();
                a.incomingSoundPlayed = true;
            }

            // Autoplay hit detection
            const hitThreshold = 0.98;
            if (progress >= hitThreshold && !a.hit) {
                soundManager.play('perfect');
                a.hit = true;
                setTimeout(() => {
                    if (a.sprite) a.sprite.destroy();
                    if (a.ring) a.ring.destroy();
                    if (a.arc) a.arc.destroy();
                    const index = this.activeNotes.indexOf(a);
                    if (index > -1) {
                        this.activeNotes.splice(index, 1);
                    }
                }, 100);
                continue;
            }

            const t = Math.max(0, Math.min(1, progress));

            // Note body fade-in with enhanced alpha curve
            a.sprite.x = pos.x;
            a.sprite.y = pos.y;
            const bodyAlpha = Math.min(1, t * tuning.timing.noteApproach.bodyAlphaMultiplier);
            a.sprite.alpha = Math.max(0, Math.min(1, bodyAlpha));

            // Enhanced approach ring with rush effect
            if (a.ring) {
                a.ring.x = pos.x;
                a.ring.y = pos.y;

                // Quadratic ease-in for rush effect
                const easedT = t * t;
                const scaleRange = tuning.timing.noteApproach.ringStartScale - tuning.timing.noteApproach.ringEndScale;
                const ringScale = tuning.timing.noteApproach.ringStartScale - (scaleRange * easedT);
                a.ring.scale.set(Math.max(
                    tuning.timing.noteApproach.ringMinScale,
                    Math.min(tuning.timing.noteApproach.ringMaxScale, ringScale)
                ));

                // Enhanced alpha with power curve
                a.ring.alpha = Math.min(1.0, Math.pow(t, tuning.timing.noteApproach.ringAlphaPower) * tuning.timing.noteApproach.ringAlphaMultiplier);

                // Update note body alpha to fade in (body is stored as 'sprite')
                if (a.sprite) {
                    a.sprite.alpha = Math.min(1.0, Math.pow(t, 0.5) * 1.2); // Fade in brighter and faster
                }

                // Add dynamic glow effect to ring
                if (!a.ring.isTextureRing) {
                    const glowIntensity = Math.pow(t, 1.5);
                    const baseLineWidth = tuning.visual.note.approachRingLineWidth;

                    a.ring.clear();

                    // Outer glow stroke
                    if (glowIntensity > 0.1) {
                        const glowWidth = baseLineWidth + (glowIntensity * 6);
                        a.ring.lineStyle(glowWidth, tuning.colors.approachRing, glowIntensity * 0.4);
                        this._drawHex(a.ring, 0, 0, this.zoneRadius);
                    }

                    // Main ring stroke
                    a.ring.lineStyle(baseLineWidth, tuning.colors.approachRing, tuning.visual.note.approachRingAlpha);
                    this._drawHex(a.ring, 0, 0, this.zoneRadius);
                }
            }

            // Enhanced timing arc
            if (a.arc) {
                a.arc.x = pos.x;
                a.arc.y = pos.y;
                const vis = Math.max(0, (t - tuning.timing.noteApproach.arcVisibilityStart) * 2);
                a.arc.alpha = vis * tuning.timing.noteApproach.arcAlpha;

                // Redraw arc as partial circle
                const frac = Math.max(0.02, 1 - t);
                a.arc.clear();
                a.arc.lineStyle(tuning.visual.note.timingArcLineWidth, tuning.colors.timingArc, tuning.timing.noteApproach.arcAlpha);

                const r = this.zoneRadius * tuning.visual.note.timingArcRadius;
                const steps = 64;
                const endAng = Math.PI * 2 * frac;
                a.arc.moveTo(r, 0);
                for (let s = 0; s <= steps * frac; s++) {
                    const ang = (s / steps) * endAng;
                    a.arc.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
                }
            }
        }

        // Animate particles with gravity
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.life -= tuning.timing.particles.lifeDecay * (delta || 1);
            p.x += p.vx * (delta || 1);
            p.y += p.vy * (delta || 1);
            p.vy += tuning.timing.particles.gravity;
            p.sprite.x = p.x;
            p.sprite.y = p.y;
            p.sprite.alpha = Math.max(0, p.life / p.maxLife);
            p.sprite.scale.set(1 + (1 - p.life / p.maxLife) * tuning.timing.particles.scaleMultiplier);

            if (p.life <= 0) {
                p.sprite.destroy();
                this.activeParticles.splice(i, 1);
            }
        }

        // Enhanced zone glows with idle pulse, hit pulse, and incoming flash
        for (let zi = 0; zi < this.zoneGlows.length; zi++) {
            const g = this.zoneGlows[zi];

            // Idle breathing animation
            const idle = 0.03 * Math.sin(time * tuning.timing.hexZone.glowIdleSpeed + zi);

            // Hit pulse effect
            const sinceHit = (performance.now() - (this.zoneLastHit[zi] || 0));
            const hitPulse = sinceHit < tuning.timing.hexZone.glowHitPulseDuration ?
                (1 - sinceHit / tuning.timing.hexZone.glowHitPulseDuration) * tuning.timing.hexZone.glowHitPulseIntensity : 0;

            // Incoming note flash effect
            let incomingFlash = 0;
            if (this.incomingFlashes[zi] !== null) {
                const timeSinceFlash = performance.now() - this.incomingFlashes[zi];
                if (timeSinceFlash < tuning.timing.hexZone.incomingFlashDuration) {
                    const flashProgress = timeSinceFlash / tuning.timing.hexZone.incomingFlashDuration;
                    incomingFlash = (1 - flashProgress) * tuning.timing.hexZone.incomingFlashIntensity;
                } else {
                    this.incomingFlashes[zi] = null;
                }
            }

            g.scale.set(1 + idle + hitPulse);
            g.alpha = tuning.timing.hexZone.glowBaseAlpha + hitPulse * tuning.timing.hexZone.glowHitPulseIntensity + incomingFlash;
        }

        // Enhanced bloom blobs with smooth pulsing based on incoming notes
        if (this.zoneBlooms && this.zoneBlooms.length > 0) {
            for (let i = 0; i < this.zoneBlooms.length; i++) {
                const b = this.zoneBlooms[i];
                if (!b) continue;

                // Disable pointer follow for editor (keep blooms static)
                const targetX = this.zonePositions[i].x;
                const targetY = this.zonePositions[i].y;
                b.x += (targetX - b.x) * 0.08;
                b.y += (targetY - b.y) * 0.08;
                b.rotation = Math.sin(time + i) * 0.02;

                b.visible = true;

                // Check for incoming notes and calculate bloom pulse
                let maxNoteProgress = 0;
                for (const note of this.activeNotes) {
                    if (note.zone === i) {
                        const progress = (now - (note.targetTime - this.approachTime)) / this.approachTime;
                        if (progress >= 0.5 && progress <= 1.0) {
                            maxNoteProgress = Math.max(maxNoteProgress, progress);
                        }
                    }
                }

                // Calculate target bloom values
                if (maxNoteProgress > 0.5) {
                    const pulseProgress = (maxNoteProgress - 0.5) * 2;
                    const pulsePower = Math.pow(pulseProgress, 1.5);
                    const scaleBoost = pulsePower * 0.3;
                    const alphaBoost = pulsePower * 0.6;

                    this.bloomTargetScale[i] = 1.0 + scaleBoost;
                    this.bloomTargetAlpha[i] = alphaBoost;
                } else {
                    this.bloomTargetScale[i] = 1.0;
                    this.bloomTargetAlpha[i] = 0;
                }

                // Smooth interpolation (fast approach, slow fade)
                const lerpSpeed = (this.bloomCurrentScale[i] < this.bloomTargetScale[i]) ? 0.15 : 0.04;
                this.bloomCurrentScale[i] += (this.bloomTargetScale[i] - this.bloomCurrentScale[i]) * lerpSpeed;
                this.bloomCurrentAlpha[i] += (this.bloomTargetAlpha[i] - this.bloomCurrentAlpha[i]) * lerpSpeed;

                // Apply smoothed values
                b.scale.set(this.bloomCurrentScale[i]);
                b.alpha = tuning.timing.hexZone.bloomAlpha + this.bloomCurrentAlpha[i];
            }
        }

        // Background parallax animation (cursor movement disabled for editor)
        if (this.starLayer) {
            // Only sine wave drift, no cursor tracking
            this.starLayer.x = Math.sin(time * 0.2) * 6;
            this.starLayer.y = Math.cos(time * 0.17) * 4;
        }

        // Keep background sized (if present)
        if (typeof this._updateBackgroundLayout === 'function') {
            this._updateBackgroundLayout();
        }

        // Animate hexagons (press bounce with smooth easing)
        for (let i = this.hexAnimations.length - 1; i >= 0; i--) {
            const anim = this.hexAnimations[i];
            const elapsed = performance.now() - anim.startTime;
            const t = Math.min(1, elapsed / anim.duration);

            if (t < 0.5) {
                const scale = anim.originalScale + (anim.targetScale - anim.originalScale) * (t * 2);
                anim.hex.scale.set(scale);
            } else {
                const scale = anim.targetScale + (anim.originalScale - anim.targetScale) * ((t - 0.5) * 2);
                anim.hex.scale.set(scale);
            }

            if (t >= 1) {
                anim.hex.scale.set(anim.originalScale);
                this.hexAnimations.splice(i, 1);
            }
        }

        // Animate hex shakes
        for (let i = this.hexShakeAnimations.length - 1; i >= 0; i--) {
            const anim = this.hexShakeAnimations[i];
            const elapsed = performance.now() - anim.startTime;
            const t = Math.min(1, elapsed / anim.duration);

            if (t < 1) {
                const magnitude = anim.magnitude * (1 - t);
                const offsetX = (Math.random() - 0.5) * magnitude;
                const offsetY = (Math.random() - 0.5) * magnitude;
                anim.hex.x = anim.originalX + offsetX;
                anim.hex.y = anim.originalY + offsetY;
            } else {
                anim.hex.x = anim.originalX;
                anim.hex.y = anim.originalY;
                this.hexShakeAnimations.splice(i, 1);
            }
        }

        // Input handling for visual feedback
        const pressedZones = (this.input && this.input.getPressedZones) ? this.input.getPressedZones() : [];
        for (const z of pressedZones) {
            const hex = this._getZoneHex(z);
            if (hex) {
                this.hexAnimations = this.hexAnimations.filter(a => a.hex !== hex);
                const originalScale = hex.scale.x || 1;
                this.hexAnimations.push({
                    hex,
                    startTime: performance.now(),
                    duration: tuning.timing.hexZone.bounceDuration,
                    originalScale,
                    targetScale: originalScale * tuning.timing.hexZone.bounceScale
                });
            }
            this._tryHit(z);
        }
    }

    _getZoneHex(index) {
        try {
            const pos = this.zonePositions[index];
            if (!pos) return null;
            let closest = null; let best = 1e9;
            for (const child of this.hexGroup.children) {
                if (child && child.position && typeof child.x === 'number' && typeof child.y === 'number') {
                    const dx = child.x - pos.x; const dy = child.y - pos.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < best) { best = d2; closest = child; }
                }
            }
            return closest;
        } catch { return null; }
    }

    /**
     * Set gameplay area zoom level
     * @param {number} zoom - Zoom level (0.5 to 2.0)
     */
    setZoom(zoom) {
        this.gameplayZoom = Math.max(0.5, Math.min(2.0, zoom));
        if (this.hexGroup) {
            this.hexGroup.scale.set(this.gameplayZoom);
        }
        if (this.glowLayer) {
            this.glowLayer.scale.set(this.gameplayZoom);
        }
    }

    /**
     * Enable or disable bloom effect
     * @param {boolean} enabled
     */
    setBloomEnabled(enabled) {
        this.bloomEnabled = enabled;
    }

    /**
     * Set bloom intensity
     * @param {number} intensity - Intensity (0.0 to 1.0)
     */
    setBloomIntensity(intensity) {
        this.bloomIntensity = Math.max(0, Math.min(1, intensity));
    }

    /**
     * Set color for a specific note type
     * @param {string} noteType - Note type (regular, hold, chain, multi, slide, flick)
     * @param {string} color - Hex color string (e.g., '#FF69B4')
     */
    setNoteColor(noteType, color) {
        // Convert hex string to number
        const colorNum = parseInt(color.replace('#', ''), 16);
        this.noteColors[noteType] = colorNum;
    }

    /**
     * Set all note colors at once
     * @param {Object} colors - Object with note type keys and hex color values
     */
    setNoteColors(colors) {
        Object.keys(colors).forEach(noteType => {
            this.setNoteColor(noteType, colors[noteType]);
        });
    }
}