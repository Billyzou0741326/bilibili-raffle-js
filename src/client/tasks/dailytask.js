(function() {

    'use strict';

    /**
     * Daily task has no bounds
     */
    class DailyTask {

        constructor() {
            this.callback = null;
        }

        registerCallback(callback) {
            this.callback = callback;
            return this;
        }

        execute(...args) {
            return this.callback && this.callback(...args);
        }

        registered() {
            return !(this.callback === null);
        }

        json() {
            return {
                'type': 'daily',
                'status': (this.registered() ? 1 : 0),
                'timeperiod': null,
            };
        }

    }

    module.exports = DailyTask;

})();
