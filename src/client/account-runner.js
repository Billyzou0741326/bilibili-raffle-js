(function() {

    'use strict';

    const path = require('path');
    const fs = require('fs');

    const VirtualQueue = require('./queue.js');
    const Account = require('./account.js');
    const Bilibili = require('../bilibili.js');
    const ScheduledTask = require('./tasks/scheduledtask.js');
    const DailyTask = require('./tasks/dailytask.js');
    const TimePeriod = require('./tasks/timeperiod.js');
    const Clock = require('./tasks/clock.js');
    const { sleep, } = require('../util/utils.js');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    class AccountRunner extends Account {

        constructor(filename, options) {
            super(filename, options);
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
            this.blackListed = false;
            this.roomEntered = new Set();
            this.q = new VirtualQueue(50, 1000);
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
                const tp = options.timeperiod;
                if (tp) {
                    if (Array.isArray(tp) === true)
                        task.updateTimePeriod && task.updateTimePeriod(...tp);
                    else
                        task.updateTimePeriod && task.updateTimePeriod(tp);
                }
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
                    const award = resp['data']['text'];
                    cprint(award, colors.green);
                }

            }).then(resp => {
                if (!resp) return;

                let result = null;
                const code = resp['code'];

                if (code === 0) {
                    const award = resp['data']['text'];
                    cprint(award, colors.green);
                } else {
                    const msg = resp['msg'] || resp['message'] || '';
                    result = Promise.reject(`直播签到失败: (${code})${msg}`);
                }

                return result;
            }).catch(this.reportHttpError);
        }

        /** 银瓜子 */
        liveSilverBox() {
            if (this.usable === false) return null;

            if (this.blackListed === true) return null;

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
                            return null;
                        } else {
                            ++errCount;
                            if (errCount < 3)
                                continue;
                            throw `银瓜子领取失败: (${code})${msg}`;
                        }
                    }

                    const diff = data.time_end - Number.parseInt(0.001 * new Date());

                    // 2. Get SilverBox award
                    await sleep(diff * 1000);
                    resp = await Bilibili.getSilverBox(this.session, data);
                    const msg = resp['message'] || resp['msg'] || '';
                    if (resp['code'] === 0) {
                        data = resp['data'];
                        const silverCount = data['silver'];
                        const added = data['awardSilver'];
                        cprint(`银瓜子: ${silverCount} (+${added})`, colors.green);
                        if (data['isEnd'] !== 0) return null;
                    } else {
                        if (msg.includes('访问被拒绝')) this.blackListed = true;
                        throw msg;
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
                        cprint('双端观看未完成', colors.green);
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
                    try {
                        await Bilibili.appRoomEntry(this.session, roomid);
                    } catch (error) {
                        cprint(`Error(room) - ${error}`, colors.red);
                    }
                })();
            } else {

                promise = Promise.resolve();

                const rooms = Array.from(this.roomEntered);
                if (rooms.length > 30) {
                    this.roomEntered = new Set(rooms.slice(15));
                }
            }

            return promise;
        }

        joinPK(pk) {
            if (this.usable === false) return null;

            this.postRoomEntry(pk['roomid']).then(() => {

                return Bilibili.appJoinPK(this.session, pk);
            }).then(resp => {

                let text = '';
                let color = colors.green;
                const code = resp['code'];
                if (code === 0) {
                    const data = resp['data'];
                    text = `${data['award_text']}`;
                } else {
                    const msg = resp['message'] || resp['msg'] || '';
                    text = `${pk.id} 获取失败: ${msg}`;
                    color = colors.red;
                }

                cprint(text, color);
            }).catch(this.reportHttpError);
        }

        joinGift(gift) {
            if (this.usable === false) return null;

            this.postRoomEntry(gift['roomid']).then(() => {

                return Bilibili.appJoinGift(this.session, gift);
            }).then(resp => {

                let text = '';
                let color = colors.green;
                const code = resp['code'];
                if (code === 0) {
                    const data = resp['data'];
                    const gift_name = resp['data']['gift_name'];
                    const gift_num = resp['data']['gift_num'];
                    text = `${gift_name}+${gift_num}`;
                } else {
                    const msg = resp['message'] || resp['msg'] || '';
                    text = `${gift.id} 获取失败: ${msg}`;
                    color = colors.red;
                }

                cprint(text, color);
            }).catch(this.reportHttpError);
        }

        joinGuard(guard) {
            if (this.usable === false) return null;

            this.postRoomEntry(guard['roomid']).then(() => {

                return Bilibili.appJoinGuard(this.session, guard);
            }).then(resp => {

                let text = '';
                let color = colors.green;
                const code = resp['code'];

                if (code === 0) {
                    const data = resp['data'];
                    text = `${data['message']}`;
                } else {
                    const msg = resp['message'] || resp['msg'] || '';
                    text = `${guard.id} 获取失败: ${msg}`;
                    color = colors.red;
                }

                cprint(text, color);
            }).catch(this.reportHttpError);
        }

        joinStorm(storm) {
            if (this.usable === false) return null;
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
            Object.entries(data).forEach(entry => {
                const taskname = entry[0];
                const settings = entry[1];
                const reg = settings['status'] === 1;
                const type = settings['type'];
                const tpList = settings['timeperiod'];
                if (type === 'daily' && reg) {
                    this.register(taskname);
                }
                if (type === 'scheduled' && reg) {
                    const hasList = tpList !== null && Array.isArray(tpList);
                    if (hasList && tpList.length > 0) {
                        const tp = tpList[0];
                        const from = Clock.today();
                        const to = Clock.today();
                        from.setHours(tp['from']['hours'], tp['from']['minutes']);
                        to.setHours(tp['to']['hours'], tp['to']['minutes']);
                        const timeperiod = new TimePeriod(from, to);
                        this.register(taskname, { timeperiod });
                    }
                }
            });
        }

    }

    module.exports = AccountRunner;

})();
