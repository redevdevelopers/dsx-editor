/**
 * Optimized Auto-Mapper for DreamSyncX
 * Smart audio analysis + Machine Learning from existing charts + maimai-style patterns
 */

export class AutoMapper {
    constructor(audioBuffer, audioContext) {
        this.audioBuffer = audioBuffer;
        this.audioContext = audioContext;
        this.sampleRate = audioBuffer.sampleRate;
        this.duration = audioBuffer.duration;

        // Training data storage
        this.trainedModel = null;
        this.maimaiPatterns = this._initMaimaiPatterns();
    }

    /**
     * Initialize maimai-style charting patterns + BUILT-IN KNOWLEDGE BASE
     */
    _initMaimaiPatterns() {
        return {
            // Circular flow patterns (maimai signature)
            circularFlows: [
                [0, 1, 2, 3, 4, 5], // Clockwise full circle
                [5, 4, 3, 2, 1, 0], // Counter-clockwise
                [0, 2, 4, 1, 3, 5], // Skip pattern
                [0, 3, 1, 4, 2, 5], // Cross pattern
            ],
            // Symmetrical patterns
            symmetrical: [
                [0, 5], [1, 4], [2, 3], // Opposite pairs
                [0, 3], [1, 4], [2, 5], // Triangle pairs
            ],
            // Burst patterns (multiple zones at once)
            bursts: [
                [0, 2, 4], // Triangle
                [1, 3, 5], // Inverted triangle
                [0, 1, 2], // Half circle
                [3, 4, 5], // Other half
            ],
            // Alternating patterns
            alternating: [
                [0, 3, 0, 3], // Back and forth
                [1, 4, 1, 4],
                [2, 5, 2, 5],
            ],
            // Spiral patterns
            spirals: [
                [0, 1, 2, 3, 4, 5, 0, 1], // Expanding spiral
                [0, 5, 1, 4, 2, 3], // Converging spiral
            ],

            // === BUILT-IN MAIMAI KNOWLEDGE BASE ===
            // Pre-programmed expert knowledge (no training needed!)

            // Common maimai zone transitions (from analyzing real charts)
            expertTransitions: new Map([
                ['0->1', 85], ['0->5', 80], ['0->3', 45], ['0->2', 35],
                ['1->2', 85], ['1->0', 80], ['1->4', 45], ['1->3', 35],
                ['2->3', 85], ['2->1', 80], ['2->5', 45], ['2->4', 35],
                ['3->4', 85], ['3->2', 80], ['3->0', 45], ['3->5', 35],
                ['4->5', 85], ['4->3', 80], ['4->1', 45], ['4->0', 35],
                ['5->0', 85], ['5->4', 80], ['5->2', 45], ['5->1', 35],
            ]),

            // Common 3-note patterns from maimai
            expertPatterns: new Map([
                ['0,1,2', 50], ['1,2,3', 50], ['2,3,4', 50], ['3,4,5', 50],
                ['4,5,0', 50], ['5,0,1', 50], // Clockwise flows
                ['0,5,4', 45], ['1,0,5', 45], ['2,1,0', 45], // Counter-clockwise
                ['0,3,0', 40], ['1,4,1', 40], ['2,5,2', 40], // Alternating
                ['0,2,4', 35], ['1,3,5', 35], // Triangles
                ['0,3,1', 30], ['1,4,2', 30], ['2,5,3', 30], // Cross patterns
            ]),

            // Energy-based zone preferences (maimai style)
            expertEnergyZones: new Map([
                // Low energy (0-3): Prefer adjacent zones, smooth flow
                ['E0:Z0', 20], ['E0:Z1', 20], ['E0:Z2', 15],
                ['E1:Z0', 20], ['E1:Z1', 20], ['E1:Z5', 15],
                ['E2:Z1', 20], ['E2:Z2', 20], ['E2:Z0', 15],
                ['E3:Z2', 20], ['E3:Z3', 20], ['E3:Z1', 15],

                // Medium energy (4-6): More variety
                ['E4:Z0', 15], ['E4:Z1', 15], ['E4:Z3', 15], ['E4:Z4', 10],
                ['E5:Z1', 15], ['E5:Z2', 15], ['E5:Z4', 15], ['E5:Z5', 10],
                ['E6:Z2', 15], ['E6:Z3', 15], ['E6:Z5', 15], ['E6:Z0', 10],

                // High energy (7-10): All zones, more chaos
                ['E7:Z0', 12], ['E7:Z1', 12], ['E7:Z2', 12], ['E7:Z3', 12], ['E7:Z4', 12], ['E7:Z5', 12],
                ['E8:Z0', 12], ['E8:Z1', 12], ['E8:Z2', 12], ['E8:Z3', 12], ['E8:Z4', 12], ['E8:Z5', 12],
                ['E9:Z0', 12], ['E9:Z1', 12], ['E9:Z2', 12], ['E9:Z3', 12], ['E9:Z4', 12], ['E9:Z5', 12],
                ['E10:Z0', 12], ['E10:Z1', 12], ['E10:Z2', 12], ['E10:Z3', 12], ['E10:Z4', 12], ['E10:Z5', 12],
            ]),

            // Difficulty-based interval ranges (maimai standard)
            expertDifficultyIntervals: {
                1: { min: 400, avg: 600, max: 1000 },  // EASY
                2: { min: 300, avg: 450, max: 800 },   // NORMAL
                3: { min: 200, avg: 350, max: 600 },   // HARD
                4: { min: 150, avg: 250, max: 450 },   // EXPERT
                5: { min: 100, avg: 180, max: 350 },   // MASTER
            },

            // Buildup patterns (how maimai builds intensity)
            expertBuildups: [
                [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], // Gradual clockwise
                [0, 2], [2, 4], [4, 0], // Triangle expansion
                [0, 3], [1, 4], [2, 5], // Opposite pairs
            ],

            // Breakdown patterns (how maimai reduces intensity)
            expertBreakdowns: [
                [5, 4], [4, 3], [3, 2], [2, 1], [1, 0], // Gradual counter-clockwise
                [0, 1, 0], [1, 2, 1], // Back and forth
            ],
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

            // Long patterns (4-8 notes)
            for (let len = 4; len <= 8; len++) {
                for (let i = 0; i < notes.length - len; i++) {
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
     * Generate chart with optimized smart analysis + trained patterns + maimai style
     */
    async generateChart(options = {}) {
        const {
            difficulty = 2,
            bpm = 120,
            offset = 0,
            minNoteInterval = 150,
            useTrainedModel = true,
            maimaiStyle = true,
            maimaiIntensity = 0.7 // 0-1, how much maimai influence
        } = options;
        if (useTrainedModel && this.trainedModel) {
        }
        if (maimaiStyle) {
        }
        const notes = [];

        // === PHASE 1: ANALYZE & PLAN ===
        // Step 1: Fast onset detection WITH CLASSIFICATION
        const onsets = await this.detectOnsets();
        // Step 2: Beat detection
        const beats = await this.detectBeats(bpm);
        // Step 3: Fast spectral analysis
        const spectralData = await this.analyzeSpectral();
        // Step 4: Energy analysis
        const energyData = await this.analyzeEnergy();
        // Step 5: Group onsets into PHRASES (NEW!)
        let phrases = [];
        try {
            phrases = this._groupIntoPhrases(onsets, energyData);
        } catch (error) {
            phrases = []; // Empty array as fallback
        }

        // Step 6: Detect song structure
        const songStructure = this._analyzeSongStructure(energyData, onsets, this.duration);
        // Step 7: Plan note distribution
        const notePlan = this._planNoteDistribution(songStructure, difficulty, this.duration);
        // === PHASE 2: GENERATE WITH CONTEXT ===
        // Step 7: Smart combination
        const candidates = this.smartCombine(onsets, beats, energyData, offset);
        // Step 8: Intelligent filtering with structure awareness
        const filtered = this.smartFilterWithStructure(candidates, difficulty, minNoteInterval, energyData, songStructure, notePlan);
        // Step 9: Smart zone assignment with maimai patterns and trained model
        for (let i = 0; i < filtered.length; i++) {
            const time = filtered[i];
            const prevNotes = notes.slice(Math.max(0, notes.length - 6)); // Look at last 6 notes

            // Calculate current energy level for context
            const currentEnergy = this.getEnergyAt(time, energyData);
            const avgEnergy = energyData.reduce((sum, d) => sum + d.energy, 0) / energyData.length;
            const normalizedEnergy = Math.min(1, currentEnergy / (avgEnergy * 2));

            // Get current section context
            const currentSection = songStructure.sections.find(s => time >= s.start && time < s.end);
            let zone;

            // Decide which method to use based on options and context
            // Priority: Trained data > maimai style > audio analysis
            const useTrained = useTrainedModel && this.trainedModel && prevNotes.length > 0;
            const useMaimai = maimaiStyle && !useTrained && prevNotes.length >= 2 && Math.random() < maimaiIntensity;

            // DEBUG: Log which method is being used (only once)
            if (i === 0) {
                if (useTrained) {
                } else if (useMaimai) {
                } else {
                }
            }

            if (useTrained) {
                zone = this.trainedZoneAssign(prevNotes, difficulty, normalizedEnergy);
            } else if (useMaimai) {
                zone = this.maimaiZoneAssign(time, spectralData, prevNotes, difficulty);
            } else {
                zone = this.smartZoneAssign(time, spectralData, prevNotes, difficulty);
            }

            notes.push({
                time: Math.round(time),
                zone: zone,
                type: 'regular'
            });
        }

        // Step 8: Add simultaneous notes (chords/patterns) for variety
        const avgEnergy = energyData.reduce((sum, d) => sum + d.energy, 0) / energyData.length;
        const beforeChords = notes.length;
        this._addSimultaneousNotes(notes, difficulty, avgEnergy, energyData, phrases);
        // Step 9: Adapt osu!mania patterns to circular layout (if trained from osu)
        if (useTrainedModel && this.trainedModel) {
            this._adaptLinearToCircular(notes);
        }

        // Step 10: Apply maimai-style post-processing (ONLY if not using trained model)
        // Don't overwrite trained patterns with maimai patterns!
        if (maimaiStyle && !useTrainedModel) {
            this.applyMaimaiPostProcessing(notes, difficulty, maimaiIntensity);
        }

        // Step 11: Ensure playability
        const beforePlayable = notes.length;
        this.ensurePlayable(notes, difficulty);
        notes.sort((a, b) => a.time - b.time);
        return notes;
    }

    /**
     * REDESIGNED: Add simultaneous notes (chords) with MUSICAL INTENT
     * Chords should be accents, not random noise
     */
    _addSimultaneousNotes(notes, difficulty, avgEnergy, energyData, phrases) {
        if (notes.length < 10) return;

        const addedChords = [];

        // Base chord frequency (much lower than before)
        const baseChordChance = {
            1: 0.02,  // EASY: 2% base
            2: 0.05,  // NORMAL: 5% base
            3: 0.08,  // HARD: 8% base
            4: 0.12,  // EXPERT: 12% base
            5: 0.15   // MASTER: 15% base
        }[difficulty] || 0.08;

        for (let i = 1; i < notes.length - 1; i++) {
            const note = notes[i];
            const prevNote = notes[i - 1];
            const nextNote = notes[i + 1];

            const timeSincePrev = note.time - prevNote.time;
            const timeToNext = nextNote.time - note.time;

            // Don't add chords too close together
            if (timeSincePrev < 300 || timeToNext < 300) continue;
            if (addedChords.some(c => Math.abs(c.time - note.time) < 50)) continue;

            // Get energy at this point
            const energy = this.getEnergyAt(note.time, energyData);
            const normalizedEnergy = energy / avgEnergy;

            // Find which phrase this note belongs to
            const currentPhrase = phrases?.find(p =>
                note.time >= p.start && note.time <= p.end
            );

            // Calculate chord probability based on MUSICAL CONTEXT
            let chordChance = baseChordChance;

            // GATE 1: Phrase endings get MUCH higher chord chance
            if (currentPhrase) {
                const phraseProgress = (note.time - currentPhrase.start) / (currentPhrase.end - currentPhrase.start);
                if (phraseProgress > 0.8) {
                    chordChance += 0.4; // 40% boost at phrase end
                }
            }

            // GATE 2: Strong energy peaks
            if (normalizedEnergy > 1.5) {
                chordChance += 0.3; // 30% boost for strong hits
            } else if (normalizedEnergy > 1.2) {
                chordChance += 0.15; // 15% boost for medium hits
            }

            // GATE 3: Phrase type influences chords
            if (currentPhrase) {
                switch (currentPhrase.type) {
                    case 'accent':
                        chordChance += 0.25; // Accent phrases SHOULD have chords
                        break;
                    case 'burst':
                        chordChance += 0.15; // Bursts can have chords
                        break;
                    case 'stream':
                        chordChance -= 0.1; // Streams should be mostly singles
                        break;
                    case 'sparse':
                        chordChance += 0.1; // Sparse sections can emphasize with chords
                        break;
                }
            }

            // GATE 4: Long gaps before/after = likely an accent
            if (timeSincePrev > 600 || timeToNext > 600) {
                chordChance += 0.2; // Isolated notes are often accents
            }

            // Cap at 90%
            chordChance = Math.min(0.9, Math.max(0, chordChance));

            if (Math.random() > chordChance) continue;

            // Decide chord type based on context
            const chordType = Math.random();
            const isStrongHit = normalizedEnergy > 1.5;

            if (chordType < 0.4 || isStrongHit) {
                // DOUBLE NOTE (opposite zones) - most common, especially for strong hits
                const oppositeZone = (note.zone + 3) % 6;
                addedChords.push({
                    time: note.time,
                    zone: oppositeZone,
                    type: 'regular'
                });
            } else if (chordType < 0.7 && difficulty >= 3) {
                // ADJACENT DOUBLE
                const adjacentZone = (note.zone + (Math.random() < 0.5 ? 1 : 5)) % 6;
                addedChords.push({
                    time: note.time,
                    zone: adjacentZone,
                    type: 'regular'
                });
            } else if (difficulty >= 4 && isStrongHit) {
                // TRIANGLE (3 zones) - ONLY for expert+ AND strong hits
                const triangleType = Math.random() < 0.5 ? 0 : 1;
                const triangleZones = triangleType === 0
                    ? [0, 2, 4]  // Triangle 1
                    : [1, 3, 5]; // Triangle 2

                // Add the other 2 zones of the triangle
                for (const zone of triangleZones) {
                    if (zone !== note.zone) {
                        addedChords.push({
                            time: note.time,
                            zone: zone,
                            type: 'regular'
                        });
                    }
                }
            }
        }

        // Add all chords to notes array
        notes.push(...addedChords);
    }

    /**
     * Adapt linear patterns (from osu!mania) to circular flow
     * Converts "back and forth" patterns to "circular flow" patterns
     */
    _adaptLinearToCircular(notes) {
        if (notes.length < 4) return;

        for (let i = 0; i < notes.length - 3; i++) {
            const pattern = notes.slice(i, i + 4).map(n => n.zone);

            // Detect "zigzag" patterns (common in osu!mania)
            // Example: [0,3,0,3] or [1,4,1,4]
            if (pattern[0] === pattern[2] && pattern[1] === pattern[3] && pattern[0] !== pattern[1]) {
                // Convert to circular flow
                // [0,3,0,3] → [0,1,2,3] (clockwise)
                const start = pattern[0];
                for (let j = 0; j < 4; j++) {
                    notes[i + j].zone = (start + j) % 6;
                }
            }

            // Detect "staircase" patterns (also common in osu!mania)
            // Example: [0,1,2,3] but with gaps
            const diffs = [];
            for (let j = 1; j < 4; j++) {
                diffs.push(pattern[j] - pattern[j - 1]);
            }

            // If all diffs are same direction but too large, smooth them out
            const allPositive = diffs.every(d => d > 0);
            const allNegative = diffs.every(d => d < 0);

            if ((allPositive || allNegative) && Math.max(...diffs.map(Math.abs)) > 2) {
                // Smooth to adjacent zones
                const direction = allPositive ? 1 : -1;
                for (let j = 1; j < 4; j++) {
                    notes[i + j].zone = (notes[i + j - 1].zone + direction + 6) % 6;
                }
            }
        }
    }

    /**
     * maimai-style zone assignment
     */
    maimaiZoneAssign(time, spectralData, prevNotes, difficulty) {
        const lastZone = prevNotes[prevNotes.length - 1].zone;
        const patternLength = Math.min(prevNotes.length, 4);
        const recentPattern = prevNotes.slice(-patternLength).map(n => n.zone);

        // Detect if we're in a flow pattern
        const isFlowing = this._detectFlow(recentPattern);

        if (isFlowing) {
            // Continue the flow
            return this._continueFlow(recentPattern, difficulty);
        }

        // Check for symmetry opportunity
        if (Math.random() < 0.3) {
            const symmetricZone = this._getSymmetricZone(lastZone);
            if (symmetricZone !== null) return symmetricZone;
        }

        // Use circular patterns
        if (Math.random() < 0.4) {
            const direction = Math.random() < 0.5 ? 1 : -1; // Clockwise or counter
            return (lastZone + direction + 6) % 6;
        }

        // Random with maimai preference for variety
        const avoidZones = recentPattern.slice(-2); // Avoid last 2 zones
        let newZone;
        do {
            newZone = Math.floor(Math.random() * 6);
        } while (avoidZones.includes(newZone) && Math.random() < 0.8);

        return newZone;
    }

    /**
     * Detect if notes are following a flow pattern
     */
    _detectFlow(pattern) {
        if (pattern.length < 3) return false;

        // Check for consistent direction
        const diffs = [];
        for (let i = 1; i < pattern.length; i++) {
            let diff = pattern[i] - pattern[i - 1];
            // Normalize to -3 to 3 range (shortest path around circle)
            if (diff > 3) diff -= 6;
            if (diff < -3) diff += 6;
            diffs.push(diff);
        }

        // All diffs should be same sign and similar magnitude
        const allPositive = diffs.every(d => d > 0);
        const allNegative = diffs.every(d => d < 0);

        return allPositive || allNegative;
    }

    /**
     * Continue a detected flow pattern
     */
    _continueFlow(pattern, difficulty) {
        const last = pattern[pattern.length - 1];
        const secondLast = pattern[pattern.length - 2];

        let diff = last - secondLast;
        if (diff > 3) diff -= 6;
        if (diff < -3) diff += 6;

        // Continue in same direction with occasional variation
        if (Math.random() < 0.85) {
            return (last + diff + 6) % 6;
        } else {
            // Break the flow occasionally
            return (last + diff * 2 + 6) % 6;
        }
    }

    /**
     * Get symmetric zone (maimai loves symmetry)
     */
    _getSymmetricZone(zone) {
        // Opposite side of hexagon
        return (zone + 3) % 6;
    }

    /**
     * PERFECTED: Apply maimai-style post-processing with advanced intelligence
     */
    applyMaimaiPostProcessing(notes, difficulty, intensity) {
        // === PHASE 1: INTELLIGENT BURST INJECTION ===
        if (intensity > 0.5 && difficulty >= 3) {
            this._addIntelligentBursts(notes, difficulty);
        }

        // === PHASE 2: FLOW ENHANCEMENT ===
        this._enhanceCircularFlows(notes);

        // === PHASE 3: SYMMETRY INJECTION ===
        if (intensity > 0.3) {
            this._addSymmetricalMoments(notes);
        }

        // === PHASE 4: PATTERN SMOOTHING ===
        this._smoothPatternTransitions(notes);

        // === PHASE 5: CLIMAX ENHANCEMENT ===
        this._enhanceClimaxSections(notes, difficulty);
    }

    /**
     * PERFECTED: Intelligent burst patterns based on energy
     */
    _addIntelligentBursts(notes, difficulty) {
        const burstCandidates = [];

        // Find high-energy gaps
        for (let i = 1; i < notes.length - 1; i++) {
            const interval = notes[i].time - notes[i - 1].time;
            const nextInterval = notes[i + 1].time - notes[i].time;

            // Look for gaps after high-density sections (burst opportunity)
            if (interval < 200 && nextInterval > 400) {
                burstCandidates.push({ index: i, energy: 1 / interval });
            }
        }

        // Sort by energy and add bursts to top candidates
        burstCandidates.sort((a, b) => b.energy - a.energy);
        const burstCount = Math.min(burstCandidates.length, Math.floor(notes.length * 0.1));

        for (let i = 0; i < burstCount; i++) {
            const candidate = burstCandidates[i];
            const burstPattern = this.maimaiPatterns.bursts[
                Math.floor(Math.random() * this.maimaiPatterns.bursts.length)
            ];

            const burstSize = difficulty >= 4 ? 3 : 2;
            const burstInterval = difficulty >= 4 ? 70 : 90;

            for (let b = 0; b < burstSize && b < burstPattern.length; b++) {
                notes.push({
                    time: notes[candidate.index].time + 150 + (b * burstInterval),
                    zone: burstPattern[b],
                    type: 'regular'
                });
            }
        }
    }

    /**
     * PERFECTED: Smooth pattern transitions for better flow
     */
    _smoothPatternTransitions(notes) {
        // Detect awkward transitions and smooth them
        for (let i = 2; i < notes.length; i++) {
            const prev2 = notes[i - 2].zone;
            const prev1 = notes[i - 1].zone;
            const current = notes[i].zone;

            // Detect "zigzag" patterns (0->3->0 or similar)
            const dist1 = Math.abs(prev1 - prev2);
            const dist2 = Math.abs(current - prev1);

            if (dist1 >= 3 && dist2 >= 3 && Math.random() < 0.4) {
                // Smooth it out by using adjacent zone
                const smoothZone = (prev1 + (Math.random() < 0.5 ? 1 : -1) + 6) % 6;
                notes[i].zone = smoothZone;
            }
        }
    }

    /**
     * PERFECTED: Enhance climax sections with intensity
     */
    _enhanceClimaxSections(notes, difficulty) {
        if (notes.length < 20) return;

        // Find the densest section (likely the climax)
        const windowSize = 10;
        let maxDensity = 0;
        let climaxIndex = 0;

        for (let i = 0; i < notes.length - windowSize; i++) {
            const window = notes.slice(i, i + windowSize);
            const timeSpan = window[windowSize - 1].time - window[0].time;
            const density = windowSize / (timeSpan / 1000);

            if (density > maxDensity) {
                maxDensity = density;
                climaxIndex = i;
            }
        }

        // Enhance the climax with circular flows
        if (difficulty >= 3) {
            const climaxNotes = notes.slice(climaxIndex, climaxIndex + windowSize);
            const flow = this.maimaiPatterns.circularFlows[0]; // Clockwise

            // Apply circular flow pattern to climax
            for (let i = 0; i < Math.min(climaxNotes.length, flow.length); i++) {
                if (Math.random() < 0.6) {
                    climaxNotes[i].zone = flow[i];
                }
            }
        }
    }

    /**
     * Enhance circular flow patterns
     */
    _enhanceCircularFlows(notes) {
        // Look for sequences that could be flows and enhance them
        for (let i = 0; i < notes.length - 3; i++) {
            const sequence = notes.slice(i, i + 4);
            const zones = sequence.map(n => n.zone);

            if (this._detectFlow(zones)) {
                // Make the flow smoother by adjusting timing slightly
                const avgInterval = (sequence[3].time - sequence[0].time) / 3;
                for (let j = 1; j < 4; j++) {
                    sequence[j].time = sequence[0].time + (avgInterval * j);
                }
            }
        }
    }

    /**
     * Add symmetrical moments
     */
    _addSymmetricalMoments(notes) {
        // Find opportunities to add symmetric notes
        for (let i = 0; i < notes.length - 1; i++) {
            const interval = notes[i + 1].time - notes[i].time;

            // If there's space, add a symmetric note
            if (interval > 300 && Math.random() < 0.1) {
                const symmetricZone = this._getSymmetricZone(notes[i].zone);
                notes.push({
                    time: notes[i].time + 50, // Slight delay for feel
                    zone: symmetricZone,
                    type: 'regular'
                });
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

        // === USE BUILT-IN MAIMAI KNOWLEDGE IF NO TRAINING DATA ===
        if (!hasTrainingData) {
            return this._expertMaimaiZoneAssign(prevNotes, difficulty, energyLevel);
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
            // No training data, use expert knowledge
            return this._expertMaimaiZoneAssign(prevNotes, difficulty, energyLevel);
        }

        return this._weightedRandomSelect(transitions);
    }

    /**
     * Expert maimai zone assignment (built-in knowledge, no training needed!)
     */
    _expertMaimaiZoneAssign(prevNotes, difficulty, energyLevel) {
        const lastZone = prevNotes[prevNotes.length - 1].zone;
        const patterns = this.maimaiPatterns;

        // === TRY EXPERT PATTERN MATCHING ===
        if (prevNotes.length >= 3) {
            const recentPattern = prevNotes.slice(-3).map(n => n.zone).join(',');

            // Check if this pattern exists in expert knowledge
            if (patterns.expertPatterns.has(recentPattern)) {
                // Find what commonly follows this pattern
                const nextZones = new Map();
                for (const [pattern, freq] of patterns.expertPatterns.entries()) {
                    // Look for patterns that start with our last 2 zones
                    const last2 = recentPattern.split(',').slice(1).join(',');
                    if (pattern.startsWith(last2)) {
                        const zones = pattern.split(',');
                        const nextZone = parseInt(zones[zones.length - 1]);
                        nextZones.set(nextZone, freq);
                    }
                }

                if (nextZones.size > 0 && Math.random() < 0.6) {
                    return this._weightedRandomSelect(nextZones);
                }
            }
        }

        // === TRY EXPERT ENERGY-BASED SELECTION ===
        const energyKey = `E${Math.floor(energyLevel * 10)}`;
        const energyZones = new Map();

        for (const [key, freq] of patterns.expertEnergyZones.entries()) {
            if (key.startsWith(energyKey)) {
                const zone = parseInt(key.split(':Z')[1]);
                energyZones.set(zone, freq);
            }
        }

        if (energyZones.size > 0 && Math.random() < 0.5) {
            return this._weightedRandomSelect(energyZones);
        }

        // === USE EXPERT TRANSITIONS ===
        const transitions = new Map();
        for (let targetZone = 0; targetZone < 6; targetZone++) {
            const key = `${lastZone}->${targetZone}`;
            const freq = patterns.expertTransitions.get(key) || 0;
            if (freq > 0) {
                transitions.set(targetZone, freq);
            }
        }

        if (transitions.size > 0) {
            return this._weightedRandomSelect(transitions);
        }

        // === FALLBACK: ADJACENT ZONES (maimai prefers smooth flow) ===
        const adjacent = [(lastZone + 1) % 6, (lastZone + 5) % 6];
        return adjacent[Math.floor(Math.random() * adjacent.length)];
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
     * Fast onset detection with CLASSIFICATION
     * Returns: { time, strength, type }
     */
    async detectOnsets() {
        const data = this.audioBuffer.getChannelData(0);
        const onsets = [];
        const windowSize = Math.floor(this.sampleRate * 0.02);
        const hopSize = Math.floor(windowSize / 4);

        let energyHistory = [];
        const historySize = 8;

        for (let i = 0; i < data.length - windowSize; i += hopSize) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += data[i + j] * data[i + j];
            }
            energy = Math.sqrt(energy / windowSize);

            energyHistory.push(energy);
            if (energyHistory.length > historySize) energyHistory.shift();
            if (energyHistory.length < historySize) continue;

            const avg = energyHistory.reduce((a, b) => a + b) / historySize;

            if (energy > avg * 1.35 && avg > 0.01) {
                const timeMs = (i / this.sampleRate) * 1000;
                if (onsets.length === 0 || timeMs - onsets[onsets.length - 1].time > 40) {
                    // CLASSIFY ONSET TYPE
                    const strength = energy / avg; // How strong is this onset?
                    const type = this._classifyOnset(data, i, windowSize, strength);

                    onsets.push({
                        time: timeMs,
                        strength: strength,
                        type: type // 'strong', 'medium', 'weak', 'sustained'
                    });
                }
            }
        }

        return onsets;
    }

    /**
     * Classify onset by analyzing its characteristics
     */
    _classifyOnset(data, position, windowSize, strength) {
        // Analyze attack sharpness (how sudden is the onset?)
        const attackWindow = Math.floor(windowSize * 0.1);
        let attackEnergy = 0;
        for (let i = 0; i < attackWindow; i++) {
            attackEnergy += Math.abs(data[position + i]);
        }
        const attackSharpness = attackEnergy / attackWindow;

        // Analyze sustain (does it hold or decay quickly?)
        const sustainWindow = Math.floor(windowSize * 0.5);
        let sustainEnergy = 0;
        for (let i = attackWindow; i < attackWindow + sustainWindow; i++) {
            if (position + i < data.length) {
                sustainEnergy += Math.abs(data[position + i]);
            }
        }
        const sustainLevel = sustainEnergy / sustainWindow;

        // Classification logic
        if (strength > 2.0 && attackSharpness > sustainLevel * 1.5) {
            return 'strong'; // Kick, snare, strong percussion
        } else if (strength > 1.6 && attackSharpness > sustainLevel) {
            return 'medium'; // Hi-hat, vocal syllables, moderate hits
        } else if (sustainLevel > attackSharpness * 1.2) {
            return 'sustained'; // Held notes, pads, sustained instruments
        } else {
            return 'weak'; // Background sounds, decorative elements
        }
    }

    /**
     * Beat detection
     */
    async detectBeats(bpm) {
        const beats = [];
        const interval = (60 / bpm) * 1000;
        const duration = this.duration * 1000;

        for (let t = 0; t < duration; t += interval) {
            beats.push(t);
        }

        return beats;
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
     * Fast spectral analysis (simplified)
     */
    async analyzeSpectral() {
        const data = this.audioBuffer.getChannelData(0);
        const spectral = [];
        const windowSize = 2048;
        const hopSize = 1024;

        for (let i = 0; i < data.length - windowSize; i += hopSize) {
            const timeMs = (i / this.sampleRate) * 1000;

            // Simple frequency band approximation
            const third = Math.floor(windowSize / 3);
            let low = 0, mid = 0, high = 0;

            for (let j = 0; j < third; j++) {
                low += Math.abs(data[i + j]);
            }
            for (let j = third; j < third * 2; j++) {
                mid += Math.abs(data[i + j]);
            }
            for (let j = third * 2; j < windowSize; j++) {
                high += Math.abs(data[i + j]);
            }

            spectral.push({
                time: timeMs,
                low: low / third,
                mid: mid / third,
                high: high / third
            });
        }

        return spectral;
    }

    /**
     * Energy analysis
     */
    async analyzeEnergy() {
        const data = this.audioBuffer.getChannelData(0);
        const energy = [];
        const windowSize = Math.floor(this.sampleRate * 0.05);
        const hopSize = Math.floor(windowSize / 2);

        for (let i = 0; i < data.length - windowSize; i += hopSize) {
            let e = 0;
            for (let j = 0; j < windowSize; j++) {
                e += data[i + j] * data[i + j];
            }
            energy.push({
                time: (i / this.sampleRate) * 1000,
                energy: Math.sqrt(e / windowSize)
            });
        }

        return energy;
    }

    /**
     * Smart combination - Prioritize onsets by TYPE and strength
     */
    smartCombine(onsets, beats, energyData, offset) {
        const combined = new Map();

        // PRIORITY 1: Classified Onsets - Weight by importance
        onsets.forEach(onset => {
            const time = onset.time || onset; // Handle both old and new format
            const energy = this.getEnergyAt(time, energyData);

            // Weight by onset type
            let weight = energy;
            if (onset.type) {
                switch (onset.type) {
                    case 'strong':
                        weight = energy * 1.5; // Strong hits are VERY important
                        break;
                    case 'medium':
                        weight = energy * 1.0; // Normal importance
                        break;
                    case 'sustained':
                        weight = energy * 0.7; // Less important, might skip
                        break;
                    case 'weak':
                        weight = energy * 0.4; // Background sounds, often skip
                        break;
                }
            }

            combined.set(Math.round(time + offset), weight);
        });

        // PRIORITY 2: Beats (BPM-based) - BACKUP ONLY
        beats.forEach(time => {
            const t = Math.round(time + offset);
            if (!combined.has(t)) {
                const energy = this.getEnergyAt(time, energyData);
                combined.set(t, energy * 0.3); // 30% weight for beats
            }
        });

        return Array.from(combined.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([time, weight]) => ({ time, weight }));
    }

    /**
     * Get energy at time
     */
    getEnergyAt(time, energyData) {
        if (!energyData || energyData.length === 0) return 0.5;
        const closest = energyData.reduce((prev, curr) =>
            Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev
        );
        return closest.energy;
    }

    /**
     * PERFECTED: Smart filtering with adaptive difficulty and musical intelligence
     */
    smartFilter(candidates, difficulty, minInterval, energyData) {
        // Enhanced density curves per difficulty - INCREASED for more notes
        const densityBase = [0.35, 0.55, 0.75, 0.85, 0.95][difficulty - 1] || 0.65;
        const filtered = [];
        let lastTime = -minInterval;
        let recentNotes = []; // Track recent notes for spam prevention

        const avgEnergy = energyData.reduce((sum, d) => sum + d.energy, 0) / energyData.length;
        const maxEnergy = Math.max(...energyData.map(d => d.energy));

        // === ADAPTIVE DENSITY BASED ON SONG STRUCTURE ===
        const songDuration = this.duration * 1000;

        for (const { time, weight } of candidates) {
            const energyFactor = weight / avgEnergy;
            const normalizedEnergy = weight / maxEnergy;

            // === DYNAMIC INTERVAL ADJUSTMENT ===
            // Faster notes at high energy, slower at low energy
            const energyMultiplier = 1.5 - (normalizedEnergy * 0.5);
            const difficultyMultiplier = 2 - (difficulty * 0.2);
            const dynamicInterval = minInterval * difficultyMultiplier * energyMultiplier;

            if (time - lastTime < dynamicInterval) continue;

            // === SPAM PREVENTION: Check recent note density ===
            // Remove notes older than 1 second from tracking
            recentNotes = recentNotes.filter(t => time - t < 1000);

            // Maximum notes per second based on difficulty
            const maxNotesPerSecond = [4, 6, 8, 10, 12][difficulty - 1] || 8;

            // If we already have too many notes in the last second, skip this one
            if (recentNotes.length >= maxNotesPerSecond) {
                // Only allow if this is a VERY strong onset (to preserve important beats)
                if (normalizedEnergy < 0.8) {
                    continue;
                }
            }

            // === ADAPTIVE DENSITY BY SONG POSITION ===
            const songProgress = time / songDuration;
            let densityModifier = 1.0;

            // Intro (0-15%): Reduce density
            if (songProgress < 0.15) {
                densityModifier = 0.7;
            }
            // Build-up (15-30%): Gradually increase
            else if (songProgress < 0.30) {
                densityModifier = 0.7 + ((songProgress - 0.15) / 0.15) * 0.3;
            }
            // Main section (30-80%): Full density
            else if (songProgress < 0.80) {
                densityModifier = 1.0 + (normalizedEnergy * 0.2); // Boost at high energy
            }
            // Outro (80-100%): Gradually reduce
            else {
                densityModifier = 1.0 - ((songProgress - 0.80) / 0.20) * 0.3;
            }

            // === INTELLIGENT PLACEMENT CHANCE ===
            const baseDensity = densityBase * densityModifier;
            const energyBoost = normalizedEnergy * 0.4; // High energy = more notes
            const weightBoost = (weight / avgEnergy) * 0.3; // Strong onsets = more likely

            const finalChance = Math.min(0.95, baseDensity + energyBoost + weightBoost);

            if (Math.random() < finalChance) {
                filtered.push(time);
                recentNotes.push(time); // Track this note
                lastTime = time;
            }
        }

        // === POST-FILTER: ENSURE MINIMUM NOTE COUNT ===
        // UPDATED multipliers to match new difficulty targets
        const noteMultipliers = {
            1: 1.5,  // EASY
            2: 2.5,  // NORMAL
            3: 4.0,  // HARD
            4: 6.0,  // EXPERT
            5: 8.5   // MASTER
        };
        const multiplier = noteMultipliers[difficulty] || 4.0;
        const minNotes = Math.floor((songDuration / 1000) * multiplier);

        if (filtered.length < minNotes) {
            // Add more notes from high-weight candidates
            const remaining = candidates
                .filter(c => !filtered.includes(c.time))
                .sort((a, b) => b.weight - a.weight)
                .slice(0, minNotes - filtered.length);

            filtered.push(...remaining.map(c => c.time));
            filtered.sort((a, b) => a - b);
        }

        return filtered;
    }

    /**
     * Smart zone assignment
     */
    smartZoneAssign(time, spectralData, prevNotes, difficulty) {
        if (!spectralData) {
            return this.patternZone(prevNotes, difficulty);
        }

        const frame = spectralData.reduce((prev, curr) =>
            Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev
        );

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
            maimaiStyle: options.maimaiStyle !== false,
            maimaiIntensity: options.maimaiIntensity || 0.7
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
