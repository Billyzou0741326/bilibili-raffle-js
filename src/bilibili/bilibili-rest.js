(function() {

    'use strict';

    const colors = require('colors/safe');

    // ------------------------------- Includes -------------------------------
    const http = require('http');
    const https = require('https');
    const crypto = require('crypto');
    const querystring = require('querystring');
    const cprint = require('../util/printer.js');
    const { 
        appCommon,
        appSecret,
        appHeaders,
        webHeaders, } = require('../global/config.js');
    const RateLimiter = require('../task/ratelimiter.js');
    const Xhr = require('../net/xhr.js');
    const RequestBuilder = require('../net/request.js');


    /** Emits requests to the bilibili API */
    class BilibiliRest {

        /**
         * Send request, gets json as response
         * 发送请求，获取json返回
         * 
         * @param   {Request}   req - Request details
         * @returns {Promise}   resolve(JSON)   reject(Error)
         */
        static request(req) {

            const acceptedCode = [ 200 ];
            const noRetryCode = [ 412 ];

            const requestUntilDone = async () => {

                let success = false;
                let tries = 3;
                let result = null;
                let err = null;

                while (success === false && tries > 0) {
                    try {
                        const response = await xhr.request(req);
                        const statusCode = response.status_code;
                        const statusMsg = response.status_message;

                        if (acceptedCode.includes(statusCode)) {
                            result = response.json();
                            err = null;
                            success = true;
                        } else if (noRetryCode.includes(statusCode)) {
                            result = response;
                            err = new Error(`Http status ${statusCode}: ${statusMessage}`);
                            tries = 0;
                        } else {
                            err = new Error(`Http status ${statusCode}: ${statusMessage}`);
                            --tries;
                        }
                    } catch (error) {
                        err = error;
                        cprint(`\n${error.stack}`, colors.red);
                    }
                }

                if (err) {
                    throw err;
                } else {
                    return result;
                }
            };

            return requestUntilDone();
        }

        /** app端获取房间内抽奖信息 */
        static appGetRaffleInRoom(roomid) {
            const params = {};
            Object.assign(params, appCommon);
            params['roomid'] = roomid;
            params['ts'] = Number.parseInt(0.001 * new Date());

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/lottery-interface/v1/lottery/getLotteryInfo')
                .withMethod('GET')
                .withHeaders(appHeaders)
                .withParams(params)
                .build()
            );

            return BilibiliRest.request(request);
        }

        /** Check for lottery in room ``roomid``
         *
         */
        static getRaffleInRoom(roomid) {
            const params = { 'roomid': roomid, };
            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/lottery-interface/v1/lottery/Check')
                .withMethod('GET')
                .withHeaders(webHeaders)
                .withParams(params)
                .build()
            );

            return BilibiliRest.request(request);
        }

        /** 查取视频cid */
        static getVideoCid(aid) {
            const jsonp = 'jsonp';
            const params = { 
                aid,
                jsonp,
            };
            const request = (RequestBuilder.start()
                .withHost('api.bilibili.com')
                .withPath('/x/player/pagelist')
                .withMethod('GET')
                .withHeaders(webHeaders)
                .withParams(params)
                .build()
            );

            return Bilibili.request(request);
        }

        static appSign(string) {
            return crypto.createHash('md5').update(string+appSecret).digest('hex');
        }

        static parseAppParams(params) {
            const pre_paramstr = BilibiliRest.formatForm(params);
            const sign = BilibiliRest.appSign(pre_paramstr);
            const paramstr = `${pre_paramstr}&sign=${sign}`;
            return paramstr;
        }

        static formatCookies(cookies) {
            const options = {
                'encodeURIComponent': querystring.unescape,
            };
            const formattedCookies = querystring.stringify(cookies, '; ', '=', options);
            return formattedCookies;
        }

        static formatForm(form) {
            const formattedForm = querystring.stringify(form, '&', '=');
            return formattedForm;
        }
    }


    module.exports = BilibiliRest;


    /**
     * Sort the properties according to alphabetical order
     */
    const sort = (object) => {
        const sorted = Object.create(null);
        Object.keys(object).sort().forEach(key => {
            sorted[key] = object[key];
        });
        return sorted;
    };

    const xhr = new Xhr();
    xhr.withRateLimiter(new RateLimiter(50, 1000));

    const decodeCookies = (cookiestr) => {
        if (typeof cookiestr === 'undefinded') return {};
        const decodedCookies = querystring.parse(cookiestr, '; ', '=');
        delete decodedCookies['Domain'];
        delete decodedCookies['Expires'];
        delete decodedCookies['Path'];
        return decodedCookies;
    };

    const extractCookies = (response) => {
        const setCookies = {};
        const cookies = response.headers['set-cookie'];
        if (cookies) {
            cookies.forEach(cookiestr => {
                const c = decodeCookies(cookiestr);
                Object.assign(setCookies, c);
            });
        }
        return setCookies;
    };

})();

