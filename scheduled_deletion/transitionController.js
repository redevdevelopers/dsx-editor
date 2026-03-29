import { getHexPosition, getCenterPosition } from './hexGrid.js';
import { drawHex } from './Utils/utils.js';
import { soundManager } from './audioEngine/soundManager.js';

const { PIXI } = window;

/**
 * Transition Controller - Manages layout mode transitions
 */
export class TransitionController {
    constructor(game) {
        this.game = game;
        this.state = {
            currentMode: 'honeycomb',
            isTransitioning: false,
            transitionProgress: 0.0,
            sourceMode: null,
            targetMode: null,
            startTime: null,
            duration: 0
        };
        this.transitions = [];
        this.nextTransitionIndex = 0;
        this.onTransitionComplete = null;
        this.lastSeekTime = 0; // Track last time for seek detection
    }

    /**
     * Load transitions from chart data
     */
    loadTransitions(transitionsArray) {
        if (!Array.isArray(transitionsArray)) {
            this.transitions = [];
            return;
        }

        // Parse and validate transitions
        this.transitions = transitionsArray
            .filter(t => {
                if (!t || typeof t.time !== 'number') {
                    console.warn('[TransitionController] Skipping transition with invalid time:', t);
                    return false;
                }
                if (!t.mode || (t.mode !== 'honeycomb' && t.mode !== 'ring')) {
                    console.warn('[TransitionController] Skipping transition with invalid mode:', t);
                    return false;
                }
                return true;
            })
            .map(t => ({
                time: t.time,
                mode: t.mode,
                duration: (typeof t.duration === 'number' && t.duration > 0) ? t.duration : 1000,
                // Animation customization options
                easing: t.easing || 'easeInOutCubic',
                scaleFrom: (typeof t.scaleFrom === 'number') ? t.scaleFrom : 0.8,
                scaleTo: (typeof t.scaleTo === 'number') ? t.scaleTo : 1.0,
                cameraZoom: (typeof t.cameraZoom === 'number') ? t.cameraZoom : null,
                showRingBoundary: (t.showRingBoundary !== false),
                showCenterMarker: (t.showCenterMarker !== false),
                flashIntensity: (typeof t.flashIntensity === 'number') ? t.flashIntensity : 0.5,
                particleCount: (typeof t.particleCount === 'number') ? t.particleCount : 20
            }))
            .sort((a, b) => a.time - b.time);

        this.nextTransitionIndex = 0;
        console.log('[TransitionController] Loaded transitions:', this.transitions);
    }

    /**
     * Get current layout mode
     * @returns {string} Current mode ('honeycomb' or 'ring')
     */
    getCurrentMode() {
        return this.state.currentMode;
    }

    /**
     * Determine which mode should be active at a given time
     * @param {number} time - Time in milliseconds
     * @returns {string} 'honeycomb' or 'ring'
     */
    getModeAtTime(time) {
        // Find the last transition before or at this time
        let activeMode = 'honeycomb'; // Default starting mode

        for (const transition of this.transitions) {
            if (transition.time <= time) {
                activeMode = transition.mode;
            } else {
                break; // Transitions are sorted, so we can stop
            }
        }

        return activeMode;
    }

    /**
     * Update ring boundary and center marker visibility
     * @param {number} alpha - Target alpha (0 or 1)
     */
    updateRingVisuals(alpha) {
        if (this.game.centerMarker) {
            this.game.centerMarker.alpha = alpha;
        }
        if (this.game.ringBoundary) {
            this.game.ringBoundary.alpha = alpha;
            // Always keep ring boundary at full scale
            this.game.ringBoundary.scale.set(1.0);
        }
    }

    /**
     * Update camera zoom for mode
     * @param {string} mode - Current mode
     */
    updateCameraZoom(mode) {
        // Editor: Disable camera zoom to prevent positioning issues
        // The editor canvas is smaller and zoom causes hex grid to be off-center
        const zoom = 1.0; // Always 1.0 for editor
        if (this.game.hexGroup) {
            this.game.hexGroup.scale.set(zoom);
        }
        if (this.game.glowLayer) {
            this.game.glowLayer.scale.set(zoom);
        }
    }

    /**
     * Update combo text position for mode
     * @param {string} mode - Current mode
     */
    updateComboPosition(mode) {
        if (!this.game.comboText) return;

        const width = this.game.app.renderer.width;
        const height = this.game.app.renderer.height;

        if (mode === 'ring') {
            // Bottom-left corner
            this.game.comboText.x = 120;
            this.game.comboText.y = height - 80;
            this.game.comboText.anchor.set(0, 1);
        } else {
            // Center
            this.game.comboText.x = width / 2;
            this.game.comboText.y = height * 0.25;
            this.game.comboText.anchor.set(0.5, 0.5);
        }
    }

    /**
     * Update hex fill opacity for mode
     * @param {string} mode - Current mode
     */
    updateHexOpacity(mode) {
        const targetAlpha = mode === 'ring' ? 1.0 : 0.7;

        for (let i = 0; i < 6; i++) {
            if (this.game.hexSprites && this.game.hexSprites[i]) {
                const hex = this.game.hexSprites[i];
                hex.clear();
                hex.beginFill(hex.originalFillColor || 0x1a2a3a, targetAlpha);
                hex.lineStyle(3, 0x2a4a5a, 0.8);
                drawHex(hex, 0, 0, this.game.zoneRadius);
                hex.endFill();
            }
        }
    }

    /**
     * Instantly transition to a mode without animation (for seeking)
     * @param {string} mode - Target mode
     */
    instantTransitionTo(mode) {
        if (this.state.currentMode === mode) return;

        console.log(`[TransitionController] Instant transition to ${mode} (seek)`);

        // Cancel any active transition
        if (this.state.isTransitioning) {
            this.state.isTransitioning = false;
        }

        this.state.currentMode = mode;

        // Update hex positions instantly
        for (let i = 0; i < 6; i++) {
            const targetPos = getHexPosition(this.game, i, mode);
            if (!targetPos) continue;

            // Update hex sprite
            if (this.game.hexSprites && this.game.hexSprites[i]) {
                this.game.hexSprites[i].x = targetPos.x;
                this.game.hexSprites[i].y = targetPos.y;
            }

            // Update glow
            if (this.game.zoneGlows && this.game.zoneGlows[i]) {
                this.game.zoneGlows[i].x = targetPos.x;
                this.game.zoneGlows[i].y = targetPos.y;
            }

            // Update bloom blobs
            if (this.game.zoneBlooms && this.game.zoneBlooms[i]) {
                this.game.zoneBlooms[i].x = targetPos.x;
                this.game.zoneBlooms[i].y = targetPos.y;
            }

            // Update stored position
            if (this.game.zonePositions && this.game.zonePositions[i]) {
                this.game.zonePositions[i].x = targetPos.x;
                this.game.zonePositions[i].y = targetPos.y;
            }
        }

        // Update visual elements
        this.updateRingVisuals(mode === 'ring' ? 1.0 : 0.0);
        this.updateCameraZoom(mode);
        this.updateComboPosition(mode);
        this.updateHexOpacity(mode);
    }

    /**
     * Update transition controller - check for pending transitions
     */
    update(currentTime) {
        // Detect seek (large time jump)
        const timeDelta = Math.abs(currentTime - (this.lastSeekTime || 0));
        const seekDetected = timeDelta > 100; // More than 100ms jump = seek

        if (seekDetected) {
            // Seeking - find correct mode for this time
            const targetMode = this.getModeAtTime(currentTime);

            if (targetMode !== this.state.currentMode) {
                this.instantTransitionTo(targetMode);
            }

            // Reset nextTransitionIndex to next transition after current time
            this.nextTransitionIndex = this.transitions.findIndex(t => t.time > currentTime);
            if (this.nextTransitionIndex === -1) {
                this.nextTransitionIndex = this.transitions.length;
            }
        } else {
            // Normal playback - check for pending transitions with animated transitions
            if (this.nextTransitionIndex < this.transitions.length) {
                const nextTransition = this.transitions[this.nextTransitionIndex];
                if (currentTime >= nextTransition.time) {
                    this.startTransition(nextTransition);
                    this.nextTransitionIndex++;
                }
            }
        }

        this.lastSeekTime = currentTime;

        // Update active transition animation
        if (this.state.isTransitioning) {
            this.updateTransition(performance.now());
        }
    }

    /**
     * Start a transition to a new layout mode
     */
    startTransition(transitionConfig) {
        // If already transitioning, complete current transition immediately
        if (this.state.isTransitioning) {
            this.completeTransition();
        }

        console.log(`[TransitionController] Starting transition to ${transitionConfig.mode} (${transitionConfig.duration}ms)`);

        this.state.isTransitioning = true;
        this.state.sourceMode = this.state.currentMode;
        this.state.targetMode = transitionConfig.mode;
        this.state.startTime = performance.now();
        this.state.duration = transitionConfig.duration;
        this.state.transitionProgress = 0.0;
        this.state.config = transitionConfig;

        // Trigger visual effects
        this.triggerTransitionEffects();
    }

    /**
     * Update transition interpolation
     */
    updateTransition(currentTime) {
        const elapsed = currentTime - this.state.startTime;
        const rawProgress = Math.min(elapsed / this.state.duration, 1.0);

        // Apply easing function based on config
        const easingFunc = this.state.config?.easing || 'easeInOutCubic';
        this.state.transitionProgress = this.applyEasing(rawProgress, easingFunc);

        // Interpolate hexagon positions
        this.interpolateHexPositions();

        // Interpolate hex opacity (make opaque in ring mode)
        this.interpolateHexOpacity();

        // Interpolate camera zoom
        this.interpolateCameraZoom();

        // Interpolate combo position
        this.interpolateComboPosition();

        // Interpolate ring mode visuals (center marker, ring boundary)
        this.interpolateRingVisuals();

        // Check completion
        if (rawProgress >= 1.0) {
            this.completeTransition();
        }
    }

    /**
     * Interpolate hexagon positions during transition
     */
    interpolateHexPositions() {
        const progress = this.state.transitionProgress;

        for (let i = 0; i < 6; i++) {
            const sourcePos = getHexPosition(this.game, i, this.state.sourceMode);
            const targetPos = getHexPosition(this.game, i, this.state.targetMode);

            if (!sourcePos || !targetPos) {
                console.warn(`[TransitionController] Invalid positions for hex ${i}`);
                continue;
            }

            // Interpolate position
            const newX = sourcePos.x + (targetPos.x - sourcePos.x) * progress;
            const newY = sourcePos.y + (targetPos.y - sourcePos.y) * progress;

            // Update hexagon sprite position using stored array
            if (this.game.hexSprites && this.game.hexSprites[i]) {
                this.game.hexSprites[i].x = newX;
                this.game.hexSprites[i].y = newY;
            }

            // Update glow position
            if (this.game.zoneGlows && this.game.zoneGlows[i]) {
                this.game.zoneGlows[i].x = newX;
                this.game.zoneGlows[i].y = newY;
            }

            // Update bloom blob position
            if (this.game.zoneBlooms && this.game.zoneBlooms[i]) {
                this.game.zoneBlooms[i].x = newX;
                this.game.zoneBlooms[i].y = newY;
            }

            // Update stored position for note spawning and other systems
            if (this.game.zonePositions && this.game.zonePositions[i]) {
                this.game.zonePositions[i].x = newX;
                this.game.zonePositions[i].y = newY;
            }
        }
    }

    /**
     * Interpolate hexagon fill opacity during transition
     * Make hexagons fully opaque in ring mode to prevent ring boundary bleed-through
     */
    interpolateHexOpacity() {
        const progress = this.state.transitionProgress;

        // Target opacity: 1.0 (opaque) in ring mode, 0.7 in honeycomb mode
        const targetFillAlpha = this.state.targetMode === 'ring' ? 1.0 : 0.7;
        const sourceFillAlpha = this.state.sourceMode === 'ring' ? 1.0 : 0.7;

        const currentFillAlpha = sourceFillAlpha + (targetFillAlpha - sourceFillAlpha) * progress;

        // Update all hex sprites
        for (let i = 0; i < 6; i++) {
            if (this.game.hexSprites && this.game.hexSprites[i]) {
                // We need to redraw the hex with new alpha
                const hex = this.game.hexSprites[i];
                hex.clear();
                hex.beginFill(hex.originalFillColor || 0x1a2a3a, currentFillAlpha);
                hex.lineStyle(3, 0x2a4a5a, 0.8);
                drawHex(hex, 0, 0, this.game.zoneRadius);
                hex.endFill();
            }
        }
    }

    /**
     * Interpolate camera zoom during transition
     */
    interpolateCameraZoom() {
        // Editor: Disable camera zoom to prevent positioning issues
        // The editor canvas is smaller and zoom causes hex grid to be off-center
        const currentZoom = 1.0; // Always 1.0 for editor

        // Apply zoom to gameplay layers
        if (this.game.hexGroup) {
            this.game.hexGroup.scale.set(currentZoom);
        }
        if (this.game.glowLayer) {
            this.game.glowLayer.scale.set(currentZoom);
        }
    }

    /**
     * Interpolate combo text position during transition
     * Ring mode: move to bottom-left corner (osu! style)
     * Honeycomb mode: center position
     */
    interpolateComboPosition() {
        if (!this.game.comboText) return;

        const progress = this.state.transitionProgress;
        const width = this.game.app.renderer.width;
        const height = this.game.app.renderer.height;

        // Define positions for each mode
        const centerX = width / 2;
        const centerY = height * 0.25;
        const cornerX = 120;
        const cornerY = height - 80;

        // Determine source and target positions
        let sourceX, sourceY, targetX, targetY;

        if (this.state.sourceMode === 'ring') {
            sourceX = cornerX;
            sourceY = cornerY;
        } else {
            sourceX = centerX;
            sourceY = centerY;
        }

        if (this.state.targetMode === 'ring') {
            targetX = cornerX;
            targetY = cornerY;
        } else {
            targetX = centerX;
            targetY = centerY;
        }

        // Interpolate position
        this.game.comboText.x = sourceX + (targetX - sourceX) * progress;
        this.game.comboText.y = sourceY + (targetY - sourceY) * progress;

        // Also adjust anchor for corner positioning
        if (this.state.targetMode === 'ring') {
            const targetAnchorX = 0;
            const targetAnchorY = 1;
            const sourceAnchorX = this.state.sourceMode === 'ring' ? 0 : 0.5;
            const sourceAnchorY = this.state.sourceMode === 'ring' ? 1 : 0.5;

            this.game.comboText.anchor.set(
                sourceAnchorX + (targetAnchorX - sourceAnchorX) * progress,
                sourceAnchorY + (targetAnchorY - sourceAnchorY) * progress
            );
        } else {
            const targetAnchorX = 0.5;
            const targetAnchorY = 0.5;
            const sourceAnchorX = this.state.sourceMode === 'ring' ? 0 : 0.5;
            const sourceAnchorY = this.state.sourceMode === 'ring' ? 1 : 0.5;

            this.game.comboText.anchor.set(
                sourceAnchorX + (targetAnchorX - sourceAnchorX) * progress,
                sourceAnchorY + (targetAnchorY - sourceAnchorY) * progress
            );
        }
    }

    /**
     * Interpolate ring mode visual elements (center marker, ring boundary)
     */
    interpolateRingVisuals() {
        const progress = this.state.transitionProgress;
        const config = this.state.config || {};

        // Determine target alpha based on target mode
        const targetAlpha = this.state.targetMode === 'ring' ? 1.0 : 0.0;
        const sourceAlpha = this.state.sourceMode === 'ring' ? 1.0 : 0.0;

        // Interpolate alpha
        const currentAlpha = sourceAlpha + (targetAlpha - sourceAlpha) * progress;

        // Update center marker (if enabled in config)
        if (this.game.centerMarker && config.showCenterMarker !== false) {
            this.game.centerMarker.alpha = currentAlpha;
        } else if (this.game.centerMarker) {
            this.game.centerMarker.alpha = 0;
        }

        // Update ring boundary (fade + scale animation) (if enabled in config)
        if (this.game.ringBoundary && config.showRingBoundary !== false) {
            this.game.ringBoundary.alpha = currentAlpha;

            // Scale animation: scale up from 0.85 to 1.0 when transitioning to ring mode
            const sourceScale = this.state.sourceMode === 'ring' ? 1.0 : 0.85;
            const targetScale = this.state.targetMode === 'ring' ? 1.0 : 0.85;
            const currentScale = sourceScale + (targetScale - sourceScale) * progress;
            this.game.ringBoundary.scale.set(currentScale);
        } else if (this.game.ringBoundary) {
            this.game.ringBoundary.alpha = 0;
        }
    }

    /**
     * Get zoom level for a layout mode
     */
    getZoomForMode(mode) {
        return mode === 'ring' ? 0.9 : 1.0;
    }

    /**
     * Apply easing function to progress value
     */
    applyEasing(t, easingName) {
        switch (easingName) {
            case 'linear':
                return t;
            case 'easeInOutQuad':
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            case 'easeInOutCubic':
                return this.easeInOutCubic(t);
            case 'easeInOutQuart':
                return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
            case 'easeInOutQuint':
                return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
            case 'easeOutElastic':
                const c4 = (2 * Math.PI) / 3;
                return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
            case 'easeOutBounce':
                const n1 = 7.5625;
                const d1 = 2.75;
                if (t < 1 / d1) {
                    return n1 * t * t;
                } else if (t < 2 / d1) {
                    return n1 * (t -= 1.5 / d1) * t + 0.75;
                } else if (t < 2.5 / d1) {
                    return n1 * (t -= 2.25 / d1) * t + 0.9375;
                } else {
                    return n1 * (t -= 2.625 / d1) * t + 0.984375;
                }
            default:
                return this.easeInOutCubic(t);
        }
    }

    /**
     * Cubic ease-in-out easing function
     */
    easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * Complete transition
     */
    completeTransition() {
        this.state.currentMode = this.state.targetMode;
        this.state.isTransitioning = false;
        this.state.transitionProgress = 0.0;

        console.log(`[TransitionController] Transition complete, now in ${this.state.currentMode} mode`);

        if (this.onTransitionComplete) {
            this.onTransitionComplete(this.state.currentMode);
        }
    }

    /**
     * Trigger visual and audio effects for transition
     */
    triggerTransitionEffects() {
        const config = this.state.config || {};

        // Screen flash (with custom intensity)
        this.createScreenFlash(config.flashIntensity || 0.5);

        // Particle burst (with custom count)
        this.createParticleBurst(config.particleCount || 20);

        // Play transition sound
        try {
            soundManager.play('transition', { volume: 0.6 });
        } catch (e) {
            console.log('[TransitionController] Transition sound not available');
        }
    }

    /**
     * Create screen flash effect
     */
    createScreenFlash(intensity = 0.5) {
        const flash = new PIXI.Graphics();
        flash.beginFill(0xFFFFFF, intensity);
        flash.drawRect(0, 0, this.game.app.screen.width, this.game.app.screen.height);
        flash.endFill();

        this.game.uiLayer.addChild(flash);

        // Fade out animation
        const startTime = performance.now();
        const duration = 300;

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1.0);

            flash.alpha = intensity * (1 - progress);

            if (progress >= 1.0) {
                this.game.uiLayer.removeChild(flash);
                flash.destroy();
            } else {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Create particle burst effect
     */
    createParticleBurst(particleCount = 20) {
        const center = getCenterPosition(this.game);

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 5 + Math.random() * 3;

            const particle = new PIXI.Graphics();
            particle.beginFill(0x00FFFF);
            particle.drawCircle(0, 0, 3);
            particle.endFill();

            particle.x = center.x;
            particle.y = center.y;

            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const life = 1000;

            this.game.activeParticles.push({
                sprite: particle,
                x: center.x,
                y: center.y,
                vx,
                vy,
                life,
                maxLife: life
            });

            this.game.uiLayer.addChild(particle);
        }
    }

    /**
     * Get current layout mode
     */
    getCurrentMode() {
        return this.state.isTransitioning ? this.state.targetMode : this.state.currentMode;
    }

    /**
     * Check if currently transitioning
     */
    isTransitioning() {
        return this.state.isTransitioning;
    }
}
