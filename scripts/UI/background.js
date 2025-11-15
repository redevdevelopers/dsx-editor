const { PIXI } = window;

export function createParallaxBackground(game) {
    // simple starfield and soft gradient
    const w = game.app.renderer.width, h = game.app.renderer.height;
    // gradient rect (approx)
    const grd = new PIXI.Graphics();
    grd.beginFill(0x071022);
    grd.drawRect(0, 0, w, h);
    grd.endFill();
    game.bgLayer.addChild(grd);

    // stars
    game.starLayer = new PIXI.Container();
    for (let i = 0; i < 120; i++) {
        const s = new PIXI.Graphics();
        const r = Math.random() * 2.2;
        s.beginFill(0xffffff, 0.06 + Math.random() * 0.18);
        s.drawCircle(0, 0, r);
        s.endFill();
        s.x = Math.random() * w; s.y = Math.random() * h;
        game.starLayer.addChild(s);
    }
    game.bgLayer.addChild(game.starLayer);
}