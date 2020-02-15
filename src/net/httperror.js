(function() {

    'use strict';

    class HttpError extends Error {

        constructor(...args) {
            super(...args);
            this.code = 'ERR_HTTP_CONN';
            this.status = 0;
        }

        withStatus(httpStatus) {
            this.status = httpStatus;
            return this;
        }

    }

    module.exports = HttpError;

})();
