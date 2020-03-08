(function() {

    'use strict';

    const chinaTimeMinutesOffset = 60 * 8; // China Standard Time is UTC+8

    class Clock extends Date {

        static today() {
            const today = new Clock();
            today.setHours(0);
            today.setMinutes(0);
            today.setSeconds(0);
            today.setMilliseconds(0);
            return today;
        }

        constructor(...args) {
            super(...args);
        }

        getDayInChina() {
            // Return weekday in China Standard Time
            return new Date(this.valueOf() + (this.getTimezoneOffset() + chinaTimeMinutesOffset) * 60 * 1000).getDay();
        }

    }

    module.exports = Clock;


})();
