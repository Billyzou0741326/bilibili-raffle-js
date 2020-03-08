(function() {

    'use strict';

    const Clock = require('./clock.js');
    const TimePeriod = require('./timeperiod.js');

    const chinaTimeMinutesOffset = 60 * 8; // China Standard Time is UTC+8

    class WeeklySchedule {

        constructor(periods) {
            const midnight = { hours: 0, minutes: 0 };
            this.originalPeriods = periods;
            this.timePeriods = [ [], [], [], [], [], [], [] ];
            periods.forEach(period => {
                let currentDayTimePeriod = null;
                let nextDayTimePeriod = null;
                if (period.from.hours < period.to.hours || (period.from.hours === period.to.hours && period.from.minutes <= period.to.minutes)) {
                    currentDayTimePeriod = new TimePeriod(period.from, period.to);
                } else {
                    currentDayTimePeriod = new TimePeriod(period.from, midnight);
                    nextDayTimePeriod = new TimePeriod(midnight, period.to);
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
            return this.timePeriods[new Clock().getDayInChina()].some(timeperiod => timeperiod.inBound());
        }

        json() {
            return this.originalPeriods;
        }
    }

    module.exports = WeeklySchedule;

})();
