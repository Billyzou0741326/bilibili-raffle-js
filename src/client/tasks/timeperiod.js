(function() {

    'use strict';

    const Clock = require('./clock.js');

    const oneDay = 1000 * 60 * 60 * 24;

    class TimePeriod {

        /**
         * @params  from    Clock   Beginning
         * @params  to      Clock   End
         */
        constructor(from, to) {
            this.start = this.end = null;

            if (from) {
                this.start = from % oneDay;
            }

            if (to) {
                this.end = to % oneDay;
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
                const offset = new Date().getTimezoneOffset();
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

    (function test() {
        'use strict';

        const start = new Clock(+new Clock() + 1000*60*60*24);
        start.setHours(1);
        const end = new Clock();
        end.setHours(0);

        const now = new Clock();

        const timeframe = new TimePeriod(start, end);

        console.log(timeframe.start);
        console.log(timeframe.end);
        console.log(timeframe.inBound(now));

    });

    module.exports = TimePeriod;

})();
