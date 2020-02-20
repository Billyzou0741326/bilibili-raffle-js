(function() {

    'use strict';

    // ------------------------------- Includes -------------------------------
    const crypto = require('crypto');
    const querystring = require('querystring');
    const { 
        appCommon,
        appSecret,
        appHeaders,
        webHeaders, } = require('./global/config.js');

    const RequestBuilder = require('./net/request.js');
    const BilibiliRest = require('./bilibili/bilibili-rest.js');


    /** Emits requests to the bilibili API */
    class Bilibili extends BilibiliRest {


        /** --------------------------APP----------------------------- */

        /** 登录接口 */
        static login(username, password) {
            return Bilibili.obtainLoginKey().then(resp => {
                if (resp['code'] !== 0) {
                    return Promise.reject(resp['message']);
                }

                // ----------------------RSA-----------------------
                const hash = resp['data']['hash'];
                const key = resp['data']['key'];
                const encryptionSettings = {
                    key: key,
                    padding: crypto.constants.RSA_PKCS1_PADDING,
                };
                const encryptedForm = crypto.publicEncrypt(
                    encryptionSettings, Buffer.from(hash + password));
                const hashedPasswd = encryptedForm.toString('base64');

                const data = {};
                Object.assign(data, appCommon);
                data['sid'] = resp['sid'];
                data['username'] = username;
                data['password'] = hashedPasswd;
                data['ts'] = Number.parseInt(0.001 * new Date());

                const payload = Bilibili.parseAppParams(sort(data));

                const request = (RequestBuilder.start()
                    .withHost('passport.bilibili.com')
                    .withPath('/api/v3/oauth2/login')
                    .withMethod('POST')
                    .withHeaders(appHeaders)
                    .withData(payload)
                    .withContentType('application/x-www-form-urlencoded')
                    .withHttps()
                    .build()
                );

                return Bilibili.request(request);
            });
        }

        /** 向b站申请key和hash用以加密密码 */
        static obtainLoginKey() {
            const data = {};
            Object.assign(data, appCommon);
            data['appkey'] = appCommon['appkey'];
            data['ts'] = Number.parseInt(0.001 * new Date());
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('passport.bilibili.com')
                .withPath('/api/oauth2/getKey')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .withHttps()
                .build()
            );

            return Bilibili.request(request);
        }

        static refreshToken(session) {
            const access_token = session['app']['access_token'];
            const refresh_token = session['app']['refresh_token'];
            const data = {};
            Object.assign(data, appCommon);
            data['access_token'] = access_token;
            data['refresh_token'] = refresh_token;
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('passport.bilibili.com')
                .withPath('/api/oauth2/refreshToken')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .withHttps()
                .build()
            );

            return Bilibili.request(request);
        }


        /**
         * @params  session     Object
         * @params  info        Object
         *          roomid      Int     房间号
         */
        static appGetInfoByUser(session, info) {
            const { roomid } = info;
            const data = Object.assign(new Object(), appCommon);
            data['actionKey'] = 'appkey';
            data['room_id'] = roomid;
            data['ts'] = Math.floor(0.001 * new Date().valueOf());
            data['access_key'] = session['app']['access_token'];
            const paramstr = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/app-room/v1/index/getInfoByUser')
                .withMethod('GET')
                .withHeaders(appHeaders)
                .withParams(paramstr)
                .build()
            );

            return Bilibili.request(request);
        }


        /**
         * @params  session     Object
         * @params  info        Object
         *          roomid      Int     房间号
         */
        static appLiveOnlineHeart(session, info) {
            const { roomid } = info;
            const data = {
                'room_id': roomid,
                'scale': 'xhdpi',
            };
            const payload = Bilibili.formatForm(data);

            const params = {};
            const access_key = session['app']['access_token'];
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['ts'] = Number.parseInt(0.001 * new Date());
            const paramstr = Bilibili.parseAppParams(sort(params));

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/heartbeat/v1/OnLine/mobileOnline')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withParams(paramstr)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }

        static checkSilverBox(session) {
            const params = {};
            const access_key = session['app']['access_token'];
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['ts'] = Number.parseInt(+new Date() / 1000);
            const paramstr = Bilibili.parseAppParams(params);

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/lottery/v1/SilverBox/getCurrentTask')
                .withMethod('GET')
                .withHeaders(appHeaders)
                .withParams(paramstr)
                .build()
            );

            return Bilibili.request(request);
        }

        /**
         * @params  access_key  
         * @params  info        Object
         *          time_start  Int     银瓜子时段起始
         *          time_end    Int     银瓜子时段终末
         */
        static getSilverBox(session, info) {
            const { time_start, time_end } = info;
            const access_key = session['app']['access_token'];
            const params = {};
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['time_start'] = time_start;
            params['time_end'] = time_end;
            params['ts'] = Number.parseInt(+new Date() / 1000);
            const paramstr = Bilibili.parseAppParams(params);

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/lottery/v1/SilverBox/getAward')
                .withMethod('GET')
                .withHeaders(appHeaders)
                .withParams(paramstr)
                .build()
            );

            return Bilibili.request(request);
        }

        /**
         * @params  access_key  
         * @params  info        Object
         *   info.  group_id    Int     应援团id
         *   info.  owner_id    Int     应援对象id
         */
        static loveClubSign(session, info) {
            const params = {};
            const { group_id, owner_id } = info;
            const access_key = session['app']['access_token'];
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['group_id'] = group_id;
            params['owner_id'] = owner_id;
            params['ts'] = Number.parseInt(0.001 * new Date());
            const paramstr = Bilibili.parseAppParams(params);

            const request = (RequestBuilder.start()
                .withHost('api.vc.bilibili.com')
                .withPath('/link_setting/v1/link_setting/sign_in')
                .withMethod('GET')
                .withHeaders(appHeaders)
                .withParams(paramstr)
                .build()
            );

            return Bilibili.request(request);
        }


        /**
         * @params  access_key  String      
         * @params  info        Object
         *   info.  aid         Int     视频id
         */
        static shareVideo(session, info) {
            const { aid } = info;
            const access_key = session['app']['access_token'];
            const data = {};
            Object.assign(data, appCommon);
            data['access_key'] = access_key;
            data['aid'] = aid;
            data['ts'] = Number.parseInt(+new Date() / 1000);
            data['share_channel'] = 'qq';
            data['share_trace_id'] = crypto.randomBytes(16).toString('hex');
            data['from'] = 'main.ugc-video-detail.0.0';
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('app.bilibili.com')
                .withPath('/x/v2/view/share/complete')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }

        /** 直播间历史模仿 */
        static appRoomEntry(session, roomid) {
            const access_key = session['app']['access_token'];
            const data = {};
            Object.assign(data, appCommon);
            data['access_key'] = access_key;
            data['actionKey'] = 'appkey';
            data['device'] = 'android';
            data['jumpFrom'] = 0;
            data['room_id'] = roomid;
            data['ts'] = Number.parseInt(0.001 * new Date());
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/room/v1/Room/room_entry_action')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }

        /** 直播间历史模仿2 */
        static appRoomLiveTrace(session, roomid) {
            roomid = roomid || 164725;
            const data = {};
            const access_key = session['app']['access_token'];
            Object.assign(data, appCommon);
            data['actionKey'] = 'appkey';
            data['access_key'] = access_key;
            data['area_id'] = data['parent_id'] = data['seq_id'] = 0;
            data['buvid'] = 'XYFFB38F026C47196F273167295B14721F489';
            data['device'] = 'android';
            data['is_patch'] = 0;
            data['room_id'] = roomid;
            data['heart_beat'] = JSON.stringify([]);
            data['ts'] = Number.parseInt(0.001 * new Date());
            data['client_ts'] = data['ts'] + 19;
            data['uuid'] = getUUID();
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('live-trace.bilibili.com')
                .withPath('/xlive/data-interface/v1/heartbeat/mobileEntry')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }

        /**
         * @static
         * @param   {Object}    session
         * @param   {Object}    giftData
         * @param   {Integer}   giftData.id
         * @param   {Integer}   giftData.roomid
         * @param   {String}    giftData.type
         */
        static appJoinGift(session, giftData) {
            const { id, roomid, type } = giftData;
            const access_key = session['app']['access_token'];
            const data = {};
            Object.assign(data, appCommon);
            data['access_key'] = access_key;
            data['actionKey'] = 'appkey';
            data['device'] = 'android';
            data['raffleId'] = id;
            data['roomid'] = roomid;
            data['type'] = type;
            data['ts'] = Number.parseInt(0.001 * new Date());
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/lottery-interface/v4/smalltv/Getaward')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }


        /**
         * @static
         * @param   {Object}    session
         * @param   {Object}    pkData
         * @param   {Integer}   pkData.id
         * @param   {Integer}   pkData.roomid
         */
        static appJoinPK(session, pkData) {
            const { id, roomid } = pkData;
            const access_key = session['app']['access_token'];
            const data = {};
            Object.assign(data, appCommon);
            data['access_key'] = access_key;
            data['actionKey'] = 'appkey';
            data['device'] = 'android';
            data['id'] = id;
            data['roomid'] = roomid;
            data['ts'] = Number.parseInt(0.001 * new Date());
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/lottery-interface/v1/pk/join')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }


        /**
         * @static
         * @param   {Object}    session
         * @param   {Object}    guardData
         * @param   {Integer}   guardData.id
         * @param   {Integer}   guardData.roomid
         * @param   {String}    guardData.type
         */
        static appJoinGuard(session, guardData) {
            const { id, roomid, type } = guardData;
            const access_key = session['app']['access_token'];
            const data = {};
            Object.assign(data, appCommon);
            data['access_key'] = access_key;
            data['actionKey'] = 'appkey';
            data['device'] = 'android';
            data['id'] = id;
            data['roomid'] = roomid;
            data['type'] = type || 'guard';
            data['ts'] = Number.parseInt(0.001 * new Date());
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/lottery-interface/v2/Lottery/join')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }

        /**
         * @static
         * @param   {Object}    session
         * @param   {Object}    stormData
         * @param   {Integer}   stormData.id
         */
        static appJoinStorm(session, stormData) {
            const access_key = session['app']['access_token'];
            const { id } = stormData;
            const data = {};
            Object.assign(data, appCommon);
            data['access_key'] = access_key;
            data['actionKey'] = 'appkey';
            data['device'] = 'android';
            data['id'] = id;
            data['ts'] = Math.floor(0.001 * new Date());
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/lottery-interface/v1/storm/Join')
                .withMethod('POST')
                .withHeaders(appHeaders)
                .withData(payload)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }
        // */


        static appSign(string) {
            return crypto.createHash('md5').update(string+appSecret).digest('hex');
        }

        static parseAppParams(params) {
            const pre_paramstr = Bilibili.formatForm(params);
            const sign = Bilibili.appSign(pre_paramstr);
            const paramstr = `${pre_paramstr}&sign=${sign}`;
            return paramstr;
        }


        /** --------------------------WEB----------------------------- */

        static mainTaskInfo(session) {
            const request = (RequestBuilder.start()
                .withHost('account.bilibili.com')
                .withPath('/home/reward')
                .withMethod('GET')
                .withHeaders(webHeaders)
                .withCookies(session['web'])
                .build()
            );

            return Bilibili.request(request);
        }

        static liveTaskInfo(session) {
            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/i/api/taskInfo')
                .withMethod('GET')
                .withHeaders(webHeaders)
                .withCookies(session['web'])
                .build()
            );

            return Bilibili.request(request);
        }

        static liveSignInfo(session) {
            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/sign/GetSignInfo')
                .withMethod('GET')
                .withHeaders(webHeaders)
                .withCookies(session['web'])
                .build()
            );

            return Bilibili.request(request);
        }

        static liveSign(session) {
            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/sign/doSign')
                .withMethod('GET')
                .withHeaders(webHeaders)
                .withCookies(session['web'])
                .build()
            );

            return Bilibili.request(request);
        }

        static webGetInfoByUser(session, info) {
            const { roomid } = info;
            const params = {};
            params['room_id'] = roomid;


            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/xlive/web-room/v1/index/getInfoByUser')
                .withMethod('GET')
                .withCookies(session['web'])
                .withHeaders(webHeaders)
                .withParams(params)
                .build()
            );

            return Bilibili.request(request);
        }

        static webLiveOnlineHeart(session) {
            const data = {
                'csrf': session['web']['bili_jct'],
                'csrf_token': session['web']['bili_jct'],
                'visit_id': '',
            };

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/User/userOnlineHeart')
                .withMethod('POST')
                .withHeaders(webHeaders)
                .withCookies(session['web'])
                .withData(data)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }

        static liveDoubleWatch(session) {
            const csrf = session['web']['bili_jct'];
            const data = {
                'task_id': 'double_watch_task',
                'csrf': csrf,
                'csrf_token': csrf,
            };

            const request = (RequestBuilder.start()
                .withHost('api.live.bilibili.com')
                .withPath('/activity/v1/task/receive_award')
                .withMethod('POST')
                .withHeaders(webHeaders)
                .withCookies(session['web'])
                .withData(data)
                .withContentType('application/x-www-form-urlencoded')
                .build()
            );

            return Bilibili.request(request);
        }

        static loveClubList(session) {
            const params = {
                'build': 0,
                'mobi_app': 'web',
            };
            const request = (RequestBuilder.start()
                .withHost('api.vc.bilibili.com')
                .withPath('/link_group/v1/member/my_groups')
                .withMethod('GET')
                .withParams(params)
                .withCookies(session['web'])
                .withHeaders(webHeaders)
                .build()
            );

            return Bilibili.request(request);
        }


        /**
         * @params  info        Object
         *          aid         String      视频id
         *          cid         String      ?
         */
        static watchVideo(session, info) {
            const { aid, cid } = info;
            const data = {};
            data['aid'] = aid;
            data['cid'] = cid;
            data['mid'] = session['web']['DedeUserID'];
            data['played_time'] = 30;
            data['real_time'] = 30;
            data['type'] = 3;
            data['dt'] = 2;
            data['play_type'] = 3;
            data['start_ts'] = Number.parseInt(0.001 * new Date()) - data['played_time'];
            const payload = Bilibili.parseAppParams(sort(data));

            const request = (RequestBuilder.start()
                .withHost('api.bilibili.com')
                .withPath('/x/report/web/heartbeat')
                .withMethod('POST')
                .withContentType('application/x-www-form-urlencoded')
                .withData(data)
                .withCookies(session['web'])
                .withHeaders(webHeaders)
                .build()
            );

            return Bilibili.request(request);
        }

    }


    module.exports = Bilibili;


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

    const getUUID = () => {
        // Format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        const parts = [
            crypto.randomBytes(4).toString('hex'),
            crypto.randomBytes(2).toString('hex'),
            crypto.randomBytes(2).toString('hex'),
            crypto.randomBytes(2).toString('hex'),
            crypto.randomBytes(6).toString('hex'),
        ];
        const uuid = parts.join('-');
        return uuid;
    };

})();
