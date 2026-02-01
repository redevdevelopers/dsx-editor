import { drawHex } from './Utils/utils.js';
import { getHexPosition, getCenterPosition } from './hexGrid.js';

const { PIXI } = window;

// Note type color mapping (defaults, can be overridden by gameplay settings)
const NOTE_COLORS = {
    regular: 0xFFFFFF,  // White for regular notes
    ex: 0xFFD700,       // Gold for EX notes (special bonus notes)
    ex2: 0xFFD700,      // Gold for EX2 notes (same as EX, different sound)
    multi: 0x00BFFF     // Deep Sky Blue for multi notes
};

export function spawnNote(game, note) {
    if (!note || typeof note.zone !== 'number') {
        return;
    }
    const zoneIndex = note.zone;

    // Get current layout mode from transition controller
    const currentMode = game.transitionController ? game.transitionController.getCurrentMode() : 'honeycomb';

    // Determine spawn and target positions based on mode
    let spawnPos, targetPos;

    if (currentMode === 'ring') {
        // Ring mode: spawn at center, travel to ring position
        spawnPos = getCenterPosition(game);
        targetPos = getHexPosition(game, zoneIndex, 'ring');
    } else {
        // Honeycomb mode: spawn at target position (existing behavior)
        targetPos = getHexPosition(game, zoneIndex, 'honeycomb');
        spawnPos = targetPos;
    }

    if (!spawnPos || !targetPos) {
        console.warn('Note has invalid zone index:', zoneIndex, note);
        return;
    }

    // Get note type and color
    const noteType = note.type || 'regular';
    const noteColor = game.noteColors?.[noteType] || NOTE_COLORS[noteType] || NOTE_COLORS.regular;

    // Note body (inner hex) - single colored hex, simple and clean
    const body = new PIXI.Graphics();
    body.beginFill(noteColor, 1.0);
    drawHex(body, 0, 0, game.zoneRadius);
    body.endFill();

    body.x = spawnPos.x;
    body.y = spawnPos.y;
    body.alpha = 0.0; // Start invisible, fade in as approach progresses

    // Add note type indicator
    if (noteType !== 'regular') {
        const indicator = createNoteTypeIndicator(noteType, game.zoneRadius, noteColor);
        indicator.x = spawnPos.x;
        indicator.y = spawnPos.y;
        body.addChild(indicator);
    }

    // Enhanced approach ring with brighter visuals
    const ring = new PIXI.Graphics();
    ring.lineStyle(8, 0xFFFFFF, 1.0); // Full brightness white, thick line
    drawHex(ring, 0, 0, game.zoneRadius);
    ring.x = spawnPos.x;
    ring.y = spawnPos.y;
    ring.alpha = 0.0;
    ring.scale.set(2.2); // Start larger for better readability

    // Timing arc (wipe) - appears in last half of approach
    const arc = new PIXI.Graphics();
    arc.x = spawnPos.x;
    arc.y = spawnPos.y;
    arc.alpha = 0.0;

    game.hexGroup.addChild(ring);
    game.hexGroup.addChild(body);
    game.hexGroup.addChild(arc);

    const targetTime = note.time; // ms
    const spawnedAt = game._now();

    // Trigger center marker zoom animation if in ring mode
    if (currentMode === 'ring' && game.centerMarkerDot) {
        game.centerMarkerLastSpawn = performance.now();
    }

    game.activeNotes.push({
        note,
        sprite: body,
        ring,
        arc,
        spawnedAt,
        targetTime,
        zone: zoneIndex,
        incomingSoundPlayed: false,
        mode: currentMode,
        spawnPos: { x: spawnPos.x, y: spawnPos.y },
        targetPos: { x: targetPos.x, y: targetPos.y }
    });
}

/**
 * Create visual indicator for note type
 */
function createNoteTypeIndicator(noteType, radius, color) {
    const container = new PIXI.Container();

    switch (noteType) {
        case 'ex':
            // Gold star/sparkle for EX notes
            const exStar = new PIXI.Graphics();
            exStar.lineStyle(3, 0xFFFFFF, 0.8);
            // Draw a star shape
            const starPoints = 5;
            const outerRadius = 8;
            const innerRadius = 4;
            exStar.moveTo(0, -outerRadius);
            for (let i = 0; i < starPoints * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (Math.PI / starPoints) * i - Math.PI / 2;
                exStar.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            }
            exStar.closePath();
            exStar.x = 0;
            exStar.y = 0;
            return exStar;
        case 'ex2':
            // Gold sparkle/burst for EX2 notes (different from EX star)
            const ex2Burst = new PIXI.Graphics();
            ex2Burst.lineStyle(3, 0xFFFFFF, 0.8);
            // Draw a 4-pointed burst/cross shape
            const burstSize = 10;
            // Vertical line
            ex2Burst.moveTo(0, -burstSize);
            ex2Burst.lineTo(0, burstSize);
            // Horizontal line
            ex2Burst.moveTo(-burstSize, 0);
            ex2Burst.lineTo(burstSize, 0);
            // Diagonal lines
            ex2Burst.moveTo(-burstSize * 0.7, -burstSize * 0.7);
            ex2Burst.lineTo(burstSize * 0.7, burstSize * 0.7);
            ex2Burst.moveTo(burstSize * 0.7, -burstSize * 0.7);
            ex2Burst.lineTo(-burstSize * 0.7, burstSize * 0.7);
            ex2Burst.x = 0;
            ex2Burst.y = 0;
            return ex2Burst;
        case 'multi':
            // Double circle for multi/double notes
            const multiCircle1 = new PIXI.Graphics();
            multiCircle1.lineStyle(2, 0xFFFFFF, 0.8);
            multiCircle1.drawCircle(-radius * 0.15, 0, radius * 0.25);
            const multiCircle2 = new PIXI.Graphics();
            multiCircle2.lineStyle(2, 0xFFFFFF, 0.8);
            multiCircle2.drawCircle(radius * 0.15, 0, radius * 0.25);
            container.addChild(multiCircle1, multiCircle2);
            break;
    }

    return container;
}

