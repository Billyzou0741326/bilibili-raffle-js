(function() {

    'use strict';

    const EventEmitter = require('events').EventEmitter;
    const ws = require('ws');

    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    const State = {
        INIT: 0,
        CONNECTING: 1,
        CONNECTED: 2,
        CONNECT_PENDING: 3,
        CLOSING: 4,
        CLOSED: 5,
        CLOSE_PENDING: 6,
        ERROR: 7,
        DISCONNECTING: 8,
        DISCONNECTED: 9,
        DISCONNECT_PENDING_CONNECTION: 10,
        DISCONNECT_PENDING_CLOSE: 11
    };

    class Connection extends EventEmitter {

        constructor(server) {
            super();

            this.numRetries = 3; // By default, retry connection for 3 times before wait
            if (server.hasOwnProperty('retries')) {
                this.numRetries = server.retries;
            }
            this.reconnectWaitTime = 1000 * 10; // By default, try to reconnect after 10 seconds
            if (server.hasOwnProperty('reconnectWaitTime')) {
                this.reconnectWaitTime = server.reconnectWaitTime * 1000; // reconnectWaitTime is in seconds
            }
            this.healthCheckInterval = 1000 * 5; // By default, health check is performed every 5 seconds
            if (server.hasOwnProperty('healthCheckInterval')) {
                this.healthCheckInterval = server.healthCheckInterval * 1000; // healthCheckInterval is in seconds
            }
            this.healthCheckThreshold = 1000 * 25; // By default, health check will fail if last ping time was more than 25 seconds ago
            if (server.hasOwnProperty('healthCheckThreshold')) {
                this.healthCheckThreshold = server.healthCheckThreshold * 1000; // healthCheckThreshold is in seconds
            }
            this.enableConnectionErrorLogging = true;
            if (server.hasOwnProperty('enableConnectionErrorLogging')) {
                this.enableConnectionErrorLogging = server.enableConnectionErrorLogging;
            }
            this.enableConnectionRetryLogging = true;
            if (server.hasOwnProperty('enableConnectionRetryLogging')) {
                this.enableConnectionRetryLogging = server.enableConnectionRetryLogging;
            }
            this.infoColor = colors[server.infoColor || 'green'];
            this.errorColor = colors[server.errorColor || 'red'];

            this.ws = null;
            this.wsAddress = `ws://${server.host}:${server.port}`;
            this.retries = this.numRetries;
            this.state = State.INIT;

            this.onOpen = this.onOpen.bind(this);
            this.onPing = this.onPing.bind(this);
            this.onClose = this.onClose.bind(this);
            this.onError = this.onError.bind(this);
            this.onMessage = this.onMessage.bind(this);

            this.reconnectTask = null;
            this.healthCheckTask = null;
        }

        reset() {
            switch (this.state) {
                case State.CLOSED:
                case State.CLOSING:
                case State.DISCONNECTED:
                case State.DISCONNECT_PENDING_CLOSE:
                    this.ws = null;
                    if (this.healthCheckTask !== null) {
                        clearInterval(this.healthCheckTask);
                        this.healthCheckTask = null;
                    }
                    break;

                default:
                    // Shouldn't happen
                    cprint(`Connection.reset(): unexpected state ${this.state}`, this.errorColor);
            }
        }

        connect() {
            switch (this.state) {
                case State.INIT:
                case State.CLOSED:
                    this.state = State.CONNECTING;
                    this.ws = new ws(this.wsAddress);
                    this.ws.on('open', this.onOpen);
                    this.ws.on('ping', this.onPing);
                    this.ws.on('error', this.onError);
                    this.ws.on('close', this.onClose);
                    this.ws.on('message', this.onMessage);
                    break;

                case State.CLOSING:
                    // Wait until socket is closed before re-connecting
                    this.state = State.CONNECT_PENDING;
                    break;

                case State.CLOSE_PENDING:
                    // Still connecting, remove the pending close request
                    this.state = State.CONNECTING;
                    break;

                case State.CONNECTING:
                case State.CONNECTED:
                case State.CONNECT_PENDING:
                    // Do nothing
                    break;

                default:
                    // Shouldn't happen
                    cprint(`Connection.connect(): unexpected state ${this.state}`, this.errorColor);
            }
        }

        disconnect() {
            // disconnect() is similar to close(), but with different states so connection won't be retried after socket is closed
            switch (this.state) {
                case State.CONNECTED:
                    this.state = State.DISCONNECTING;
                    this.close();
                    break;

                case State.CONNECTING:
                case State.CLOSE_PENDING:
                    this.state = State.DISCONNECT_PENDING_CONNECTION;
                    break;

                case State.CLOSING:
                case State.CONNECT_PENDING:
                    this.state = State.DISCONNECT_PENDING_CLOSE;
                    break;

                case State.DISCONNECTING:
                case State.DISCONNECTED:
                case State.DISCONNECT_PENDING_CLOSE:
                case State.DISCONNECT_PENDING_CONNECTION:
                    // Do nothing
                    break;

                case State.INIT:
                case State.CLOSED:
                    this.state = State.DISCONNECTED;
                    this.reset();
                    break;

                default:
                    // Shouldn't happen
                    cprint(`Connection.disconnect(): unexpected state ${this.state}`, this.errorColor);
            }
        }

        close() {
            switch (this.state) {
                case State.CONNECTED:
                case State.ERROR:
                    this.state = State.CLOSING;
                    this.ws && this.ws.close();
                    this.reset();
                    break;

                case State.DISCONNECTING:
                    this.state = State.DISCONNECT_PENDING_CLOSE;
                    this.ws && this.ws.close();
                    this.reset();
                    break;

                case State.CONNECTING:
                    // Wait until socket is connected before closing
                    this.state = State.CLOSE_PENDING;
                    break;

                case State.CONNECT_PENDING:
                    // Still closing, remove the pending connect request
                    this.state = State.CLOSING;
                    break;

                case State.CLOSING:
                case State.CLOSED:
                case State.CLOSE_PENDING:
                    // Do nothing
                    break;

                default:
                    // Shouldn't happen
                    cprint(`Connection.close(): unexpected state ${this.state}`, this.errorColor);
            }
        }

        onOpen() {
            cprint(`[ Server ] Established connection with ${this.wsAddress}`, this.infoColor);
            this.lastPing = new Date();
            this.retries = this.numRetries;
            if (this.reconnectTask !== null) {
                clearInterval(this.reconnectTask);
                this.reconnectTask = null;
            }

            switch (this.state) {
                case State.CONNECTING:
                    this.state = State.CONNECTED;
                    break;

                case State.CLOSE_PENDING:
                    // There is a pending close request, execute it
                    this.state = State.CONNECTED;
                    this.close();
                    break;

                case State.DISCONNECT_PENDING_CONNECTION:
                    // There is a pending disconnect request, execute it
                    this.state = State.DISCONNECTING;
                    this.close();
                    break;

                default:
                    // Shouldn't happen
                    cprint(`Connection.onOpen(): unexpected state ${this.state}`, this.errorColor);
            }

            if (this.healthCheckTask === null) {
                this.healthCheckTask = setInterval(() => {
                    if (new Date() - this.lastPing > this.healthCheckThreshold) {
                        cprint(`[ Server ] Health check failed for ${this.wsAddress}, will try to reconnect`, this.errorColor);
                        this.close();
                    }
                }, this.healthCheckInterval);
            }

            this.emit('connection', true);
        }

        onError(error) {
            if (this.enableConnectionErrorLogging) {
                cprint(`Error in monitor-server: ${error.message}`, this.errorColor);
            }

            switch (this.state) {
                case State.CONNECTING:
                case State.CONNECTED:
                case State.CLOSE_PENDING:
                    this.state = State.ERROR;
                    this.close();

                case State.CLOSING:
                case State.DISCONNECT_PENDING_CLOSE:
                    // Already closing. Do nothing.
                    break;

                case State.DISCONNECT_PENDING_CONNECTION:
                    this.state = State.DISCONNECTING;
                    this.close();
                    break;

                default:
                    // Shouldn't happen
                    cprint(`Connection.onError(): unexpected state ${this.state}`, this.errorColor);
            }

            this.emit('connection', false);
        }

        onClose(code, reason) {
            switch (this.state) {
                case State.CONNECTED:
                    // Only display error if disconnected by server
                    cprint(`[ Server ] Lost connection to ${this.wsAddress}`, this.errorColor);

                    // At least retry once if disconnected by server
                    if (this.retries < 1) {
                        this.retries = 1;
                    }

                case State.CLOSING:
                case State.CONNECT_PENDING:
                    // If not disconnecting, retry connection with or without a pending connect request
                    this.state = State.CLOSED;
                    this.reset();

                    if (this.retries > 0) {
                        this.retries--;
                        if (this.enableConnectionRetryLogging) {
                            cprint(`[ Server ] Trying to reconnect to ${this.wsAddress} ...`, this.infoColor);
                        }
                        this.connect();
                    } else if (this.reconnectTask === null) {
                        this.reconnectTask = setInterval(() => {
                            if (this.enableConnectionRetryLogging) {
                                cprint(`[ Server ] Trying to reconnect to ${this.wsAddress} ...`, this.infoColor);
                            }
                            this.connect();
                        }, this.reconnectWaitTime);
                    }
                    break;

                case State.DISCONNECT_PENDING_CLOSE:
                    // Disconnecting, will not retry connection
                    this.state = State.DISCONNECTED;
                    this.reset();
                    cprint(`[ Server ] Abandoned connection to ${this.wsAddress}`, this.infoColor);
                    break;

                default:
                    // Shouldn't happen
                    cprint(`Connection.onClose(): unexpected state ${this.state}`, this.errorColor);
            }

            this.emit('connection', false);
        }

        onMessage(data) {
            const body = data.toString('utf8');

            this.emit('message', JSON.parse(body));
        }

        onPing() {
            this.lastPing = new Date();
            this.ws && this.ws.pong();
        }
    }

    module.exports = Connection;
})();
