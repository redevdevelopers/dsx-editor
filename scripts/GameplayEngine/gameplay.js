import { createHexGrid } from '../hexGrid.js';
import { createParallaxBackground } from '../UI/background.js';
import { spawnNote } from '../noteAnimation.js';
import { showHitFeedback } from '../hitFeedback.js';
import { drawHex } from '../Utils/utils.js';
import { soundManager } from '../audioEngine/soundManager.js';
import { tryHit } from '../hitAndCombo.js';

const { PIXI } = window;

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
        this.hexShakeAnimations = []; // Re-added for shakeHex

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
            if (a.ringGlow) a.ringGlow.destroy();
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
            if (a.ringGlow) a.ringGlow.destroy();
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
        // Show a 'perfect' feedback for visual effect, doesn't affect score
        showHitFeedback(this, 'perfect', zone);
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

    destroy() {
        this.stop();
        if (this._app) {
            this._app.destroy(true, { children: true, texture: true, basePath: true });
            this._app = null;
        }
        this.activeNotes = [];
        this.activeParticles = [];
        this.hexAnimations = [];
        this.hexShakeAnimations = []; // Re-added for shakeHex
        this.parent = null;
        this.input = null;
        this.settings = null;
        console.log('Gameplay instance destroyed.');
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

        // Update active notes
        for (let i = this.activeNotes.length - 1; i >= 0; i--) {
            const a = this.activeNotes[i];
            const progress = (now - (a.targetTime - this.approachTime)) / this.approachTime;
            const pos = this.zonePositions[a.zone];

            if (!pos) {
                if (a.sprite) a.sprite.destroy();
                if (a.ring) a.ring.destroy();
                this.activeNotes.splice(i, 1);
                continue;
            }

            // Note is off-screen (missed), remove it
            if (progress >= 1.1) {
                showHitFeedback(this, 'perfect', a.zone); // Treat miss as perfect for visual feedback
                if (a.sprite) a.sprite.destroy();
                if (a.ring) a.ring.destroy();
                if (a.ringGlow) a.ringGlow.destroy();
                if (a.arc) a.arc.destroy();
                this.activeNotes.splice(i, 1);
                continue;
            }

            // Autoplay hit detection
            const hitThreshold = 0.98; // When the note is very close to the hit line
            if (progress >= hitThreshold && !a.hit) {
                showHitFeedback(this, 'perfect', a.zone); // Show perfect feedback
                soundManager.play('perfect'); // Play perfect sound
                a.hit = true; // Mark as hit to prevent multiple triggers
                // Remove the note visually and from activeNotes after a short delay
                setTimeout(() => {
                    if (a.sprite) a.sprite.destroy();
                    if (a.ring) a.ring.destroy();
                    if (a.ringGlow) a.ringGlow.destroy();
                    if (a.arc) a.arc.destroy();
                    const index = this.activeNotes.indexOf(a);
                    if (index > -1) {
                        this.activeNotes.splice(index, 1);
                    }
                }, 100); // Short delay for visual effect
                continue;
            }

            const t = Math.max(0, Math.min(1, progress));

            a.sprite.x = pos.x;
            a.sprite.y = pos.y;
            a.sprite.alpha = Math.min(1, t * 2);

            if (a.ring) {
                a.ring.x = pos.x; a.ring.y = pos.y;
                const easedT = t * t; // Quadratic ease-in for a "rush" effect
                const ringScale = 2.2 - (1.2 * easedT); // 2.2 -> 1.0
                a.ring.scale.set(Math.max(0.2, Math.min(2.2, ringScale)));
                a.ring.alpha = Math.pow(t, 3) * 0.95;
            }
            if (a.ringGlow) {
                a.ringGlow.x = pos.x; a.ringGlow.y = pos.y;
                a.ringGlow.alpha = 0.25 * (1 - t);
                a.ringGlow.scale.set(1.0 + 0.15 * (1 - t));
            }
        }

        // Animate particles
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            p.life -= 16 * (delta || 1);
            if (p.life <= 0) {
                if (p.glow) p.glow.destroy();
                p.sprite.destroy();
                this.activeParticles.splice(i, 1);
                continue;
            }
            p.x += p.vx * (delta || 1);
            p.y += p.vy * (delta || 1);
            p.sprite.x = p.x; p.sprite.y = p.y;
            p.sprite.alpha = p.life / p.maxLife;
            p.sprite.scale.set(1 + (1 - p.life / p.maxLife) * 0.6);
            if (p.glow) {
                p.glow.x = p.x; p.glow.y = p.y;
                p.glow.alpha = (p.life / p.maxLife) * 0.45;
                p.glow.scale.set(1 + (1 - p.life / p.maxLife) * 0.8);
            }
        }

        // Animate zone glows
        const time = performance.now() / 1000;
        for (let zi = 0; zi < this.zoneGlows.length; zi++) {
            const g = this.zoneGlows[zi];
            const idle = 0.03 * Math.sin(time * 2 + zi);
            const sinceHit = (performance.now() - (this.zoneLastHit[zi] || 0));
            const hitPulse = sinceHit < 600 ? (1 - sinceHit / 600) * 0.6 : 0;
            g.scale.set(1 + idle + hitPulse);
            g.alpha = 0.2 + hitPulse * 0.6;
        }

        // Animate hexagons (press bounce)
        for (let i = this.hexAnimations.length - 1; i >= 0; i--) {
            const anim = this.hexAnimations[i];
            const elapsed = performance.now() - anim.startTime;
            const t = Math.min(1, elapsed / anim.duration);

            if (t >= 1) {
                anim.hex.scale.set(anim.originalScale);
                this.hexAnimations.splice(i, 1);
                continue;
            }

            // Simple bounce: scale up then back down
            const scaleT = t < 0.5 ? t * 2 : 1 - ((t - 0.5) * 2);
            const scale = anim.originalScale + (anim.targetScale - anim.originalScale) * scaleT;
            anim.hex.scale.set(scale);
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

        // input handling for visual feedback and hit detection
        const pressedZones = (this.input && this.input.getPressedZones) ? this.input.getPressedZones() : [];
        for (const z of pressedZones) {
            const hex = this._getZoneHex(z);
            if (hex) {
                this.hexAnimations = this.hexAnimations.filter(a => a.hex !== hex);
                const originalScale = hex.scale.x || 1;
                this.hexAnimations.push({ hex, startTime: performance.now(), duration: 160, originalScale, targetScale: originalScale * 1.1 });
            }
            // Call _tryHit for actual hit detection
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
}