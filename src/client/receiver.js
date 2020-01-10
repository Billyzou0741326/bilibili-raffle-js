(function() {

    'use strict';

    const EventEmitter = require('events').EventEmitter;
    const ws = require('ws');
    const http = require('http');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    class RaffleReceiver extends EventEmitter {

        constructor(host, port) {
            super();
            this.host = host || '127.0.0.1';
            this.port = port || 8999;

            this.ws = null;
            this.wsAddress = `ws://${this.host}:${this.port}`;
            this.retries = 4;
            this.closedByUs = false;

            this.onOpen = this.onOpen.bind(this);
            this.onPing = this.onPing.bind(this);
            this.onClose = this.onClose.bind(this);
            this.onError = this.onError.bind(this);
            this.onMessage = this.onMessage.bind(this);

            this.reconnectTask = null;
            this.healthCheckTask = null;
        }

        reset() {
            this.ws = null;
            if (this.healthCheckTask !== null) {
                clearInterval(this.healthCheckTask);
                this.healthCheckTask = null;
            }
        }

        run() {
            if (this.ws === null) {
                this.closedByUs = false;
                this.ws = new ws(this.wsAddress);
                this.ws.on('open', this.onOpen);
                this.ws.on('ping', this.onPing);
                this.ws.on('error', this.onError);
                this.ws.on('close', this.onClose);
                this.ws.on('message', this.onMessage);
            }
        }

        onOpen() {
            cprint(`[ Server ] Established connection with ${this.wsAddress}`, colors.green);
            this.lastPing = +new Date();
            this.retries = 3;
            if (this.reconnectTask !== null) {
                clearInterval(this.reconnectTask);
                this.reconnectTask = null;
            }
            if (this.healthCheckTask === null) {
                this.healthCheckTask = setInterval(() => {
                    if (new Date() - this.lastPing > 25000) {
                        this.close(false);
                    }
                }, 5 * 1000);
            }
        }

        onError(error) {
            cprint(`Error in monitor-server: ${error.message}`, colors.red);
            this.ws.close();
        }

        onClose(code, reason) {
            --this.retries;
            this.reset();
            cprint(`[ Server ] Lost connection to ${this.wsAddress}`, colors.red);
            cprint('[ Server ] 尝试重连... ', colors.green);

            if (this.retries > 0) {
                this.run();
            } else if (this.reconnectTask === null) {
                this.reconnectTask = setInterval(() => {
                    this.run();
                }, 10 * 1000);
            }
        }

        close(closedByUs=true) {
            this.closedByUs = closedByUs;
            this.ws && this.ws.close();
            this.ws = null;
        }

        onMessage(data) {
            const body = data.toString('utf8');

            this.broadcast(JSON.parse(body));
        }

        onPing() {
            this.lastPing = +new Date();
            this.ws.pong();
        }

        broadcast(gift) {
            cprint(
                `${gift['id'].toString().padEnd(13)}`
                + `@${gift['roomid'].toString().padEnd(13)}`
                + `${gift['type'].padEnd(13)}`
                + `${gift['name']}`, 
                colors.cyan
            );

            const namedGifts = [
                'guard',
                'storm',
                'pk',
            ];
            const eventName = namedGifts.includes(gift['type']) ? gift['type'] : 'gift';

            this.emit(eventName, gift);

        }

    }

    module.exports = RaffleReceiver;

    const request = (options, data='') => {

        return new Promise((resolve, reject) => {

            const req = http.request(options, (response) => {

                response.on('error', error => {
                    reject(`Error: ${error.message}`);
                });

                if (response.statusCode === 200) {
                    let dataSequence = [];

                    response.on('data', (data) => {
                        dataSequence.push(data);
                    });
                    response.on('end', () => {
                        const jsonStr = Buffer.concat(dataSequence).toString();
                        try {
                            const jsonObj = JSON.parse(jsonStr);
                            resolve(jsonObj);
                        } catch (error) {
                            reject(`Error: ${error.message}`);
                        }
                    });
                } else {
                    reject(`Error: Response status code ${response.statusCode}`);
                }
            }).on('error', error => {
                reject(`Error: ${error.message}`);
            });
            req.write(data);
            req.end();
        });
    };
})();
