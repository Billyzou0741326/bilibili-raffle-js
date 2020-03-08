(function() {

    'use strict';

    const Clock = require('./tasks/clock.js');
    const EventEmitter = require('events').EventEmitter;

    class Notifier extends EventEmitter {

        constructor(options) {
            super();

            this.tasks = {
                'liveHeart': null,
                'midnight': null,
            };
            this.day = new Clock().getDayInChina();
            this.heartbeatInterval = 1000 * 60 * 5; // By default, send heartbeat every 5 minutes.
            this.midnightCheckInterval = 1000 * 60 * 60; // By default, check for midnight every 60 minutes.

            if (options) {
                if (options.hasOwnProperty('heartbeatInterval')) {
                    this.heartbeatInterval = options.heartbeatInterval * 1000 * 60; // heartbeatInterval is in minutes
                }
                if (options.hasOwnProperty('midnightCheckInterval')) {
                    this.midnightCheckInterval = options.midnightCheckInterval * 1000 * 60; // midnightCheckInterval is in minutes
                }
            }
        }

        run() {
            if (this.tasks['liveHeart'] === null) {
                this.tasks['liveHeart'] = setInterval(() => {
                    this.emit('liveHeart');
                }, this.heartbeatInterval);
            }
            if (this.tasks['midnight'] === null) {
                this.tasks['midnight'] = setInterval(() => {
                    const day = new Clock().getDayInChina();
                    if (this.day !== day) {
                        this.emit('midnight');
                        this.day = day;
                    }
                }, this.midnightCheckInterval);
            }
        }

        stop() {
            Object.keys(this.tasks).forEach(taskname => {
                if (this.tasks[taskname] !== null) {
                    clearInterval(this.tasks[taskname]);
                    this.tasks[taskname] = null;
                }
            });
        }

    }

    module.exports = Notifier;

})();
