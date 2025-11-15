import { drawHex } from './Utils/utils.js';

const { PIXI } = window;

export function spawnNote(game, note) {
    if (!note || typeof note.zone !== 'number') {
        console.warn('Attempted to spawn invalid note:', note);
        return;
    }
    const zoneIndex = note.zone;
    const pos = game.zonePositions[zoneIndex];
    if (!pos) {
        console.warn('Note has invalid zone index:', zoneIndex, note);
        return;
    }
    // Note body (inner hex) for osu-like hit circle feel
    const body = new PIXI.Graphics();
    body.beginFill(0xFFFFFF, 1.0);
    drawHex(body, 0, 0, game.zoneRadius);
    body.endFill();
    body.x = pos.x; body.y = pos.y;
    body.alpha = 0.5; // fade in as approach progresses

    // Approach visuals: crisp ring + soft glow + timing arc
    const ring = new PIXI.Graphics();
    ring.lineStyle(4, 0x6ee7b7, 10.60);
    // Match approach hex radius to grid hex radius
    drawHex(ring, 0, 0, game.zoneRadius);
    ring.x = pos.x; ring.y = pos.y;
    ring.alpha = 0.0;
    ring.scale.set(0.0); // larger start for readability

    const ringGlow = new PIXI.Graphics();
    ringGlow.beginFill(0x6ee7b7, 0.12);
    ringGlow.drawCircle(0, 0, game.zoneRadius * 1.6);
    ringGlow.endFill();
    ringGlow.x = pos.x; ringGlow.y = pos.y;
    ringGlow.scale.set(1.0);

    // Timing arc (wipe) using a mask container
    const arcContainer = new PIXI.Container();
    const arc = new PIXI.Graphics();
    arc.lineStyle(6, 0xff6fd8, 0.95);
    arc.moveTo(0, 0);
    arc.drawCircle(0, 0, game.zoneRadius * 1.1);
    arc.x = pos.x; arc.y = pos.y;
    arc.alpha = 0.0; // becomes visible during last half
    arcContainer.addChild(arc);

    game.glowLayer.addChild(ringGlow);
    game.hexGroup.addChild(ring);
    game.hexGroup.addChild(body);
    game.hexGroup.addChild(arcContainer);

    const targetTime = note.time; // ms
    const spawnedAt = game._now();
    game.activeNotes.push({ note, sprite: body, ring, ringGlow, arc, spawnedAt, targetTime, zone: zoneIndex });
}
