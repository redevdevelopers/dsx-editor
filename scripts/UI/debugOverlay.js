/**
 * @file A simple debug overlay to display real-time stats for the editor.
 */
export class DebugOverlay {
    constructor() {
        this.isVisible = false;
        this.fps = 0;
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.maxLogEntries = 50;

        this._el = document.createElement('div');
        this._el.id = 'debug-overlay';
        this._el.innerHTML = `
            <div class="debug-header">DEBUG OVERLAY</div>
            <div class="debug-content">
                <div id="debug-fps">FPS: ...</div>
                <div id="debug-input">Input: ...</div>
                <div class="debug-events-container">
                    <div>Events:</div>
                    <ul id="debug-events"></ul>
                </div>
                <div class="debug-errors-container">
                    <div>Errors:</div>
                    <ul id="debug-errors"></ul>
                </div>
            </div>
        `;
        document.body.appendChild(this._el);

        this.fpsEl = this._el.querySelector('#debug-fps');
        this.inputEl = this._el.querySelector('#debug-input');
        this.eventsEl = this._el.querySelector('#debug-events');
        this.errorsEl = this._el.querySelector('#debug-errors');

        this.hide(); // Initially hidden

        this.update = this.update.bind(this);
        this.logError = this.logError.bind(this);
        this.logEvent = this.logEvent.bind(this);

        this.update();
    }

    show() {
        this._el.style.display = 'block';
        this.isVisible = true;
    }

    hide() {
        this._el.style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    logEvent(message) {
        if (!this.isVisible) return;

        const li = document.createElement('li');
        const timestamp = new Date().toLocaleTimeString();
        li.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${message}`;

        this.eventsEl.prepend(li);

        if (this.eventsEl.children.length > this.maxLogEntries) {
            this.eventsEl.removeChild(this.eventsEl.lastChild);
        }
    }

    logError(message, source, lineno, colno, error) {
        const li = document.createElement('li');
        li.textContent = `${message} (${source.split('/').pop()}:${lineno})`;
        this.errorsEl.appendChild(li);
    }

    update() {
        const now = performance.now();
        this.frameCount++;

        if (now - this.lastFrameTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = now;
            if (this.isVisible) {
                this.fpsEl.textContent = `FPS: ${this.fps}`;
            }
        }

        if (this.isVisible) {
            if (window.__dsx && window.__dsx.input) {
                const inputState = window.__dsx.input.getDebugState ? window.__dsx.input.getDebugState() : 'getDebugState not implemented';
                this.inputEl.textContent = `Input: ${inputState}`;
            }
        }

        requestAnimationFrame(this.update);
    }
}