// ═══════════════════════════════════════════════════════════════════
//  threeGameplayLayer.js
//  1:1 port of dreamsync-lane-concept.html → ES Module
//  All rendering/geometry/VFX code is taken verbatim from the concept.
//  Only addition: export class wrapper + syncNotes() bridge API.
// ═══════════════════════════════════════════════════════════════════

import * as THREE_MODULE from '../../node_modules/three/build/three.module.min.js';

// ── Config (verbatim from concept) ──────────────────────────────────────────
export const CFG = {
    numLanes:      6,
    laneWidth:     2.4,
    sideLaneWidth: 3.6,
    hitLineZ:      5.2,
    sideHitLineZ:  5.2,
    sideTiltDeg:   35,
    sideFlareRad:  0.35,

    spawnZ:       -60,
    approachTime:  2.0,   // seconds — will be overwritten by gameplay.js (in ms), see syncNotes
    rushCurve:     1.4,

    timing: {
        perfect: 0.050,
        great:   0.100,
        good:    0.200,
    },
    trackOpacity:  0.85,
    holdOpacity:   0.60,
    enableCameraDynamics: true,

    laneColors: [
        0xaa44ff,
        0xff40d0,
        0x40b0ff,
        0x40b0ff,
        0xff40d0,
        0xaa44ff
    ],
    laneGlowColors: ['#aa44ff','#ff40d0','#40b0ff','#40b0ff','#ff40d0','#aa44ff'],
};

export class ThreeGameplayLayer {
    /**
     * @param {HTMLElement} parentElement  - DOM container to mount into
     * @param {boolean}     [editorMode]   - When true: disables camera tilt, hit beams, fever overlay
     */
    constructor(parentElement, editorMode = false) {
        const THREE = window.THREE || THREE_MODULE;
        if (!THREE) {
            console.error('[ThreeGameplayLayer] THREE.js must be loaded globally before this module.');
            return;
        }
        this.THREE = THREE;
        this._parentElement = parentElement;
        this._editorMode    = editorMode;

        // ── Scene ────────────────────────────────────────────────────────────
        const W = editorMode ? (parentElement.clientWidth  || 800)
                             :  window.innerWidth;
        const H = editorMode ? (parentElement.clientHeight || 600)
                             :  window.innerHeight;
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000010, 0.018);

        // Solid black base — bg-layer image sits behind the transparent canvas
        parentElement.style.background = '#000';

        this.camera = new THREE.PerspectiveCamera(68, W / H, 0.1, 300);
        this.camera.position.set(0, 5.5, 9.5);
        this.camera.lookAt(0, -1.5, -4);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        // Mount canvas into parent
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '0';
        this.renderer.domElement.style.pointerEvents = 'none';
        parentElement.insertBefore(this.renderer.domElement, parentElement.firstChild);

        // ── Lights (verbatim) ───────────────────────────────────────────────
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(0, 10, 5);
        this.scene.add(dirLight);

        // ── laneLocalX helper (verbatim) ────────────────────────────────────
        this._laneLocalX = (lane) => {
            if (lane === 0) return -CFG.sideLaneWidth / 2;
            if (lane === 5) return  CFG.sideLaneWidth / 2;
            return (lane - 2.5) * CFG.laneWidth;
        };

        // ── Track Architecture (verbatim) ───────────────────────────────────
        const numCenterLanes = 4;
        const trackW = numCenterLanes * CFG.laneWidth;

        const trackMat = new THREE.MeshStandardMaterial({
            color: 0x050510, roughness: 0.9, metalness: 0.1, transparent: true, opacity: CFG.trackOpacity,
        });
        const sideTrackMat = new THREE.MeshStandardMaterial({
            color: 0x070715, roughness: 0.9, metalness: 0.1, transparent: true, opacity: CFG.trackOpacity,
        });

        this.playfieldGroup = new THREE.Group();
        this.centerGroup    = new THREE.Group();

        this.leftWingGroup  = new THREE.Group();
        this.leftWingGroup.rotation.order = 'XYZ';
        this.leftWingGroup.rotation.y = -CFG.sideFlareRad;

        this.rightWingGroup = new THREE.Group();
        this.rightWingGroup.rotation.order = 'XYZ';
        this.rightWingGroup.rotation.y = CFG.sideFlareRad;

        this.playfieldGroup.add(this.centerGroup);
        this.playfieldGroup.add(this.leftWingGroup);
        this.playfieldGroup.add(this.rightWingGroup);
        this.scene.add(this.playfieldGroup);

        // addToLaneGroup helper (verbatim)
        this._addToLaneGroup = (mesh, lane) => {
            if (lane === 0) this.leftWingGroup.add(mesh);
            else if (lane === 5) this.rightWingGroup.add(mesh);
            else this.centerGroup.add(mesh);
        };

        // Colored lane point lights (verbatim)
        this.laneLights = CFG.laneColors.map((col, i) => {
            const l = new THREE.PointLight(col, 0, 8);
            l.position.set(this._laneLocalX(i), 0.5, (i === 0 || i === 5) ? CFG.sideHitLineZ : CFG.hitLineZ);
            this._addToLaneGroup(l, i);
            return l;
        });

        // Center flat track (verbatim)
        const trackGeo = new THREE.PlaneGeometry(trackW, 100);
        const track = new THREE.Mesh(trackGeo, trackMat);
        track.rotation.x = -Math.PI / 2;
        track.position.z = -40;
        this.centerGroup.add(track);

        // Side wings (verbatim)
        const tiltRad = CFG.sideTiltDeg * Math.PI / 180;
        this.leftWingGroup.position.set(-trackW / 2, 0, 0);
        this.leftWingGroup.rotation.set(0, 0, -tiltRad);

        this.rightWingGroup.position.set(trackW / 2, 0, 0);
        this.rightWingGroup.rotation.set(0, 0, tiltRad);

        const wingGeo   = new THREE.PlaneGeometry(CFG.sideLaneWidth, 100);
        const leftWing  = new THREE.Mesh(wingGeo, sideTrackMat);
        leftWing.rotation.x = -Math.PI / 2;
        leftWing.position.set(-CFG.sideLaneWidth / 2, 0, -40);
        this.leftWingGroup.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeo, sideTrackMat);
        rightWing.rotation.x = -Math.PI / 2;
        rightWing.position.set(CFG.sideLaneWidth / 2, 0, -40);
        this.rightWingGroup.add(rightWing);

        // ── Hit Lines (verbatim) ─────────────────────────────────────────────
        this._hitLineMat = new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.85 });
        this._hitGlowMat = new THREE.MeshBasicMaterial({ color: 0x8888ff, transparent: true, opacity: 0.18 });

        const centerHit = new THREE.Mesh(new THREE.PlaneGeometry(trackW, 0.12), this._hitLineMat);
        centerHit.rotation.x = -Math.PI / 2;
        centerHit.position.set(0, 0.01, CFG.hitLineZ);
        this.centerGroup.add(centerHit);

        const centerHitGlow = new THREE.Mesh(new THREE.PlaneGeometry(trackW, 0.7), this._hitGlowMat);
        centerHitGlow.rotation.x = -Math.PI / 2;
        centerHitGlow.position.set(0, 0.005, CFG.hitLineZ);
        this.centerGroup.add(centerHitGlow);

        // Hexagon slots on the centre judgement line (verbatim)
        const hexRadius  = CFG.laneWidth * 0.48;
        const hexSlotGeo = new THREE.RingGeometry(hexRadius - 0.12, hexRadius, 6);
        hexSlotGeo.rotateX(-Math.PI / 2);
        const hexSlotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });

        const hexFillGeo = new THREE.CircleGeometry(hexRadius - 0.12, 6);
        hexFillGeo.rotateX(-Math.PI / 2);
        const hexFillMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, side: THREE.DoubleSide });

        for (let i = 1; i <= 4; i++) {
            const slot = new THREE.Mesh(hexSlotGeo, hexSlotMat);
            slot.scale.set(1.0, 1.0, 0.75);
            slot.position.set(this._laneLocalX(i), 0.02, CFG.hitLineZ);
            this.centerGroup.add(slot);

            const fill = new THREE.Mesh(hexFillGeo, hexFillMat);
            fill.scale.set(1.0, 1.0, 0.75);
            fill.position.set(this._laneLocalX(i), 0.015, CFG.hitLineZ);
            this.centerGroup.add(fill);
        }

        // Side hitlines (verbatim)
        const leftHitLine = new THREE.Mesh(new THREE.PlaneGeometry(CFG.sideLaneWidth, 0.55), this._hitLineMat);
        leftHitLine.rotation.x = -Math.PI / 2;
        leftHitLine.position.set(-CFG.sideLaneWidth / 2, 0.01, CFG.sideHitLineZ);
        this.leftWingGroup.add(leftHitLine);

        const rightHitLine = new THREE.Mesh(new THREE.PlaneGeometry(CFG.sideLaneWidth, 0.55), this._hitLineMat);
        rightHitLine.rotation.x = -Math.PI / 2;
        rightHitLine.position.set(CFG.sideLaneWidth / 2, 0.01, CFG.sideHitLineZ);
        this.rightWingGroup.add(rightHitLine);

        // Touch Anchors mapping for lane dividers (verbatim from concept)
        this._touchAnchors = [];
        for (let i = 0; i <= 6; i++) {
            const a = new THREE.Object3D();
            if (i === 0)      { a.position.set(-CFG.sideLaneWidth, 0, CFG.sideHitLineZ); this.leftWingGroup.add(a); }
            else if (i === 6) { a.position.set( CFG.sideLaneWidth, 0, CFG.sideHitLineZ); this.rightWingGroup.add(a); }
            else              { a.position.set(-trackW / 2 + (i - 1) * CFG.laneWidth, 0, CFG.hitLineZ); this.centerGroup.add(a); }
            this._touchAnchors.push(a);
        }
        this._touchLaneBounds = [];


        // ── Lane Dividers Shader (verbatim) ──────────────────────────────────
        this._laneLines = [];
        const _createLaneLine = (group, localX, opacity, thickness, hitZ, color = 0xaa55ff) => {
            const normY = (hitZ - CFG.spawnZ) / (-CFG.spawnZ * 2);
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    uBaseColor:   { value: new THREE.Color(color) },
                    uGlowColor:   { value: new THREE.Color(0xffffff) },
                    uBaseOpacity: { value: opacity },
                    uPulse:       { value: 0.0 },
                    uHitY:        { value: 1.0 - normY }
                },
                vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                fragmentShader: `
                    uniform vec3 uBaseColor; uniform vec3 uGlowColor;
                    uniform float uBaseOpacity; uniform float uPulse; uniform float uHitY;
                    varying vec2 vUv;
                    void main() {
                        float dist = abs(vUv.y - uHitY);
                        float glow = 1.0 - smoothstep(0.0, 0.4, dist);
                        float wave = smoothstep(uPulse + 0.02, uPulse, vUv.y) * smoothstep(uPulse - 0.4, uPulse, vUv.y);
                        float highlight = (uPulse > 0.0 && uPulse < 1.2) ? wave : 0.0;
                        vec3 col = mix(uBaseColor, uGlowColor, highlight * 1.5);
                        float a = max(0.45, glow * 0.9 + highlight * 1.0);
                        gl_FragColor = vec4(col, uBaseOpacity * a);
                    }
                `,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
            });
            const line = new THREE.Mesh(new THREE.PlaneGeometry(thickness, 100), mat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(localX, 0.002, -40);
            group.add(line);
            this._laneLines.push({ mat });
        };

        // 7 dividers: outer/edge lines = purple, inner 4 center dividers = transparent white
        _createLaneLine(this.leftWingGroup,  -CFG.sideLaneWidth, 0.85, 0.08, CFG.sideHitLineZ, 0xaa55ff);
        for (let i = 0; i <= 4; i++) {
            const x       = -trackW / 2 + i * CFG.laneWidth;
            const isEdge  = (i === 0 || i === 4);
            _createLaneLine(
                this.centerGroup, x,
                isEdge ? 0.85 : 0.60,
                isEdge ? 0.08 : 0.05,
                CFG.hitLineZ,
                isEdge ? 0xaa55ff : 0xffffff   // inner lines = white
            );
        }
        _createLaneLine(this.rightWingGroup,  CFG.sideLaneWidth,  0.85, 0.08, CFG.sideHitLineZ, 0xaa55ff);

        // ── Lane Tap Highlights (verbatim) ───────────────────────────────────
        this.tapHighlights = Array.from({ length: CFG.numLanes }, (_, i) => {
            const isSide = (i === 0 || i === 5);
            const c = new THREE.Color(CFG.laneColors[i]);
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    uColor:   { value: c },
                    uOpacity: { value: 0.0 }
                },
                vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                fragmentShader: `
                    uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
                    void main() {
                        float alpha = smoothstep(0.0, 0.8, 1.0 - vUv.y) * uOpacity;
                        gl_FragColor = vec4(uColor, alpha);
                    }
                `,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
            });
            const w    = isSide ? CFG.sideLaneWidth - 0.1 : CFG.laneWidth - 0.08;
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 15.0), mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(this._laneLocalX(i), 0.012, (isSide ? CFG.sideHitLineZ : CFG.hitLineZ) - 7.5);
            this._addToLaneGroup(mesh, i);
            return { mesh, mat };
        });

        // ── Starfield (verbatim) ─────────────────────────────────────────────
        const starGeo   = new THREE.BufferGeometry();
        const starVerts = [];
        for (let i = 0; i < 3000; i++)
            starVerts.push((Math.random() - 0.5) * 300, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200);
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
        this._starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.5 }));
        this.scene.add(this._starField);

        // ── Note Pool & Geometry (verbatim) ──────────────────────────────────
        this._notePoolLine = [];
        this._notePoolHex  = [];

        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 0.5);
        arrowShape.lineTo(0.5, -0.1);
        arrowShape.lineTo(0.2, -0.1);
        arrowShape.lineTo(0.2, -0.5);
        arrowShape.lineTo(-0.2, -0.5);
        arrowShape.lineTo(-0.2, -0.1);
        arrowShape.lineTo(-0.5, -0.1);
        arrowShape.closePath();
        const arrowGeo = new THREE.ShapeGeometry(arrowShape);
        arrowGeo.scale(1.2, 1.2, 1.2);
        arrowGeo.rotateX(-0.3);
        this._arrowGeo = arrowGeo;

        // ── Particles ─────────────────────────────────────────────────────────
        this._particles = [];

        // ── Press effect pools (beam + diamonds) ─────────────────────────────
        // Diamond geometry: square plane rotated 45° = rhombus shape
        this._diamondGeo = new THREE.PlaneGeometry(0.22, 0.22);
        this._diamondGeo.rotateZ(Math.PI / 4);
        this._diamondPool = [];   // { mesh, mat, alive, vx, vy, life, maxLife }
        this._beamPool    = [];   // { mesh, mat, alive, life, maxLife }

        // ── Lane Pulse state ─────────────────────────────────────────────────
        this._lanePulse    = Array(CFG.numLanes).fill(0);
        this._lanePressed  = Array(CFG.numLanes).fill(false);
        this._tapTiltImpulse = 0;   // decaying tilt impulse from wing tap presses

        // ── Custom VFX ────────────────────────────────────────────────────────
        this._shakeImpulse = 0;
        this._feverFlash = 0;

        // ── Clock ─────────────────────────────────────────────────────────────
        this._clock = new THREE.Clock();
        this._tmpV3  = new THREE.Vector3(); // reused in _updateTouchBounds — avoids per-frame allocation

        // ── Resize handler ────────────────────────────────────────────────────
        this._onResizeBound = () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', this._onResizeBound);
    }

    // ── Note Pool helpers (verbatim logic from concept getNote/setupNoteObj/releaseNote) ──

    _getNote(lane) {
        const THREE   = this.THREE;
        const isSide  = (lane === 0 || lane === 5);
        const pool    = isSide ? this._notePoolLine : this._notePoolHex;

        let n = pool.pop();

        if (!n) {
            const group  = new THREE.Group();
            const mat    = new THREE.MeshStandardMaterial({
                color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7,
                roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.95,
            });
            const capMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
            const w      = isSide ? CFG.sideLaneWidth : CFG.laneWidth;
            let mesh, capGeo, cap, arrowMesh;

            if (isSide) {
                const geo = new THREE.BoxGeometry(w - 0.3, 0.22, 0.85);
                mesh      = new THREE.Mesh(geo, mat);
                capGeo    = new THREE.BoxGeometry(w - 0.3, 0.24, 0.15);
                cap       = new THREE.Mesh(capGeo, capMat);
                cap.position.z = 0.45;
                mesh.add(cap);
            } else {
                const radius = w * 0.48;
                const geo    = new THREE.CylinderGeometry(radius, radius, 0.12, 6);
                geo.rotateY(Math.PI / 2);
                mesh = new THREE.Mesh(geo, mat);
                mesh.scale.set(1.0, 1.0, 0.75);

                capGeo    = new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.14, 6);
                capGeo.rotateY(Math.PI / 2);
                cap       = new THREE.Mesh(capGeo, capMat);
                cap.position.y = 0.01;
                mesh.add(cap);

                const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 1.0, depthTest: false });
                arrowMesh      = new THREE.Mesh(this._arrowGeo, arrowMat);
                arrowMesh.position.y = 0.8;
                arrowMesh.visible    = false;
            }

            group.add(mesh);
            if (arrowMesh) group.add(arrowMesh);

            // Hold trail
            const trailGeo = new THREE.BoxGeometry(w - 0.4, 0.10, 1.0);
            trailGeo.translate(0, 0, -0.5);
            const trailMat  = new THREE.MeshStandardMaterial({
                color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5,
                transparent: true, opacity: CFG.holdOpacity
            });
            const trailMesh = new THREE.Mesh(trailGeo, trailMat);
            group.add(trailMesh);

            // Tail
            let tailMesh, tailCap, tailArrowMesh;
            if (isSide) {
                tailMesh = new THREE.Mesh(mesh.geometry, mat);
                tailCap  = new THREE.Mesh(capGeo, capMat);
                tailCap.position.z = -0.30;
            } else {
                tailMesh = new THREE.Mesh(mesh.geometry, mat);
                tailMesh.scale.set(1.0, 1.0, 0.75);
                tailCap  = new THREE.Mesh(capGeo, capMat);
                tailCap.position.y = -0.01;
                
                // Tail flick arrow
                const tailArrowMat = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide });
                tailArrowMesh = new THREE.Mesh(this._arrowGeo, tailArrowMat);
                tailArrowMesh.position.y = 0.8;
                tailArrowMesh.visible = false;
                tailMesh.add(tailArrowMesh);
            }
            tailMesh.add(tailCap);
            group.add(tailMesh);

            n = { group, headMesh: mesh, mat, trailMesh, trailMat, tailMesh, capMat, isSide, laneAlloc: lane, arrowMesh, tailArrowMesh };
        }

        this._addToLaneGroup(n.group, lane);
        n.group.position.x = this._laneLocalX(lane);
        n.group.visible    = true;
        return n;
    }

    _setupNoteObj(n, duration, isExNote = false, isEx2Note = false, isFlick = false, tailType = '') {
        // Apply EX note colors — tint the material on reuse from pool
        const noteColor = isEx2Note ? 0x00cfff
                        : isExNote  ? 0xff40ff
                        : n.isSide  ? 0x00ffff   // side lanes stay cyan (verbatim concept)
                        : 0xffffff;              // center lanes stay white
        const emissiveIntensity = (isExNote || isEx2Note) ? 1.2 : 0.7;

        n.mat.color.setHex(noteColor);
        n.mat.emissive.setHex(noteColor);
        n.mat.emissiveIntensity = emissiveIntensity;
        if (n.capMat) {
            n.capMat.color.setHex(noteColor);
        }

        n.mat.opacity     = 0.0;
        n.trailMat.opacity = 0.0;
        if (n.capMat) n.capMat.opacity = 0.0;

        const noteSpeed = (CFG.hitLineZ - CFG.spawnZ) / CFG.approachTime;
        if (duration > 0) {
            n.trailMesh.visible = true;
            n.tailMesh.visible  = true;
            const len = duration * noteSpeed;
            n.trailMesh.scale.z   = len;
            n.tailMesh.position.z = -len;
            
            if (n.tailArrowMesh) {
                n.tailArrowMesh.visible = (tailType === 'flick');
            }
        } else {
            n.trailMesh.visible = false;
            n.tailMesh.visible  = false;
            if (n.tailArrowMesh) n.tailArrowMesh.visible = false;
        }
        
        if (n.arrowMesh) {
            n.arrowMesh.visible = isFlick;
        }
    }

    _releaseNote(n) {
        n.group.visible = false;
        (n.isSide ? this._notePoolLine : this._notePoolHex).push(n);
    }

    // ── VFX helpers (verbatim from concept burst / ringFlash) ─────────────────

    _burst(lane, color) {
        const THREE = this.THREE;
        const count = 22;
        for (let i = 0; i < count; i++) {
            let p = this._particles.find(p => !p.alive);
            if (!p) {
                const geo  = new THREE.SphereGeometry(0.06, 4, 4);
                const mat  = new THREE.MeshBasicMaterial({ color, transparent: true });
                const mesh = new THREE.Mesh(geo, mat);
                p = { mesh, mat, alive: false, vx:0, vy:0, vz:0, life:0, maxLife:0 };
                this._particles.push(p);
            }
            p.alive = true;
            p.mesh.visible = true;
            p.mat.color.setHex(color);
            p.mesh.position.set(this._laneLocalX(lane), 0.3, (lane === 0 || lane === 5) ? CFG.sideHitLineZ : CFG.hitLineZ);
            this._addToLaneGroup(p.mesh, lane);

            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const speed = 0.06 + Math.random() * 0.12;
            p.vx = Math.cos(angle) * speed;
            p.vy = 0.04 + Math.random() * 0.1;
            p.vz = Math.sin(angle) * speed * 0.4;
            p.life    = 1.0;
            p.maxLife = 0.7 + Math.random() * 0.5;
            p.mesh.scale.setScalar(0.8 + Math.random() * 1.2);
        }
    }

    _ringFlash(lane, color) {
        const THREE   = this.THREE;
        const ringGeo = new THREE.RingGeometry(0.1, 0.7, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        const ring    = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(this._laneLocalX(lane), 0.05, (lane === 0 || lane === 5) ? CFG.sideHitLineZ : CFG.hitLineZ);
        this._addToLaneGroup(ring, lane);

        let scale = 1, life = 1;
        const tick = () => {
            life -= 0.05; scale += 0.15;
            ring.scale.setScalar(scale);
            ringMat.opacity = life * 0.9;
            if (life <= 0) {
                if (ring.parent) ring.parent.remove(ring);
                return;
            }
            requestAnimationFrame(tick);
        };
        tick();
    }

    // ── Public trigger (called by gameplay.js showHitFeedback shim) ─────────
    triggerHitEffect(zone, grade) {
        const color = grade === 'perfect' ? 0xffd700 : grade === 'great' ? 0x80ff80 : 0x6699ff;
        this._burst(zone, color);
        this._ringFlash(zone, color);
        this.tapHighlights[zone].mat.uniforms.uOpacity.value = 0.4;
        this.laneLights[zone].intensity = 4;
        this._lanePulse[zone] = 0.01;
    }

    // ── getNoteZ (verbatim animate loop helper) ──────────────────────────────
    _getNoteZ(timeLeft, targetZ) {
        let p = 1.0 - (timeLeft / CFG.approachTime);
        let curveP;
        if (p <= 1.0) {
            curveP = Math.pow(Math.max(0, p), CFG.rushCurve);
        } else {
            const slope = CFG.rushCurve;
            curveP = 1.0 + (p - 1.0) * slope;
        }
        return CFG.spawnZ + curveP * (targetZ - CFG.spawnZ);
    }

    // ── syncNotes — called every frame by gameplay.js ────────────────────────
    //   engineActiveNotes: gameplay.js activeNotes array
    //   currentTime:       ms (from audioManager)
    //   approachTimeMs:    ms (from gameplay.js this.approachTime)
    syncNotes(engineActiveNotes, currentTime, approachTimeMs) {
        if (!this.renderer) return;

        // Convert ms → seconds for the concept math
        const approachSec = approachTimeMs / 1000;
        const nowSec      = currentTime / 1000;

        // Sync approach time into CFG so helpers use correct value
        CFG.approachTime = approachSec;

        const delta = this._clock.getDelta();

        // ── Spawn or update each engine note ────────────────────────────────
        // We maintain a Map of index → concept noteObj
        if (!this._activeMap) this._activeMap = new Map();

        const seenIndices = new Set();

        for (const n of engineActiveNotes) {
            seenIndices.add(n.index);
            const hZ = (n.zone === 0 || n.zone === 5) ? CFG.sideHitLineZ : CFG.hitLineZ;

            // Spawn if new
            if (!this._activeMap.has(n.index)) {
                const noteObj = this._getNote(n.zone);
                noteObj.group.position.set(this._laneLocalX(n.zone), 0.12, CFG.spawnZ);
                this._activeMap.set(n.index, { noteObj, engineNote: n });
            }

            const entry   = this._activeMap.get(n.index);
            const noteObj = entry.noteObj;
            
            // Update note visuals every frame (allows editor to change duration/type dynamically)
            this._setupNoteObj(noteObj, (n.holdDuration || 0) / 1000, n.isExNote, n.isEx2Note, n.isFlick, n.tailType);

            const hitTimeSec  = n.targetTime / 1000;
            const timeLeft    = hitTimeSec - nowSec;
            const headZ       = this._getNoteZ(timeLeft, hZ);
            noteObj.group.position.z = headZ;

            // Spawn float animation (verbatim)
            const spawnProgress = 1.0 - (timeLeft / CFG.approachTime);
            if (spawnProgress < 0.15) {
                const sf = Math.max(0, spawnProgress / 0.15);
                noteObj.group.position.y     = (1.0 - sf) * 6.0;
                noteObj.mat.opacity          = sf * 0.95;
                if (noteObj.capMat) noteObj.capMat.opacity  = sf * 0.9;
                noteObj.trailMat.opacity     = sf * CFG.holdOpacity;
                if (noteObj.arrowMesh) noteObj.arrowMesh.material.opacity = sf;
                if (noteObj.tailArrowMesh) noteObj.tailArrowMesh.material.opacity = sf;
            } else if (timeLeft >= 0) {
                noteObj.group.position.y     = 0;
                noteObj.mat.opacity          = 0.95;
                if (noteObj.capMat) noteObj.capMat.opacity  = 0.9;
                noteObj.trailMat.opacity     = CFG.holdOpacity;
                if (noteObj.arrowMesh) noteObj.arrowMesh.material.opacity = 1.0;
                if (noteObj.tailArrowMesh) noteObj.tailArrowMesh.material.opacity = 1.0;
            } else {
                // Past hitline — soften (verbatim)
                const fade = Math.max(0.3, 1.0 + (timeLeft / 0.15));
                noteObj.mat.opacity          = 0.95 * fade;
                noteObj.trailMat.opacity     = CFG.holdOpacity * fade;
                if (noteObj.capMat) noteObj.capMat.opacity  = 0.90 * fade;
            }

            // Hold tail (verbatim)
            if (n.holdDuration > 0) {
                const holdEndSec = (n.targetTime + n.holdDuration) / 1000;
                const tailTimeLeft = holdEndSec - nowSec;
                const tailZ = this._getNoteZ(tailTimeLeft, hZ);
                const len   = Math.abs(tailZ - headZ);
                noteObj.trailMesh.scale.z  = len;
                noteObj.tailMesh.position.z = -len;
            }
        }

        // ── Release notes that gameplay removed ──────────────────────────────
        for (const [idx, entry] of this._activeMap) {
            if (!seenIndices.has(idx)) {
                this._releaseNote(entry.noteObj);
                this._activeMap.delete(idx);
            }
        }

        // ── Animate (verbatim from concept animate loop) ─────────────────────

        // Particles
        for (const p of this._particles) {
            if (!p.alive) continue;
            p.life -= delta / p.maxLife;
            if (p.life <= 0) { p.alive = false; p.mesh.visible = false; continue; }
            p.mesh.position.x += p.vx;
            p.mesh.position.y += p.vy;
            p.mesh.position.z += p.vz;
            p.vy -= 0.004;
            p.mat.opacity = p.life;
            p.mesh.scale.setScalar((0.5 + p.life) * 0.8);
        }

        // Hit line pulse (verbatim)
        this._hitLineMat.opacity = 0.7 + 0.15 * Math.sin(nowSec * 8);
        this._hitGlowMat.opacity = 0.1 + 0.08 * Math.sin(nowSec * 8);

        // Lane pulse advance (verbatim)
        for (let i = 0; i < CFG.numLanes; i++) {
            if (this._lanePulse[i] > 0) {
                this._lanePulse[i] += delta * 2.5;
                if (this._lanePulse[i] > 1.2) this._lanePulse[i] = 0;
            }
            if (!this._lanePressed[i]) {
                this.laneLights[i].intensity = Math.max(0, this.laneLights[i].intensity - delta * 8);
                this.tapHighlights[i].mat.uniforms.uOpacity.value = Math.max(0, this.tapHighlights[i].mat.uniforms.uOpacity.value - delta * 4);
            }
        }

        // Apply pulse to lane border lines (verbatim)
        for (let i = 0; i <= CFG.numLanes; i++) {
            const pLeft  = i > 0            ? this._lanePulse[i - 1] : 0;
            const pRight = i < CFG.numLanes ? this._lanePulse[i]     : 0;
            this._laneLines[i].mat.uniforms.uPulse.value = Math.max(pLeft, pRight);
        }

        // Star drift (verbatim)
        this._starField.rotation.z += delta * 0.005;

        // Camera dynamics (verbatim)
        if (CFG.enableCameraDynamics) {
            let holdLeft = false, holdRight = false;
            for (const n of engineActiveNotes) {
                if (n.holdStarted && !n.hit) {
                    if (n.zone === 0) holdLeft  = true;
                    if (n.zone === 5) holdRight = true;
                }
            }
            let targetTiltZ = 0, targetTiltX = 0;
            if (holdLeft && !holdRight)  { targetTiltZ =  0.04; targetTiltX = -0.6; }
            else if (holdRight && !holdLeft) { targetTiltZ = -0.04; targetTiltX =  0.6; }

            this.camera.rotation.z += (targetTiltZ - this.camera.rotation.z) * delta * 6;
            this.camera.position.x += (targetTiltX - this.camera.position.x) * delta * 5;
            this.camera.position.y = 5.5 + Math.sin(nowSec * 0.4) * 0.04;
        } else {
            this.camera.rotation.z = 0;
            this.camera.position.x = 0;
            this.camera.position.y = 5.5;
        }

        this.renderer.render(this.scene, this.camera);
    }

    // ── Lane press visual (called by gameplay input bridge if needed) ─────────
    pressLane(lane) {
        this._lanePressed[lane] = true;
        this.tapHighlights[lane].mat.uniforms.uOpacity.value = 0.45;
        this.laneLights[lane].intensity = 3;
        this._lanePulse[lane] = 0.01;
        // Wing tap tilt impulse
        if (lane === 0) this._tapTiltImpulse =  0.085;
        if (lane === 5) this._tapTiltImpulse = -0.085;
    }

    // ── Hit beam + diamond particles (called from _onHit with note color) ────────
    spawnHitBeam(lane, color = 0xffffff) {
        const THREE   = this.THREE;
        const isSide  = (lane === 0 || lane === 5);
        const hZ      = isSide ? CFG.sideHitLineZ : CFG.hitLineZ;
        const x       = this._laneLocalX(lane);
        const w       = isSide ? CFG.sideLaneWidth * 0.82 : CFG.laneWidth * 0.82;
        const beamCol = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45);

        // ── Light beam ───────────────────────────────────────────────────────
        let beam = this._beamPool.find(b => !b.alive);
        if (!beam) {
            const geo = new THREE.PlaneGeometry(1, 1);
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    uColor:   { value: new THREE.Color() },
                    uOpacity: { value: 1.0 },
                },
                vertexShader: `
                    varying vec2 vUv;
                    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
                `,
                fragmentShader: `
                    uniform vec3  uColor;
                    uniform float uOpacity;
                    varying vec2  vUv;
                    void main() {
                        // Narrow bright core + soft wide wings
                        float cx    = abs(vUv.x - 0.5) * 2.0;
                        float core  = smoothstep(1.0, 0.0, cx * 2.5);
                        float wings = smoothstep(1.0, 0.0, cx);
                        float fade  = pow(1.0 - vUv.y, 1.4);   // bright at base, gone at top
                        float a     = (core * 0.9 + wings * 0.35) * fade * uOpacity;
                        gl_FragColor = vec4(uColor, clamp(a, 0.0, 1.0));
                    }
                `,
                transparent: true, depthWrite: false,
                blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geo, mat);
            beam = { mesh, mat, alive: false, life: 1.0, maxLife: 0.45 };
            this._beamPool.push(beam);
        }
        beam.alive   = true;
        beam.life    = 1.0;
        beam.maxLife = 0.42;
        beam.mat.uniforms.uColor.value.copy(beamCol);
        beam.mat.uniforms.uOpacity.value = 0.92;
        beam.mesh.scale.set(w, 3.5, 1.0);
        beam.mesh.position.set(x, 1.75, hZ);  // y=1.75 centres a height-3.5 beam above the floor
        beam.mesh.rotation.set(0, 0, 0);
        beam.mesh.visible = true;
        this._addToLaneGroup(beam.mesh, lane);

        // ── Diamond particles ────────────────────────────────────────────────
        const count = 10;
        for (let i = 0; i < count; i++) {
            let d = this._diamondPool.find(p => !p.alive);
            if (!d) {
                const mat  = new THREE.MeshBasicMaterial({
                    color: 0xffffff, transparent: true, opacity: 1.0,
                    depthTest: false, side: THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(this._diamondGeo, mat);
                d = { mesh, mat, alive: false, vx: 0, vy: 0, life: 0, maxLife: 0 };
                this._diamondPool.push(d);
            }
            d.alive   = true;
            d.life    = 1.0;
            d.maxLife = 0.40 + Math.random() * 0.30;
            d.mat.color.copy(beamCol).lerp(new THREE.Color(0xffffff), Math.random() * 0.5);
            d.mat.opacity = 1.0;
            d.mesh.position.set(
                x + (Math.random() - 0.5) * w * 1.3,
                Math.random() * 0.8,
                hZ + (Math.random() - 0.5) * 0.25
            );
            d.mesh.rotation.z = Math.random() * Math.PI;
            d.mesh.scale.setScalar(0.5 + Math.random() * 1.1);
            d.vx = (Math.random() - 0.5) * 0.022;
            d.vy = 0.045 + Math.random() * 0.075;
            d.mesh.visible = true;
            this._addToLaneGroup(d.mesh, lane);
        }
    }

    triggerShake(intensity) {
        this._shakeImpulse = Math.max(this._shakeImpulse, intensity);
    }

    triggerFeverFireworks() {
        this._feverFlash = 1.0;
        if (this._parentElement) {
            // Dispatch a DOM event so the editor shell can draw beautiful 2D fever UI overlays
            const event = new CustomEvent('dsx-fever-trigger');
            this._parentElement.dispatchEvent(event);
        }
    }

    releaseLane(lane) {
        this._lanePressed[lane] = false;
    }

    // ── _renderFrame — called every frame by gameplay.js after note updates ───
    //   audioTime: seconds
    //   activeNotes: concept format array
    _renderFrame(audioTime, activeNotes) {
        const delta = this._clock.getDelta();

        // Fever Flash Screen Tint
        if (this._feverFlash > 0) {
            this._feverFlash -= delta * 1.5;
            if (this._feverFlash < 0) this._feverFlash = 0;
            const hue = (audioTime * 2.0) % 1.0;
            const hslColor = new this.THREE.Color().setHSL(hue, 1.0, 0.5);
            this.scene.fog.color.lerpColors(new this.THREE.Color(0x000010), hslColor, this._feverFlash * 0.4);
            this.scene.background = this.scene.fog.color;
        } else {
            this.scene.fog.color.setHex(0x000010);
            this.scene.background = null;
        }

        // Sphere particles
        for (const p of this._particles) {
            if (!p.alive) continue;
            p.life -= delta / p.maxLife;
            if (p.life <= 0) { p.alive = false; p.mesh.visible = false; continue; }
            p.mesh.position.x += p.vx;
            p.mesh.position.y += p.vy;
            p.mesh.position.z += p.vz;
            p.vy -= 0.004;
            p.mat.opacity = p.life;
            p.mesh.scale.setScalar((0.5 + p.life) * 0.8);
        }

        // Beam press effects
        for (const b of this._beamPool) {
            if (!b.alive) continue;
            b.life -= delta / b.maxLife;
            if (b.life <= 0) { b.alive = false; b.mesh.visible = false; continue; }
            b.mat.uniforms.uOpacity.value = b.life * 0.92;
            // Slight upward stretch as it fades
            b.mesh.scale.y = 3.5 + (1.0 - b.life) * 1.0;
            b.mesh.position.y = b.mesh.scale.y * 0.5;
        }

        // Diamond press particles
        for (const d of this._diamondPool) {
            if (!d.alive) continue;
            d.life -= delta / d.maxLife;
            if (d.life <= 0) { d.alive = false; d.mesh.visible = false; continue; }
            d.mesh.position.x += d.vx;
            d.mesh.position.y += d.vy;
            d.vy -= 0.0015;            // gentle gravity
            d.mesh.rotation.z += 0.04; // spin
            d.mat.opacity = d.life;
            d.mesh.scale.setScalar(0.3 + d.life * 0.7);
        }

        // Hit line pulse (verbatim)
        this._hitLineMat.opacity = 0.7 + 0.15 * Math.sin(audioTime * 8);
        this._hitGlowMat.opacity = 0.1 + 0.08 * Math.sin(audioTime * 8);

        // Lane pulse advance (verbatim)
        for (let i = 0; i < CFG.numLanes; i++) {
            if (this._lanePulse[i] > 0) {
                this._lanePulse[i] += delta * 2.5;
                if (this._lanePulse[i] > 1.2) this._lanePulse[i] = 0;
            }
            if (!this._lanePressed[i]) {
                this.laneLights[i].intensity = Math.max(0, this.laneLights[i].intensity - delta * 8);
                this.tapHighlights[i].mat.uniforms.uOpacity.value = Math.max(0, this.tapHighlights[i].mat.uniforms.uOpacity.value - delta * 4);
            }
        }

        // Apply pulse to lane border lines (verbatim)
        for (let i = 0; i <= CFG.numLanes; i++) {
            const pLeft  = i > 0            ? this._lanePulse[i - 1] : 0;
            const pRight = i < CFG.numLanes ? this._lanePulse[i]     : 0;
            this._laneLines[i].mat.uniforms.uPulse.value = Math.max(pLeft, pRight);
        }

        // Star drift (verbatim)
        this._starField.rotation.z += delta * 0.005;

        // Camera dynamics (editor mode skips tilt — no touch input)
        if (CFG.enableCameraDynamics && !this._editorMode) {
            let holdLeft = false, holdRight = false;
            for (const n of activeNotes) {
                if (n.holding && !n.hit) {
                    if (n.lane === 0) holdLeft  = true;
                    if (n.lane === 5) holdRight = true;
                }
            }

            // Hold-note sustained tilt
            let targetTiltZ = 0, targetTiltX = 0;
            if (holdLeft  && !holdRight) { targetTiltZ =  0.065; targetTiltX = -0.9; }
            else if (holdRight && !holdLeft) { targetTiltZ = -0.065; targetTiltX =  0.9; }

            // Tap impulse: decays to zero quickly, stacks with hold tilt
            this._tapTiltImpulse *= Math.pow(0.018, delta); // ~half-life ≈ 0.15s
            const totalTiltZ = targetTiltZ + this._tapTiltImpulse;

            this.camera.rotation.z += (totalTiltZ - this.camera.rotation.z) * delta * 10;
            this.camera.position.x += (targetTiltX - this.camera.position.x) * delta * 5;
            this.camera.position.y = 5.5 + Math.sin(audioTime * 0.4) * 0.04;
        } else {
            this.camera.rotation.z = 0;
            this.camera.position.x = 0;
            this.camera.position.y = 5.5;
        }

        // Ensure Editor / Shake bypasses the mode disable
        if (this._shakeImpulse > 0) {
            const t = performance.now() * 0.05;
            this.camera.position.x += Math.sin(t) * this._shakeImpulse;
            this.camera.position.y += Math.cos(t * 1.3) * this._shakeImpulse;
            this.camera.rotation.z += Math.sin(t * 0.8) * this._shakeImpulse * 0.15;
            
            this._shakeImpulse *= Math.pow(0.001, delta); // rapid decay
            if (this._shakeImpulse < 0.005) this._shakeImpulse = 0;
        }

        this.renderer.render(this.scene, this.camera);

        // Update touch lane bounds after render (world → screen projection)
        this._updateTouchBounds();
    }

    // ── Touch lane bounds (verbatim concept updateTouchBounds) ────────────────
    _updateTouchBounds() {
        if (!this._touchAnchors || this._touchAnchors.length < 7) return;
        const W  = window.innerWidth;
        const v  = this._tmpV3;   // reuse — no allocation
        this.camera.updateMatrixWorld();
        const screenXs = [];
        for (let i = 0; i <= 6; i++) {
            this._touchAnchors[i].getWorldPosition(v);
            v.project(this.camera);
            screenXs.push((v.x * 0.5 + 0.5) * W);
        }
        this._touchLaneBounds = [];
        for (let i = 0; i < 5; i++) this._touchLaneBounds[i] = screenXs[i + 1];
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────
    destroy() {
        if (this.renderer) {
            this.renderer.domElement.remove();
            this.renderer.dispose();
            this.renderer = null;
        }
        window.removeEventListener('resize', this._onResizeBound);
    }
}

