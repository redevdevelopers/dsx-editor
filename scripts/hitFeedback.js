const { PIXI } = window;

async function showHitFeedback(game, grade, zone, combo) {
    const pos = game.zonePositions[zone];
    if (grade === 'perfect' || grade === 'great') {
        const origX = game.uiLayer.x, origY = game.uiLayer.y;
        let t0 = performance.now();
        const dur = 120;
        const shake = () => {
            const t = Math.min(1, (performance.now() - t0) / dur);
            const amp = (1 - t) * 4;
            game.uiLayer.x = origX + (Math.random() - 0.5) * amp;
            game.uiLayer.y = origY + (Math.random() - 0.5) * amp;
            if (t < 1) requestAnimationFrame(shake); else { game.uiLayer.x = origX; game.uiLayer.y = origY; }
        };
        requestAnimationFrame(shake);
    }

    try {
        const ripple = new PIXI.Graphics();
        ripple.lineStyle(3, 0xffffff, 0.35);
        ripple.drawCircle(0, 0, 24);
        ripple.x = pos.x; ripple.y = pos.y;
        game.uiLayer.addChild(ripple);
        const start = performance.now(); const dur = 260;
        const anim = () => {
            const t = Math.min(1, (performance.now() - start) / dur);
            ripple.scale.set(1 + 1.4 * t);
            ripple.alpha = 0.35 * (1 - t);
            if (t < 1) requestAnimationFrame(anim); else { ripple.destroy(); }
        };
        requestAnimationFrame(anim);
    } catch { }

    const gradeColors = {
        'criticalPerfect': 0xffffff,
        'perfect': 0xfff1a8,
        'great': 0xa8ffd6,
        'good': 0xa8d7ff,
        'miss': 0xff9ea8
    };
    const color = gradeColors[grade] || 0xffffff;

    const txt = new PIXI.Text(grade, {
        fill: color,
        fontSize: 36, // Increased font size
        fontFamily: 'ZenMaruGothic',
        fontWeight: '900',
        stroke: '#000000',
        strokeThickness: 4,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowBlur: 7,
    });
    txt.anchor.set(0.5);
    txt.x = pos.x; txt.y = pos.y; // Centered on the hex
    txt.scale.set(0.5);
    game.uiLayer.addChild(txt);

    const spark = new PIXI.Graphics();
    spark.beginFill(color);
    spark.drawCircle(0, 0, 12); // Larger spark
    spark.endFill();
    spark.x = pos.x; spark.y = pos.y;
    game.uiLayer.addChild(spark);

    const start = performance.now();
    const duration = 500; // Slightly longer animation
    const animate = () => {
        const elapsed = performance.now() - start;
        const t = Math.min(1, elapsed / duration);

        const s = 1 + Math.sin(t * Math.PI) * 0.5; // Pop effect
        txt.scale.set(s);
        txt.alpha = (t < 0.5) ? 1 : 1 - ((t - 0.5) * 2);
        txt.y = pos.y - t * 40; // Move up

        spark.scale.set(1 + t * 2.5);
        spark.alpha = 1 - t;

        if (t >= 1) {
            txt.destroy();
            spark.destroy();
            game.app.ticker.remove(animate);
        }
    };
    game.app.ticker.add(animate);

    const particleCount = grade === 'criticalPerfect' ? 20 : grade === 'perfect' ? 15 : grade === 'great' ? 10 : grade === 'good' ? 5 : 2;
    for (let i = 0; i < particleCount; i++) {
        const sp = new PIXI.Graphics();
        sp.beginFill(color, 1);
        sp.drawRoundedRect(-4, -2, 8, 4, 2);
        sp.endFill();
        sp.x = pos.x; sp.y = pos.y;
        game.uiLayer.addChild(sp);

        const glow = new PIXI.Graphics();
        glow.beginFill(color, 0.3);
        glow.drawCircle(0, 0, 10);
        glow.endFill();
        glow.x = pos.x; glow.y = pos.y; game.glowLayer.addChild(glow);

        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 6;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        game.activeParticles.push({ sprite: sp, glow, x: pos.x, y: pos.y, vx, vy, life: 800, maxLife: 800 });
    }

    if (combo > 1) {
        game.comboText.text = `${combo}x`;
        game.comboText.alpha = 1;
        game.comboText.scale.set(0.6);
        const start = performance.now();
        const dur = 700;
        const anim = () => {
            const t = Math.min(1, (performance.now() - start) / dur);
            const s = 1 + 0.8 * (1 - t);
            game.comboText.scale.set(s);
            game.comboText.alpha = 1 - t * 1.1;
            if (t >= 1) game.app.ticker.remove(anim);
        };
        game.app.ticker.add(anim);
    } else {
        game.comboText.alpha = 0;
    }
}

export { showHitFeedback };
