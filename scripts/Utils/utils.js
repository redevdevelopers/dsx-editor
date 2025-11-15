export function drawHex(g, x, y, r) {
    const verts = [];
    for (let i = 0; i < 6; i++) verts.push({ x: x + r * Math.cos(Math.PI / 3 * i), y: y + r * Math.sin(Math.PI / 3 * i) });
    g.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < 6; i++) g.lineTo(verts[i].x, verts[i].y);
    g.closePath();
}
