(function() {

    'use strict';

    const DailyTask = require('./dailytask.js');
    const TimePeriod = require('./timeperiod.js');

    class ScheduledTask extends DailyTask {

        constructor() {
            super();
            this.timeperiod = [];
        }

        updateTimePeriod(...timeperiod) {
            if (Array.isArray(timeperiod))
                this.timeperiod = timeperiod.filter(t => (t && (t instanceof TimePeriod)));
            return this;
        }

        execute(...args) {
            if (this.inBound()) {
                return super.execute(...args);
            }
        }

        inBound() {
            let result = false;
            if (this.timeperiod.length > 0)
                result = this.timeperiod.some(timeperiod => timeperiod.inBound());
            return result;
        }

        json() {
            let result = super.json();
            result['type'] = 'scheduled';
            result['timeperiod'] = this.timeperiod.map(tp => tp.json());
            return result;
        }
    }

    module.exports = ScheduledTask;

})();
