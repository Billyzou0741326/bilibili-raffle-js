(function() {

    'use strict';

    class AbstractTask {

        constructor() {
            this._time = 0;
            this._callback = () => {};
        }

        start() {}

        stop() {}

        get running() { return false }

        get time() {
            return this._time;
        }

        withCallback(callback, ...args) {
            this._callback = callback;
            this._args = args;
            return this;
        }

        withTime(ms) {
            ms = ms > 0 ? ms : 0;
            this._time = ms;
            return this;
        }
    }

    class RecurrentTask extends AbstractTask {

        constructor() {
            super();
            this._stopper = null;
        }

        get running() {
            return this._stopper !== null;
        }

        start() {
            if (this._stopper === null) {
                this._stopper = setInterval(this._callback, this.time, ...this._args);
            }
        }

        stop() {
            if (this._stopper !== null) {
                clearInterval(this._stopper);
                this._stopper = null;
            }
        }
    }

    class DelayedTask extends AbstractTask {

        constructor() {
            super();
            this._stopper = null;
        }

        get running() {
            return this._stopper !== null;
        }

        start() {
            if (this._stopper === null) {
                this._stopper = setTimeout(() => {
                    this._stopper = null;
                    this._callback(...this._args);
                }, this.time);
            }
        }

        stop() {
            if (this._stopper !== null) {
                clearTimeout(this._stopper);
                this._stopper = null;
            }
        }
    }

    module.exports = {
        DelayedTask,
        RecurrentTask,
    };

})();
