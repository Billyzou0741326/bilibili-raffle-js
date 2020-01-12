(function() {

    'use strict';

    const Clock = require('./clock.js');
    const TimePeriod = require('./timeperiod.js');

    class WeeklySchedule {

        constructor(periods) {
            const midnight = Clock.today();
            this.originalPeriods = periods;
            this.timePeriods = [ [], [], [], [], [], [], [] ];
            periods.forEach(period => {
                const fromTime = new Clock();
                const toTime = new Clock();
                fromTime.setHours(period.from.hours, period.from.minutes, 0, 0);
                toTime.setHours(period.to.hours, period.to.minutes, 0, 0);

                let currentDayTimePeriod = null;
                let nextDayTimePeriod = null;
                if (fromTime <= toTime) {
                    currentDayTimePeriod = new TimePeriod(fromTime, toTime);
                } else {
                    currentDayTimePeriod = new TimePeriod(fromTime, midnight);
                    nextDayTimePeriod = new TimePeriod(midnight, toTime);
                }

                (period.weekdays || '0-6').split(',').forEach(dayRange => {
                    let current = 0;
                    let end = 0;
                    if (dayRange.includes('-')) {
                        let days = dayRange.split('-');
                        current = parseInt(days[0]);
                        end = parseInt(days[1]);
                    } else {
                        current = parseInt(dayRange);
                        end = current;
                    }

                    while (current <= end) {
                        this.timePeriods[current++].push(currentDayTimePeriod);
                        if (nextDayTimePeriod != null) {
                            this.timePeriods[current == 7 ? 0 : current].push(nextDayTimePeriod);
                        }
                    }
                });
            });
        }

        inBound(time) {
            return this.timePeriods[new Clock().getDay()].some(timeperiod => timeperiod.inBound());
        }

        json() {
            return this.originalPeriods;
        }
    }

    module.exports = WeeklySchedule;

})();
