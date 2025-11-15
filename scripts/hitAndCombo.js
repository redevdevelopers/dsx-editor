import { showHitFeedback } from './hitFeedback.js';
import { soundManager } from './audioEngine/soundManager.js'; // Import soundManager

function shakeHex(game, hex) {
    if (game.hexShakeAnimations.some(a => a.hex === hex)) return;

    game.hexShakeAnimations.push({
        hex: hex,
        startTime: performance.now(),
        duration: 200,
        magnitude: 5,
        originalX: hex.x,
        originalY: hex.y
    });
}

export function tryHit(game, zone) {
    const now = game._now();
    let bestIndex = -1; let bestDiff = Infinity;
    for (let i = 0; i < game.activeNotes.length; i++) {
        const a = game.activeNotes[i];
        if (a.zone !== zone) continue;
        const diff = Math.abs(a.targetTime - now);
        if (diff < bestDiff) { bestDiff = diff; bestIndex = i; }
    }

    const hex = game._getZoneHex(zone);
    if (hex) {
        game.hexAnimations = game.hexAnimations.filter(a => a.hex !== hex);

        const originalScale = hex.scale.x || 1;
        game.hexAnimations.push({
            hex: hex,
            startTime: performance.now(),
            duration: 120,
            originalScale: originalScale,
            targetScale: originalScale * 1.08
        });
    }

    if (bestIndex === -1) {
        showHitFeedback(game, 'perfect', zone, game.currentCombo);
        return;
    }

    const a = game.activeNotes[bestIndex];
    const diff = a.targetTime - now;

    if (diff > game.hitWindows.good) { // Tapped way too early
        if (hex) {
            shakeHex(game, hex);
        }
        game.currentCombo = 0;
        showHitFeedback(game, 'perfect', zone, game.currentCombo); // Show perfect feedback
        return;
    }

    const ms = Math.abs(diff);
    let grade = null;
    if (ms <= game.hitWindows['critical perfect']) { grade = 'criticalPerfect'; }
    else if (ms <= game.hitWindows.perfect) { grade = 'perfect'; }
    else { grade = 'perfect'; } // Default to perfect if outside critical perfect/perfect window

    if (grade === 'criticalPerfect' || grade === 'perfect') {
        soundManager.play(grade);
    }

    if (grade !== 'miss') {
        game.currentCombo++;
        if (game.currentCombo > game.maxCombo) {
            game.maxCombo = game.currentCombo;
        }
    } else {
        game.currentCombo = 0;
    }

    a.sprite.destroy();
    if (a.ring) a.ring.destroy();
    if (a.ringGlow) a.ringGlow.destroy();
    if (a.arc) a.arc.destroy();
    game.activeNotes.splice(bestIndex, 1);

    game.zoneLastHit[a.zone] = now;
    showHitFeedback(game, grade, a.zone, game.currentCombo);
}
