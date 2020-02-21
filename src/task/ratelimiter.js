(function() {

    'use strict';

    const colors = require('colors/safe');
    const Queue = require('../container/queue.js');
    const { cprint } = require('../util/printer.js');
    const { DelayedTask } = require('./task.js');

    class RateLimiter {

        constructor(count, milliseconds) {
            milliseconds = milliseconds || 0;
            this._interval = 1000;
            this._limit = Infinity;
            this._dispatched = 0;
            this._refreshTask = new DelayedTask();
            this._refreshTask.withTime(this._interval).withCallback(() => {
                this._dispatched = 0;
                this.dispatch();
                if (this._queue.length > 0) {
                    this._refreshTask.start();
                }
            });
            this._running = false;
            this._queue = new Queue();

            if (Number.isInteger(count)) {
                count = count > 0 ? count : 0;
                if (Number.isInteger(milliseconds) === false) {
                    milliseconds = this._interval;
                }
                milliseconds = milliseconds > 0 ? milliseconds : 1;
                const rate = this._interval / milliseconds;
                this._limit = Math.round(rate * count);
            }
        }

        add(task) {
            this._queue.push(task);
            this._refreshTask.start();
            this.dispatch();
        }

        dispatch() {
            while (this._dispatched < this._limit && this._queue.length > 0) {
                const task = this._queue.pop();
                try {
                    task && task();
                }
                catch (error) {
                    // TODO: turn this into EventEmitter and emit error?
                    cprint(`(RateLimiter) - ${error.message}`, colors.red);
                }
                ++this._dispatched;
            }
        }

        start() {
            if (this._running === false) {
                this._running = true;
                this._refreshTask.start();
                this.dispatch();
            }
        }

        stop() {
            if (this._running === true) {
                this._refreshTask.stop();
                this._running = false;
            }
        }
    }

    module.exports = RateLimiter;

})();
