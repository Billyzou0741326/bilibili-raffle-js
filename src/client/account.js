(function() {

    'use strict';

    const fs = require('fs');
    const path = require('path');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    const Bilibili = require('../bilibili.js');
    const AccountSession = require('./bilibili-session.js');

    class Account {

        constructor(filename) {
            this.filename = filename || 'user.json';
            this.username = '';
            this.password = '';
            this.session = new AccountSession();
            this.usable = false;
            this.bind();

            this.loadFromFile();
        }

        bind() {
            this.storeSession = this.storeSession.bind(this);
            this.checkLoginCode = this.checkLoginCode.bind(this);
            this.saveToFile = this.saveToFile.bind(this);
        }

        updateLoginInfo(username, password) {
            let result = null;

            if (username && password) {
                this.username = username;
                this.password = password;
                result = this.login();
            } else {
                result = Promise.reject();
            }

            return Promise.resolve(result);
        }

        loadFromFile() {
            if (!!this.filename === true) {
                let filename = path.resolve(__dirname, this.filename);
                if (fs.existsSync(filename) === false) {
                    filename = path.resolve(__dirname, 'default-user-info.json');
                }
                const str = fs.readFileSync(filename);
                const data = JSON.parse(str);
                const user = data.user;
                if (user.username) this.username = user.username;
                if (user.password) this.password = user.password;
                this.session = new AccountSession(data);
                if (this.session.isComplete()) {
                    this.usable = true;
                } else {
                    this.usable = false;
                }
            }
        }

        login(forceLogin = false) {

            let result = null;

            if (this.session.isComplete() === false || forceLogin) {
                // 无可用cookies/tokens, login.

                this.usable = false;
                if (!!(this.username && this.password)) {
                    // 已提供username和password, login

                    cprint(`User ${this.username} logging in...`, colors.green);
                    result = (
                        Bilibili.login(this.username, this.password)
                        .then(this.checkLoginCode)
                        .then(this.storeSession)
                        .then(this.saveToFile)
                        .then(() => this.usable = true));
                } else {

                    result = Promise.reject(`用户名/密码未提供 && cookies/tokens读取失败`);
                }
            }

            return Promise.resolve(result);
        }

        refreshToken() {

            Bilibili.refreshToken(this.session).then(resp => {
                const code = resp['code'];

                if (code === 0) {
                    const data = resp['data'];

                    const options = {
                        'web': this.session['web'],
                        'app': data,
                    };
                    this.session = new AccountSession(options);
                    this.saveToFile();
                }
            }).catch(console.log);
        }

        checkLoginCode(resp) {
            let result = resp;
            if (resp) {
                const code = resp['code'];
                const msg = resp['msg'] || resp['message'];
                if (code !== 0) {
                    result = Promise.reject(`${code} - ${msg}`);
                }
            } else {
                result = Promise.reject(`Login failed - reason unknown`);
            }
            return result;
        }

        storeSession(resp) {
            const data = resp['data'];
            const app = data['token_info'];
            const rawCookies = data['cookie_info']['cookies'];
            const web = {};
            rawCookies.forEach(entry => {
                web[entry['name']] = entry['value'];
            });
            const options = { app, web };
            this.session = new AccountSession(options);
        }

        saveToFile() {
            const filename = (
                (this.filename && path.resolve(__dirname, this.filename))
                || path.resolve(__dirname, 'user.json'));

            cprint(`Storing login info to ${filename}`, colors.green);
            fs.writeFile(filename, this.toFileFormat(), (err) => {
                if (err)
                    cprint(`Error storing user info to file`, colors.red);
            });
        }

        info() {
            const result = {};
            const username = this.username;
            const password = this.password;
            result['user'] = { username, password };
            Object.assign(result, this.session.json());
            return result;
        }

        toFileFormat() {
            return JSON.stringify(this.info(), null, 4);
        }

    }

    module.exports = Account;

})();
