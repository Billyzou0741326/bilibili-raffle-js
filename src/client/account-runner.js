(function() {

    'use strict';

    const path = require('path');
    const fs = require('fs');

    const VirtualQueue = require('./queue.js');
    const Account = require('./account.js');
    const Bilibili = require('../bilibili.js');
    const ScheduledTask = require('./tasks/scheduledtask.js');
    const DailyTask = require('./tasks/dailytask.js');
    const WeeklySchedule = require('./tasks/weeklyschedule.js');
    const Clock = require('./tasks/clock.js');
    const { sleep, } = require('../util/utils.js');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    class AccountRunner extends Account {

        constructor(filename, options) {
            super(filename);
            this._tasks = {
                'pk': new ScheduledTask(),
                'gift': new ScheduledTask(),
                'storm': new ScheduledTask(),
                'guard': new ScheduledTask(),
                'livesign': new DailyTask(),
                'liveheart': new ScheduledTask(),
                'idolclubsign': new DailyTask(),
                'mainsharevideo': new DailyTask(),
                'mainwatchvideo': new DailyTask(),
                'silverbox': new DailyTask(),
                'doublewatch': new DailyTask(),
            };
            this.tasksFilename = 'task-for-' + this.filename;
            this.blacklisted = false;
            this.blacklistCheckInterval = 1000 * 60 * 60 * 24; // By default, when blacklisted, check back after 24 hours
            this.nextBlacklistCheckTime = null;
            this.roomEntered = new Set();
            this.maxNumRoomEntered = 30; // By default, only keep at most 30 rooms in entered queue
            let maxRequestsPerSecond = 50;

            if (options) {
                if (options.hasOwnProperty('maxRequestsPerSecond')) {
                    maxRequestsPerSecond = options.maxRequestsPerSecond;
                }
                if (options.hasOwnProperty('maxNumRoomEntered')) {
                    this.maxNumRoomEntered = options.maxNumRoomEntered;
                }
                if (options.hasOwnProperty('blacklistCheckInterval')) {
                    this.blacklistCheckInterval = options.blacklistCheckInterval * 1000 * 60 * 60; // blacklistCheckInterval is in hours
                }
            }

            this.q = new VirtualQueue(maxRequestsPerSecond, 1000);
        }

        bind() {
            super.bind();
            this.reportHttpError = this.reportHttpError.bind(this);
            this.mainWatchVideo = this.mainWatchVideo.bind(this);
            this.mainShareVideo = this.mainShareVideo.bind(this);
            this.liveSign = this.liveSign.bind(this);
            this.liveHeart = this.liveHeart.bind(this);
            this.liveSilverBox = this.liveSilverBox.bind(this);
            this.liveDoubleWatch = this.liveDoubleWatch.bind(this);
            this.idolClubSign = this.idolClubSign.bind(this);
            this.joinPK = this.joinPK.bind(this);
            this.joinGift = this.joinGift.bind(this);
            this.joinGuard = this.joinGuard.bind(this);
            this.joinStorm = this.joinStorm.bind(this);
        }

        register(taskname, options) {
            const task = this._tasks[taskname];

            if (typeof task === 'undefined')
                return null;

            const actions = {
                'pk': this.joinPK,
                'gift': this.joinGift,
                'storm': this.joinStorm,
                'guard': this.joinGuard,
                'livesign': this.liveSign,
                'liveheart': this.liveHeart,
                'idolclubsign': this.idolClubSign,
                'mainsharevideo': this.mainShareVideo,
                'mainwatchvideo': this.mainWatchVideo,
                'silverbox': this.liveSilverBox,
                'doublewatch': this.liveDoubleWatch,
            };

            task.registerCallback(actions[taskname]);

            if (options) {
                task.updateTimePeriod && task.updateTimePeriod(new WeeklySchedule(options.timeperiod));
            }

            return true;
        }

        unregister(taskname) {
            const task = this._tasks[taskname];

            if (typeof task === 'undefined')
                return null;

            switch (taskname.toUpperCase()) {
                case 'PK':
                case 'GIFT':
                case 'GUARD':
                case 'STORM':
                case 'LIVEHEART':
                    this._tasks[taskname] = new ScheduledTask();
                    break;
                case 'LIVESIGN':
                case 'IDOLCLUBSIGN':
                case 'MAINSHAREVIDEO':
                case 'MAINWATCHVIDEO':
                case 'SILVERBOX':
                case 'DOUBLEWATCH':
                    this._tasks[taskname] = new DailyTask();
                    break;
            }
        }

        info() {
            return super.info();
        }

        tasks() {
            let result = {};
            Object.entries(this._tasks).forEach(entry => {
                result[entry[0]] = entry[1].json();
            });
            return result;
        }

        execute(taskname, ...args) {
            const task = this._tasks[taskname];

            const ratelimitedTask = [
                'gift',
                'guard',
                'pk',
            ];

            return (async () => {
                if (ratelimitedTask.includes(taskname)) {
                    await this.q.add();
                }
                return task && task.execute(...args);
            })();
        }

        reportHttpError(error) {
            cprint(`Error - ${error}`, colors.red);
            return null;
        }

        checkErrorResponse(msg) {
            if (msg.includes('访问被拒绝')) {
                this.blacklisted = true;

                // If we still have a next check time defined in the future, just leave it alone.
                if (this.nextBlacklistCheckTime === null || this.nextBlacklistCheckTime <= new Date()) {
                    this.nextBlacklistCheckTime = new Date(new Date().getTime() + this.blacklistCheckInterval);
                }

                return Promise.reject(`${msg} -- 已进小黑屋`);
            }

            if (msg.includes('请先登录')) {
                cprint('-------------账号重新登录中---------------', colors.yellow);
                return this.login(true);
            }

            return Promise.reject(msg);
        }

        checkBlacklisted() {
            if (this.blacklisted) {
                if (new Date() < this.nextBlacklistCheckTime) {
                    cprint('已进小黑屋，暂停执行', colors.grey);
                } else {
                    // May be released by now, so reset the flag to try again.
                    this.blacklisted = false;
                    
                    // Update next check time based on previous check time, not current time.
                    this.nextBlacklistCheckTime = new Date(this.nextBlacklistCheckTime.getTime() + this.blacklistCheckInterval);
                }
            }

            return this.blacklisted;
        }

        /** 主站观看视频 */
        mainWatchVideo() {
            if (this.usable === false) return null;

            const info = {
                'aid': 70160595, 
                'cid': 121541439,
            };

            return Bilibili.watchVideo(this.session, info).catch(this.reportHttpError);
        }

        /** 主站分享视频 */
        mainShareVideo(aid=70160595) {
            if (this.usable === false) return null;

            return Bilibili.shareVideo(this.session, { aid }).then(resp => {

                const code = resp['code'];
                const msg = resp['msg'] || resp['message'] || '';

                if (code !== 0) {
                    return Promise.reject(`视频分享失败: (${code})${msg}`);
                }

                const data = resp['data']
                const aid = data['aid'];
                const result = data['toast'];
                cprint(result, colors.green);

            }).catch(this.reportHttpError);
        }

        /** 直播区签到 */
        liveSign() {
            if (this.usable === false) return null;

            return Bilibili.liveSignInfo(this.session).then(resp => {

                const signed = resp['data']['status'];

                if (signed === 0) {
                    return Bilibili.liveSign(this.session);
                } else {
                    cprint(`直播签到奖励已领取: ${resp.data.text}`, colors.grey);
                }

            }).then(resp => {
                if (!resp) return;

                const code = resp['code'];

                if (code === 0) {
                    cprint(`直播签到奖励: ${resp.data.text}`, colors.green);
                } else {
                    const msg = resp['msg'] || resp['message'] || '';
                    cprint(`直播签到失败: (${code})${msg}`, colors.red);
                }
            }).catch(this.reportHttpError);
        }

        /** 银瓜子 */
        liveSilverBox() {
            if (this.usable === false) return null;

            if (this.checkBlacklisted()) return null;

            const execute = async () => {

                let errCount = 0;
                while (true) {
                    // 1. Get SilverBox status
                    let resp = await Bilibili.checkSilverBox(this.session);
                    let data = resp['data'];
                    if (typeof data.time_start === 'undefined') {

                        const code = resp['code'];
                        const msg = resp['message'] || resp['msg'] || '';
                        if (msg.match(/今天.*领完/) !== null) {
                            cprint(msg, colors.green);
                            break;
                        } else {
                            try {
                                await this.checkErrorResponse(msg);
                            } catch(err) {
                                ++errCount;
                                if (errCount < 3)
                                    continue;

                                cprint(`银瓜子领取失败: (${code})${err}`, colors.red);
                                break;
                            }
                        }
                    }

                    const diff = data.time_end - Number.parseInt(0.001 * new Date());

                    // 2. Get SilverBox award
                    await sleep(diff * 1000);
                    resp = await Bilibili.getSilverBox(this.session, data);
                    const msg = resp.message || resp.msg || '';
                    if (resp.code === 0) {
                        cprint(`银瓜子: ${resp.data.silver} (+${resp.data.awardSilver})`, colors.green);
                        if (resp.data.isEnd !== 0) break;
                    } else {
                        try {
                            await this.checkErrorResponse(msg);
                        } catch(err) {
                            cprint(`银瓜子领取失败: ${err}`, colors.red);
                            break;
                        }
                    }
                }
            };

            return execute().catch(this.reportHttpError);
        }

        /** 双端心跳 */
        liveHeart(roomid=164725) {
            if (this.usable === false) return null;

            (Bilibili.webLiveOnlineHeart(this.session)
                .catch(this.reportHttpError)
                .then(resp => {
                    const code = resp['code'];
                    if (code !== 0) {
                        const msg = resp['msg'] || resp['message'] || '';
                        cprint(`(web)心跳发送失败 (${code})${msg}`, colors.red);
                    }
                    return Bilibili.appLiveOnlineHeart(this.session, { roomid });
                })
                .then(resp => {
                    const code = resp['code'];
                    if (code !== 0) {
                        const msg = resp['msg'] || resp['message'] || '';
                        cprint(`(app)心跳发送失败 (${code})${msg}`, colors.red);
                    }
                })
                .catch(this.reportHttpError));
        }

        /** 双端领取 */
        liveDoubleWatch() {
            if (this.usable === false) return null;

            const execute = async () => {
                let done = false;
                while (!done) {
                    // await throws error when a promise is rejected.
                    // execute().catch(...) will handle the error thrown
                    const taskResp = await Bilibili.liveTaskInfo(this.session);
                    const doubleStatus = taskResp['data']['double_watch_info']['status'];
                    const awards = taskResp['data']['double_watch_info']['awards'];

                    if (doubleStatus === 1) {
                        done = true;
                        const awardResp = await Bilibili.liveDoubleWatch(this.session);
                        const code = awardResp['code'];
                        const msg = awardResp['msg'] || awardResp['message'] || '';
                        if (code !== 0) {
                            const failedText = `双端观看奖励领取失败: (${code})${msg}`;
                            cprint(failedText, colors.red);
                        } else {
                            const awardTexts = awards.map(award => `${award.name}(${award.num})`);
                            const awardText = '双端观看奖励: ' + awardTexts.join('   ');
                            cprint(awardText, colors.green);
                        }
                    } else if (doubleStatus === 2) {
                        done = true;
                        const awardTexts = awards.map(award => `${award.name}(${award.num})`);
                        const awardText = '双端观看奖励已领取: ' + awardTexts.join('   ');
                        cprint(awardText, colors.grey);
                    } else if (doubleStatus === 0) {
                        cprint('双端观看未完成', colors.grey);
                    }

                    // Need to watch on web & app for at least 5 minutes. To be sure, wait for 6 minutes.
                    if (done === false) {
                        await sleep(1000 * 60 * 6);
                    }
                }
            };

            return execute().catch(this.reportHttpError);
        }

        /** 友爱社签到 */
        idolClubSign() {
            if (this.usable === false) return null;

            return Bilibili.loveClubList(this.session).then((respData) => {

                const groups = respData['data']['list'];
                const groupInfoList = groups && groups.map((entry) => {
                    return {
                        'group_id': entry['group_id'],
                        'owner_id': entry['owner_uid'],
                    };
                });
                // console.log(groupInfoList);
                return groupInfoList;

            }).then((groupInfoList) => {

                const resultList = groupInfoList.map((groupInfo) => {
                    return Bilibili.loveClubSign(this.session, groupInfo);
                });
                return resultList;

            }).then((groupSignResultList) => {

                groupSignResultList.forEach(request => {
                    request.then((result) => {
                        const code = result['code'];
                        if (code === 0) {
                            cprint('Idol club sign success', colors.green);
                        } else {
                            cprint('Idol club sign failed', colors.red);
                        }
                    }).catch(this.reportHttpError);
                });

            }).catch(this.reportHttpError);
        }

        postRoomEntry(roomid) {

            let promise = null;

            if (this.roomEntered.has(roomid) === false) {
                this.roomEntered.add(roomid);
                promise = (async () => {
                    if (this.roomEntered.size > this.maxNumRoomEntered) {
                        this.roomEntered = new Set([...this.roomEntered].slice(this.roomEntered.size / 2));
                    }

                    await Bilibili.appRoomEntry(this.session, roomid);
                })();
            } else {
                promise = Promise.resolve();
            }

            return promise;
        }

        joinPK(pk) {
            if (this.usable === false) return null;

            if (this.checkBlacklisted()) return null;

            const execute = async () => {
                await this.postRoomEntry(pk.roomid);
                while (true) {
                    const resp = await Bilibili.appJoinPK(this.session, pk);
                    if (resp.code === 0) {
                        cprint(`${resp.data.award_text}`, colors.green);
                        break;
                    } else {
                        const msg = resp.message || resp.msg || '';
                        try {
                            await this.checkErrorResponse(msg);
                        } catch(err) {
                            cprint(`${pk.id} 获取失败: ${err}`, colors.red);
                            break;
                        }
                    }

                }
            };

            return execute().catch(this.reportHttpError);
        }

        joinGift(gift) {
            if (this.usable === false) return null;

            if (this.checkBlacklisted()) return null;

            const execute = async () => {
                await this.postRoomEntry(gift.roomid);
                while (true) {
                    const resp = await Bilibili.appJoinGift(this.session, gift);
                    if (resp.code === 0) {
                        cprint(`${resp.data.gift_name}+${resp.data.gift_num}`, colors.green);
                        break;
                    } else {
                        const msg = resp.message || resp.msg || '';
                        try {
                            await this.checkErrorResponse(msg);
                        } catch(err) {
                            cprint(`${gift.id} 获取失败: ${err}`, colors.red);
                            break;
                        }
                    }

                }
            };

            return execute().catch(this.reportHttpError);
        }

        joinGuard(guard) {
            if (this.usable === false) return null;

            if (this.checkBlacklisted()) return null;

            const execute = async () => {
                await this.postRoomEntry(guard.roomid);
                while (true) {
                    const resp = await Bilibili.appJoinGuard(this.session, guard);
                    if (resp.code === 0) {
                        cprint(`${resp.data.message}`, colors.green);
                        break;
                    } else {
                        const msg = resp.message || resp.msg || '';
                        try {
                            await this.checkErrorResponse(msg);
                        } catch(err) {
                            cprint(`${guard.id} 获取失败: ${err}`, colors.red);
                            break;
                        }
                    }

                }
            };

            return execute().catch(this.reportHttpError);
        }

        joinStorm(storm) {
            if (this.usable === false) return null;

            if (this.checkBlacklisted()) return null;
        }

        saveTasksToFile() {
            const filename = (
                (this.tasksFilename && path.resolve(__dirname, this.tasksFilename))
                || path.resolve(__dirname, 'task-for-user.json'));

            cprint(`Storing task info to ${filename}`, colors.green);
            const tasksInfo = JSON.stringify(this.tasks(), null, 4);
            fs.writeFile(filename, tasksInfo, (err) => {
                if (err)
                    cprint(`Error storing task info to file`, colors.red);
            });
        }

        loadTasksFromFile() {
            let filename = path.resolve(__dirname, 'default-task-settings.json');
            if (!!this.tasksFilename === true 
                && fs.existsSync(path.resolve(__dirname, this.tasksFilename))) {
                filename = path.resolve(__dirname, this.tasksFilename);
            }
            const str = fs.readFileSync(filename);
            const data = JSON.parse(str);
            for (const [taskname, settings] of Object.entries(data)) {
                if (settings.status === 1) {
                    const type = settings.type;
                    if (type === 'daily') {
                        this.register(taskname);
                    }
                    else if (type === 'scheduled') {
                        const tpList = settings.timeperiod;
                        const hasList = tpList !== null && Array.isArray(tpList);
                        if (hasList && tpList.length > 0) {
                            this.register(taskname,  { 'timeperiod': tpList });
                        }
                    }
                }
            }
        }

    }

    module.exports = AccountRunner;

})();
