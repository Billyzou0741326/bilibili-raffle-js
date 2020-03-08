(function() {

    'use strict';

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    const express = require('express');
    const bodyParser = require('body-parser');

    const Account = require('../client/account.js');
    const Clock = require('../client/tasks/clock.js');
    const TimePeriod = require('../client/tasks/timeperiod.js');


    const dailyTasks = [
        'livesign',
        'liveheart',
        'idolclubsign',
        'mainsharevideo',
        'mainwatchvideo',
        'doublewatch',
    ];

    const scheduledTasks = [
        'pk',
        'gift',
        'guard',
        'storm',
    ];


    class HttpHost {

        constructor(user) {
            this.bind();

            this.user = user || null;
            this._app = express();
            this._router = express.Router();

            this.jsonParser = bodyParser.json();

            this.routes = {
                '/info': {
                    'get': this.getInfo,
                    'post': this.postInfo,
                },
                '/tasks': {
                    'get': this.getTasks,
                },
                '/register/task': {
                    'post': this.registerTask,
                },
                '/unregister/task': {
                    'post': this.unregisterTask,
                },
            };
            this.jsonVerifier = {
                '/register': this.registerVerifier,
                '/unregister': this.unregisterVerifier,
                '/info': this.infoVerifier,
            };

            this.setup();
        }

        app() {
            return this._app;
        }

        setup() {
            Object.entries(this.routes).forEach(entry => {
                const path = entry[0];
                const settings = entry[1];
                if (typeof settings['get'] !== 'undefined')
                    this._router.get(path, settings['get']);
                if (typeof settings['post'] !== 'undefined')
                    this._router.post(path, this.jsonParser, settings['post']);
            });
            this._app.use('/', this._router);
            this._app && this._app.use(this.handleError);
            this._router && this._router.use(this.handleError);
        }

        handleError(error, request, response, next) {
            if (error) {
                cprint(`Error(API): ${error.type}`, colors.red);
                console.log(error);
                response.jsonp({ 'code': 1, 'msg': error.type });
            } else {
                next();
            }
        }

        bind() {
            this.getInfo = this.getInfo.bind(this);
            this.postInfo = this.postInfo.bind(this);
            this.getTasks = this.getTasks.bind(this);
            this.registerTask = this.registerTask.bind(this);
            this.unregisterTask = this.unregisterTask.bind(this);

            this.verifyUser = this.verifyUser.bind(this);
            this.infoVerivier = this.infoVerifier.bind(this);
            this.registerVerifier = this.registerVerifier.bind(this);
            this.unregisterVerifier = this.unregisterVerifier.bind(this);

            this.handleError = this.handleError.bind(this);
        }

        getInfo(request, response) {
            let info = null;

            if (this.user !== null) {
                info = this.user.info();
            }

            const result = {
                'code': 0,
                'msg': 'success',
                'data': info,
            };

            response.jsonp(result);
        }

        getTasks(request, response) {
            let tasks = null;

            if (this.user !== null) {
                tasks = this.user.tasks();
            }

            const result = {
                'code': 0,
                'msg': 'success',
                'data': tasks,
            };

            response.jsonp(result);
        }

        postInfo(request, response) {
            const json = request.body;
            const result = {};

            if (this.infoVerifier(json)) {
                const username = json['username'];
                const password = json['password'];
                (this.user.updateLoginInfo(username, password)
                    .then(() => {
                        result['code'] = 0;
                        result['msg'] = 'Login success';
                    })
                    .catch(error => {
                        result['code'] = 1;
                        result['msg'] = 'Login failed';
                    })
                    .then(() => {
                        // returning result here
                        response.jsonp(result);
                    })
                    .catch(error => {}));
            }
        }

        infoVerifier(json) {
            const usernameOk = typeof json['username'] !== 'undefined';
            const passwordOk = typeof json['password'] !== 'undefined';
            return usernameOk && passwordOk;
        }

        registerTask(request, response) {
            const json = request.body;
            const result = {};

            if (this.registerVerifier(json)) {

                const taskname = json['taskname'];
                const rawTimeperiod = json['timeperiod'];
                let timeperiod = null;

                if (rawTimeperiod) {
                    timeperiod = new TimePeriod(rawTimeperiod.from, rawTimeperiod.to);
                }

                const updated = this.user.register(json['taskname'], { timeperiod });

                if (updated === true) {
                    result['code'] = 0;
                    result['msg'] = 'success';
                } else {
                    result['code'] = 1;
                    result['msg'] = 'update failed';
                }

            } else {
                result['code'] = 1; 
                result['msg'] = 'JSON format error';
            }

            response.jsonp(result);
        }

        registerVerifier(json) {

            const taskname = json['taskname'];
            const timepeiod = json['timeperiod'];
            const tasknameOk = typeof taskname !== 'undefined';
            const timeperiodOk = typeof timeperiod !== 'undefined' && timeperiod !== null;

            let fromOk = false;
            let toOk = false;
            let hoursOk = false;
            let minutesOk = false;
            let finalOk = false;

            if (timeperiodOk) {
                const from = json['timeperiod']['from'];
                const to = json['timeperiod']['to'];
                fromOk = typeof from !== 'undefined';
                toOk = typeof to !== 'undefined';

                Object.keys(json['timeperiod']).forEach(time => {
                    if (hoursOk && minutesOk) {
                        hoursOk = hoursOk && Number.isInteger(time['hours']);
                    }
                    if (hoursOk && minutesOk) {
                        minutesOk = minutesOk && Number.isInteger(time['minutes']);
                    }
                });
            }


            if (dailyTasks.includes(taskname)) {
                finalOk = true;
            } else if (scheduledTasks.includes(taskname)) {
                finalOk = fromOk && toOk && hoursOk && minutesOk;
            }

            return finalOk;
        }

        unregisterTask(request, response) {
            const json = request.body;
            const result = {};

            if (this.unregisterVerifier(json)) {

                this.user.unregister(json['taskname']);
                result['code'] = 0;
                result['msg'] = 'success';
            } else {
                result['code'] = 1;
                result['msg'] = 'JSON format error';
            }

            response.jsonp(result);
        }

        unregisterVerifier(json) {
            const taskname = json['taskname'];
            const finalOk = dailyTasks.includes(taskname) || scheduledTasks.includes(taskname);
            return finalOk;
        }

        verifyUser(request, response, next) {
            if (this.user && this.user instanceof Account) {
                next();
            } else {
                const result = {
                    'code': 1,
                    'msg': 'User failed to establish',
                };
                reponse.jsonp(result);
            }
        }

    }

    module.exports = HttpHost;

})();
