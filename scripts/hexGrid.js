import { drawHex } from './Utils/utils.js';

const { PIXI } = window;

export function createHexGrid(game) {
    // Draw a simple hex grid with 6 zones around center
    const center = { x: game.app.renderer.width / 2, y: game.app.renderer.height / 2 };
    const radius = Math.min(game.app.renderer.width, game.app.renderer.height) * 0.22;
    game.zonePositions = [];

    const hexBackground = new PIXI.Graphics();
    hexBackground.beginFill(0x000000, 0.3);
    hexBackground.drawCircle(center.x, center.y, radius + 70);
    hexBackground.endFill();
    game.hexGroup.addChild(hexBackground);
    game.zoneRadius = 60; // base hex radius used in grid
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;
        const g = new PIXI.Graphics();
        const hexBaseColor = 0x0a1220; // Define the base color
        g.beginFill(hexBaseColor, 0.6);
        g.lineStyle(2, 0x1f3344, 0.6);
        drawHex(g, 0, 0, game.zoneRadius);
        g.endFill();
        g.x = x;
        g.y = y;
        g.originalFillColor = hexBaseColor; // Store original color
        game.hexGroup.addChild(g);
        game.zonePositions.push({ x, y });
    }
    // add subtle glow under each zone
    game.zoneGlows = [];
    for (let i = 0; i < game.zonePositions.length; i++) {
        const p = game.zonePositions[i];
        const glow = new PIXI.Graphics();
        glow.beginFill(0x6ee7b7, 0.06);
        glow.drawCircle(0, 0, 60);
        glow.endFill();
        glow.x = p.x; glow.y = p.y;
        glow.alpha = 0.7;
        game.hexGroup.addChildAt(glow, 0);
        game.zoneGlows.push(glow);
    }
    // add neon bloom blobs behind zones on glowLayer (vary color per zone)
    game.zoneBlooms = [];
    const colors = [0x6ee7b7, 0xff6fd8, 0x9ef0ff, 0xffe86b, 0xa8d7ff, 0xff9ea8];
    for (let i = 0; i < game.zonePositions.length; i++) {
        const p = game.zonePositions[i];
        const b = new PIXI.Container();
        // multiple concentric circles for soft bloom (larger and softer)
        for (let s = 0; s < 5; s++) {
            const c = new PIXI.Graphics();
            const alpha = (0.18 / (s + 1)) * 1.2;
            const size = 80 + s * 40;
            c.beginFill(colors[i % colors.length], alpha);
            c.drawCircle(0, 0, size);
            c.endFill();
            c.x = 0; c.y = 0;
            b.addChild(c);
        }
        b.x = p.x; b.y = p.y;
        b.alpha = 0.85;
        game.glowLayer.addChild(b);
        game.zoneBlooms.push(b);
    }
    // Score text
    game.scoreText = new PIXI.Text('Score: 0', {
        fill: 0xe6eef6,
        fontSize: 24,
        fontFamily: 'ZenMaruGothic',
        fontWeight: 'bold',
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowBlur: 4,
        dropShadowAngle: Math.PI / 2,
        dropShadowDistance: 2,
    });
    game.scoreText.x = 20; game.scoreText.y = 20;
    game.uiLayer.addChild(game.scoreText);

    // combo text
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

    // full-screen combo modal
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
