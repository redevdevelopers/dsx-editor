const { PIXI } = window;

// Smooth vertical gradient shader for dynamic background colors
const GRADIENT_VERTEX = `
    precision mediump float;

    attribute vec2 aVertexPosition;
    attribute vec2 aTextureCoord;

    uniform mat3 projectionMatrix;

    varying vec2 vTextureCoord;

    void main(void){
        vTextureCoord = aTextureCoord;
        gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
    }
`;

const GRADIENT_FRAGMENT = `
    precision mediump float;

    varying vec2 vTextureCoord;

    uniform vec3 uTop;
    uniform vec3 uMid;
    uniform vec3 uBottom;

    // Smoothstep blend helper
    vec3 blend3(vec3 a, vec3 b, float t) {
        return mix(a, b, smoothstep(0.0, 1.0, t));
    }

    void main(void){
        float y = clamp(vTextureCoord.y, 0.0, 1.0);

        // Two-stage smooth blend: top->mid (0..0.5), mid->bottom (0.5..1)
        vec3 c1 = blend3(uTop, uMid, y * 2.0);
        vec3 c2 = blend3(uMid, uBottom, (y - 0.5) * 2.0);
        vec3 c = mix(c1, c2, step(0.5, y));

        gl_FragColor = vec4(c, 1.0);
    }
`;

function intToRgb01(hex) {
    return [
        ((hex >> 16) & 255) / 255,
        ((hex >> 8) & 255) / 255,
        (hex & 255) / 255,
    ];
}

export function createParallaxBackground(game) {
    const w = game.app.renderer.width;
    const h = game.app.renderer.height;

    // Fullscreen sprite with gradient shader
    const bg = new PIXI.Sprite(PIXI.Texture.WHITE);
    bg.x = 0;
    bg.y = 0;
    bg.width = w;
    bg.height = h;

    // Rich gradient colors (darker base for better note visibility)
    const top = 0x1a2a4a;     // deep blue
    const mid = 0x2a1a3a;     // deep purple
    const bottom = 0x0a0a1a;  // near black

    const filter = new PIXI.Filter(
        GRADIENT_VERTEX,
        GRADIENT_FRAGMENT,
        {
            uTop: intToRgb01(top),
            uMid: intToRgb01(mid),
            uBottom: intToRgb01(bottom),
        }
    );

    bg.filters = [filter];
    bg.alpha = 0.45; // Visible but not overpowering

    game.bgGradientSprite = bg;
    game.bgGradientFilter = filter;
    game.bgLayer.addChild(bg);

    // Enhanced starfield with more stars and variety
    game.starLayer = new PIXI.Container();
    for (let i = 0; i < 200; i++) {
        const s = new PIXI.Graphics();
        const r = Math.random() * 2.5;
        const alpha = 0.1 + Math.random() * 0.3;
        s.beginFill(0xffffff, alpha);
        s.drawCircle(0, 0, r);
        s.endFill();
        s.x = Math.random() * w;
        s.y = Math.random() * h;
        game.starLayer.addChild(s);
    }
    game.bgLayer.addChild(game.starLayer);

    // Set gradient colors at runtime (fast: uniforms only)
    game.setBackgroundGradient = (topColor, midColor, bottomColor, { alpha } = {}) => {
        if (!game.bgGradientFilter) return;
        if (typeof topColor === 'number') game.bgGradientFilter.uniforms.uTop = intToRgb01(topColor);
        if (typeof midColor === 'number') game.bgGradientFilter.uniforms.uMid = intToRgb01(midColor);
        if (typeof bottomColor === 'number') game.bgGradientFilter.uniforms.uBottom = intToRgb01(bottomColor);
        if (typeof alpha === 'number' && game.bgGradientSprite) game.bgGradientSprite.alpha = alpha;
    };

    // Keep sized on resize
    game._updateBackgroundLayout = () => {
        const w2 = game.app.renderer.width;
        const h2 = game.app.renderer.height;
        if (game.bgGradientSprite) {
            game.bgGradientSprite.width = w2;
            game.bgGradientSprite.height = h2;
        }
    };
}