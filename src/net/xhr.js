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
            return Promise.reject(
                new HttpError(`Request method '${req.method}' not Implemented`));
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
            'maxFreeSockets': 20,
        };
        return new http.Agent(options);
    })();



})();
