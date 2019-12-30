(function() {

    'use strict';


    const settings = require('../settings.json');

    const lh = '127.0.0.1';
    const httpServer = {
        'host': settings['httpServer']['ip'] || lh,
        'port': settings['httpServer']['port'] || 8899,
    };
    const wsServer = {
        'host': settings['wsServer']['ip'] || lh,
        'port': settings['wsServer']['port'] || 8999,
    };

    process.env['x'] = 'X-Remote-IP';
    const statistics = {
        'appId': 1,
        'platform': 3,
        'version': '5.51.1',
        'abtest': '',
    };
    const appkey = '1d8b6e7d45233436';
    const appSecret = '560c52ccd288fed045859ed18bffd973';
    const appCommon = {
        'appkey': appkey,
        'build': 5511400,
        'channel': 'bili',
        'device': 'android',
        'mobi_app': 'android',
        'platform': 'android',
        'statistics': JSON.stringify(statistics),
    };
    const appHeaders = {
        'Connection': 'close',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 BiliDroid/5.51.1 (bbcallen@gmail.com)',
    };
    appHeaders[process.env['x']] = lh;
    const webHeaders = {
        'Connection': 'close',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36',
    };
    webHeaders[process.env['x']] = lh;

    const error = {
        'count': 0,
    };

    module.exports = {
        httpServer,
        appCommon,
        appHeaders,
        appSecret,
        webHeaders,
        error,
    };

})();
