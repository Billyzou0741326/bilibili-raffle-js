(function() {

    'use strict';

    const querystring = require('querystring');
    const cprint = require('../util/printer.js');
    const colors = require('colors/safe');

    class Response {

        constructor(options) {
            const {
                url,
                status_code,
                status_message,
                method,
                contentType,
                headers,
                data, } = options;
            Object.assign(this, options);
            Object.freeze(this);
        }

        isOk() {
            return this.status_code === 200;
        }

        json() {
            return JSON.parse(this.text());
        }

        cookies() {
            let cookies = {};
            if (this.headers) {
                const setCookie = this.headers['set-cookie'];
                setCookie && setCookie.forEach(c => {
                    try {
                        const cookieJar = c.split('; ');
                        const cookieItem = cookieJar[0].split('=');
                        cookies[cookieItem[0]] = cookieItem[1];
                    } catch (error) {
                        cprint(`\n${error.stack}`, colors.red);
                    }
                });
            }
            return cookies;
        }

        text() {
            let data = this.data;
            if (this.data instanceof Buffer) {
                data = this.data.toString();
            }
            return data;
        }

    }

    class ResponseBuilder {

        static start() {
            return new ResponseBuilder();
        }

        withHttpResponse(httpIncomingMessage) {
            this.headers = httpIncomingMessage.headers;
            this.status_code = httpIncomingMessage.statusCode;
            this.status_message = httpIncomingMessage.statusMessage;
            this.contentType = (this.headers && this.headers['content-type']) || '';
            return this;
        }

        withUrl(url) {
            this.url = url;
            return this;
        }

        withStatusCode(status_code) {
            this.status_code = status_code;
            return this;
        }

        withStatusMessage(status_message) {
            this.status_message = status_message;
            return this;
        }

        withMethod(method) {
            this.method = method;
            return this;
        }

        withData(data) {
            this.data = data;
            return this;
        }

        withContentType(contentType) {
            this.contentType = contentType;
            return this;
        }

        withHeaders(headers) {
            this.headers = headers;
            return this;
        }

        build() {
            this.url = this.url || '';
            this.method = this.method || '';
            this.headers = this.headers || {};
            this.status_code = this.status_code || 500;
            this.status_message = this.status_message || '';
            this.contentType = this.contentType || '';
            this.data = this.data || Buffer.alloc(0);
            return new Response(this);
        }
    }

    module.exports = ResponseBuilder;

})();
