import { drawHex } from './Utils/utils.js';

const { PIXI } = window;

// Constants for layout configuration
export const RING_RADIUS_SCALE = 0.35; // Ring radius as percentage of screen size
export const RING_TRAVEL_TIME = 200; // Additional time for notes to travel from center to ring (ms)

/**
 * Calculate ring layout positions (maimai-inspired)
 * All 6 hexagons arranged in a circular ring
 */
export function createRingPositions(game) {
    const center = { x: game.app.renderer.width / 2, y: game.app.renderer.height / 2 };
    const ringRadius = Math.min(game.app.renderer.width, game.app.renderer.height) * RING_RADIUS_SCALE;
    const positions = [];

    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2; // Start at top
        const x = center.x + Math.cos(angle) * ringRadius;
        const y = center.y + Math.sin(angle) * ringRadius;
        positions.push({ x, y, angle });
    }

    return positions;
}

/**
 * Get hexagon position for a specific index and layout mode
 * @param {Object} game - Game instance
 * @param {number} index - Hexagon index (0-5)
 * @param {string} mode - Layout mode ('honeycomb' or 'ring')
 * @returns {Object} Position object with x, y coordinates
 */
export function getHexPosition(game, index, mode = 'honeycomb') {
    if (index < 0 || index > 5) {
        console.warn(`[HexGrid] Invalid hex index: ${index}, returning center position`);
        return getCenterPosition(game);
    }

    if (mode === 'ring' && game.hexPositionsRing) {
        return game.hexPositionsRing[index];
    } else if (mode === 'honeycomb' && game.hexPositionsHoneycomb) {
        return game.hexPositionsHoneycomb[index];
    } else {
        // Fallback to zonePositions for backward compatibility
        return game.zonePositions[index] || getCenterPosition(game);
    }
}

/**
 * Get center position of the play area
 * @param {Object} game - Game instance
 * @returns {Object} Center position with x, y coordinates
 */
export function getCenterPosition(game) {
    return {
        x: game.app.renderer.width / 2,
        y: game.app.renderer.height / 2
    };
}

export function createHexGrid(game) {
    // Draw a simple hex grid with 6 zones around center
    const center = { x: game.app.renderer.width / 2, y: game.app.renderer.height / 2 };
    const radius = Math.min(game.app.renderer.width, game.app.renderer.height) * 0.26; // Increased spacing
    game.zonePositions = [];
    game.hexSprites = []; // Store hex sprites for direct access

    // Optional: Add subtle circular background
    const hexBackground = new PIXI.Graphics();
    hexBackground.beginFill(0x000000, 0.2);
    hexBackground.drawCircle(center.x, center.y, radius + 80);
    hexBackground.endFill();
    game.hexGroup.addChild(hexBackground);

    game.zoneRadius = 65; // Slightly larger hex radius

    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        const g = new PIXI.Graphics();
        const hexBaseColor = 0x1a2a3a; // Slightly brighter base color
        g.beginFill(hexBaseColor, 0.7);
        g.lineStyle(3, 0x2a4a5a, 0.8); // Brighter border
        drawHex(g, 0, 0, game.zoneRadius);
        g.endFill();
        g.x = x;
        g.y = y;
        g.originalFillColor = hexBaseColor;
        game.hexGroup.addChild(g);
        game.hexSprites.push(g); // Store reference
        game.zonePositions.push({ x, y });
    }

    // Enhanced zone glows with better visibility
    game.zoneGlows = [];
    for (let i = 0; i < game.zonePositions.length; i++) {
        const p = game.zonePositions[i];
        const glow = new PIXI.Graphics();
        glow.beginFill(0x6ee7b7, 0.15); // Brighter glow
        glow.drawCircle(0, 0, 70);
        glow.endFill();
        glow.x = p.x; glow.y = p.y;
        glow.alpha = 0.8;
        game.hexGroup.addChildAt(glow, 0);
        game.zoneGlows.push(glow);
    }

    // Enhanced neon bloom blobs with more vibrant colors
    game.zoneBlooms = [];
    const colors = [0x6ee7b7, 0xff6fd8, 0x9ef0ff, 0xffe86b, 0xa8d7ff, 0xff9ea8];
    for (let i = 0; i < game.zonePositions.length; i++) {
        const p = game.zonePositions[i];
        const b = new PIXI.Container();
        // Multiple concentric circles for soft bloom (more layers, larger)
        for (let s = 0; s < 6; s++) {
            const c = new PIXI.Graphics();
            const alpha = (0.25 / (s + 1)) * 1.3; // Brighter bloom
            const size = 90 + s * 45; // Larger bloom
            c.beginFill(colors[i % colors.length], alpha);
            c.drawCircle(0, 0, size);
            c.endFill();
            c.x = 0; c.y = 0;
            b.addChild(c);
        }
        b.x = p.x; b.y = p.y;
        b.alpha = 0.9; // More visible
        game.glowLayer.addChild(b);
        game.zoneBlooms.push(b);
    }

    // Ring boundary glow (hexagonal guide) - larger size
    game.ringBoundary = new PIXI.Graphics();
    const ringRadius = Math.min(game.app.renderer.width, game.app.renderer.height) * RING_RADIUS_SCALE * 1.08; // Increased from 0.98 to 1.08

    // Draw multiple concentric hexagons for glow effect - pure white, bright
    for (let i = 0; i < 3; i++) {
        const alpha = 0.3 - (i * 0.08);
        const thickness = 3 + (i * 2);
        const scale = 1 + (i * 0.015);
        game.ringBoundary.lineStyle(thickness, 0xFFFFFF, alpha);
        drawHex(game.ringBoundary, center.x, center.y, ringRadius * scale);
    }

    // Main boundary hexagon - pure white, bright
    game.ringBoundary.lineStyle(3, 0xFFFFFF, 0.5);
    drawHex(game.ringBoundary, center.x, center.y, ringRadius);

    game.ringBoundary.alpha = 0; // Hidden by default (honeycomb mode)
    game.ringBoundary.pivot.set(center.x, center.y);
    game.ringBoundary.position.set(center.x, center.y);
    game.ringBoundary.rotation = Math.PI / 6; // Rotate 30 degrees
    game.ringBoundary.scale.set(1.0);
    game.bgLayer.addChild(game.ringBoundary); // Add to bgLayer so it renders behind everything

    // Center marker for ring mode (maimai-style with hexagons)
    game.centerMarker = new PIXI.Container();
    const centerX = game.app.renderer.width / 2;
    const centerY = game.app.renderer.height / 2;

    // Outer pulsing hexagon ring
    const centerRing = new PIXI.Graphics();
    centerRing.lineStyle(3, 0x00FFFF, 0.6);
    drawHex(centerRing, 0, 0, 25);
    game.centerMarker.addChild(centerRing);

    // Inner solid hexagon (will zoom when notes spawn)
    const centerDot = new PIXI.Graphics();
    centerDot.beginFill(0xFFFFFF, 0.7);
    drawHex(centerDot, 0, 0, 15);
    centerDot.endFill();
    game.centerMarker.addChild(centerDot);

    // Cross hair lines (hexagonal pattern)
    const crosshair = new PIXI.Graphics();
    crosshair.lineStyle(2, 0x00FFFF, 0.4);
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const innerDist = 8;
        const outerDist = 20;
        crosshair.moveTo(Math.cos(angle) * innerDist, Math.sin(angle) * innerDist);
        crosshair.lineTo(Math.cos(angle) * outerDist, Math.sin(angle) * outerDist);
    }
    game.centerMarker.addChild(crosshair);

    game.centerMarker.x = centerX;
    game.centerMarker.y = centerY;
    game.centerMarker.alpha = 0; // Hidden by default
    game.centerMarker.scale.set(1.0);
    game.hexGroup.addChild(game.centerMarker);

    // Store references for animation
    game.centerMarkerRing = centerRing;
    game.centerMarkerDot = centerDot;
    game.centerMarkerDotBaseScale = 1.0;
    game.centerMarkerLastSpawn = 0;

    // Combo text
    game.comboText = new PIXI.Text('', {
        fill: 0xfff1a8,
        fontSize: 48,
        fontFamily: 'ZenMaruGothic',
        fontWeight: '900',
        stroke: '#000000',
        strokeThickness: 4,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowBlur: 7,
        dropShadowAngle: Math.PI / 2,
        dropShadowDistance: 4,
    });
    game.comboText.anchor.set(0.5);
    game.comboText.x = game.app.renderer.width / 2;
    game.comboText.y = game.app.renderer.height * 0.25;
    game.comboText.alpha = 0;
    game.uiLayer.addChild(game.comboText);

    // Full-screen combo modal
    game.comboModal = new PIXI.Container();
    game.comboModal.visible = false; game.comboModal.alpha = 0;
    const modalBg = new PIXI.Graphics();
    modalBg.beginFill(0x051224, 0.8); modalBg.drawRect(0, 0, game.app.renderer.width, game.app.renderer.height); modalBg.endFill();
    modalBg.x = 0; modalBg.y = 0; game.comboModal.addChild(modalBg);
    game.comboModalText = new PIXI.Text('', { fill: 0xffe86b, fontSize: 96, fontFamily: 'ZenMaruGothic', fontWeight: '900' });
    game.comboModalText.anchor.set(0.5); game.comboModalText.x = game.app.renderer.width / 2; game.comboModalText.y = game.app.renderer.height / 2;
    game.comboModal.addChild(game.comboModalText);
    game.uiLayer.addChild(game.comboModal);

    // Store both layout position sets
    game.hexPositionsHoneycomb = game.zonePositions.map(p => ({ ...p })); // Clone current positions
    game.hexPositionsRing = createRingPositions(game); // Calculate ring positions

    console.log('[HexGrid] Dual layout system initialized');
    console.log('[HexGrid] Honeycomb positions:', game.hexPositionsHoneycomb);
    console.log('[HexGrid] Ring positions:', game.hexPositionsRing);
}
