(function() {

    'use strict';

    const Clock = require('./clock.js');

    const oneDay = 1000 * 60 * 60 * 24;
    const chinaTimeMinutesOffset = 60 * 8; // China Standard Time is UTC+8

    class TimePeriod {

        /**
         * @params  from    { hours: number, minutes: number }   Beginning
         * @params  to      { hours: number, minutes: number }   End
         */
        constructor(from, to) {
            this.start = this.end = null;

            if (from) {
                this.start = (from.hours * 60 + from.minutes - chinaTimeMinutesOffset) * 60 * 1000;
                if (this.start < 0) {
                    this.start += oneDay;
                }
            }

            if (to) {
                this.end = (to.hours * 60 + to.minutes - chinaTimeMinutesOffset) * 60 * 1000;
                if (this.end < 0) {
                    this.end += oneDay;
                }
            }

            Object.freeze(this);
        }

        inBound(time) {
            let result = true;

            if (!time) time = new Clock();

            if (this.start !== null && this.end !== null) {
                // Ex. 17:00 - 5:00     (18:00 - true)
                const start = this.start;
                const end = this.end;
                const t = time % oneDay;
                if (start < end)
                    result = (start <= t && t < end);
                else 
                    result = (start <= t || t < end);
            }
            return result;
        }

        json() {
            let tp = null;
            if (this.start !== null && this.end !== null) {
                const from = new Date(this.start);
                const from_hours = from.getHours();
                const from_minutes = from.getMinutes();
                const to = new Date(this.end);
                const to_hours = to.getHours();
                const to_minutes = to.getMinutes();
                tp = {
                    'from': {
                        'hours': from_hours,
                        'minutes': from_minutes,
                    },
                    'to': {
                        'hours': to_hours,
                        'minutes': to_minutes,
                    }
                };
            }
            return tp;
        }

    }

    module.exports = TimePeriod;

})();
