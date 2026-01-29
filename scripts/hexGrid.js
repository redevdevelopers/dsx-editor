import { drawHex } from './Utils/utils.js';

const { PIXI } = window;

export function createHexGrid(game) {
    // Draw a simple hex grid with 6 zones around center
    const center = { x: game.app.renderer.width / 2, y: game.app.renderer.height / 2 };
    const radius = Math.min(game.app.renderer.width, game.app.renderer.height) * 0.26; // Increased spacing
    game.zonePositions = [];

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
}
