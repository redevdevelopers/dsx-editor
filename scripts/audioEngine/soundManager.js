// Sound effects manager
export class SoundManager {
    constructor() {
        this.sounds = {};
        this.initialized = false;
        this.context = null;
        this.loopingSources = {};
        this.playingSources = {};
    }

    async init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();

            // Attempt to resume AudioContext if it's suspended (common in browsers)
            if (this.context.state === 'suspended') {
                await this.context.resume().catch(e => { });
            }

            // Create gain nodes for master/effects/music routing
            this.masterGain = this.context.createGain();
            this.effectsGain = this.context.createGain();
            this.musicGain = this.context.createGain();

            // default volumes
            this._volumes = {
                master: 1.0,
                effects: 1.0,
                music: 0.5
            };

            // Connect gain chain: effects/music -> master -> destination
            this.effectsGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.context.destination);
            this.masterGain.gain.setValueAtTime(this._volumes.master, this.context.currentTime);
            this.effectsGain.gain.setValueAtTime(this._volumes.effects, this.context.currentTime);
            this.musicGain.gain.setValueAtTime(this._volumes.music, this.context.currentTime);

            // Load all sound effects
            const sfxList = {
                start: 'assets/misc/SystemSFX/enqueue.wav',
                button: 'assets/misc/SystemSFX/button.wav',
                toggle: 'assets/misc/SystemSFX/toggle.wav',
                criticalPerfect: 'assets/misc/JudgementsSFX/DSX_GAME_PERFECT.wav',
                perfect: 'assets/misc/JudgementsSFX/DSX_GAME_PERFECT.wav',
                great: 'assets/misc/JudgementsSFX/DSX_GAME_GREAT.wav',
                good: 'assets/misc/JudgementsSFX/DSX_GAME_GOOD.wav',

                'nav': 'assets/misc/SystemSFX/DSX_NAV.wav',
                'dsx-nav-enter': 'assets/misc/SystemSFX/DSX_NAVENTER.wav',
                'start_game': 'assets/misc/SystemSFX/Start.wav',
                'clear_all_perfect_plus': 'assets/misc/VoiceSFX/FullCombo.wav',
                'clear_all_perfect': 'assets/misc/VoiceSFX/FullCombo.wav',
                'clear_full_combo_plus': 'assets/misc/VoiceSFX/FullCombo.wav',
                'clear_full_combo': 'assets/misc/VoiceSFX/FullCombo.wav',
                'clear_clear': 'assets/misc/VoiceSFX/FullCombo.wav',
                'clear_failed': 'assets/misc/VoiceSFX/Lose.wav',
                'result_jingle': 'assets/misc/SystemSFX/DSX_RESULT_SPECIAL.wav',
                'door_close': 'assets/misc/SystemSFX/SE_KALEID_DOOR_2_.wav'
            };

            // Load all sounds in parallel
            const loadPromises = Object.entries(sfxList).map(async ([name, path]) => {
                try {
                    const response = await fetch(path);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
                    this.sounds[name] = audioBuffer;
                } catch (e) {
                }
            });

            await Promise.all(loadPromises);
            this.initialized = true;
        } catch (e) {
        }
    }

    async play(name, options = {}) {
        if (!this.sounds[name]) {
            // Try to initialize if not ready
            try {
                await this.init();
                if (!this.sounds[name]) {
                    return;
                }
            } catch (e) {
                return;
            }
        }
        try {
            if (this.context.state === 'suspended') {
                await this.context.resume().catch(e => { });
            }

            if (this.context.state !== 'running') {
                return;
            }

            const source = this.context.createBufferSource();
            const gain = this.context.createGain();

            source.buffer = this.sounds[name];

            // Per-sound gain should only apply the optional per-sound volume.
            // Global volumes (effects/master) are handled by the gain nodes chain.
            const optionVol = typeof options.volume === 'number' ? options.volume : 1.0;
            gain.gain.value = optionVol;

            source.connect(gain);
            // route sound effects through effectsGain (if available) so global changes apply
            if (this.effectsGain) {
                gain.connect(this.effectsGain);
            }
            else {
                gain.connect(this.context.destination);
            }

            source.start(0);
            this.playingSources[name] = source;
            source.onended = () => {
                delete this.playingSources[name];
            };
        } catch (e) {
        }
    }

    async playLoop(name, options = {}) {
        if (!this.initialized || !this.sounds[name]) {
            try {
                await this.init();
            } catch (e) {
                return;
            }
        }

        if (this.loopingSources[name]) {
            this.loopingSources[name].stop();
        }

        try {
            if (this.context.state === 'suspended') {
                await this.context.resume();
            }

            const source = this.context.createBufferSource();
            const gain = this.context.createGain();

            source.buffer = this.sounds[name];
            source.loop = true;

            const optionVol = typeof options.volume === 'number' ? options.volume : 1.0;
            gain.gain.value = optionVol;

            source.connect(gain);
            if (this.musicGain) {
                gain.connect(this.musicGain);
            } else {
                gain.connect(this.context.destination);
            }

            source.start(0);
            this.loopingSources[name] = source;
        } catch (e) {
        }
    }

    stopLoop(name) {
        if (this.loopingSources[name]) {
            this.loopingSources[name].stop();
            delete this.loopingSources[name];
        }
    }

    stop(name) {
        if (this.playingSources[name]) {
            this.playingSources[name].stop();
            delete this.playingSources[name];
        }
    }

    // Volume control APIs used by the UI
    setMasterVolume(value) {
        value = Math.max(0, Math.min(1, value));
        this._volumes.master = value;
        if (this.masterGain) this.masterGain.gain.setValueAtTime(value, this.context.currentTime);
    }

    setEffectsVolume(value) {
        value = Math.max(0, Math.min(1, value));
        this._volumes.effects = value;
        if (this.effectsGain) this.effectsGain.gain.setValueAtTime(value, this.context.currentTime);
    }

    setMusicVolume(value) {
        value = Math.max(0, Math.min(1, value));
        this._volumes.music = value;
        if (this.musicGain) this.musicGain.gain.setValueAtTime(value, this.context.currentTime);
    }
}

// Create singleton instance
export const soundManager = new SoundManager();