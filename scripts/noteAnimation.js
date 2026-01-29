import { drawHex } from './Utils/utils.js';

const { PIXI } = window;

// Note type color mapping (defaults, can be overridden by gameplay settings)
const NOTE_COLORS = {
    regular: 0xFF69B4,  // Pink for single notes
    hold: 0xFFD700,     // Gold for hold notes
    chain: 0x00CED1,    // Dark Turquoise for chain
    multi: 0xFFD700,    // Gold for double notes
    slide: 0x9370DB,    // Medium Purple for slide
    flick: 0xFF6347     // Tomato Red for flick
};

export function spawnNote(game, note) {
    if (!note || typeof note.zone !== 'number') {
        return;
    }
    const zoneIndex = note.zone;
    const pos = game.zonePositions[zoneIndex];
    if (!pos) {
        return;
    }

    // Get note type and color
    const noteType = note.type || 'regular';
    const noteColor = game.noteColors?.[noteType] || NOTE_COLORS[noteType] || NOTE_COLORS.regular;

    // Note body (inner hex) - bright white with colored glow
    const body = new PIXI.Graphics();

    // Add colored glow layer
    body.beginFill(noteColor, 0.4);
    drawHex(body, 0, 0, game.zoneRadius * 1.2);
    body.endFill();

    // Bright white center
    body.beginFill(0xFFFFFF, 1.0);
    drawHex(body, 0, 0, game.zoneRadius);
    body.endFill();

    body.x = pos.x; body.y = pos.y;
    body.alpha = 0.0; // Start invisible, fade in as approach progresses

    // Add note type indicator
    if (noteType !== 'regular') {
        const indicator = createNoteTypeIndicator(noteType, game.zoneRadius, noteColor);
        indicator.x = pos.x;
        indicator.y = pos.y;
        body.addChild(indicator);
    }

    // Enhanced approach ring with brighter visuals
    const ring = new PIXI.Graphics();
    ring.lineStyle(8, 0xFFFFFF, 0.95); // Bright white, thick line
    drawHex(ring, 0, 0, game.zoneRadius);
    ring.x = pos.x; ring.y = pos.y;
    ring.alpha = 0.0;
    ring.scale.set(2.2); // Start larger for better readability

    // Timing arc (wipe) - appears in last half of approach
    const arc = new PIXI.Graphics();
    arc.x = pos.x; arc.y = pos.y;
    arc.alpha = 0.0;

    game.hexGroup.addChild(ring);
    game.hexGroup.addChild(body);
    game.hexGroup.addChild(arc);

    const targetTime = note.time; // ms
    const spawnedAt = game._now();
    game.activeNotes.push({
        note,
        sprite: body,
        ring,
        arc,
        spawnedAt,
        targetTime,
        zone: zoneIndex,
        incomingSoundPlayed: false
    });
}

/**
 * Create visual indicator for note type
 */
function createNoteTypeIndicator(noteType, radius, color) {
    const container = new PIXI.Container();

    switch (noteType) {
        case 'hold':
            // Long vertical line for hold notes
            const holdLine = new PIXI.Graphics();
            holdLine.lineStyle(3, 0xFFFFFF, 0.8);
            holdLine.moveTo(0, -radius * 0.4);
            holdLine.lineTo(0, radius * 0.4);
            container.addChild(holdLine);
            break;

        case 'chain':
            // Chain link symbol
            const chainCircle1 = new PIXI.Graphics();
            chainCircle1.lineStyle(2, 0xFFFFFF, 0.8);
            chainCircle1.drawCircle(-radius * 0.2, 0, radius * 0.15);
            const chainCircle2 = new PIXI.Graphics();
            chainCircle2.lineStyle(2, 0xFFFFFF, 0.8);
            chainCircle2.drawCircle(radius * 0.2, 0, radius * 0.15);
            container.addChild(chainCircle1, chainCircle2);
            break;

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

        case 'slide':
            // Arrow for slide notes
            const slideArrow = new PIXI.Graphics();
            slideArrow.lineStyle(3, 0xFFFFFF, 0.8);
            slideArrow.moveTo(-radius * 0.3, 0);
            slideArrow.lineTo(radius * 0.3, 0);
            slideArrow.lineTo(radius * 0.15, -radius * 0.15);
            slideArrow.moveTo(radius * 0.3, 0);
            slideArrow.lineTo(radius * 0.15, radius * 0.15);
            container.addChild(slideArrow);
            break;

        case 'flick':
            // Upward arrow for flick notes
            const flickArrow = new PIXI.Graphics();
            flickArrow.lineStyle(3, 0xFFFFFF, 0.8);
            flickArrow.moveTo(0, radius * 0.3);
            flickArrow.lineTo(0, -radius * 0.3);
            flickArrow.lineTo(-radius * 0.15, -radius * 0.15);
            flickArrow.moveTo(0, -radius * 0.3);
            flickArrow.lineTo(radius * 0.15, -radius * 0.15);
            container.addChild(flickArrow);
            break;
    }

    return container;
}

