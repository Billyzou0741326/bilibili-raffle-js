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
            this.stormJoinMaxInterval = 60; // By default, max interval between storm 'join' request is 60 ms, if internet is slower than that
            this.abandonStormAfter = 1000 * 25; // By default, abandon a storm after 25 seconds 
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
                if (options.hasOwnProperty('stormJoinMaxInterval')) {
                    this.stormJoinMaxInterval = options.stormJoinMaxInterval; // stormJoinMaxInterval is in milliseconds
                }
                if (options.hasOwnProperty('abandonStormAfter')) {
                    this.abandonStormAfter = options.abandonStormAfter * 1000; // abandonStormAfter is in seconds
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

            if (msg.includes('请稍后再试')) {
                // Just retry
                cprint(`${msg} -- 将重新获取`, colors.yellow);
                return Promise.resolve(true);
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

            return Bilibili.watchVideo(this.session, info).then(resp => {

                if (resp.code !== 0) {
                    const msg = resp.message || resp.msg || '';
                    return Promise.reject(`视频观看失败: (${resp.code})${msg}`);
                }

                cprint('视频观看成功', colors.green);

            }).catch(this.reportHttpError);
        }

        /** 主站分享视频 */
        mainShareVideo(aid=70160595) {
            if (this.usable === false) return null;

            return Bilibili.shareVideo(this.session, { aid }).then(resp => {

                if (resp.code !== 0) {
                    const msg = resp.message || resp.msg || '';
                    return Promise.reject(`视频分享失败: (${resp.code})${msg}`);
                }

                cprint(`视频分享: ${resp.data.toast}`, colors.green);

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
                    let data = resp.data;
                    if (typeof data.time_start === 'undefined') {

                        let msg = resp.message || resp.msg || '';
                        if (msg.match(/今天.*领完/) !== null) {
                            cprint(msg, colors.grey);
                            break;
                        } else {
                            let showError = false;
                            await this.checkErrorResponse(msg).catch((err) => {
                                showError = true;
                                msg = err;
                            });
                            if (showError && ++errCount >= 3) {
                                cprint(`银瓜子领取失败: (${resp.code})${msg}`, colors.red);
                                break;
                            }

                            continue;
                        }
                    }

                    const diff = data.time_end - new Date() / 1000;
                    //cprint(`下一个银瓜子宝箱需要等待${diff.toFixed(3)}秒`, colors.yellow);

                    // 2. Get SilverBox award
                    await sleep(diff * 1000);
                    resp = await Bilibili.getSilverBox(this.session, data);
                    data = resp.data;
                    if (resp.code === 0) {
                        cprint(`银瓜子: ${data.silver} (+${data.awardSilver})`, colors.green);
                        if (data.isEnd !== 0) break;
                    } else {
                        let msg = resp.message || resp.msg || '';
                        let showError = false;
                        await this.checkErrorResponse(msg).catch((err) => {
                            showError = true;
                            msg = err;
                        });
                        if (showError) {
                            cprint(`银瓜子领取失败: (${resp.code})${msg}`, colors.red);
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

            (Promise.all([
                Bilibili.appGetInfoByUser(this.session, { roomid }).catch(console.log),
                Bilibili.webGetInfoByUser(this.session, { roomid }).catch(console.log),
            ])
                .then(() => {
                    return Bilibili.webLiveOnlineHeart(this.session, { roomid });
                })
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
                while (true) {
                    // await throws error when a promise is rejected.
                    // execute().catch(...) will handle the error thrown
                    const taskResp = await Bilibili.liveTaskInfo(this.session);
                    const doubleStatus = taskResp['data']['double_watch_info']['status'];
                    const awards = taskResp['data']['double_watch_info']['awards'];

                    if (doubleStatus === 1) {
                        const awardResp = await Bilibili.liveDoubleWatch(this.session);
                        if (awardResp.code !== 0) {
                            const msg = awardResp.message || awardResp.msg || '';
                            cprint(`双端观看奖励领取失败: (${awardResp.code})${msg}`, colors.red);
                        } else {
                            const awardTexts = awards.map(award => `${award.name}(${award.num})`);
                            const awardText = '双端观看奖励: ' + awardTexts.join('   ');
                            cprint(awardText, colors.green);
                        }
                        break;
                    } else if (doubleStatus === 2) {
                        const awardTexts = awards.map(award => `${award.name}(${award.num})`);
                        const awardText = '双端观看奖励已领取: ' + awardTexts.join('   ');
                        cprint(awardText, colors.grey);
                        break;
                    } else if (doubleStatus === 0) {
                        cprint('双端观看未完成', colors.grey);
                    }

                    // Need to watch on web & app for at least 5 minutes. To be sure, wait for 6 minutes.
                    await sleep(1000 * 60 * 6);
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
                        let msg = resp.message || resp.msg || '';
                        let showError = false;
                        await this.checkErrorResponse(msg).catch((err) => {
                            showError = true;
                            msg = err;
                        });
                        if (showError) {
                            cprint(`${pk.id} 获取失败: ${msg}`, colors.red);
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
                        let msg = resp.message || resp.msg || '';
                        let showError = false;
                        await this.checkErrorResponse(msg).catch((err) => {
                            showError = true;
                            msg = err;
                        });
                        if (showError) {
                            cprint(`${gift.name} ${gift.id} 获取失败: ${msg}`, colors.red);
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
                        let msg = resp.message || resp.msg || '';
                        let showError = false;
                        await this.checkErrorResponse(msg).catch((err) => {
                            showError = true;
                            msg = err;
                        });
                        if (showError) {
                            cprint(`${guard.name} ${guard.id} 获取失败: ${msg}`, colors.red);
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

            const start = new Date();
            const tasks = [];                 // An array of `join` promises
            let quit = false;
            let i = 0;
            let message = '';
            let claimed = false;

            const join = async () => {
                while (!quit) {
                    const t = Bilibili.appJoinStorm(this.session, storm);
                    tasks.push(t);
                    ++i;
                    await Promise.race( [ t.catch(), sleep(this.stormJoinMaxInterval) ] );       // whichever is done first, 60 ms or `join` request
                }
            };
            const isDone = (resp) => {
                const msg = resp['msg'] || resp['message'] || '';
                if (resp['code'] === 0) {
                    const giftName = resp['data']['gift_name'];
                    const giftNum = resp['data']['gift_num'];
                    const awardText = `${giftName}+${giftNum}`;
                    message = awardText;
                    claimed = true;
                }
                else if (msg.includes('已经领取')) {
                    claimed = true;
                }
                return claimed;
            };
            const setQuitFlag = async () => {
                try {
                    while (!quit) {
                        const results = await Promise.all(tasks);
                        quit = quit || results.some(response => isDone(response));
                        quit = quit || (new Date() - start > this.abandonStormAfter);
                    }
                    const results = await Promise.all(tasks);
                    results.every(response => isDone(response));
                }
                catch (error) {
                    quit = true;
                    message = `(Storm) - ${error}`;
                }
            };

            const execute = async () => {
                await Promise.all( [ join(), setQuitFlag() ] );

                let color = colors.green;
                if (claimed) {
                    message = message || '亿圆已领取';
                } else {
                    message = message || `风暴 ${storm.id} 已经超过${this.abandonStormAfter / 1000}秒，放弃领取`;
                    color = colors.red;
                }

                cprint(message, color);
                cprint(`Executed ${i} times`, colors.green);
            };

            execute();
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
