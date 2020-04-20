(function() {

    'use strict';


    const settings = require('../settings.json');

    const rand_hex = (len) => {
        const items = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F' ];
        const length = items.length;
        if (len === 0) return '';

        let result = '';
        for (let i = 0; i < len; ++i) {
            result = `${result}${items[Math.floor(Math.random()*length)]}`;
        }
        return result;
    };

    const lh = '127.0.0.1';
    const wsServer = settings.wsServer;

    const statistics = {
        'appId': 1,
        'platform': 3,
        'version': '5.55.1',
        'abtest': '',
    };
    const appkey = '1d8b6e7d45233436';
    const appSecret = '560c52ccd288fed045859ed18bffd973';
    const appCommon = {
        'appkey': appkey,
        'build': 5551100,
        'channel': 'bili',
        'device': 'android',
        'mobi_app': 'android',
        'platform': 'android',
        'statistics': JSON.stringify(statistics),
    };
    const appHeaders = {
        'Connection': 'close',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 BiliDroid/5.55.1 (bbcallen@gmail.com)',
        'env': 'prod',
        'APP-KEY': 'android',
        'Buvid': `XZ${rand_hex(35)}`,
    };
    const webHeaders = {
        'Connection': 'close',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36',
    };

    const error = {
        'count': 0,
    };

    module.exports = {
        appCommon,
        appHeaders,
        appSecret,
        webHeaders,
        error,
    };

})();
