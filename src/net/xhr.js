(function() {

    'use strict';

    const http = require('http');
    const https = require('https');
    const querystring = require('querystring');
    const ResponseBuilder = require('./response.js');
    const HttpError = require('./httperror.js');

    class Xhr {

        static newSession() {
            return new Xhr();
        }

        constructor() {
        }

        request(req) {
            if (req.method === 'GET') {
                return this.get(req);
            } else if (req.method === 'POST') {
                return this.post(req);
            }
            throw new HttpError(`Request method '${req.method}' not Implemented`);
        }

        get(req) {
            let xhr = http;
            let agent = httpAgent;
            if (req.https === true) {
                xhr = https;
                agent = httpsAgent;
            }

            const options = {
                host: req.host,
                port: req.port,
                path: req.path,
                method: req.method,
                headers: req.headers,
                agent: agent,
            };

            const makeResponse = (incomingMessage, data) => {
                return (ResponseBuilder.start()
                    .withUrl(`${req.host}${req.path}`)
                    .withMethod(req.method)
                    .withHttpResponse(incomingMessage)
                    .withData(data)
                    .build());
            };

            return new Promise((resolve, reject) => {

                const request = xhr.request(options, response => {

                    response.on('error', error => {
                        reject(error);
                    });

                    if (response.statusCode === 200) {
                        const dataSequence = [];
                        response.on('data', data => dataSequence.push(data));
                        response.on('end', () => resolve(
                            makeResponse(response, Buffer.concat(dataSequence))));
                    } else {
                        resolve(
                            makeResponse(response));
                    }
                }).on('timeout', () => {
                    request.abort();
                }).on('abort', () => {
                    const err = new HttpError('Http request aborted');
                    reject(err);
                });
                request.end();
            });
        }

        post(req) {
            let xhr = http;
            let agent = httpAgent;
            if (req.https === true) {
                xhr = https;
                agent = httpsAgent;
            }

            const options = {
                host: req.host,
                port: req.port,
                path: req.path,
                method: req.method,
                headers: req.headers,
                agent: agent,
            };

            const makeResponse = (incomingMessage, data) => {
                return (ResponseBuilder.start()
                    .withHttpResponse(incomingMessage)
                    .withData(data)
                    .build());
            };

            return new Promise((resolve, reject) => {

                const request = xhr.request(options, response => {

                    response.on('error', error => {
                        reject(error);
                    });

                    if (response.statusCode === 200) {
                        const dataSequence = [];
                        response.on('data', data => dataSequence.push(data));
                        response.on('end', () => resolve(
                            makeResponse(response, Buffer.concat(dataSequence))));
                    } else {
                        resolve(
                            makeResponse(response));
                    }
                }).on('timeout', () => {
                    request.abort();
                }).on('abort', () => {
                    const err = new HttpError('Http request aborted');
                    reject(err);
                });
                if (req.data) {
                    request.write(req.data);
                }
                request.end();
            });
        }
    }


    module.exports = Xhr;


    /** https agent to handle request sending */
    const httpsAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 20,
        };
        return new https.Agent(options);
    })();

    /** http agent to handle request sending */
    const httpAgent = (() => {
        const options = {
            'keepAlive': true,
            'maxFreeSockets': 20,
        };
        return new http.Agent(options);
    })();



})();
