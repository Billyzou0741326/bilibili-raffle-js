(function() {

    'use strict';

    const EventEmitter = require('events').EventEmitter;
    const http = require('http');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');
    
    const Connection = require('./connection.js');

    const namedGifts = [
        'guard',
        'storm',
        'pk',
        'gift'
    ];
    
    class RaffleReceiver extends EventEmitter {

        constructor(servers, options) {
            super();

            this.connections = [];
            if (servers && servers.length > 0) {
                servers.forEach(server => this.initServerConnection(server));
            } else {
                this.initServerConnection({
                    'host': '127.0.0.1',
                    'port': 8999
                });
            }
            this.janitor = null;
            this.janitorInterval = 1000 * 60; // By default, clean up evey minute
            this.expiryThreshold = 60 * 5; // By default, clean up any expired gift 5 minutes after its expiry

            if (options) {
                if (options.hasOwnProperty('janitorInterval')) {
                    this.janitorInterval = options.janitorInterval * 1000 * 60; // janitorInterval is in minutes
                }
                if (options.hasOwnProperty('expiryThreshold')) {
                    this.expiryThreshold = options.expiryThreshold * 60; // expiryThreshold is in minutes
                }
            }
        }

        initServerConnection(server) {
            let connection = new Connection(server);
            connection.on('message', (gift) => this.broadcast(gift));
            this.connections.push(connection);
        }

        run() {
            this.receivedGifts = new Map();
            namedGifts.forEach(name => {
                this.receivedGifts.set(name, new Map());
            });
            this.connections.forEach(connection => connection.connect());

            if (this.janitor === null) {
                this.janitor = setInterval(() => {
                    const threshold = new Date().valueOf() / 1000 - this.expiryThreshold;
                    namedGifts.forEach(name => {
                        const gifts = this.receivedGifts.get(name);
                        for (let [id, gift] of gifts) {
                            if (gift.expireAt < threshold) {
                                gifts.delete(id);
                            }
                        }
                    });
                }, this.janitorInterval);
            }
        }

        broadcast(gift) {
            const eventName = namedGifts.includes(gift.type) ? gift.type : 'gift';
            const gifts = this.receivedGifts.get(eventName);
            if (gifts && !gifts.has(gift.id)) {
                cprint(
                    `${gift['id'].toString().padEnd(16)}`
                    + `@${gift['roomid'].toString().padEnd(15)}`
                    + `${gift['type'].padEnd(16)}`
                    + `${gift['name']}`, 
                    colors.cyan
                );

                gifts.set(gift.id, gift);
                this.emit(eventName, gift);
            }
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
