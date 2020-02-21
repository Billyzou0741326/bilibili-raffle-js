(function() {

    'use strict';

    const http = require('http');
    const https = require('https');
    const querystring = require('querystring');
    const ResponseBuilder = require('./response.js');
    const HttpError = require('./httperror.js');

    class Xhr {

        constructor() {
            this._rateLimiter = null;
        }

        withRateLimiter(limiter) {
            this._rateLimiter = limiter;
            return this;
        }

        request(request) {
            let xhr = null;
            const options = request.toHttpOptions();
            if (request.https === true) {
                xhr = https;
            } 
            else {
                xhr = http;
            }

            const sendRequest = () => {

                const promise = new Promise((resolve, reject) => {
                    const req = (xhr.request(options)
                        .on('timeout', () => req.abort())
                        .on('abort', () => reject(new HttpError('Http request aborted')))
                        .on('error', () => reject(new HttpError('Http request errored')))
                        .on('close', () => reject(new HttpError('Http request closed')))
                        .on('response', (response) => {
                            const code = response.statusCode || 0;
                            const dataSequence = [];
                            response.on('aborted', () => reject(new HttpError('Http request aborted')));
                            response.on('error', (error) => reject(new HttpError(error.message)));
                            response.on('data', (data) => dataSequence.push(data));

                            if (code >= 200 && code < 300) {
                                response.on('end', () => {
                                    let url = `${request.host}${request.path}`;
                                    let method = request.method;
                                    const data = Buffer.concat(dataSequence);
                                    const res = (ResponseBuilder.start()
                                        .withHttpResponse(response)
                                        .withUrl(url)
                                        .withMethod(method)
                                        .withData(data)
                                        .build()
                                    );
                                    resolve(res);
                                });
                            }
                            else {
                                reject((new HttpError(`Http status ${code}`)).withStatus(code));
                            }
                        })
                    );
                    if (request.data) {
                        req.write(request.data);
                    }
                    req.end();
                });

                return promise;
            };

            let result = new Promise((resolve) => {
                if (this._rateLimiter !== null) {
                    const task = () => { resolve(sendRequest()) };
                    this._rateLimiter.add(task);
                }
                else {
                    resolve(sendRequest());
                }
            });

            return result;
        }

        get(req) {
            let xhr = http;
            let agent = httpAgent;
            if (req.https === true) {
                xhr = https;
                agent = httpsAgent;
            }

            const options = req.toHttpOptions();
            options['agent'] = agent;

            return new Promise((resolve, reject) => {

                const request = (this.sendRequest(options, xhr, req.data)
                    .on('abort', () => {
                        const err = new HttpError('Http request aborted');
                        reject(err);
                    })
                    .on('error', error => {
                        const err = new HttpError(error.message);
                        reject(err);
                    })
                    .on('close', () => {
                        const err = new HttpError('Http request closed');
                        reject(err);
                    })
                    .on('response', response => {
                        const code = response.statusCode;

                        const dataSequence = [];
                        response.on('data', data => dataSequence.push(data));
                        response.on('error', error => reject(error));

                        if (code === 200) {
                            response.on('end', () => resolve(
                                this.makeResponse(
                                    response, request, Buffer.concat(dataSequence))));
                        } else {
                            const err = (new HttpError(`http status ${code}`)
                                .withStatus(code));
                            reject(err);
                        }
                    })
                );
            });
        }

        post(req) {
            let xhr = http;
            let agent = httpAgent;
            if (req.https === true) {
                xhr = https;
                agent = httpsAgent;
            }

            const options = req.toHttpOptions();
            options['agent'] = agent;

            return new Promise((resolve, reject) => {

                const request = (this.sendRequest(options, xhr, req.data)
                    .on('timeout', () => {
                        request.abort();
                    })
                    .on('abort', () => {
                        const err = new HttpError('Http request aborted');
                        reject(err);
                    })
                    .on('error', error => {
                        const err = new HttpError(error.message);
                        reject(err);
                    })
                    .on('close', () => {
                        const err = new HttpError('Http request closed');
                        reject(err);
                    })
                    .on('response', response => {
                        const code = response.statusCode;

                        const dataSequence = [];
                        response.on('data', data => dataSequence.push(data));
                        response.on('aborted', () => reject(new HttpError('Http request aborted')));
                        response.on('error', error => reject(error));

                        if (code === 200) {
                            response.on('end', () => resolve(
                                this.makeResponse(
                                    response, request, Buffer.concat(dataSequence))));
                        } else {
                            const err = (new HttpError(`http stauts ${code}`)
                                .withStatus(code));
                            reject(err);
                        }
                    }));
            });
        }

        sendRequest(options, xhr, data) {
            if (!xhr) xhr = https;
            let request = (xhr.request(options));
            if (data) {
                request.write(data);
            }
            request.end();
            return request;
        }

        makeResponse(incomingMessage, request, data) {
            let url = '';
            let method = '';
            if (request) {
                url = `${request.host}${request.path}`;
                method = request.method;
            }
            return (ResponseBuilder.start()
                .withHttpResponse(incomingMessage)
                .withUrl(url)
                .withMethod(method)
                .withData(data)
                .build());
        };
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
            'maxFreeSockets': 64,
        };
        return new http.Agent(options);
    })();



})();
