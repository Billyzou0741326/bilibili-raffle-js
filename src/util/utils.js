(function() {

    'use strict';

    const sleep = (time) => {
        time = time > 0 ? time : 0;
        return new Promise(resolve => setTimeout(resolve, time));
    };

    module.exports = {
        sleep,
    };

})();
