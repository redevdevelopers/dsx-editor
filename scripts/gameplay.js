const { PIXI } = window;

export class Gameplay {
    constructor({ parent, input, settings }) {
        this.parent = parent || document.body;
        this.input = input;
        this.settings = settings || {};
        this.app = new PIXI.Application({ backgroundAlpha: 0, resizeTo: this.parent });
        this.parent.appendChild(this.app.view);
        this.stage = this.app.stage;

        this.hexGroup = new PIXI.Container();
        this.stage.addChild(this.hexGroup);

        this.glowLayer = new PIXI.Container();
        this.glowLayer.blendMode = PIXI.BLEND_MODES.ADD;
        this.stage.addChild(this.glowLayer);

        this.app.renderer.on('resize', () => this._createHexGrid());
        setTimeout(() => this.app.renderer.emit('resize'), 100);

        this.running = false;
        this.chart = null;
        this.startTime = 0; // ms
        this.scheduledIndex = 0;
        this.activeNotes = [];
        this.approachTime = 1500; // ms
        this.hexGridCreated = false;
    }

    start(chart) {
        this.chart = chart;
        this.running = true;
        this.app.ticker.add(this._update, this);
        this.scheduledIndex = 0;
        this.activeNotes = [];
        this.startTime = performance.now();
    }

    stop() {
        this.running = false;
        this.app.ticker.remove(this._update, this);
    }

    showHit(zone) {
        const pos = this.zonePositions[zone];
        if (!pos) {
            return;
        }

        const hitEffect = new PIXI.Graphics();
        hitEffect.beginFill(0xffffff, 0.8);
        this._drawHex(hitEffect, pos.x, pos.y, 60);
        hitEffect.endFill();
        this.stage.addChild(hitEffect);

        setTimeout(() => {
            hitEffect.destroy();
        }, 100); // remove after 100ms
    }

    _createHexGrid() {
        if (this.hexGridCreated) {
            return;
        }
        this.hexGridCreated = true;

        const width = this.app.renderer.width || this.parent.clientWidth;
        const height = this.app.renderer.height || this.parent.clientHeight;
        const center = { x: width / 2, y: height / 2 };
        const radius = Math.min(width, height) * 0.22;
        this.zonePositions = [];

        const hexBackground = new PIXI.Graphics();
        hexBackground.beginFill(0x000000, 0.3);
        hexBackground.drawCircle(center.x, center.y, radius + 70);
        hexBackground.endFill();
        this.hexGroup.addChild(hexBackground);
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            const g = new PIXI.Graphics();
            g.beginFill(0x0a1220, 0.6);
            g.lineStyle(2, 0x1f3344, 0.6);
            this._drawHex(g, x, y, 60);
            g.endFill();
            this.hexGroup.addChild(g);
            this.zonePositions.push({ x, y });
        }
    }

    _drawHex(g, x, y, r) {
        const verts = [];
        for (let i = 0; i < 6; i++) verts.push({ x: x + r * Math.cos(Math.PI / 3 * i), y: y + r * Math.sin(Math.PI / 3 * i) });
        g.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < 6; i++) g.lineTo(verts[i].x, verts[i].y);
        g.closePath();
    }

    _spawnNote(note) {
        if (!note || typeof note.zone !== 'number') {
            return;
        }
        const zoneIndex = note.zone;
        const pos = this.zonePositions[zoneIndex];
        if (!pos) {
            return;
        }
        const g = new PIXI.Graphics();
        g.beginFill(0x6ee7b7);
        g.drawCircle(0, 0, 12);
        g.endFill();
        const spawnY = pos.y - 180;
        g.x = pos.x; g.y = spawnY;
        g.alpha = 0.95;
        const ring = new PIXI.Graphics();
        ring.lineStyle(3, 0x6ee7b7, 0.85);
        ring.drawCircle(0, 0, 36);
        ring.x = pos.x; ring.y = spawnY;
        ring.alpha = 0.9;
        this.stage.addChild(ring);
        this.stage.addChild(g);
        const targetTime = note.time; // ms
        const spawnedAt = this._now();
        this.activeNotes.push({ note, sprite: g, ring, spawnedAt, targetTime, zone: zoneIndex });
    }

    _now() {
        return performance.now() - this.startTime;
    }

    _update(delta) {
        const now = this._now();

        if (this.chart && this.chart.notes && this.scheduledIndex < this.chart.notes.length) {
            while (this.scheduledIndex < this.chart.notes.length) {
                const n = this.chart.notes[this.scheduledIndex];
                if (!n || typeof n.time !== 'number' || typeof n.zone !== 'number') {
                    this.scheduledIndex++;
                    continue;
                }
                const spawnTime = n.time - this.approachTime;
                if (now >= spawnTime) {
                    this._spawnNote(n);
                    this.scheduledIndex++;
                } else break;
            }
        }

        for (let i = this.activeNotes.length - 1; i >= 0; i--) {
            const a = this.activeNotes[i];
            const progress = (now - (a.targetTime - this.approachTime)) / this.approachTime;
            const pos = this.zonePositions[a.zone];
            if (!pos) {
                if (a.sprite) a.sprite.destroy();
                if (a.ring) a.ring.destroy();
                this.activeNotes.splice(i, 1);
                continue;
            }
            if (progress >= 1) {
                if (a.sprite) a.sprite.destroy();
                if (a.ring) a.ring.destroy();
                this.activeNotes.splice(i, 1);
                continue;
            }
            const t = Math.max(0, Math.min(1, progress));
            const startY = pos.y - 180;
            a.sprite.y = startY + (pos.y - startY) * t;
            a.sprite.scale.set(1 + 0.3 * t);
            a.sprite.alpha = 0.95 * (1 - 0.1 * t);
            if (a.ring) {
                a.ring.x = pos.x;
                a.ring.y = startY + (pos.y - startY) * t;
                const ringScale = Math.max(0.2, 1 - t);
                a.ring.scale.set(ringScale);
                a.ring.alpha = 0.9 * (1 - t);
            }
        }
    }
}