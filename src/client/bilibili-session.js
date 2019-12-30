(function() {
    
    'use strict';

    const querystring = require('querystring');

    class AccountSession {

        static parse(colonSeparated) {
            return querystring.parse(colonSeparated, '; ', '=');
        }

        static stringify(jsonObject) {
            return querystring.stringify(jsonObject, '; ', '=');
        }

        /**
         * @params  options     Object
         *          app         Object
         *          web         Object
         */
        constructor(options) {
            this.app = {
                'access_token': '',
                'refresh_token': '',
            };
            this.web = {
                'bili_jct': '',
                'DedeUserID': '',
                'DedeUserID__ckMd5': '',
                'sid': '',
                'SESSDATA': '',
            };
            if (options) {
                const { web, app } = options;
                if (web) {
                    Object.assign(this.web, web);
                }
                if (app) {
                    Object.assign(this.app, app);
                }
            }
            this.webCookies = '';
        }

        json() {
            const app = this.app;
            const web = this.web;
            return { app, web };
        }

        isComplete() {
            return !!(
                this.web['bili_jct']
                && this.web['DedeUserID']
                && this.web['DedeUserID__ckMd5']
                && this.web['sid']
                && this.web['SESSDATA']
                && this.app['access_token']
                && this.app['refresh_token']);
        }

    }

    module.exports = AccountSession;

})();
