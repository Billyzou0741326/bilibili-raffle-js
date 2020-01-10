(function() {

    'use strict';

    class HttpError extends Error {

        constructor(...args) {
            super(...args);
            this.code = 'ERR_HTTP_CONN';
        }

    }

    module.exports = HttpError;

})();
