(function() {

    'use strict';

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
            // Convert date to Beijing Time
            const chinaTime = new Date(...args).toLocaleString("en-US", {timeZone: "Asia/Shanghai"});
            super(chinaTime);
        }

    }

    module.exports = Clock;


})();
