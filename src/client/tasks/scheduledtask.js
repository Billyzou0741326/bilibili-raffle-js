(function() {

    'use strict';

    const DailyTask = require('./dailytask.js');

    class ScheduledTask extends DailyTask {

        constructor() {
            super();
            this.weeklySchedule = null;
        }

        updateTimePeriod(weeklySchedule) {
            this.weeklySchedule = weeklySchedule;
        }

        execute(...args) {
            if (this.inBound()) {
                return super.execute(...args);
            }
        }

        inBound() {
            let result = false;
            if (this.weeklySchedule) {
                result = this.weeklySchedule.inBound();
            }
            return result;
        }

        json() {
            let result = super.json();
            result.type = 'scheduled';
            result.timeperiod = this.weeklySchedule.json();
            return result;
        }
    }

    module.exports = ScheduledTask;

})();
