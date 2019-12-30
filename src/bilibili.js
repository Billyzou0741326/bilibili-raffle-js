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

    const BilibiliRest = require('./bilibili/bilibili-rest.js');


    /** Emits requests to the bilibili API */
    class Bilibili extends BilibiliRest {


        /** --------------------------APP----------------------------- */

        /** 登录接口 */
        static login(username, password) {
            const host = 'passport.bilibili.com';
            const path = '/api/v3/oauth2/login';
            const method = 'POST';
            const headers = {};
            Object.assign(headers, appHeaders);
            const params = {};
            Object.assign(params, appCommon);


            return Bilibili.obtainLoginKey().then(resp => {
                if (resp['code'] === 0) {
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

                    params['sid'] = resp['sid'];
                    params['username'] = username;
                    params['password'] = hashedPasswd;
                    params['ts'] = Number.parseInt(0.001 * new Date());

                    const paramstr = Bilibili.parseAppParams(sort(params));

                    headers['Cookie'] = Bilibili.formatCookies({ sid: params['sid'] });

                    const options = {
                        host,
                        path,
                        method,
                        headers,
                    };
                    const settings = {
                        'useHttps': true,
                        'data': paramstr,
                    };

                    return Bilibili.request(options, settings);
                }
                return Promise.reject(resp['message']);
            });
        }

        /** 向b站申请key和hash用以加密密码 */
        static obtainLoginKey() {
            const host = 'passport.bilibili.com';
            const path = '/api/oauth2/getKey';
            const method = 'POST';
            const headers = {};
            Object.assign(headers, appHeaders);

            const params = {};
            Object.assign(params, appCommon);
            params['appkey'] = appCommon['appkey'];
            params['ts'] = Number.parseInt(0.001 * new Date());
            const paramstr = Bilibili.parseAppParams(sort(params));

            const options = {
                host,
                path,
                method,
                headers,
            };

            const cookies = {};
            const settings = {
                'useHttps': true,
                'data': paramstr,
                // 'setCookies': cookies,
            };
            return Bilibili.request(options, settings).then(resp => {
                return resp;
                // return Object.assign(cookies, resp);
            });
        }

        static refreshToken(session) {
            const host = 'passport.bilibili.com';
            const path = '/api/oauth2/refreshToken';
            const method = 'POST';
            const headers = appHeaders;

            const access_token = session['app']['access_token'];
            const refresh_token = session['app']['refresh_token'];
            const params = {};
            Object.assign(params, appCommon);
            params['access_token'] = access_token;
            params['refresh_token'] = refresh_token;
            const paramstr = Bilibili.parseAppParams(sort(params));

            const options = {
                host,
                path,
                method,
                headers,
            };
            const settings = {
                'useHttps': true,
                'data': paramstr,
            };

            return Bilibili.request(options, settings);
        }


        /**
         * @params  session     Object
         * @params  info        Object
         *          roomid      Int     房间号
         */
        static appLiveOnlineHeart(session, info) {
            const host = 'api.live.bilibili.com';
            const path = '/heartbeat/v1/OnLine/mobileOnline';
            const method = 'POST';
            const headers = appHeaders;

            const { roomid } = info;
            const payload = {
                'room_id': roomid,
                'scale': 'xhdpi',
            };

            const data = Bilibili.formatForm(payload);

            const params = {};
            const access_key = session['app']['access_token'];
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['ts'] = Number.parseInt(0.001 * new Date());

            const paramstr = Bilibili.parseAppParams(sort(params));
            const querystr = `${path}?${paramstr}`;

            const options = {
                host,
                path: querystr,
                method,
                headers,
            };
            const settings = {
                'useHttps': true,
                'data': data,
            };

            return Bilibili.request(options, true, data);
        }

        static checkSilverBox(session) {
            const host = 'api.live.bilibili.com';
            const path = '/lottery/v1/SilverBox/getCurrentTask';
            const method = 'GET';
            const headers = appHeaders;

            const params = {};
            const access_key = session['app']['access_token'];
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['ts'] = Number.parseInt(+new Date() / 1000);
            const paramstr = Bilibili.parseAppParams(params);
            const querystr = `${path}?${paramstr}`;

            const options = {
                host,
                path: querystr,
                method,
                headers,
            };

            return Bilibili.request(options);
        }

        /**
         * @params  access_key  
         * @params  info        Object
         *          time_start  Int     银瓜子时段起始
         *          time_end    Int     银瓜子时段终末
         */
        static getSilverBox(session, info) {
            const host = 'api.live.bilibili.com';
            const path = '/lottery/v1/SilverBox/getAward';
            const method = 'GET';
            const headers = appHeaders;

            const { time_start, time_end } = info;
            const access_key = session['app']['access_token'];
            const params = {};
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['time_start'] = time_start;
            params['time_end'] = time_end;
            params['ts'] = Number.parseInt(+new Date() / 1000);
            const paramstr = Bilibili.parseAppParams(params);
            const querystr = `${path}?${paramstr}`;

            const options = {
                host,
                path: querystr,
                method,
                headers,
            };

            return Bilibili.request(options);
        }

        /**
         * @params  access_key  
         * @params  info        Object
         *   info.  group_id    Int     应援团id
         *   info.  owner_id    Int     应援对象id
         */
        static loveClubSign(session, info) {
            const host = 'api.vc.bilibili.com';
            const path = '/link_setting/v1/link_setting/sign_in';
            const method = 'GET';
            const headers = appHeaders;

            const params = {};
            const { group_id, owner_id } = info;
            const access_key = session['app']['access_token'];
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['group_id'] = group_id;
            params['owner_id'] = owner_id;
            params['ts'] = Number.parseInt(0.001 * new Date());
            const paramstr = Bilibili.parseAppParams(params);
            const querystr = `${path}?${paramstr}`;

            const options = {
                host,
                path: querystr,
                method,
                headers,
            };

            return Bilibili.request(options);
        }


        /**
         * @params  access_key  String      
         * @params  info        Object
         *   info.  aid         Int     视频id
         */
        static shareVideo(session, info) {
            const host = 'app.bilibili.com';
            const path = '/x/v2/view/share/complete';
            const method = 'POST';
            const headers = appHeaders;

            const { aid } = info;
            const access_key = session['app']['access_token'];
            const params = {};
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['aid'] = aid;
            params['ts'] = Number.parseInt(+new Date() / 1000);
            params['share_channel'] = 'qq';
            params['share_trace_id'] = crypto.randomBytes(16).toString('hex');
            params['from'] = 'main.ugc-video-detail.0.0';
            const paramstr = Bilibili.parseAppParams(sort(params));

            const options = {
                host,
                path,
                method,
                headers,
            };
            const settings = {
                'useHttps': true,
                'data': paramstr,
            };

            return Bilibili.request(options, settings);
        }

        /** 直播间历史模仿 */
        static appRoomEntry(session, roomid) {
            const host = 'api.live.bilibili.com';
            const path = '/room/v1/Room/room_entry_action';
            const method = 'POST';
            const headers = appHeaders;

            const access_key = session['app']['access_token'];
            const params = {};
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['actionKey'] = 'appkey';
            params['device'] = 'android';
            params['jumpFrom'] = 0;
            params['room_id'] = roomid;
            params['ts'] = Number.parseInt(+new Date() / 1000);
            const paramstr = Bilibili.parseAppParams(sort(params));

            const options = {
                host,
                path,
                method,
                headers,
            };
            const settings = {
                'useHttps': true,
                'data': paramstr,
            };

            return Bilibili.request(options, settings);
        }

        /** 直播间历史模仿2 */
        static appRoomLiveTrace(session, roomid) {
            const host = 'live-trace.bilibili.com';
            const path = '/xlive/data-interface/v1/heartbeat/mobileEntry';
            const method = 'POST';
            const headers = appHeaders;

            roomid = roomid || 164725;
            const params = {};
            const access_key = session['app']['access_token'];
            Object.assign(params, appCommon);
            params['actionKey'] = 'appkey';
            params['access_key'] = access_key;
            params['area_id'] = params['parent_id'] = params['seq_id'] = 0;
            params['buvid'] = 'XYFFB38F026C47196F273167295B14721F489';
            params['device'] = 'android';
            params['is_patch'] = 0;
            params['room_id'] = roomid;
            params['heart_beat'] = JSON.stringify([]);
            params['ts'] = Number.parseInt(0.001 * new Date());
            params['client_ts'] = params['ts'] + 19;
            params['uuid'] = getUUID();
            const paramstr = Bilibili.parseAppParams(sort(params));

            const options = {
                host,
                path,
                method,
                headers,
            };
            const settings = {
                'useHttps': true,
                'data': paramstr,
            };

            return Bilibili.request(options, settings);
        }

        /**
         * @params  access_key  String
         * @params  cookies     Object  (optional)
         * @params  giftData    Object
         *          id          Int
         *          roomid      Int
         *          type        String
         */ 
        static appJoinGift(session, giftData) {
            const host = 'api.live.bilibili.com';
            const path = '/xlive/lottery-interface/v4/smalltv/Getaward';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const method = 'POST';
            // const headers = { 'Cookie': c };
            const headers = {};
            Object.assign(headers, appHeaders);

            const { id, roomid, type } = giftData;
            const access_key = session['app']['access_token'];
            const params = {};
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['actionKey'] = 'appkey';
            params['device'] = 'android';
            params['raffleId'] = id;
            params['roomid'] = roomid;
            params['type'] = type;
            params['ts'] = Number.parseInt(0.001 * new Date());
            const paramstr = Bilibili.parseAppParams(sort(params));

            const options = {
                host,
                path,
                method,
                headers,
            };
            const settings = {
                'useHttps': true,
                'data': paramstr,
            };

            return Bilibili.request(options, settings);
        }


        /**
         * @params  access_key  String
         * @params  cookies     Object  (optional)
         * @params  pkData      Object
         *          id          Int
         *          roomid      Int
         *          type        String
         */
        static appJoinPK(session, pkData) {
            const host = 'api.live.bilibili.com';
            const path = '/xlive/lottery-interface/v1/pk/join';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const method = 'POST';
            // const headers = { 'Cookie': c };
            const headers = {};
            Object.assign(headers, appHeaders);

            const { id, roomid } = pkData;
            const access_key = session['app']['access_token'];
            const params = {};
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['actionKey'] = 'appkey';
            params['device'] = 'android';
            params['id'] = id;
            params['roomid'] = roomid;
            params['ts'] = Number.parseInt(0.001 * new Date());
            const paramstr = Bilibili.parseAppParams(sort(params));

            const options = {
                host,
                path,
                method,
                headers,
            };
            const settings = {
                'useHttps': true,
                'data': paramstr,
            };

            return Bilibili.request(options, settings);
        }


        /**
         * @params  access_key  String
         * @params  cookies     Object  (required)
         * @params  stormData   Object
         *          id          Int
         */
        static appJoinGuard(session, guardData) {
            const host = 'api.live.bilibili.com';
            const path = '/xlive/lottery-interface/v2/Lottery/join';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const method = 'POST';
            // const headers = { 'Cookie': c };
            const headers = {};
            Object.assign(headers, appHeaders);

            const { id, roomid, type } = guardData;
            const access_key = session['app']['access_token'];
            const params = {};
            Object.assign(params, appCommon);
            params['access_key'] = access_key;
            params['actionKey'] = 'appkey';
            params['device'] = 'android';
            params['id'] = id;
            params['roomid'] = roomid;
            params['type'] = type || 'guard';
            params['ts'] = Number.parseInt(0.001 * new Date());
            const paramstr = Bilibili.parseAppParams(sort(params));

            const options = {
                host,
                path,
                method,
                headers,
            };
            const settings = {
                'useHttps': true,
                'data': paramstr,
            };

            return Bilibili.request(options, settings);
        }


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
            const host = 'account.bilibili.com';
            const path = '/home/reward';
            const method = 'GET';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const headers = { 'Cookie': c };
            Object.assign(headers, webHeaders);

            const options = {
                host,
                path,
                method,
                headers,
            };

            return Bilibili.request(options);
        }

        static liveTaskInfo(session) {
            const host = 'api.live.bilibili.com'
            const path = '/i/api/taskInfo';
            const method = 'GET';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const headers = { 'Cookie': c };
            Object.assign(headers, webHeaders);

            const options = {
                host,
                path,
                method,
                headers,
            };

            return Bilibili.request(options);
        }

        static liveSignInfo(session) {
            const host = 'api.live.bilibili.com'
            const path = '/sign/GetSignInfo';
            const method = 'GET';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const headers = { 'Cookie': c };
            Object.assign(headers, webHeaders);

            const options = {
                host,
                path,
                method,
                headers,
            };

            return Bilibili.request(options);
        }

        static liveSign(session) {
            const host = 'api.live.bilibili.com'
            const path = '/sign/doSign';
            const method = 'GET';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const headers = { 'Cookie': c };
            Object.assign(headers, webHeaders);

            const options = {
                host,
                path,
                method,
                headers,
            };

            return Bilibili.request(options);
        }

        static webLiveOnlineHeart(session) {
            const host = 'api.live.bilibili.com'
            const path = '/User/userOnlineHeart';
            const method = 'POST';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const headers = { 'Cookie': c };
            Object.assign(headers, webHeaders);

            const params = {
                'csrf': cookies['bili_jct'],
                'csrf_token': cookies['bili_jct'],
                'visit_id': '',
            };
            const data = Bilibili.formatForm(params);

            const options = {
                host,
                path,
                method,
                headers,
            };
            const settings = {
                data,
            };

            return Bilibili.request(options, settings);
        }

        static liveDoubleWatch(session) {
            const host = 'api.live.bilibili.com'
            const path = '/activity/v1/task/receive_award';
            const method = 'POST';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const headers = { 'Cookie': c };
            Object.assign(headers, webHeaders);

            const options = {
                host,
                path,
                method,
                headers,
            };
            const csrf = cookies['bili_jct'];
            const data = {
                'task_id': 'double_watch_task',
                'csrf': csrf,
                'csrf_token': csrf,
            };
            const formattedData = Bilibili.formatForm(data);

            const settings = {
                'data': formattedData,
            };

            return Bilibili.request(options, settings);
        }

        static loveClubList(session) {
            const host = 'api.vc.bilibili.com';
            const path = '/link_group/v1/member/my_groups';
            const method = 'GET';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const headers = { 'Cookie': c };
            Object.assign(headers, webHeaders);

            const params = {
                'build': 0,
                'mobi_app': 'web',
            };
            const paramstr = Bilibili.formatForm(params);
            const querystr = `${path}?${paramstr}`;

            const options = {
                host,
                path: querystr,
                method,
                headers,
            };

            return Bilibili.request(options);
        }


        /**
         * @params  info        Object
         *          aid         String      视频id
         *          cid         String      ?
         */
        static watchVideo(session, info) {
            const host = 'api.bilibili.com';
            const path = '/x/report/web/heartbeat';
            const method = 'POST';
            const cookies = session['web'];
            const c = Bilibili.formatCookies(cookies);
            const headers = { 'Cookie': c };
            Object.assign(headers, webHeaders);

            const { aid, cid } = info;
            const params = {};
            params['aid'] = aid;
            params['cid'] = cid;
            params['mid'] = cookies['DedeUserID'];
            params['played_time'] = 30;
            params['real_time'] = 30;
            params['type'] = 3;
            params['dt'] = 2;
            params['play_type'] = 3;
            params['start_ts'] = Number.parseInt(0.001 * new Date()) - params['played_time'];
            const paramstr = Bilibili.formatForm(params);

            const options = {
                host,
                path,
                method,
                headers,
            };
            const settings = {
                'data': paramstr,
            };

            return Bilibili.request(options, settings);
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
