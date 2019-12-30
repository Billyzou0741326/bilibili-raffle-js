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

    const httpsAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 256,
        };
        return new https.Agent(options);
    })();

    const httpAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 256,
        };
        return new http.Agent(options);
    })();


    /** Emits requests to the bilibili API */
    class BilibiliRest {

        /**
         * Send request, gets json as response
         * 发送请求，获取json返回
         * 
         * @params  options    request details
         * @params  useHttps   true: https   false: http
         * @returns promise -> json / error
         */
        static request(options, settings) {

            let tries = 3;
            let xhr = http;
            let agent = httpAgent;
            let useHttps = false;
            let data = '';
            let setCookies = settings;
            if (settings) {
                useHttps = settings.useHttps;
                data = settings.data || '';
                setCookies = settings.setCookies;
            }

            if (useHttps === true) {
                xhr = https;
                agent = httpsAgent;
            }
            options['agent'] = options['agent'] || agent;

            const doRequest = async () => {
                for (let i = 0; i < tries; ++i) {
                    try {
                        let result = await newRequest();
                        return result;
                    } catch (error) {
                        cprint(`${error}`, colors.red);
                        cprint(`[ 修正 ${i} ]: 重现request`, colors.green);
                    }
                }
                return newRequest();
            };

            const acceptedStatus = [ 200 ];

            const newRequest = () => new Promise((resolve, reject) => {

                const req = xhr.request(options, (response) => {

                    response.on('error', (error) => {
                        reject(`Error: ${error.message}`);
                    });
                    if (acceptedStatus.includes(response.statusCode)) {
                        let dataSequence = [];

                        response.on('data', (data) => {
                            dataSequence.push(data);
                        });
                        response.on('end', () => {
                            const jsonStr = Buffer.concat(dataSequence).toString('utf8');
                            try {
                                const jsonObj = JSON.parse(jsonStr);

                                if (setCookies)
                                    Object.assign(setCookies, extractCookies(response));

                                resolve(jsonObj);
                            } catch (error) {
                                reject(`Error: ${error.message}`);
                            }
                        });
                    } else {
                        reject(`Error: Response status code ${response.statusCode}`);
                    }
                }).on('error', (error) => {
                    reject(`Error: ${error.message}`);
                })
                req.write(data);
                req.end();
            });

            return doRequest();
        }

        /** app端获取房间内抽奖信息 */
        static appGetRaffleInRoom(roomid) {
            const host = 'api.live.bilibili.com';
            const path = '/xlive/lottery-interface/v1/lottery/getLotteryInfo';
            const method = 'GET';
            const headers = appHeaders;

            const params = {};
            Object.assign(params, appCommon);
            params['roomid'] = roomid;
            params['ts'] = Number.parseInt(0.001 * new Date());
            const querystr = BilibiliRest.parseAppParams(sort(params));

            const options = {
                host,
                'path': `${path}?${querystr}`,
                method,
                headers,
            };

            return BilibiliRest.request(options);
        }

        /** Check for lottery in room ``roomid``
         *
         */
        static getRaffleInRoom(roomid) {
            const host = 'api.live.bilibili.com';
            const path = '/xlive/lottery-interface/v1/lottery/Check';
            const method = 'GET';
            const headers = webHeaders;
            const params = { 'roomid': roomid, };
            const query = querystring.stringify(params);
            const options = {
                'host': host,
                'path': `${path}?${query}`,
                'method': method,
                'headers': headers,
            };

            return BilibiliRest.request(options);
        }

        /** 查取视频cid */
        static getVideoCid(aid) {
            const host = 'api.bilibili.com';
            const path = '/x/player/pagelist';
            const method = 'GET';
            const headers = webHeaders;
            const jsonp = 'jsonp';
            const params = { 
                aid,
                jsonp,
            };
            const querystr = Bilibili.formatForm(params);

            const options = {
                host,
                'path': `${path}?${querystr}`,
                method,
                headers,
            };

            return Bilibili.request(options);
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

