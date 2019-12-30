(function() {

    'use strict';

    const EventEmitter = require('events').EventEmitter;

    class Notifier extends EventEmitter {

        constructor() {
            super();

            this.tasks = {
                'liveHeart': null,
                'midnight': null,
            };
            this.day = new Date().getDay();
        }

        run() {
            if (this.tasks['liveHeart'] === null) {
                this.tasks['liveHeart'] = setInterval(() => {
                    this.emit('liveHeart');
                }, 1000 * 60 * 5);
            }
            if (this.tasks['midnight'] === null) {
                this.tasks['midnight'] = setInterval(() => {
                    const day = new Date().getDay();
                    if (this.day !== day) {
                        this.emit('midnight');
                        this.day = day;
                    }
                }, 1000 * 60 * 60);
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
