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
        'gift',
        'anchor'
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
        }

        initServerConnection(server) {
            let connection = new Connection(server);
            connection.on('message', (gift) => this.broadcast(namedGifts.includes(gift.category) ? gift.category : '', gift));
            this.connections.push(connection);
        }

        run() {
            this.connections.forEach(connection => connection.connect());
        }

        broadcast(eventName, gift) {
            cprint(
                `${gift['id'].toString().padEnd(16)}`
                + `@${gift['roomid'].toString().padEnd(15)}`
                + `${gift['type'].padEnd(16)}`
                + `${gift['name']}`, 
                colors.cyan
            );

            this.emit(eventName, gift);
        }

    }

    class MultiServerRaffleReceiver extends RaffleReceiver {

        constructor(servers, options) {
            super(servers, options);

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

        run() {
            super.run();
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
                        for (const [id, gift] of gifts) {
                            if (gift.expireAt < threshold) {
                                gifts.delete(id);
                            }
                        }
                    });
                }, this.janitorInterval);
            }
        }

        broadcast(eventName, gift) {
            const gifts = this.receivedGifts.get(eventName);
            if (gifts && !gifts.has(gift.id)) {
                gifts.set(gift.id, gift);
                super.broadcast(eventName, gift);
            }
        }

    }

    module.exports = {
        RaffleReceiver,
        MultiServerRaffleReceiver,
    };

})();
