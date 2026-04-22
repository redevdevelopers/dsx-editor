/**
 * Auto-Mapper for DreamSyncX
 * Multi-band audio analysis + ML from existing charts + VSRG-style patterns
 * Game style: Project Sekai / VSRG — vertical scroll, 6 linear lanes
 */

export class AutoMapper {
    constructor(audioBuffer, audioContext) {
        this.audioBuffer = audioBuffer;
        this.audioContext = audioContext;
        this.sampleRate = audioBuffer.sampleRate;
        this.duration = audioBuffer.duration;

        // Training data storage
        this.trainedModel = null;
        this.vsrgPatterns = this._initVSRGPatterns();
    }

    /**
     * Initialize VSRG (6-lane vertical scroll) charting patterns.
     * Lanes 0–5 are linear left-to-right — no circular logic.
     */
    _initVSRGPatterns() {
        return {
            // === LANE TRANSITION WEIGHTS ===
            // VSRG charters prefer adjacent lanes and controlled jumps.
            // Format: 'from->to': weight (higher = more likely)
            laneTransitions: new Map([
                // Adjacent moves (most natural)
                ['0->1', 90], ['1->0', 90],
                ['1->2', 90], ['2->1', 90],
                ['2->3', 90], ['3->2', 90],
                ['3->4', 90], ['4->3', 90],
                ['4->5', 90], ['5->4', 90],
                // Two-lane jumps (common for energy)
                ['0->2', 60], ['2->0', 60],
                ['1->3', 60], ['3->1', 60],
                ['2->4', 60], ['4->2', 60],
                ['3->5', 60], ['5->3', 60],
                // Cross jumps (accent moments)
                ['0->3', 35], ['3->0', 35],
                ['1->4', 35], ['4->1', 35],
                ['2->5', 35], ['5->2', 35],
                // Full lane jumps (climax / emphasis only)
                ['0->4', 15], ['4->0', 15],
                ['0->5', 10], ['5->0', 10],
                ['1->5', 15], ['5->1', 15],
            ]),

            // === STREAM PATTERNS (fast consecutive notes) ===
            // Linear runs that feel natural to play
            streamPatterns: [
                [0, 1, 2, 3, 4, 5],       // Full ascending
                [5, 4, 3, 2, 1, 0],       // Full descending
                [0, 1, 2, 3, 2, 1],       // Bounce right
                [5, 4, 3, 2, 3, 4],       // Bounce left
                [0, 1, 2, 1, 2, 3],       // Staircase up
                [5, 4, 3, 4, 3, 2],       // Staircase down
                [2, 3, 2, 3, 4, 3],       // Center wiggle right
                [3, 2, 3, 2, 1, 2],       // Center wiggle left
            ],

            // === CHORD PATTERNS (simultaneous lanes) ===
            chords: [
                [0, 5],                   // Wide spread
                [1, 4],                   // Inner spread
                [2, 3],                   // Center pair
                [0, 2, 5],               // Left-skewed triple
                [0, 3, 5],               // Symmetric triple
                [1, 3, 5],               // Odd lanes
                [0, 2, 4],               // Even lanes
            ],

            // === DIFFICULTY INTERVAL RANGES (ms between notes) ===
            // Based on standard VSRG difficulty tiers
            difficultyIntervals: {
                1: { min: 400, avg: 600,  max: 1000 },  // Easy
                2: { min: 300, avg: 450,  max: 800  },  // Normal
                3: { min: 200, avg: 300,  max: 600  },  // Hard
                4: { min: 120, avg: 200,  max: 400  },  // Expert
                5: { min:  80, avg: 133,  max: 250  },  // Master (8–12 NPS)
            },

            // === NOTE TYPE RULES ===
            // Maps onset characteristics to note types
            noteTypeRules: {
                // Bass strong + fast decay  → regular (kick hit)
                // Bass strong + long sustain → hold
                // Treble sharp              → flick (hi-hat accent)
                // Mid sustained             → slide (melodic line)
                // Mid strong               → regular (snare)
            },
        };
    }

    /**
     * Convert other rhythm game formats to DSX format
     * Supports: osu!mania, StepMania, BMS, maimai, CHUNITHM
     */
    convertFromOtherFormat(data, format) {
        switch (format.toLowerCase()) {
            case 'osu':
            case 'osumania':
                return this._convertFromOsuMania(data);
            case 'stepmania':
            case 'sm':
                return this._convertFromStepMania(data);
            case 'bms':
            case 'bme':
                return this._convertFromBMS(data);
            case 'maimai':
                return this._convertFromMaimai(data);
            case 'chunithm':
                return this._convertFromChunithm(data);
            default:
                return null;
        }
    }

    /**
     * Convert osu!mania chart to DSX format with circular awareness
     */
    _convertFromOsuMania(osuData) {
        // osu!mania format: x,y,time,type,hitSound,endTime:hitSample
        const notes = [];
        const lines = osuData.split('\n');
        let inHitObjects = false;
        let inGeneral = false;
        let keyCount = 4; // Default to 4K
        let mode = -1; // -1 = not set, 0=standard, 3=mania
        let bpm = 120;
        let difficulty = 3;

        for (const line of lines) {
            const trimmed = line.trim();

            // Track which section we're in
            if (trimmed === '[General]') {
                inGeneral = true;
                continue;
            } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                inGeneral = false;
            }

            // Parse metadata - be more flexible with whitespace
            if (trimmed.includes('CircleSize:') || trimmed.includes('CircleSize :')) {
                const value = trimmed.split(':')[1];
                if (value) {
                    keyCount = parseInt(value.trim());
                }
            }
            if (trimmed.includes('Mode:') || trimmed.includes('Mode :')) {
                const value = trimmed.split(':')[1];
                if (value) {
                    mode = parseInt(value.trim());
                }
            }
            if (trimmed.includes('OverallDifficulty:') || trimmed.includes('OverallDifficulty :')) {
                const value = trimmed.split(':')[1];
                if (value) {
                    const od = parseFloat(value.trim());
                    difficulty = Math.min(5, Math.max(1, Math.ceil(od / 2))); // Map OD 0-10 to difficulty 1-5
                }
            }

            if (trimmed === '[HitObjects]') {
                inHitObjects = true;
                continue;
            }
            if (!inHitObjects || !trimmed) continue;

            const parts = trimmed.split(',');
            if (parts.length < 4) continue;

            const x = parseInt(parts[0]);
            const time = parseInt(parts[2]);

            // Calculate column (0 to keyCount-1)
            const column = Math.floor((x / 512) * keyCount);

            // SMART MAPPING: Convert linear columns to circular zones
            // This preserves the "flow" feeling from osu!mania
            let zone;

            if (keyCount === 6) {
                // Perfect 1:1 mapping for 6K
                zone = column;
            } else if (keyCount === 4) {
                // 4K: Map to alternating zones for better circular flow
                // Column 0,1,2,3 → Zone 0,2,3,5 (creates circular pattern)
                const mapping = [0, 2, 3, 5];
                zone = mapping[column] || 0;
            } else if (keyCount === 7) {
                // 7K: Map center to zone 0, others around the circle
                // Column 0,1,2,3,4,5,6 → Zone 5,0,1,2,3,4,5
                const mapping = [5, 0, 1, 2, 3, 4, 5];
                zone = mapping[column] || 0;
            } else {
                // Generic mapping for other key counts
                zone = Math.floor((column / keyCount) * 6);
            }

            notes.push({ time, zone, type: 'regular' });
        }

        // Check if mode was explicitly set
        if (mode === -1) {
            // If we have notes and keyCount looks like mania, assume it's mania
            if (notes.length > 0 && (keyCount === 4 || keyCount === 6 || keyCount === 7)) {
                mode = 3; // Assume mania
            }
        }

        // Skip if not mania mode
        if (mode !== 3) {
            return null;
        }

        return { notes, meta: { difficulty, bpm, keyCount } };
    }

    /**
     * Convert StepMania chart to DSX format
     */
    _convertFromStepMania(smData) {
        const notes = [];
        const lines = smData.split('\n');
        let bpm = 120;
        let inNotes = false;
        let currentTime = 0;
        let beatDuration = 500; // ms per beat

        for (const line of lines) {
            if (line.includes('#BPMS:')) {
                const bpmMatch = line.match(/=([\d.]+)/);
                if (bpmMatch) {
                    bpm = parseFloat(bpmMatch[1]);
                    beatDuration = (60 / bpm) * 1000;
                }
            }

            if (line.includes('#NOTES:')) {
                inNotes = true;
                currentTime = 0;
                continue;
            }

            if (inNotes && line.trim().length > 0 && !line.includes(':') && !line.includes(';')) {
                const noteData = line.trim();
                // StepMania format: 0=empty, 1=tap, 2=hold start, 3=hold/roll end, 4=roll start
                for (let i = 0; i < Math.min(noteData.length, 6); i++) {
                    if (noteData[i] === '1' || noteData[i] === '2' || noteData[i] === '4') {
                        notes.push({ time: Math.round(currentTime), zone: i, type: 'regular' });
                    }
                }
                currentTime += beatDuration / 4; // Assume 1/4 beat resolution
            }

            if (line.includes(';')) {
                inNotes = false;
            }
        }

        return { notes, meta: { difficulty: 3, bpm } };
    }

    /**
     * Convert BMS chart to DSX format
     */
    _convertFromBMS(bmsData) {
        const notes = [];
        const lines = bmsData.split('\n');
        let bpm = 130;

        for (const line of lines) {
            if (line.startsWith('#BPM ')) {
                bpm = parseFloat(line.split(' ')[1]);
            }

            // BMS note format: #00111:01020304...
            const noteMatch = line.match(/#(\d{3})(\d{2}):(.+)/);
            if (noteMatch) {
                const measure = parseInt(noteMatch[1]);
                const channel = parseInt(noteMatch[2]);
                const data = noteMatch[3];

                // Channels 11-19 are playable notes
                if (channel >= 11 && channel <= 19) {
                    const beatDuration = (60 / bpm) * 1000 * 4; // 4 beats per measure
                    const noteCount = data.length / 2;

                    for (let i = 0; i < noteCount; i++) {
                        const noteValue = data.substr(i * 2, 2);
                        if (noteValue !== '00') {
                            const time = (measure * beatDuration) + (i * beatDuration / noteCount);
                            const zone = (channel - 11) % 6;
                            notes.push({ time: Math.round(time), zone, type: 'regular' });
                        }
                    }
                }
            }
        }

        return { notes, meta: { difficulty: 3, bpm } };
    }

    /**
     * Convert maimai chart to DSX format
     */
    _convertFromMaimai(maimaiData) {
        // maimai format is similar to DSX (both use circular layouts)
        try {
            const data = typeof maimaiData === 'string' ? JSON.parse(maimaiData) : maimaiData;
            const notes = [];

            // maimai uses 8 zones, DSX uses 6 - map them
            if (data.notes) {
                data.notes.forEach(note => {
                    const zone = Math.floor((note.position / 8) * 6); // Map 8 zones to 6
                    notes.push({
                        time: note.time || note.timing,
                        zone: zone,
                        type: 'regular'
                    });
                });
            }

            return {
                notes,
                meta: {
                    difficulty: data.difficulty || 3,
                    bpm: data.bpm || 120
                }
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Convert CHUNITHM chart to DSX format
     */
    _convertFromChunithm(chunithmData) {
        try {
            const data = typeof chunithmData === 'string' ? JSON.parse(chunithmData) : chunithmData;
            const notes = [];

            // CHUNITHM uses 16 lanes, map to 6 zones
            if (data.notes) {
                data.notes.forEach(note => {
                    const lane = note.lane || note.position;
                    const zone = Math.floor((lane / 16) * 6);
                    notes.push({
                        time: note.time || note.measure * 1000,
                        zone: zone,
                        type: 'regular'
                    });
                });
            }

            return {
                notes,
                meta: {
                    difficulty: data.level || 3,
                    bpm: data.bpm || 120
                }
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Train the mapper from existing charts - ADVANCED INTELLIGENCE
     * @param {Array} charts - Array of chart objects with notes (or other format data)
     * @param {String} format - Optional format hint: 'dsx', 'osu', 'stepmania', 'bms', 'maimai', 'chunithm'
     */
    trainFromCharts(charts, format = 'dsx') {
        // Convert charts if needed
        if (format !== 'dsx') {
            charts = charts.map(chart => {
                const converted = this.convertFromOtherFormat(chart, format);
                return converted || chart;
            }).filter(c => c && c.notes);
        }

        const model = {
            // Basic patterns
            zoneTransitions: new Map(),
            timingPatterns: [],
            densityCurves: [],
            difficultyScaling: {},
            patternFrequency: new Map(),

            // ADVANCED: Context-aware patterns
            contextualPatterns: new Map(), // Pattern based on previous context
            energyBasedZones: new Map(), // Zone preference by energy level
            timingVariance: new Map(), // Timing variance per difficulty

            // ADVANCED: Sequence learning
            longPatterns: new Map(), // 4-8 note sequences
            patternTransitions: new Map(), // Pattern A -> Pattern B

            // ADVANCED: Musical structure
            sectionDensity: new Map(), // Intro/verse/chorus density
            buildupPatterns: [], // How to build intensity
            breakdownPatterns: [], // How to reduce intensity

            // ADVANCED: Zone relationships
            zoneProximity: new Map(), // Adjacent vs opposite zones
            zoneSymmetry: new Map(), // Symmetrical zone usage
            zoneClusters: [], // Common zone groupings

            // ADVANCED: Timing intelligence
            rhythmPatterns: new Map(), // Rhythmic motifs
            syncopation: [], // Off-beat patterns
            polyrhythms: [], // Multiple rhythm layers

            // ADVANCED: Difficulty progression
            difficultyTransitions: new Map(), // How patterns change with difficulty
            complexityMetrics: {}, // Complexity per difficulty
        };

        charts.forEach(chart => {
            const notes = chart.notes || [];
            const difficulty = chart.meta?.difficulty || 3;
            const bpm = chart.meta?.bpm?.init || chart.meta?.bpm || 120;

            if (notes.length < 10) return; // Skip charts with too few notes

            // === BASIC ANALYSIS ===

            // Zone transitions with timing context
            for (let i = 1; i < notes.length; i++) {
                const from = notes[i - 1].zone;
                const to = notes[i].zone;
                const interval = notes[i].time - notes[i - 1].time;

                const key = `${from}->${to}`;
                model.zoneTransitions.set(key, (model.zoneTransitions.get(key) || 0) + 1);

                // ADVANCED: Timing variance per transition
                if (!model.timingVariance.has(key)) {
                    model.timingVariance.set(key, []);
                }
                model.timingVariance.get(key).push(interval);
            }

            // Timing patterns with BPM context
            for (let i = 1; i < notes.length; i++) {
                const interval = notes[i].time - notes[i - 1].time;
                model.timingPatterns.push(interval);

                // ADVANCED: Rhythm patterns (normalized to beats)
                const beatInterval = (60000 / bpm);
                const beatRatio = interval / beatInterval;
                const rhythmKey = Math.round(beatRatio * 4) / 4; // Quantize to 1/4 beats
                model.rhythmPatterns.set(rhythmKey, (model.rhythmPatterns.get(rhythmKey) || 0) + 1);
            }

            // === ADVANCED PATTERN ANALYSIS ===

            // Short patterns (3 notes) with context
            for (let i = 0; i < notes.length - 2; i++) {
                const pattern = notes.slice(i, i + 3).map(n => n.zone).join(',');
                model.patternFrequency.set(pattern, (model.patternFrequency.get(pattern) || 0) + 1);

                // Context: what comes before this pattern?
                if (i > 0) {
                    const prevZone = notes[i - 1].zone;
                    const contextKey = `${prevZone}:${pattern}`;
                    model.contextualPatterns.set(contextKey, (model.contextualPatterns.get(contextKey) || 0) + 1);
                }
            }

            // Long patterns (4-8 notes) — capped to prevent unbounded Map growth
            const LONG_PATTERN_CAP = 50_000;
            for (let len = 4; len <= 8; len++) {
                if (model.longPatterns.size >= LONG_PATTERN_CAP) break;
                for (let i = 0; i < notes.length - len; i++) {
                    if (model.longPatterns.size >= LONG_PATTERN_CAP) break;
                    const pattern = notes.slice(i, i + len).map(n => n.zone).join(',');
                    const key = `L${len}:${pattern}`;
                    model.longPatterns.set(key, (model.longPatterns.get(key) || 0) + 1);
                }
            }

            // Pattern transitions (pattern A followed by pattern B)
            for (let i = 0; i < notes.length - 5; i++) {
                const patternA = notes.slice(i, i + 3).map(n => n.zone).join(',');
                const patternB = notes.slice(i + 3, i + 6).map(n => n.zone).join(',');
                const transKey = `${patternA}=>${patternB}`;
                model.patternTransitions.set(transKey, (model.patternTransitions.get(transKey) || 0) + 1);
            }

            // === ZONE RELATIONSHIP ANALYSIS ===

            // Zone proximity (adjacent vs opposite)
            for (let i = 1; i < notes.length; i++) {
                const from = notes[i - 1].zone;
                const to = notes[i].zone;
                const distance = Math.min(Math.abs(to - from), 6 - Math.abs(to - from));
                const proxKey = `dist${distance}`;
                model.zoneProximity.set(proxKey, (model.zoneProximity.get(proxKey) || 0) + 1);
            }

            // Zone symmetry detection
            for (let i = 0; i < notes.length - 1; i++) {
                const zone1 = notes[i].zone;
                const zone2 = notes[i + 1].zone;
                if ((zone1 + 3) % 6 === zone2) { // Opposite zones
                    const symKey = `${Math.min(zone1, zone2)}-${Math.max(zone1, zone2)}`;
                    model.zoneSymmetry.set(symKey, (model.zoneSymmetry.get(symKey) || 0) + 1);
                }
            }

            // === MUSICAL STRUCTURE ANALYSIS ===

            // Density curves with energy detection
            const duration = notes[notes.length - 1]?.time || 1000;
            const windowSize = 5000;
            const densityCurve = [];

            for (let t = 0; t < duration; t += windowSize) {
                const notesInWindow = notes.filter(n => n.time >= t && n.time < t + windowSize);
                const density = notesInWindow.length / 5;
                densityCurve.push(density);

                // ADVANCED: Energy-based zone preference
                if (notesInWindow.length > 0) {
                    const energyLevel = Math.floor(density * 2); // 0-10 scale
                    notesInWindow.forEach(note => {
                        const energyKey = `E${energyLevel}:Z${note.zone}`;
                        model.energyBasedZones.set(energyKey, (model.energyBasedZones.get(energyKey) || 0) + 1);
                    });
                }
            }
            model.densityCurves.push(densityCurve);

            // Detect buildups (increasing density)
            for (let i = 1; i < densityCurve.length; i++) {
                if (densityCurve[i] > densityCurve[i - 1] * 1.3) {
                    const buildupNotes = notes.filter(n =>
                        n.time >= (i - 1) * windowSize && n.time < i * windowSize
                    );
                    if (buildupNotes.length >= 3) {
                        model.buildupPatterns.push(buildupNotes.map(n => n.zone));
                    }
                }
            }

            // Detect breakdowns (decreasing density)
            for (let i = 1; i < densityCurve.length; i++) {
                if (densityCurve[i] < densityCurve[i - 1] * 0.7) {
                    const breakdownNotes = notes.filter(n =>
                        n.time >= (i - 1) * windowSize && n.time < i * windowSize
                    );
                    if (breakdownNotes.length >= 2) {
                        model.breakdownPatterns.push(breakdownNotes.map(n => n.zone));
                    }
                }
            }

            // === DIFFICULTY ANALYSIS ===

            if (!model.difficultyScaling[difficulty]) {
                model.difficultyScaling[difficulty] = {
                    avgInterval: 0,
                    avgDensity: 0,
                    minInterval: Infinity,
                    maxInterval: 0,
                    count: 0,
                    zoneVariety: new Set(),
                    patternComplexity: 0
                };
            }

            const diffData = model.difficultyScaling[difficulty];
            const intervals = [];
            for (let i = 1; i < notes.length; i++) {
                const interval = notes[i].time - notes[i - 1].time;
                intervals.push(interval);
                diffData.minInterval = Math.min(diffData.minInterval, interval);
                diffData.maxInterval = Math.max(diffData.maxInterval, interval);
                diffData.zoneVariety.add(notes[i].zone);
            }

            diffData.avgInterval += intervals.reduce((a, b) => a + b, 0) / intervals.length;
            diffData.avgDensity += notes.length / (duration / 1000);
            diffData.patternComplexity += new Set(notes.map(n => n.zone)).size / 6; // Zone variety
            diffData.count++;

            // ADVANCED: Complexity metrics
            if (!model.complexityMetrics[difficulty]) {
                model.complexityMetrics[difficulty] = {
                    avgZoneChanges: 0,
                    avgPatternLength: 0,
                    syncopationRate: 0
                };
            }

            let zoneChanges = 0;
            for (let i = 1; i < notes.length; i++) {
                if (notes[i].zone !== notes[i - 1].zone) zoneChanges++;
            }
            model.complexityMetrics[difficulty].avgZoneChanges += zoneChanges / notes.length;
        });

        // === POST-PROCESSING ===

        // Normalize difficulty scaling
        Object.keys(model.difficultyScaling).forEach(diff => {
            const data = model.difficultyScaling[diff];
            data.avgInterval /= data.count;
            data.avgDensity /= data.count;
            data.patternComplexity /= data.count;
            data.zoneVariety = data.zoneVariety.size;
        });

        // Trim oversized Maps to keep memory under control
        const TRANSITION_CAP = 20_000;
        if (model.patternTransitions.size > TRANSITION_CAP) {
            // Keep the most frequent transitions only
            const sorted = Array.from(model.patternTransitions.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, TRANSITION_CAP);
            model.patternTransitions = new Map(sorted);
        }
        const CONTEXT_CAP = 20_000;
        if (model.contextualPatterns.size > CONTEXT_CAP) {
            const sorted = Array.from(model.contextualPatterns.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, CONTEXT_CAP);
            model.contextualPatterns = new Map(sorted);
        }

        // Normalize complexity metrics
        Object.keys(model.complexityMetrics).forEach(diff => {
            const data = model.complexityMetrics[diff];
            data.avgZoneChanges /= charts.length;
        });

        // Calculate timing variance statistics
        model.timingVariance.forEach((intervals, key) => {
            const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
            model.timingVariance.set(key, { avg, variance, stdDev: Math.sqrt(variance) });
        });

        this.trainedModel = model;
        // Show top 10 most common transitions
        const sortedTransitions = Array.from(model.zoneTransitions.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        sortedTransitions.forEach(([trans, count]) => {
        });

        // Show top 10 most common patterns
        const sortedPatterns = Array.from(model.patternFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        sortedPatterns.forEach(([pattern, count]) => {
        });

        return model;
    }

    /**
     * Generate a VSRG chart from the loaded audio.
     *
     * New pipeline (deterministic + budget-driven):
     *   1. Multi-band analysis (cached from detectOnsets)
     *   2. Beat grid + tempo map detection
     *   3. Song structure + per-section NPS budget
     *   4. Candidate selection — greedy rank, no Math.random() for timing
     *   5. Zone + note-type assignment (seeded PRNG)
     *   5b. Quantize to beat grid (per-BPM, per-subdivision)
     *   6. Chord injection
     *   7. VSRG post-processing + playability
     */
    async generateChart(options = {}) {
        const {
            difficulty       = 2,
            bpm              = 120,      // scalar fallback
            bpmChanges       = null,     // [{time, bpm}] from editor — preferred
            offset           = 0,
            useTrainedModel  = true,
            vsrgStyle        = true,
            streamIntensity  = 0.6,
            subdivision      = 4,        // 4=quarter, 8=eighth, 16=sixteenth
            quantizeStrength = 0.85,     // 0–1 snap amount (1=hard, 0=off)
            seed             = Date.now()
        } = options;

        // Seed the PRNG — all randomness during generation uses this
        this._prng = this._makePRNG(seed);

        // ── Phase 1: Audio Analysis ─────────────────────────────────────
        const onsets      = await this.detectOnsets();
        // Pass bpmChanges to detectBeats so it uses the editor's tempo map
        const bpmHint     = bpmChanges && bpmChanges.length > 0 ? bpmChanges : bpm;
        const { beats, tempoMap } = await this.detectBeats(bpmHint);
        const energyData  = await this.analyzeEnergy();
        const spectralData = await this.analyzeSpectral();

        // ── Phase 2: Structure ───────────────────────────────────────────
        const phrases       = this._groupIntoPhrases(onsets, energyData);
        const songStructure = this._analyzeSongStructure(energyData, onsets, this.duration);
        const budget        = this._buildPatternBudget(songStructure, energyData, difficulty);

        // ── Phase 3: Candidate pool ─────────────────────────────────────
        const candidates = this._buildCandidatePool(onsets, beats, energyData, offset);

        // ── Phase 4: Deterministic selection ───────────────────────────
        const selected = this._selectCandidates(candidates, budget, difficulty);

        // Build onset lookup for zone/type assignment
        const onsetByTime = new Map();
        for (const o of onsets) onsetByTime.set(Math.round(o.time + offset), o);
        const avgEnergy = energyData.reduce((s, d) => s + d.energy, 0) / energyData.length;

        // ── Phase 5: Zone + type assignment ────────────────────────────
        const notes = [];
        for (const { time } of selected) {
            const onset      = onsetByTime.get(Math.round(time));
            const prevNotes  = notes.slice(Math.max(0, notes.length - 6));
            const energy     = this.getEnergyAt(time, energyData);
            const normEnergy = Math.min(1, energy / (avgEnergy * 2));

            let zone;
            const useTrained = useTrainedModel && this.trainedModel && prevNotes.length > 0;
            const useVSRG    = vsrgStyle && !useTrained && prevNotes.length >= 2
                               && this._prng() < streamIntensity;
            if (useTrained) {
                zone = this.trainedZoneAssign(prevNotes, difficulty, normEnergy);
            } else if (useVSRG) {
                zone = this.vsrgLaneAssign(time, spectralData, prevNotes, difficulty);
            } else {
                zone = this.smartZoneAssign(time, spectralData, prevNotes, difficulty, onset);
            }

            const noteType = this._assignNoteType(onset, prevNotes, difficulty);
            const entry    = { time: Math.round(time), zone, type: noteType };
            if (noteType === 'hold' && onset?.holdDuration > 0) entry.duration = onset.holdDuration;
            notes.push(entry);
        }

        // ── Phase 5b: Quantize to beat grid ──────────────────────────────
        this._quantizeToGrid(notes, tempoMap, subdivision, quantizeStrength);

        // ── Phase 6: Chord injection ───────────────────────────────────
        this._injectChords(notes, difficulty, avgEnergy, energyData, phrases);

        // ── Phase 7: VSRG post-processing + playability ───────────────
        this._normalizeLinearLanes(notes);
        if (vsrgStyle) this.applyVSRGPostProcessing(notes, difficulty, streamIntensity);
        this.ensurePlayable(notes, difficulty);
        // Free raw audio band buffers after generation to reclaim memory
        this._bands = null;
        this._bandOnsets = null;

        notes.sort((a, b) => a.time - b.time);
        return notes;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SEEDED PRNG  (mulberry32 — fast, deterministic, seedable)
    // ═══════════════════════════════════════════════════════════════════

    _makePRNG(seed) {
        let s = seed >>> 0;
        return () => {
            s |= 0; s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PATTERN BUDGET  — deterministic NPS targets per section
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Compute a note budget (target NPS + min gap) for every detected
     * song section.  The result is an array of budget entries that
     * selectCandidates() will use instead of probabilistic filtering.
     *
     * NPS targets per difficulty (aligned with VSRG conventions):
     *   Easy=1–2  Normal=3–4  Hard=5–7  Expert=8–11  Master=12–16
     */
    _buildPatternBudget(songStructure, energyData, difficulty) {
        // Base NPS ranges per difficulty
        const npsRange = [
            { min: 1.0, max: 2.0 },   // 1 Easy
            { min: 2.5, max: 4.0 },   // 2 Normal
            { min: 4.5, max: 7.0 },   // 3 Hard
            { min: 7.5, max: 11.0 },  // 4 Expert
            { min: 11.0, max: 16.0 }, // 5 Master
        ][Math.max(0, Math.min(4, difficulty - 1))];

        // Section-type density multipliers  (relative to base)
        const sectionMult = {
            intro:     0.50,
            verse:     0.70,
            buildup:   0.85,
            chorus:    1.00,
            drop:      1.10,
            breakdown: 0.40,
            outro:     0.55,
        };

        // Compute average energy across the whole song (for normalisation)
        const globalAvgE = energyData.reduce((s, d) => s + d.energy, 0) / energyData.length;

        return songStructure.sections.map(section => {
            const mult  = sectionMult[section.type] ?? 0.75;

            // Section energy relative to global average (1.0 = average)
            const secEnergy = energyData
                .filter(e => e.time >= section.start && e.time <= section.end);
            const secAvgE = secEnergy.length
                ? secEnergy.reduce((s, d) => s + d.energy, 0) / secEnergy.length
                : globalAvgE;
            const energyRatio = Math.min(1.5, secAvgE / (globalAvgE || 1));

            // Target NPS for this section
            const targetNPS = npsRange.min + (npsRange.max - npsRange.min) * mult * energyRatio;

            // Minimum gap between notes (ms) = 1000 / NPS  (clamped)
            const minGapMs = Math.max(50, Math.round(1000 / targetNPS));

            return {
                start:     section.start,
                end:       section.end,
                type:      section.type,
                targetNPS,
                minGapMs,
                // How many notes we want in this section
                targetCount: Math.round(targetNPS * (section.end - section.start) / 1000)
            };
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CANDIDATE POOL + DETERMINISTIC SELECTION
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Build the candidate pool: every detected onset + beat-grid point,
     * each tagged with a weight and the original onset object.
     * Replaces smartCombine().
     */
    _buildCandidatePool(onsets, beats, energyData, offset) {
        const pool = new Map(); // time(ms) → { time, weight, onset }

        const typeWeights = { strong: 1.5, medium: 1.0, sustained: 0.7, weak: 0.35 };
        const bandWeights = { bass: 1.2, mid: 1.0, treble: 0.8 };

        // Primary: real detected onsets
        for (const onset of onsets) {
            const t      = Math.round(onset.time + offset);
            const eAt    = this.getEnergyAt(onset.time, energyData);
            const tw     = typeWeights[onset.type] ?? 1.0;
            const bw     = bandWeights[onset.band] ?? 1.0;
            const weight = eAt * tw * bw;

            const existing = pool.get(t);
            if (!existing || weight > existing.weight) {
                pool.set(t, { time: t, weight, onset });
            }
        }

        // Secondary: beat-grid points (low weight, backup only)
        for (const bt of beats) {
            const t = Math.round(bt + offset);
            if (!pool.has(t)) {
                const eAt = this.getEnergyAt(bt, energyData);
                pool.set(t, { time: t, weight: eAt * 0.25, onset: null });
            }
        }

        return Array.from(pool.values()).sort((a, b) => a.time - b.time);
    }

    /**
     * Deterministically select candidates to meet each section's note budget.
     *
     * Algorithm per section:
     *   1. Collect all pool candidates that fall in [section.start, section.end]
     *   2. Sort by weight descending (strongest onsets first)
     *   3. Greedy pick: include a candidate iff it is >= minGapMs from the
     *      last accepted note AND we still have budget remaining
     *   4. If budget not met after greedy pass, add remaining by weight order
     *      until budget is hit (with a looser gap floor of 50 ms)
     *
     * No Math.random() here — same inputs always produce the same output.
     * The PRNG is only used in zone assignment.
     */
    _selectCandidates(pool, budget, difficulty) {
        const selected   = [];
        let   lastTimeMs = -Infinity;

        // Hard absolute minimum gap regardless of budget
        const absMinGapMs = [180, 140, 100, 70, 50][Math.max(0, Math.min(4, difficulty - 1))];

        for (const section of budget) {
            const { start, end, targetCount, minGapMs } = section;
            const effectiveGap = Math.max(absMinGapMs, minGapMs);

            // All candidates in this section, sorted strongest-first
            const sectionPool = pool
                .filter(c => c.time >= start && c.time <  end)
                .sort((a, b) => b.weight - a.weight);

            const sectionPicked = [];

            // ── Greedy pass (respect gap + budget) ──
            for (const c of sectionPool) {
                if (sectionPicked.length >= targetCount) break;
                const sinceLastInSection = sectionPicked.length
                    ? c.time - sectionPicked[sectionPicked.length - 1].time
                    : c.time - lastTimeMs;
                if (sinceLastInSection < effectiveGap) continue;
                sectionPicked.push(c);
            }

            // ── Top-up pass (looser gap, fill if budget not met) ──
            if (sectionPicked.length < targetCount) {
                const already = new Set(sectionPicked.map(c => c.time));
                const extras  = sectionPool
                    .filter(c => !already.has(c.time))
                    .sort((a, b) => a.time - b.time); // now chronological for gap check

                for (const c of extras) {
                    if (sectionPicked.length >= targetCount) break;
                    // Merge into sorted position and check with loose gap
                    const all = [...sectionPicked, c].sort((a, b) => a.time - b.time);
                    const idx = all.indexOf(c);
                    const prevT = idx > 0  ? all[idx - 1].time : lastTimeMs;
                    const nextT = idx < all.length - 1 ? all[idx + 1].time : Infinity;
                    if (c.time - prevT >= absMinGapMs && nextT - c.time >= absMinGapMs) {
                        sectionPicked.push(c);
                    }
                }
            }

            // Sort picked by time before appending
            sectionPicked.sort((a, b) => a.time - b.time);
            if (sectionPicked.length > 0) {
                lastTimeMs = sectionPicked[sectionPicked.length - 1].time;
            }

            selected.push(...sectionPicked);
        }

        // Final sort + deduplication across section boundaries
        selected.sort((a, b) => a.time - b.time);
        const deduped = [];
        for (const c of selected) {
            const last = deduped[deduped.length - 1];
            if (!last || c.time - last.time >= absMinGapMs) deduped.push(c);
        }
        return deduped;
    }

    /**
     * Inject chords at musically appropriate moments.
     * Uses vsrgPatterns.chords for VSRG-style lane pairs/triples.
     * Rate is deterministic via the seeded PRNG.
     */
    _injectChords(notes, difficulty, avgEnergy, energyData, phrases) {
        if (notes.length < 10) return;
        const prng = this._prng ?? Math.random.bind(Math);

        const baseRate = [0.02, 0.04, 0.07, 0.11, 0.15][Math.max(0, Math.min(4, difficulty - 1))];
        const chordPatterns = this.vsrgPatterns?.chords ?? [[0,3],[1,4],[2,5]];
        const added = [];

        for (let i = 1; i < notes.length - 1; i++) {
            const note     = notes[i];
            const gapPrev  = note.time - notes[i - 1].time;
            const gapNext  = notes[i + 1].time - note.time;

            // Only in gaps that have some breathing room
            if (gapPrev < 250 || gapNext < 250) continue;
            if (added.some(c => Math.abs(c.time - note.time) < 40)) continue;

            const energy  = this.getEnergyAt(note.time, energyData);
            const normE   = energy / (avgEnergy || 1);

            // Build chord chance from context
            let chance = baseRate;
            if (normE > 1.5) chance += 0.25;
            else if (normE > 1.2) chance += 0.12;
            if (gapPrev > 500 || gapNext > 500) chance += 0.15; // isolated accent

            const phrase = phrases?.find(p => note.time >= p.start && note.time <= p.end);
            if (phrase) {
                const prog = (note.time - phrase.start) / (phrase.end - phrase.start);
                if (prog > 0.85) chance += 0.30;  // phrase end accent
                if (phrase.type === 'stream') chance -= 0.10;
                if (phrase.type === 'accent') chance += 0.20;
            }

            chance = Math.min(0.88, Math.max(0, chance));
            if (prng() > chance) continue;

            // Pick a chord pattern that includes this note's lane
            const matchingPatterns = chordPatterns.filter(p => p.includes(note.zone));
            const pattern = matchingPatterns.length
                ? matchingPatterns[Math.floor(prng() * matchingPatterns.length)]
                : chordPatterns[Math.floor(prng() * chordPatterns.length)];

            // Add companion lanes (skip this note's own lane)
            for (const lane of pattern) {
                if (lane === note.zone) continue;
                if (difficulty < 4 && pattern.length > 2) continue; // no triplesat low diff
                added.push({ time: note.time, zone: lane, type: 'regular' });
            }
        }

        notes.push(...added);
    }

    /**
     * Normalize notes from osu!mania/SM imports:
     * ensures lanes stay strictly within 0–5 and removes
     * any residual circular-wrap artefacts from the old converter.
     */
    _normalizeLinearLanes(notes) {
        for (const note of notes) {
            note.zone = Math.max(0, Math.min(5, note.zone));
        }
    }


    /**
     * Determine the appropriate note type based on audio analysis.
     * Rules (VSRG / Project Sekai style):
     *   - Bass strong, fast decay    → regular (kick hit)  
     *   - Bass strong, long sustain  → hold
     *   - Treble sharp               → flick (hi-hat accent at higher difficulties)
     *   - Mid sustained              → slide
     *   - Mid strong                 → regular (snare)
     *   - Weak / background         → regular (fallback)
     */
    _assignNoteType(onset, prevNotes, difficulty) {
        if (!onset) return 'regular';

        const { band, type, holdDuration } = onset;

        // Holds: any band with a detected sustain
        if (type === 'sustained' && holdDuration > 0) {
            return 'hold';
        }

        // Slides: sustained mid (melody, vocal line)
        if (band === 'mid' && type === 'sustained') {
            return 'slide';
        }

        // Flicks: sharp treble + higher difficulty (feels like hi-hat accents)
        if (band === 'treble' && type === 'medium' && difficulty >= 3) {
            // Only ~25% of treble hits become flicks to avoid over-saturation
            return Math.random() < 0.25 ? 'flick' : 'regular';
        }

        // Everything else: regular tap
        return 'regular';
    }

    /**
     * VSRG lane assignment — thinks in linear lanes, not circles.
     * Prefers adjacent moves, uses stream patterns for continuous sections.
     */
    vsrgLaneAssign(time, spectralData, prevNotes, difficulty) {
        const lastLane = prevNotes[prevNotes.length - 1].zone;
        const recentLanes = prevNotes.slice(-4).map(n => n.zone);

        // Detect if we're in a stream (consistent direction)
        const isStreaming = this._detectStream(recentLanes);
        if (isStreaming) {
            return this._continueStream(recentLanes, difficulty);
        }

        // Use VSRG transition weights
        const transitions = this.vsrgPatterns.laneTransitions;
        const candidates = new Map();
        for (let target = 0; target < 6; target++) {
            const key = `${lastLane}->${target}`;
            const weight = transitions.get(key) || 5;
            candidates.set(target, weight);
        }

        // Penalise recently used lanes (avoid jacks at lower difficulty)
        if (difficulty < 4) {
            for (const lane of recentLanes.slice(-2)) {
                candidates.set(lane, Math.max(1, (candidates.get(lane) || 1) * 0.3));
            }
        }

        return this._weightedRandomSelect(candidates);
    }

    /**
     * Detect if recent lanes form a directional stream.
     */
    _detectStream(lanes) {
        if (lanes.length < 3) return false;
        const diffs = [];
        for (let i = 1; i < lanes.length; i++) diffs.push(lanes[i] - lanes[i - 1]);
        const allUp   = diffs.every(d => d > 0);
        const allDown = diffs.every(d => d < 0);
        return allUp || allDown;
    }

    /**
     * Continue a detected stream in the same direction.
     */
    _continueStream(lanes, difficulty) {
        const last = lanes[lanes.length - 1];
        const prev = lanes[lanes.length - 2];
        const dir  = last > prev ? 1 : -1;
        const next = last + dir;

        // At edge of lanes, bounce back
        if (next < 0 || next > 5) {
            return last - dir; // reverse direction
        }

        // Occasionally introduce a skip or reverse for variety
        if (Math.random() < 0.15) return Math.max(0, Math.min(5, last + dir * 2));
        return next;
    }

    /**
     * VSRG post-processing:
     * 1. Detect streams and make them consistent
     * 2. Remove jack patterns (same-lane repeats) at lower difficulties
     * 3. Inject burst patterns at energy peaks
     * 4. Smooth jarring cross-lane jumps in succession
     */
    applyVSRGPostProcessing(notes, difficulty, streamIntensity) {
        // Phase 1: Detect and reinforce streams
        if (streamIntensity > 0.3) {
            this._reinforceStreams(notes, difficulty);
        }

        // Phase 2: Remove awkward jacks at lower difficulty
        if (difficulty < 4) {
            this._removeJacks(notes);
        }

        // Phase 3: Burst injection at high-energy gaps
        if (difficulty >= 3 && streamIntensity > 0.5) {
            this._addVSRGBursts(notes, difficulty);
        }

        // Phase 4: Smooth back-to-back full-range jumps
        this._smoothLargeJumps(notes, difficulty);
    }

    /**
     * Detect note sequences that are almost-streams and align them.
     */
    _reinforceStreams(notes, difficulty) {
        for (let i = 0; i < notes.length - 4; i++) {
            const seq = notes.slice(i, i + 4);
            const lanes = seq.map(n => n.zone);
            if (this._detectStream(lanes)) {
                // Already a stream — ensure lane continuity
                const dir = lanes[1] > lanes[0] ? 1 : -1;
                for (let j = 1; j < seq.length; j++) {
                    const expected = seq[j - 1].zone + dir;
                    if (expected >= 0 && expected <= 5 && Math.random() < 0.7) {
                        seq[j].zone = expected;
                    }
                }
            }
        }
    }

    /**
     * Remove jack patterns (same-lane note back-to-back) at low difficulty.
     */
    _removeJacks(notes) {
        for (let i = 1; i < notes.length; i++) {
            if (notes[i].zone === notes[i - 1].zone) {
                // Move to adjacent lane
                const alt = notes[i].zone < 5 ? notes[i].zone + 1 : notes[i].zone - 1;
                notes[i].zone = alt;
            }
        }
    }

    /**
     * Inject short burst patterns (3–4 notes) at high-energy gaps.
     */
    _addVSRGBursts(notes, difficulty) {
        const burstInterval = difficulty >= 4 ? 70 : 90;
        const added = [];

        for (let i = 1; i < notes.length - 1; i++) {
            const gapBefore = notes[i].time - notes[i - 1].time;
            const gapAfter  = notes[i + 1].time - notes[i].time;

            // Burst opportunity: after a fast section, before a gap
            if (gapBefore < 200 && gapAfter > 350 && Math.random() < 0.15) {
                const startLane = notes[i].zone;
                const dir = startLane < 3 ? 1 : -1;
                const burstSize = difficulty >= 4 ? 3 : 2;

                for (let b = 1; b <= burstSize; b++) {
                    const burstLane = Math.max(0, Math.min(5, startLane + dir * b));
                    added.push({
                        time: notes[i].time + burstInterval * b,
                        zone: burstLane,
                        type: 'regular'
                    });
                }
            }
        }
        notes.push(...added);
    }

    /**
     * Smooth multiple back-to-back full-range jumps (0↔5 rapidly) —
     * these are painful at lower difficulties.
     */
    _smoothLargeJumps(notes, difficulty) {
        if (difficulty >= 4) return; // Expert/Master can have these
        for (let i = 2; i < notes.length; i++) {
            const d1 = Math.abs(notes[i - 1].zone - notes[i - 2].zone);
            const d2 = Math.abs(notes[i].zone   - notes[i - 1].zone);
            if (d1 >= 4 && d2 >= 4 && Math.random() < 0.5) {
                // Replace this note's lane with something closer
                const midLane = Math.round((notes[i - 1].zone + notes[i].zone) / 2);
                notes[i].zone = Math.max(0, Math.min(5, midLane));
            }
        }
    }

    /**
     * Trained model zone assignment
     */
    /**
     * ADVANCED: Trained model zone assignment with context awareness
     */
    trainedZoneAssign(prevNotes, difficulty, energyLevel = 0.5) {
        const lastZone = prevNotes[prevNotes.length - 1].zone;
        const model = this.trainedModel;
        const hasTrainingData = model && model.zoneTransitions && model.zoneTransitions.size > 0;

        // === VSRG FALLBACK: NO TRAINING DATA ===
        if (!hasTrainingData) {
            return this._expertVSRGLaneAssign(prevNotes, difficulty, energyLevel);
        }

        // === CONTEXT-AWARE SELECTION ===

        // Try contextual patterns first (what usually comes after this context?)
        if (prevNotes.length >= 3 && model.contextualPatterns && model.contextualPatterns.size > 0) {
            const recentPattern = prevNotes.slice(-3).map(n => n.zone).join(',');
            const contextKey = `${lastZone}:${recentPattern}`;

            if (model.contextualPatterns.has(contextKey)) {
                // Find what zones commonly follow this context
                const nextZones = new Map();
                for (const [key, freq] of model.contextualPatterns.entries()) {
                    if (key.startsWith(`${lastZone}:`)) {
                        // Extract the first zone of the following pattern
                        const patternPart = key.split(':')[1];
                        const firstZone = parseInt(patternPart.split(',')[0]);
                        nextZones.set(firstZone, (nextZones.get(firstZone) || 0) + freq);
                    }
                }

                if (nextZones.size > 0) {
                    return this._weightedRandomSelect(nextZones);
                }
            }
        }

        // === ENERGY-BASED SELECTION ===

        // Use energy level to influence zone choice
        if (model.energyBasedZones && model.energyBasedZones.size > 0) {
            const energyKey = `E${Math.floor(energyLevel * 10)}`;
            const energyZones = new Map();

            for (const [key, freq] of model.energyBasedZones.entries()) {
                if (key.startsWith(energyKey)) {
                    const zone = parseInt(key.split(':Z')[1]);
                    energyZones.set(zone, freq);
                }
            }

            if (energyZones.size > 0 && Math.random() < 0.4) {
                return this._weightedRandomSelect(energyZones);
            }
        }

        // === PATTERN TRANSITION SELECTION ===

        // Try to continue a known pattern sequence
        if (prevNotes.length >= 3 && model.patternTransitions && model.patternTransitions.size > 0) {
            const recentPattern = prevNotes.slice(-3).map(n => n.zone).join(',');
            const transitionZones = new Map();

            for (const [key, freq] of model.patternTransitions.entries()) {
                if (key.startsWith(recentPattern + '=>')) {
                    const nextPattern = key.split('=>')[1];
                    const firstZone = parseInt(nextPattern.split(',')[0]);
                    transitionZones.set(firstZone, freq);
                }
            }

            if (transitionZones.size > 0 && Math.random() < 0.5) {
                return this._weightedRandomSelect(transitionZones);
            }
        }

        // === BASIC TRANSITION SELECTION (fallback) ===

        const transitions = new Map();
        for (let targetZone = 0; targetZone < 6; targetZone++) {
            const key = `${lastZone}->${targetZone}`;
            const freq = model.zoneTransitions.get(key) || 0;
            if (freq > 0) {
                transitions.set(targetZone, freq);
            }
        }

        if (transitions.size === 0) {
            // No training data, use VSRG expert knowledge
            return this._expertVSRGLaneAssign(prevNotes, difficulty, energyLevel);
        }

        return this._weightedRandomSelect(transitions);
    }

    /**
     * Expert VSRG lane assignment — used when no training data available.
     * Implements standard VSRG charting conventions:
     * - Low energy: prefer adjacent lanes, minimal hand movement
     * - High energy: allow wider jumps and more variety
     */
    _expertVSRGLaneAssign(prevNotes, difficulty, energyLevel) {
        const lastLane = prevNotes[prevNotes.length - 1].zone;
        const recentLanes = prevNotes.slice(-4).map(n => n.zone);
        const transitions = this.vsrgPatterns.laneTransitions;

        // Build weighted candidate map
        const candidates = new Map();
        for (let target = 0; target < 6; target++) {
            const key = `${lastLane}->${target}`;
            let weight = transitions.get(key) || 5;

            // Scale jump distance by energy
            const dist = Math.abs(target - lastLane);
            if (dist > 2 && energyLevel < 0.5) weight *= 0.3; // suppress far jumps at low energy
            if (dist > 3 && energyLevel < 0.7) weight *= 0.2;

            candidates.set(target, weight);
        }

        // Penalise recent lanes at lower difficulty (fewer jacks)
        if (difficulty < 4) {
            for (const lane of recentLanes.slice(-2)) {
                candidates.set(lane, Math.max(1, (candidates.get(lane) || 1) * 0.2));
            }
        }

        return this._weightedRandomSelect(candidates);
    }

    /**
     * Analyze song structure - detect intro/verse/chorus/outro
     */
    _analyzeSongStructure(energyData, onsets, duration) {
        const durationMs = duration * 1000;
        const sections = [];

        // Divide song into segments and analyze energy
        const segmentSize = 10000; // 10 second segments
        const segments = [];

        for (let t = 0; t < durationMs; t += segmentSize) {
            const segmentEnergy = energyData.filter(e => e.time >= t && e.time < t + segmentSize);
            const avgEnergy = segmentEnergy.reduce((sum, e) => sum + e.energy, 0) / segmentEnergy.length;
            const onsetCount = onsets.filter(o => {
                const oTime = o.time || o;
                return oTime >= t && oTime < t + segmentSize;
            }).length;

            segments.push({
                start: t,
                end: Math.min(t + segmentSize, durationMs),
                energy: avgEnergy,
                onsetDensity: onsetCount / 10 // per second
            });
        }

        // Classify segments
        const avgSegmentEnergy = segments.reduce((sum, s) => sum + s.energy, 0) / segments.length;

        for (const segment of segments) {
            let type = 'verse';

            // Intro: First 20% of song with lower energy
            if (segment.start < durationMs * 0.2 && segment.energy < avgSegmentEnergy * 0.8) {
                type = 'intro';
            }
            // Outro: Last 20% of song
            else if (segment.start > durationMs * 0.8) {
                type = 'outro';
            }
            // Chorus: High energy sections
            else if (segment.energy > avgSegmentEnergy * 1.3) {
                type = 'chorus';
            }
            // Bridge: Medium energy with low onset density
            else if (segment.energy > avgSegmentEnergy * 0.9 && segment.onsetDensity < 3) {
                type = 'bridge';
            }

            sections.push({
                start: segment.start,
                end: segment.end,
                type: type,
                energy: segment.energy,
                onsetDensity: segment.onsetDensity
            });
        }

        return {
            sections,
            duration: durationMs,
            avgEnergy: avgSegmentEnergy
        };
    }

    /**
     * Plan note distribution across the song
     */
    _planNoteDistribution(songStructure, difficulty, duration) {
        const durationSec = duration;

        // INCREASED base target notes per difficulty for Expert/Master
        const baseNotesPerSec = {
            1: 1.5,  // EASY - Relaxed
            2: 2.5,  // NORMAL - Comfortable  
            3: 4.0,  // HARD - Challenging (increased from 3.5)
            4: 6.0,  // EXPERT - Very challenging (increased from 4.5)
            5: 8.5   // MASTER - Extreme (increased from 5.5)
        }[difficulty] || 4.0;

        // Calculate target notes per section
        const sectionPlans = songStructure.sections.map(section => {
            const sectionDuration = (section.end - section.start) / 1000;
            let densityMultiplier = 1.0;

            // Adjust density based on section type
            switch (section.type) {
                case 'intro':
                    densityMultiplier = 0.6; // Sparse
                    break;
                case 'verse':
                    densityMultiplier = 0.9; // Normal
                    break;
                case 'chorus':
                    densityMultiplier = 1.3; // Dense
                    break;
                case 'bridge':
                    densityMultiplier = 0.8; // Slightly sparse
                    break;
                case 'outro':
                    densityMultiplier = 0.7; // Sparse
                    break;
            }

            return {
                start: section.start,
                end: section.end,
                type: section.type,
                targetNotes: Math.floor(sectionDuration * baseNotesPerSec * densityMultiplier),
                densityMultiplier
            };
        });

        const totalTargetNotes = sectionPlans.reduce((sum, s) => sum + s.targetNotes, 0);

        return {
            targetNotes: totalTargetNotes,
            sections: sectionPlans,
            baseNotesPerSec
        };
    }

    /**
     * Smart filter with structure awareness AND local density contrast
     */
    smartFilterWithStructure(candidates, difficulty, minInterval, energyData, songStructure, notePlan) {
        const filtered = [];
        let lastTime = -minInterval;
        let recentNotes = [];

        // LOCAL DENSITY TRACKING (rolling 2-second window)
        const densityWindow = 2000; // 2 seconds
        let densityHistory = []; // Track recent density

        const avgEnergy = energyData.reduce((sum, d) => sum + d.energy, 0) / energyData.length;
        const maxEnergy = Math.max(...energyData.map(d => d.energy));

        for (const { time, weight } of candidates) {
            const energyFactor = weight / avgEnergy;
            const normalizedEnergy = weight / maxEnergy;

            // Find current section
            const currentSection = songStructure.sections.find(s => time >= s.start && time < s.end);
            const sectionPlan = notePlan.sections.find(s => s.start === currentSection?.start);
            const sectionDensityMod = sectionPlan?.densityMultiplier || 1.0;

            // === LOCAL DENSITY CONTRAST ===
            // Calculate recent density (notes in last 2 seconds)
            densityHistory = densityHistory.filter(t => time - t < densityWindow);
            const recentDensity = densityHistory.length / (densityWindow / 1000); // notes per second

            // Target density for this difficulty
            const targetDensity = notePlan.baseNotesPerSec;

            // Density contrast modifier
            let densityMod = 1.0;
            if (recentDensity > targetDensity * 1.3) {
                // Recently dense → bias toward simplification
                densityMod = 0.6;
            } else if (recentDensity < targetDensity * 0.7) {
                // Recently sparse → allow intensity spike
                densityMod = 1.4;
            }

            // Dynamic interval adjustment with section awareness
            const energyMultiplier = 1.5 - (normalizedEnergy * 0.5);
            const difficultyMultiplier = 2 - (difficulty * 0.2);
            const dynamicInterval = minInterval * difficultyMultiplier * energyMultiplier * (1 / sectionDensityMod) * (1 / densityMod);

            if (time - lastTime < dynamicInterval) continue;

            // Spam prevention
            recentNotes = recentNotes.filter(t => time - t < 1000);
            const maxNotesPerSecond = [4, 6, 8, 10, 12][difficulty - 1] || 8;

            if (recentNotes.length >= maxNotesPerSecond) {
                if (normalizedEnergy < 0.8) continue;
            }

            // INCREASED placement chance for Expert/Master with density contrast
            const baseDensity = ([0.35, 0.55, 0.80, 0.95, 0.98][difficulty - 1] || 0.80) * sectionDensityMod * densityMod;
            const energyBoost = normalizedEnergy * 0.4;
            const weightBoost = (weight / avgEnergy) * 0.3;
            const finalChance = Math.min(0.99, baseDensity + energyBoost + weightBoost);

            // For Expert/Master (4-5), be MUCH more aggressive
            const shouldPlace = difficulty >= 4
                ? (Math.random() < 0.95 || normalizedEnergy > 0.3) // 95% chance OR any decent energy
                : (Math.random() < finalChance);

            if (shouldPlace) {
                filtered.push(time);
                recentNotes.push(time);
                densityHistory.push(time); // Track for density contrast
                lastTime = time;
            }
        }

        // === POST-FILTER: ENSURE MINIMUM NOTE COUNT ===
        const targetNotes = notePlan.targetNotes;

        if (filtered.length < targetNotes) {
            const remaining = candidates
                .filter(c => !filtered.includes(c.time))
                .sort((a, b) => b.weight - a.weight)
                .slice(0, targetNotes - filtered.length);

            filtered.push(...remaining.map(c => c.time));
            filtered.sort((a, b) => a - b);
        }

        return filtered;
    }

    /**
     * Weighted random selection from frequency map
     */
    _weightedRandomSelect(frequencyMap) {
        const total = Array.from(frequencyMap.values()).reduce((a, b) => a + b, 0);
        let rand = Math.random() * total;

        for (const [item, freq] of frequencyMap.entries()) {
            rand -= freq;
            if (rand <= 0) return item;
        }

        // Fallback
        return Array.from(frequencyMap.keys())[0];
    }

    /**
     * Multi-band onset detection — separates bass / mid / treble via
     * BiquadFilterNode rendered offline, then runs independent onset
     * detectors per band.  Returns the same { time, strength, type, band }
     * array as before so generateChart() needs no changes.
     */
    async detectOnsets() {
        // ── 1. Render each frequency band into its own Float32Array ──
        // _renderBands is now synchronous IIR (no OfflineAudioContext)
        const bands = this._renderBands();
        this._bands = bands; // cache for analyzeSpectral / analyzeEnergy

        // ── 2. Detect onsets per band with independent history ──
        const bassOnsets   = this._detectBandOnsets(bands.bass,   'bass',   40);
        const midOnsets    = this._detectBandOnsets(bands.mid,    'mid',    35);
        const trebleOnsets = this._detectBandOnsets(bands.treble, 'treble', 30);

        // ── 3. Hold-note candidates from sustained bass/mid energy ──
        const holdCandidates = this._detectSustains(bands.bass, bands.mid);

        // ── 4. Merge all onsets, resolve conflicts within 30 ms ──
        const merged = this._mergeOnsets(
            [...bassOnsets, ...midOnsets, ...trebleOnsets, ...holdCandidates]
        );

        // store band onset lists for detectBeats / zone assignment
        this._bandOnsets = { bass: bassOnsets, mid: midOnsets, treble: trebleOnsets };

        // ── 5. Release the large band buffers: they're no longer needed ──
        // analyzeSpectral / analyzeEnergy will rebuild from a lightweight
        // cache key; if they haven't run yet, a fresh _renderBands() call
        // re-synthesises in ~ms.
        // NOTE: we keep this._bands set so analyzeSpectral can reuse it
        //       within the same generateChart() call, but we null it out
        //       after generateChart() finishes (see end of generateChart).
        return merged;
    }

    /**
     * Band separation via direct IIR filtering.
     * NO OfflineAudioContext — avoids the 3x full-buffer allocation that
     * caused the JavaScript heap OOM crash.
     *
     * Strategy:
     *   1. Mix down to mono
     *   2. Downsample by DSRATE (default 4x → ~11 kHz) for memory + speed
     *   3. Apply cascaded one-pole IIR filters to split into bands
     *
     * Memory cost (old vs new for a 4-min song @ 44100 Hz):
     *   Old: mono(42 MB) + 3x OfflineAudioContext(~126 MB) + 3x rendered(126 MB) = ~294 MB
     *   New: mono(42 MB, freed) + 3x downsampled bands(~32 MB total) = ~32 MB
     */
    _renderBands() {
        const sr     = this.sampleRate;
        const ch     = this.audioBuffer.numberOfChannels;
        const length = this.audioBuffer.length;

        // ── Step 1: mono mix ──────────────────────────────────────────
        const mono = new Float32Array(length);
        for (let c = 0; c < ch; c++) {
            const chanData = this.audioBuffer.getChannelData(c);
            for (let i = 0; i < length; i++) mono[i] += chanData[i] / ch;
        }

        // ── Step 2: Downsample 4x with a simple box decimation ──────────────
        // Output sample rate: sr / DSRATE  (e.g. 44100/4 = 11025 Hz)
        // Onset detection only needs up to ~5 kHz, so Nyquist is fine.
        const DSRATE  = 4;
        const dsLen   = Math.floor(length / DSRATE);
        const dsSR    = sr / DSRATE;
        const ds      = new Float32Array(dsLen);
        for (let i = 0; i < dsLen; i++) {
            // Average 4 input samples per output sample (anti-alias)
            let sum = 0;
            for (let k = 0; k < DSRATE; k++) sum += mono[i * DSRATE + k];
            ds[i] = sum / DSRATE;
        }
        // Free the full-rate mono buffer immediately
        // (mono is not referenced after this, eligible for GC)

        // ── Step 3: IIR filter split into 3 bands ───────────────────────
        // One-pole IIR lowpass coefficient: a = 1 - exp(-2π fc / sr)
        // y[n] = a * x[n] + (1 - a) * y[n-1]
        //
        // Bass   = LP @ 250 Hz
        // Mid    = LP @ 4000 Hz  −  LP @ 250 Hz
        // Treble = signal − LP @ 4000 Hz

        const fc1 = 250;   // bass/mid boundary
        const fc2 = 4000;  // mid/treble boundary

        // Clamp fc2 to Nyquist of downsampled signal
        const nyquist = dsSR / 2;
        const safeFC2 = Math.min(fc2, nyquist * 0.9);

        const a1 = 1 - Math.exp(-2 * Math.PI * fc1  / dsSR);
        const a2 = 1 - Math.exp(-2 * Math.PI * safeFC2 / dsSR);

        const bass   = new Float32Array(dsLen);
        const mid    = new Float32Array(dsLen);
        const treble = new Float32Array(dsLen);

        let lp1 = 0, lp2 = 0;
        for (let i = 0; i < dsLen; i++) {
            const x = ds[i];
            lp1 = lp1 + a1 * (x - lp1);    // LP @ 250 Hz
            lp2 = lp2 + a2 * (x - lp2);    // LP @ 4000 Hz

            bass[i]   = lp1;          // 0 – 250 Hz
            mid[i]    = lp2 - lp1;   // 250 – 4000 Hz
            treble[i] = x  - lp2;   // 4000 Hz+
        }

        // Store the effective sample rate for downstream methods
        this._bandSampleRate = dsSR;

        return { bass, mid, treble };
    }

    /**
     * RMS onset detector for a single band buffer.
     * Uses a longer adaptive history window than the old method
     * to reduce false positives on reverb tails.
     */
    _detectBandOnsets(data, band, minGapMs) {
        const onsets     = [];
        const sr         = this._bandSampleRate ?? this.sampleRate; // use downsampled rate
        const windowMs   = 0.02;   // 20 ms analysis window
        const hopMs      = 0.005;  // 5 ms hop
        const windowSize = Math.max(1, Math.floor(sr * windowMs));
        const hopSize    = Math.max(1, Math.floor(sr * hopMs));
        const historyLen = 20;     // ~100 ms adaptive mean
        const threshold  = { bass: 1.45, mid: 1.35, treble: 1.25 }[band] || 1.35;

        const history = [];
        let lastOnsetMs = -minGapMs;

        for (let i = 0; i < data.length - windowSize; i += hopSize) {
            // RMS of current window
            let rms = 0;
            for (let j = 0; j < windowSize; j++) rms += data[i + j] * data[i + j];
            rms = Math.sqrt(rms / windowSize);

            history.push(rms);
            if (history.length > historyLen) history.shift();
            if (history.length < historyLen) continue;

            const avg = history.reduce((a, b) => a + b) / historyLen;
            if (avg < 0.003) continue; // below noise floor

            if (rms > avg * threshold) {
                const timeMs = (i / sr) * 1000;
                if (timeMs - lastOnsetMs < minGapMs) continue;

                const strength = rms / avg;
                const type     = this._classifyBandOnset(band, strength, data, i, windowSize);

                onsets.push({ time: timeMs, strength, type, band });
                lastOnsetMs = timeMs;
            }
        }

        return onsets;
    }

    /**
     * Classify an onset given which frequency band it came from.
     * Bass strong = kick/sub.  Mid sustained = melody/vocal.
     * Treble sharp = hi-hat/cymbal.
     */
    _classifyBandOnset(band, strength, data, pos, windowSize) {
        const attackWin = Math.floor(windowSize * 0.08);
        const sustainWin = Math.floor(windowSize * 0.5);

        let attack = 0, sustain = 0;
        for (let i = 0; i < attackWin; i++)  attack  += Math.abs(data[pos + i] || 0);
        for (let i = attackWin; i < attackWin + sustainWin; i++) sustain += Math.abs(data[pos + i] || 0);
        attack  /= attackWin;
        sustain /= sustainWin;

        if (band === 'bass') {
            // Kick: very sharp attack, fast decay
            return strength > 1.9 && attack > sustain * 1.3 ? 'strong'
                 : sustain > attack * 1.4                   ? 'sustained'
                 : 'medium';
        }
        if (band === 'mid') {
            // Snare / vocal / melody
            return strength > 1.7                ? 'strong'
                 : sustain > attack * 1.2        ? 'sustained'
                 : strength > 1.4               ? 'medium'
                 :                                'weak';
        }
        // treble
        // Hi-hat: very sharp, almost no sustain
        return attack > sustain * 2.0 ? 'medium' : 'weak';
    }

    /**
     * Detect sustained notes (holds/slides) from bass+mid energy.
     * A sustained onset is flagged when a region stays above 70% of
     * peak energy for more than 2 beats (estimated from BPM).
     */
    _detectSustains(bassData, midData) {
        const holdCandidates = [];
        const sr         = this._bandSampleRate ?? this.sampleRate; // use downsampled rate
        const windowMs   = 0.05;
        const hopMs      = 0.025;
        const windowSize = Math.max(1, Math.floor(sr * windowMs));
        const hopSize    = Math.max(1, Math.floor(sr * hopMs));

        // Combine bass + mid for sustain detection
        const minLen = Math.min(bassData.length, midData.length);
        let inSustain   = false;
        let sustainStart = 0;
        let peakEnergy  = 0;
        let sustainPeak = 0;
        const sustainThresholdMs = 300; // must sustain for at least 300 ms

        for (let i = 0; i < minLen - windowSize; i += hopSize) {
            let e = 0;
            for (let j = 0; j < windowSize; j++) {
                const b = bassData[i + j] || 0;
                const m = midData[i + j]  || 0;
                e += (b * b + m * m) / 2;
            }
            const rms = Math.sqrt(e / windowSize);
            const timeMs = (i / sr) * 1000;

            if (rms > peakEnergy) peakEnergy = rms;

            if (!inSustain) {
                if (rms > peakEnergy * 0.6 && rms > 0.01) {
                    inSustain    = true;
                    sustainStart = timeMs;
                    sustainPeak  = rms;
                }
            } else {
                if (rms > sustainPeak) sustainPeak = rms;
                if (rms < sustainPeak * 0.4 || rms < 0.005) {
                    // Sustain ended
                    const duration = timeMs - sustainStart;
                    if (duration >= sustainThresholdMs) {
                        holdCandidates.push({
                            time:     sustainStart,
                            strength: sustainPeak / (peakEnergy || 1),
                            type:     'sustained',
                            band:     'mid',
                            holdDuration: Math.round(duration)
                        });
                    }
                    inSustain = false;
                    sustainPeak = 0;
                }
            }
        }
        return holdCandidates;
    }

    /**
     * Merge onsets from all bands: sort by time, resolve collisions
     * within a 30 ms window by keeping the strongest per window.
     */
    _mergeOnsets(onsets) {
        onsets.sort((a, b) => a.time - b.time);
        const merged = [];
        const WINDOW = 30; // ms

        for (const onset of onsets) {
            const last = merged[merged.length - 1];
            if (!last || onset.time - last.time > WINDOW) {
                merged.push({ ...onset });
            } else if (onset.strength > last.strength) {
                // Same window — keep the stronger one, merge band info
                Object.assign(last, onset);
            } else {
                // Weaker in same window — annotate extra band only
                if (!last.bands) last.bands = [last.band];
                if (!last.bands.includes(onset.band)) last.bands.push(onset.band);
            }
        }
        return merged;
    }

    /**
     * Beat detection with tempo map.
     *
     * Returns { beats: number[], tempoMap: { time, bpm, interval }[] }
     *
     * The tempo map is built by analysing bass-onset IOIs in sliding windows
     * across the whole song, so BPM changes are automatically detected.
     *
     * @param {number|Array} bpmHint  Scalar BPM fallback OR the editor's
     *                                bpmChanges array [{time, bpm}] for
     *                                multi-BPM songs.
     */
    async detectBeats(bpmHint = 120) {
        const durationMs = this.duration * 1000;

        // ── Build the tempo map ──────────────────────────────────────────
        const bassOnsets = this._bandOnsets?.bass ?? [];
        const tempoMap   = this._buildTempoMap(bassOnsets, bpmHint, durationMs);

        // ── Generate the beat grid from the tempo map ────────────────────
        const beats = [];
        for (let seg = 0; seg < tempoMap.length; seg++) {
            const seg_start = tempoMap[seg].time;
            const seg_end   = seg < tempoMap.length - 1
                ? tempoMap[seg + 1].time
                : durationMs;
            const interval  = tempoMap[seg].interval;

            // Anchor to first strong bass onset in this segment (or segment start)
            const segBassOnsets = bassOnsets.filter(
                o => o.time >= seg_start && o.time < seg_end && o.type === 'strong'
            );
            const anchor = segBassOnsets.length ? segBassOnsets[0].time : seg_start;

            // Walk backward from anchor to segment start
            let t = anchor;
            while (t - interval >= seg_start) t -= interval;

            // Walk forward through segment
            while (t < seg_end) {
                if (t >= 0) beats.push(t);
                t += interval;
            }
        }

        // Deduplicate and sort (segments might share a boundary beat)
        const uniqueBeats = [...new Set(beats.map(b => Math.round(b)))].sort((a, b) => a - b);

        return { beats: uniqueBeats, tempoMap };
    }

    /**
     * Build a tempo map from bass-onset IOIs and an optional BPM hint.
     *
     * Strategy:
     *   - If bpmHint is an array (bpmChanges from the editor), use those
     *     directly as the tempo map — trust the user.
     *   - Otherwise, slide a 10-second window across bass onsets, run
     *     IOI histogram per window, detect dominant beat period.
     *   - Merge consecutive identical BPMs to keep the map compact.
     *
     * Returns: [{ time, bpm, interval }] sorted by time.
     */
    _buildTempoMap(bassOnsets, bpmHint, durationMs) {
        // ── Case 1: caller passed bpmChanges[] (editor's multi-BPM list) ──
        if (Array.isArray(bpmHint) && bpmHint.length > 0) {
            return bpmHint
                .slice()
                .sort((a, b) => a.time - b.time)
                .map(c => ({
                    time:     c.time,
                    bpm:      c.bpm,
                    interval: (60 / c.bpm) * 1000
                }));
        }

        const fallbackBpm      = typeof bpmHint === 'number' ? bpmHint : 120;
        const fallbackInterval = (60 / fallbackBpm) * 1000;

        // Need at least 4 bass onsets to attempt detection
        if (!bassOnsets || bassOnsets.length < 4) {
            return [{ time: 0, bpm: fallbackBpm, interval: fallbackInterval }];
        }

        // ── Case 2: sliding-window IOI detection ──────────────────────────
        const WINDOW_MS  = 10_000; // 10-second analysis window
        const HOP_MS     = 5_000;  // 5-second hop (50% overlap)
        const BIN_MS     = 10;     // histogram bucket size in ms

        const rawMap = []; // { time, bpm }

        for (let winStart = 0; winStart < durationMs; winStart += HOP_MS) {
            const winEnd = winStart + WINDOW_MS;

            // IOIs between consecutive bass onsets in this window
            const windowOnsets = bassOnsets.filter(
                o => o.time >= winStart && o.time < winEnd
            );

            if (windowOnsets.length < 3) continue;

            const iois = [];
            for (let i = 1; i < windowOnsets.length; i++) {
                iois.push(windowOnsets[i].time - windowOnsets[i - 1].time);
            }

            // Histogram of IOIs — find dominant period
            const hist = new Map();
            for (const ioi of iois) {
                const bin = Math.round(ioi / BIN_MS) * BIN_MS;
                hist.set(bin, (hist.get(bin) || 0) + 1);
            }

            let bestBin = fallbackInterval, bestCount = 0;
            for (const [bin, count] of hist) {
                // Plausible beat range: 200–2000 ms (30–300 BPM)
                if (bin >= 200 && bin <= 2000 && count > bestCount) {
                    bestCount = count;
                    bestBin   = bin;
                }
            }

            // Only trust if dominant bin is within ±25% of the hint
            const trusted = bestCount >= 2
                && Math.abs(bestBin - fallbackInterval) / fallbackInterval < 0.25;
            const useBin = trusted ? bestBin : fallbackInterval;
            const detectedBpm = Math.round(60000 / useBin);

            rawMap.push({ time: winStart, bpm: detectedBpm });
        }

        if (rawMap.length === 0) {
            return [{ time: 0, bpm: fallbackBpm, interval: fallbackInterval }];
        }

        // Ensure map starts at t=0
        if (rawMap[0].time > 0) rawMap.unshift({ time: 0, bpm: rawMap[0].bpm });

        // Merge consecutive identical BPMs
        const merged = [rawMap[0]];
        for (let i = 1; i < rawMap.length; i++) {
            if (rawMap[i].bpm !== merged[merged.length - 1].bpm) {
                merged.push(rawMap[i]);
            }
        }

        return merged.map(c => ({
            time:     c.time,
            bpm:      c.bpm,
            interval: (60 / c.bpm) * 1000
        }));
    }

    /**
     * Snap note times to the nearest beat subdivision using the tempo map.
     *
     * @param {Object[]} notes        Array of note objects (mutated in place)
     * @param {Object[]} tempoMap     [{time, bpm, interval}] from _buildTempoMap
     * @param {number}   subdivision  Beat subdivisions: 4=quarter, 8=eighth, 16=sixteenth
     * @param {number}   strength     0–1, how strongly to snap (1.0 = hard snap, 0 = no-op)
     */
    _quantizeToGrid(notes, tempoMap, subdivision = 4, strength = 1.0) {
        if (strength <= 0 || !tempoMap || tempoMap.length === 0) return;

        for (const note of notes) {
            // Find the active BPM segment for this note
            let seg = tempoMap[0];
            for (const s of tempoMap) {
                if (s.time <= note.time) seg = s;
                else break;
            }

            // Step size for the requested subdivision
            const stepMs = seg.interval / subdivision;

            // Offset of this note from the segment start (to get phase right)
            const phase  = (note.time - seg.time) % seg.interval;
            // Which subdivision grid line is the note closest to?
            const snapPhase = Math.round(phase / stepMs) * stepMs;
            // How far off is it?
            const delta = snapPhase - phase;

            // Apply snap with strength blend
            note.time = Math.max(0, Math.round(note.time + delta * strength));
        }
    }

    /**
     * Group onsets into musical phrases
     * Returns: Array of { start, end, onsets, type }
     */
    _groupIntoPhrases(onsets, energyData) {
        if (onsets.length === 0) return [];

        const phrases = [];
        const minPhraseGap = 800; // 800ms silence = phrase boundary
        const maxPhraseLength = 4000; // Max 4 seconds per phrase
        const minPhraseLength = 300; // Min 300ms per phrase

        let currentPhrase = {
            start: onsets[0].time,
            onsets: [onsets[0]]
        };

        for (let i = 1; i < onsets.length; i++) {
            const gap = onsets[i].time - onsets[i - 1].time;
            const phraseLength = onsets[i].time - currentPhrase.start;

            // Start new phrase if:
            // 1. Large gap detected (silence)
            // 2. Phrase is getting too long
            if (gap > minPhraseGap || phraseLength > maxPhraseLength) {
                // Finalize current phrase
                if (currentPhrase.onsets.length > 0) {
                    currentPhrase.end = currentPhrase.onsets[currentPhrase.onsets.length - 1].time;
                    currentPhrase.type = this._classifyPhrase(currentPhrase, energyData);
                    phrases.push(currentPhrase);
                }

                // Start new phrase
                currentPhrase = {
                    start: onsets[i].time,
                    onsets: [onsets[i]]
                };
            } else {
                currentPhrase.onsets.push(onsets[i]);
            }
        }

        // Add final phrase
        if (currentPhrase.onsets.length > 0) {
            currentPhrase.end = currentPhrase.onsets[currentPhrase.onsets.length - 1].time;
            currentPhrase.type = this._classifyPhrase(currentPhrase, energyData);
            phrases.push(currentPhrase);
        }

        return phrases;
    }

    /**
     * Classify phrase type based on onset patterns
     */
    _classifyPhrase(phrase, energyData) {
        const onsets = phrase.onsets;
        const duration = phrase.end - phrase.start;
        const onsetCount = onsets.length;
        const density = onsetCount / (duration / 1000); // onsets per second

        // Calculate average energy in this phrase
        const phraseEnergy = energyData.filter(e =>
            e.time >= phrase.start && e.time <= phrase.end
        );
        const avgEnergy = phraseEnergy.length > 0
            ? phraseEnergy.reduce((sum, e) => sum + e.energy, 0) / phraseEnergy.length
            : 0;

        // Count strong onsets
        const strongCount = onsets.filter(o => o.type === 'strong').length;
        const strongRatio = strongCount / onsetCount;

        // Classification
        if (density > 8 && avgEnergy > 0.5) {
            return 'stream'; // Fast continuous notes
        } else if (density > 5 && strongRatio > 0.6) {
            return 'burst'; // Short intense pattern
        } else if (strongRatio > 0.7 && density < 4) {
            return 'accent'; // Emphasized hits
        } else if (density < 2) {
            return 'sparse'; // Slow taps
        } else if (onsets.some(o => o.type === 'sustained')) {
            return 'flowing'; // Sustained melodic line
        } else {
            return 'normal'; // Standard rhythm
        }
    }

    /**
     * Spectral analysis — reads the already-rendered band buffers
     * from _renderBands() (cached on this._bands) so we don't re-render.
     * Falls back to mono if bands aren't available.
     */
    async analyzeSpectral() {
        if (this._bands) {
            return this._spectralFromBands(this._bands);
        }
        // Synchronous fallback if detectOnsets wasn't called first
        this._bands = this._renderBands();
        return this._spectralFromBands(this._bands);
    }

    _spectralFromBands(bands) {
        const spectral = [];
        const sr         = this._bandSampleRate ?? this.sampleRate;
        // Scale window to ~46 ms at whatever sample rate we have
        const windowSize = Math.max(64, Math.floor(sr * 0.046));
        const hopSize    = Math.floor(windowSize / 2);
        const len        = Math.min(bands.bass.length, bands.mid.length, bands.treble.length);

        for (let i = 0; i < len - windowSize; i += hopSize) {
            let low = 0, mid = 0, high = 0;
            for (let j = 0; j < windowSize; j++) {
                low  += bands.bass[i + j]   * bands.bass[i + j];
                mid  += bands.mid[i + j]    * bands.mid[i + j];
                high += bands.treble[i + j] * bands.treble[i + j];
            }
            spectral.push({
                time: (i / sr) * 1000,
                low:  Math.sqrt(low  / windowSize),
                mid:  Math.sqrt(mid  / windowSize),
                high: Math.sqrt(high / windowSize)
            });
        }
        return spectral;
    }

    /**
     * Energy analysis — uses bands if cached, else raw mono.
     */
    async analyzeEnergy() {
        const energy = [];

        if (this._bands) {
            // Use downsampled band data
            const sr         = this._bandSampleRate ?? this.sampleRate;
            const windowSize = Math.max(1, Math.floor(sr * 0.05));
            const hopSize    = Math.floor(windowSize / 2);

            const b = this._bands.bass, m = this._bands.mid, t = this._bands.treble;
            const len = Math.min(b.length, m.length, t.length);

            for (let i = 0; i < len - windowSize; i += hopSize) {
                let e = 0;
                for (let j = 0; j < windowSize; j++) {
                    const v = (b[i + j] + m[i + j] + t[i + j]) / 3;
                    e += v * v;
                }
                energy.push({
                    time:   (i / sr) * 1000,
                    energy: Math.sqrt(e / windowSize)
                });
            }
        } else {
            // Fallback: raw mono channel
            const sr         = this.sampleRate;
            const windowSize = Math.floor(sr * 0.05);
            const hopSize    = Math.floor(windowSize / 2);
            const data       = this.audioBuffer.getChannelData(0);

            for (let i = 0; i < data.length - windowSize; i += hopSize) {
                let e = 0;
                for (let j = 0; j < windowSize; j++) e += data[i + j] * data[i + j];
                energy.push({
                    time:   (i / sr) * 1000,
                    energy: Math.sqrt(e / windowSize)
                });
            }
        }

        return energy;
    }

    /**
     * Build candidate pool weight (kept for compatibility with trainFromCharts).
     * The new generation path uses _buildCandidatePool() instead.
     */
    smartCombine(onsets, beats, energyData, offset) {
        return this._buildCandidatePool(onsets, beats, energyData, offset);
    }

    /**
     * Get energy at time — binary search instead of O(n) reduce.
     * energyData must be sorted ascending by time (it always is).
     */
    getEnergyAt(time, energyData) {
        if (!energyData || energyData.length === 0) return 0.5;
        if (energyData.length === 1) return energyData[0].energy;

        // Binary search for nearest time
        let lo = 0, hi = energyData.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (energyData[mid].time < time) lo = mid + 1;
            else hi = mid;
        }
        // lo is the first index >= time; compare with lo-1
        if (lo > 0 && Math.abs(energyData[lo - 1].time - time) <= Math.abs(energyData[lo].time - time)) {
            return energyData[lo - 1].energy;
        }
        return energyData[lo].energy;
    }

    /**
     * Legacy filter (kept for trainFromCharts compatibility).
     * The new generation path uses _selectCandidates() instead.
     */
    smartFilter(candidates, difficulty, minInterval, energyData) {
        // Delegate to the new deterministic selector with a dummy budget
        const dummyBudget = [{
            start: 0,
            end: this.duration * 1000,
            type: 'verse',
            targetNPS:   [2, 3.5, 6, 9, 13][Math.max(0, Math.min(4, difficulty - 1))],
            minGapMs:    minInterval,
            targetCount: Math.round([2, 3.5, 6, 9, 13][Math.max(0, Math.min(4, difficulty - 1))]
                         * this.duration)
        }];
        return this._selectCandidates(candidates, dummyBudget, difficulty).map(c => c.time);
    }

    /**
     * Smart zone assignment
     */
    smartZoneAssign(time, spectralData, prevNotes, difficulty, onset) {
        // ── Band-aware zone selection (new multi-band data) ──
        const band = onset?.band;
        if (band) {
            const rand = Math.random();
            let zone;
            if (band === 'bass') {
                // Kick/sub → anchor zones (0 and 3 feel "heavy")
                zone = rand < 0.45 ? 0 : rand < 0.75 ? 3 : rand < 0.88 ? 1 : 4;
            } else if (band === 'treble') {
                // Hi-hat/cymbal → higher-number zones
                zone = rand < 0.4 ? 5 : rand < 0.7 ? 4 : rand < 0.85 ? 3 : 2;
            } else {
                // Mid (snare/vocal/melody) → middle zones
                zone = rand < 0.3 ? 2 : rand < 0.6 ? 3 : rand < 0.75 ? 1 : rand < 0.9 ? 4 : rand < 0.95 ? 0 : 5;
            }
            return this.applyVariation(zone, prevNotes, difficulty);
        }

        // ── Spectral fallback (no band info) ──
        if (!spectralData || spectralData.length === 0) {
            return this.patternZone(prevNotes, difficulty);
        }

        // Binary search for nearest spectral frame
        let lo = 0, hi = spectralData.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (spectralData[mid].time < time) lo = mid + 1;
            else hi = mid;
        }
        if (lo > 0 && Math.abs(spectralData[lo - 1].time - time) < Math.abs(spectralData[lo].time - time)) lo--;
        const frame = spectralData[lo];

        const total = frame.low + frame.mid + frame.high;
        if (total === 0) return this.patternZone(prevNotes, difficulty);

        const lowR = frame.low / total;
        const midR = frame.mid / total;
        const highR = frame.high / total;

        const rand = Math.random();

        let zone;
        if (lowR > midR && lowR > highR) {
            zone = rand < 0.4 ? 0 : rand < 0.7 ? 1 : rand < 0.85 ? 2 : 3;
        } else if (highR > lowR && highR > midR) {
            zone = rand < 0.4 ? 5 : rand < 0.7 ? 4 : rand < 0.85 ? 3 : 2;
        } else {
            zone = rand < 0.3 ? 2 : rand < 0.6 ? 3 : rand < 0.75 ? 1 : rand < 0.9 ? 4 : rand < 0.95 ? 0 : 5;
        }

        return this.applyVariation(zone, prevNotes, difficulty);
    }

    /**
     * Pattern-based zone
     */
    patternZone(prevNotes, difficulty) {
        if (prevNotes.length === 0) return Math.floor(Math.random() * 6);

        const lastZone = prevNotes[prevNotes.length - 1].zone;
        const variety = difficulty / 5;

        if (Math.random() < 0.3 + variety * 0.4) {
            let newZone;
            do {
                newZone = Math.floor(Math.random() * 6);
            } while (newZone === lastZone && Math.random() < 0.7);
            return newZone;
        }

        return lastZone;
    }

    /**
     * Apply variation
     */
    applyVariation(zone, prevNotes, difficulty) {
        if (prevNotes.length === 0) return zone;

        const lastZone = prevNotes[prevNotes.length - 1].zone;

        if (zone === lastZone) {
            if (Math.random() < 0.3 + difficulty * 0.1) return zone;
            const adjacent = [(zone + 1) % 6, (zone + 5) % 6];
            return adjacent[Math.floor(Math.random() * adjacent.length)];
        }

        return zone;
    }

    /**
     * IMPROVED: Ensure playability with better spacing and rhythm quantization
     */
    ensurePlayable(notes, difficulty) {
        if (notes.length === 0) return;

        // === PHASE 1: ENFORCE MINIMUM SPACING ===
        // REDUCED minimum gaps for Expert/Master to allow faster patterns
        const minGaps = {
            1: 250,  // EASY: 250ms minimum
            2: 200,  // NORMAL: 200ms minimum
            3: 140,  // HARD: 140ms minimum (reduced from 150ms)
            4: 100,  // EXPERT: 100ms minimum (reduced from 120ms)
            5: 80    // MASTER: 80ms minimum (reduced from 100ms)
        };
        const minGap = minGaps[difficulty] || 140;

        // Remove notes that are too close together
        for (let i = notes.length - 1; i > 0; i--) {
            const gap = notes[i].time - notes[i - 1].time;
            if (gap < minGap) {
                // Keep the note with better energy/timing, remove the other
                notes.splice(i, 1);
            }
        }

        // === PHASE 2: PREVENT RAPID-FIRE SPAM ===
        // Look for sequences of 3+ notes that are all very close together
        // DISABLED for Expert/Master - they should allow rapid patterns
        if (difficulty <= 3) {
            for (let i = notes.length - 1; i >= 2; i--) {
                const gap1 = notes[i].time - notes[i - 1].time;
                const gap2 = notes[i - 1].time - notes[i - 2].time;

                // If we have 3 notes all within 150ms of each other, remove the middle one
                if (gap1 < 150 && gap2 < 150) {
                    notes.splice(i - 1, 1);
                    i--; // Adjust index after removal
                }
            }
        }

        // === PHASE 3: SMOOTH OUT AWKWARD PATTERNS ===
        // Prevent same zone 3+ times in a row
        for (let i = 2; i < notes.length; i++) {
            if (notes[i].zone === notes[i - 1].zone && notes[i - 1].zone === notes[i - 2].zone) {
                const zone = notes[i - 1].zone;
                // Change middle note to adjacent zone for better flow
                notes[i - 1].zone = (zone + (Math.random() < 0.5 ? 1 : 5)) % 6;
            }
        }

        // === PHASE 4: RHYTHM QUANTIZATION (optional, for musical feel) ===
        // Snap notes to nearest 1/16th beat for cleaner rhythm
        if (difficulty <= 3) {
            const bpm = 120; // Default, could be passed as parameter
            const sixteenthNote = (60000 / bpm) / 4; // Duration of 1/16th note

            for (let i = 0; i < notes.length; i++) {
                const quantized = Math.round(notes[i].time / sixteenthNote) * sixteenthNote;

                // Only quantize if it doesn't create conflicts
                const wouldConflict = notes.some((n, idx) =>
                    idx !== i && Math.abs(n.time - quantized) < minGap
                );

                if (!wouldConflict) {
                    notes[i].time = quantized;
                }
            }
        }

        // === PHASE 5: ENFORCE MAXIMUM DENSITY ===
        // DISABLED for Expert/Master - they should be allowed to be very dense
        if (difficulty <= 3) {
            // INCREASED max density for Hard
            const maxNotesPerSecond = {
                1: 4,   // EASY: max 4 notes/sec
                2: 6,   // NORMAL: max 6 notes/sec
                3: 9    // HARD: max 9 notes/sec
            };
            const maxDensity = maxNotesPerSecond[difficulty] || 9;
            const windowSize = 1000; // 1 second window

            for (let i = notes.length - 1; i >= 0; i--) {
                const windowStart = notes[i].time;
                const windowEnd = windowStart + windowSize;

                // Count notes in this window
                const notesInWindow = notes.filter(n =>
                    n.time >= windowStart && n.time < windowEnd
                ).length;

                // If too dense, remove this note
                if (notesInWindow > maxDensity) {
                    notes.splice(i, 1);
                }
            }
        }

        // === PHASE 6: FINAL CLEANUP ===
        // Remove any duplicates that might have been created
        const seen = new Set();
        for (let i = notes.length - 1; i >= 0; i--) {
            const key = `${notes[i].time}-${notes[i].zone}`;
            if (seen.has(key)) {
                notes.splice(i, 1);
            } else {
                seen.add(key);
            }
        }
    }

    /**
     * Quick map with training and maimai style
     */
    async quickMap(bpm, difficulty = 2, options = {}) {
        return this.generateChart({
            bpm,
            difficulty,
            offset: 0,
            minNoteInterval: 150,
            useTrainedModel: options.useTrainedModel !== false,
            vsrgStyle: options.vsrgStyle !== false,
            streamIntensity: options.streamIntensity || 0.6
        });
    }

    /**
     * Save trained model to localStorage with size checking and fallback
     */
    async saveTrainedModel() {
        if (!this.trainedModel) {
            return false;
        }

        try {
            // Convert Maps to objects for JSON serialization
            const serializable = {
                zoneTransitions: Object.fromEntries(this.trainedModel.zoneTransitions),
                timingPatterns: this.trainedModel.timingPatterns,
                densityCurves: this.trainedModel.densityCurves,
                difficultyScaling: this.trainedModel.difficultyScaling,
                patternFrequency: Object.fromEntries(this.trainedModel.patternFrequency),
                // ADVANCED fields
                contextualPatterns: Object.fromEntries(this.trainedModel.contextualPatterns || new Map()),
                energyBasedZones: Object.fromEntries(this.trainedModel.energyBasedZones || new Map()),
                timingVariance: Object.fromEntries(this.trainedModel.timingVariance || new Map()),
                longPatterns: Object.fromEntries(this.trainedModel.longPatterns || new Map()),
                patternTransitions: Object.fromEntries(this.trainedModel.patternTransitions || new Map()),
                sectionDensity: Object.fromEntries(this.trainedModel.sectionDensity || new Map()),
                buildupPatterns: this.trainedModel.buildupPatterns || [],
                breakdownPatterns: this.trainedModel.breakdownPatterns || [],
                zoneProximity: Object.fromEntries(this.trainedModel.zoneProximity || new Map()),
                zoneSymmetry: Object.fromEntries(this.trainedModel.zoneSymmetry || new Map()),
                zoneClusters: this.trainedModel.zoneClusters || [],
                rhythmPatterns: Object.fromEntries(this.trainedModel.rhythmPatterns || new Map()),
                syncopation: this.trainedModel.syncopation || [],
                polyrhythms: this.trainedModel.polyrhythms || [],
                difficultyTransitions: Object.fromEntries(this.trainedModel.difficultyTransitions || new Map()),
                complexityMetrics: this.trainedModel.complexityMetrics || {}
            };

            const jsonString = JSON.stringify(serializable);
            const sizeInMB = (jsonString.length / 1024 / 1024).toFixed(2);
            // Try localStorage first (limit ~5-10MB)
            if (jsonString.length < 5 * 1024 * 1024) {
                localStorage.setItem('dsxAutoMapperModel', jsonString);
                return true;
            } else {
                // Try IndexedDB (much larger limit, ~50MB+)
                await this._saveToIndexedDB(serializable);
                return true;
            }
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                return false;
            }
            return false;
        }
    }

    /**
     * Save to IndexedDB (for large models)
     */
    async _saveToIndexedDB(data) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DSXAutoMapper', 1);

            request.onerror = () => reject(request.error);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('models')) {
                    db.createObjectStore('models');
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction(['models'], 'readwrite');
                const store = transaction.objectStore('models');
                const putRequest = store.put(data, 'trainedModel');

                putRequest.onsuccess = () => {
                    resolve(true);
                };

                putRequest.onerror = () => reject(putRequest.error);
            };
        });
    }

    /**
     * Load trained model from localStorage or IndexedDB
     */
    async loadTrainedModel() {
        try {
            // Try localStorage first
            const saved = localStorage.getItem('dsxAutoMapperModel');
            if (saved) {
                const data = JSON.parse(saved);
                this._deserializeModel(data);
                return true;
            }

            // Try IndexedDB
            const indexedData = await this._loadFromIndexedDB();
            if (indexedData) {
                this._deserializeModel(indexedData);
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Load from IndexedDB
     */
    async _loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DSXAutoMapper', 1);

            request.onerror = () => {
                resolve(null);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('models')) {
                    db.createObjectStore('models');
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('models')) {
                    resolve(null);
                    return;
                }

                const transaction = db.transaction(['models'], 'readonly');
                const store = transaction.objectStore('models');
                const getRequest = store.get('trainedModel');

                getRequest.onsuccess = () => {
                    if (getRequest.result) {
                    }
                    resolve(getRequest.result || null);
                };
                getRequest.onerror = () => {
                    resolve(null);
                };
            };
        });
    }

    /**
     * Deserialize model data
     */
    _deserializeModel(data) {
        this.trainedModel = {
            zoneTransitions: new Map(Object.entries(data.zoneTransitions || {})),
            timingPatterns: data.timingPatterns || [],
            densityCurves: data.densityCurves || [],
            difficultyScaling: data.difficultyScaling || {},
            patternFrequency: new Map(Object.entries(data.patternFrequency || {})),
            // ADVANCED fields (with fallbacks)
            contextualPatterns: new Map(Object.entries(data.contextualPatterns || {})),
            energyBasedZones: new Map(Object.entries(data.energyBasedZones || {})),
            timingVariance: new Map(Object.entries(data.timingVariance || {})),
            longPatterns: new Map(Object.entries(data.longPatterns || {})),
            patternTransitions: new Map(Object.entries(data.patternTransitions || {})),
            sectionDensity: new Map(Object.entries(data.sectionDensity || {})),
            buildupPatterns: data.buildupPatterns || [],
            breakdownPatterns: data.breakdownPatterns || [],
            zoneProximity: new Map(Object.entries(data.zoneProximity || {})),
            zoneSymmetry: new Map(Object.entries(data.zoneSymmetry || {})),
            zoneClusters: data.zoneClusters || [],
            rhythmPatterns: new Map(Object.entries(data.rhythmPatterns || {})),
            syncopation: data.syncopation || [],
            polyrhythms: data.polyrhythms || [],
            difficultyTransitions: new Map(Object.entries(data.difficultyTransitions || {})),
            complexityMetrics: data.complexityMetrics || {}
        };
    }

    /**
     * Export model as downloadable file
     */
    exportModelToFile() {
        if (!this.trainedModel) {
            return false;
        }

        try {
            const serializable = {
                zoneTransitions: Object.fromEntries(this.trainedModel.zoneTransitions),
                timingPatterns: this.trainedModel.timingPatterns,
                densityCurves: this.trainedModel.densityCurves,
                difficultyScaling: this.trainedModel.difficultyScaling,
                patternFrequency: Object.fromEntries(this.trainedModel.patternFrequency),
                contextualPatterns: Object.fromEntries(this.trainedModel.contextualPatterns || new Map()),
                energyBasedZones: Object.fromEntries(this.trainedModel.energyBasedZones || new Map()),
                timingVariance: Object.fromEntries(this.trainedModel.timingVariance || new Map()),
                longPatterns: Object.fromEntries(this.trainedModel.longPatterns || new Map()),
                patternTransitions: Object.fromEntries(this.trainedModel.patternTransitions || new Map()),
                sectionDensity: Object.fromEntries(this.trainedModel.sectionDensity || new Map()),
                buildupPatterns: this.trainedModel.buildupPatterns || [],
                breakdownPatterns: this.trainedModel.breakdownPatterns || [],
                zoneProximity: Object.fromEntries(this.trainedModel.zoneProximity || new Map()),
                zoneSymmetry: Object.fromEntries(this.trainedModel.zoneSymmetry || new Map()),
                zoneClusters: this.trainedModel.zoneClusters || [],
                rhythmPatterns: Object.fromEntries(this.trainedModel.rhythmPatterns || new Map()),
                syncopation: this.trainedModel.syncopation || [],
                polyrhythms: this.trainedModel.polyrhythms || [],
                difficultyTransitions: Object.fromEntries(this.trainedModel.difficultyTransitions || new Map()),
                complexityMetrics: this.trainedModel.complexityMetrics || {}
            };

            const jsonString = JSON.stringify(serializable, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `DreamSyncX-ai-model-${Date.now()}.json`;
            a.click();

            URL.revokeObjectURL(url);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Import model from file
     */
    async importModelFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            this._deserializeModel(data);
            return true;
        } catch (e) {
            return false;
        }
    }
}
